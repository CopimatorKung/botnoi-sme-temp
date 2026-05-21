import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserCheck, MessageSquare } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { th } from "date-fns/locale";

type Status = "open" | "in_progress" | "done" | "cancelled";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  assigned_to: string | null;
  created_by: string | null;
  customer_id: string | null;
  team_id: string | null;
  due_date: string | null;
  created_at: string;
}

interface Profile { id: string; display_name: string | null; email: string | null; }
interface Customer { id: string; display_name: string | null; line_user_id: string | null; }

const statusLabel: Record<Status, string> = {
  open: "งานอิสระ", in_progress: "กำลังทำ", done: "เสร็จแล้ว", cancelled: "ยกเลิก",
};
const statusColor: Record<Status, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-400",
};

interface MyTeam { id: string; name: string; }

interface TasksTabProps {
  goToCustomer?: (customerId: string) => void;
}

export function TasksTab({ goToCustomer }: TasksTabProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [myTeams, setMyTeams] = useState<MyTeam[]>([]);
  const [filter, setFilter] = useState<"all" | "mine" | "unassigned" | "team" | Status>("all");
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [claimWorkType, setClaimWorkType] = useState<"solo" | "team">("solo");
  const [claimTeamId, setClaimTeamId] = useState<string>("");
  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: Status } | null>(null);

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  useEffect(() => {
    loadAll();
    const ch = supabase.channel("tasks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadTasks())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const loadAll = async () => { await Promise.all([loadTasks(), loadProfiles(), loadCustomers(), loadMyTeams()]); };

  const loadMyTeams = async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from("team_members" as any).select("team_id").eq("user_id", user.id);
    if (!memberships || memberships.length === 0) return;
    const teamIds = (memberships as any[]).map((m: any) => m.team_id);
    const { data: teams } = await supabase.from("teams" as any).select("id,name").in("id", teamIds);
    setMyTeams((teams as MyTeam[]) || []);
  };
  const loadTasks = async () => {
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    setTasks((data as Task[]) || []);
  };
  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id,display_name,email");
    setProfiles(data || []);
  };
  const loadCustomers = async () => {
    const { data } = await supabase.from("customers").select("id,display_name,line_user_id").order("display_name");
    setCustomers(data || []);
  };

  const confirmClaim = async () => {
    if (!claimingTaskId || !user) return;
    if (claimWorkType === "team" && !claimTeamId) { toast.error("กรุณาเลือกทีม"); return; }
    const { error } = await supabase.from("tasks").update({
      assigned_to: user.id,
      status: "in_progress",
      team_id: claimWorkType === "team" ? claimTeamId : null,
    } as any).eq("id", claimingTaskId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(claimWorkType === "solo" ? "รับงานเดี่ยวแล้ว" : "รับงานทีมแล้ว");
      setTasks((prev) => prev.map((t) =>
        t.id === claimingTaskId ? { ...t, assigned_to: user.id, status: "in_progress" as Status } : t
      ));

      // ส่งแจ้งลูกค้าทาง LINE ถ้า task ผูกกับลูกค้า
      const claimedTask = tasks.find((t) => t.id === claimingTaskId);
      if (claimedTask?.customer_id) {
        const customer = customers.find((c) => c.id === claimedTask.customer_id);
        if (customer?.line_user_id) {
          const msg = `✅ รับงานแล้ว\nทีมงานของเรากำลังดูแลคุณอยู่นะครับ/ค่ะ`;
          await supabase.functions.invoke("line-webhook/send", {
            body: { to: customer.line_user_id, text: msg },
          });
          await supabase.from("messages").insert({
            customer_id: customer.id,
            message_type: "text",
            content: msg,
            source: "agent",
          });
        }
      }

      setClaimingTaskId(null);
      setClaimWorkType("solo");
      setClaimTeamId("");
    }
  };

  const statusNotify: Record<Status, string> = {
    open: "📋 งานถูกเปิดใหม่อีกครั้งแล้วครับ/ค่ะ",
    in_progress: "⚙️ ทีมงานกำลังดำเนินการงานของคุณอยู่นะครับ/ค่ะ",
    done: "✅ งานของคุณเสร็จสมบูรณ์แล้วครับ/ค่ะ ขอบคุณที่ใช้บริการ!",
    cancelled: "❌ งานถูกยกเลิกแล้วครับ/ค่ะ หากมีข้อสงสัยสามารถติดต่อเราได้เลย",
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));

      // ส่งแจ้งลูกค้าทาง LINE
      const task = tasks.find((t) => t.id === id);
      if (task?.customer_id) {
        const customer = customers.find((c) => c.id === task.customer_id);
        if (customer?.line_user_id) {
          const msg = statusNotify[status];
          await supabase.functions.invoke("line-webhook/send", {
            body: { to: customer.line_user_id, text: msg },
          });
          await supabase.from("messages").insert({
            customer_id: customer.id,
            message_type: "text",
            content: msg,
            source: "agent",
          });
        }
      }
    }
  };

  const filtered = tasks.filter((t) => {
    if (filter === "all") return true;
    if (filter === "mine") return t.assigned_to === user?.id;
    if (filter === "unassigned") return !t.assigned_to;
    if (filter === "team") return !!t.team_id;
    return t.status === filter;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "mine", "unassigned", "team", "in_progress", "done"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? "ทั้งหมด" : f === "mine" ? "ของฉัน" : f === "unassigned" ? "ยังไม่มีคนรับ" : f === "team" ? "งานของทีม" : statusLabel[f as Status]}
          </Button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">ไม่มีงานในหมวดนี้</Card>
        )}
        {filtered.map((t) => {
          const assignee = t.assigned_to ? profileMap[t.assigned_to] : null;
          const creator = t.created_by ? profileMap[t.created_by] : null;
          const customer = t.customer_id ? customerMap[t.customer_id] : null;
          const isMine = t.assigned_to === user?.id;
          return (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{t.title}</h3>
                    <Badge className={statusColor[t.status]}>{statusLabel[t.status]}</Badge>
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{t.description}</p>}
                  <div className="text-xs text-muted-foreground mt-2 flex gap-3 flex-wrap items-center">
                    {customer && (
                      <span className="flex items-center gap-1 text-sky-600 font-medium">
                        👤 {customer.display_name || "ไม่ระบุชื่อ"}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      🕐 รับงาน {format(new Date(t.created_at), "d MMM yyyy HH:mm น.", { locale: th })}
                    </span>
                    {creator && <span>โดย: {creator.display_name || creator.email}</span>}
                    {t.due_date && <span>กำหนดส่ง: {new Date(t.due_date).toLocaleString("th-TH")}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {assignee ? (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <UserCheck className="w-4 h-4" />
                      <span>{assignee.display_name || assignee.email}</span>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-slate-500">ยังไม่มีคนรับ</Badge>
                  )}
                  <div className="flex gap-2 flex-wrap justify-end">
                    {t.customer_id && goToCustomer && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-sky-300 text-sky-600 hover:bg-sky-50 gap-1.5"
                        onClick={() => goToCustomer(t.customer_id!)}
                        title="ไปดูแชทลูกค้า"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        แชท
                      </Button>
                    )}
                    {!t.assigned_to && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => { setClaimingTaskId(t.id); setClaimWorkType("solo"); }}
                      >
                        รับงาน
                      </Button>
                    )}
                    {isMine && (
                      <Select value={t.status} onValueChange={(v) => setPendingStatus({ id: t.id, status: v as Status })}>
                        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["in_progress", "done", "cancelled"] as Status[]).map((s) => (
                            <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Claim work type dialog */}
      <Dialog open={!!claimingTaskId} onOpenChange={(o) => { if (!o) setClaimingTaskId(null); }}>
        <DialogContent className="max-w-sm flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-base">เลือกรูปแบบงาน</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              type="button"
              onClick={() => setClaimWorkType("solo")}
              className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all ${
                claimWorkType === "solo"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="text-2xl">👤</span>
              <span className="text-sm font-bold">งานเดี่ยว</span>
              <span className="text-[11px] text-center opacity-70">ทำคนเดียวจบ</span>
            </button>
            <button
              type="button"
              onClick={() => setClaimWorkType("team")}
              className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all ${
                claimWorkType === "team"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="text-2xl">👥</span>
              <span className="text-sm font-bold">งานทีม</span>
              <span className="text-[11px] text-center opacity-70">ทำร่วมกันหลายคน</span>
            </button>
          </div>

          {claimWorkType === "team" && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">เลือกทีม</label>
              <Select value={claimTeamId} onValueChange={setClaimTeamId}>
                <SelectTrigger className="focus-visible:ring-emerald-500">
                  <SelectValue placeholder="เลือกทีมที่รับงานนี้..." />
                </SelectTrigger>
                <SelectContent>
                  {myTeams.length === 0
                    ? <SelectItem value="_none" disabled>คุณยังไม่ได้อยู่ในทีมใด</SelectItem>
                    : myTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setClaimingTaskId(null)}>ยกเลิก</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={confirmClaim}>
              ยืนยันรับงาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm status change dialog */}
      <AlertDialog open={!!pendingStatus} onOpenChange={(o) => { if (!o) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันเปลี่ยนสถานะ</AlertDialogTitle>
            <AlertDialogDescription>
              เปลี่ยนสถานะงานเป็น <strong>{pendingStatus ? statusLabel[pendingStatus.status] : ""}</strong> ใช่ไหม?
              {pendingStatus?.status !== "in_progress" && " ระบบจะแจ้งลูกค้าทาง LINE อัตโนมัติ"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (pendingStatus) updateStatus(pendingStatus.id, pendingStatus.status);
                setPendingStatus(null);
              }}
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
