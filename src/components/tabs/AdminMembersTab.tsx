import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  CalendarDays,
  Pencil,
  Timer,
  Search,
  RefreshCw,
  UserCircle2,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  UsersRound,
  ArrowUpDown,
  ListFilter,
} from "lucide-react";
import { MemberProfileDialog } from "@/components/MemberProfileDialog";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  developer: "Developer",
  ceo: "CEO",
  admin: "Admin",
  team_leader: "หัวหน้าทีม",
  member: "สมาชิก",
  pending: "รอยืนยัน",
};
const ROLE_COLOR: Record<string, string> = {
  developer: "bg-purple-100 text-purple-700 border-purple-200",
  ceo: "bg-amber-100 text-amber-700 border-amber-200",
  admin: "bg-rose-100 text-rose-700 border-rose-200",
  team_leader: "bg-blue-100 text-blue-700 border-blue-200",
  member: "bg-slate-100 text-slate-600 border-slate-200",
  pending: "bg-gray-100 text-gray-500 border-gray-200",
};

const ALL_ROLES = ["developer", "ceo", "admin", "team_leader", "member", "pending"] as const;

interface MemberTeamInfo { id: string; name: string; }

interface MemberRow {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  internship_start: string | null;
  internship_end: string | null;
  role: string | null;
  teams: MemberTeamInfo[];
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = new Date(iso).setHours(23, 59, 59, 999) - Date.now();
  return Math.ceil(diff / 86400000);
}

