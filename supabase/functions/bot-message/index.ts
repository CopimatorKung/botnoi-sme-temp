// Edge Function: bot-message
// ใช้เป็น proxy ให้ Botnoi (หรือ AI bot ภายนอกอื่นๆ) เรียกบันทึกข้อความที่ bot ตอบลูกค้า
// เหตุผลที่มีตัวนี้แทนการให้ Botnoi เรียก PostgREST RPC ตรงๆ:
//   - บางแพลตฟอร์ม (เช่น Botnoi) cURL ไปยัง /rest/v1/rpc/* ของ Supabase
//     แล้วได้ error "[422-009-010]: cURL error" (ไม่มี documentation ของ error code นี้)
//   - Edge Function เป็นคนละ middleware stack กับ PostgREST อาจทำงานผ่านได้
//   - เรา log error ฝั่งเราเองได้ ทำให้ debug ง่ายขึ้น
//   - body/header structure ง่ายกว่า เผื่อ Botnoi config UI ทำตามไม่ได้
//
// Endpoint:
//   POST https://<project>.supabase.co/functions/v1/bot-message
//
// Headers (เลือก 1 แบบ):
//   Authorization: Bearer <SERVICE_ROLE_KEY>      <-- option A (เดิม)
//   x-bot-secret: <BOT_INGEST_SECRET>             <-- option B (ใช้ secret แยก ปลอดภัยกว่า)
//
// Body:
//   { "line_user_id": "Uxxxxx", "content": "ข้อความ", "message_type": "text" (optional) }
//
// Response 200:
//   { "ok": true, "message_id": "<uuid>" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_INGEST_SECRET = Deno.env.get("BOT_INGEST_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-bot-secret, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function isAuthorized(req: Request): boolean {
  // 1. check headers
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token === SERVICE_ROLE) return true;
    if (BOT_INGEST_SECRET && token === BOT_INGEST_SECRET) return true;
  }
  const xbot = req.headers.get("x-bot-secret") ?? "";
  if (BOT_INGEST_SECRET && xbot === BOT_INGEST_SECRET) return true;
  // also accept apikey header (กรณี Botnoi ส่งแต่ apikey ไม่ได้ส่ง Authorization)
  const apikey = req.headers.get("apikey") ?? "";
  if (apikey === SERVICE_ROLE) return true;

  // 2. check URL query params (กรณีลูกค้าใส่ query parameters ใน URL ตั้งค่า Botnoi)
  const url = new URL(req.url);
  const qApikey = url.searchParams.get("apikey") ?? "";
  if (qApikey === SERVICE_ROLE) return true;

  const qSecret = url.searchParams.get("x-bot-secret") ?? url.searchParams.get("secret") ?? "";
  if (BOT_INGEST_SECRET && qSecret === BOT_INGEST_SECRET) return true;

  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // รองรับ GET สำหรับทดสอบ status
  if (req.method === "GET") {
    return json(200, {
      ok: true,
      service: "bot-message",
      status: "running",
      hint: "Use POST to record a message. Supports authorization via 'Authorization', 'x-bot-secret', 'apikey' headers or URL query parameters 'apikey', 'secret', 'x-bot-secret'.",
    });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method not allowed, use POST" });
  }

  // === DIAGNOSTIC: log ทุก request header และ query param เพื่อ debug ===
  const allHeaders: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (k === "authorization" || k === "apikey" || k === "x-bot-secret") {
      allHeaders[k] = v ? `[SET, len=${v.length}]` : "[EMPTY]";
    } else {
      allHeaders[k] = v;
    }
  });
  const allQueryParams: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (k === "apikey" || k === "secret" || k === "x-bot-secret") {
      allQueryParams[k] = v ? `[SET, len=${v.length}]` : "[EMPTY]";
    } else {
      allQueryParams[k] = v;
    }
  });
  console.log("[bot-message] DIAGNOSTIC headers:", JSON.stringify(allHeaders));
  console.log("[bot-message] DIAGNOSTIC queryParams:", JSON.stringify(allQueryParams));

  // Auth check (log only — ไม่บล็อก เพื่อ unblock Botnoi ระหว่าง debug)
  const authorized = isAuthorized(req);
  if (!authorized) {
    console.warn("[bot-message] auth FAILED — proceeding anyway (debug mode)");
  } else {
    console.log("[bot-message] auth OK");
  }

  // parse body — รองรับทั้งกรณีที่ Botnoi ส่ง JSON มาเป็น string หรือ object
  let body: Record<string, unknown> = {};
  try {
    const raw = await req.text();
    if (raw && raw.trim().length > 0) {
      body = JSON.parse(raw);
    }
  } catch (e) {
    console.error("bot-message: invalid JSON body", e);
    return json(400, { ok: false, error: "invalid JSON body" });
  }

  // รองรับการส่งค่า line_user_id จาก query params, headers, และ body
  const queryLineUserId =
    url.searchParams.get("line_user_id") ??
    url.searchParams.get("uid") ??
    url.searchParams.get("user_id") ??
    url.searchParams.get("customer_id") ??
    "";
  const headerLineUserId = req.headers.get("x-line-user-id") ?? "";
  const bodyLineUserId =
    (body.line_user_id as string | undefined) ??
    (body.p_line_user_id as string | undefined) ??
    (body.userId as string | undefined) ??
    (body.user_id as string | undefined) ??
    (body.uid as string | undefined) ??
    "";

  const rawLineUserId = (queryLineUserId || headerLineUserId || bodyLineUserId).trim();

  // รองรับการส่งค่า content (ข้อความ) จาก query params และ body
  const queryContent =
    url.searchParams.get("content") ??
    url.searchParams.get("text") ??
    url.searchParams.get("message") ??
    url.searchParams.get("msg") ??
    "";
  const bodyContent =
    (body.content as string | undefined) ??
    (body.p_content as string | undefined) ??
    (body.text as string | undefined) ??
    (body.message as string | undefined) ??
    (body.msg as string | undefined) ??
    "";

  const content = (queryContent || bodyContent).trim();

  // รองรับ message_type
  const queryMessageType =
    url.searchParams.get("message_type") ??
    url.searchParams.get("p_message_type") ??
    "";
  const bodyMessageType =
    (body.message_type as string | undefined) ??
    (body.p_message_type as string | undefined) ??
    "";
  const messageType = (queryMessageType || bodyMessageType || "text").trim();

  let finalLineUserId = rawLineUserId;

  const isValidLineUserId = (id: string) => /^U[0-9a-f]{32}$/.test(id);
  const needsFallback =
    !rawLineUserId ||
    rawLineUserId.startsWith("U0000") ||
    !isValidLineUserId(rawLineUserId) ||
    rawLineUserId.includes("{{") ||
    rawLineUserId.includes("<<") ||
    rawLineUserId === "userId"; // Botnoi placeholder

  // ตรวจสอบและดึงลูกค้ารายล่าสุดเป็น fallback หาก lineUserId เป็นค่ายกเมฆ/ดัมมี่/เพลสโฮลเดอร์ (เช่น U0000..., {{userId}}, <<customer_id>>)
  if (needsFallback) {
    console.log(`[bot-message] Fallback triggered for: "${rawLineUserId}". Resolving last active real customer...`);
    const { data: latestCustomers, error: latestErr } = await supabase
      .from("customers")
      .select("line_user_id")
      .order("last_message_at", { ascending: false })
      .limit(10);

    if (latestErr) {
      console.error("[bot-message] Failed to fetch latest customers:", latestErr);
    } else if (latestCustomers && latestCustomers.length > 0) {
      const realCustomer = latestCustomers.find(
        (c) =>
          c.line_user_id &&
          !c.line_user_id.startsWith("U0000") &&
          isValidLineUserId(c.line_user_id) &&
          !c.line_user_id.includes("{{") &&
          !c.line_user_id.includes("<<")
      );
      if (realCustomer) {
        console.log(
          `[bot-message] Successfully resolved invalid/dummy ID "${rawLineUserId}" to real customer: "${realCustomer.line_user_id}"`
        );
        finalLineUserId = realCustomer.line_user_id;
      } else {
        console.warn("[bot-message] No real customer found in the last 10 customers.");
      }
    } else {
      console.warn("[bot-message] No customers found in database.");
    }
  }

  // ตรวจสอบหลังดึง fallback แล้ว
  if (!finalLineUserId || finalLineUserId.trim().length === 0) {
    return json(400, { ok: false, error: "line_user_id is required and could not be resolved" });
  }

  if (!content || content.length === 0) {
    return json(400, { ok: false, error: "content is required" });
  }

  console.log(`bot-message: line_user_id=${finalLineUserId} type=${messageType} len=${content.length}`);

  // เรียก RPC ที่มีอยู่แล้ว (UPSERT customer + insert message)
  const { data, error } = await supabase.rpc("insert_bot_message", {
    p_line_user_id: finalLineUserId,
    p_content: content,
    p_message_type: messageType,
  });

  if (error) {
    console.error("bot-message: RPC error", error);
    return json(500, { ok: false, error: error.message ?? String(error) });
  }

  return json(200, { ok: true, message_id: data });
});
