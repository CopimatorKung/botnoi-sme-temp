import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  CalendarDays,
  FileText,
  Loader2,
  RotateCcw,
  UsersRound,
  Link as LinkIcon,
  MessageSquare,
  Copy,
  AlertCircle,
  Timer,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MemberProfileDialog } from "@/components/MemberProfileDialog";

type ReviewStatus = "done" | "approved" | "rejected" | "cancelled";

interface ReviewTask {
  id: string;
  title: string;
  description: string | null;
  status: ReviewStatus | string;
  assigned_to: string | null;
  customer_id: string | null;
  team_id: string | null;
  created_at: string;
  due_date?: string | null;
  attachments?: string[] | null;
  review_note?: string | null;
  reviewed_by?: string | null;
  // joined
  assignee_name?: string | null;
  customer_name?: string | null;
  team_name?: string | null;
  team_logo_url?: string | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "เมื่อกี้";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

function formatThaiDate(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function dueDateStatus(iso?: string | null): "overdue" | "soon" | "ok" | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 3 * 24 * 60 * 60 * 1000) return "soon"; // < 3 วัน
  return "ok";
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// แยก review_note ที่ format เป็น "ประเภทงาน: LINE OA — https://..." + บรรทัดอื่น
function parseReviewNote(note?: string | null) {
  if (!note) return { workType: null, workUrl: null, extraNote: null };
  const lines = note.split("\n");
  const m = lines[0].match(/^ประเภทงาน:\s*(.+?)(?:\s*—\s*(.+))?$/);
  if (m) {
    return {
      workType: m[1]?.trim() || null,
      workUrl: m[2]?.trim() || null,
      extraNote: lines.slice(1).join("\n").trim() || null,
    };
  }
  return { workType: null, workUrl: null, extraNote: note };
}

interface AdminReviewTabProps {
  goToTeam?: (teamId: string) => void;
}

export function AdminReviewTab({ goToTeam }: AdminReviewTabProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<ReviewTask | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [cancelActionTarget, setCancelActionTarget] = useState<ReviewTask | null>(null);
  const [cancelActionMode, setCancelActionMode] = useState<"reject_cancel" | "accept_cancel" | null>(null);
  const [cancelActionNote, setCancelActionNote] = useState("");
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<ReviewTask | null>(null);
  const [reassignMode, setReassignMode] = useState<"team" | "person">("person");
  const [reassignAssignee, setReassignAssignee] = useState<string>("__none__");
  const [reassignSearch, setReassignSearch] = useState("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTeam, setReassignTeam] = useState<string>("__none__");
  const [reassignTeamSearch, setReassignTeamSearch] = useState("");
  const [reassignTeamOpen, setReassignTeamOpen] = useState(false);
  const [allProfiles, setAllProfiles] = useState<{ id: string; display_name: string | null; email: string | null; avatar_url: string | null }[]>([]);
  const [profileViewTarget, setProfileViewTarget] = useState<string | null>(null);
  const [allTeams, setAllTeams] = useState<{ id: string; name: string }[]>([]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const baseSelect = "id, title, description, status, assigned_to, customer_id, team_id, created_at, due_date, review_note";

    // ลองดึงพร้อม attachments — ถ้า error fallback ไม่มี column พิเศษ
    let res = await supabase
      .from("tasks")
      .select(`${baseSelect}, attachments`)
      .in("status", ["done", "approved", "rejected", "cancelled"])
      .order("created_at", { ascending: false });

    if (res.error) {
      res = await supabase
        .from("tasks")
        .select(baseSelect)
        .in("status", ["done", "approved", "rejected", "cancelled"])
        .order("created_at", { ascending: false });
    }

    if (res.error) {
      // fallback สุดท้าย ไม่มี review_note
      res = await supabase
        .from("tasks")
        .select("id, title, description, status, assigned_to, customer_id, team_id, created_at")
        .in("status", ["done", "approved", "rejected", "cancelled"])
        .order("created_at", { ascending: false });
    }

    if (res.error) {
      toast.error("โหลดงานไม่สำเร็จ");
      setLoading(false);
      return;
    }

    const data = res.data;

    // ดึงชื่อ assignee, customer และ team
    const assigneeIds = [...new Set((data ?? []).map((t: any) => t.assigned_to).filter(Boolean))];
    const customerIds = [...new Set((data ?? []).map((t: any) => t.customer_id).filter(Boolean))];
    const teamIds     = [...new Set((data ?? []).map((t: any) => t.team_id).filter(Boolean))];

    const [{ data: profiles }, { data: customers }, { data: teams }] = await Promise.all([
      assigneeIds.length
        ? supabase.from("profiles").select("id, display_name, email").in("id", assigneeIds)
        : Promise.resolve({ data: [] }),
      customerIds.length
        ? supabase.from("customers").select("id, display_name").in("id", customerIds)
        : Promise.resolve({ data: [] }),
      teamIds.length
        ? supabase.from("teams" as any).select("id, name, logo_url").in("id", teamIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name || p.email]));
    const customerMap = Object.fromEntries((customers ?? []).map((c: any) => [c.id, c.display_name]));
    const teamMap = Object.fromEntries(((teams as any[]) ?? []).map((t: any) => [t.id, { name: t.name, logo_url: t.logo_url }]));

    setTasks(
      (data ?? [])
        // กรองงานยกเลิกที่แอดมินยืนยันแล้วออก — ไม่ต้องแสดงใน AdminReviewTab อีก
        .filter((t: any) => !(t.status === "cancelled" && t.review_note?.includes("แอดมินยืนยัน:")))
        .map((t: any) => ({
        ...t,
        assignee_name: profileMap[t.assigned_to] ?? null,
        customer_name: customerMap[t.customer_id] ?? null,
        team_name: t.team_id ? (teamMap[t.team_id]?.name ?? null) : null,
        team_logo_url: t.team_id ? (teamMap[t.team_id]?.logo_url ?? null) : null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.from("profiles").select("id, display_name, email, avatar_url").then(({ data }) => {
      if (data) setAllProfiles(data as any);
    });
    supabase.from("teams" as any).select("id, name").then(({ data }) => {
      if (data) setAllTeams(data as any);
    });
  }, []);

  useEffect(() => {
    fetchTasks();

    // Realtime — เมื่องาน done/approved/rejected เปลี่ยน
    const channel = supabase
      .channel("admin-review-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks]);

  // ส่ง notification ไปหาสมาชิกที่เกี่ยวข้อง
  const sendTaskNotification = async (task: ReviewTask, type: "approved" | "rejected", note?: string) => {
    const message = type === "approved"
      ? `✅ งาน "${task.title}" ผ่านการตรวจสอบแล้ว`
      : `❌ งาน "${task.title}" ไม่ผ่านการตรวจสอบ${note ? ` — ${note}` : ""} กรุณาดำเนินการต่อ`;

    // รวบรวม user_id ที่ต้องแจ้ง
    const userIds = new Set<string>();
    if (task.assigned_to) userIds.add(task.assigned_to);

    // ถ้าเป็นงานทีม ดึงสมาชิกทีมทั้งหมด
    if (task.team_id) {
      const { data: members } = await supabase
        .from("team_members" as any)
        .select("user_id")
        .eq("team_id", task.team_id);
      (members ?? []).forEach((m: any) => { if (m.user_id) userIds.add(m.user_id); });
    }

    if (userIds.size === 0) return;

    const notifications = Array.from(userIds).map((uid) => ({
      user_id: uid,
      type,
      task_id: task.id,
      message,
    }));

    const { error } = await supabase.from("notifications" as any).insert(notifications);
    if (error) {
      console.warn("[notify] insert error", error.message);
      toast.error(`ส่งแจ้งเตือนไม่สำเร็จ: ${error.message}`);
    }
  };

  const approve = async (task: ReviewTask) => {
    setProcessing(task.id);
    const { error } = await supabase
      .from("tasks")
      .update({ status: "approved" } as any)
      .eq("id", task.id);

    if (error) { setProcessing(null); toast.error(error.message); return; }

    await sendTaskNotification(task, "approved");
    setProcessing(null);
    toast.success(`✅ อนุมัติงาน "${task.title}" แล้ว`);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: "approved" } : t));
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setProcessing(rejectTarget.id);
    // ส่งกลับเป็น in_progress ให้ member แก้ไขต่อ
    const { error } = await supabase
      .from("tasks")
      .update({ status: "in_progress" } as any)
      .eq("id", rejectTarget.id);

    if (error) { setProcessing(null); toast.error(error.message); return; }

    await sendTaskNotification(rejectTarget, "rejected", rejectNote.trim() || undefined);
    setProcessing(null);
    toast.success(`🔄 ส่งกลับงาน "${rejectTarget.title}" ให้แก้ไขแล้ว`);
    // ลบออกจากรายการ (เปลี่ยนไปเป็น in_progress แล้ว)
    setTasks((prev) => prev.filter((t) => t.id !== rejectTarget.id));
    setRejectTarget(null);
    setRejectNote("");
  };

  const sendBack = async (task: ReviewTask) => {
    setProcessing(task.id);
    const { error } = await supabase
      .from("tasks")
      .update({ status: "in_progress" } as any)
      .eq("id", task.id);

    setProcessing(null);
    if (error) { toast.error(error.message); return; }
    await sendTaskNotification(task, "rejected");
    toast.success("ส่งงานกลับให้ดำเนินการต่อแล้ว");
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
  };

  // ตีกลับ = ไม่ยอมให้ยกเลิก → เปิดงานใหม่เป็น in_progress
  // ตกลง = ยืนยันการยกเลิก → บันทึก note ของแอดมิน
  const handleCancelAction = async () => {
    if (!cancelActionTarget || !cancelActionMode) return;
    if (!cancelActionNote.trim()) { toast.error("กรุณาเขียนความคิดเห็นก่อน"); return; }
    setProcessing(cancelActionTarget.id);

    if (cancelActionMode === "reject_cancel") {
      // ตีกลับ — เปิดงานใหม่
      const { error } = await supabase.from("tasks").update({
        status: "in_progress",
        review_note: `ตีกลับโดยแอดมิน: ${cancelActionNote.trim()}`,
      } as any).eq("id", cancelActionTarget.id);
      if (error) { setProcessing(null); toast.error(error.message); return; }
      await sendTaskNotification(cancelActionTarget, "rejected", `ตีกลับการยกเลิก — ${cancelActionNote.trim()}`);
      toast.success(`🔄 ตีกลับงาน "${cancelActionTarget.title}" แล้ว`);
      setTasks((prev) => prev.filter((t) => t.id !== cancelActionTarget.id));
    } else {
      // ตกลง — ยืนยันยกเลิก เก็บ note ของแอดมิน
      const { error } = await supabase.from("tasks").update({
        review_note: `${cancelActionTarget.review_note ? cancelActionTarget.review_note + "\n" : ""}แอดมินยืนยัน: ${cancelActionNote.trim()}`,
      } as any).eq("id", cancelActionTarget.id);
      if (error) { setProcessing(null); toast.error(error.message); return; }

      // แจ้งผู้รับงานและสมาชิกทีม
      const userIds = new Set<string>();
      if (cancelActionTarget.assigned_to) userIds.add(cancelActionTarget.assigned_to);
      if (cancelActionTarget.team_id) {
        const { data: members } = await supabase
          .from("team_members" as any).select("user_id").eq("team_id", cancelActionTarget.team_id);
        (members ?? []).forEach((m: any) => { if (m.user_id) userIds.add(m.user_id); });
      }
      if (userIds.size > 0) {
        await supabase.from("notifications" as any).insert(
          Array.from(userIds).map((uid) => ({
            user_id: uid,
            type: "rejected",
            task_id: cancelActionTarget.id,
            message: `❌ แอดมินยืนยันการยกเลิกงาน "${cancelActionTarget.title}" — ${cancelActionNote.trim()}`,
          }))
        );
      }

      toast.success(`✅ ยืนยันการยกเลิกงาน "${cancelActionTarget.title}" แล้ว`);
      setTasks((prev) => prev.filter((t) => t.id !== cancelActionTarget.id));
    }

    setProcessing(null);
    setCancelActionTarget(null);
    setCancelActionMode(null);
    setCancelActionNote("");
  };

  // ย้ายงานให้คนอื่น หรือย้ายทีม (จากงานยกเลิก)
  const handleReassign = async () => {
    if (!reassignTarget) return;
    if (reassignMode === "person" && reassignAssignee === "__none__") { toast.error("กรุณาเลือกคนรับงาน"); return; }
    if (reassignMode === "team" && reassignTeam === "__none__") { toast.error("กรุณาเลือกทีม"); return; }
    setProcessing(reassignTarget.id);
    const updatePayload = reassignMode === "person"
      ? { status: "in_progress", assigned_to: reassignAssignee, team_id: null, review_note: null }
      : { status: "in_progress", team_id: reassignTeam, assigned_to: null, review_note: null };
    const { error } = await supabase.from("tasks").update(updatePayload as any).eq("id", reassignTarget.id);
    setProcessing(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`🔄 ย้ายงาน "${reassignTarget.title}" แล้ว`);
    setTasks((prev) => prev.filter((t) => t.id !== reassignTarget.id));
    setReassignTarget(null);
    setReassignAssignee("__none__");
    setReassignTeam("__none__");
  };

  const pending   = tasks.filter((t) => t.status === "done");
  const reviewed  = tasks.filter((t) => t.status === "approved");
  const cancelled = tasks.filter((t) => t.status === "cancelled");

  const TaskCard = ({ task }: { task: ReviewTask }) => {
    const isProcessing = processing === task.id;
    const isApproved   = task.status === "approved";
    const isRejected   = task.status === "rejected";
    const isCancelled  = task.status === "cancelled";
    const { workType, workUrl, extraNote } = parseReviewNote(task.review_note);

    return (
      <div className={cn(
        "rounded-xl border bg-card p-4 space-y-3 transition-all",
        isApproved  && "border-green-200 bg-green-50/40 dark:border-green-800 dark:bg-green-950/20",
        isRejected  && "border-red-200 bg-red-50/40 dark:border-red-800 dark:bg-red-950/20",
        isCancelled && "border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30 opacity-75",
      )}>
        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar className="w-9 h-9 shrink-0 mt-0.5">
            {task.team_logo_url && (
              <AvatarImage src={task.team_logo_url} alt={task.team_name ?? "team"} className="object-cover" />
            )}
            <AvatarFallback className="text-xs font-semibold bg-emerald-100 text-emerald-700">
              {task.team_name?.[0]?.toUpperCase() ?? initials(task.assignee_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm leading-tight">{task.title}</p>
              {isApproved && (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-0.5" /> อนุมัติแล้ว
                </Badge>
              )}
              {isRejected && (
                <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                  <XCircle className="w-3 h-3 mr-0.5" /> ไม่ผ่าน
                </Badge>
              )}
              {isCancelled && (
                <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">
                  <XCircle className="w-3 h-3 mr-0.5" /> ยกเลิกแล้ว
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {/* ทีมขึ้นก่อน (ถ้ามี) */}
              {task.team_name && (
                <button
                  className="flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full px-2 py-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors group"
                  title={goToTeam ? "คลิกเพื่อไปหน้าทีม" : "คลิกเพื่อคัดลอก"}
                  onClick={() => {
                    if (goToTeam && task.team_id) {
                      goToTeam(task.team_id);
                    } else {
                      navigator.clipboard.writeText(task.team_name!);
                      toast.success(`คัดลอก "${task.team_name}" แล้ว`);
                    }
                  }}
                >
                  <UsersRound className="w-3 h-3" />
                  {task.team_name}
                  <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
              )}
              {/* ผู้รับงาน — แสดงเสมอถ้ามี (ทั้งงานทีมและงานเดี่ยว) */}
              {task.assignee_name && (
                <button
                  className="flex items-center gap-1 text-xs bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-full px-2 py-0.5 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors font-medium"
                  title="คลิกเพื่อดูโปรไฟล์"
                  onClick={() => task.assigned_to && setProfileViewTarget(task.assigned_to)}
                >
                  <User className="w-3 h-3" />
                  {task.assignee_name}
                </button>
              )}
              {task.customer_name && (
                <button
                  className="flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors group"
                  title="คลิกเพื่อคัดลอก"
                  onClick={() => { navigator.clipboard.writeText(task.customer_name!); toast.success(`คัดลอก "${task.customer_name}" แล้ว`); }}
                >
                  <User className="w-3 h-3" />
                  {task.customer_name}
                  <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground" title={formatThaiDate(task.created_at)}>
                <CalendarDays className="w-3 h-3" />
                {timeAgo(task.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Metadata bar — วันที่สร้าง / กำหนดส่ง / สถานะ */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-2">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="text-foreground/60">สร้างงาน:</span>
            <span>{formatThaiDate(task.created_at)}</span>
          </span>
          {task.due_date && (() => {
            const ds = dueDateStatus(task.due_date);
            return (
              <span className={`flex items-center gap-1 font-medium ${
                ds === "overdue" ? "text-red-600" :
                ds === "soon" ? "text-amber-600" : "text-muted-foreground"
              }`}>
                {ds === "overdue"
                  ? <AlertCircle className="w-3 h-3 shrink-0" />
                  : <Timer className="w-3 h-3 shrink-0" />}
                <span className="text-foreground/60">กำหนดส่ง:</span>
                <span>{formatThaiDate(task.due_date)}</span>
                {ds === "overdue" && <span className="text-[10px] bg-red-100 text-red-600 rounded px-1">เกินกำหนด</span>}
                {ds === "soon" && <span className="text-[10px] bg-amber-100 text-amber-600 rounded px-1">ใกล้ครบ</span>}
              </span>
            );
          })()}
        </div>

        {/* Description */}
        {task.description && (
          <div className="flex gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p className="whitespace-pre-line leading-relaxed">{task.description}</p>
          </div>
        )}

        {/* Attachments */}
        {task.attachments && task.attachments.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">ไฟล์แนบ ({task.attachments.length})</p>
            <div className="flex flex-wrap gap-2">
              {task.attachments.map((url, i) => {
                const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
                return isImage ? (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} className="w-20 h-16 rounded-md object-cover border hover:opacity-80 transition-opacity" />
                  </a>
                ) : (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary border rounded-md px-3 py-2 hover:bg-muted transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    ไฟล์ {i + 1}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ประเภทงาน + URL */}
        {(workType || workUrl) && (
          <div className="flex flex-wrap gap-2 items-center">
            {workType && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full px-2.5 py-0.5">
                {workType}
              </span>
            )}
            {workUrl && (
              <a
                href={workUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-[280px]"
              >
                <LinkIcon className="w-3 h-3 shrink-0" />
                {workUrl}
              </a>
            )}
          </div>
        )}

        {/* หมายเหตุ / เหตุผลยกเลิก */}
        {extraNote && (
          <div className={`flex gap-2 text-xs rounded-lg px-3 py-2 ${
            isCancelled
              ? "bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              : "bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-400"
          }`}>
            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p className="whitespace-pre-line">{extraNote}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {task.status === "done" && (
            <>
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5"
                disabled={isProcessing}
                onClick={() => approve(task)}
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                อนุมัติ
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-1.5"
                disabled={isProcessing}
                onClick={() => { setRejectTarget(task); setRejectNote(""); }}
              >
                <XCircle className="w-3.5 h-3.5" /> ไม่ผ่าน
              </Button>
            </>
          )}
          {(isApproved || isRejected) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground gap-1.5"
              disabled={isProcessing}
              onClick={() => sendBack(task)}
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              ส่งกลับดำเนินการ
            </Button>
          )}
          {isCancelled && (
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
                  disabled={isProcessing}
                  onClick={() => { setCancelActionTarget(task); setCancelActionMode("reject_cancel"); setCancelActionNote(""); }}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> ตีกลับ
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white gap-1.5"
                  disabled={isProcessing}
                  onClick={() => { setCancelActionTarget(task); setCancelActionMode("accept_cancel"); setCancelActionNote(""); }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> ตกลง
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1.5"
                disabled={isProcessing}
                onClick={() => { setReassignTarget(task); setReassignAssignee("__none__"); }}
              >
                <UserCheck className="w-3.5 h-3.5" /> ย้ายงานให้คนอื่น
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>กำลังโหลด...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">ตรวจสอบงาน</h2>
        <p className="text-sm text-muted-foreground mt-1">
          งานที่สมาชิกทำเสร็จแล้วและรอแอดมินตรวจสอบ
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            รอตรวจสอบ
            {pending.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ตรวจแล้ว
            {reviewed.length > 0 && (
              <span className="ml-1 bg-muted-foreground/30 text-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {reviewed.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            ยกเลิก
            {cancelled.length > 0 && (
              <span className="ml-1 bg-slate-400 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cancelled.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pending.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">ไม่มีงานรอตรวจสอบ</p>
              <p className="text-sm mt-1">งานที่สมาชิกกด "เสร็จแล้ว" จะมาแสดงที่นี่</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviewed" className="mt-4">
          {reviewed.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">ยังไม่มีประวัติการตรวจ</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reviewed.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4">
          {cancelled.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <XCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">ไม่มีงานที่ถูกยกเลิก</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cancelled.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Cancel action dialog (ตีกลับ / ตกลง) */}
      <Dialog open={!!cancelActionTarget} onOpenChange={(o) => { if (!o) { setCancelActionTarget(null); setCancelActionMode(null); setCancelActionNote(""); } }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {cancelActionMode === "reject_cancel"
                ? <><RotateCcw className="w-4 h-4 text-amber-600" /> ตีกลับ (ไม่ยอมให้ยกเลิก)</>
                : <><CheckCircle2 className="w-4 h-4 text-slate-600" /> ยืนยันการยกเลิก</>
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              งาน: <span className="font-medium text-foreground">{cancelActionTarget?.title}</span>
            </p>
            {cancelActionMode === "reject_cancel" ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                งานจะถูกเปิดใหม่และส่งกลับให้สมาชิกดำเนินการต่อ
              </p>
            ) : (
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                ยืนยันว่าการยกเลิกงานนี้เป็นที่ยอมรับ
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                ความคิดเห็น <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder={cancelActionMode === "reject_cancel"
                  ? "เช่น งานนี้ยังสำคัญ กรุณาดำเนินการต่อ..."
                  : "เช่น รับทราบการยกเลิก เนื่องจาก..."}
                value={cancelActionNote}
                onChange={(e) => setCancelActionNote(e.target.value)}
                rows={3}
                className={!cancelActionNote.trim() ? "border-red-200 focus-visible:ring-red-400" : ""}
              />
              {!cancelActionNote.trim() && (
                <p className="text-xs text-red-500">* กรุณาเขียนความคิดเห็นก่อน</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelActionTarget(null); setCancelActionMode(null); setCancelActionNote(""); }}>
              ปิด
            </Button>
            <Button
              className={cancelActionMode === "reject_cancel"
                ? "bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                : "bg-slate-600 hover:bg-slate-700 text-white gap-1.5"}
              disabled={!cancelActionNote.trim() || !!processing}
              onClick={() => {
                if (cancelActionMode === "accept_cancel") {
                  setShowAcceptConfirm(true);
                } else {
                  handleCancelAction();
                }
              }}
            >
              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : cancelActionMode === "reject_cancel"
                ? <><RotateCcw className="w-3.5 h-3.5" /> ตีกลับ</>
                : <><CheckCircle2 className="w-3.5 h-3.5" /> ยืนยันตกลง</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign dialog */}
      <Dialog open={!!reassignTarget} onOpenChange={(o) => { if (!o) { setReassignTarget(null); setReassignAssignee("__none__"); setReassignTeam("__none__"); setReassignSearch(""); setReassignTeamSearch(""); } }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" /> ย้ายงาน
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              งาน: <span className="font-medium text-foreground">{reassignTarget?.title}</span>
            </p>

            {/* Toggle: ทีม หรือ รายบุคคล */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "person", label: "รายบุคคล",   sub: "มอบหมายให้คนเลย" },
                { key: "team",   label: "กลุ่ม / ทีม", sub: "โพสให้ทีมมารับ"  },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => { setReassignMode(opt.key); setReassignAssignee("__none__"); setReassignTeam("__none__"); setReassignSearch(""); setReassignTeamSearch(""); }}
                  className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    reassignMode === opt.key
                      ? "border-emerald-500 bg-emerald-50/60 text-emerald-800"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-[11px] opacity-60">{opt.sub}</span>
                </button>
              ))}
            </div>

            {/* Combobox ตาม mode */}
            {reassignMode === "person" ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">เลือกคนรับงาน <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={
                      reassignAssignee === "__none__"
                        ? "พิมพ์ชื่อเพื่อค้นหา..."
                        : (allProfiles.find((p) => p.id === reassignAssignee)?.display_name || allProfiles.find((p) => p.id === reassignAssignee)?.email || "พิมพ์ชื่อเพื่อค้นหา...")
                    }
                    value={reassignSearch}
                    onChange={(e) => { setReassignSearch(e.target.value); setReassignOpen(true); }}
                    onFocus={() => setReassignOpen(true)}
                    onBlur={() => setTimeout(() => setReassignOpen(false), 150)}
                    className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:border-primary transition"
                  />
                  {reassignOpen && (
                    <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-background shadow-md max-h-48 overflow-y-auto">
                      {allProfiles
                        .filter((p) => !reassignSearch.trim() || (p.display_name || p.email || "").toLowerCase().includes(reassignSearch.toLowerCase()))
                        .map((p) => (
                          <button key={p.id} type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${reassignAssignee === p.id ? "font-semibold text-primary" : ""}`}
                            onMouseDown={() => { setReassignAssignee(p.id); setReassignSearch(""); setReassignOpen(false); }}
                          >
                            {p.display_name || p.email}
                          </button>
                        ))}
                      {allProfiles.filter((p) => !reassignSearch.trim() || (p.display_name || p.email || "").toLowerCase().includes(reassignSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">ไม่พบสมาชิก</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">เลือกทีม <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={
                      reassignTeam === "__none__"
                        ? "พิมพ์ชื่อทีมเพื่อค้นหา..."
                        : (allTeams.find((t) => t.id === reassignTeam)?.name || "พิมพ์ชื่อทีมเพื่อค้นหา...")
                    }
                    value={reassignTeamSearch}
                    onChange={(e) => { setReassignTeamSearch(e.target.value); setReassignTeamOpen(true); }}
                    onFocus={() => setReassignTeamOpen(true)}
                    onBlur={() => setTimeout(() => setReassignTeamOpen(false), 150)}
                    className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:border-primary transition"
                  />
                  {reassignTeamOpen && (
                    <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-background shadow-md max-h-48 overflow-y-auto">
                      {allTeams
                        .filter((t) => !reassignTeamSearch.trim() || t.name.toLowerCase().includes(reassignTeamSearch.toLowerCase()))
                        .map((t) => (
                          <button key={t.id} type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${reassignTeam === t.id ? "font-semibold text-primary" : ""}`}
                            onMouseDown={() => { setReassignTeam(t.id); setReassignTeamSearch(""); setReassignTeamOpen(false); }}
                          >
                            {t.name}
                          </button>
                        ))}
                      {allTeams.filter((t) => !reassignTeamSearch.trim() || t.name.toLowerCase().includes(reassignTeamSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">ไม่พบทีม</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
              สถานะจะเปลี่ยนเป็น กำลังทำ
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReassignTarget(null); setReassignAssignee("__none__"); setReassignTeam("__none__"); setReassignSearch(""); setReassignTeamSearch(""); }}>
              ยกเลิก
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              disabled={(reassignMode === "person" ? reassignAssignee === "__none__" : reassignTeam === "__none__") || !!processing}
              onClick={handleReassign}
            >
              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
              ย้ายงาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm accept cancel */}
      <AlertDialog open={showAcceptConfirm} onOpenChange={setShowAcceptConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการยกเลิกงาน</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการยืนยันการยกเลิกงาน <strong>{cancelActionTarget?.title}</strong>?
              การดำเนินการนี้จะบันทึกการยกเลิกถาวร
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowAcceptConfirm(false)}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-slate-600 hover:bg-slate-700 text-white"
              onClick={() => { setShowAcceptConfirm(false); handleCancelAction(); }}
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile view dialog */}
      <MemberProfileDialog
        userId={profileViewTarget}
        onClose={() => setProfileViewTarget(null)}
      />

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              ส่งงานกลับ
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              งาน: <span className="font-medium text-foreground">{rejectTarget?.title}</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">เหตุผล / ข้อแนะนำ (ถ้ามี)</label>
              <Textarea
                placeholder="เช่น ข้อมูลยังไม่ครบ กรุณาเพิ่มเติม..."
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>ยกเลิก</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
              disabled={!!processing}
              onClick={reject}
            >
              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              ส่งกลับ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
