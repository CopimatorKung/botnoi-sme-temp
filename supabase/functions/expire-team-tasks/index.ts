// Edge Function: expire-team-tasks
// ล้าง team_id ของ task ที่อยู่ใน queue ของทีมนานเกิน 3 ชั่วโมงโดยไม่มีใครรับ
// → งานวิ่งไปที่ "ทั้งหมด" ให้ทุกคนรับได้
//
// เรียกด้วย cron หรือ POST ตรงก็ได้:
//   POST https://<project>.supabase.co/functions/v1/expire-team-tasks
//   Header: Authorization: Bearer <service_role_key>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  // หา task ที่ยังไม่มีใครรับ, มี team_id, สร้างมาเกิน 3 ชม.
  const { data: expiredTasks, error: fetchErr } = await supabase
    .from("tasks")
    .select("id, title, team_id")
    .eq("status", "open")
    .is("assigned_to", null)
    .not("team_id", "is", null)
    .lt("created_at", threeHoursAgo);

  if (fetchErr) {
    console.error("[expire-team-tasks] fetch error", fetchErr);
    return new Response(JSON.stringify({ ok: false, error: fetchErr.message }), { status: 500, headers: corsHeaders });
  }

  if (!expiredTasks || expiredTasks.length === 0) {
    console.log("[expire-team-tasks] no expired tasks");
    return new Response(JSON.stringify({ ok: true, expired: 0 }), { headers: corsHeaders });
  }

  const ids = expiredTasks.map((t: { id: string }) => t.id);
  const { error: updateErr } = await supabase
    .from("tasks")
    .update({ team_id: null })
    .in("id", ids);

  if (updateErr) {
    console.error("[expire-team-tasks] update error", updateErr);
    return new Response(JSON.stringify({ ok: false, error: updateErr.message }), { status: 500, headers: corsHeaders });
  }

  console.log(`[expire-team-tasks] cleared team_id for ${ids.length} tasks:`, ids);
  return new Response(
    JSON.stringify({ ok: true, expired: ids.length, task_ids: ids }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
