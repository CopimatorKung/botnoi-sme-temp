import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Camera, Loader2, Mail, ShieldCheck, User,
  Briefcase, CheckCircle2, Clock, Users, Link as LinkIcon, Settings, FileText, LogOut, BarChart3, Pencil, CalendarDays,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const BANNER_COLORS = [
  { key: "emerald", from: "#10b981", to: "#0d9488", label: "เขียว" },
  { key: "blue",    from: "#3b82f6", to: "#6366f1", label: "น้ำเงิน" },
  { key: "purple",  from: "#a855f7", to: "#ec4899", label: "ม่วง" },
  { key: "orange",  from: "#f97316", to: "#f59e0b", label: "ส้ม" },
  { key: "rose",    from: "#f43f5e", to: "#e11d48", label: "แดง" },
  { key: "slate",   from: "#475569", to: "#1e293b", label: "เทา" },
  { key: "sky",     from: "#0ea5e9", to: "#06b6d4", label: "ฟ้า" },
  { key: "lime",    from: "#84cc16", to: "#22c55e", label: "เขียวอ่อน" },
];
const BANNER_STORAGE_KEY = "profile_banner_color";

interface Profile {
  id: string; display_name: string | null; email: string | null;
  avatar_url: string | null; bio: string | null;
  github_url: string | null; instagram_url: string | null; facebook_url: string | null;
  internship_start: string | null; internship_end: string | null;
}
const ROLE_LABEL: Record<string, string> = {
  developer: "Developer", ceo: "CEO", admin: "Admin",
  team_leader: "หัวหน้าทีม", member: "สมาชิก", pending: "รอยืนยัน",
};
const ROLE_COLOR: Record<string, string> = {
  developer: "bg-purple-100 text-purple-700 border-purple-200",
  ceo: "bg-amber-100 text-amber-700 border-amber-200",
  admin: "bg-rose-100 text-rose-700 border-rose-200",
  team_leader: "bg-blue-100 text-blue-700 border-blue-200",
  member: "bg-slate-100 text-slate-600 border-slate-200",
  pending: "bg-gray-100 text-gray-500 border-gray-200",
};
const POSITION_LABEL: Record<string, string> = { leader: "หัวหน้าทีม", member: "สมาชิก" };

interface MyTeam { team_id: string; team_name: string; position: string; team_logo_url?: string | null; }
interface MyTask { id: string; title: string; status: string; review_note?: string | null; created_at: string; }

function parseWorkType(note?: string | null) {
  if (!note) return { workType: null, workUrl: null };
  const m = note.split("\n")[0].match(/^ประเภทงาน:\s*(.+?)(?:\s*—\s*(.+))?$/);
  return { workType: m?.[1]?.trim() ?? null, workUrl: m?.[2]?.trim() ?? null };
}

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  onSignOut?: () => void;
}