function initials(name?: string | null, email?: string | null) {
  const n = name || email?.split("@")[0] || "?";
  return n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function AdminMembersTab() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("end_asc");
  const [profileViewId, setProfileViewId] = useState<string | null>(null);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<MemberRow | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editStart, setEditStart] = useState<string>("");
  const [editEnd, setEditEnd] = useState<string>("");
  const [noEndDate, setNoEndDate] = useState(false); // ไม่มีกำหนดวันสิ้นสุด
  const [saving, setSaving] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);

    const [
      { data: profiles, error },
      { data: roles },
      { data: memberships },
      { data: teamsData },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url, internship_start, internship_end")
        .order("display_name", { ascending: true }),
      supabase.from("user_roles" as any).select("user_id, role"),
      supabase.from("team_members" as any).select("user_id, team_id"),
      supabase.from("teams" as any).select("id, name"),
    ]);

    if (error) {
      toast.error("โหลดสมาชิกไม่สำเร็จ");
      setLoading(false);
      return;
    }

    // Role map: user_id → role
    const roleMap = Object.fromEntries(
      ((roles as any[]) ?? []).map((r: any) => [r.user_id, r.role])
    );

    // Team map: team_id → name
    const teamNameMap = Object.fromEntries(
      ((teamsData as any[]) ?? []).map((t: any) => [t.id, t.name])
    );

    // Member → teams: user_id → [{ id, name }]
    const memberTeamsMap: Record<string, MemberTeamInfo[]> = {};
    ((memberships as any[]) ?? []).forEach((m: any) => {
      if (!memberTeamsMap[m.user_id]) memberTeamsMap[m.user_id] = [];
      memberTeamsMap[m.user_id].push({
        id: m.team_id,
        name: teamNameMap[m.team_id] ?? "ไม่ทราบชื่อ",
      });
    });

    setMembers(
      ((profiles as any[]) ?? []).map((p: any) => ({
        id: p.id,
        display_name: p.display_name ?? null,
        email: p.email ?? null,
        avatar_url: p.avatar_url ?? null,
        internship_start: p.internship_start ?? null,
        internship_end: p.internship_end ?? null,
        role: roleMap[p.id] ?? null,
        teams: memberTeamsMap[p.id] ?? [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const openEdit = (m: MemberRow) => {
    setEditTarget(m);
    setEditRole(m.role ?? "member");
    setEditStart(m.internship_start ? m.internship_start.slice(0, 10) : "");
    setEditEnd(m.internship_end ? m.internship_end.slice(0, 10) : "");
    setNoEndDate(!m.internship_end); // ถ้าไม่มีวันสิ้นสุด = ไม่มีกำหนด
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);

    const profileUpdate: any = {
      internship_start: editStart || null,
      internship_end: editEnd || null,
    };
    const { error: profErr } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", editTarget.id);

    if (profErr) {
      toast.error("บันทึก profiles ไม่สำเร็จ: " + profErr.message);
      setSaving(false);
      return;
    }

    // delete แล้ว insert ใหม่ (หลีกเลี่ยงปัญหา upsert constraint)
    await supabase.from("user_roles" as any).delete().eq("user_id", editTarget.id);
    const { error: roleErr } = await supabase
      .from("user_roles" as any)
      .insert({ user_id: editTarget.id, role: editRole });

    if (roleErr) {
      toast.error("บันทึก role ไม่สำเร็จ: " + roleErr.message);
      setSaving(false);
      return;
    }

    toast.success("บันทึกข้อมูลสมาชิกแล้ว ✅");
    setSaving(false);
    setEditTarget(null);
    fetchMembers();
  };

  // Filter + search
  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (m.display_name ?? "").toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q);
    const matchRole = filterRole === "all" || m.role === filterRole;

    // กรองสถานะฝึกงาน
    let matchStatus = true;
    if (filterStatus !== "all") {
      const d = daysLeft(m.internship_end);
      if (filterStatus === "active")   matchStatus = d !== null && d > 30;
      if (filterStatus === "soon")     matchStatus = d !== null && d >= 0 && d <= 30;
      if (filterStatus === "expired")  matchStatus = d !== null && d < 0;
      if (filterStatus === "unlimited") matchStatus = !!m.internship_start && !m.internship_end;
      if (filterStatus === "not_set")  matchStatus = !m.internship_start;
    }

    return matchSearch && matchRole && matchStatus;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name_asc") {
      return (a.display_name ?? a.email ?? "").localeCompare(b.display_name ?? b.email ?? "", "th");
    }
    if (sortBy === "name_desc") {
      return (b.display_name ?? b.email ?? "").localeCompare(a.display_name ?? a.email ?? "", "th");
    }
    // end_asc / end_desc: null (ไม่มีกำหนด) อยู่ท้ายเสมอ
    const da = a.internship_end ? new Date(a.internship_end).getTime() : Infinity;
    const db = b.internship_end ? new Date(b.internship_end).getTime() : Infinity;
    return sortBy === "end_desc" ? db - da : da - db;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>กำลังโหลด...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">จัดการสมาชิก</h2>
        <p className="text-sm text-muted-foreground mt-1">
          ดูและแก้ไขข้อมูลสมาชิก เช่น บทบาท และวันฝึกงาน
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ค้นหาชื่อหรืออีเมล..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Filter role */}
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-34 h-9 text-sm gap-1">
            <SelectValue placeholder="ทุก role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุก role</SelectItem>
            {ALL_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filter internship status */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9 text-sm gap-1">
            <ListFilter className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="สถานะฝึกงาน" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="active">🟢 กำลังฝึกงาน</SelectItem>
            <SelectItem value="soon">🟡 ใกล้หมด (≤30 วัน)</SelectItem>
            <SelectItem value="expired">🔴 หมดแล้ว</SelectItem>
            <SelectItem value="unlimited">∞ ไม่มีกำหนด</SelectItem>
            <SelectItem value="not_set">⬜ ยังไม่ระบุวัน</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44 h-9 text-sm gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="เรียงลำดับ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="end_asc">วันสิ้นสุด น้อย → มาก</SelectItem>
            <SelectItem value="end_desc">วันสิ้นสุด มาก → น้อย</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={fetchMembers} title="โหลดใหม่">
          <RefreshCw className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {sorted.length} / {members.length} สมาชิก
        </span>
      </div>

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UserCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">ไม่พบสมาชิก</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              onEdit={() => openEdit(m)}
              onViewProfile={() => setProfileViewId(m.id)}
            />
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              แก้ไขข้อมูลสมาชิก
            </DialogTitle>
          </DialogHeader>

          {editTarget && (
            <div className="space-y-4">
              {/* Member info summary */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={editTarget.avatar_url ?? undefined} className="object-cover" />
                  <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                    {initials(editTarget.display_name, editTarget.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {editTarget.display_name ?? editTarget.email}
                  </p>
                  {editTarget.display_name && (
                    <p className="text-xs text-muted-foreground truncate">{editTarget.email}</p>
                  )}
                </div>
              </div>

              {/* Internship dates */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                  วันเริ่มฝึกงาน
                </Label>
                <Input
                  type="date"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                    วันสิ้นสุดฝึกงาน
                  </Label>
                  {/* Toggle ไม่มีกำหนด */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={noEndDate}
                      onChange={(e) => {
                        setNoEndDate(e.target.checked);
                        if (e.target.checked) setEditEnd("");
                      }}
                      className="w-3.5 h-3.5 accent-emerald-600"
                    />
                    <span className="text-xs text-muted-foreground">ไม่มีกำหนด</span>
                  </label>
                </div>
                {noEndDate ? (
                  <div className="h-9 flex items-center px-3 rounded-md border border-dashed border-border bg-muted/40 text-xs text-muted-foreground">
                    ∞ ไม่มีกำหนดวันสิ้นสุด — จะไม่ถูกเตะออกจากระบบ
                  </div>
                ) : (
                  <Input
                    type="date"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="h-9 text-sm"
                    min={editStart || undefined}
                  />
                )}
              </div>

              {/* Preview countdown */}
              {!noEndDate && editEnd && (() => {
                const d = daysLeft(editEnd);
                if (d === null) return null;
                return (
                  <div className={cn(
                    "flex items-center gap-2 text-sm rounded-lg px-3 py-2",
                    d < 0 ? "bg-red-50 text-red-600 border border-red-200"
                    : d <= 7 ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  )}>
                    {d < 0
                      ? <><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> หมดแล้ว {Math.abs(d)} วัน</>
                      : d === 0
                      ? <><Clock3 className="w-3.5 h-3.5 shrink-0" /> วันสุดท้าย</>
                      : <><Timer className="w-3.5 h-3.5 shrink-0" /> เหลือ {d} วัน</>
                    }
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile view */}
      <MemberProfileDialog userId={profileViewId} onClose={() => setProfileViewId(null)} />
    </div>
  );
}

// ── MemberCard component ────────────────────────────────────────────────────
function MemberCard({
  member,
  onEdit,
  onViewProfile,
}: {
  member: MemberRow;
  onEdit: () => void;
  onViewProfile: () => void;
}) {
  const days = daysLeft(member.internship_end);
  const name = member.display_name ?? member.email?.split("@")[0] ?? "ไม่ทราบชื่อ";

  const countdownNode = (() => {
    if (days === null) {
      // มีวันเริ่มแต่ไม่มีวันสิ้นสุด = ไม่มีกำหนด
      if (member.internship_start)
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
            ∞ ไม่มีกำหนด
          </span>
        );
      return <span className="text-xs text-muted-foreground/60">ไม่ระบุวันสิ้นสุด</span>;
    }
    if (days < 0)
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
          <AlertTriangle className="w-3 h-3" />
          หมดแล้ว {Math.abs(days)} วัน
        </span>
      );
    if (days === 0)
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
          <Clock3 className="w-3 h-3" />
          วันสุดท้าย
        </span>
      );
    if (days <= 7)
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
          <Timer className="w-3 h-3" />
          เหลือ {days} วัน
        </span>
      );
    if (days <= 30)
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">
          <Timer className="w-3 h-3" />
          เหลือ {days} วัน
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <CheckCircle2 className="w-3 h-3" />
        เหลือ {days} วัน
      </span>
    );
  })();

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
      {/* Top row: avatar + name + role */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onViewProfile}
          className="shrink-0 hover:opacity-75 transition-opacity"
          title="ดูโปรไฟล์"
        >
          <Avatar className="w-10 h-10">
            <AvatarImage src={member.avatar_url ?? undefined} className="object-cover" />
            <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
              {initials(member.display_name, member.email)}
            </AvatarFallback>
          </Avatar>
        </button>

        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onViewProfile}
            className="text-left hover:opacity-75 transition-opacity"
            title="ดูโปรไฟล์"
          >
            <p className="font-semibold text-sm leading-tight truncate">{name}</p>
            {member.display_name && (
              <p className="text-xs text-muted-foreground truncate">{member.email}</p>
            )}
          </button>
          <div className="mt-1">
            {member.role ? (
              <Badge
                variant="outline"
                className={cn("text-[10px] px-2 py-0 h-4", ROLE_COLOR[member.role] ?? ROLE_COLOR.member)}
              >
                {ROLE_LABEL[member.role] ?? member.role}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-2 py-0 h-4 text-muted-foreground">
                ไม่ระบุ role
              </Badge>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
          title="แก้ไขข้อมูล"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Teams */}
      {member.teams.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {member.teams.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full px-2 py-0.5 font-medium"
            >
              <UsersRound className="w-3 h-3 shrink-0" />
              {t.name}
            </span>
          ))}
        </div>
      )}
      {member.teams.length === 0 && (
        <p className="text-xs text-muted-foreground/50">ยังไม่ได้อยู่ในทีมใด</p>
      )}

      {/* Internship dates */}
      <div className="space-y-1.5 border-t pt-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          {member.internship_start || member.internship_end ? (
            <span>
              {formatDate(member.internship_start) ?? "?"}
              {" → "}
              {member.internship_end ? formatDate(member.internship_end) : "∞"}
            </span>
          ) : (
            <span className="text-muted-foreground/60">ยังไม่ระบุวันฝึกงาน</span>
          )}
        </div>
        <div>{countdownNode}</div>
      </div>
    </div>
  );
}
