-- ฟังก์ชัน helper ตรวจว่า user ปัจจุบันมี role admin/developer/ceo หรือไม่
-- ใช้ SECURITY DEFINER เพื่อหลีกเลี่ยง recursive RLS บน user_roles
CREATE OR REPLACE FUNCTION public.is_admin_or_higher()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'developer', 'ceo')
  );
$$;

-- Policy: admin/developer/ceo สามารถอ่าน+เขียน user_roles ของทุกคนได้
-- สมาชิกทั่วไปจัดการได้เฉพาะแถวของตัวเอง
DO $$
BEGIN
  -- ลบ policy เก่าก่อนถ้ามี
  DROP POLICY IF EXISTS "admins_can_manage_all_user_roles" ON public.user_roles;
END $$;

CREATE POLICY "admins_can_manage_all_user_roles"
ON public.user_roles
FOR ALL
USING (
  is_admin_or_higher()
  OR user_id = auth.uid()
)
WITH CHECK (
  is_admin_or_higher()
  OR user_id = auth.uid()
);
