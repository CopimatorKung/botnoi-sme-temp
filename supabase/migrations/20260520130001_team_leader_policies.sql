-- Update is_approved to include team_leader
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = _user_id AND role IN ('admin','member','team_leader')
) $$;

-- Team leader can approve pending -> member only (cannot delete pending first via existing admin policy)
CREATE POLICY "Team leaders approve pending as member" ON public.user_roles
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'team_leader') AND role = 'member'
  );

-- Team leader can remove pending role (needed before inserting member)
CREATE POLICY "Team leaders delete pending" ON public.user_roles
  FOR DELETE USING (
    public.has_role(auth.uid(), 'team_leader') AND role = 'pending'
  );

-- Team leader can view all roles (to see pending list)
DROP POLICY IF EXISTS "Users view own role" ON public.user_roles;
CREATE POLICY "Users view roles" ON public.user_roles FOR SELECT USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team_leader')
);
