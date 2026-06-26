import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Camera, Loader2, Mail, ShieldCheck, User,
  CheckCircle2, Clock, Users, Settings, LogOut, Pencil, CalendarDays,
  CalendarCheck2, ChevronLeft, ChevronRight, Search, Plus, X,
  ArrowLeft, ExternalLink, Link2, Code2, Save, Rocket,
} from "lucide-react";

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
  discord_name: string | null;
}
interface MyTeam { team_id: string; team_name: string; position: string; team_logo_url?: string | null; }
interface MyTask {
  id: string; title: string; status: string; review_note?: string | null;
  created_at: string; team_id?: string | null; description?: string | null;
}
interface PortfolioItem {
  id: string; title: string; projectType: "team" | "solo";
  figmaLink: string; githubLink: string; otherLink: string; description: string;
}

const ROLE_LABEL: Record<string, string> = {
  developer: "Developer", ceo: "CEO", admin: "Admin",
  team_leader: "หัวหน้าทีม", member: "สมาชิก", pending: "รอยืนยัน",
};
const POSITION_LABEL: Record<string, string> = { leader: "หัวหน้าทีม", member: "สมาชิก" };

const MOCK_PORTFOLIOS: PortfolioItem[] = [
  {
    id: "pf1", title: "ระบบจัดการคลังสินค้าอัจฉริยะ", projectType: "team",
    figmaLink: "https://figma.com/file/abc123",
    githubLink: "https://github.com/team/warehouse",
    otherLink: "https://warehouse-demo.vercel.app",
    description: "โซลูชันการจัดการสต็อกสินค้าที่ใช้ AI ในการวิเคราะห์แนวโน้มความต้องการและจัดการคำสั่งซื้อโดยอัตโนมัติ เพื่อลดความผิดพลาดและเพิ่มประสิทธิภาพในการทำงานของทีมคลังสินค้า",
  },
  {
    id: "pf2", title: "LINE OA Chatbot ร้านกาแฟ", projectType: "solo",
    figmaLink: "", githubLink: "https://github.com/user/line-cafe", otherLink: "",
    description: "พัฒนา LINE Official Account Chatbot รับออเดอร์และแจ้งสถานะผ่าน LINE",
  },
  {
    id: "pf3", title: "เว็บไซต์ Portfolio นักออกแบบ", projectType: "solo",
    figmaLink: "https://figma.com/file/portfolio", githubLink: "",
    otherLink: "https://portfolio-demo.netlify.app",
    description: "ออกแบบและพัฒนาเว็บไซต์ Portfolio ส่วนตัว แสดงผลงานการออกแบบ UI/UX",
  },
];

