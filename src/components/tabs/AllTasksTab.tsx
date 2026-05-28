import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, X, Users, User, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  team_id: string | null;
  created_at: string;
  review_note: string | null;
}
interface Profile { id: string; display_name: string | null; email: string | null; avatar_url: string | null; }
interface Team { id: string; name: string; }

// ---- time window ----
const THREE_HOURS_MS = 1 * 60 * 1000; // TEST: 1 นาที

const isTeamTaskExpired = (t: Task) =>
  !!t.team_id && t.status === "open" && !t.assigned_to &&
  Date.now() - new Date(t.created_at).getTime() > THREE_HOURS_MS;

// ---- badge ----
const getTaskBadge = (t: Task): { label: string; color: string } => {
  if (t.status === "open") {
    if (t.team_id && !t.assigned_to && !isTeamTaskExpired(t))
      return { label: "รอรับงาน", color: "bg-orange-100 text-orange-700 border-orange-200" };
    return { label: "งานอิสระ", color: "bg-blue-100 text-blue-700 border-blue-200" };
  }
  if (t.status === "cancelled") {
    const confirmed = t.review_note?.includes("แอดมินยืนยัน:") ?? false;
    return confirmed
      ? { label: "ยกเลิกแล้ว",        color: "bg-slate-100 text-slate-500 border-slate-200"  }
      : { label: "รอยืนยันยกเลิก",    color: "bg-rose-100 text-rose-600 border-rose-200"     };
  }
  const MAP: Record<string, { label: string; color: string }> = {
    in_progress: { label: "กำลังทำ",   color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    done:        { label: "รอตรวจสอบ", color: "bg-amber-100 text-amber-700 border-amber-200"   },
    approved:    { label: "ผ่านแล้ว",  color: "bg-green-100 text-green-700 border-green-200"   },
  };
  return MAP[t.status] ?? { label: t.status, color: "bg-slate-100 text-slate-500 border-slate-200" };
};

// ---- status chips ----
type FilterKey = "open_free" | "open_team" | "in_progress" | "done" | "approved" | "pending_cancel" | "cancelled";

const FILTER_CHIPS: { key: FilterKey; label: string; activeColor: string; defaultColor?: string }[] = [
  { key: "open_free",      label: "งานอิสระ",         activeColor: "bg-blue-100 text-blue-700 border-blue-200"         },
  { key: "open_team",      label: "รอรับงาน",         activeColor: "bg-orange-100 text-orange-700 border-orange-200"   },
  { key: "in_progress",    label: "กำลังทำ",          activeColor: "bg-yellow-100 text-yellow-700 border-yellow-200"   },
  { key: "done",           label: "รอตรวจสอบ",        activeColor: "bg-amber-100 text-amber-700 border-amber-200"      },
  { key: "approved",       label: "ผ่านแล้ว",         activeColor: "bg-green-100 text-green-700 border-green-200"      },
  { key: "pending_cancel", label: "รอยืนยันยกเลิก",  activeColor: "bg-rose-100 text-rose-600 border-rose-300",
                                                        defaultColor: "bg-background text-rose-500 border-rose-200 hover:bg-rose-50" },
  { key: "cancelled",      label: "ยกเลิกแล้ว",      activeColor: "bg-slate-100 text-slate-600 border-slate-300",
                                                        defaultColor: "bg-background text-slate-500 border-slate-200 hover:bg-slate-50" },
];

const matchStatusFilter = (t: Task, key: FilterKey): boolean => {
  if (key === "open_free")      return t.status === "open" && (!t.team_id || isTeamTaskExpired(t));
  if (key === "open_team")      return t.status === "open" && !!t.team_id && !t.assigned_to && !isTeamTaskExpired(t);
  if (key === "pending_cancel") return t.status === "cancelled" && !(t.review_note?.includes("แอดมินยืนยัน:") ?? false);
  if (key === "cancelled")      return t.status === "cancelled" &&  (t.review_note?.includes("แอดมินยืนยัน:") ?? false);
  return t.status === key;
};

// ---- description helpers ----
const extractSme = (desc: string | null): string | null => {
  if (!desc) return null;
  const line = desc.split("\n").find((l) => l.startsWith("ประเภท SME:"));
  if (!line) return null;
  // เอาแค่ token แรก เช่น "#SME03" ตัดชื่อข้างหลังออก
  const full = line.slice("ประเภท SME:".length).trim();
  return full.split(/\s+/)[0] || null;
};

const renderDescription = (desc: string) =>
  desc.split("\n").map((line, i) => {
    if (line.startsWith("ประเภท SME:")) {
      const value = line.slice("ประเภท SME:".length).trim();
      return (
        <span key={i} className="block">
          ประเภท SME:{" "}
          <span className="bg-violet-100 text-violet-800 font-semibold px-1.5 py-0.5 rounded text-[11px]">
            {value}
          </span>
        </span>
      );
    }
    return <span key={i} className="block">{line}</span>;
  });

export function AllTasksTab() {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams]       = useState<Team[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // ---- filters ----
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterKey | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [smeFilter, setSmeFilter]       = useState<string>("__all__");
  const [teamFilter, setTeamFilter]     = useState<string>("__all__");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("__all__");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeOpen, setAssigneeOpen]     = useState(false);

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const teamMap    = Object.fromEntries(teams.map((t) => [t.id, t]));

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: t }, { data: p }, { data: tm }] = await Promise.all([
      supabase.from("tasks").select("id,title,description,status,assigned_to,team_id,created_at,review_note").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,display_name,email,avatar_url"),
      supabase.from("teams" as any).select("id,name"),
    ]);
    setTasks((t as Task[]) || []);
    setProfiles(p || []);
    setTeams((tm as Team[]) || []);
    setLoading(false);
  };

  // ---- unique SME options (จาก description จริง) ----
  const smeOptions = useMemo(
    () => [...new Set(tasks.map((t) => extractSme(t.description)).filter(Boolean))] as string[],
    [tasks]
  );

  // ---- assignees who have at least one task ----
  const assigneeOptions = useMemo(() => {
    const ids = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[];
    return ids.map((id) => profileMap[id]).filter(Boolean);
  }, [tasks, profileMap]);

  // ---- teams with at least one task ----
  const teamOptions = useMemo(() => {
    const ids = [...new Set(tasks.map((t) => t.team_id).filter(Boolean))] as string[];
    return ids.map((id) => teamMap[id]).filter(Boolean);
  }, [tasks, teamMap]);

  // ---- is any advanced filter active? ----
  const advancedActive =
    smeFilter !== "__all__" || teamFilter !== "__all__" || assigneeFilter !== "__all__";

  const resetAdvanced = () => {
    setSmeFilter("__all__"); setTeamFilter("__all__");
    setAssigneeFilter("__all__"); setAssigneeSearch("");
  };

  // ---- filtered tasks ----
  const filtered = tasks.filter((t) => {
    // status chip
    if (statusFilter && !matchStatusFilter(t, statusFilter)) return false;

    // SME
    if (smeFilter !== "__all__" && extractSme(t.description) !== smeFilter) return false;

    // team
    if (teamFilter !== "__all__" && t.team_id !== teamFilter) return false;

    // assignee
    if (assigneeFilter !== "__all__" && t.assigned_to !== assigneeFilter) return false;

    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      const assignee = t.assigned_to ? profileMap[t.assigned_to] : null;
      const assigneeName = (assignee?.display_name || assignee?.email || "").toLowerCase();
      const teamName = (t.team_id ? teamMap[t.team_id]?.name || "" : "").toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        assigneeName.includes(q) ||
        teamName.includes(q)
      );
    }
    return true;
  });

  // counts for status chips (ไม่นับ advanced filter)
  const counts = Object.fromEntries(
    FILTER_CHIPS.map(({ key }) => [key, tasks.filter((t) => matchStatusFilter(t, key)).length])
  );

  return (
    <div className="space-y-4">

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter(null)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            !statusFilter ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border hover:bg-muted"
          }`}
        >
          ทั้งหมด {tasks.length}
        </button>
        {FILTER_CHIPS.map(({ key, label, activeColor, defaultColor }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? null : key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === key
                ? activeColor
                : (defaultColor ?? "bg-background text-muted-foreground border-border hover:bg-muted")
            }`}
          >
            {label} {counts[key]}
          </button>
        ))}
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหางาน ชื่อคน หรือทีม..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-9 rounded-lg border-2 border-border bg-background text-sm outline-none focus:border-primary transition"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className={`h-10 gap-1.5 shrink-0 ${advancedActive ? "border-primary text-primary bg-primary/5" : ""}`}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <SlidersHorizontal className="w-4 h-4" />
          ตัวกรอง
          {advancedActive && (
            <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {[smeFilter !== "__all__", teamFilter !== "__all__", assigneeFilter !== "__all__"].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {/* Advanced filter panel */}
      {showAdvanced && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

            {/* SME */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ประเภท SME</label>
              <Select value={smeFilter} onValueChange={setSmeFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">ทั้งหมด</SelectItem>
                  {smeOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Team */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ทีม</label>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">ทั้งหมด</SelectItem>
                  {teamOptions.map((tm) => tm && (
                    <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee — searchable combobox */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ผู้รับงาน</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={
                    assigneeFilter === "__all__"
                      ? "ทั้งหมด"
                      : (profileMap[assigneeFilter]?.display_name || profileMap[assigneeFilter]?.email || "ทั้งหมด")
                  }
                  value={assigneeSearch}
                  onChange={(e) => { setAssigneeSearch(e.target.value); setAssigneeOpen(true); }}
                  onFocus={() => setAssigneeOpen(true)}
                  onBlur={() => setTimeout(() => setAssigneeOpen(false), 150)}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-xs outline-none focus:border-primary transition"
                />
                {assigneeOpen && (
                  <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-background shadow-md max-h-48 overflow-y-auto">
                    {/* ทั้งหมด */}
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${assigneeFilter === "__all__" ? "font-semibold text-primary" : ""}`}
                      onMouseDown={() => { setAssigneeFilter("__all__"); setAssigneeSearch(""); setAssigneeOpen(false); }}
                    >
                      ทั้งหมด
                    </button>
                    {assigneeOptions
                      .filter((p) => {
                        if (!assigneeSearch.trim()) return true;
                        const name = (p?.display_name || p?.email || "").toLowerCase();
                        return name.includes(assigneeSearch.toLowerCase());
                      })
                      .map((p) => p && (
                        <button
                          key={p.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${assigneeFilter === p.id ? "font-semibold text-primary" : ""}`}
                          onMouseDown={() => { setAssigneeFilter(p.id); setAssigneeSearch(""); setAssigneeOpen(false); }}
                        >
                          {p.display_name || p.email}
                        </button>
                      ))}
                    {assigneeOptions.filter((p) => {
                      if (!assigneeSearch.trim()) return true;
                      const name = (p?.display_name || p?.email || "").toLowerCase();
                      return name.includes(assigneeSearch.toLowerCase());
                    }).length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">ไม่พบผู้รับงาน</p>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

          {advancedActive && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1" onClick={resetAdvanced}>
                <X className="w-3 h-3" /> ล้างตัวกรอง
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Task list */}
      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">กำลังโหลด...</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">ไม่พบงาน</Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((t) => {
            const assignee = t.assigned_to ? profileMap[t.assigned_to] : null;
            const team     = t.team_id ? teamMap[t.team_id] : null;
            const badge    = getTaskBadge(t);
            return (
              <Card
                key={t.id}
                className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${t.status === "cancelled" ? "opacity-70" : ""}`}
                onClick={() => setSelectedTask(t)}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{t.title}</h3>
                      <Badge variant="outline" className={`text-[11px] ${badge.color}`}>{badge.label}</Badge>
                      {team && (
                        <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Users className="w-3 h-3" />{team.name}
                        </span>
                      )}
                      {!team && t.assigned_to && (
                        <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                          <User className="w-3 h-3" />งานเดี่ยว
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        {renderDescription(t.description)}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs flex-wrap pt-0.5">
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                        {format(new Date(t.created_at), "d MMM yyyy HH:mm น.", { locale: th })}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {assignee ? (
                      <>
                        <Avatar className="w-7 h-7 relative">
                          <img
                            src={assignee.avatar_url ?? undefined}
                            className="w-full h-full object-cover rounded-full"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] bg-primary/10 text-primary font-semibold rounded-full">
                            {assignee.display_name?.[0]?.toUpperCase() || assignee.email?.[0]?.toUpperCase() || "?"}
                          </span>
                        </Avatar>
                        <span className="text-xs font-medium text-right max-w-[120px] truncate">
                          {assignee.display_name || assignee.email}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">ไม่มีคนรับ</span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Task detail dialog */}
      {selectedTask && (() => {
        const t = selectedTask;
        const assignee = t.assigned_to ? profileMap[t.assigned_to] : null;
        const team     = t.team_id ? teamMap[t.team_id] : null;
        const badge    = getTaskBadge(t);
        return (
          <Dialog open={!!selectedTask} onOpenChange={(o) => { if (!o) setSelectedTask(null); }}>
            <DialogContent className="max-w-md" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold leading-snug pr-4">{t.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-1">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="outline" className={badge.color}>{badge.label}</Badge>
                  {team && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Users className="w-3 h-3" /> {team.name}
                    </span>
                  )}
                  {!team && t.assigned_to && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                      <User className="w-3 h-3" /> งานเดี่ยว
                    </span>
                  )}
                </div>
                {t.description && (
                  <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground leading-relaxed">
                    {renderDescription(t.description)}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">ผู้รับงาน</p>
                    <p className="font-medium">
                      {assignee ? (assignee.display_name || assignee.email)
                        : <span className="text-slate-400 italic">ยังไม่มีคนรับ</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">วันที่สร้าง</p>
                    <p className="font-medium">{format(new Date(t.created_at), "d MMM yyyy HH:mm น.", { locale: th })}</p>
                  </div>
                </div>
                {t.review_note && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">หมายเหตุ / ผลการตรวจสอบ</p>
                    <p className="text-xs text-amber-800 whitespace-pre-line">{t.review_note}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-1">
                <Button variant="outline" onClick={() => setSelectedTask(null)}>ปิด</Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

    </div>
  );
}
