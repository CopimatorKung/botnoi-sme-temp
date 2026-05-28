-- ฟังก์ชัน swap หัวหน้าทีม
-- SECURITY DEFINER เพื่อ bypass RLS — ให้ทุกคนในทีมเรียกได้
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
  v_new_leader_user_id uuid;
  v_old_leader record;
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
    -- เปลี่ยน position ใน team_members
    UPDATE team_members SET position = 'member'
    WHERE id = v_old_leader.id;

    -- เปลี่ยน system role ใน user_roles (delete + insert)
    DELETE FROM user_roles WHERE user_id = v_old_leader.user_id;
    INSERT INTO user_roles (user_id, role) VALUES (v_old_leader.user_id, 'member');
  END LOOP;

  -- promote สมาชิกใหม่เป็น leader
  UPDATE team_members SET position = 'leader'
  WHERE id = p_new_leader_member_id;

  -- เปลี่ยน system role ของสมาชิกใหม่
  DELETE FROM user_roles WHERE user_id = v_new_leader_user_id;
  INSERT INTO user_roles (user_id, role) VALUES (v_new_leader_user_id, 'team_leader');
END;
$$;

-- อนุญาตให้ผู้ใช้ที่ล็อกอินแล้วเรียกฟังก์ชันนี้ได้
GRANT EXECUTE ON FUNCTION public.swap_team_leader(uuid, uuid) TO authenticated;