export function ProfileDialog({ open, onOpenChange, onSaved, onSignOut }: ProfileDialogProps) {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "settings">("profile");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<"7d"|"1m"|"3m"|"6m"|"1y"|"custom">("1m");
  const [chartFrom, setChartFrom] = useState("");
  const [chartTo, setChartTo] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [bio, setBio] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [bannerColor, setBannerColor] = useState<typeof BANNER_COLORS[0]>(
    () => BANNER_COLORS.find((c) => c.key === localStorage.getItem(BANNER_STORAGE_KEY)) ?? BANNER_COLORS[0]
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [myTeams, setMyTeams] = useState<MyTeam[]>([]);
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);

  useEffect(() => {
    if (!open) { setActiveTab("profile"); setConfirmLogout(false); return; }
    if (!user) return;
    setLoading(true);
    Promise.all([
      supabase.from("profiles").select("id, display_name, email, avatar_url, bio, github_url, instagram_url, facebook_url, internship_start, internship_end").eq("id", user.id).single(),
      supabase.from("team_members" as any).select("team_id, position").eq("user_id", user.id),
      supabase.from("tasks").select("id, title, status, review_note, created_at")
        .eq("assigned_to", user.id).not("status", "eq", "cancelled").order("created_at", { ascending: false }),
    ]).then(async ([{ data: prof }, { data: memberships }, { data: tasks }]) => {
      if (prof) {
        setProfile(prof as Profile);
        setDisplayName((prof as any).display_name ?? "");
        setAvatarPreview((prof as any).avatar_url ?? null);
        setBio((prof as any).bio ?? "");
        setGithubUrl((prof as any).github_url ?? "");
        setInstagramUrl((prof as any).instagram_url ?? "");
        setFacebookUrl((prof as any).facebook_url ?? "");
      }
      if (memberships && (memberships as any[]).length > 0) {
        const teamIds = (memberships as any[]).map((m: any) => m.team_id);
        const { data: teamsData } = await supabase.from("teams" as any).select("id, name, logo_url").in("id", teamIds);
        const teamMap = Object.fromEntries(((teamsData ?? []) as any[]).map((t: any) => [t.id, t]));
        setMyTeams((memberships as any[]).map((m: any) => ({
          team_id: m.team_id,
          team_name: teamMap[m.team_id]?.name ?? "ไม่ทราบชื่อ",
          position: m.position,
          team_logo_url: teamMap[m.team_id]?.logo_url ?? null,
        })));
      } else {
        setMyTeams([]);
      }
      setMyTasks((tasks as MyTask[]) ?? []);
      setLoading(false);
    });
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    let newAvatarUrl: string | null = profile?.avatar_url ?? null;
    if (avatarFile) {
      const path = `avatars/${user.id}/${Date.now()}_${avatarFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("task-attachments").upload(path, avatarFile, { upsert: true });
      if (uploadErr) { toast.error("อัปโหลดรูปไม่สำเร็จ: " + uploadErr.message); setSaving(false); return; }
      const { data: urlData } = supabase.storage.from("task-attachments").getPublicUrl(path);
      newAvatarUrl = urlData?.publicUrl ?? null;
    }
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      avatar_url: newAvatarUrl,
      bio: bio.trim() || null,
      github_url: githubUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null,
      facebook_url: facebookUrl.trim() || null,
    } as any).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setProfile((prev) => prev ? {
      ...prev,
      display_name: displayName.trim() || null,
      avatar_url: newAvatarUrl,
      bio: bio.trim() || null,
      github_url: githubUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null,
      facebook_url: facebookUrl.trim() || null,
    } : prev);
    setAvatarPreview(newAvatarUrl);
    setAvatarFile(null);
    toast.success("บันทึกโปรไฟล์แล้ว");
    onSaved?.();
    setActiveTab("profile");
  };

  const initials = (user?.email ?? "?").split("@")[0].slice(0, 2).toUpperCase();
  const activeTasks   = myTasks.filter((t) => t.status === "in_progress");
  const waitingTasks  = myTasks.filter((t) => t.status === "done");
  const approvedTasks = myTasks.filter((t) => t.status === "approved");

  const TASK_STATUS_ICON: Record<string, React.ReactNode> = {
    in_progress: <Clock className="w-3 h-3 text-yellow-500" />,
    done:        <Clock className="w-3 h-3 text-amber-500" />,
    approved:    <CheckCircle2 className="w-3 h-3 text-green-500" />,
  };
  const TASK_STATUS_LABEL: Record<string, string> = {
    in_progress: "กำลังทำ", done: "รอตรวจสอบ", approved: "ผ่านแล้ว",
  };

  // ── Chart data (used in right panel) ──────────────────────────────────────
  const PERIODS = [
    { key: "7d",     label: "7 วัน",    days: 7   },
    { key: "1m",     label: "1 เดือน",  days: 30  },
    { key: "3m",     label: "3 เดือน",  days: 90  },
    { key: "6m",     label: "6 เดือน",  days: 180 },
    { key: "1y",     label: "1 ปี",     days: 365 },
    { key: "custom", label: "กำหนดเอง", days: 30  },
  ] as const;
  const TYPE_COLORS: Record<string, string> = {
    "LINE OA": "#10b981", "แชทบอท": "#6366f1", "เว็บไซต์": "#f59e0b", "อื่นๆ": "#94a3b8",
  };
  let cutoff: Date;
  let endDate: Date = new Date();
  if (chartPeriod === "custom") {
    cutoff  = chartFrom ? new Date(chartFrom) : new Date(Date.now() - 30 * 86400000);
    endDate = chartTo   ? new Date(new Date(chartTo).getTime() + 86400000 - 1) : new Date();
  } else {
    const days = PERIODS.find((p) => p.key === chartPeriod)?.days ?? 30;
    cutoff = new Date(Date.now() - days * 86400000);
  }
  const chartFiltered = approvedTasks.filter((t) => {
    const d = new Date(t.created_at);
    return d >= cutoff && d <= endDate;
  });
  const countMap: Record<string, number> = { "LINE OA": 0, "แชทบอท": 0, "เว็บไซต์": 0, "อื่นๆ": 0 };
  chartFiltered.forEach((t) => {
    const m = (t.review_note ?? "").split("\n")[0].match(/^ประเภทงาน:\s*(.+?)(?:\s*—|$)/);
    const wt = m?.[1]?.trim();
    if (wt && countMap[wt] !== undefined) countMap[wt]++;
    else countMap["อื่นๆ"]++;
  });
  const pieData = Object.entries(countMap).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${activeTab === "settings" ? "max-w-md" : "max-w-[820px]"} p-0 rounded-3xl gap-0 overflow-hidden flex flex-col`}
        style={{ maxHeight: "90vh" }}
        aria-describedby={undefined}
        onClick={() => showColorPicker && setShowColorPicker(false)}
      >
        {/* ── Banner + Avatar ── */}
        <div className="relative shrink-0">
          <div
            className="h-24"
            style={{ background: `linear-gradient(135deg, ${bannerColor.from}, ${bannerColor.to})` }}
          />

          {/* Gear button — change banner color */}
          <button
            type="button"
            className="absolute top-3 left-3 w-7 h-7 bg-white/20 hover:bg-white/35 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); setShowColorPicker((v) => !v); }}
            title="เปลี่ยนสีแบนเนอร์"
          >
            <Settings className="w-3.5 h-3.5 text-white" />
          </button>

          {/* Color picker popover */}
          {showColorPicker && (
            <div
              className="absolute top-11 left-3 z-50 bg-card border rounded-xl shadow-lg p-2.5 flex flex-wrap gap-1.5 w-48"
              onClick={(e) => e.stopPropagation()}
            >
              {BANNER_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  title={c.label}
                  onClick={() => { setBannerColor(c); localStorage.setItem(BANNER_STORAGE_KEY, c.key); setShowColorPicker(false); }}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${bannerColor.key === c.key ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`}
                  style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                />
              ))}
            </div>
          )}

          {/* Avatar — centered, half overlapping banner bottom */}
          <div className="absolute inset-x-0 bottom-0 translate-y-1/2 flex justify-center">
            <div className="relative">
              <Avatar className="w-20 h-20 border-4 border-background shadow-md">
                <AvatarImage src={avatarPreview ?? undefined} className="object-cover" />
                <AvatarFallback className="text-2xl font-bold bg-emerald-100 text-emerald-700">
                  {profile?.display_name?.[0]?.toUpperCase() ?? initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute bottom-0.5 right-0.5 w-6 h-6 bg-foreground rounded-full border-2 border-background flex items-center justify-center hover:opacity-80 transition-opacity"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="w-3 h-3 text-background" />
              </button>
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกิน 2MB"); return; }
                  setAvatarFile(file);
                  const reader = new FileReader();
                  reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Name / email / role ── */}
        <div className="pt-12 pb-3 text-center px-6 shrink-0 relative">
          <div className="flex items-center justify-center gap-1.5">
            <p className="font-semibold text-base leading-tight">
              {profile?.display_name || user?.email?.split("@")[0]}
            </p>
            <button
              type="button"
              title="แก้ไขโปรไฟล์"
              onClick={() => setActiveTab("settings")}
              className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
          {role && (
            <Badge variant="outline" className={`text-[11px] mt-2 ${ROLE_COLOR[role] ?? ROLE_COLOR.member}`}>
              <ShieldCheck className="w-3 h-3 mr-1" />
              {ROLE_LABEL[role] ?? role}
            </Badge>
          )}
          {/* ── วันฝึกงาน ── */}
          {profile?.internship_start && profile?.internship_end && (() => {
            const start   = new Date(profile.internship_start);
            const end     = new Date(profile.internship_end);
            const today   = new Date();
            const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
            const daysLeft  = Math.ceil((end.getTime() - today.getTime()) / 86400000);
            const finished  = today > end;
            const fmt = (d: Date) => d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
            return (
              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                <span>{fmt(start)} — {fmt(end)}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  finished
                    ? "bg-slate-50 text-slate-500 border-slate-200"
                    : daysLeft <= 7
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  {finished ? `${totalDays} วัน` : `เหลือ ${daysLeft} วัน`}
                </span>
              </div>
            );
          })()}
        </div>

        {/* ══ SETTINGS MODE: full-width single column ══ */}
        {activeTab === "settings" ? (<>
          <div className="overflow-y-auto flex-1 px-6 pb-2">
            <div className="max-w-sm mx-auto space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" /> ชื่อที่แสดง
                </label>
                <Input placeholder="ใส่ชื่อที่ต้องการแสดง..." value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" /> อีเมล
                </label>
                <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm text-muted-foreground">{user?.email}</div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">โซเชียลมีเดีย</label>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                  </span>
                  <Input placeholder="https://github.com/username" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className="text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-md bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </span>
                  <Input placeholder="https://instagram.com/username" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className="text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </span>
                  <Input placeholder="https://facebook.com/username" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} className="text-sm" />
                </div>
              </div>
            </div>
          </div>
          <div className="shrink-0 px-6 py-3 border-t bg-card flex items-center gap-2">
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setActiveTab("profile")}>ยกเลิก</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </>) : (
        /* PROFILE MODE: two-column */
        <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL ── */}
        <div className="flex flex-col w-[380px] shrink-0 border-r overflow-hidden">

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (

            /* ── โปรไฟล์ tab ── */
            <div className="space-y-5 py-4">
              {profile?.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed text-center">{profile.bio}</p>
              )}
              {(profile?.github_url || profile?.instagram_url || profile?.facebook_url) && (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {profile?.github_url && (
                    <a href={profile.github_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                      GitHub
                    </a>
                  )}
                  {profile?.instagram_url && (
                    <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-muted/50 hover:bg-pink-50 hover:border-pink-200 transition-colors text-muted-foreground hover:text-pink-600">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      Instagram
                    </a>
                  )}
                  {profile?.facebook_url && (
                    <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-muted/50 hover:bg-blue-50 hover:border-blue-200 transition-colors text-muted-foreground hover:text-blue-600">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      Facebook
                    </a>
                  )}
                </div>
              )}

              {/* สถิติงาน */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> สถิติงาน
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "กำลังทำ",   value: activeTasks.length,   color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
                    { label: "รอตรวจสอบ", value: waitingTasks.length,  color: "text-amber-600",  bg: "bg-amber-50 border-amber-100" },
                    { label: "ผ่านแล้ว",  value: approvedTasks.length, color: "text-green-600",  bg: "bg-green-50 border-green-100" },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-xl border p-2.5 text-center ${s.bg}`}>
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                {(activeTasks.length + waitingTasks.length) > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">งานปัจจุบัน</p>
                    <div className="rounded-xl border divide-y overflow-hidden">
                      {[...activeTasks, ...waitingTasks].map((t) => (
                        <div key={t.id} className="flex items-center gap-2 px-3 py-2.5">
                          {TASK_STATUS_ICON[t.status]}
                          <p className="text-sm flex-1 truncate">{t.title}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                            t.status === "in_progress" ? "bg-yellow-100 text-yellow-700" : "bg-amber-100 text-amber-700"
                          }`}>{TASK_STATUS_LABEL[t.status]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ทีมที่สังกัด */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> ทีมที่สังกัด ({myTeams.length} ทีม)
                </p>
                {myTeams.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">ยังไม่ได้อยู่ในทีมใด</p>
                ) : (
                  <div className="rounded-xl border divide-y overflow-hidden">
                    {myTeams.map((t) => (
                      <div key={t.team_id} className="flex items-center gap-3 px-3 py-2.5">
                        <Avatar className="w-7 h-7 shrink-0">
                          <AvatarImage src={t.team_logo_url ?? undefined} className="object-cover" />
                          <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">{t.team_name[0]}</AvatarFallback>
                        </Avatar>
                        <p className="text-sm flex-1 truncate font-medium">{t.team_name}</p>
                        <Badge variant="outline" className={`text-[11px] shrink-0 ${
                          t.position === "leader" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}>{POSITION_LABEL[t.position] ?? t.position}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>


              {/* ผลงาน */}
              <div className="border-t pt-4 space-y-3 pb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> ผลงาน ({approvedTasks.length} งาน)
                </p>
                {approvedTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">ยังไม่มีผลงาน</p>
                ) : (
                  <div className="rounded-xl border divide-y overflow-hidden">
                    {approvedTasks.map((t) => {
                      const { workType, workUrl } = parseWorkType(t.review_note);
                      return (
                        <div key={t.id} className="px-3 py-2.5 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                            <p className="text-sm font-medium flex-1 truncate">{t.title}</p>
                            {workType && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">{workType}</span>
                            )}
                          </div>
                          {workUrl && (
                            <a href={workUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-full pl-5">
                              <LinkIcon className="w-3 h-3 shrink-0" />{workUrl}
                            </a>
                          )}
                          <p className="text-[11px] text-muted-foreground pl-5">
                            {new Date(t.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer (left panel — profile mode) */}
        <div className="shrink-0 px-6 py-3 border-t bg-card flex items-center gap-2">
          {confirmLogout ? (
            <>
              <span className="text-sm text-muted-foreground flex-1">ยืนยันออกจากระบบ?</span>
                  <Button variant="outline" size="sm" onClick={() => setConfirmLogout(false)}>ยกเลิก</Button>
                  <Button variant="destructive" size="sm" className="gap-1.5" onClick={onSignOut}>
                    <LogOut className="w-3.5 h-3.5" />ออกจากระบบ
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1" />
                  {onSignOut && (
                    <Button variant="outline" size="sm"
                      className="text-muted-foreground hover:text-red-500 hover:bg-red-50 hover:border-red-200 gap-1.5"
                      onClick={() => setConfirmLogout(true)}>
                      <LogOut className="w-3.5 h-3.5" />ออกจากระบบ
                    </Button>
                  )}
                </>
              )}
          </div>

        </div>{/* end LEFT PANEL */}

        {/* ── RIGHT PANEL — Chart ── */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-muted/20">
          <div className="flex items-center gap-1.5 px-5 pt-5 pb-3 border-b">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">กราฟผลงาน</p>
            <span className="text-xs text-muted-foreground">• {chartFiltered.length} งาน</span>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : approvedTasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6">
              <BarChart3 className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground text-center">ยังไม่มีผลงาน</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col px-5 py-4 gap-4">
              {/* Period buttons */}
              <div className="flex gap-1 flex-wrap">
                {PERIODS.map((p) => (
                  <button key={p.key} type="button" onClick={() => setChartPeriod(p.key)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                      chartPeriod === p.key
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "text-muted-foreground border-border hover:bg-muted"
                    }`}>{p.label}</button>
                ))}
              </div>

              {/* Custom date range */}
              {chartPeriod === "custom" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">ตั้งแต่</span>
                  <input type="date" value={chartFrom} max={chartTo || new Date().toISOString().split("T")[0]}
                    onChange={(e) => setChartFrom(e.target.value)}
                    className="text-xs border rounded-lg px-2 py-1 bg-background h-7 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  <span className="text-xs text-muted-foreground">ถึง</span>
                  <input type="date" value={chartTo} min={chartFrom} max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setChartTo(e.target.value)}
                    className="text-xs border rounded-lg px-2 py-1 bg-background h-7 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  {(chartFrom || chartTo) && (
                    <button type="button" onClick={() => { setChartFrom(""); setChartTo(""); }}
                      className="text-xs text-muted-foreground hover:text-red-500 transition-colors">ล้าง</button>
                  )}
                </div>
              )}

              {/* Chart */}
              {pieData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground text-center">ไม่มีผลงานในช่วงนี้</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                          {pieData.map((entry) => (<Cell key={entry.name} fill={TYPE_COLORS[entry.name]} />))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [`${v} งาน`, "จำนวน"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-center pb-2">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border"
                        style={{ borderColor: TYPE_COLORS[d.name]+"60", background: TYPE_COLORS[d.name]+"15", color: TYPE_COLORS[d.name] }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLORS[d.name] }} />
                        <span className="font-medium">{d.name}</span>
                        <span className="font-bold">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>{/* end RIGHT PANEL */}

        </div>/* end PROFILE two-column */
        )}{/* end settings/profile ternary */}
      </DialogContent>
    </Dialog>
  );
}
