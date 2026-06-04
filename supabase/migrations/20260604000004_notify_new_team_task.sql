-- แจ้งเตือนสมาชิกทีมเมื่อมีงานใหม่เข้าทีม (เช่น งานจาก LINE OA)
-- trigger นี้ fire เมื่อ INSERT task ที่มี team_id และไม่มี assigned_to

CREATE OR REPLACE FUNCTION public.notify_new_team_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.team_id IS NOT NULL AND NEW.assigned_to IS NULL THEN
    INSERT INTO public.notifications (user_id, type, task_id, message, is_read)
    SELECT
      tm.user_id,
      'new_task',
      NEW.id,
      '🔔 มีงานใหม่เข้าทีม: "' || NEW.title || '"',
      false
    FROM public.team_members tm
    WHERE tm.team_id = NEW.team_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_team_task ON public.tasks;
CREATE TRIGGER trg_notify_new_team_task
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_team_task();
