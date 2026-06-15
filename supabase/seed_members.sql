-- =============================================================
-- Seed: เพิ่มสมาชิกทดสอบ 30 คน (role = member)
-- รันใน Supabase SQL Editor โดยตรง (ต้องการสิทธิ์ postgres)
-- รหัสผ่านของทุกคน: Password123!
-- =============================================================

DO $$
DECLARE
  v_id UUID;
  v_names TEXT[] := ARRAY[
    'สมชาย ใจดี',
    'สมหญิง รักดี',
    'นภา สกุลทอง',
    'วิชัย มั่นคง',
    'อรุณ แสงทอง',
    'กนกวรรณ พรมมา',
    'ธนกฤต บุญมา',
    'พิมพ์ใจ วงศ์ศรี',
    'ชาญณรงค์ ดีงาม',
    'ณัฐพล สุขสวัสดิ์',
    'ปิยะ ทรัพย์สิน',
    'รัตนา ชัยชนะ',
    'สุภาพร เจริญรัตน์',
    'ธีรวัฒน์ ศรีสะอาด',
    'มณีรัตน์ บุญเกิด',
    'อนุชา พลอยดี',
    'จิราพร วิเศษศิลป์',
    'ภูมิพัฒน์ คำสี',
    'วรรณภา ทองดี',
    'ประพันธ์ นิลสุวรรณ',
    'สิริมา เพชรงาม',
    'กิตติ์ธเนศ ลำดวน',
    'อัญชลี สมบูรณ์',
    'ณัฐวุฒิ เกษมสุข',
    'พัชรา มีโชค',
    'เอกชัย บุญประเสริฐ',
    'ทิพย์วรา ศิลาทอง',
    'สราวุธ จงดี',
    'ชุติมา วงศ์จันทร์',
    'ปรัชญา เทียนทอง'
  ];
  v_emails TEXT[] := ARRAY[
    'somchai.jaidee@botnoi-test.com',
    'somying.rakdee@botnoi-test.com',
    'napa.sakultong@botnoi-test.com',
    'wichai.mankong@botnoi-test.com',
    'arun.sangthong@botnoi-test.com',
    'kanokwan.pramma@botnoi-test.com',
    'thanakrit.boonma@botnoi-test.com',
    'pimjai.wongsri@botnoi-test.com',
    'channarong.dingam@botnoi-test.com',
    'nattaphon.suksawat@botnoi-test.com',
    'piya.sapsin@botnoi-test.com',
    'rattana.chaichana@botnoi-test.com',
    'supaporn.jaroenrat@botnoi-test.com',
    'teerawat.srisaard@botnoi-test.com',
    'maneerat.boonkerd@botnoi-test.com',
    'anucha.ploydee@botnoi-test.com',
    'jiraporn.wisetsin@botnoi-test.com',
    'poomiphat.khamsi@botnoi-test.com',
    'wannapa.thongdee@botnoi-test.com',
    'prapan.nilsuwan@botnoi-test.com',
    'sirima.phetngam@botnoi-test.com',
    'kittithanate.lamduan@botnoi-test.com',
    'anchalee.somboon@botnoi-test.com',
    'natthawut.kasemsuks@botnoi-test.com',
    'phatchara.meechok@botnoi-test.com',
    'eakchai.boonprasert@botnoi-test.com',
    'thipwara.silathong@botnoi-test.com',
    'sarawut.jongdee@botnoi-test.com',
    'chutima.wongchan@botnoi-test.com',
    'pratchaya.thianthong@botnoi-test.com'
  ];
  v_avatars TEXT[] := ARRAY[
    'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=2',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=3',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=4',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=5',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=6',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=7',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=8',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=9',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=10',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=11',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=12',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=13',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=14',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=15',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=16',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=17',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=18',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=19',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=20',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=21',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=22',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=23',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=24',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=25',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=26',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=27',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=28',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=29',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=30'
  ];
  v_encrypted_pw TEXT;
BEGIN
  -- สร้าง bcrypt hash ของรหัสผ่าน "Password123!"
  v_encrypted_pw := crypt('Password123!', gen_salt('bf'));

  FOR i IN 1..30 LOOP
    v_id := gen_random_uuid();

    -- Insert ลง auth.users → trigger จะสร้าง profile + role = 'pending' อัตโนมัติ
    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      instance_id,
      is_super_admin
    ) VALUES (
      v_id,
      'authenticated',
      'authenticated',
      v_emails[i],
      v_encrypted_pw,
      now(),
      jsonb_build_object(
        'full_name', v_names[i],
        'avatar_url', v_avatars[i]
      ),
      now() - (random() * interval '90 days'),
      now(),
      '00000000-0000-0000-0000-000000000000',
      false
    )
    ON CONFLICT (email) DO NOTHING;

    -- อัปเดต avatar_url ใน profiles (trigger ดึงจาก meta_data แล้ว แต่ backup ไว้)
    UPDATE public.profiles
    SET avatar_url = v_avatars[i]
    WHERE id = v_id AND avatar_url IS NULL;

  END LOOP;

  -- เปลี่ยน role จาก 'pending' → 'member' สำหรับ 30 คนที่เพิ่งสร้าง
  UPDATE public.user_roles
  SET role = 'member'
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@botnoi-test.com'
  )
  AND role = 'pending';

  RAISE NOTICE 'เพิ่มสมาชิก 30 คนเรียบร้อยแล้ว (role = member, password = Password123!)';
END;
$$;

-- ตรวจสอบผลลัพธ์
SELECT
  p.display_name,
  p.email,
  ur.role,
  p.created_at::date AS joined
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.email LIKE '%@botnoi-test.com'
ORDER BY p.created_at DESC;
