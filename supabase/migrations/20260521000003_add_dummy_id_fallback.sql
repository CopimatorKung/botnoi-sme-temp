-- ================= แก้ไข insert_bot_message เพิ่ม fallback สำหรับรหัสดัมมี่ =================
-- เมื่อบอทเรียกผ่าน MCP Server แล้ว AI ส่งค่า line_user_id เป็นค่ายกเมฆ/ดัมมี่ (เช่น U00000000000000000000000000000000)
-- ระบบจะทำการดึงข้อมูลลูกค้ารายล่าสุดที่เพิ่งแชทเข้ามาแทน เพื่อบันทึกเข้าห้องคุยที่ถูกต้อง

CREATE OR REPLACE FUNCTION public.insert_bot_message(
  p_line_user_id text,
  p_content      text,
  p_message_type text DEFAULT 'text'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_customer_id uuid;
  v_message_id  uuid;
  v_now         timestamptz := now();
  v_target_user_id text := p_line_user_id;
BEGIN
  IF p_line_user_id IS NULL OR length(trim(p_line_user_id)) = 0 THEN
    RAISE EXCEPTION 'p_line_user_id ห้ามว่าง';
  END IF;
  IF p_content IS NULL OR length(p_content) = 0 THEN
    RAISE EXCEPTION 'p_content ห้ามว่าง';
  END IF;

  -- ตรวจสอบว่าเป็นค่ายกเมฆ / Dummy ID / Placeholder หรือไม่
  -- เช่น ขึ้นต้นด้วย U0000 หรือมีเครื่องหมาย {{ หรือ << หรือไม่ใช่รูปแบบ U + hex 32 ตัว หรือเป็นคำว่า userId
  IF p_line_user_id LIKE 'U0000%' 
     OR p_line_user_id LIKE '%{{%' 
     OR p_line_user_id LIKE '%<<%'
     OR p_line_user_id = 'userId'
     OR NOT (p_line_user_id ~ '^U[0-9a-fA-F]{32}$') THEN
    -- ค้นหาลูกค้ารายล่าสุดที่ไม่ใช่รหัสดัมมี่/เพลสโฮลเดอร์
    SELECT id, line_user_id INTO v_customer_id, v_target_user_id
    FROM public.customers
    WHERE line_user_id NOT LIKE 'U0000%'
      AND line_user_id NOT LIKE '%{{%'
      AND line_user_id NOT LIKE '%<<%'
      AND line_user_id != 'userId'
      AND line_user_id ~ '^U[0-9a-fA-F]{32}$'
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- ถ้าค้นหาไม่พบลูกค้ารายอื่น (หรือไม่ใช่รหัสดัมมี่แต่แรก) ให้สร้าง/ใช้ตามรหัสที่ส่งมา
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (line_user_id, last_message_at)
    VALUES (v_target_user_id, v_now)
    ON CONFLICT (line_user_id)
    DO UPDATE SET last_message_at = v_now
    RETURNING id INTO v_customer_id;
  ELSE
    -- หากเจอลูกค้ารายล่าสุด ให้ปรับปรุงเวลาข้อความล่าสุดของลูกค้าคนนั้น
    UPDATE public.customers
    SET last_message_at = v_now
    WHERE id = v_customer_id;
  END IF;

  -- บันทึกข้อความฝั่งบอท
  INSERT INTO public.messages (
    customer_id, message_type, content, source, received_at
  )
  VALUES (
    v_customer_id, p_message_type, p_content, 'bot', v_now
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.insert_bot_message(text, text, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.insert_bot_message(text, text, text) TO service_role, anon, authenticated;