// ── Sub-components ────────────────────────────────────────────────
function GithubIcon() {
  return (
    <svg className="w-3 h-3 fill-current shrink-0" viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}
function DiscordIcon() {
  return (
    <svg className="w-3 h-3 fill-current shrink-0" viewBox="0 0 24 24">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056 2.052 1.507 4.041 2.42 5.993 3.029a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028c1.961-.607 3.95-1.522 6.001-3.03a.076.076 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}
function BotnoiLogo() {
  return (
    <div className="flex flex-col items-center shrink-0">
      <svg viewBox="0 0 48 48" className="w-11 h-11" fill="none">
        <rect x="9" y="13" width="30" height="23" rx="6" fill="white" fillOpacity="0.88"/>
        <circle cx="17.5" cy="22.5" r="4.5" fill="#10b981"/>
        <circle cx="30.5" cy="22.5" r="4.5" fill="#10b981"/>
        <circle cx="17.5" cy="22.5" r="2"   fill="white"/>
        <circle cx="30.5" cy="22.5" r="2"   fill="white"/>
        <rect   x="18"   y="30"    width="12" height="2" rx="1" fill="#10b981"/>
        <rect   x="22"   y="6"     width="4"  height="7" rx="2" fill="white" fillOpacity="0.88"/>
        <circle cx="24"  cy="6"    r="3"                        fill="white" fillOpacity="0.88"/>
        <rect   x="5"    y="19"    width="4"  height="9" rx="2" fill="white" fillOpacity="0.6"/>
        <rect   x="39"   y="19"    width="4"  height="9" rx="2" fill="white" fillOpacity="0.6"/>
      </svg>
      <p className="text-white font-bold text-[10px] tracking-[0.2em] mt-0.5">BOTNOI</p>
      <p className="text-white/60 text-[8px] tracking-[0.15em]">CONSULTING</p>
    </div>
  );
}
function TaskTypeBadge({ type }: { type: "team" | "solo" }) {
  return type === "team" ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
      <Users className="w-2.5 h-2.5" /> งานทีม
    </span>
  ) : (
    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
      งานอิสระ
    </span>
  );
}
function PageNav({ page, total, onPrev, onNext, search, onSearch, placeholder }: {
  page: number; total: number; onPrev: () => void; onNext: () => void;
  search: string; onSearch: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder}
          className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-32 focus:outline-none focus:border-blue-300 bg-white" />
      </div>
      <div className="flex items-center gap-0.5 text-xs text-gray-500 select-none">
        <button onClick={onPrev} disabled={page === 0} className="p-0.5 hover:text-gray-700 disabled:opacity-30">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="min-w-[40px] text-center tabular-nums">{page + 1} / {total}</span>
        <button onClick={onNext} disabled={page >= total - 1} className="p-0.5 hover:text-gray-700 disabled:opacity-30">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
function FigmaBox() {
  return (
    <div className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <rect x="6.5" y="2" width="5" height="5" rx="2" fill="#FF7262"/>
        <rect x="12.5" y="2" width="5" height="5" rx="2" fill="#F24E1E"/>
        <rect x="6.5" y="9" width="5" height="5" rx="2" fill="#A259FF"/>
        <circle cx="15" cy="11.5" r="2.5" fill="#1ABCFE"/>
        <rect x="6.5" y="16" width="5" height="5" rx="2" fill="#0ACF83"/>
      </svg>
    </div>
  );
}
function GitHubBox() {
  return (
    <div className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center shrink-0">
      <Code2 className="w-5 h-5 text-gray-500" />
    </div>
  );
}
function OtherLinkBox() {
  return (
    <div className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center shrink-0">
      <Link2 className="w-5 h-5 text-gray-500" />
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────
interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  onSignOut?: () => void;
}

// ── Component ─────────────────────────────────────────────────────
export function ProfileDialog({ open, onOpenChange, onSaved, onSignOut }: ProfileDialogProps) {
  const { user, role } = useAuth();
  const [activeTab,       setActiveTab]       = useState<"profile" | "settings">("profile");
  const [confirmLogout,   setConfirmLogout]   = useState(false);
  const [profile,         setProfile]         = useState<Profile | null>(null);
  const [displayName,     setDisplayName]     = useState("");
  const [avatarPreview,   setAvatarPreview]   = useState<string | null>(null);
  const [avatarFile,      setAvatarFile]      = useState<File | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [bio,             setBio]             = useState("");
  const [githubUrl,       setGithubUrl]       = useState("");
  const [instagramUrl,    setInstagramUrl]    = useState("");
  const [facebookUrl,     setFacebookUrl]     = useState("");
  const [saving,          setSaving]          = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [bannerColor,     setBannerColor]     = useState<typeof BANNER_COLORS[0]>(
    () => BANNER_COLORS.find((c) => c.key === localStorage.getItem(BANNER_STORAGE_KEY)) ?? BANNER_COLORS[0]
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [myTeams,  setMyTeams]  = useState<MyTeam[]>([]);
  const [myTasks,  setMyTasks]  = useState<MyTask[]>([]);
  const [taskPage,        setTaskPage]        = useState(0);
  const [taskSearch,      setTaskSearch]      = useState("");
  const [portfolioPage,   setPortfolioPage]   = useState(0);
  const [portfolioSearch, setPortfolioSearch] = useState("");

  // Portfolio sub-view state
  const [portfolios,        setPortfolios]        = useState<PortfolioItem[]>([]);
  const [portfolioView,     setPortfolioView]     = useState<"add" | "edit" | "detail" | null>(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioItem | null>(null);
  const [pTitle, setPTitle] = useState("");
  const [pType,  setPType]  = useState<"team" | "solo">("team");
  const [pFigma, setPFigma] = useState("");
  const [pGithub,setPGithub]= useState("");
  const [pOther, setPOther] = useState("");
  const [pDesc,  setPDesc]  = useState("");

  useEffect(() => {
    if (!open) {
      setActiveTab("profile"); setConfirmLogout(false); setPortfolioView(null);
      return;
    }
    if (!user) return;
    setLoading(true);
    setTaskPage(0); setPortfolioPage(0); setTaskSearch(""); setPortfolioSearch("");
    setPortfolios(MOCK_PORTFOLIOS);
    Promise.all([
      supabase.from("profiles").select("id,display_name,email,avatar_url,bio,github_url,instagram_url,facebook_url,internship_start,internship_end,discord_name").eq("id", user.id).single(),
      supabase.from("team_members" as any).select("team_id,position").eq("user_id", user.id),
      supabase.from("tasks").select("id,title,status,review_note,created_at,team_id,description")
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
        const { data: teamsData } = await supabase.from("teams" as any).select("id,name,logo_url").in("id", teamIds);
        const teamMap = Object.fromEntries(((teamsData ?? []) as any[]).map((t: any) => [t.id, t]));
        setMyTeams((memberships as any[]).map((m: any) => ({
          team_id: m.team_id, team_name: teamMap[m.team_id]?.name ?? "ไม่ทราบชื่อ",
          position: m.position, team_logo_url: teamMap[m.team_id]?.logo_url ?? null,
        })));
      } else { setMyTeams([]); }
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
      display_name: displayName.trim() || null, avatar_url: newAvatarUrl,
      bio: bio.trim() || null, github_url: githubUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null, facebook_url: facebookUrl.trim() || null,
    } as any).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setProfile((prev) => prev ? { ...prev, display_name: displayName.trim() || null, avatar_url: newAvatarUrl,
      bio: bio.trim() || null, github_url: githubUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null, facebook_url: facebookUrl.trim() || null } : prev);
    setAvatarPreview(newAvatarUrl); setAvatarFile(null);
    toast.success("บันทึกโปรไฟล์แล้ว"); onSaved?.(); setActiveTab("profile");
  };

  // Portfolio handlers
  const openAddPortfolio = () => {
    setPTitle(""); setPType("team"); setPFigma(""); setPGithub(""); setPOther(""); setPDesc("");
    setPortfolioView("add");
  };
  const openEditPortfolio = (item: PortfolioItem) => {
    setPTitle(item.title); setPType(item.projectType);
    setPFigma(item.figmaLink); setPGithub(item.githubLink);
    setPOther(item.otherLink); setPDesc(item.description);
    setPortfolioView("edit");
  };
  const handleSaveNewPortfolio = () => {
    if (!pTitle.trim()) { toast.error("กรุณาใส่ชื่อโปรเจกต์"); return; }
    const newItem: PortfolioItem = {
      id: `pf_${Date.now()}`, title: pTitle.trim(), projectType: pType,
      figmaLink: pFigma.trim(), githubLink: pGithub.trim(),
      otherLink: pOther.trim(), description: pDesc.trim(),
    };
    setPortfolios((prev) => [newItem, ...prev]);
    toast.success("เพิ่มผลงานแล้ว");
    setPortfolioView(null);
  };
  const handleSaveEditPortfolio = () => {
    if (!pTitle.trim()) { toast.error("กรุณาใส่ชื่อโปรเจกต์"); return; }
    if (!selectedPortfolio) return;
    const updated: PortfolioItem = {
      ...selectedPortfolio, title: pTitle.trim(), projectType: pType,
      figmaLink: pFigma.trim(), githubLink: pGithub.trim(),
      otherLink: pOther.trim(), description: pDesc.trim(),
    };
    setPortfolios((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setSelectedPortfolio(updated);
    toast.success("แก้ไขผลงานแล้ว");
    setPortfolioView("detail");
  };

  // ── Computed ────────────────────────────────────────────────────
  const initials      = (user?.email ?? "?").split("@")[0].slice(0, 2).toUpperCase();
  const activeTasks   = myTasks.filter((t) => t.status === "in_progress");
  const waitingTasks  = myTasks.filter((t) => t.status === "done");
  const approvedTasks = myTasks.filter((t) => t.status === "approved");
  const totalTasks    = activeTasks.length + waitingTasks.length + approvedTasks.length;
  const progressPct   = totalTasks > 0 ? Math.round((approvedTasks.length / totalTasks) * 100) : 0;

  let internshipLabel = "";
  let remainingDays: number | null = null;
  if (profile?.internship_start && profile?.internship_end) {
    const fmtEN = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const start = new Date(profile.internship_start);
    const end   = new Date(profile.internship_end);
    internshipLabel = `${fmtEN(start)} - ${fmtEN(end)}`;
    remainingDays   = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  }
  const githubName = profile?.github_url
    ?.replace(/^https?:\/\/(www\.)?github\.com\//, "").split("/")[0] ?? null;

  // Task pagination
  const currentTasks   = [...activeTasks, ...waitingTasks];
  const filteredTasks  = currentTasks.filter((t) =>
    !taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase())
  );
  const taskPages  = Math.ceil(filteredTasks.length / 3) || 1;
  const shownTasks = filteredTasks.slice(taskPage * 3, taskPage * 3 + 3);

  // Portfolio pagination
  const filteredPortfolio = portfolios.filter((p) =>
    !portfolioSearch || p.title.toLowerCase().includes(portfolioSearch.toLowerCase())
  );
  const portfolioPages = Math.ceil(filteredPortfolio.length / 3) || 1;
  const shownPortfolio = filteredPortfolio.slice(portfolioPage * 3, portfolioPage * 3 + 3);

  // Shared form fields JSX
  const portfolioFormFields = (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">ชื่อโปรเจกต์ (Project Title)</label>
        <input value={pTitle} onChange={(e) => setPTitle(e.target.value)}
          placeholder="Enter your project name"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-gray-50" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">ประเภทงาน (Project Type)</label>
        <div className="flex gap-2">
          {(["team", "solo"] as const).map((t) => (
            <button key={t} onClick={() => setPType(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-medium transition-colors ${
                pType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}>
              {t === "team" ? <><Users className="w-4 h-4" /> งานทีม</> : <><User className="w-4 h-4" /> งานอิสระ</>}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">PROJECT LINKS</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FigmaBox />
            <input value={pFigma} onChange={(e) => setPFigma(e.target.value)} placeholder="Figma Link"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-gray-50" />
          </div>
          <div className="flex items-center gap-2">
            <GitHubBox />
            <input value={pGithub} onChange={(e) => setPGithub(e.target.value)} placeholder="GitHub Repository"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-gray-50" />
          </div>
          <div className="flex items-center gap-2">
            <OtherLinkBox />
            <input value={pOther} onChange={(e) => setPOther(e.target.value)} placeholder="Other Links (Portfolio, Demo, etc.)"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-gray-50" />
          </div>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Description</label>
        <textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} rows={4}
          placeholder="Briefly describe your project and your role..."
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-gray-50 resize-none" />
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${activeTab === "settings" ? "max-w-md" : portfolioView ? "max-w-[400px]" : "max-w-[820px]"} p-0 rounded-2xl gap-0 overflow-hidden flex flex-col [&>button]:hidden`}
        style={{ maxHeight: "92vh" }}
        aria-describedby={undefined}
        onClick={() => showColorPicker && setShowColorPicker(false)}
      >

        {/* ── BANNER ── */}
        <div
          className="relative shrink-0 px-6 py-5"
          style={{ background: `linear-gradient(135deg, ${bannerColor.from}, ${bannerColor.to})` }}
        >
          {/* Gear (color picker) — top left */}
          <button type="button"
            className="absolute top-3 left-3 z-10 w-7 h-7 bg-white/20 hover:bg-white/35 rounded-full flex items-center justify-center transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowColorPicker((v) => !v); }}
            title="เปลี่ยนสีแบนเนอร์">
            <Settings className="w-3.5 h-3.5 text-white" />
          </button>

          {/* Color picker popover */}
          {showColorPicker && (
            <div className="absolute top-11 left-3 z-50 bg-card border rounded-xl shadow-lg p-2.5 flex flex-wrap gap-1.5 w-48"
              onClick={(e) => e.stopPropagation()}>
              {BANNER_COLORS.map((c) => (
                <button key={c.key} type="button" title={c.label}
                  onClick={() => { setBannerColor(c); localStorage.setItem(BANNER_STORAGE_KEY, c.key); setShowColorPicker(false); }}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${bannerColor.key === c.key ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`}
                  style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }} />
              ))}
            </div>
          )}

          {/* X close — top right */}
          <button onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 z-10 text-white/60 hover:text-white p-1 rounded-md transition-colors">
            <X className="w-4 h-4" />
          </button>

          {/* Avatar + Info + Logo */}
          <div className="flex items-start gap-4 px-1 pt-1 pr-10">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-[68px] h-[68px] rounded-full border-4 border-white/30 overflow-hidden bg-white/20 flex items-center justify-center">
                {avatarPreview
                  ? <img src={avatarPreview} className="w-full h-full object-cover" alt="avatar" />
                  : <span className="text-white text-xl font-bold">{profile?.display_name?.[0]?.toUpperCase() ?? initials}</span>
                }
              </div>
              <button type="button"
                className="absolute bottom-0.5 right-0.5 w-6 h-6 bg-foreground rounded-full border-2 border-white/30 flex items-center justify-center hover:opacity-80 transition-opacity"
                onClick={() => fileRef.current?.click()}>
                <Camera className="w-3 h-3 text-background" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกิน 2MB"); return; }
                  setAvatarFile(file);
                  const reader = new FileReader();
                  reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-white font-bold text-lg leading-tight">
                  {profile?.display_name || user?.email?.split("@")[0] || "—"}
                </h2>
                <button type="button" onClick={() => setActiveTab("settings")}
                  className="text-white/60 hover:text-white transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-white/80 text-xs mt-0.5">{user?.email}</p>
              {role && (
                <div className="mt-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-white/20 bg-white/15 text-white">
                    <ShieldCheck className="w-3 h-3" />
                    {ROLE_LABEL[role] ?? role}
                  </span>
                </div>
              )}
              {internshipLabel && (
                <div className="mt-2 space-y-0.5">
                  <p className="flex items-center gap-1.5 text-white/80 text-[11px]">
                    <CalendarDays className="w-3 h-3 shrink-0" />
                    Internship Period: {internshipLabel}
                  </p>
                  <p className="flex items-center gap-1.5 text-white/80 text-[11px]">
                    <Clock className="w-3 h-3 shrink-0" />
                    Remaining: {remainingDays} days
                  </p>
                </div>
              )}
              {/* Social badges */}
              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                {githubName && (
                  <a href={profile!.github_url!} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-900 text-white text-[11px] font-medium hover:bg-gray-800 transition-colors">
                    <GithubIcon /> {githubName}
                  </a>
                )}
                {profile?.discord_name && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5865F2] text-white text-[11px] font-medium">
                    <DiscordIcon /> {profile.discord_name}
                  </span>
                )}
              </div>
            </div>

            <BotnoiLogo />
          </div>
        </div>

        {/* ══ SETTINGS MODE ══ */}
        {activeTab === "settings" ? (
          <>
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
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          </>
        ) : (

        /* ══ PROFILE MODE ══ */
        <>
          {portfolioView ? (
            /* ── PORTFOLIO SUB-VIEW (replaces content area) ── */
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white">

              {/* ADD */}
              {portfolioView === "add" && (
                <>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <h3 className="font-semibold text-gray-800">แนบผลงาน</h3>
                    <button onClick={() => setPortfolioView(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    {portfolioFormFields}
                  </div>
                  <div className="px-5 pb-5 pt-2 shrink-0">
                    <button onClick={handleSaveNewPortfolio}
                      className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 text-sm transition-colors">
                      <Save className="w-4 h-4" /> บันทึก
                    </button>
                  </div>
                </>
              )}

              {/* EDIT */}
              {portfolioView === "edit" && (
                <>
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 shrink-0">
                    <button onClick={() => setPortfolioView("detail")} className="text-gray-500 hover:text-gray-700 transition-colors">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="font-semibold text-gray-800">แก้ไขผลงาน</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    {portfolioFormFields}
                  </div>
                  <div className="px-5 pb-5 pt-2 shrink-0">
                    <button onClick={handleSaveEditPortfolio}
                      className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 text-sm transition-colors">
                      <Save className="w-4 h-4" /> บันทึก
                    </button>
                  </div>
                </>
              )}

              {/* DETAIL */}
              {portfolioView === "detail" && selectedPortfolio && (
                <>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <p className="text-sm font-semibold text-gray-600">ผลงาน</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditPortfolio(selectedPortfolio)}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setPortfolioView(null)}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    <div className="flex gap-2 mb-3 flex-wrap">
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-medium border border-green-200">Completed</span>
                      <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-[11px] font-medium border border-gray-200">
                        {selectedPortfolio.projectType === "team" ? "งานทีม" : "งานอิสระ"}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2 leading-snug">{selectedPortfolio.title}</h2>
                    {selectedPortfolio.description && (
                      <p className="text-sm text-gray-500 leading-relaxed mb-5">{selectedPortfolio.description}</p>
                    )}
                    {(selectedPortfolio.figmaLink || selectedPortfolio.githubLink || selectedPortfolio.otherLink) && (
                      <>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">PROJECT LINKS</p>
                        <div className="space-y-3">
                          {selectedPortfolio.figmaLink && (
                            <a href={selectedPortfolio.figmaLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                              <FigmaBox />
                              <div>
                                <p className="text-sm font-semibold text-gray-800">Figma Design</p>
                                <p className="text-xs text-gray-400">UI/UX Prototypes</p>
                              </div>
                            </a>
                          )}
                          {selectedPortfolio.githubLink && (
                            <a href={selectedPortfolio.githubLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                              <GitHubBox />
                              <div>
                                <p className="text-sm font-semibold text-gray-800">GitHub Repository</p>
                                <p className="text-xs text-gray-400">Source code & documentation</p>
                              </div>
                            </a>
                          )}
                          {selectedPortfolio.otherLink && (
                            <a href={selectedPortfolio.otherLink} target="_blank" rel="noopener noreferrer"
                              className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-center shrink-0">
                                  <Rocket className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-blue-600">Live Demo</p>
                                  <p className="text-xs text-gray-400">View production build</p>
                                </div>
                              </div>
                              <ExternalLink className="w-4 h-4 text-blue-500 shrink-0" />
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="px-5 pb-5 pt-2 shrink-0">
                    <button onClick={() => setPortfolioView(null)}
                      className="w-full py-2.5 border border-gray-200 rounded-xl font-medium text-gray-700 text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                      <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
                    </button>
                  </div>
                </>
              )}

            </div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/60">

              {/* ── Stats + Teams + Progress ── */}
              <div className="grid grid-cols-2 bg-white border-b border-gray-100">

                {/* LEFT: ภาพรวมกิจกรรม */}
                <div className="p-5 border-r border-gray-100">
                  <p className="text-sm font-semibold text-gray-700 mb-3">ภาพรวมกิจกรรม</p>
                  <div className="space-y-2.5">
                    {[
                      { label: "กำลังดำเนินการ", value: activeTasks.length,   Icon: CalendarCheck2, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
                      { label: "รอดำเนินการ",     value: waitingTasks.length,  Icon: Clock,          iconBg: "bg-gray-50", iconColor: "text-gray-400" },
                      { label: "เสร็จสมบูรณ์",    value: approvedTasks.length, Icon: CheckCircle2,   iconBg: "bg-blue-50", iconColor: "text-blue-500" },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 bg-white shadow-sm">
                        <div>
                          <p className="text-xs text-gray-500">{s.label}</p>
                          <p className="text-2xl font-bold text-blue-600 mt-0.5 tabular-nums">
                            {String(s.value).padStart(2, "0")}
                          </p>
                        </div>
                        <div className={`p-2 rounded-xl ${s.iconBg}`}>
                          <s.Icon className={`w-5 h-5 ${s.iconColor}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RIGHT: ทีมของฉัน + ความคืบหน้า */}
                <div className="p-5 flex flex-col gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">ทีมของฉัน</p>
                    {myTeams.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">ยังไม่ได้อยู่ในทีมใด</p>
                    ) : (
                      <div className="space-y-2">
                        {myTeams.map((t) => (
                          <div key={t.team_id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 bg-white shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <Users className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{t.team_name}</p>
                              <p className="text-xs text-gray-400">{POSITION_LABEL[t.position] ?? t.position}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">ความคืบหน้าการทำงาน</p>
                    <div className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">ความคืบหน้าโดยรวม</span>
                        <span className="text-base font-bold text-blue-600">{progressPct}%</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 border-t border-gray-50 pt-2">
                        <span>เสร็จสิ้น <span className="font-bold text-gray-700 ml-0.5">{approvedTasks.length}</span></span>
                        <span>งานทั้งหมด <span className="font-bold text-gray-700 ml-0.5">{totalTasks}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── งานที่กำลังทำ ── */}
              <div className="mt-2 bg-white p-5">
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-700">งานที่กำลังทำ</p>
                  <PageNav
                    page={taskPage} total={taskPages}
                    onPrev={() => setTaskPage((p) => Math.max(0, p - 1))}
                    onNext={() => setTaskPage((p) => Math.min(taskPages - 1, p + 1))}
                    search={taskSearch} onSearch={(v) => { setTaskSearch(v); setTaskPage(0); }}
                    placeholder="ค้นหางาน..."
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {shownTasks.map((t) => (
                    <div key={t.id} className="rounded-xl border border-gray-100 p-3.5 bg-white hover:shadow-sm transition-shadow">
                      <TaskTypeBadge type={t.team_id ? "team" : "solo"} />
                      <p className="text-sm font-semibold text-gray-800 mt-2 leading-snug">{t.title}</p>
                      {t.description && (
                        <p className="text-[11px] text-gray-400 mt-1 leading-relaxed line-clamp-2">{t.description}</p>
                      )}
                    </div>
                  ))}
                  {shownTasks.length === 0 && (
                    <div className="col-span-3 py-8 text-center text-xs text-gray-400">ไม่มีงานที่กำลังทำ</div>
                  )}
                </div>
              </div>

              {/* ── ผลงาน ── */}
              <div className="mt-2 bg-white p-5">
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-700">ผลงาน</p>
                    <button onClick={openAddPortfolio}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors">
                      <Plus className="w-3 h-3" /> เพิ่มผลงาน
                    </button>
                  </div>
                  <PageNav
                    page={portfolioPage} total={portfolioPages}
                    onPrev={() => setPortfolioPage((p) => Math.max(0, p - 1))}
                    onNext={() => setPortfolioPage((p) => Math.min(portfolioPages - 1, p + 1))}
                    search={portfolioSearch} onSearch={(v) => { setPortfolioSearch(v); setPortfolioPage(0); }}
                    placeholder="ค้นหาผลงาน..."
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {shownPortfolio.map((item) => (
                    <div key={item.id}
                      onClick={() => { setSelectedPortfolio(item); setPortfolioView("detail"); }}
                      className="flex gap-2 rounded-xl border border-gray-100 p-3.5 bg-white hover:shadow-sm transition-shadow cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <TaskTypeBadge type={item.projectType} />
                        <p className="text-sm font-semibold text-gray-800 mt-2 leading-snug">{item.title}</p>
                        {item.description && (
                          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-6" />
                    </div>
                  ))}
                  {shownPortfolio.length === 0 && (
                    <div className="col-span-3 py-8 text-center text-xs text-gray-400">ยังไม่มีผลงาน</div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ── Logout footer (only when not in sub-view) ── */}
          {!portfolioView && (
            <div className="flex justify-end px-5 py-3 border-t border-gray-100 bg-white shrink-0">
              {confirmLogout ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">ยืนยันออกจากระบบ?</span>
                  <Button variant="outline" size="sm" onClick={() => setConfirmLogout(false)}>ยกเลิก</Button>
                  <Button variant="destructive" size="sm" className="gap-1.5" onClick={onSignOut}>
                    <LogOut className="w-3.5 h-3.5" /> ออกจากระบบ
                  </Button>
                </div>
              ) : (
                onSignOut && (
                  <button onClick={() => setConfirmLogout(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors">
                    <LogOut className="w-4 h-4" /> ออกจากระบบ
                  </button>
                )
              )}
            </div>
          )}
        </>
        )}

      </DialogContent>
    </Dialog>
  );
}
