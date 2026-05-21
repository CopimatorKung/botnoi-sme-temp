-- Update has_role so 'ceo' automatically has 'admin' privileges
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND (
      role = _role 
      OR (role = 'ceo'::public.app_role AND _role = 'admin'::public.app_role)
    )
  )
$$;

-- Update is_approved to include 'ceo'
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role IN ('ceo'::public.app_role, 'admin'::public.app_role, 'member'::public.app_role)
  )
$$;
