-- เพิ่มข้อมูลฝึกงานใน profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS internship_start DATE,
  ADD COLUMN IF NOT EXISTS internship_end DATE;
