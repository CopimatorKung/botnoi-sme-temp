-- ================= แก้ไข insert_bot_message =================
-- แก้ 2 bugs:
--   1) เวอร์ชันเก่า: ไม่มี ELSE → ถ้า customer ยังไม่อยู่ใน table จะ silent fail
--      (เช่น bot greet message ตอน follow event, หรือ race condition กับ webhook)
--   2) เวอร์ชันเก่า: ไม่ได้ update customers.last_message_at
--      → list ลูกค้าหน้า Chat sort ผิด, ไม่ขยับเวลา bot ตอบ
--
-- เวอร์ชันใหม่:
--   - upsert customer (สร้างใหม่ถ้ายังไม่มี, update last_message_at ถ้ามี)
--   - return uuid ของ message ที่สร้าง เพื่อให้ caller log/track ได้
--   - validate input

DROP FUNCTION IF EXISTS public.insert_bot_message(text, text, text);

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
BEGIN
  IF p_line_user_id IS NULL OR length(trim(p_line_user_id)) = 0 THEN
    RAISE EXCEPTION 'p_line_user_id ห้ามว่าง';
  END IF;
  IF p_content IS NULL OR length(p_content) = 0 THEN
    RAISE EXCEPTION 'p_content ห้ามว่าง';
  END IF;

  INSERT INTO public.customers (line_user_id, last_message_at)
  VALUES (p_line_user_id, v_now)
  ON CONFLICT (line_user_id)
  DO UPDATE SET last_message_at = v_now
  RETURNING id INTO v_customer_id;

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
