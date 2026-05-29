-- เพิ่มคอลัมน์ discord_name ใน profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS discord_name text;
