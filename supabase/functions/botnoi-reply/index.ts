// Edge Function: botnoi-reply
// รับคำตอบจาก Botnoi Custom Channel "Transmit Endpoint"
//
// Flow:
//   Botnoi → POST นี้ (พร้อม HMAC-SHA256 header) → เรา verify → save DB → push LINE
//
// Endpoint:
//   POST https://<project>.supabase.co/functions/v1/botnoi-reply
//
// Headers (จาก Botnoi):
//   X-Platform-Signature: sha256=<hex_hash>
//   X-Platform-Timestamp: <unix seconds>
//   Content-Type: application/json
//
// Expected payload (format ของ Botnoi — ยังต้องยืนยันจากการทดสอบจริง):
//   {
//     "bot_id": "...",
//     "recipient" หรือ "sender" หรือ "source": { "uid": "Uxxxx..." },
//     "message": { "type": "text", "text": "..." }
//   }
//   — code อ่านจากหลาย field name เพื่อความ robust
//
// Setup ใน Botnoi:
//   Custom Channel → Transmit Endpoint = https://<project>.supabase.co/functions/v1/botnoi-reply

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
  if (!BOTNOI_SIGNING_SECRET) {
    console.warn("[botnoi-reply] BOTNOI_SIGNING_SECRET not set — skipping verification");
    return true;
  }
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", BOTNOI_SIGNING_SECRET).update(body).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  return expected.toLowerCase() === provided.toLowerCase();
}

async function pushToLine(userId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    return { ok: false, error: "LINE_CHANNEL_ACCESS_TOKEN not set" };
  }
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text }],
      }),
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

// helper: extract first non-empty string จากหลาย possible path ของ JSON
function pick<T = unknown>(obj: Record<string, unknown>, ...paths: string[]): T | undefined {
  for (const path of paths) {
    const keys = path.split(".");
    let cur: unknown = obj;
    for (const k of keys) {
      if (cur && typeof cur === "object" && k in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[k];
      } else {
        cur = undefined;
        break;
      }
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return undefined;
}

// แตก text จาก message structure ที่อาจเป็น string ตรงๆ หรือ array ของ blocks
function extractText(messageObj: unknown): string {
  if (!messageObj) return "";
  if (typeof messageObj === "string") return messageObj;
  if (Array.isArray(messageObj)) {
    return messageObj
      .map((m) => extractText(m))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof messageObj === "object") {
    const obj = messageObj as Record<string, unknown>;
    // common fields: text, content, value, body
    const direct = obj.text ?? obj.content ?? obj.value ?? obj.body;
    if (typeof direct === "string" && direct.length > 0) return direct;
    // sometimes nested under .message
    if (obj.message) return extractText(obj.message);
    // sometimes an array under .messages
    if (Array.isArray(obj.messages)) return extractText(obj.messages);
    if (Array.isArray(obj.replies)) return extractText(obj.replies);
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return json(200, {
      ok: true,
      service: "botnoi-reply",
      status: "running",
      hint: "POST endpoint for Botnoi Custom Channel 'Transmit Endpoint'. Verifies X-Platform-Signature (HMAC-SHA256), saves bot reply to DB, and pushes to LINE.",
      env_check: {
        BOTNOI_SIGNING_SECRET: BOTNOI_SIGNING_SECRET ? "SET" : "MISSING",
        LINE_CHANNEL_ACCESS_TOKEN: LINE_CHANNEL_ACCESS_TOKEN ? "SET" : "MISSING",
      },
    });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method not allowed" });
  }

  // อ่าน body raw (จำเป็นต่อ HMAC verify — ห้าม parse ก่อน)
  const raw = await req.text();
  const sigHeader = req.headers.get("x-platform-signature");
  const tsHeader = req.headers.get("x-platform-timestamp");

  // === DIAGNOSTIC: log ทุก request เพื่อเห็น payload จริงที่ Botnoi ส่งมา ===
  const allHeaders: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (k === "x-platform-signature" || k === "authorization") {
      allHeaders[k] = v ? `[SET, len=${v.length}]` : "[EMPTY]";
    } else {
      allHeaders[k] = v;
    }
  });
  console.log("[botnoi-reply] DIAGNOSTIC headers:", JSON.stringify(allHeaders));
  console.log("[botnoi-reply] DIAGNOSTIC raw body:", raw.slice(0, 2000));
  console.log("[botnoi-reply] DIAGNOSTIC timestamp:", tsHeader);

  // verify HMAC — log only, ไม่บล็อก (debug mode ระหว่าง integration ครั้งแรก)
  const valid = verifyBotnoiSignature(raw, sigHeader);
  if (!valid) {
    console.warn("[botnoi-reply] HMAC verification FAILED — proceeding anyway (debug mode)");
  } else {
    console.log("[botnoi-reply] HMAC OK");
  }

  // parse JSON
  let payload: Record<string, unknown> = {};
  try {
    if (raw && raw.trim().length > 0) payload = JSON.parse(raw);
  } catch (e) {
    console.error("[botnoi-reply] invalid JSON:", e);
    return json(400, { ok: false, error: "invalid JSON body" });
  }

  // === extract userId — ลอง field หลายชื่อ เพราะยังไม่รู้ format ของ Botnoi ===
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

  // === extract text — ลอง field หลายชื่อ ===
  let text =
    pick<string>(payload, "message.text") ??
    pick<string>(payload, "messages.0.text") ??
    pick<string>(payload, "reply.text") ??
    pick<string>(payload, "text") ??
    pick<string>(payload, "content") ??
    "";

  // ถ้ายังไม่ได้ ให้ใช้ extractText แบบ recursive
  if (!text) text = extractText(payload.message ?? payload.messages ?? payload.reply ?? payload);

  console.log(`[botnoi-reply] extracted userId="${userId}" text_len=${text.length}`);

  if (!userId) {
    console.error("[botnoi-reply] no userId extractable from payload");
    return json(400, {
      ok: false,
      error: "could not extract user id from payload",
      payload_keys: Object.keys(payload),
    });
  }
  if (!text || text.trim().length === 0) {
    console.error("[botnoi-reply] no text extractable from payload");
    return json(400, {
      ok: false,
      error: "could not extract message text from payload",
      payload_keys: Object.keys(payload),
    });
  }

  // === save ลง DB ผ่าน RPC ที่เคยใช้แล้ว ===
  const { data: msgId, error: rpcErr } = await supabase.rpc("insert_bot_message", {
    p_line_user_id: userId,
    p_content: text,
    p_message_type: "text",
  });

  if (rpcErr) {
    console.error("[botnoi-reply] insert_bot_message RPC error:", rpcErr);
  } else {
    console.log(`[botnoi-reply] saved DB message_id=${msgId}`);
  }

  // === push กลับไป LINE ===
  const pushRes = await pushToLine(userId, text);
  if (!pushRes.ok) {
    console.error("[botnoi-reply] LINE push failed:", pushRes.error);
  } else {
    console.log("[botnoi-reply] LINE push ok");
  }

  return json(200, {
    ok: true,
    db_saved: !rpcErr,
    line_pushed: pushRes.ok,
    line_error: pushRes.error,
    message_id: msgId ?? null,
  });
});
