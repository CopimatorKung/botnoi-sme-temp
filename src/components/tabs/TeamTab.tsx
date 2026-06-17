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
import { Check, X, ChevronDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { UserProfileViewDialog } from "@/components/UserProfileViewDialog";

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
const ROLE_BORDER: Record<ActiveRole, string> = {
  developer:   "border-l-rose-500",
  ceo:         "border-l-purple-500",
  admin:       "border-l-primary",
  team_leader: "border-l-blue-500",
  member:      "border-l-slate-300",
};
const ROLE_RING: Record<ActiveRole, string> = {
  developer:   "ring-rose-300",
  ceo:         "ring-purple-300",
  admin:       "ring-primary/40",
  team_leader: "ring-blue-300",
  member:      "ring-slate-200",
};

export function TeamTab() {
  const { role, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "pending">("active");
  const [pendingApproval, setPendingApproval] = useState<{ uid: string; name: string; role: ActiveRole } | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState<ActiveRole | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const isDeveloper = role === "developer";
  const isCEO = role === "ceo" || role === "developer";
  const isAdmin = role === "admin" || role === "ceo" || role === "developer";
  const isTeamLeader = role === "team_leader";

  useEffect(() => { load(); }, []);

  const load = async () => {
    const mockMembers: Member[] = [
      // ── สมาชิก (active) ──
      { id: "u1",  display_name: "วิชัย สุขใส",       email: "wichai@example.com",     avatar_url: null, roles: ["admin"] },
      { id: "u2",  display_name: "สมหญิง มีสุข",      email: "somying@example.com",    avatar_url: null, roles: ["ceo"] },
      { id: "u3",  display_name: "ประเสริฐ รักดี",    email: "prasert@example.com",    avatar_url: null, roles: ["developer"] },
      { id: "u4",  display_name: "นภา วงศ์ใหญ่",     email: "napa@example.com",       avatar_url: null, roles: ["team_leader"] },
      { id: "u5",  display_name: "กิตติ ชาญชัย",     email: "kitti@example.com",      avatar_url: null, roles: ["member"] },
      { id: "u6",  display_name: "อรุณี แก้วใส",     email: "arunee@example.com",     avatar_url: null, roles: ["member"] },
      { id: "u7",  display_name: "ธีระ มั่นคง",      email: "theera@example.com",     avatar_url: null, roles: ["member"] },
      { id: "u8",  display_name: "มานี รุ่งเรือง",   email: "manee@example.com",      avatar_url: null, roles: ["member"] },
      { id: "u9",  display_name: "สุชาติ ดีงาม",     email: "suchat@example.com",     avatar_url: null, roles: ["team_leader"] },
      { id: "u10", display_name: "ลลิตา พรหมดี",     email: "lalita@example.com",     avatar_url: null, roles: ["member"] },
      { id: "u13", display_name: "รัตนา ศรีสวัสดิ์", email: "rattana@example.com",    avatar_url: null, roles: ["member"] },
      { id: "u14", display_name: "บุญชัย เพชรรัตน์", email: "bunchai@example.com",    avatar_url: null, roles: ["member"] },
      { id: "u15", display_name: "สุนิสา คำแก้ว",    email: "sunisa@example.com",     avatar_url: null, roles: ["member"] },
      { id: "u16", display_name: "พิษณุ ทองดี",      email: "phitsanu@example.com",   avatar_url: null, roles: ["member"] },
      { id: "u17", display_name: "เกษรา ใจบุญ",      email: "ketsara@example.com",    avatar_url: null, roles: ["member"] },
      { id: "u18", display_name: "วรวุฒิ สมบัติ",    email: "worawut@example.com",    avatar_url: null, roles: ["team_leader"] },
      { id: "u19", display_name: "นิภาพร ชัยวงศ์",   email: "niphaporn@example.com",  avatar_url: null, roles: ["member"] },
      { id: "u20", display_name: "อภิชาติ พลอยงาม",  email: "aphichat@example.com",   avatar_url: null, roles: ["member"] },
      { id: "u21", display_name: "ปิยะนุช สุขสม",    email: "piyanut@example.com",    avatar_url: null, roles: ["member"] },
      { id: "u22", display_name: "ธนพล วิชัยดิษฐ์",  email: "thanaphon@example.com",  avatar_url: null, roles: ["member"] },
      { id: "u23", display_name: "จันทร์เพ็ญ บุญมา", email: "chanpen@example.com",    avatar_url: null, roles: ["member"] },
      { id: "u24", display_name: "ศุภชัย โกมลวิช",   email: "suphachai@example.com",  avatar_url: null, roles: ["member"] },
      { id: "u25", display_name: "ฐิติมา ลาภสมบูรณ์", email: "thitima@example.com",   avatar_url: null, roles: ["member"] },
      { id: "u26", display_name: "ณรงค์ศักดิ์ แสน",  email: "narongsak@example.com",  avatar_url: null, roles: ["admin"] },
      { id: "u27", display_name: "อัญชลี พรมราช",    email: "anchalee@example.com",   avatar_url: null, roles: ["member"] },
      { id: "u28", display_name: "สิทธิโชค นิลรัตน์", email: "sitthichok@example.com", avatar_url: null, roles: ["member"] },
      { id: "u29", display_name: "กนกพร เจริญสุข",   email: "kanokporn@example.com",  avatar_url: null, roles: ["member"] },
      { id: "u30", display_name: "ยุทธนา ขาวสุด",    email: "yuttana@example.com",    avatar_url: null, roles: ["team_leader"] },
      { id: "u31", display_name: "พรทิพย์ ศรีทอง",   email: "pornthip@example.com",   avatar_url: null, roles: ["member"] },
      { id: "u32", display_name: "ชนินทร์ วงศ์ทอง",  email: "chanin@example.com",     avatar_url: null, roles: ["member"] },
      { id: "u33", display_name: "มาลีวัลย์ ดีเลิศ", email: "maleewal@example.com",   avatar_url: null, roles: ["member"] },
      { id: "u34", display_name: "อนุชา สุวรรณภูมิ", email: "anucha@example.com",     avatar_url: null, roles: ["member"] },
      { id: "u35", display_name: "ทิพาพร เมืองแมน",  email: "thiphaporn@example.com", avatar_url: null, roles: ["member"] },
      { id: "u36", display_name: "สราวุธ ทรัพย์มาก", email: "sarawut@example.com",    avatar_url: null, roles: ["member"] },
      { id: "u37", display_name: "วันเพ็ญ จิตดี",    email: "wanpen@example.com",     avatar_url: null, roles: ["member"] },
      { id: "u38", display_name: "ภาณุพงษ์ ศักดา",   email: "phanupong@example.com",  avatar_url: null, roles: ["member"] },
      { id: "u39", display_name: "ดวงใจ ทองคำ",      email: "duangjai@example.com",   avatar_url: null, roles: ["member"] },
      { id: "u40", display_name: "วิทยา มั่งมี",      email: "wittaya@example.com",    avatar_url: null, roles: ["member"] },
      { id: "u41", display_name: "นราธิป สมศรี",      email: "narathip@example.com",   avatar_url: null, roles: ["member"] },
      { id: "u42", display_name: "สุภาวดี เกษม",      email: "suphawadi@example.com",  avatar_url: null, roles: ["member"] },
      { id: "u43", display_name: "เจษฎา พลาดิสัย",   email: "jetsada@example.com",    avatar_url: null, roles: ["member"] },
      { id: "u44", display_name: "ประภาพร ทองใบ",     email: "praphaporn@example.com", avatar_url: null, roles: ["member"] },
      { id: "u45", display_name: "กิตติศักดิ์ นาดี",  email: "kittisak@example.com",   avatar_url: null, roles: ["member"] },
      { id: "u46", display_name: "วาสนา สุขเกษม",     email: "wasana@example.com",     avatar_url: null, roles: ["member"] },
      { id: "u47", display_name: "ปราโมทย์ ขันแก้ว",  email: "pramot@example.com",     avatar_url: null, roles: ["member"] },
      { id: "u48", display_name: "ศิริพร บุญเลิศ",    email: "siriporn@example.com",   avatar_url: null, roles: ["member"] },
      { id: "u49", display_name: "เอกราช มีชัย",      email: "ekkarat@example.com",    avatar_url: null, roles: ["member"] },
      { id: "u50", display_name: "อุไรวรรณ ดาวเรือง", email: "urai@example.com",       avatar_url: null, roles: ["member"] },
      // ── รอดำเนินการ (pending) ──
      { id: "u11", display_name: "ชาตรี ใจดี",        email: "chatree@example.com",    avatar_url: null, roles: ["pending"] },
      { id: "u12", display_name: "พิมพ์ใจ นาคา",      email: "pimjai@example.com",     avatar_url: null, roles: ["pending"] },
      { id: "u51", display_name: "ธัญวรัตน์ สายฝน",   email: "thanyarat@example.com",  avatar_url: null, roles: ["pending"] },
      { id: "u52", display_name: "ภูมิพัฒน์ ชินวัตร", email: "phumiphat@example.com",  avatar_url: null, roles: ["pending"] },
      { id: "u53", display_name: "สุวนันท์ ไพโรจน์",  email: "suwanan@example.com",    avatar_url: null, roles: ["pending"] },
      { id: "u54", display_name: "ณัฐวุฒิ เรืองศรี",  email: "natthawut@example.com",  avatar_url: null, roles: ["pending"] },
      { id: "u55", display_name: "กมลชนก ปัญญา",      email: "kamonchanok@example.com",avatar_url: null, roles: ["pending"] },
      { id: "u56", display_name: "ศักดิ์สิทธิ์ วงษ์", email: "saksit@example.com",     avatar_url: null, roles: ["pending"] },
      { id: "u57", display_name: "อรอนงค์ จันทร์แดง", email: "onanong@example.com",    avatar_url: null, roles: ["pending"] },
      { id: "u58", display_name: "ปัณณทัต แสงทอง",    email: "pannathat@example.com",  avatar_url: null, roles: ["pending"] },
      { id: "u59", display_name: "ลักษณา ทวีโชค",     email: "laksana@example.com",    avatar_url: null, roles: ["pending"] },
      { id: "u60", display_name: "ภาสกร พงษ์ไพร",    email: "phasagon@example.com",   avatar_url: null, roles: ["pending"] },
      { id: "u61", display_name: "พัชรินทร์ สมใจ",    email: "patcharin@example.com",  avatar_url: null, roles: ["pending"] },
      { id: "u62", display_name: "สุรศักดิ์ เจริญชัย", email: "surasak@example.com",   avatar_url: null, roles: ["pending"] },
    ];
    setMembers(mockMembers);
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
    <div className="space-y-5">

      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">สมาชิก</h1>
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">{members.length}</span>
        </div>
      </div>

{isTeamLeader && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-50/60 border border-blue-100 text-sm text-blue-700">
          <span className="mt-0.5">🏷️</span>
          <span>คุณเป็น Team Leader — สามารถอนุมัติผู้ใช้งานใหม่เป็น Member ได้</span>
        </div>
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
              onClick={() => { setView(val); setCurrentPage(1); }}
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
                    ? val === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + role filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาชื่อหรืออีเมล..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-9 rounded-xl border border-border bg-white text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {view === "active" && (
          <Select value={roleFilter ?? "all"} onValueChange={(v) => { setRoleFilter(v === "all" ? null : v as ActiveRole); setCurrentPage(1); }}>
            <SelectTrigger className="h-10 w-40 rounded-xl border-gray-200 text-sm gap-2 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              {(["developer","ceo","admin","team_leader","member"] as ActiveRole[]).map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {(() => {
        const ROLE_ORDER: Record<string, number> = { developer: 0, ceo: 1, admin: 2, team_leader: 3, member: 4, pending: 5 };
        const getRank = (roles: string[]) => Math.min(...roles.map((r) => ROLE_ORDER[r] ?? 99));
        const filtered = members
          .filter((m) => {
            const hasActive = (["developer","ceo","admin","team_leader","member"] as ActiveRole[]).some((r) => m.roles.includes(r));
            const hasPending = m.roles.includes("pending") && !hasActive;
            if (!(view === "active" ? hasActive : hasPending)) return false;
            if (search.trim()) {
              const q = search.toLowerCase();
              if (!(m.display_name || "").toLowerCase().includes(q) && !(m.email || "").toLowerCase().includes(q)) return false;
            }
            if (view === "active" && roleFilter && !m.roles.includes(roleFilter)) return false;
            return true;
          })
          .sort((a, b) => {
            const diff = getRank(a.roles) - getRank(b.roles);
            return diff !== 0 ? diff : (a.display_name || a.email || "").localeCompare(b.display_name || b.email || "", "th");
          });
        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        const safePage = Math.min(currentPage, Math.max(1, totalPages));
        const fromEntry = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
        const toEntry = Math.min(safePage * PAGE_SIZE, filtered.length);
        const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
        return (
        <>
      <div className="grid gap-2">
        {paged.map((m) => {
          const activeRole = (["developer","ceo","admin","team_leader","member"] as ActiveRole[]).find((r) => m.roles.includes(r));
          const isPending  = m.roles.includes("pending") && !activeRole;
          const isApproving = approvingId === m.id;
          const canEdit = isAdmin && m.id !== user?.id && !!activeRole;
          const roleOptions = activeRole ? getRoleOptions(activeRole) : [];
          const isMe = m.id === user?.id;
          const ROLE_AVATAR_BG: Record<ActiveRole, string> = {
            developer: "bg-rose-500", ceo: "bg-purple-500", admin: "bg-blue-600",
            team_leader: "bg-teal-500", member: "bg-slate-400",
          };
          const avatarBg = activeRole ? ROLE_AVATAR_BG[activeRole] : "bg-yellow-400";
          const initial = (m.display_name || m.email || "?")[0].toUpperCase();

          return (
            <div
              key={m.id}
              className="bg-white border border-gray-200 rounded-xl flex items-center gap-3 px-4 py-3.5 hover:border-gray-300 hover:bg-gray-50 transition-all"
            >
              {/* Avatar */}
              <button
                type="button"
                onClick={() => setViewingUserId(m.id)}
                className={`w-10 h-10 rounded-xl ${avatarBg} flex items-center justify-center text-white font-bold text-sm shrink-0`}
              >
                {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover rounded-xl" alt="" /> : initial}
              </button>

              {/* Name + email */}
              <button
                type="button"
                className="flex-1 min-w-0 text-left"
                onClick={() => setViewingUserId(m.id)}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {m.display_name || <span className="text-gray-400 italic font-normal text-xs">ยังไม่มีโปรไฟล์</span>}
                  </p>
                  {isMe && <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">คุณ</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {m.email || <span className="font-mono text-[10px]">{m.id}</span>}
                </p>
              </button>

              {/* Role badge */}
              <div className="flex items-center gap-2 shrink-0">
                {activeRole && (
                  canEdit && roleOptions.length > 0 ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-opacity hover:opacity-80 ${ROLE_STYLE[activeRole]}`}>
                          {ROLE_LABEL[activeRole]} <ChevronDown className="w-3 h-3 opacity-70" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-44 p-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium px-2 pb-1">เปลี่ยน role เป็น</p>
                        {roleOptions.map((opt) => (
                          <button key={opt.value} onClick={() => changeRole(m.id, activeRole, opt.value)}
                            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors">
                            {opt.label}
                          </button>
                        ))}
                        <div className="border-t mt-1 pt-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="w-full text-left text-sm px-2 py-1.5 rounded text-red-500 hover:bg-red-50 transition-colors">เพิกถอน</button>
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
                                <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => revoke(m.id)}>ยืนยันลบ</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_STYLE[activeRole]}`}>{ROLE_LABEL[activeRole]}</span>
                  )
                )}
                {isPending && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-300">รออนุมัติ</span>
                )}
              </div>

              {/* Pending: อนุมัติ / ไม่อนุมัติ */}
              {isPending && (isAdmin || isTeamLeader) && m.id !== user?.id && (
                <div className="flex items-center gap-2 shrink-0">
                  {isApproving ? (
                    <>
                      <Select onValueChange={(v) => setPendingApproval({ uid: m.id, name: m.display_name || m.email || "—", role: v as ActiveRole })}>
                        <SelectTrigger className="h-8 w-40 text-xs border-blue-300 focus:ring-blue-400">
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
                      <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                        onClick={() => isTeamLeader ? approve(m.id, "member") : setApprovingId(m.id)}>
                        <Check className="w-3.5 h-3.5" /> Approve
                        {!isTeamLeader && <ChevronDown className="w-3 h-3 opacity-70" />}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-400 gap-1.5"
                        onClick={() => reject(m.id)}>
                        <X className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between px-0.5 pt-1">
        <p className="text-xs text-gray-400">
          Showing {fromEntry}–{toEntry} of {filtered.length} entries
        </p>
        {totalPages > 1 && <MemberPaginationBar currentPage={safePage} totalPages={totalPages} onChange={(p) => setCurrentPage(p)} />}
      </div>
      </>
        );
      })()}

      {/* View profile dialog */}
      <UserProfileViewDialog
        userId={viewingUserId}
        open={!!viewingUserId}
        onOpenChange={(o) => { if (!o) setViewingUserId(null); }}
      />

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
              className="bg-blue-600 hover:bg-blue-700 text-white"
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

function MemberPaginationBar({ currentPage, totalPages, onChange }: {
  currentPage: number; totalPages: number; onChange: (p: number) => void;
}) {
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }
  return (
    <div className="flex items-center justify-end gap-1 px-1">
      <button onClick={() => onChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
        className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>
        ) : (
          <button key={p} onClick={() => onChange(p as number)}
            className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium border transition-colors ${currentPage === p ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {p}
          </button>
        )
      )}
      <button onClick={() => onChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
        className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
