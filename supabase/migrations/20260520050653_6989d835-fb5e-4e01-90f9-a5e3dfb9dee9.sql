-- Enum สำหรับบทบาท
CREATE TYPE public.app_role AS ENUM ('admin', 'member', 'pending');
CREATE TYPE public.task_status AS ENUM ('open', 'in_progress', 'done', 'cancelled');

-- ================= PROFILES =================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ================= USER ROLES =================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer ป้องกัน recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','member')) $$;

-- ================= CUSTOMERS =================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  status_message TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_customers_last_message ON public.customers(last_message_at DESC);

-- ================= TASKS =================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);

-- ================= MESSAGES =================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  line_message_id TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  raw_event JSONB,
  source TEXT NOT NULL DEFAULT 'line',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_messages_customer ON public.messages(customer_id, received_at DESC);

-- ================= POLICIES =================
-- profiles: ทุกคนในทีมเห็นกันได้, แก้ของตัวเอง
CREATE POLICY "Approved users view all profiles" ON public.profiles FOR SELECT USING (public.is_approved(auth.uid()) OR auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles: เห็นของตัวเอง / admin เห็นทั้งหมด, admin เท่านั้นที่เปลี่ยนบทบาท
CREATE POLICY "Users view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- customers / tasks / messages: ทีมที่อนุมัติแล้วจัดการได้หมด
CREATE POLICY "Approved view customers" ON public.customers FOR SELECT USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved insert customers" ON public.customers FOR INSERT WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved update customers" ON public.customers FOR UPDATE USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved delete customers" ON public.customers FOR DELETE USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Approved view tasks" ON public.tasks FOR SELECT USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved insert tasks" ON public.tasks FOR INSERT WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved update tasks" ON public.tasks FOR UPDATE USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved delete tasks" ON public.tasks FOR DELETE USING (public.is_approved(auth.uid()));

CREATE POLICY "Approved view messages" ON public.messages FOR SELECT USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved insert messages" ON public.messages FOR INSERT WITH CHECK (public.is_approved(auth.uid()));

-- ================= TRIGGERS =================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup + ตั้งเป็น pending
-- คนแรกที่สมัคร = admin อัตโนมัติ
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
  new_role app_role;
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN new_role := 'admin'; ELSE new_role := 'pending'; END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, new_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;