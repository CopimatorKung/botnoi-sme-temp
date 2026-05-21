CREATE TABLE public.team_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ป้องกัน invite ซ้ำในขณะที่ยัง pending
CREATE UNIQUE INDEX team_invitations_pending_unique
  ON public.team_invitations(team_id, invited_user_id)
  WHERE status = 'pending';

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- ดูได้เฉพาะของตัวเอง + admin
CREATE POLICY "Users view own invitations" ON public.team_invitations
  FOR SELECT USING (invited_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- team_leader+ ส่ง invite ได้
CREATE POLICY "Team leaders create invitations" ON public.team_invitations
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'team_leader') OR public.has_role(auth.uid(), 'admin')
  );

-- รับ/ปฏิเสธได้เฉพาะตัวเอง
CREATE POLICY "Users respond to own invitations" ON public.team_invitations
  FOR UPDATE USING (invited_user_id = auth.uid());
