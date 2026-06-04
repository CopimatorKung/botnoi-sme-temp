import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Bell, Check, X, CheckCircle2, XCircle, ClipboardList, BellRing } from "lucide-react";

interface Invitation {
  id: string;
  team_id: string;
  invited_by: string | null;
  status: string;
  created_at: string;
  team_name: string;
  inviter_name: string;
}

interface TaskNotification {
  id: string;
  type: "approved" | "rejected" | "assigned" | "new_task";
  task_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  onTaskClick?: (taskId: string) => void;
}

export function NotificationBell({ onTaskClick }: NotificationBellProps) {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [taskNotifs, setTaskNotifs] = useState<TaskNotification[]>([]);
  const [open, setOpen] = useState(false);

  const totalUnread = invitations.length + taskNotifs.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!user) return;
    loadInvitations();
    loadTaskNotifs();

    const ch = supabase.channel("notif-bell-rt")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "team_invitations",
        filter: `invited_user_id=eq.${user.id}`,
      }, () => loadInvitations())
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => loadTaskNotifs())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const loadInvitations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("team_invitations" as any)
      .select("id,team_id,invited_by,status,created_at")
      .eq("invited_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) { setInvitations([]); return; }

    const teamIds = [...new Set(data.map((d: any) => d.team_id))];
    const inviterIds = [...new Set(data.map((d: any) => d.invited_by).filter(Boolean))];

    const [{ data: teams }, { data: profs }] = await Promise.all([
      supabase.from("teams" as any).select("id,name").in("id", teamIds),
      inviterIds.length > 0
        ? supabase.from("profiles").select("id,display_name,email").in("id", inviterIds)
        : Promise.resolve({ data: [] }),
    ]);

    const teamMap = Object.fromEntries(((teams as any[]) || []).map((t: any) => [t.id, t.name]));
    const profMap = Object.fromEntries(((profs as any[]) || []).map((p: any) => [p.id, p.display_name || p.email]));

    setInvitations(data.map((d: any) => ({
      ...d,
      team_name: teamMap[d.team_id] || "ไม่ทราบชื่อทีม",
      inviter_name: d.invited_by ? (profMap[d.invited_by] || "ไม่ทราบ") : "ไม่ทราบ",
    })));
  };

  const loadTaskNotifs = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications" as any)
      .select("id,type,task_id,message,is_read,created_at")
      .eq("user_id", user.id)
      .in("type", ["approved", "rejected", "assigned", "new_task"])
      .order("created_at", { ascending: false })
      .limit(20);

    // ถ้า table ยังไม่มีก็ข้ามไป
    if (error) return;
    setTaskNotifs((data ?? []) as TaskNotification[]);
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications" as any).update({ is_read: true }).eq("id", id);
    setTaskNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const accept = async (inv: Invitation) => {
    const { error } = await supabase.from("team_members" as any).insert({
      team_id: inv.team_id, user_id: user!.id, position: "member",
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("team_invitations" as any).update({ status: "accepted" }).eq("id", inv.id);
    toast.success(`เข้าร่วมทีม ${inv.team_name} แล้ว`);
    loadInvitations();
  };

  const decline = async (invId: string) => {
    await supabase.from("team_invitations" as any).update({ status: "rejected" }).eq("id", invId);
    toast.success("ปฏิเสธคำเชิญแล้ว");
    loadInvitations();
  };

  const hasItems = invitations.length > 0 || taskNotifs.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className={`w-5 h-5 transition-colors ${totalUnread > 0 ? "text-foreground" : "text-muted-foreground"}`} />
          {totalUnread > 0 && (
            <>
              {/* ping animation */}
              <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              {/* จำนวน */}
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none px-0.5">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden shadow-lg">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <p className="font-semibold text-sm">การแจ้งเตือน</p>
          {totalUnread > 0 && (
            <span className="text-xs text-muted-foreground">{totalUnread} ยังไม่อ่าน</span>
          )}
        </div>

        {!hasItems ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Bell className="w-7 h-7 mx-auto mb-2 opacity-20" />
            ไม่มีการแจ้งเตือน
          </div>
        ) : (
          <div className="divide-y max-h-96 overflow-y-auto">
            {/* Task review notifications */}
            {taskNotifs.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 flex gap-3 items-start cursor-pointer transition-colors hover:bg-muted/40 ${!n.is_read ? "bg-blue-50/60 dark:bg-blue-950/20" : ""}`}
                onClick={() => {
                  if (!n.is_read) markRead(n.id);
                  if (n.task_id && onTaskClick) {
                    setOpen(false);
                    onTaskClick(n.task_id);
                  }
                }}
              >
                <div className="shrink-0 mt-0.5">
                  {n.type === "approved"
                    ? <CheckCircle2 className="w-4 h-4 text-red-500" />
                    : n.type === "assigned"
                    ? <ClipboardList className="w-4 h-4 text-red-500" />
                    : n.type === "new_task"
                    ? <BellRing className="w-4 h-4 text-red-500" />
                    : <XCircle className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(n.created_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
              </div>
            ))}

            {/* Team invitations */}
            {invitations.map((inv) => (
              <div key={inv.id} className="px-4 py-3.5 space-y-2.5">
                <div className="text-sm leading-relaxed">
                  <span className="font-medium">{inv.inviter_name}</span>
                  {" "}ขอเชิญคุณเข้าร่วมทีม{" "}
                  <span className="font-semibold text-emerald-700">「{inv.team_name}」</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 flex-1"
                    onClick={() => accept(inv)}
                  >
                    <Check className="w-3 h-3" />
                    ยอมรับ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-red-200 text-red-500 hover:bg-red-50 gap-1 flex-1"
                    onClick={() => decline(inv.id)}
                  >
                    <X className="w-3 h-3" />
                    ปฏิเสธ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
