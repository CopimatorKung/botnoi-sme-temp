-- ================= เพิ่ม p_received_at ใน insert_bot_message =================
-- ให้ botnoi-reply ระบุเวลาแต่ละ message ได้อย่างถูกต้อง
-- เพื่อให้ web CRM แสดงลำดับตรงกับ LINE (text ก่อน, carousel ทีหลัง)

CREATE OR REPLACE FUNCTION public.insert_bot_message(
  p_line_user_id  text,
  p_content       text,
  p_message_type  text        DEFAULT 'text',
  p_raw_event     jsonb       DEFAULT NULL,
  p_received_at   timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_customer_id    uuid;
  v_message_id     uuid;
  v_now            timestamptz := now();
  v_target_user_id text := p_line_user_id;
  v_msg_time       timestamptz;
BEGIN
  IF p_line_user_id IS NULL OR length(trim(p_line_user_id)) = 0 THEN
    RAISE EXCEPTION 'p_line_user_id ห้ามว่าง';
  END IF;
  IF p_content IS NULL OR length(p_content) = 0 THEN
    RAISE EXCEPTION 'p_content ห้ามว่าง';
  END IF;

  -- ใช้ p_received_at ที่ส่งมา หรือ now() ถ้าไม่ได้ระบุ
  v_msg_time := COALESCE(p_received_at, v_now);

  -- ตรวจสอบ dummy / placeholder line_user_id
  IF p_line_user_id LIKE 'U0000%'
     OR p_line_user_id LIKE '%{{%'
     OR p_line_user_id LIKE '%<<%'
     OR p_line_user_id = 'userId'
     OR NOT (p_line_user_id ~ '^U[0-9a-fA-F]{32}$') THEN
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

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (line_user_id, last_message_at)
    VALUES (v_target_user_id, v_now)
    ON CONFLICT (line_user_id)
    DO UPDATE SET last_message_at = v_now
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET last_message_at = v_now
    WHERE id = v_customer_id;
  END IF;

  INSERT INTO public.messages (
    customer_id, message_type, content, source, received_at, raw_event
  )
  VALUES (
    v_customer_id, p_message_type, p_content, 'bot', v_msg_time, p_raw_event
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.insert_bot_message(text, text, text, jsonb, timestamptz) FROM public;
GRANT  EXECUTE ON FUNCTION public.insert_bot_message(text, text, text, jsonb, timestamptz) TO service_role, anon, authenticated;
