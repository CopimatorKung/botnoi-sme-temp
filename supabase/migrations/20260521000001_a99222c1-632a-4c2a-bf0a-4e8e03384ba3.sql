-- ================= insert_bot_message RPC =================
-- ใช้สำหรับให้ AI Bot (เช่น Botnoid) เรียกบันทึกข้อความที่ bot ตอบลูกค้าผ่าน LINE
-- รับ line_user_id ของลูกค้า + ข้อความ แล้ว insert ลง messages table ด้วย source='bot'
-- ถ้ายังไม่มี customer record ของ line_user_id นี้ จะสร้างให้อัตโนมัติ
-- ใช้ SECURITY DEFINER เพื่อให้ทำงานได้แม้ caller ไม่มีสิทธิ์ตรงๆ บนตาราง (RLS bypass)

CREATE OR REPLACE FUNCTION public.insert_bot_message(
  p_line_user_id TEXT,
  p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_message_id  UUID;
  v_now         TIMESTAMPTZ := now();
BEGIN
  IF p_line_user_id IS NULL OR length(trim(p_line_user_id)) = 0 THEN
    RAISE EXCEPTION 'p_line_user_id ห้ามว่าง';
  END IF;
  IF p_content IS NULL OR length(p_content) = 0 THEN
    RAISE EXCEPTION 'p_content ห้ามว่าง';
  END IF;

  -- หาลูกค้า; ถ้ายังไม่มี ให้สร้าง record ใหม่
  -- (กรณี bot ทักก่อนที่ลูกค้าจะส่งข้อความเข้ามา webhook)
  INSERT INTO public.customers (line_user_id, last_message_at)
  VALUES (p_line_user_id, v_now)
  ON CONFLICT (line_user_id)
  DO UPDATE SET last_message_at = v_now
  RETURNING id INTO v_customer_id;

  -- บันทึกข้อความ bot
  INSERT INTO public.messages (
    customer_id,
    message_type,
    content,
    source,
    received_at
  )
  VALUES (
    v_customer_id,
    'text',
    p_content,
    'bot',
    v_now
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

-- ให้ service_role เรียกได้ (Botnoid ใช้ service key)
-- เปิด anon/authenticated ด้วยเผื่อในอนาคตอยากเรียกจาก frontend ก็ได้
REVOKE EXECUTE ON FUNCTION public.insert_bot_message(TEXT, TEXT) FROM public;
GRANT  EXECUTE ON FUNCTION public.insert_bot_message(TEXT, TEXT) TO service_role, anon, authenticated;
