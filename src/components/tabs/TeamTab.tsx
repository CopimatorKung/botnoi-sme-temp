import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Check, X, ChevronDown } from "lucide-react";

interface Member {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  roles: string[];
}

type ActiveRole = "developer" | "ceo" | "admin" | "team_leader" | "member";

const ROLE_STYLE: Record<ActiveRole, string> = {
  developer:   "bg-rose-600 hover:bg-rose-700 text-white border-0",
  ceo:         "bg-purple-500 hover:bg-purple-600 text-white border-0",
  admin:       "bg-primary text-primary-foreground border-0",
  team_leader: "bg-blue-500 hover:bg-blue-600 text-white border-0",
  member:      "bg-secondary text-secondary-foreground border-0",
};
const ROLE_LABEL: Record<ActiveRole, string> = {
  developer: "Developer", ceo: "CEO", admin: "Admin", team_leader: "Team Leader", member: "Member",
};

export function TeamTab() {
  const { role, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "pending">("active");
  const [pendingApproval, setPendingApproval] = useState<{ uid: string; name: string; role: ActiveRole } | null>(null);
  const isDeveloper = role === "developer";
  const isCEO = role === "ceo" || role === "developer";
  const isAdmin = role === "admin" || role === "ceo" || role === "developer";
  const isTeamLeader = role === "team_leader";

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: profs } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    const roleMap = new Map<string, string[]>();
    (roles || []).forEach((r) => {
      if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
      roleMap.get(r.user_id)!.push(r.role);
    });

    const profMap = new Map((profs || []).map((p) => [p.id, p]));

    // รวมทุก user ที่มี profile หรือมี role (เพื่อไม่พลาด pending ที่ยังไม่มี profile)
    const allIds = new Set([
      ...(profs || []).map((p) => p.id),
      ...(roles || []).map((r) => r.user_id),
    ]);

    const m: Member[] = Array.from(allIds).map((id) => {
      const p = profMap.get(id);
      return {
        id,
        email: p?.email || null,
        display_name: p?.display_name || null,
        avatar_url: p?.avatar_url || null,
        roles: roleMap.get(id) || [],
      };
    });

    setMembers(m);
  };

  const approve = async (uid: string, newRole: ActiveRole) => {
    await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "pending");
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: newRole });
    if (error) toast.error(error.message);
    else { toast.success("อนุมัติแล้ว"); setApprovingId(null); load(); }
  };

  const changeRole = async (uid: string, oldRole: ActiveRole, newRole: ActiveRole) => {
    await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", oldRole);
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: newRole });
    if (error) toast.error(error.message);
    else { toast.success("เปลี่ยน role แล้ว"); load(); }
  };

  const reject = async (uid: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "pending");
    if (error) toast.error(error.message);
    else { toast.success("ปฏิเสธแล้ว"); load(); }
  };

  const revoke = async (uid: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid);
    if (error) toast.error("เพิกถอนไม่สำเร็จ: " + error.message);
    else { toast.success("เพิกถอนสิทธิ์แล้ว"); load(); }
  };

  // ตัวเลือก role ที่สามารถเปลี่ยนไปได้ ขึ้นอยู่กับ current role ของ viewer และ target role
  const getRoleOptions = (currentRole: ActiveRole): { label: string; value: ActiveRole }[] => {
    const all: { label: string; value: ActiveRole }[] = [
      { label: "Member",      value: "member"      },
      { label: "Team Leader", value: "team_leader" },
      { label: "Admin",       value: "admin"       },
      { label: "CEO",         value: "ceo"         },
      { label: "Developer",   value: "developer"   },
    ];
    return all.filter((o) => {
      if (o.value === currentRole) return false;
      if (o.value === "developer" && !isCEO) return false;   // CEO และ Developer เลื่อนเป็น Developer ได้
      if (o.value === "ceo" && !isCEO) return false;         // CEO และ Developer เลื่อนเป็น CEO ได้
      if (o.value === "admin" && !isAdmin) return false;
      if (currentRole === "developer" && !isCEO) return false; // CEO และ Developer จัดการ Developer ได้
      if (currentRole === "ceo" && !isCEO) return false;
      if (currentRole === "admin" && !isCEO) return false;
      return true;
    });
  };

  return (
    <div className="space-y-3">

      {role === "member" && (
        <Card className="p-4 text-sm text-muted-foreground">
          คุณดูรายชื่อทีมได้ — การจัดการสิทธิ์ต้องใช้ Admin ขึ้นไป
        </Card>
      )}
      {isTeamLeader && (
        <Card className="p-4 text-sm text-muted-foreground border-blue-100 bg-blue-50/50">
          คุณเป็น Team Leader — สามารถอนุมัติผู้ใช้งานใหม่เป็น Member ได้
        </Card>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit">
        {([["active", "สมาชิก"], ["pending", "รอดำเนินการ"]] as const).map(([val, label]) => {
          const count = val === "active"
            ? members.filter((m) => (["developer","ceo","admin","team_leader","member"] as ActiveRole[]).some((r) => m.roles.includes(r))).length
            : members.filter((m) => m.roles.includes("pending") && !(["developer","ceo","admin","team_leader","member"] as ActiveRole[]).some((r) => m.roles.includes(r))).length;
          return (
            <button
              key={val}
              onClick={() => setView(val)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                view === val
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  view === val
                    ? val === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-2">
        {members
          .filter((m) => {
            const hasActive = (["developer","ceo","admin","team_leader","member"] as ActiveRole[]).some((r) => m.roles.includes(r));
            const hasPending = m.roles.includes("pending") && !hasActive;
            return view === "active" ? hasActive : hasPending;
          })
          .map((m) => {
          const activeRole = (["developer","ceo","admin","team_leader","member"] as ActiveRole[]).find((r) => m.roles.includes(r));
          const isPending  = m.roles.includes("pending") && !activeRole;
          const isApproving = approvingId === m.id;
          const canEdit = isAdmin && m.id !== user?.id && !!activeRole;
          const roleOptions = activeRole ? getRoleOptions(activeRole) : [];

          return (
            <Card key={m.id} className="p-3 flex items-center gap-3 flex-wrap">
              <Avatar>
                <AvatarImage src={m.avatar_url || undefined} />
                <AvatarFallback>{m.display_name?.[0] || m.email?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {m.display_name || m.email || <span className="text-muted-foreground italic text-xs">ยังไม่มีโปรไฟล์</span>}{" "}
                  {m.id === user?.id && <span className="text-xs text-muted-foreground">(คุณ)</span>}
                </p>
                {!m.display_name && !m.email && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{m.id}</p>
                )}
              </div>

              {/* Role badge — dropdown ถ้า canEdit */}
              <div className="flex gap-1.5 items-center flex-wrap">
                {activeRole && (
                  canEdit && roleOptions.length > 0 ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80 ${ROLE_STYLE[activeRole]}`}>
                          {ROLE_LABEL[activeRole]}
                          <ChevronDown className="w-3 h-3 opacity-70" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-44 p-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium px-2 pb-1">เปลี่ยน role เป็น</p>
                        {roleOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => changeRole(m.id, activeRole, opt.value)}
                            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                          >
                            {opt.label}
                          </button>
                        ))}
                        <div className="border-t mt-1 pt-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="w-full text-left text-sm px-2 py-1.5 rounded text-red-500 hover:bg-red-50 transition-colors">
                                เพิกถอน
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>ยืนยันการลบผู้ใช้</AlertDialogTitle>
                                <AlertDialogDescription>
                                  การเพิกถอนจะ<strong>ลบข้อมูลทั้งหมด</strong>ของ <strong>{m.display_name || m.email}</strong> ออกจากระบบถาวร รวมถึง profile และสิทธิ์การเข้าถึงทั้งหมด ไม่สามารถกู้คืนได้
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => revoke(m.id)}
                                >
                                  ยืนยันลบ
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Badge className={ROLE_STYLE[activeRole]}>{ROLE_LABEL[activeRole]}</Badge>
                  )
                )}
                {isPending && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">รออนุมัติ</Badge>
                )}
              </div>

              {/* Pending: อนุมัติ / ไม่อนุมัติ */}
              {isPending && (isAdmin || isTeamLeader) && m.id !== user?.id && (
                <div className="flex items-center gap-2 flex-wrap">
                  {isApproving ? (
                    <>
                      <Select onValueChange={(v) => setPendingApproval({ uid: m.id, name: m.display_name || m.email || "—", role: v as ActiveRole })}>
                        <SelectTrigger className="h-8 w-40 text-xs border-emerald-300 focus:ring-emerald-400">
                          <SelectValue placeholder="เลือก role..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          {isAdmin && <SelectItem value="team_leader">Team Leader</SelectItem>}
                          {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                          {isCEO  && <SelectItem value="ceo">CEO</SelectItem>}
                          {isDeveloper && <SelectItem value="developer">Developer</SelectItem>}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setApprovingId(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        onClick={() => isTeamLeader ? approve(m.id, "member") : setApprovingId(m.id)}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                        {!isTeamLeader && <ChevronDown className="w-3 h-3 opacity-70" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-400 gap-1.5"
                        onClick={() => reject(m.id)}
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Confirm approve dialog */}
      <AlertDialog open={!!pendingApproval} onOpenChange={(o) => { if (!o) setPendingApproval(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการอนุมัติ</AlertDialogTitle>
            <AlertDialogDescription>
              อนุมัติ <strong>{pendingApproval?.name}</strong> ให้เป็น <strong>{pendingApproval ? ROLE_LABEL[pendingApproval.role] : ""}</strong> ใช่ไหม?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingApproval(null); setApprovingId(null); }}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (pendingApproval) { approve(pendingApproval.uid, pendingApproval.role); setPendingApproval(null); }
              }}
            >
              ยืนยันอนุมัติ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
