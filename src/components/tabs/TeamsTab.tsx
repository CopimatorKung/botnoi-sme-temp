import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronUp, UserPlus, X, Users, Briefcase, ClipboardList } from "lucide-react";

interface Team {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

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
}

const POSITION_LABEL: Record<string, string> = {
  leader: "หัวหน้าทีม",
  member: "สมาชิก",
};
const POSITION_STYLE: Record<string, string> = {
  leader: "bg-amber-100 text-amber-700 border-amber-200",
  member: "bg-slate-100 text-slate-600 border-slate-200",
};

export function TeamsTab() {
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
  const [creating, setCreating] = useState(false);

  const [addingToTeam, setAddingToTeam] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<Record<string, "all" | "team" | "solo">>({});
  const [selectedUserId, setSelectedUserId] = useState("");

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  useEffect(() => { loadAll(); }, []);

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
    setCreating(true);
    const { data: team, error } = await supabase
      .from("teams")
      .insert({ name: newName.trim(), description: newDesc.trim() || null, created_by: user!.id })
      .select()
      .single();
    if (error) { toast.error(error.message); setCreating(false); return; }
    // เพิ่มผู้สร้างเป็น leader อัตโนมัติ
    await supabase.from("team_members").insert({ team_id: team.id, user_id: user!.id, position: "leader" });
    toast.success("สร้างทีมแล้ว");
    setCreateOpen(false);
    setNewName("");
    setNewDesc("");
    setCreating(false);
    loadAll();
  };

  const deleteTeam = async (teamId: string) => {
    const { error } = await supabase.from("teams").delete().eq("id", teamId);
    if (error) toast.error(error.message);
    else { toast.success("ลบทีมแล้ว"); loadAll(); }
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
    const { error } = await supabase.from("team_members").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("นำออกแล้ว"); loadAll(); }
  };

  const changePosition = async (memberId: string, teamId: string, position: string) => {
    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember) return;

    if (position === "leader") {
      // demote leader คนเดิมในทีมเดียวกันเป็น member ก่อน (ทั้ง team_members และ user_roles)
      const currentLeaders = members.filter(
        (m) => m.team_id === teamId && m.position === "leader" && m.id !== memberId
      );
      for (const leader of currentLeaders) {
        await supabase.from("team_members").update({ position: "member" }).eq("id", leader.id);
        // เปลี่ยน system role เป็น member
        await supabase.from("user_roles").delete().eq("user_id", leader.user_id).eq("role", "team_leader");
        await supabase.from("user_roles").insert({ user_id: leader.user_id, role: "member" });
      }
      // promote target เป็น team_leader
      await supabase.from("user_roles").delete().eq("user_id", targetMember.user_id).eq("role", "member");
      await supabase.from("user_roles").insert({ user_id: targetMember.user_id, role: "team_leader" });
    } else {
      // demote เป็น member
      await supabase.from("user_roles").delete().eq("user_id", targetMember.user_id).eq("role", "team_leader");
      await supabase.from("user_roles").insert({ user_id: targetMember.user_id, role: "member" });
    }

    const { error } = await supabase.from("team_members").update({ position }).eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success(position === "leader" ? "มอบอำนาจหัวหน้าทีมแล้ว" : "เปลี่ยนตำแหน่งแล้ว"); loadAll(); }
  };

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
          const isExpanded = expandedId === team.id;
          const isCreator = team.created_by === user?.id;
          const canEdit = canManage && (isCreator || role === "admin" || role === "ceo" || role === "developer");
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
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{team.name}</p>
                      {team.description && (
                        <p className="text-xs text-muted-foreground truncate">{team.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-xs">{teamMembers.length} คน</Badge>
                      {teamTasks.length > 0 && (
                        <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 border">
                          <Briefcase className="w-2.5 h-2.5 mr-1" />{teamTasks.length + soloTasks.length} งาน
                        </Badge>
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
                      // งานทีม = ทุก task ของทีมนี้ (ทุกคนในทีมเห็นเหมือนกัน)
                      const memberTeamTasks = teamTasks;
                      // งานเดี่ยว = task ที่ assigned ให้สมาชิกคนนี้โดยเฉพาะ
                      const memberSoloTasks = tasks.filter((t) => t.assigned_to === m.user_id && !t.team_id);
                      return (
                        <div key={m.id} className="flex items-center gap-2 py-0.5">
                          {/* Avatar + Name — คลิกดูงาน */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex items-center gap-2 min-w-0 text-left hover:bg-muted/50 rounded-lg px-1.5 py-1 transition-colors group">
                                <Avatar className="w-7 h-7 shrink-0">
                                  <AvatarImage src={profile?.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {profile?.display_name?.[0] || profile?.email?.[0] || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium truncate max-w-[160px]">
                                  {profile?.display_name || profile?.email || m.user_id}
                                  {m.user_id === user?.id && <span className="text-xs text-muted-foreground ml-1">(คุณ)</span>}
                                </span>
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
                          {/* จำนวนงาน */}
                          <div className="flex items-center gap-1 shrink-0">
                            {memberTeamTasks.length > 0 && (
                              <span className="text-[10px] bg-blue-100 text-blue-600 font-semibold px-1.5 py-0.5 rounded-full">
                                👥 {memberTeamTasks.length}
                              </span>
                            )}
                            {memberSoloTasks.length > 0 && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded-full">
                                👤 {memberSoloTasks.length}
                              </span>
                            )}
                          </div>

                          {canEdit && !(m.user_id === user?.id && m.position === "leader") ? (
                            <Select
                              value={m.position}
                              onValueChange={(v) => changePosition(m.id, team.id, v)}
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
                        {addingToTeam === team.id ? (
                          <div className="flex gap-2 items-center">
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                              <SelectTrigger className="h-8 flex-1 text-xs">
                                <SelectValue placeholder="เลือกสมาชิก..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableProfiles.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.display_name || p.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => addMember(team.id)}>
                              เพิ่ม
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setAddingToTeam(null); setSelectedUserId(""); }}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => { setAddingToTeam(team.id); setSelectedUserId(""); }}
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
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Create team dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>สร้างทีมใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                ชื่อทีม <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="เช่น ทีมขาย, ทีมบริการ..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                คำอธิบาย
              </label>
              <Input
                placeholder="รายละเอียดของทีม (ถ้ามี)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>ยกเลิก</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={createTeam}
              disabled={creating || !newName.trim()}
            >
              {creating ? "กำลังสร้าง..." : "สร้างทีม"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
