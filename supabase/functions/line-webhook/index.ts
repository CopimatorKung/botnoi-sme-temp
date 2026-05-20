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

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function verifySignature(body: string, signature: string | null): boolean {
  if (!CHANNEL_SECRET) return true; // skip when not configured
  if (!signature) return false;
  const hmac = createHmac("sha256", CHANNEL_SECRET).update(body).digest("base64");
  return hmac === signature;
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

  // health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "line-webhook" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
        });
      } else {
        // store other events (follow, unfollow, postback, etc.) as system messages
        await supabase.from("messages").insert({
          customer_id: customer.id,
          message_type: `event:${ev.type}`,
          content: null,
          raw_event: ev,
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
