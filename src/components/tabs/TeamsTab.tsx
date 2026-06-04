import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronUp, UserPlus, X, Users, Briefcase, ClipboardList, Pencil, ChevronRight, ArrowLeft, CheckCircle2, Clock, XCircle, Link as LinkIcon, BarChart3 } from "lucide-react";
import { UserProfileViewDialog } from "@/components/UserProfileViewDialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

interface Team {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  tags: string[] | null;
  logo_url?: string | null;
}

const SME_TAGS = Array.from({ length: 20 }, (_, i) => `#SME${String(i + 1).padStart(2, "0")}`);

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  position: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface TaskSummary {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  team_id: string | null;
  review_note?: string | null;
  created_at?: string;
}

const POSITION_LABEL: Record<string, string> = {
  leader: "หัวหน้าทีม",
  member: "สมาชิก",
};
const POSITION_STYLE: Record<string, string> = {
  leader: "bg-amber-100 text-amber-700 border-amber-200",
  member: "bg-slate-100 text-slate-600 border-slate-200",
};

interface TeamsTabProps {
  initialTeamId?: string | null;
  clearInitialTeam?: () => void;
}

export function TeamsTab({ initialTeamId, clearInitialTeam }: TeamsTabProps) {
  const { user, role } = useAuth();
  const canManage = role === "team_leader" || role === "admin" || role === "ceo" || role === "developer";

  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberRoleIds, setMemberRoleIds] = useState<Set<string>>(new Set());
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTag, setNewTag] = useState<string>("");
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [newLogoPreview, setNewLogoPreview] = useState<string | null>(null);
  const newLogoRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTag, setEditTag] = useState("");
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const editLogoRef = useRef<HTMLInputElement>(null);
  const [updating, setUpdating] = useState(false);

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // Swap leader confirmation
  const [swapTarget, setSwapTarget] = useState<{
    memberId: string; teamId: string;
    newLeaderName: string; oldLeaderName: string;
  } | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [teamDoneTasks, setTeamDoneTasks] = useState<TaskSummary[]>([]);
  const [chartPeriod, setChartPeriod] = useState<"7d" | "1m" | "3m" | "6m" | "1y" | "custom">("1m");
  const [chartFrom, setChartFrom] = useState("");
  const [chartTo, setChartTo] = useState("");
  const [addingToTeam, setAddingToTeam] = useState<string | null>(null);
  const [inviteDialogTeamId, setInviteDialogTeamId] = useState<string | null>(null);
  const [inviteSearch, setInviteSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<Record<string, "all" | "team" | "solo">>({});
  const [selectedUserId, setSelectedUserId] = useState("");

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  useEffect(() => { loadAll(); }, []);

  // เมื่อมี initialTeamId จาก Dashboard (เช่น กดจาก AdminReviewTab)
  useEffect(() => {
    if (!initialTeamId || teams.length === 0) return;
    const target = teams.find((t) => t.id === initialTeamId);
    if (target) {
      setSelectedTeam(target);
      clearInitialTeam?.();
    }
  }, [initialTeamId, teams]);

  // โหลดงาน approved ของทีมที่เลือก
  useEffect(() => {
    if (!selectedTeam) { setTeamDoneTasks([]); return; }
    supabase
      .from("tasks")
      .select("id, title, status, assigned_to, team_id, review_note, created_at")
      .eq("team_id", selectedTeam.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data }) => setTeamDoneTasks((data as TaskSummary[]) ?? []));
  }, [selectedTeam]);

  const loadAll = async () => {
    const [{ data: t }, { data: m }, { data: p }, { data: ur }, { data: tk }] = await Promise.all([
      supabase.from("teams").select("*").order("created_at", { ascending: false }),
      supabase.from("team_members").select("*"),
      supabase.from("profiles").select("id,display_name,email,avatar_url"),
      supabase.from("user_roles").select("user_id,role").eq("role", "member"),
      supabase.from("tasks").select("id,title,status,assigned_to,team_id").not("status", "in", '("done","cancelled")'),
    ]);
    setTeams((t as Team[]) || []);
    setMembers((m as TeamMember[]) || []);
    setProfiles(p || []);
    setMemberRoleIds(new Set((ur || []).map((r: { user_id: string }) => r.user_id)));
    setTasks((tk as TaskSummary[]) || []);
  };

  const createTeam = async () => {
    if (!newName.trim()) { toast.error("กรุณาใส่ชื่อทีม"); return; }
    if (!newTag) { toast.error("กรุณาเลือกประเภท SME"); return; }
    setCreating(true);

    const { data: team, error } = await supabase
      .from("teams")
      .insert({ name: newName.trim(), description: newDesc.trim() || null, created_by: user!.id, tags: newTag ? [newTag] : null })
      .select()
      .single();
    if (error) { toast.error(error.message); setCreating(false); return; }

    // Upload logo ถ้ามี
    if (newLogoFile) {
      const path = `team-logos/${team.id}/${Date.now()}_${newLogoFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("task-attachments").upload(path, newLogoFile, { upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("task-attachments").getPublicUrl(path);
        if (urlData?.publicUrl) {
          await supabase.from("teams").update({ logo_url: urlData.publicUrl } as any).eq("id", team.id);
        }
      }
    }

    await supabase.from("team_members").insert({ team_id: team.id, user_id: user!.id, position: "leader" });
    toast.success("สร้างทีมแล้ว");
    setCreateOpen(false);
    setNewName("");
    setNewDesc("");
    setNewTag("");
    setNewLogoFile(null);
    setNewLogoPreview(null);
    setCreating(false);
    loadAll();
  };

  const openEdit = (team: Team) => {
    setEditTeam(team);
    setEditName(team.name);
    setEditDesc(team.description ?? "");
    setEditTag(team.tags?.[0] ?? "");
    setEditLogoPreview(team.logo_url ?? null);
    setEditLogoFile(null);
    setEditOpen(true);
  };

  const updateTeam = async () => {
    if (!editTeam || !editName.trim()) { toast.error("กรุณาใส่ชื่อทีม"); return; }
    if (!editTag) { toast.error("กรุณาเลือกประเภท SME"); return; }
    setUpdating(true);

    // Upload logo ถ้ามีไฟล์ใหม่
    let logo_url: string | null = editLogoPreview ?? null;
    if (editLogoFile) {
      const path = `team-logos/${editTeam.id}/${Date.now()}_${editLogoFile.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("task-attachments")
        .upload(path, editLogoFile, { upsert: true });
      if (uploadErr) {
        toast.error("อัปโหลดรูปไม่สำเร็จ: " + uploadErr.message);
        setUpdating(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("task-attachments").getPublicUrl(path);
      logo_url = urlData?.publicUrl ?? null;
    }

    const { error } = await supabase.from("teams").update({
      name: editName.trim(),
      description: editDesc.trim() || null,
      tags: [editTag],
      logo_url,
    } as any).eq("id", editTeam.id);
    setUpdating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("แก้ไขทีมแล้ว");
    setEditOpen(false);
    setEditTeam(null);
    loadAll();
  };

  const deleteTeam = async (teamId: string) => {
    // งานที่อยู่ระหว่าง open/in_progress ในทีมนี้ → ปล่อยเป็นงานอิสระ (ทุกคนรับได้)
    await supabase
      .from("tasks")
      .update({ team_id: null, assigned_to: null, status: "open" } as any)
      .eq("team_id", teamId)
      .in("status", ["open", "in_progress"]);

    const { error } = await supabase.from("teams").delete().eq("id", teamId);
    if (error) toast.error(error.message);
    else { toast.success("ลบทีมแล้ว งานที่ค้างอยู่ถูกคืนสู่บอร์ดกลาง"); loadAll(); }
  };

  const addMember = async (teamId: string) => {
    if (!selectedUserId) return;
    const { error } = await supabase.from("team_invitations" as any).insert({
      team_id: teamId, invited_user_id: selectedUserId, invited_by: user!.id, status: "pending",
    });
    if (error) toast.error(error.message.includes("duplicate") ? "ส่งคำเชิญไปแล้ว รอการตอบรับ" : error.message);
    else { toast.success("ส่งคำเชิญแล้ว รอผู้ใช้ยอมรับ"); setSelectedUserId(""); setAddingToTeam(null); }
  };

  const removeMember = async (memberId: string) => {
    // ห้ามลบหัวหน้าทีมออกตรงๆ ไม่ว่าใครก็ตาม (รวม admin/ceo/developer)
    // ต้องโอนตำแหน่งหัวหน้าให้คนอื่นก่อน
    const { data: memberRow } = await supabase
      .from("team_members" as any)
      .select("position")
      .eq("id", memberId)
      .single();
    if (memberRow && (memberRow as any).position === "leader") {
      toast.error("กรุณาตั้งหัวหน้าทีมคนใหม่ก่อน จึงจะนำหัวหน้าออกจากทีมได้");
      return;
    }

    // งานที่คนนั้นรับไว้จะคงอยู่เหมือนเดิม (assignee + สถานะไม่เปลี่ยน)
    const { error } = await supabase.from("team_members").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("นำออกแล้ว"); loadAll(); }
  };

  // เปลี่ยนตำแหน่ง — ห้ามปลดหัวหน้าเป็นสมาชิกถ้าไม่มีหัวหน้าคนอื่น
  const changePosition = async (memberId: string, teamId: string, position: string) => {
    if (position !== "leader") {
      const target = members.find((m) => m.id === memberId);
      if (target?.position === "leader") {
        const otherLeaders = members.filter(
          (m) => m.team_id === teamId && m.position === "leader" && m.id !== memberId
        );
        if (otherLeaders.length === 0) {
          toast.error("ต้องมีหัวหน้าทีมอย่างน้อย 1 คน — กรุณาตั้งหัวหน้าใหม่ก่อน");
          return;
        }
      }
    }
    const { error } = await supabase.from("team_members").update({ position }).eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("เปลี่ยนตำแหน่งแล้ว"); loadAll(); }
  };

  // เตรียม confirm ก่อน swap leader
  const prepareSwapLeader = (memberId: string, teamId: string) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const currentLeader = members.find((m) => m.team_id === teamId && m.position === "leader");
    const getname = (uid: string) => {
      const p = profiles.find((p) => p.id === uid);
      return p?.display_name || p?.email || uid;
    };
    setSwapTarget({
      memberId,
      teamId,
      newLeaderName: getname(target.user_id),
      oldLeaderName: currentLeader ? getname(currentLeader.user_id) : "",
    });
  };

  // ยืนยัน swap — เรียก RPC ที่ bypass RLS
  const confirmSwapLeader = async () => {
    if (!swapTarget) return;
    setSwapping(true);
    const { error } = await (supabase as any).rpc("swap_team_leader", {
      p_team_id: swapTarget.teamId,
      p_new_leader_member_id: swapTarget.memberId,
    });
    setSwapping(false);
    setSwapTarget(null);
    if (error) { toast.error("สลับหัวหน้าไม่สำเร็จ: " + error.message); return; }
    toast.success(`✅ ${swapTarget.newLeaderName} เป็นหัวหน้าทีมแล้ว`);
    loadAll();
  };

  // ─── Team Detail View ──────────────────────────────────────────────────
  if (selectedTeam) {
    const team = selectedTeam;
    const teamMembers = members
      .filter((m) => m.team_id === team.id)
      .sort((a, b) => (a.position === "leader" ? -1 : 1) - (b.position === "leader" ? -1 : 1));
    const teamTasks = tasks.filter((t) => t.team_id === team.id);
    const waitingTasks = teamTasks.filter((t) => t.status === "open" && !t.assigned_to);
    const activeTasks = teamTasks.filter((t) => t.status === "in_progress");
    const memberUserIds = new Set(teamMembers.map((m) => m.user_id));
    const soloTasks = tasks.filter((t) => !t.team_id && t.assigned_to && memberUserIds.has(t.assigned_to));
    const isCreator = team.created_by === user?.id;
    const isLeaderOf = teamMembers.some((m) => m.user_id === user?.id && m.position === "leader");
    const canEdit = canManage && (isCreator || isLeaderOf || role === "admin" || role === "ceo" || role === "developer");

    const statusIcon = (s: string) => {
      if (s === "in_progress") return <Clock className="w-3 h-3 text-yellow-500" />;
      if (s === "done") return <CheckCircle2 className="w-3 h-3 text-green-500" />;
      if (s === "cancelled") return <XCircle className="w-3 h-3 text-gray-400" />;
      return <Clock className="w-3 h-3 text-blue-400" />;
    };
    const statusLabel = (s: string) => ({
      open: "รอรับ", in_progress: "กำลังทำ", done: "รอตรวจสอบ", cancelled: "ยกเลิก",
    }[s] ?? s);
    const statusColor = (s: string) => ({
      open: "bg-blue-50 text-blue-600",
      in_progress: "bg-yellow-50 text-yellow-700",
      done: "bg-amber-50 text-amber-700",
      cancelled: "bg-gray-50 text-gray-500",
    }[s] ?? "bg-gray-50 text-gray-500");

    return (
      <div className="space-y-4">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedTeam(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับ
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base leading-tight">{team.name}</h2>
                {team.tags?.[0] && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    {team.tags[0]}
                  </span>
                )}
              </div>
              {team.description && (
                <p className="text-xs text-muted-foreground truncate">{team.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => openEdit(team)}>
                <Pencil className="w-3.5 h-3.5" /> แก้ไข
              </Button>
            )}
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                onClick={() => { setInviteDialogTeamId(team.id); setSelectedUserId(""); }}
              >
                <UserPlus className="w-3.5 h-3.5" /> เพิ่มสมาชิก
              </Button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "สมาชิก", value: teamMembers.length, color: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
            { label: "รอรับงาน", value: waitingTasks.length, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
            { label: "กำลังทำ", value: activeTasks.length + soloTasks.length, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 text-center ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Members */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <p className="text-sm font-semibold">สมาชิก ({teamMembers.length} คน)</p>
          </div>
          {teamMembers.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
              ยังไม่มีสมาชิก
            </div>
          ) : (
            <div className="divide-y">
              {teamMembers.map((m) => {
                const profile = profileMap[m.user_id];
                const mTeamTasks = activeTasks.filter((t) => t.team_id === team.id);
                const mSoloTasks = tasks.filter((t) => t.assigned_to === m.user_id && !t.team_id);
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setViewingUserId(m.user_id)}
                      className="flex items-center gap-3 min-w-0 text-left hover:opacity-70 transition-opacity flex-1"
                      title="คลิกเพื่อดูโปรไฟล์"
                    >
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarImage src={profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs font-semibold">
                          {profile?.display_name?.[0] || profile?.email?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {profile?.display_name || profile?.email || m.user_id}
                          {m.user_id === user?.id && <span className="text-xs text-muted-foreground ml-1">(คุณ)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {mTeamTasks.length > 0 && (
                        <span className="text-[10px] bg-blue-100 text-blue-600 font-semibold px-1.5 py-0.5 rounded-full">
                          👥 {mTeamTasks.length} งานทีม
                        </span>
                      )}
                      {mSoloTasks.length > 0 && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded-full">
                          👤 {mSoloTasks.length} งานเดี่ยว
                        </span>
                      )}
                    </div>
                    {canEdit && !(m.user_id === user?.id && m.position === "leader") ? (
                      <Select value={m.position} onValueChange={(v) => {
                          if (v === "leader") prepareSwapLeader(m.id, team.id);
                          else changePosition(m.id, team.id, v);
                        }}>
                        <SelectTrigger className={`h-7 w-28 text-[11px] border ${POSITION_STYLE[m.position] || POSITION_STYLE.member}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(role === "admin" || role === "ceo" || role === "developer" || teamMembers.some((tm) => tm.user_id === user?.id && tm.position === "leader")) && (
                            <SelectItem value="leader">หัวหน้าทีม</SelectItem>
                          )}
                          <SelectItem value="member">สมาชิก</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={`text-[11px] ${POSITION_STYLE[m.position] || POSITION_STYLE.member}`}>
                        {POSITION_LABEL[m.position] || m.position}
                      </Badge>
                    )}
                    {canEdit && !(m.user_id === user?.id && m.position === "leader") && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 p-1"
                        title="นำออกจากทีม"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Team tasks */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-sm font-semibold">งานของทีม ({teamTasks.length} งาน)</p>
          </div>
          {teamTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-20" />
              ยังไม่มีงาน
            </div>
          ) : (
            <div className="divide-y">
              {teamTasks.map((t) => {
                const assignee = t.assigned_to ? profileMap[t.assigned_to] : null;
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="shrink-0">{statusIcon(t.status)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      {assignee && (
                        <p className="text-xs text-muted-foreground">
                          รับโดย: {assignee.display_name || assignee.email}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* กราฟผลงาน */}
        {(() => {
          const PERIODS: { key: "7d"|"1m"|"3m"|"6m"|"1y"|"custom"; label: string; days?: number }[] = [
            { key: "7d",     label: "1 สัปดาห์", days: 7   },
            { key: "1m",     label: "1 เดือน",   days: 30  },
            { key: "3m",     label: "3 เดือน",   days: 90  },
            { key: "6m",     label: "6 เดือน",   days: 180 },
            { key: "1y",     label: "1 ปี",      days: 365 },
            { key: "custom", label: "กำหนดเอง" },
          ];
          const selectedPeriod = PERIODS.find((p) => p.key === chartPeriod)!;

          // คำนวณ cutoff/endDate
          let cutoff: Date;
          let endDate: Date = new Date();
          if (chartPeriod === "custom") {
            cutoff   = chartFrom ? new Date(chartFrom) : new Date(Date.now() - 30 * 86400000);
            endDate  = chartTo   ? new Date(new Date(chartTo).getTime() + 86400000 - 1) : new Date();
          } else {
            cutoff  = new Date(Date.now() - (selectedPeriod.days ?? 30) * 86400000);
          }

          // กรองงานตาม period
          const filtered = teamDoneTasks.filter((t) => {
            if (!t.created_at) return false;
            const d = new Date(t.created_at);
            return d >= cutoff && d <= endDate;
          });

          // นับตาม workType
          const WORK_TYPES = ["LINE OA", "แชทบอท", "เว็บไซต์", "อื่นๆ"];
          const TYPE_COLORS: Record<string, string> = {
            "LINE OA":  "#10b981",
            "แชทบอท":  "#6366f1",
            "เว็บไซต์": "#f59e0b",
            "อื่นๆ":    "#94a3b8",
          };

          const countMap: Record<string, number> = { "LINE OA": 0, "แชทบอท": 0, "เว็บไซต์": 0, "อื่นๆ": 0 };
          filtered.forEach((t) => {
            const m = (t.review_note ?? "").split("\n")[0].match(/^ประเภทงาน:\s*(.+?)(?:\s*—|$)/);
            const wt = m?.[1]?.trim();
            if (wt && countMap[wt] !== undefined) countMap[wt]++;
            else if (wt) countMap["อื่นๆ"]++;
            else countMap["อื่นๆ"]++;
          });

          const chartData = WORK_TYPES.map((type) => ({ name: type, งาน: countMap[type] }));
          const total = filtered.length;

          // สร้าง timeline bar (แบ่งเป็น 7 ช่วง)
          const SLOTS = 7;
          const totalMs = endDate.getTime() - cutoff.getTime();
          const slotMs = totalMs / SLOTS;
          const timelineData = Array.from({ length: SLOTS }, (_, i) => {
            const from = new Date(cutoff.getTime() + i * slotMs);
            const to   = new Date(cutoff.getTime() + (i + 1) * slotMs);
            const label = from.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
            const count = filtered.filter((t) =>
              t.created_at && new Date(t.created_at) >= from && new Date(t.created_at) < to
            ).length;
            return { label, งาน: count };
          });

          return (
            <div className="rounded-xl border bg-card overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b bg-muted/30 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  <p className="text-sm font-semibold">กราฟผลงาน</p>
                  <span className="text-xs text-muted-foreground">• {total} งานในช่วงที่เลือก</span>
                  {/* Period selector */}
                  <div className="ml-auto flex flex-wrap gap-1">
                    {PERIODS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setChartPeriod(p.key as typeof chartPeriod)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors border ${
                          chartPeriod === p.key
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom date range picker */}
                {chartPeriod === "custom" && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-xs text-muted-foreground">ตั้งแต่</span>
                    <input
                      type="date"
                      value={chartFrom}
                      max={chartTo || new Date().toISOString().split("T")[0]}
                      onChange={(e) => setChartFrom(e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400 h-8"
                    />
                    <span className="text-xs text-muted-foreground">ถึง</span>
                    <input
                      type="date"
                      value={chartTo}
                      min={chartFrom}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setChartTo(e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400 h-8"
                    />
                    {(chartFrom || chartTo) && (
                      <button
                        onClick={() => { setChartFrom(""); setChartTo(""); }}
                        className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        ล้าง
                      </button>
                    )}
                    {chartFrom && chartTo && (
                      <span className="text-xs text-indigo-600 font-medium">
                        {Math.round((new Date(chartTo).getTime() - new Date(chartFrom).getTime()) / 86400000) + 1} วัน
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 space-y-5">
                {total === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-15" />
                    ไม่มีผลงานในช่วงนี้
                  </div>
                ) : (
                  <>
                    {/* Bar chart — ตาม work type */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">จำนวนงานตามประเภท</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            formatter={(v: number) => [`${v} งาน`, "จำนวน"]}
                          />
                          <Bar dataKey="งาน" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry) => (
                              <Cell key={entry.name} fill={TYPE_COLORS[entry.name]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Timeline bar — แนวโน้มตามเวลา */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">แนวโน้มงานตามช่วงเวลา</p>
                      <ResponsiveContainer width="100%" height={130}>
                        <BarChart data={timelineData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v} งาน`, "จำนวน"]} />
                          <Bar dataKey="งาน" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Summary chips */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {WORK_TYPES.filter((t) => countMap[t] > 0).map((type) => (
                        <div key={type} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border"
                          style={{ borderColor: TYPE_COLORS[type] + "60", background: TYPE_COLORS[type] + "12", color: TYPE_COLORS[type] }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[type] }} />
                          <span className="font-medium">{type}</span>
                          <span className="font-bold">{countMap[type]} งาน</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* ผลงาน — งานที่ผ่านการตรวจสอบแล้ว */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <p className="text-sm font-semibold">ผลงาน ({teamDoneTasks.length} งาน)</p>
            <span className="ml-auto text-xs text-muted-foreground">งานที่ผ่านการตรวจสอบแล้ว</span>
          </div>
          {teamDoneTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-15" />
              ยังไม่มีผลงาน
            </div>
          ) : (
            <div className="divide-y">
              {teamDoneTasks.map((t) => {
                const assignee = t.assigned_to ? profileMap[t.assigned_to] : null;
                // parse work type + url จาก review_note
                const noteLines = (t.review_note ?? "").split("\n");
                const workLineMatch = noteLines[0]?.match(/^ประเภทงาน:\s*(.+?)(?:\s*—\s*(.+))?$/);
                const workType = workLineMatch?.[1]?.trim();
                const workUrl = workLineMatch?.[2]?.trim();

                return (
                  <div key={t.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <p className="text-sm font-medium">{t.title}</p>
                        {workType && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {workType}
                          </span>
                        )}
                      </div>
                      {t.created_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                          {new Date(t.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    {workUrl && (
                      <a href={workUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-full pl-5">
                        <LinkIcon className="w-3 h-3 shrink-0" />
                        {workUrl}
                      </a>
                    )}
                    {assignee && (
                      <p className="text-xs text-muted-foreground pl-5">
                        โดย: {assignee.display_name || assignee.email}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Danger zone */}
        {canEdit && (
          <div className="rounded-xl border border-red-100 bg-red-50/40 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">ลบทีม</p>
              <p className="text-xs text-red-500">ข้อมูลสมาชิกและงานจะไม่ถูกลบ</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-100 text-xs">
                  ลบทีม
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ยืนยันลบทีม</AlertDialogTitle>
                  <AlertDialogDescription>
                    ลบทีม <strong>{team.name}</strong> และสมาชิกทั้งหมดออกจากทีม?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={async () => { await deleteTeam(team.id); setSelectedTeam(null); }}
                  >
                    ยืนยันลบ
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Dialogs ยังใช้ได้ใน detail view */}
        {inviteDialogTeamId && (() => {
          const inviteTeam = teams.find((t) => t.id === inviteDialogTeamId);
          const inviteTeamMembers = members.filter((m) => m.team_id === inviteDialogTeamId);
          const inviteAvailableProfiles = profiles.filter((p) => !inviteTeamMembers.some((m) => m.user_id === p.id));
          const selectedProfile = inviteAvailableProfiles.find((p) => p.id === selectedUserId);
          const filteredProfiles = inviteAvailableProfiles.filter((p) => {
            const q = inviteSearch.toLowerCase();
            return (p.display_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q);
          });
          return (
            <Dialog open={!!inviteDialogTeamId} onOpenChange={(o) => { if (!o) { setInviteDialogTeamId(null); setSelectedUserId(""); setInviteSearch(""); } }}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>เพิ่มสมาชิก — {inviteTeam?.name}</DialogTitle>
                  <DialogDescription>พิมพ์ชื่อหรืออีเมลเพื่อค้นหา</DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
                    <Input
                      className="h-10 pl-9"
                      placeholder="พิมพ์ชื่อหรืออีเมล..."
                      value={selectedProfile ? (selectedProfile.display_name || selectedProfile.email || "") : inviteSearch}
                      onChange={(e) => { setInviteSearch(e.target.value); setSelectedUserId(""); }}
                    />
                    {inviteSearch && !selectedUserId && filteredProfiles.length > 0 && (
                      <div className="absolute top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                        {filteredProfiles.map((p) => (
                          <button key={p.id} type="button" className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/60 text-left" onClick={() => { setSelectedUserId(p.id); setInviteSearch(""); }}>
                            <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback className="text-xs">{p.display_name?.[0] || p.email?.[0] || "?"}</AvatarFallback></Avatar>
                            <div className="min-w-0"><p className="text-sm font-medium truncate">{p.display_name || p.email}</p></div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0" disabled={!selectedUserId}
                    onClick={async () => { await addMember(inviteDialogTeamId); setSelectedUserId(""); setInviteSearch(""); loadAll(); }}>
                    เพิ่ม
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={(o) => { if (!o) { setEditOpen(false); setEditTeam(null); } }}>
          <DialogContent className="max-w-sm" aria-describedby={undefined}>
            <DialogHeader><DialogTitle>แก้ไขทีม</DialogTitle></DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">ชื่อทีม <span className="text-red-500">*</span></label>
                <Input placeholder="ชื่อทีม" value={editName} onChange={(e) => setEditName(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">คำอธิบาย</label>
                <Input placeholder="รายละเอียด" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="text-sm" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => { setEditOpen(false); setEditTeam(null); }}>ยกเลิก</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={updateTeam} disabled={updating || !editName.trim()}>
                {updating ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View member profile dialog */}
        <UserProfileViewDialog
          userId={viewingUserId}
          open={!!viewingUserId}
          onOpenChange={(o) => { if (!o) setViewingUserId(null); }}
        />

        {/* Swap leader confirmation dialog */}
        <AlertDialog open={!!swapTarget} onOpenChange={(o) => { if (!o) setSwapTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                🔄 สลับหัวหน้าทีม
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>คุณต้องการสลับตำแหน่งหัวหน้าทีมใช่ไหม?</p>
                  <div className="rounded-lg bg-muted px-4 py-3 space-y-1">
                    {swapTarget?.oldLeaderName && (
                      <p>👤 <strong>{swapTarget.oldLeaderName}</strong> → <span className="text-muted-foreground">สมาชิก</span></p>
                    )}
                    <p>👑 <strong>{swapTarget?.newLeaderName}</strong> → <span className="text-amber-600 font-medium">หัวหน้าทีม</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground">การดำเนินการนี้จะเปลี่ยน role ในระบบด้วย</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={swapping}>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={swapping}
                onClick={confirmSwapLeader}
              >
                {swapping ? "กำลังสลับ..." : "ยืนยัน สลับหัวหน้า"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4" />
            สร้างทีม
          </Button>
        </div>
      )}

      {teams.length === 0 && (
        <Card className="p-10 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <Users className="w-10 h-10 opacity-25" />
          <p className="text-sm font-medium">ยังไม่มีทีม</p>
          {canManage && <p className="text-xs opacity-60">กด "สร้างทีม" เพื่อเริ่มต้น</p>}
        </Card>
      )}

      <div className="grid gap-2">
        {teams.map((team) => {
          const teamMembers = members.filter((m) => m.team_id === team.id).sort((a, b) => (a.position === "leader" ? -1 : 1) - (b.position === "leader" ? -1 : 1));
          const memberUserIds = new Set(teamMembers.map((m) => m.user_id));
          const teamTasks = tasks.filter((t) => t.team_id === team.id);
          const soloTasks = tasks.filter((t) => !t.team_id && t.assigned_to && memberUserIds.has(t.assigned_to));
          const waitingTasks = teamTasks.filter((t) => t.status === "open" && !t.assigned_to);
          // งานที่รับแล้วและกำลังทำ (ไม่รวม open ที่ยังไม่มีใครรับ)
          const activeTasks = teamTasks.filter((t) => t.status === "in_progress");
          const isExpanded = expandedId === team.id;
          const isCreator = team.created_by === user?.id;
          const isLeaderOf = teamMembers.some((m) => m.user_id === user?.id && m.position === "leader");
          const canEdit = canManage && (isCreator || isLeaderOf || role === "admin" || role === "ceo" || role === "developer");
          const availableProfiles = profiles.filter((p) => {
            if (teamMembers.some((m) => m.user_id === p.id)) return false;
            // Team Leader เพิ่มได้แค่ user ที่มี system role "member"
            if (role === "team_leader") return memberRoleIds.has(p.id);
            return true;
          });

          return (
            <Card key={team.id} className="overflow-hidden">
              <Collapsible open={isExpanded} onOpenChange={(o) => setExpandedId(o ? team.id : null)}>
                <CollapsibleTrigger asChild>
                  <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedTeam(team); }}
                      className="w-9 h-9 rounded-lg overflow-hidden shrink-0 transition-all group hover:ring-2 hover:ring-emerald-400"
                      title="ดูรายละเอียดทีม"
                    >
                      {team.logo_url ? (
                        <img src={team.logo_url} className="w-full h-full object-cover" alt={team.name} />
                      ) : (
                        <div className="w-full h-full bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center transition-colors">
                          <Users className="w-4 h-4 text-emerald-700 group-hover:scale-110 transition-transform" />
                        </div>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{team.name}</p>
                        {team.tags && team.tags.length > 0 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                            {team.tags[0]}
                          </span>
                        )}
                      </div>
                      {team.description && (
                        <p className="text-xs text-muted-foreground truncate">{team.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-xs">{teamMembers.length} คน</Badge>
                      {waitingTasks.length > 0 && (
                        <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300 border animate-pulse">
                          ⏳ {waitingTasks.length} รอรับ
                        </Badge>
                      )}
                      <Badge className={`text-xs border ${(activeTasks.length + soloTasks.length) > 0 ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                        <Briefcase className="w-2.5 h-2.5 mr-1" />{activeTasks.length + soloTasks.length} กำลังทำ
                      </Badge>
                      {canEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(team); }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="แก้ไขทีม"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t px-4 py-3 space-y-2 bg-muted/10">
                    {teamMembers.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">ยังไม่มีสมาชิก</p>
                    )}

                    {teamMembers.map((m) => {
                      const profile = profileMap[m.user_id];
                      // งานทีม = เฉพาะ task ของทีมที่รับแล้ว (in_progress) ไม่รวม "รอรับ"
                      const memberTeamTasks = teamTasks.filter((t) => t.status === "in_progress");
                      // งานเดี่ยว = task ที่ assigned ให้สมาชิกคนนี้โดยเฉพาะ
                      const memberSoloTasks = tasks.filter((t) => t.assigned_to === m.user_id && !t.team_id);
                      return (
                        <div key={m.id} className="flex items-center gap-2 py-0.5">
                          {/* Avatar + Name — คลิกดูโปรไฟล์ */}
                          <button
                            type="button"
                            onClick={() => setViewingUserId(m.user_id)}
                            className="flex items-center gap-2 min-w-0 text-left hover:opacity-70 transition-opacity px-1"
                            title="ดูโปรไฟล์"
                          >
                            <Avatar className="w-7 h-7 shrink-0">
                              <AvatarImage src={profile?.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {profile?.display_name?.[0] || profile?.email?.[0] || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium truncate max-w-[140px]">
                              {profile?.display_name || profile?.email || m.user_id}
                              {m.user_id === user?.id && <span className="text-xs text-muted-foreground ml-1">(คุณ)</span>}
                            </span>
                          </button>

                          {/* จำนวนงาน + dropdown — คลิกดูรายการงาน */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex items-center gap-1 hover:bg-muted/50 rounded-lg px-1.5 py-1 transition-colors group" title="ดูรายการงาน">
                                {memberTeamTasks.length > 0 && (
                                  <span className="text-[10px] bg-blue-100 text-blue-600 font-semibold px-1.5 py-0.5 rounded-full">
                                    {memberTeamTasks.length} ทีม
                                  </span>
                                )}
                                {memberSoloTasks.length > 0 && (
                                  <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded-full">
                                    {memberSoloTasks.length} เดี่ยว
                                  </span>
                                )}
                                {memberTeamTasks.length === 0 && memberSoloTasks.length === 0 && (
                                  <span className="text-[10px] text-muted-foreground px-1">0 งาน</span>
                                )}
                                <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 opacity-40 group-hover:opacity-100" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-72 p-0 overflow-hidden">
                              <div className="px-3 py-2.5 border-b bg-muted/30 flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-700 truncate">
                                  {profile?.display_name || profile?.email}
                                </p>
                                <div className="flex gap-1.5 shrink-0 ml-2">
                                  {(["all", "team", "solo"] as const).map((f) => {
                                    const active = (memberFilter[m.id] ?? "all") === f;
                                    const label = f === "all" ? `ทั้งหมด ${memberTeamTasks.length + memberSoloTasks.length}` : f === "team" ? `ทีม ${memberTeamTasks.length}` : `เดี่ยว ${memberSoloTasks.length}`;
                                    return (
                                      <button
                                        key={f}
                                        onClick={() => setMemberFilter((prev) => ({ ...prev, [m.id]: f }))}
                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                                          active
                                            ? f === "team" ? "bg-blue-500 text-white border-blue-500" : f === "solo" ? "bg-slate-500 text-white border-slate-500" : "bg-slate-700 text-white border-slate-700"
                                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              {memberTeamTasks.length + memberSoloTasks.length === 0 ? (
                                <div className="py-5 text-center text-xs text-muted-foreground">
                                  <ClipboardList className="w-5 h-5 mx-auto mb-1 opacity-30" />
                                  ยังไม่มีงาน
                                </div>
                              ) : (
                                <div className="divide-y max-h-56 overflow-y-auto">
                                  {(memberFilter[m.id] ?? "all") !== "solo" && memberTeamTasks.map((t) => (
                                    <div key={t.id} className="flex items-center gap-2 px-3 py-2.5">
                                      <span className="text-sm">👥</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{t.title}</p>
                                        <p className="text-[10px] text-blue-500">งานทีม</p>
                                      </div>
                                    </div>
                                  ))}
                                  {(memberFilter[m.id] ?? "all") !== "team" && memberSoloTasks.map((t) => (
                                    <div key={t.id} className="flex items-center gap-2 px-3 py-2.5">
                                      <span className="text-sm">👤</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{t.title}</p>
                                        <p className="text-[10px] text-slate-400">งานเดี่ยว</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>

                          {/* ขยายให้ position badge ชิดขวา */}
                          <div className="flex-1" />

                          {canEdit && !(m.user_id === user?.id && m.position === "leader") ? (
                            <Select
                              value={m.position}
                              onValueChange={(v) => {
                          if (v === "leader") prepareSwapLeader(m.id, team.id);
                          else changePosition(m.id, team.id, v);
                        }}
                            >
                              <SelectTrigger className={`h-6 w-28 text-[11px] border ${POSITION_STYLE[m.position] || POSITION_STYLE.member}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(role === "admin" || role === "ceo" || role === "developer" || teamMembers.some((tm) => tm.user_id === user?.id && tm.position === "leader")) && (
                                  <SelectItem value="leader">หัวหน้าทีม</SelectItem>
                                )}
                                <SelectItem value="member">สมาชิก</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={`text-[11px] ${POSITION_STYLE[m.position] || POSITION_STYLE.member}`}>
                              {POSITION_LABEL[m.position] || m.position}
                            </Badge>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => removeMember(m.id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* ปุ่มออกจากทีม สำหรับสมาชิกตัวเอง */}
                          {!canEdit && m.user_id === user?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="text-[11px] text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-full px-2 py-0.5 transition-colors shrink-0">
                                  ออก
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>ออกจากทีม</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    คุณต้องการออกจากทีม <strong>{team.name}</strong> ใช่ไหม?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => removeMember(m.id)}
                                  >
                                    ออกจากทีม
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      );
                    })}

                    {canEdit && (
                      <div className="pt-1">
                        <div className="flex items-center justify-between">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => { setInviteDialogTeamId(team.id); setSelectedUserId(""); }}
                            >
                              <UserPlus className="w-3 h-3" />
                              เพิ่มสมาชิก
                            </Button>

                            {canEdit && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button className="text-xs text-red-400 hover:text-red-600 transition-colors">
                                    ลบทีม
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>ยืนยันลบทีม</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      ลบทีม <strong>{team.name}</strong> และสมาชิกทั้งหมดออกจากทีม (ข้อมูลสมาชิกไม่ถูกลบ)
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteTeam(team.id)}>
                                      ยืนยันลบ
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Invite member dialog */}
      {inviteDialogTeamId && (() => {
        const inviteTeam = teams.find((t) => t.id === inviteDialogTeamId);
        const inviteTeamMembers = members.filter((m) => m.team_id === inviteDialogTeamId);
        const inviteAvailableProfiles = profiles.filter((p) =>
          !inviteTeamMembers.some((m) => m.user_id === p.id)
        );
        const selectedProfile = inviteAvailableProfiles.find((p) => p.id === selectedUserId);
        const filteredProfiles = inviteAvailableProfiles.filter((p) => {
          const q = inviteSearch.toLowerCase();
          return (p.display_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q);
        });
        return (
          <Dialog open={!!inviteDialogTeamId} onOpenChange={(o) => { if (!o) { setInviteDialogTeamId(null); setSelectedUserId(""); setInviteSearch(""); } }}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-semibold">เพิ่มสมาชิก — {inviteTeam?.name}</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  พิมพ์ชื่อหรืออีเมลเพื่อค้นหา แล้วกด เพิ่ม
                </DialogDescription>
              </DialogHeader>

              {/* Search input + invite */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
                  <Input
                    className="h-10 pl-9"
                    placeholder="พิมพ์ชื่อหรืออีเมล..."
                    value={selectedProfile ? (selectedProfile.display_name || selectedProfile.email || "") : inviteSearch}
                    onChange={(e) => { setInviteSearch(e.target.value); setSelectedUserId(""); }}
                  />
                  {/* Dropdown results */}
                  {inviteSearch && !selectedUserId && filteredProfiles.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                      {filteredProfiles.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/60 transition-colors text-left"
                          onClick={() => { setSelectedUserId(p.id); setInviteSearch(""); }}
                        >
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={p.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{p.display_name?.[0] || p.email?.[0] || "?"}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.display_name || p.email}</p>
                            {p.display_name && p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {inviteSearch && !selectedUserId && filteredProfiles.length === 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg z-50 px-3 py-3 text-xs text-muted-foreground">
                      ไม่พบสมาชิก
                    </div>
                  )}
                </div>
                <Button
                  className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  disabled={!selectedUserId}
                  onClick={async () => { await addMember(inviteDialogTeamId); setSelectedUserId(""); setInviteSearch(""); loadAll(); }}
                >
                  เพิ่ม
                </Button>
              </div>

              {/* Current members */}
              {inviteTeamMembers.length > 0 && (
                <>
                  <h4 className="text-sm font-medium text-foreground mt-2">สมาชิกในทีมตอนนี้</h4>
                  <ul className="divide-y max-h-52 overflow-y-auto">
                    {inviteTeamMembers.map((m) => {
                      const p = profiles.find((pr) => pr.id === m.user_id);
                      return (
                        <li key={m.id} className="flex items-center justify-between py-2.5">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={p?.avatar_url || undefined} />
                              <AvatarFallback className="text-sm">{p?.display_name?.[0] || p?.email?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{p?.display_name || p?.email || m.user_id}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {m.position === "leader" ? "หัวหน้าทีม" : "สมาชิก"}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Create team dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setNewLogoFile(null); setNewLogoPreview(null); setNewName(""); setNewDesc(""); setNewTag(""); } }}>
        <DialogContent className="sm:max-w-lg p-0 rounded-3xl gap-0" aria-describedby={undefined}>
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="font-medium">สร้างทีมใหม่</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-5 px-6 pt-5 pb-6 gap-6">
            {/* Left — avatar upload */}
            <div className="flex flex-col items-center justify-center md:col-span-2 gap-2">
              <div className="relative mb-1">
                <Avatar className="h-24 w-24 border-2 border-emerald-200">
                  <AvatarImage src={newLogoPreview || undefined} alt="Team logo" />
                  <AvatarFallback className="bg-emerald-100">
                    <span className="text-3xl font-bold text-emerald-700 select-none">
                      {newName?.[0]?.toUpperCase() || <Users className="w-8 h-8 text-emerald-400" />}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  className="absolute -top-0.5 -right-0.5 w-7 h-7 bg-accent rounded-full border-[3px] border-background flex items-center justify-center hover:bg-muted transition-colors"
                  onClick={() => {
                    if (newLogoPreview) { setNewLogoPreview(null); setNewLogoFile(null); if (newLogoRef.current) newLogoRef.current.value = ""; }
                    else { newLogoRef.current?.click(); }
                  }}
                >
                  {newLogoPreview ? <X className="w-3 h-3 text-muted-foreground" /> : <Plus className="w-3 h-3 text-muted-foreground" />}
                </button>
              </div>

              <input ref={newLogoRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกิน 2MB"); return; }
                  setNewLogoFile(file);
                  const reader = new FileReader();
                  reader.onload = (ev) => setNewLogoPreview(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }}
              />

              <p className="text-xs font-medium">รูปโปรไฟล์ทีม</p>
              <p className="text-xs text-muted-foreground">สูงสุด 2MB</p>
              <Button type="button" variant="outline" size="sm" className="mt-1 text-xs h-7" onClick={() => newLogoRef.current?.click()}>
                เลือกรูป
              </Button>

              {newTag && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 mt-1">
                  {newTag}
                </span>
              )}
            </div>

            {/* Right — form */}
            <div className="flex flex-col justify-between md:col-span-3 gap-4">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1">ชื่อทีม <span className="text-red-500">*</span></label>
                  <Input placeholder="เช่น ทีมขาย, ทีมบริการ..." value={newName} onChange={(e) => setNewName(e.target.value)} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">คำอธิบาย</label>
                  <Input placeholder="รายละเอียดของทีม (ถ้ามี)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1">ประเภท SME <span className="text-red-500">*</span></label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background text-sm hover:bg-muted/50 transition-colors">
                        <span className={!newTag ? "text-muted-foreground" : "text-emerald-700 font-semibold"}>{newTag || "เลือกประเภท SME..."}</span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 max-h-56 overflow-y-auto" align="start">
                      <div className="grid grid-cols-2 gap-1">
                        {SME_TAGS.map((tag) => {
                          const active = newTag === tag;
                          return (
                            <button key={tag} type="button" onClick={() => setNewTag(active ? "" : tag)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left ${active ? "bg-emerald-600 text-white" : "hover:bg-muted text-slate-600"}`}>
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${active ? "bg-white border-white" : "border-slate-300"}`}>
                                {active && <span className="w-2 h-2 rounded-full bg-emerald-600 block" />}
                              </span>
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                      {newTag && (
                        <div className="border-t mt-2 pt-2">
                          <button type="button" onClick={() => setNewTag("")} className="text-xs text-red-500 hover:text-red-600 w-full text-left px-1">ล้าง</button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setCreateOpen(false); setNewTag(""); setNewLogoFile(null); setNewLogoPreview(null); }}>ยกเลิก</Button>
                <Button className="bg-foreground text-background hover:bg-foreground/90" onClick={createTeam} disabled={creating || !newName.trim() || !newTag}>
                  {creating ? "กำลังสร้าง..." : "สร้างทีม"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View user profile dialog */}
      <UserProfileViewDialog
        userId={viewingUserId}
        open={!!viewingUserId}
        onOpenChange={(o) => { if (!o) setViewingUserId(null); }}
      />

      {/* Swap leader confirmation dialog (list view) */}
      <AlertDialog open={!!swapTarget} onOpenChange={(o) => { if (!o) setSwapTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              🔄 สลับหัวหน้าทีม
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>คุณต้องการสลับตำแหน่งหัวหน้าทีมใช่ไหม?</p>
                <div className="rounded-lg bg-muted px-4 py-3 space-y-1">
                  {swapTarget?.oldLeaderName && (
                    <p>👤 <strong>{swapTarget.oldLeaderName}</strong> → <span className="text-muted-foreground">สมาชิก</span></p>
                  )}
                  <p>👑 <strong>{swapTarget?.newLeaderName}</strong> → <span className="text-amber-600 font-medium">หัวหน้าทีม</span></p>
                </div>
                <p className="text-xs text-muted-foreground">การดำเนินการนี้จะเปลี่ยน role ในระบบด้วย</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={swapping}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={swapping}
              onClick={confirmSwapLeader}
            >
              {swapping ? "กำลังสลับ..." : "ยืนยัน สลับหัวหน้า"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit team dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) { setEditOpen(false); setEditTeam(null); } }}>
        <DialogContent className="sm:max-w-lg p-0 rounded-3xl gap-0" aria-describedby={undefined}>
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="font-medium">แก้ไขทีม</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-5 px-6 pt-5 pb-6 gap-6">
            {/* Left — team avatar upload */}
            <div className="flex flex-col items-center justify-center md:col-span-2 gap-2">
              <div className="relative mb-1">
                <Avatar className="h-24 w-24 border-2 border-emerald-200">
                  <AvatarImage src={editLogoPreview || undefined} alt="Team logo" />
                  <AvatarFallback className="bg-emerald-100">
                    <span className="text-3xl font-bold text-emerald-700 select-none">
                      {editName?.[0]?.toUpperCase() || "T"}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  title={editLogoPreview ? "ลบรูป" : "อัปโหลดรูป"}
                  className="absolute -top-0.5 -right-0.5 w-7 h-7 bg-accent rounded-full border-[3px] border-background flex items-center justify-center hover:bg-muted transition-colors"
                  onClick={() => {
                    if (editLogoPreview) {
                      setEditLogoPreview(null);
                      setEditLogoFile(null);
                      if (editLogoRef.current) editLogoRef.current.value = "";
                    } else {
                      editLogoRef.current?.click();
                    }
                  }}
                >
                  {editLogoPreview
                    ? <X className="w-3 h-3 text-muted-foreground" />
                    : <Plus className="w-3 h-3 text-muted-foreground" />}
                </button>
              </div>

              <input
                ref={editLogoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกิน 2MB"); return; }
                  setEditLogoFile(file);
                  const reader = new FileReader();
                  reader.onload = (ev) => setEditLogoPreview(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }}
              />

              <p className="text-xs font-medium">อัปโหลดรูปทีม</p>
              <p className="text-xs text-muted-foreground">สูงสุด 2MB</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 text-xs h-7"
                onClick={() => editLogoRef.current?.click()}
              >
                เลือกรูป
              </Button>

              {editTag && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 mt-1">
                  {editTag}
                </span>
              )}
            </div>

            {/* Right — form fields */}
            <div className="flex flex-col justify-between md:col-span-3 gap-4">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1">
                    ชื่อทีม <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="เช่น ทีมขาย, ทีมบริการ..."
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">คำอธิบาย</label>
                  <Input
                    placeholder="รายละเอียดของทีม (ถ้ามี)"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1">
                    ประเภท SME <span className="text-red-500">*</span>
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background text-sm hover:bg-muted/50 transition-colors"
                      >
                        <span className={!editTag ? "text-muted-foreground" : "text-emerald-700 font-semibold"}>
                          {editTag || "เลือกประเภท SME..."}
                        </span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 max-h-56 overflow-y-auto" align="start">
                      <div className="grid grid-cols-2 gap-1">
                        {SME_TAGS.map((tag) => {
                          const active = editTag === tag;
                          return (
                            <button key={tag} type="button" onClick={() => setEditTag(active ? "" : tag)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left ${active ? "bg-emerald-600 text-white" : "hover:bg-muted text-slate-600"}`}>
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${active ? "bg-white border-white" : "border-slate-300"}`}>
                                {active && <span className="w-2 h-2 rounded-full bg-emerald-600 block" />}
                              </span>
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                      {editTag && (
                        <div className="border-t mt-2 pt-2">
                          <button type="button" onClick={() => setEditTag("")} className="text-xs text-red-500 hover:text-red-600 w-full text-left px-1">ล้าง</button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setEditOpen(false); setEditTeam(null); }}>ยกเลิก</Button>
                <Button
                  className="bg-foreground text-background hover:bg-foreground/90"
                  onClick={updateTeam}
                  disabled={updating || !editName.trim() || !editTag}
                >
                  {updating ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
