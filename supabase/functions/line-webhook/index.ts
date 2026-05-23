// LINE Messaging API webhook receiver
// Public endpoint - LINE servers will call this
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")!;
const CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Botnoi Custom Channel — ใช้ Botnoi เป็น AI brain ผ่าน proxy
const BOTNOI_BOT_ID = Deno.env.get("BOTNOI_BOT_ID") ?? "";
const BOTNOI_SIGNING_SECRET = Deno.env.get("BOTNOI_SIGNING_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function verifySignature(body: string, signature: string | null): boolean {
  if (!CHANNEL_SECRET) return true; // skip when not configured
  if (!signature) return false;
  const hmac = createHmac("sha256", CHANNEL_SECRET).update(body).digest("base64");
  return hmac === signature;
}

// ส่งข้อความลูกค้าไป Botnoi Custom Channel (fire-and-forget)
// Botnoi จะตอบกลับมาที่ Transmit Endpoint (botnoi-reply function) แยก
async function forwardToBotnoi(
  userId: string,
  displayName: string | undefined,
  pictureUrl: string | undefined,
  text: string,
  lineMessageId: string | undefined,
) {
  if (!BOTNOI_BOT_ID || !BOTNOI_SIGNING_SECRET) {
    console.warn("[line-webhook] forwardToBotnoi: missing BOTNOI_BOT_ID or BOTNOI_SIGNING_SECRET — skip");
    return;
  }

  const url = `https://api-gateway.botnoi.ai/webhook/custom/${BOTNOI_BOT_ID}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const body = JSON.stringify({
    bot_id: BOTNOI_BOT_ID,
    source: {
      source_id: userId,
      source_type: "user",
    },
    sender: {
      uid: userId,
      display_name: displayName || "LINE User",
      profile_img_url: pictureUrl || "",
    },
    message: {
      mid: lineMessageId || `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "text",
      text,
      timestamp: Number(timestamp) * 1000,
    },
  });

  const signature = "sha256=" + createHmac("sha256", BOTNOI_SIGNING_SECRET).update(body).digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Platform-Signature": signature,
        "X-Platform-Timestamp": timestamp,
      },
      body,
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[line-webhook] forwardToBotnoi failed status=${res.status} body=${errText.slice(0, 500)}`);
    } else {
      console.log(`[line-webhook] forwardToBotnoi ok userId=${userId} text_len=${text.length}`);
    }
  } catch (e) {
    console.error("[line-webhook] forwardToBotnoi exception:", e);
  }
}

async function fetchLineProfile(userId: string) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);

  // Send push message from dashboard
  if (req.method === "POST" && url.pathname.endsWith("/send")) {
    try {
      const { to, text } = await req.json();
      if (!to || !text) {
        return new Response(JSON.stringify({ error: "Missing 'to' or 'text'" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      console.log(`Sending message to ${to}: ${text}`);
      const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to,
          messages: [{ type: "text", text }],
        }),
      });

      if (!lineRes.ok) {
        const errText = await lineRes.text();
        console.error("LINE push API error:", errText);
        return new Response(JSON.stringify({ error: errText }), {
          status: lineRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error("Send message error:", e);
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // Webhook receiver from LINE servers
  try {
    const raw = await req.text();
    const signature = req.headers.get("x-line-signature");
    if (!verifySignature(raw, signature)) {
      console.warn("Invalid LINE signature");
      return new Response("invalid signature", { status: 401, headers: corsHeaders });
    }

    const payload = JSON.parse(raw);
    const events = payload.events ?? [];

    for (const ev of events) {
      const userId = ev.source?.userId;
      if (!userId) continue;

      // upsert customer with profile info
      let displayName: string | undefined;
      let pictureUrl: string | undefined;
      let statusMessage: string | undefined;
      const profile = await fetchLineProfile(userId);
      if (profile) {
        displayName = profile.displayName;
        pictureUrl = profile.pictureUrl;
        statusMessage = profile.statusMessage;
      }

      const { data: customer, error: upsertErr } = await supabase
        .from("customers")
        .upsert(
          {
            line_user_id: userId,
            display_name: displayName,
            picture_url: pictureUrl,
            status_message: statusMessage,
            last_message_at: new Date().toISOString(),
          },
          { onConflict: "line_user_id" }
        )
        .select()
        .single();

      if (upsertErr) {
        console.error("Upsert customer error", upsertErr);
        continue;
      }

      if (ev.type === "message") {
        const msg = ev.message ?? {};
        await supabase.from("messages").insert({
          customer_id: customer.id,
          line_message_id: msg.id,
          message_type: msg.type ?? "unknown",
          content: msg.text ?? null,
          raw_event: ev,
          source: "line"
        });

        // ส่ง text message ต่อไป Botnoi Custom Channel (fire-and-forget — ไม่รอ response)
        // Botnoi จะตอบกลับมาที่ botnoi-reply function แยก
        if (msg.type === "text" && typeof msg.text === "string" && msg.text.trim().length > 0) {
          // ใช้ EdgeRuntime.waitUntil ถ้ามี ไม่งั้นยิงแล้วปล่อย Promise ทิ้ง
          const fwd = forwardToBotnoi(userId, displayName, pictureUrl, msg.text, msg.id);
          // deno-lint-ignore no-explicit-any
          const er = (globalThis as any).EdgeRuntime;
          if (er && typeof er.waitUntil === "function") {
            er.waitUntil(fwd);
          } else {
            fwd.catch((e) => console.error("[line-webhook] background forward error:", e));
          }
        }
      } else {
        // store other events (follow, unfollow, postback, etc.) as system messages
        await supabase.from("messages").insert({
          customer_id: customer.id,
          message_type: `event:${ev.type}`,
          content: null,
          raw_event: ev,
          source: "line"
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
