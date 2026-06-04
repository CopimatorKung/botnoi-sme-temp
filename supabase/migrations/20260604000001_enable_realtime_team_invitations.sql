-- เปิด realtime สำหรับ team_invitations
-- แก้ 403 จาก Supabase Realtime subscription ใน NotificationBell
alter publication supabase_realtime add table public.team_invitations;
