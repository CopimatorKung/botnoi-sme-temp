// Edge Function: botnoi-reply (v2 — multi-message)
// รับคำตอบจาก Botnoi Custom Channel "Transmit Endpoint"
//
// Botnoi ส่ง payload หลาย messages พร้อมกัน (text, carousel, image, etc.)
// → loop save DB แยก row + ส่ง LINE แยก message (batch 5 ตาม LINE limit)
//
// Payload format จริงที่ Botnoi ส่ง:
// {
//   "bot_id": "...",
//   "source": { "source_id": "U...", "source_type": "user" },
//   "intent": "TN_xxx",
//   "messages": [
//     { "type": "text", "text": "..." },
//     {
//       "type": "carousel",
//       "carousel_cards": [{
//         "image_url": "...", "title": "...", "subtitle": "...",
//         "buttons": [{"type":"phone","label":"...","data":"..."}]
//       }]
//     },
//     { "type": "image", "url": "..." }
//   ],
//   "is_last_batch": true
// }
//
// Setup: Custom Channel → Transmit Endpoint = https://<project>.supabase.co/functions/v1/botnoi-reply

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOTNOI_SIGNING_SECRET = Deno.env.get("BOTNOI_SIGNING_SECRET") ?? "";
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";

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

function verifyBotnoiSignature(body: string, signatureHeader: string | null): boolean {
  if (!BOTNOI_SIGNING_SECRET) return true;
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", BOTNOI_SIGNING_SECRET).update(body).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  return expected.toLowerCase() === provided.toLowerCase();
}

