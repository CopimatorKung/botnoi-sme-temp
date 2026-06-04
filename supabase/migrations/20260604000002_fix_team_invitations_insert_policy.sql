-- แก้ INSERT policy ของ team_invitations
-- เดิมอนุญาตเฉพาะ team_leader และ admin
-- เพิ่ม developer และ ceo ให้ส่ง invitation ได้ด้วย

DROP POLICY IF EXISTS "Team leaders create invitations" ON public.team_invitations;

CREATE POLICY "Team leaders create invitations" ON public.team_invitations
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'team_leader')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'ceo')
    OR public.has_role(auth.uid(), 'developer')
  );
