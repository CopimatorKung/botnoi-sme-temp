// Edge Function: line-oa-registration
// รับข้อมูลธุรกิจที่บอท Botnoi เก็บมาจากลูกค้า
//
// URL ที่ตั้งใน Botnoi API:
//   POST https://<project>.supabase.co/functions/v1/line-oa-registration?uid=<<customer_id>>
//
// Body ที่ Botnoi ส่งมา:
// {
//   "business": [{
//     "business_name": "...",
//     "details": "...",
//     "telephone_number": "...",
//     "sme_tag": "..."
//   }]
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

const LINE_USER_ID_RE = /^U[0-9a-f]{32}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return json(200, { ok: true, service: "line-oa-registration", status: "running" });
  }

  if (req.method !== "POST") return json(405, { ok: false, error: "method not allowed" });

  // ดึง LINE User ID จาก URL query param ?uid=<<customer_id>>
  const url = new URL(req.url);
  // parse body ก่อน เพื่อดึง uid จาก body ได้ด้วย
  let payload: Record<string, unknown> = {};
  try {
    const raw = await req.text();
    if (raw.trim()) payload = JSON.parse(raw);
  } catch (e) {
    return json(400, { ok: false, error: `invalid JSON: ${String(e)}` });
  }

  // ดึง uid จาก URL query → header → body (priority ตามลำดับ)
  const lineUserId =
    url.searchParams.get("uid") ??
    url.searchParams.get("user_id") ??
    url.searchParams.get("customer_id") ??
    req.headers.get("x-line-user-id") ??
    String((payload as any).uid ?? (payload as any).customer_id ?? (payload as any).user_id ?? "") ;

  // LOG full body เพื่อ debug ว่า Botnoi ส่งอะไรมาจริงๆ
  console.log(`[line-oa-registration] inbound uid="${lineUserId}" full_body=${JSON.stringify(payload).slice(0, 500)}`);

  const hasValidUid = !!lineUserId && LINE_USER_ID_RE.test(lineUserId);
  if (!hasValidUid) {
    console.warn(`[line-oa-registration] uid missing/invalid: "${lineUserId}" — proceeding without LINE link`);
  }

  // รองรับทั้ง { business: [{...}] } และ flat object
  // deno-lint-ignore no-explicit-any
  const biz: Record<string, any> =
    Array.isArray((payload as any).business) && (payload as any).business.length > 0
      ? (payload as any).business[0]
      : payload;

  const businessName    = String(biz.business_name    ?? biz.businessName    ?? "").trim();
  const details         = String(biz.details          ?? biz.detail          ?? "").trim();
  const telephoneNumber = String(biz.telephone_number ?? biz.telephoneNumber ?? biz.phone ?? "").trim();
  const smeTagRaw       = String(biz.sme_tag          ?? biz.smeTag          ?? biz.tag   ?? "").trim();
  const customerName    = String((payload as any).customer_name ?? (payload as any).customerName ?? "").trim();

  // sme_tag จาก Botnoi อาจเป็น "#SME01 Beauty & Wellness"
  // แยก code (#SME01) กับ ชื่ออุตสาหกรรม (Beauty & Wellness) ออกจากกัน
  const smeCodeMatch = smeTagRaw.match(/^(#SME\d+)\s*(.*)$/i);
  const smeTag  = smeCodeMatch ? smeCodeMatch[1].trim() : smeTagRaw;       // "#SME01"
  const smeName = smeCodeMatch ? smeCodeMatch[2].trim() : "";               // "Beauty & Wellness"
  const smeLabel = [smeTag, smeName].filter(Boolean).join(" ");             // "#SME01 Beauty & Wellness"

  console.log(`[line-oa-registration] business_name="${businessName}" tel="${telephoneNumber}" sme="${smeLabel}"`);

  // สร้างหรือ upsert customer
  // deno-lint-ignore no-explicit-any
  let customer: { id: string; notes: string | null; tags: any };

  if (hasValidUid) {
    // มี LINE user ID → upsert ตามปกติ
    const upsertData: Record<string, unknown> = { line_user_id: lineUserId, last_message_at: new Date().toISOString() };
    if (customerName) upsertData.display_name = customerName;
    const { error: upsertErr } = await supabase
      .from("customers")
      .upsert(upsertData, { onConflict: "line_user_id" });

    if (upsertErr) {
      console.error(`[line-oa-registration] upsert customer error`, upsertErr);
      return json(500, { ok: false, error: upsertErr.message });
    }

    const { data: fetched, error: fetchErr } = await supabase
      .from("customers")
      .select("id, notes, tags")
      .eq("line_user_id", lineUserId)
      .single();

    if (fetchErr || !fetched) {
      console.error(`[line-oa-registration] customer fetch error uid="${lineUserId}"`, fetchErr);
      return json(500, { ok: false, error: `ดึงข้อมูลลูกค้าไม่สำเร็จ` });
    }
    customer = fetched;
  } else {
    // ไม่มี LINE user ID — สร้าง customer ใหม่ด้วย placeholder (เพื่อผ่าน NOT NULL)
    const placeholderUid = `BOTNOI_${crypto.randomUUID()}`;
    const displayName = customerName || businessName || telephoneNumber || null;
    const { data: inserted, error: insertErr } = await supabase
      .from("customers")
      .insert({ line_user_id: placeholderUid, display_name: displayName, last_message_at: new Date().toISOString() })
      .select("id, notes, tags")
      .single();

    if (insertErr || !inserted) {
      console.error(`[line-oa-registration] insert customer error`, insertErr);
      return json(500, { ok: false, error: `สร้างลูกค้าไม่สำเร็จ` });
    }
    customer = inserted;
  }

  // สร้าง notes ใหม่ (ต่อท้ายของเดิม ถ้ามี)
  const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const newNote = [
    `📋 ข้อมูลธุรกิจ (${now})`,
    businessName    ? `ชื่อธุรกิจ: ${businessName}`     : null,
    telephoneNumber ? `โทรศัพท์: ${telephoneNumber}`     : null,
    details         ? `รายละเอียด: ${details}`           : null,
    smeLabel        ? `ประเภท: ${smeLabel}`              : null,
  ].filter(Boolean).join("\n");

  const existingNotes = (customer.notes ?? "").trim();
  const updatedNotes = existingNotes ? `${existingNotes}\n\n${newNote}` : newNote;

  // เพิ่ม smeLabel เข้า tags (ถ้ายังไม่มี) ใช้ label เต็มเพื่อให้อ่านง่ายใน UI
  const existingTags: string[] = Array.isArray(customer.tags) ? customer.tags : [];
  const updatedTags = smeLabel && !existingTags.includes(smeLabel)
    ? [...existingTags, smeLabel]
    : existingTags;

  // update customer
  const { error: updateErr } = await supabase
    .from("customers")
    .update({ notes: updatedNotes, tags: updatedTags, last_message_at: new Date().toISOString() })
    .eq("id", customer.id);

  if (updateErr) {
    console.error(`[line-oa-registration] update customer error`, updateErr);
    return json(500, { ok: false, error: updateErr.message });
  }

  // ดึงเฉพาะ code #SMExx จาก string (ตัดข้อความหลังออก เช่น "Technology")
  const extractSmeCode = (s: string): string =>
    (s.match(/#SME\d+/i)?.[0] ?? "").toUpperCase();

  // หา team ที่มี tag ตรงกับ smeTag ของลูกค้า (เปรียบเทียบเฉพาะ #SMExx)
  let matchedTeamId: string | null = null;
  const smeCode = extractSmeCode(smeTag);
  if (smeCode) {
    const { data: teams } = await supabase
      .from("teams")
      .select("id, tags")
      .not("tags", "is", null);

    if (teams && teams.length > 0) {
      const matched = (teams as { id: string; tags: string[] }[]).find((t) =>
        Array.isArray(t.tags) && t.tags.some((tag) => extractSmeCode(tag) === smeCode)
      );
      if (matched) {
        matchedTeamId = matched.id;
        console.log(`[line-oa-registration] matched team=${matchedTeamId} for sme="${smeCode}"`);
      } else {
        console.log(`[line-oa-registration] no team matched for sme="${smeCode}"`);
      }
    }
  }

  // สร้าง task (format ตรงกับ renderDescription ใน TasksTab — ขึ้นต้นด้วย "ลูกค้า:")
  const taskTitle = businessName ? `[LINE OA] ${businessName}` : `[LINE OA] ลูกค้าใหม่`;
  const taskDesc = [
    `ชื่อธุรกิจ: ${businessName || "ไม่ระบุ"}`,
    telephoneNumber ? `โทรศัพท์: ${telephoneNumber}` : null,
    smeLabel        ? `ประเภท SME: ${smeLabel}`      : null,
    details         ? `รายละเอียด: ${details}`       : null,
  ].filter(Boolean).join("\n");

  const { error: taskErr } = await supabase.from("tasks").insert({
    customer_id: customer.id,
    title: taskTitle,
    description: taskDesc,
    status: "open",
    team_id: matchedTeamId,
  });

  if (taskErr) {
    console.warn(`[line-oa-registration] create task warning`, taskErr);
  }

  console.log(`[line-oa-registration] done — customer=${customer.id} task_created=${!taskErr} team_id=${matchedTeamId}`);

  return json(200, {
    ok: true,
    customer_id: customer.id,
    task_created: !taskErr,
    business_name: businessName,
    line_linked: hasValidUid,
  });
});
