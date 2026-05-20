import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface Member {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  roles: string[];
}

export function TeamTab() {
  const { role, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const isAdmin = role === "admin";

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: profs } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const m: Member[] = (profs || []).map((p) => ({
      id: p.id, email: p.email, display_name: p.display_name, avatar_url: p.avatar_url,
      roles: (roles || []).filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
    setMembers(m);
  };

  const approve = async (uid: string, role: "admin" | "member") => {
    // delete pending and insert real role
    await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "pending");
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) toast.error(error.message); else { toast.success("อนุมัติแล้ว"); load(); }
  };

  const revoke = async (uid: string, role: "admin" | "member") => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    if (error) toast.error(error.message);
    else {
      // also add pending so they remain locked out
      await supabase.from("user_roles").insert({ user_id: uid, role: "pending" }).select();
      toast.success("เพิกถอนแล้ว"); load();
    }
  };

  return (
    <div className="space-y-3">
      {!isAdmin && (
        <Card className="p-4 text-sm text-muted-foreground">
          เฉพาะ admin เท่านั้นที่อนุมัติหรือเปลี่ยนบทบาทสมาชิกได้ — คุณดูรายชื่อทีมได้
        </Card>
      )}
      <div className="grid gap-2">
        {members.map((m) => {
          const isPending = m.roles.includes("pending") && !m.roles.some((r) => r === "admin" || r === "member");
          const isAdminRole = m.roles.includes("admin");
          const isMemberRole = m.roles.includes("member");
          return (
            <Card key={m.id} className="p-3 flex items-center gap-3 flex-wrap">
              <Avatar><AvatarImage src={m.avatar_url || undefined} /><AvatarFallback>{m.display_name?.[0] || m.email?.[0] || "?"}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{m.display_name || "—"} {m.id === user?.id && <span className="text-xs text-muted-foreground">(คุณ)</span>}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex gap-1.5 items-center">
                {isAdminRole && <Badge>Admin</Badge>}
                {isMemberRole && <Badge variant="secondary">Member</Badge>}
                {isPending && <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950">รออนุมัติ</Badge>}
              </div>
              {isAdmin && m.id !== user?.id && (
                <div className="flex gap-1.5 flex-wrap">
                  {isPending && <>
                    <Button size="sm" onClick={() => approve(m.id, "member")}>อนุมัติเป็น Member</Button>
                    <Button size="sm" variant="outline" onClick={() => approve(m.id, "admin")}>อนุมัติเป็น Admin</Button>
                  </>}
                  {isMemberRole && <Button size="sm" variant="outline" onClick={() => approve(m.id, "admin")}>เลื่อนเป็น Admin</Button>}
                  {isAdminRole && <Button size="sm" variant="outline" onClick={() => revoke(m.id, "admin")}>ลดเป็น Member</Button>}
                  {(isMemberRole || isAdminRole) && <Button size="sm" variant="destructive" onClick={() => revoke(m.id, isAdminRole ? "admin" : "member")}>เพิกถอน</Button>}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
