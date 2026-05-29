-- แก้ไขฟังก์ชัน swap_team_leader
-- ป้องกันไม่ให้ role ที่สูงกว่า team_leader (admin, ceo, developer) ถูกเปลี่ยน

CREATE OR REPLACE FUNCTION public.swap_team_leader(
  p_team_id    uuid,
  p_new_leader_member_id uuid  -- id ของ team_members row (ไม่ใช่ user_id)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_leader_user_id       uuid;
  v_new_leader_current_role  text;
  v_old_leader               record;
  v_old_leader_current_role  text;
  -- roles ที่ไม่ควรถูกเปลี่ยนโดย swap (สูงกว่า team_leader)
  v_exempt_roles             CONSTANT text[] := ARRAY['admin', 'ceo', 'developer'];
BEGIN
  -- ดึง user_id ของสมาชิกคนใหม่ที่จะเป็นหัวหน้า
  SELECT user_id INTO v_new_leader_user_id
  FROM team_members
  WHERE id = p_new_leader_member_id AND team_id = p_team_id;

  IF v_new_leader_user_id IS NULL THEN
    RAISE EXCEPTION 'member not found in team';
  END IF;

  -- demote หัวหน้าเดิมทุกคนในทีม
  FOR v_old_leader IN
    SELECT tm.id, tm.user_id
    FROM team_members tm
    WHERE tm.team_id = p_team_id
      AND tm.position = 'leader'
      AND tm.id != p_new_leader_member_id
  LOOP
    -- เปลี่ยน position ใน team_members (ทำเสมอ)
    UPDATE team_members SET position = 'member'
    WHERE id = v_old_leader.id;

    -- เปลี่ยน system role เฉพาะถ้า role ปัจจุบันไม่ใช่ exempt
    SELECT role INTO v_old_leader_current_role
    FROM user_roles WHERE user_id = v_old_leader.user_id;

    IF v_old_leader_current_role IS NOT NULL
       AND NOT (v_old_leader_current_role = ANY(v_exempt_roles)) THEN
      DELETE FROM user_roles WHERE user_id = v_old_leader.user_id;
      INSERT INTO user_roles (user_id, role) VALUES (v_old_leader.user_id, 'member');
    END IF;
  END LOOP;

  -- promote สมาชิกใหม่เป็น leader ใน team_members (ทำเสมอ)
  UPDATE team_members SET position = 'leader'
  WHERE id = p_new_leader_member_id;

  -- เปลี่ยน system role เฉพาะถ้า role ปัจจุบันไม่ใช่ exempt
  SELECT role INTO v_new_leader_current_role
  FROM user_roles WHERE user_id = v_new_leader_user_id;

  IF v_new_leader_current_role IS NOT NULL
     AND NOT (v_new_leader_current_role = ANY(v_exempt_roles)) THEN
    DELETE FROM user_roles WHERE user_id = v_new_leader_user_id;
    INSERT INTO user_roles (user_id, role) VALUES (v_new_leader_user_id, 'team_leader');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_team_leader(uuid, uuid) TO authenticated;
