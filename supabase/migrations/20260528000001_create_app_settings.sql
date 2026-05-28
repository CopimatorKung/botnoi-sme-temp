-- ================= APP SETTINGS =================
-- Key-value store for feature flags and web management
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ทุกคนที่อนุมัติแล้วอ่านได้
CREATE POLICY "Approved users read settings" ON public.app_settings
  FOR SELECT USING (public.is_approved(auth.uid()));

-- เฉพาะ admin / ceo / developer แก้ได้
CREATE POLICY "Admins upsert settings" ON public.app_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('admin', 'ceo', 'developer')
    )
  );

CREATE POLICY "Admins update settings" ON public.app_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('admin', 'ceo', 'developer')
    )
  );

-- Trigger อัปเดต updated_at อัตโนมัติ
CREATE TRIGGER trg_app_settings_updated
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ค่าเริ่มต้น: ปิดการแนบไฟล์ไว้ก่อน
INSERT INTO public.app_settings (key, value) VALUES ('allow_file_upload', 'false');
