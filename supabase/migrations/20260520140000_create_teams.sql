CREATE TABLE public.teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position   TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Teams: view
CREATE POLICY "Approved view teams" ON public.teams
  FOR SELECT USING (public.is_approved(auth.uid()));

-- Teams: team_leader+ create
CREATE POLICY "Team leader create teams" ON public.teams
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'team_leader') OR public.has_role(auth.uid(), 'admin')
  );

-- Teams: creator or admin update/delete
CREATE POLICY "Creator or admin update teams" ON public.teams
  FOR UPDATE USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Creator or admin delete teams" ON public.teams
  FOR DELETE USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Team members: view
CREATE POLICY "Approved view team members" ON public.team_members
  FOR SELECT USING (public.is_approved(auth.uid()));

-- Team members: team_leader+ manage
CREATE POLICY "Team leader manage members insert" ON public.team_members
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'team_leader') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Team leader manage members update" ON public.team_members
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'team_leader') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Team leader manage members delete" ON public.team_members
  FOR DELETE USING (
    public.has_role(auth.uid(), 'team_leader') OR public.has_role(auth.uid(), 'admin')
  );
