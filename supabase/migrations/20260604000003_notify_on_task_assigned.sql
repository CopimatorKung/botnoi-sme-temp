-- แจ้งเตือนเมื่อมีการ assign งานให้ใคร
-- trigger นี้จะ insert ลง notifications table อัตโนมัติ

CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- assigned_to ถูก set ใหม่ (จาก NULL หรือเปลี่ยนไปเป็นคนอื่น)
  IF NEW.assigned_to IS NOT NULL
     AND (OLD.assigned_to IS NULL OR OLD.assigned_to <> NEW.assigned_to)
  THEN
    -- ไม่แจ้งถ้า assign ให้ตัวเอง (เช่น รับงานเอง)
    IF NEW.assigned_to IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, task_id, message, is_read)
      VALUES (
        NEW.assigned_to,
        'assigned',
        NEW.id,
        '📋 คุณได้รับมอบหมายงาน: "' || NEW.title || '"',
        false
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();