// deno-lint-ignore no-explicit-any
function pick<T = unknown>(obj: Record<string, any>, ...paths: string[]): T | undefined {
  for (const path of paths) {
    const keys = path.split(".");
    // deno-lint-ignore no-explicit-any
    let cur: any = obj;
    for (const k of keys) {
      if (cur && typeof cur === "object" && k in cur) {
        cur = cur[k];
      } else {
        cur = undefined;
        break;
      }
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return undefined;
}

// แปลง Botnoi button → LINE action
// deno-lint-ignore no-explicit-any
function btnToLineAction(b: any): any {
  const label = String(b.label || b.text || "ดูเพิ่ม").substring(0, 20) || "ดูเพิ่ม";
  const btnType = String(b.type || "").toLowerCase();
  switch (btnType) {
    case "phone":
    case "tel": {
      const tel = String(b.data || b.label || "").replace(/[^\d+]/g, "");
      return { type: "uri", label, uri: `tel:${tel}` };
    }
    case "uri":
    case "url":
    case "link":
      return { type: "uri", label, uri: String(b.data || b.uri || b.url || "") };
    case "message":
    case "text":
      return { type: "message", label, text: String(b.data || b.label || label).substring(0, 300) };
    case "postback":
      return { type: "postback", label, data: String(b.data || label).substring(0, 300) };
    default:
      return { type: "message", label, text: String(b.data || label).substring(0, 300) };
  }
}

// แปลง Botnoi single message → LINE message object (หรือ null ถ้าไม่รองรับ)
// + summary string สำหรับเก็บ DB
// deno-lint-ignore no-explicit-any
function botnoiToLine(m: any): { line: any | null; summary: string; type: string } {
  if (!m || typeof m !== "object") return { line: null, summary: "", type: "unknown" };
  const t = String(m.type || "").toLowerCase();

  // === text ===
  if (t === "text") {
    const text = String(m.text || "").trim();
    if (!text) return { line: null, summary: "", type: "text" };
    return {
      line: { type: "text", text: text.substring(0, 5000) },
      summary: text,
      type: "text",
    };
  }

  // === image ===
  if (t === "image") {
    const url = m.url || m.image_url || m.original_content_url || m.originalContentUrl
      || m.previewImageUrl || m.preview_image_url || m.src || m.imageUrl;
    if (!url) return { line: null, summary: "[image - no url]", type: "image" };
    return {
      line: {
        type: "image",
        originalContentUrl: String(url),
        previewImageUrl: String(m.preview_url || m.preview_image_url || m.previewImageUrl || url),
      },
      summary: `[รูปภาพ] ${url}`,
      type: "image",
    };
  }

  // === sticker ===
  if (t === "sticker") {
    return {
      line: {
        type: "sticker",
        packageId: String(m.package_id || m.packageId || "446"),
        stickerId: String(m.sticker_id || m.stickerId || "1988"),
      },
      summary: "[สติกเกอร์]",
      type: "sticker",
    };
  }

  // === carousel → LINE template carousel ===
  if (t === "carousel") {
    // deno-lint-ignore no-explicit-any
    const cards = (m.carousel_cards || m.cards || []) as any[];
    if (cards.length === 0) return { line: null, summary: "[carousel ว่าง]", type: "carousel" };

    const columns = cards.slice(0, 10).map((c) => {
      const rawTitle = String(c.title || "").trim();
      const rawText = String(c.subtitle || c.description || c.text || "").trim();
      const title = rawTitle.substring(0, 40) || undefined;
      // LINE: title+image → text max 60; ถ้าไม่มี title → max 120
      const text = (rawText || rawTitle || " ").substring(0, title ? 60 : 120) || " ";
      // deno-lint-ignore no-explicit-any
      const rawBtns = (c.buttons || c.actions || []) as any[];
      const actions = rawBtns.slice(0, 3).map(btnToLineAction);
      // LINE require >= 1 action per column
      if (actions.length === 0) {
        actions.push({ type: "message", label: "ดูเพิ่ม", text: rawTitle || "ดูเพิ่ม" });
      }
      // deno-lint-ignore no-explicit-any
      const col: any = { text, actions };
      if (title) col.title = title;
      if (c.image_url || c.thumbnail_url) col.thumbnailImageUrl = String(c.image_url || c.thumbnail_url);
      return col;
    });

    const firstTitle = cards[0]?.title || "Carousel";
    const altText = String(firstTitle).substring(0, 400);
    const summary = `[การ์ด] ${cards.map((c) => c.title || "").filter(Boolean).join(" | ")}`.substring(0, 300);

    return {
      line: {
        type: "template",
        altText,
        template: { type: "carousel", columns },
      },
      summary,
      type: "carousel",
    };
  }

  // === video ===
  if (t === "video") {
    const url = m.url || m.video_url || m.original_content_url;
    const preview = m.preview_url || m.preview_image_url;
    if (!url || !preview) {
      return { line: null, summary: `[วิดีโอ - missing url/preview]`, type: "video" };
    }
    return {
      line: { type: "video", originalContentUrl: String(url), previewImageUrl: String(preview) },
      summary: `[วิดีโอ] ${url}`,
      type: "video",
    };
  }

  // === buttons (single card with action buttons) ===
  // Botnoi uses: button_title, button_actions (not title/buttons)
  if (t === "buttons") {
    const title = String(m.button_title || m.title || "").trim().substring(0, 40);
    const text = String(m.text || m.description || m.subtitle || " ").trim();
    const imgUrl = m.thumbnail_image_url || m.thumbnailImageUrl || m.image_url || m.url;
    // deno-lint-ignore no-explicit-any
    const rawBtns = (m.button_actions || m.buttons || m.actions || []) as any[];
    const actions = rawBtns.slice(0, 4).map(btnToLineAction);
    if (actions.length === 0) {
      actions.push({ type: "message", label: "ดูเพิ่ม", text: title || text || "ดูเพิ่ม" });
    }
    const colText = (text || title || " ").substring(0, title ? 60 : 160) || " ";
    // deno-lint-ignore no-explicit-any
    const col: any = { text: colText, actions };
    if (title) col.title = title;
    if (imgUrl) col.thumbnailImageUrl = String(imgUrl);
    const summary = `[ปุ่ม] ${title || text}`.substring(0, 300);
    return {
      line: {
        type: "template",
        altText: (title || text || "Buttons").substring(0, 400),
        template: { type: "buttons", ...col },
      },
      summary,
      type: "buttons",
    };
  }

  // === flex (pass-through to LINE) ===
  // Botnoi uses: flex_contents (not contents)
  if (t === "flex") {
    const altText = String(
      m.alt_text || m.altText || m.button_title || m.alternative_text || m.title || "Flex Message"
    ).substring(0, 400);
    const flexContents = m.flex_contents || m.contents;
    if (flexContents) {
      return {
        line: { type: "flex", altText, contents: flexContents },
        summary: `[Flex] ${altText}`.substring(0, 300),
        type: "flex",
      };
    }
    // ไม่มี contents → log แต่ยัง save summary
    console.warn(`[botnoi-reply] flex message missing contents`);
    return { line: null, summary: `[Flex] ${altText}`.substring(0, 300), type: "flex" };
  }

  // unknown type
  console.warn(`[botnoi-reply] unknown message type: ${t}`);
  return { line: null, summary: `[ไม่รองรับ: ${t}]`, type: t || "unknown" };
}

// deno-lint-ignore no-explicit-any
async function pushBatch(userId: string, lineMessages: any[]): Promise<{ ok: boolean; error?: string }> {
  if (lineMessages.length === 0) return { ok: true };
  if (!LINE_CHANNEL_ACCESS_TOKEN) return { ok: false, error: "LINE_CHANNEL_ACCESS_TOKEN not set" };
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: userId, messages: lineMessages }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `LINE push ${res.status}: ${errText}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return json(200, {
      ok: true,
      service: "botnoi-reply",
      version: "v2-multi-message",
      status: "running",
      supports: ["text", "image", "carousel", "sticker", "video"],
      env_check: {
        BOTNOI_SIGNING_SECRET: BOTNOI_SIGNING_SECRET ? "SET" : "MISSING",
        LINE_CHANNEL_ACCESS_TOKEN: LINE_CHANNEL_ACCESS_TOKEN ? "SET" : "MISSING",
      },
    });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method not allowed" });
  }

  // อ่าน raw body (จำเป็นต่อ HMAC verify)
  const raw = await req.text();
  const sigHeader = req.headers.get("x-platform-signature");

  // === DIAGNOSTIC ===
  console.log("[botnoi-reply] DIAGNOSTIC raw body:", raw.slice(0, 3000));

  // HMAC verify — log only (debug mode)
  const valid = verifyBotnoiSignature(raw, sigHeader);
  if (!valid) {
    console.warn("[botnoi-reply] HMAC verification FAILED — proceeding anyway (debug mode)");
  } else {
    console.log("[botnoi-reply] HMAC OK");
  }

  // parse JSON
  // deno-lint-ignore no-explicit-any
  let payload: Record<string, any> = {};
  try {
    if (raw && raw.trim().length > 0) payload = JSON.parse(raw);
  } catch (e) {
    console.error("[botnoi-reply] invalid JSON:", e);
    return json(400, { ok: false, error: "invalid JSON body" });
  }

  // extract userId
  const userId =
    pick<string>(payload, "recipient.uid") ??
    pick<string>(payload, "source.source_id") ??
    pick<string>(payload, "source.uid") ??
    pick<string>(payload, "sender.uid") ??
    pick<string>(payload, "user.uid") ??
    pick<string>(payload, "user_id") ??
    pick<string>(payload, "uid") ??
    pick<string>(payload, "to") ??
    "";

  if (!userId) {
    console.error("[botnoi-reply] no userId extractable from payload");
    return json(400, { ok: false, error: "no userId", payload_keys: Object.keys(payload) });
  }

  // get messages array
  // deno-lint-ignore no-explicit-any
  let messages: any[] = [];
  if (Array.isArray(payload.messages)) {
    messages = payload.messages;
  } else if (payload.message && typeof payload.message === "object") {
    messages = [payload.message];
  }

  if (messages.length === 0) {
    console.error("[botnoi-reply] no messages array in payload");
    return json(400, { ok: false, error: "no messages", payload_keys: Object.keys(payload) });
  }

  console.log(`[botnoi-reply] processing ${messages.length} messages for userId=${userId}`);

  // ใช้ base timestamp + offset ต่อ message เพื่อให้ received_at ต่างกัน
  // ลำดับตาม Botnoi payload (carousel มาก่อน text) = ตรงกับที่ LINE แสดง
  const baseTime = Date.now();
  const MS_OFFSET = 50; // 50ms per message

  // deno-lint-ignore no-explicit-any
  const lineMessages: any[] = [];
  // deno-lint-ignore no-explicit-any
  const dbSaves: Promise<any>[] = [];

  for (let idx = 0; idx < messages.length; idx++) {
    const m = messages[idx];
    const converted = botnoiToLine(m);
    const receivedAt = new Date(baseTime + idx * MS_OFFSET).toISOString();

    // save DB (each message as separate row, with sequential received_at)
    if (converted.summary) {
      dbSaves.push(
        supabase
          .rpc("insert_bot_message", {
            p_line_user_id: userId,
            p_content: converted.summary,
            p_message_type: converted.type,
            p_raw_event: m,
            p_received_at: receivedAt,
          })
          // deno-lint-ignore no-explicit-any
          .then(({ data, error }: any) => {
            if (error) console.error(`[botnoi-reply] DB save error (${converted.type}):`, error);
            else console.log(`[botnoi-reply] DB saved (${converted.type}) id=${data}`);
          }),
      );
    }

    if (converted.line) {
      lineMessages.push(converted.line);
    }
  }

  // wait for all DB saves to complete (parallel)
  await Promise.all(dbSaves);

  // push to LINE in batches of 5 (LINE limit per push request)
  const pushErrors: string[] = [];
  for (let i = 0; i < lineMessages.length; i += 5) {
    const batch = lineMessages.slice(i, i + 5);
    const res = await pushBatch(userId, batch);
    if (!res.ok && res.error) {
      pushErrors.push(res.error);
      console.error(`[botnoi-reply] LINE push batch ${Math.floor(i / 5) + 1} failed:`, res.error);
    }
  }

  if (pushErrors.length === 0 && lineMessages.length > 0) {
    console.log(`[botnoi-reply] LINE push ok (${lineMessages.length} messages in ${Math.ceil(lineMessages.length / 5)} batches)`);
  }

  return json(200, {
    ok: pushErrors.length === 0,
    messages_processed: messages.length,
    line_messages_sent: lineMessages.length,
    push_errors: pushErrors,
  });
});
