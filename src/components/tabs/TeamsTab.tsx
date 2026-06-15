import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Plus, UserPlus, X, Users, Pencil, ArrowLeft,
  Clock, Crown, Briefcase, Search, Trash2,
  ChevronLeft, ChevronRight as ChevronRightIcon, LayoutGrid, List,
  CheckCircle2, Circle, SlidersHorizontal, BarChart2, TableProperties, Download,
} from "lucide-react";
import { UserProfileViewDialog } from "@/components/UserProfileViewDialog";
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface Team {
  id: string; name: string; description: string | null;
  created_by: string | null; created_at: string;
  tags: string[] | null; logo_url?: string | null;
  color_index?: number;
}
interface TeamMember {
  id: string; team_id: string; user_id: string; position: string;
}
interface Profile {
  id: string; display_name: string | null; email: string | null; avatar_url: string | null;
}
interface TaskSummary {
  id: string; title: string; status: string;
  assigned_to: string | null; team_id: string | null;
  completed_at?: string | null;
}

const SME_TAGS = Array.from({ length: 20 }, (_, i) => `#SME${String(i + 1).padStart(2, "0")}`);
const MOCK_USER_ID = "092b7016-76ca-44dc-810f-d79c42f28cad";

const TEAM_COLORS = [
  { bar: "from-blue-500 to-indigo-600",    avatar: "bg-blue-500",    light: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    hover: "hover:bg-blue-50"    },
  { bar: "from-emerald-400 to-teal-600",   avatar: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", hover: "hover:bg-emerald-50" },
  { bar: "from-orange-400 to-red-500",     avatar: "bg-orange-500",  light: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  hover: "hover:bg-orange-50"  },
  { bar: "from-violet-500 to-purple-600",  avatar: "bg-violet-500",  light: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200",  hover: "hover:bg-violet-50"  },
  { bar: "from-pink-400 to-rose-600",      avatar: "bg-pink-500",    light: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-200",    hover: "hover:bg-pink-50"    },
  { bar: "from-cyan-400 to-blue-500",      avatar: "bg-cyan-500",    light: "bg-cyan-50",    text: "text-cyan-700",    border: "border-cyan-200",    hover: "hover:bg-cyan-50"    },
];
const getTeamColor = (team: Team) =>
  TEAM_COLORS[team.color_index ?? (team.id.charCodeAt(team.id.length - 1) % TEAM_COLORS.length)];

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
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"large" | "small">("large");
  const [detailTab, setDetailTab] = useState<"intro" | "tasks" | "members">("intro");
  const [chartRange, setChartRange] = useState<"1w" | "1m" | "3m" | "6m" | "1y" | "custom">("1m");
  const [customStart, setCustomStart] = useState("2026-05-09");
  const [customEnd, setCustomEnd] = useState("2026-06-08");
  const [showMemberStats, setShowMemberStats] = useState(false);
  const [memberEditMode, setMemberEditMode] = useState(false);
  const [contribLogMember, setContribLogMember] = useState<{ name: string; userId: string } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newColorIndex, setNewColorIndex] = useState(0);
  const [newLogoPreview, setNewLogoPreview] = useState<string | null>(null);
  const newLogoRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTag, setEditTag] = useState("");
  const [editColorIndex, setEditColorIndex] = useState(0);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const editLogoRef = useRef<HTMLInputElement>(null);
  const [updating, setUpdating] = useState(false);

  const [inviteDialogTeamId, setInviteDialogTeamId] = useState<string | null>(null);
  const [inviteSearch, setInviteSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const [removeTarget, setRemoveTarget] = useState<{ memberId: string; name: string; teamName: string } | null>(null);
  const [swapTarget, setSwapTarget] = useState<{ memberId: string; teamId: string; newLeaderName: string; oldLeaderName: string } | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  useEffect(() => { loadMock(); }, []);

  useEffect(() => {
    if (!initialTeamId || teams.length === 0) return;
    const t = teams.find((t) => t.id === initialTeamId);
    if (t) { setSelectedTeam(t); clearInitialTeam?.(); }
  }, [initialTeamId, teams]);

  useEffect(() => { setDetailTab("intro"); setChartRange("1m"); setShowMemberStats(false); setMemberEditMode(false); }, [selectedTeam?.id]);

  const loadMock = () => {
    const mockProfiles: Profile[] = [
      { id: MOCK_USER_ID, display_name: "Demo Admin", email: "examini011@gmail.com", avatar_url: null },
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `user-${String(i + 1).padStart(3, "0")}`,
        display_name: ["สมชาย ใจดี","มานี รักดี","วิชัย สุขใส","นภา พงษ์ดี","กิตติ์ เจริญ","ปิยะ รุ่งเรือง","อรุณ สว่าง","ธนา ศรีสุข","พิมพ์ ใจงาม","เอก ชาญชัย","นุ่น สุดสวย","ต้น มั่นคง","ฝน พรมมา","บอส วงษ์ดี","นิค ชัยศรี","เบล สุขสม","แบม รุ่งโรจน์","ป้อม ดีงาม","มิ้น จิตดี","แพร พรพิมล"][i],
        email: `user${i + 1}@example.com`,
        avatar_url: null,
      })),
    ];
    const teamData = [
      { name: "ทีม Alpha",    desc: "ทีมหลักดูแลลูกค้า SME",              tag: "#SME01" },
      { name: "ทีม Beta",     desc: "ทีมสนับสนุนการขาย",                  tag: "#SME02" },
      { name: "ทีม Gamma",    desc: "ทีมวิเคราะห์ข้อมูลตลาด",             tag: "#SME03" },
      { name: "ทีม Delta",    desc: "ดูแลลูกค้าภาคเหนือ",                 tag: "#SME04" },
      { name: "ทีม Epsilon",  desc: "ดูแลลูกค้าภาคใต้",                   tag: "#SME05" },
      { name: "ทีม Zeta",     desc: "ทีมลูกค้าองค์กรขนาดใหญ่",            tag: "#SME01" },
      { name: "ทีม Eta",      desc: "ทีมพัฒนาธุรกิจใหม่",                 tag: "#SME06" },
      { name: "ทีม Theta",    desc: "ดูแลลูกค้าภาคกลาง",                  tag: "#SME07" },
      { name: "ทีม Iota",     desc: "ทีมลูกค้าด้านเทคโนโลยี",             tag: "#SME08" },
      { name: "ทีม Kappa",    desc: "ทีมสื่อสารการตลาดดิจิทัล",           tag: "#SME09" },
      { name: "ทีม Lambda",   desc: "ทีมดูแลลูกค้าธุรกิจค้าปลีก",         tag: "#SME10" },
      { name: "ทีม Mu",       desc: "ทีมลูกค้าอสังหาริมทรัพย์",           tag: "#SME11" },
      { name: "ทีม Nu",       desc: "ดูแลลูกค้าภาคตะวันออก",              tag: "#SME12" },
      { name: "ทีม Xi",       desc: "ทีมลูกค้าธุรกิจนำเข้าส่งออก",        tag: "#SME13" },
      { name: "ทีม Omicron",  desc: "ทีมลูกค้าอุตสาหกรรมการผลิต",         tag: "#SME14" },
      { name: "ทีม Pi",       desc: "ทีมพาร์ทเนอร์เชิงกลยุทธ์",           tag: "#SME15" },
      { name: "ทีม Rho",      desc: "ทีมลูกค้าธุรกิจบริการ",              tag: "#SME16" },
      { name: "ทีม Sigma",    desc: "ทีมวิเคราะห์ประสิทธิภาพการขาย",      tag: "#SME17" },
      { name: "ทีม Tau",      desc: "ดูแลลูกค้าภาคตะวันตก",               tag: "#SME18" },
      { name: "ทีม Upsilon",  desc: "ทีมลูกค้าธุรกิจอาหารและเครื่องดื่ม", tag: "#SME19" },
      { name: "ทีม Phi",      desc: "ทีมลูกค้าธุรกิจสุขภาพ",              tag: "#SME20" },
      { name: "ทีม Chi",      desc: "ทีมลูกค้าการศึกษา",                  tag: "#SME01" },
      { name: "ทีม Psi",      desc: "ทีมลูกค้าโลจิสติกส์",               tag: "#SME02" },
      { name: "ทีม Omega",    desc: "ทีมลูกค้าท่องเที่ยวและโรงแรม",       tag: "#SME03" },
      { name: "ทีม Aurora",   desc: "ทีมพัฒนาความสัมพันธ์ลูกค้า VIP",     tag: "#SME04" },
      { name: "ทีม Blaze",    desc: "ทีมขยายตลาดภูมิภาค",                 tag: "#SME05" },
      { name: "ทีม Coral",    desc: "ทีมลูกค้าธุรกิจแฟชั่น",             tag: "#SME06" },
      { name: "ทีม Drift",    desc: "ทีมพัฒนาผลิตภัณฑ์ใหม่",              tag: "#SME07" },
      { name: "ทีม Echo",     desc: "ทีมสนับสนุนเทคนิค",                  tag: "#SME08" },
      { name: "ทีม Frost",    desc: "ทีมลูกค้าภาคตะวันออกเฉียงเหนือ",     tag: "#SME09" },
      { name: "ทีม Gale",     desc: "ทีมลูกค้าธุรกิจพลังงาน",             tag: "#SME10" },
      { name: "ทีม Halo",     desc: "ทีมดูแลลูกค้าระดับ Premium",          tag: "#SME11" },
      { name: "ทีม Indigo",   desc: "ทีมลูกค้าธุรกิจสื่อและบันเทิง",      tag: "#SME12" },
      { name: "ทีม Jade",     desc: "ทีมขยายฐานลูกค้าใหม่",               tag: "#SME13" },
      { name: "ทีม Karma",    desc: "ทีมลูกค้าธุรกิจการเงิน",             tag: "#SME14" },
      { name: "ทีม Lumen",    desc: "ทีมพัฒนาโซลูชั่น LINE OA",           tag: "#SME15" },
      { name: "ทีม Maple",    desc: "ทีมลูกค้าธุรกิจเกษตร",               tag: "#SME16" },
      { name: "ทีม Nova",     desc: "ทีมนวัตกรรมและวิจัยตลาด",            tag: "#SME17" },
      { name: "ทีม Onyx",     desc: "ทีมลูกค้าธุรกิจก่อสร้าง",            tag: "#SME18" },
      { name: "ทีม Pulse",    desc: "ทีมการตลาดดิจิทัลและ Social",         tag: "#SME19" },
      { name: "ทีม Quartz",   desc: "ทีมลูกค้าธุรกิจโทรคมนาคม",           tag: "#SME20" },
      { name: "ทีม Radiant",  desc: "ทีมลูกค้าธุรกิจยานยนต์",             tag: "#SME01" },
      { name: "ทีม Storm",    desc: "ทีมลูกค้าธุรกิจประกันภัย",           tag: "#SME02" },
      { name: "ทีม Terra",    desc: "ทีมดูแลลูกค้าภาคกลาง (เพิ่มเติม)",   tag: "#SME03" },
      { name: "ทีม Unity",    desc: "ทีมประสานงานข้ามสายธุรกิจ",          tag: "#SME04" },
      { name: "ทีม Vega",     desc: "ทีมลูกค้าธุรกิจไอที",                tag: "#SME05" },
      { name: "ทีม Wisp",     desc: "ทีมลูกค้าธุรกิจค้าออนไลน์",          tag: "#SME06" },
      { name: "ทีม Xenon",    desc: "ทีมลูกค้าธุรกิจโรงพยาบาล",           tag: "#SME07" },
      { name: "ทีม Yonder",   desc: "ทีมพัฒนาตลาดต่างประเทศ",             tag: "#SME08" },
      { name: "ทีม Zenith",   desc: "ทีมบริหารลูกค้าสัมพันธ์ระดับสูง",    tag: "#SME09" },
      { name: "ทีม Abyss",    desc: "ทีมลูกค้าธุรกิจทะเลและประมง",        tag: "#SME10" },
      { name: "ทีม Beacon",   desc: "ทีมนำร่องโครงการ LINE OA ใหม่",      tag: "#SME11" },
      { name: "ทีม Crest",    desc: "ทีมลูกค้าธุรกิจสินค้าฟุ่มเฟือย",     tag: "#SME12" },
      { name: "ทีม Dusk",     desc: "ทีมดูแลลูกค้าเวลากลางคืน",           tag: "#SME13" },
      { name: "ทีม Ember",    desc: "ทีมลูกค้าธุรกิจร้านอาหาร",           tag: "#SME14" },
      { name: "ทีม Fable",    desc: "ทีมสร้างสรรค์คอนเทนต์และสื่อ",       tag: "#SME15" },
      { name: "ทีม Gloom",    desc: "ทีมลูกค้าธุรกิจรักษาความปลอดภัย",    tag: "#SME16" },
      { name: "ทีม Haven",    desc: "ทีมบริหารจัดการลูกค้า Long-term",     tag: "#SME17" },
      { name: "ทีม Iris",     desc: "ทีมลูกค้าธุรกิจเครื่องสำอาง",        tag: "#SME18" },
      { name: "ทีม Jewel",    desc: "ทีมลูกค้าร้านทอง-อัญมณี",            tag: "#SME19" },
      { name: "ทีม Knot",     desc: "ทีมประสานงานพาร์ทเนอร์ทั่วประเทศ",   tag: "#SME20" },
      { name: "ทีม Lunar",    desc: "ทีมลูกค้าธุรกิจท่องเที่ยวกลางคืน",   tag: "#SME01" },
      { name: "ทีม Mist",     desc: "ทีมลูกค้าธุรกิจสปาและนวด",           tag: "#SME02" },
      { name: "ทีม Neon",     desc: "ทีมลูกค้าธุรกิจไนท์ไลฟ์",           tag: "#SME03" },
      { name: "ทีม Orbit",    desc: "ทีมพัฒนาเครื่องมือ CRM ภายใน",       tag: "#SME04" },
      { name: "ทีม Prism",    desc: "ทีมลูกค้าธุรกิจสีและวัสดุ",          tag: "#SME05" },
      { name: "ทีม Quest",    desc: "ทีมสำรวจตลาดและวิจัยผู้บริโภค",       tag: "#SME06" },
      { name: "ทีม Realm",    desc: "ทีมลูกค้าธุรกิจเกม",                 tag: "#SME07" },
      { name: "ทีม Sage",     desc: "ทีมที่ปรึกษาธุรกิจ SME",             tag: "#SME08" },
      { name: "ทีม Tide",     desc: "ทีมลูกค้าภาคตะวันตก (เพิ่มเติม)",    tag: "#SME09" },
      { name: "ทีม Umbra",    desc: "ทีมลูกค้าธุรกิจซอฟต์แวร์",           tag: "#SME10" },
      { name: "ทีม Vivid",    desc: "ทีมสื่อสารแบรนด์และ PR",              tag: "#SME11" },
      { name: "ทีม Wrath",    desc: "ทีมเร่งรัดยอดขายรายไตรมาส",          tag: "#SME12" },
      { name: "ทีม Xeno",     desc: "ทีมลูกค้าธุรกิจต่างชาติในไทย",       tag: "#SME13" },
      { name: "ทีม Yield",    desc: "ทีมวิเคราะห์ ROI และผลตอบแทน",       tag: "#SME14" },
      { name: "ทีม Zeal",     desc: "ทีมเพิ่มประสิทธิภาพทีมขาย",          tag: "#SME15" },
      { name: "ทีม Apex",     desc: "ทีมสูงสุดในสายการขาย",               tag: "#SME16" },
      { name: "ทีม Bolt",     desc: "ทีมปิดการขายแบบเร่งด่วน",            tag: "#SME17" },
      { name: "ทีม Cipher",   desc: "ทีมลูกค้าธุรกิจ Cybersecurity",      tag: "#SME18" },
      { name: "ทีม Dune",     desc: "ทีมลูกค้าภาคใต้ตอนล่าง",            tag: "#SME19" },
      { name: "ทีม Epoch",    desc: "ทีมพัฒนาระบบ Automation",            tag: "#SME20" },
      { name: "ทีม Flux",     desc: "ทีมลูกค้าธุรกิจ Startup",            tag: "#SME01" },
      { name: "ทีม Grove",    desc: "ทีมลูกค้าธุรกิจเฟอร์นิเจอร์",        tag: "#SME02" },
      { name: "ทีม Helix",    desc: "ทีมลูกค้าธุรกิจวิทยาศาสตร์การแพทย์", tag: "#SME03" },
      { name: "ทีม Icon",     desc: "ทีมสร้างแบรนด์ให้ลูกค้า",            tag: "#SME04" },
      { name: "ทีม Jolt",     desc: "ทีมเร่งนำลูกค้าเข้าระบบ",            tag: "#SME05" },
      { name: "ทีม Kelp",     desc: "ทีมลูกค้าธุรกิจอาหารทะเล",           tag: "#SME06" },
      { name: "ทีม Lynx",     desc: "ทีมลูกค้าธุรกิจสัตว์เลี้ยง",         tag: "#SME07" },
      { name: "ทีม Myth",     desc: "ทีมสร้างประสบการณ์ลูกค้าแบบใหม่",    tag: "#SME08" },
      { name: "ทีม Nook",     desc: "ทีมลูกค้าธุรกิจ Co-working Space",   tag: "#SME09" },
      { name: "ทีม Omen",     desc: "ทีมพยากรณ์และวิเคราะห์แนวโน้ม",      tag: "#SME10" },
      { name: "ทีม Petal",    desc: "ทีมลูกค้าธุรกิจดอกไม้-ของขวัญ",      tag: "#SME11" },
      { name: "ทีม Ridge",    desc: "ทีมลูกค้าภาคเหนือตอนบน",             tag: "#SME12" },
      { name: "ทีม Slate",    desc: "ทีมลูกค้าธุรกิจก่อสร้างและออกแบบ",   tag: "#SME13" },
      { name: "ทีม Thorn",    desc: "ทีมจัดการลูกค้าที่มีปัญหา",          tag: "#SME14" },
      { name: "ทีม Umber",    desc: "ทีมลูกค้าธุรกิจเซรามิกและเครื่องปั้น", tag: "#SME15" },
      { name: "ทีม Vapor",    desc: "ทีมลูกค้าธุรกิจบุหรี่ไฟฟ้าและ Vape",  tag: "#SME16" },
      { name: "ทีม Woven",    desc: "ทีมลูกค้าธุรกิจสิ่งทอและเครื่องนุ่งห่ม", tag: "#SME17" },
      { name: "ทีม Xray",     desc: "ทีมตรวจสอบและ QA ลูกค้า",            tag: "#SME18" },
      { name: "ทีม Yarn",     desc: "ทีมสร้างคอนเทนต์เชิงเรื่องเล่า",     tag: "#SME19" },
      { name: "ทีม Zero",     desc: "ทีมปิดโปรเจกต์และ Closure",          tag: "#SME20" },
      { name: "ทีม Amber",    desc: "ทีมลูกค้าธุรกิจน้ำมันและปิโตรเคมี",  tag: "#SME01" },
      { name: "ทีม Brine",    desc: "ทีมลูกค้าธุรกิจเกลือและแร่ธาตุ",     tag: "#SME02" },
      { name: "ทีม Cove",     desc: "ทีมลูกค้าธุรกิจรีสอร์ทและโรงแรมชายทะเล", tag: "#SME03" },
      { name: "ทีม Dawn",     desc: "ทีมเปิดตลาดใหม่ตอนเช้า",             tag: "#SME04" },
      { name: "ทีม Ether",    desc: "ทีมลูกค้าธุรกิจ Blockchain",         tag: "#SME05" },
      { name: "ทีม Finch",    desc: "ทีมลูกค้าธุรกิจนกและสัตว์ปีก",       tag: "#SME06" },
      { name: "ทีม Grain",    desc: "ทีมลูกค้าธุรกิจข้าวและธัญพืช",       tag: "#SME07" },
      { name: "ทีม Husk",     desc: "ทีมลูกค้าธุรกิจวัสดุเหลือใช้",       tag: "#SME08" },
      { name: "ทีม Inlet",    desc: "ทีมรับลูกค้าใหม่ขาเข้า",             tag: "#SME09" },
      { name: "ทีม Jumper",   desc: "ทีมลูกค้าธุรกิจกีฬาและอุปกรณ์",      tag: "#SME10" },
    ];

    const mockTeams: Team[] = teamData.map((t, i) => ({
      id: `team-${String(i + 1).padStart(3, "0")}`,
      name: t.name, description: t.desc,
      created_by: MOCK_USER_ID,
      created_at: new Date(Date.now() - i * 86400000 * 3).toISOString(),
      tags: [t.tag], logo_url: null,
    }));

    const mockMembers: TeamMember[] = mockTeams.flatMap((team, ti) =>
      Array.from({ length: 10 }, (_, mi) => ({
        id: `mem-${team.id}-${mi}`,
        team_id: team.id,
        user_id: mi === 0 && ti === 0
          ? MOCK_USER_ID
          : `user-${String(((ti * 3 + mi) % 20) + 1).padStart(3, "0")}`,
        position: mi === 0 ? "leader" : "member",
      }))
    );

    const doneTaskTitles = [
      "ปิดการขายลูกค้า Enterprise", "ส่งรายงานสรุปผลไตรมาส",
      "อบรมทีมเรื่อง LINE OA", "ติดตามลูกค้า re-sign",
      "ทำ presentation สำหรับ pitch", "วิเคราะห์ข้อมูลลูกค้ารายใหม่",
      "อัปเดต CRM ข้อมูล Q2", "จัดประชุม kickoff โปรเจกต์",
      "ส่งมอบงาน onboarding ลูกค้าใหม่", "ทำสรุปรายงาน weekly",
      "ติดต่อประสานงาน partner", "อัปเดตข้อมูล prospect list",
      "จัดทำ proposal ลูกค้า", "ตรวจสอบ KPI รายเดือน",
      "เตรียมข้อมูลสำหรับ demo", "ทำ follow-up ลูกค้า inactive",
      "อัปเดต pipeline ประจำสัปดาห์", "จัด training session ภายใน",
      "ส่ง invoice และติดตามการชำระเงิน", "วิเคราะห์ผลการขาย Q1",
    ];
    // days-ago patterns per member index — each tells a different story
    const memberDaysAgoPatterns: number[][] = [
      [3, 10, 20, 35, 50, 70, 95, 130, 180, 240],  // mi=0 leader: กระจายตลอดปี
      [2, 5, 8, 14, 22, 35, 50, 68],               // mi=1: โหมช่วงหลัง
      [4, 18, 32, 46, 60, 74, 88, 102, 116, 130],  // mi=2: สม่ำเสมอทุก 2 สัปดาห์
      [6, 85, 90, 96, 102, 115, 130, 210, 270],    // mi=3: burst 3 เดือนที่แล้ว
      [3, 9, 17, 28, 40],                           // mi=4: สมาชิกใหม่
      [55, 85, 115, 145, 175, 210, 250, 300],       // mi=5: เริ่มลดลง
      [20, 70, 140, 220, 310],                      // mi=6: sparse
      [4, 5, 40, 41, 42, 120, 121, 250],            // mi=7: spiky — ทำทีเดียวหลายงาน
      [8, 25, 50, 85, 130, 185],                    // mi=8: moderate ทั่วไป
      [60, 150, 290],                               // mi=9: น้อยมาก
    ];

    const mockTasks: TaskSummary[] = mockTeams.flatMap((team, ti) => {
      const teamMems = mockMembers.filter((m) => m.team_id === team.id);
      const openTasks: TaskSummary[] = [
        { id: `t-${team.id}-1`, title: "ติดต่อลูกค้าประจำสัปดาห์", status: "in_progress", assigned_to: teamMems[1]?.user_id ?? null, team_id: team.id },
        { id: `t-${team.id}-2`, title: "เตรียมรายงานประจำเดือน",    status: "open",        assigned_to: teamMems[2]?.user_id ?? null, team_id: team.id },
        { id: `t-${team.id}-3`, title: "ประเมินผลลูกค้ารายไตรมาส", status: "open",        assigned_to: teamMems[3]?.user_id ?? null, team_id: team.id },
        ...(ti % 2 === 0 ? [{ id: `t-${team.id}-ip2`, title: "ประสานงานกับ partner", status: "in_progress", assigned_to: teamMems[4]?.user_id ?? null, team_id: team.id }] : []),
      ];
      const doneTasks: TaskSummary[] = teamMems.flatMap((mem, mi) => {
        const pattern = memberDaysAgoPatterns[mi] ?? memberDaysAgoPatterns[9];
        return pattern.map((daysAgo, di) => {
          const jitter = (ti * 5 + mi * 3 + di * 2) % 5; // offset เล็กน้อยต่างกันแต่ละทีม
          const d = new Date(2026, 5, 8);
          d.setDate(d.getDate() - daysAgo - jitter);
          return {
            id: `t-${team.id}-m${mi}-d${di}`,
            title: doneTaskTitles[(di + mi + ti) % doneTaskTitles.length],
            status: "done",
            assigned_to: mem.user_id,
            team_id: team.id,
            completed_at: d.toISOString(),
          };
        });
      });
      return [...openTasks, ...doneTasks];
    });

    setProfiles(mockProfiles);
    setTeams(mockTeams);
    setMembers(mockMembers);
    setTasks(mockTasks);
  };

  const getMemberName = (m: TeamMember) => {
    const p = profileMap[m.user_id];
    return p?.display_name || p?.email || m.user_id;
  };

  const createTeam = async () => {
    if (!newName.trim()) { toast.error("กรุณาใส่ชื่อทีม"); return; }
    if (!newTag) { toast.error("กรุณาเลือกประเภท SME"); return; }
    setCreating(true);
    const id = `team-${Date.now()}`;
    setTeams((prev) => [{ id, name: newName.trim(), description: newDesc.trim() || null, created_by: user?.id ?? null, created_at: new Date().toISOString(), tags: [newTag], logo_url: newLogoPreview, color_index: newColorIndex }, ...prev]);
    setMembers((prev) => [...prev, { id: `mem-${Date.now()}`, team_id: id, user_id: user?.id ?? "", position: "leader" }]);
    toast.success("สร้างทีมแล้ว");
    setCreateOpen(false); setNewName(""); setNewDesc(""); setNewTag(""); setNewColorIndex(0); setNewLogoPreview(null); setCreating(false);
  };

  const updateTeam = async () => {
    if (!editTeam || !editName.trim()) { toast.error("กรุณาใส่ชื่อทีม"); return; }
    setUpdating(true);
    setTeams((prev) => prev.map((t) => t.id === editTeam.id ? { ...t, name: editName.trim(), description: editDesc.trim() || null, tags: editTag ? [editTag] : t.tags, logo_url: editLogoPreview ?? t.logo_url, color_index: editColorIndex } : t));
    if (selectedTeam?.id === editTeam.id) setSelectedTeam((prev) => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() || null, tags: editTag ? [editTag] : prev.tags } : prev);
    toast.success("แก้ไขทีมแล้ว"); setUpdating(false); setEditOpen(false); setEditTeam(null);
  };

  const deleteTeam = (team: Team) => {
    setTeams((prev) => prev.filter((t) => t.id !== team.id));
    setMembers((prev) => prev.filter((m) => m.team_id !== team.id));
    setSelectedTeam(null); toast.success("ลบทีมแล้ว"); setDeleteTarget(null);
  };

  const addMember = (teamId: string) => {
    if (!selectedUserId) return;
    if (members.some((m) => m.team_id === teamId && m.user_id === selectedUserId)) { toast.error("สมาชิกนี้อยู่ในทีมแล้ว"); return; }
    setMembers((prev) => [...prev, { id: `mem-${Date.now()}`, team_id: teamId, user_id: selectedUserId, position: "member" }]);
    toast.success("เพิ่มสมาชิกแล้ว"); setSelectedUserId(""); setInviteSearch("");
  };

  const removeMember = (memberId: string) => {
    const m = members.find((m) => m.id === memberId);
    if (m?.position === "leader") { toast.error("กรุณาตั้งหัวหน้าทีมคนใหม่ก่อน"); return; }
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.success("นำออกแล้ว"); setRemoveTarget(null);
  };

  const changePosition = (memberId: string, _teamId: string, position: string) => {
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, position } : m));
    toast.success("เปลี่ยนตำแหน่งแล้ว");
  };

  const prepareSwapLeader = (memberId: string, teamId: string) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const leader = members.find((m) => m.team_id === teamId && m.position === "leader");
    const name = (uid: string) => { const p = profileMap[uid]; return p?.display_name || p?.email || uid; };
    setSwapTarget({ memberId, teamId, newLeaderName: name(target.user_id), oldLeaderName: leader ? name(leader.user_id) : "" });
  };

  const confirmSwapLeader = () => {
    if (!swapTarget) return;
    setSwapping(true);
    setMembers((prev) => prev.map((m) => {
      if (m.team_id !== swapTarget.teamId) return m;
      if (m.id === swapTarget.memberId) return { ...m, position: "leader" };
      if (m.position === "leader") return { ...m, position: "member" };
      return m;
    }));
    setSwapping(false); toast.success(`${swapTarget.newLeaderName} เป็นหัวหน้าทีมแล้ว`); setSwapTarget(null);
  };

  // ─── Team Detail ──────────────────────────────────────────────────────────
  if (selectedTeam) {
    const team = selectedTeam;
    const color = getTeamColor(team);
    const teamMembers = members.filter((m) => m.team_id === team.id).sort((a) => a.position === "leader" ? -1 : 1);
    const teamTasks = tasks.filter((t) => t.team_id === team.id);
    const activeTasks = teamTasks.filter((t) => t.status === "in_progress");
    const waitingTasks = teamTasks.filter((t) => t.status === "open");
    const doneTasks = teamTasks.filter((t) => t.status === "done");
    const isLeaderOf = teamMembers.some((m) => m.user_id === user?.id && m.position === "leader");
    const canEdit = canManage && (team.created_by === user?.id || isLeaderOf || role === "admin" || role === "ceo" || role === "developer");
    const initials = team.name.slice(0, 2).toUpperCase();
    const inviteTeam = teams.find((t) => t.id === inviteDialogTeamId);
    const inviteAvailable = profiles.filter((p) => {
      if (members.some((m) => m.team_id === (inviteDialogTeamId ?? team.id) && m.user_id === p.id)) return false;
      const q = inviteSearch.toLowerCase();
      return !q || (p.display_name ?? "").toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q);
    });
    const selectedProfile = profiles.find((p) => p.id === selectedUserId);

    // ── Chart data ───────────────────────────────────────────────────────────
    const statusChartData = [
      { name: "รอรับงาน", value: waitingTasks.length, color: "#f59e0b" },
      { name: "กำลังทำ",  value: activeTasks.length,  color: "#818cf8" },
      { name: "ผ่านแล้ว", value: doneTasks.length,    color: "#34d399" },
    ].filter((d) => d.value > 0);

    const typeChartData = [
      { name: team.tags?.[0] ?? "LINE OA", value: teamTasks.length, color: "#34d399" },
    ];

    const memberContribData = teamMembers.map((m) => {
      const p = profileMap[m.user_id];
      const name = p?.display_name || p?.email?.split("@")[0] || "?";
      const count = tasks.filter((t) => t.team_id === team.id && t.assigned_to === m.user_id).length;
      return { name, userId: m.user_id, count, isLeader: m.position === "leader" };
    }).sort((a, b) => b.count - a.count);
    const maxContrib = Math.max(...memberContribData.map((m) => m.count), 1);

    const thaiMonths = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    const generateLineData = () => {
      let rangeStart: Date;
      let rangeEnd: Date;
      let step: number;

      if (chartRange === "custom") {
        rangeStart = new Date(customStart);
        rangeEnd   = new Date(customEnd);
        if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime()) || rangeStart >= rangeEnd) return [];
        const diffDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000);
        step = diffDays <= 14 ? 1 : diffDays <= 60 ? 7 : diffDays <= 180 ? 14 : 30;
      } else {
        const now = new Date(2026, 5, 8);
        const cfg: Record<string, { days: number; step: number }> = {
          "1w": { days: 7,   step: 1  }, "1m": { days: 30,  step: 7  },
          "3m": { days: 90,  step: 14 }, "6m": { days: 180, step: 30 },
          "1y": { days: 365, step: 30 },
        };
        const { days, step: s } = cfg[chartRange];
        step = s;
        rangeEnd = new Date(now);
        rangeStart = new Date(now);
        rangeStart.setDate(rangeStart.getDate() - days);
      }

      const completedInRange = teamTasks.filter(
        (t) => t.status === "done" && t.completed_at &&
          new Date(t.completed_at) >= rangeStart && new Date(t.completed_at) <= rangeEnd
      );

      const pts: { date: string; count: number }[] = [];
      const cursor = new Date(rangeStart);
      while (cursor <= rangeEnd) {
        const bucketStart = new Date(cursor);
        const bucketEnd   = new Date(cursor);
        bucketEnd.setDate(bucketEnd.getDate() + step);
        const count = completedInRange.filter((t) => {
          const c = new Date(t.completed_at!);
          return c >= bucketStart && c < bucketEnd;
        }).length;
        pts.push({ date: `${bucketStart.getDate()} ${thaiMonths[bucketStart.getMonth()]}`, count });
        cursor.setDate(cursor.getDate() + step);
      }
      return pts;
    };
    const lineData = generateLineData();
    const totalInRange = lineData.reduce((s, p) => s + p.count, 0);
    const passRate = teamTasks.length > 0 ? Math.round((doneTasks.length / teamTasks.length) * 100) : 0;

    const RANGE_LABELS: Record<string, string> = {
      "1w": "1 สัปดาห์", "1m": "1 เดือน", "3m": "3 เดือน",
      "6m": "6 เดือน", "1y": "1 ปี", "custom": "กำหนดเอง",
    };

    const DETAIL_TABS = [
      { id: "intro" as const,   label: "แนะนำทีม" },
      { id: "tasks" as const,   label: "งานของทีม" },
      { id: "members" as const, label: "สมาชิก" },
    ];

    return (
      <div className="space-y-5">
        <button onClick={() => { setSelectedTeam(null); setDetailTab("intro"); }}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> กลับไปหน้าทีม
        </button>

        {/* Hero */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className={`h-24 bg-gradient-to-r ${color.bar}`} />
          <div className="px-6 pb-6">
            <div className="flex items-end justify-between gap-4 -mt-10 mb-4">
              <div className={`w-20 h-20 rounded-2xl ${color.avatar} flex items-center justify-center text-white text-2xl font-black shadow-lg border-4 border-white shrink-0`}>
                {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover rounded-xl" alt={team.name} /> : initials}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditTeam(team); setEditName(team.name); setEditDesc(team.description ?? ""); setEditTag(team.tags?.[0] ?? ""); setEditColorIndex(team.color_index ?? (team.id.charCodeAt(team.id.length - 1) % TEAM_COLORS.length)); setEditLogoPreview(team.logo_url ?? null); setEditOpen(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> แก้ไข
                  </button>
                  <button
                    onClick={() => { setInviteDialogTeamId(team.id); setSelectedUserId(""); setInviteSearch(""); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> เพิ่มสมาชิก
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">{team.name}</h2>
              {team.tags?.[0] && (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${color.light} ${color.text} ${color.border}`}>
                  {team.tags[0]}
                </span>
              )}
            </div>
            {team.description && <p className="mt-1 text-sm text-gray-500">{team.description}</p>}
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: "สมาชิก", value: teamMembers.length, icon: Users, color: "text-blue-600" },
                { label: "กำลังทำ", value: activeTasks.length, icon: Clock, color: "text-amber-500" },
                { label: "รอรับ", value: waitingTasks.length, icon: Briefcase, color: "text-gray-400" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-center gap-3">
                  <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
                  <div>
                    <p className="text-xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab bar — sticky so team name stays visible while scrolling */}
        <div className="sticky top-0 z-20 bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-5 h-5 rounded-md ${color.avatar} flex items-center justify-center text-white text-[9px] font-black shrink-0`}>
                {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover rounded-md" alt="" /> : initials[0]}
              </div>
              <span className="text-sm font-semibold text-gray-900 truncate">{team.name}</span>
              {team.tags?.[0] && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${color.light} ${color.text} ${color.border}`}>
                  {team.tags[0]}
                </span>
              )}
            </div>
          </div>
          <nav className="flex px-2">
            {DETAIL_TABS.map((tab) => (
              <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  detailTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab: แนะนำทีม ── */}
        {detailTab === "intro" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">เกี่ยวกับทีม</h3>
              {team.description ? (
                <p className="text-gray-600 leading-relaxed">{team.description}</p>
              ) : (
                <p className="text-gray-400 text-sm italic">ยังไม่มีคำอธิบายทีม</p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">กลุ่ม SME</p>
                  <p className="text-sm font-medium text-gray-700">{team.tags?.[0] ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">สร้างเมื่อ</p>
                  <p className="text-sm font-medium text-gray-700">
                    {new Date(team.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">สมาชิกในทีม</h3>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{teamMembers.length} คน</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowMemberStats((v) => !v)}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      showMemberStats
                        ? "bg-blue-50 border-blue-200 text-blue-600"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    รายละเอียด
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => setMemberEditMode((v) => !v)}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                        memberEditMode
                          ? "bg-amber-50 border-amber-200 text-amber-600"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      แก้ไขสมาชิก
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {teamMembers.map((m, idx) => {
                  const profile = profileMap[m.user_id];
                  const name = profile?.display_name || profile?.email?.split("@")[0] || "?";
                  const isLeader = m.position === "leader";
                  const isMe = m.user_id === user?.id;
                  const allAssigned = tasks.filter((t) => t.assigned_to === m.user_id);
                  const teamTaskCount = allAssigned.filter((t) => t.team_id !== null).length;
                  const soloTaskCount = allAssigned.filter((t) => t.team_id === null).length;
                  const doneCount = allAssigned.filter((t) => t.status === "done").length;
                  const rate = allAssigned.length > 0 ? Math.round((doneCount / allAssigned.length) * 100) : 0;
                  const isRightCol = idx % 2 === 1;
                  return (
                    <div
                      key={m.id}
                      onClick={() => { if (!memberEditMode) setViewingUserId(m.user_id); }}
                      className={`flex items-start gap-3 px-4 py-3 border-t border-gray-100 transition-colors ${isRightCol ? "sm:border-l" : ""} ${!memberEditMode ? "cursor-pointer hover:bg-blue-50" : "hover:bg-gray-50/60"}`}
                    >
                      <Avatar className="w-8 h-8 shrink-0 mt-0.5">
                        <AvatarImage src={profile?.avatar_url ?? undefined} />
                        <AvatarFallback className={`text-xs font-bold ${isLeader ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600"}`}>
                          {name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          {isMe && <span className="text-[10px] text-gray-400 shrink-0">(คุณ)</span>}
                          {isLeader && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{profile?.email}</p>
                        {showMemberStats && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                              {teamTaskCount} ทีม
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                              {soloTaskCount} เดี่ยว
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                              rate >= 70 ? "text-emerald-600 bg-emerald-50" :
                              rate >= 40 ? "text-amber-600 bg-amber-50" :
                              "text-gray-400 bg-gray-100"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${rate >= 70 ? "bg-emerald-500" : rate >= 40 ? "bg-amber-400" : "bg-gray-300"}`} />
                              {rate}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {memberEditMode && canEdit && !isMe ? (
                          <>
                            <Select value={m.position} onValueChange={(v) => {
                              if (v === "leader") prepareSwapLeader(m.id, team.id);
                              else changePosition(m.id, team.id, v);
                            }}>
                              <SelectTrigger className={`h-7 w-24 text-[11px] ${isLeader ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="leader">หัวหน้าทีม</SelectItem>
                                <SelectItem value="member">สมาชิก</SelectItem>
                              </SelectContent>
                            </Select>
                            <button
                              onClick={() => setRemoveTarget({ memberId: m.id, name: getMemberName(m), teamName: team.name })}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${isLeader ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                            {isLeader ? "หัวหน้า" : "สมาชิก"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {canEdit && (
              <div className="rounded-2xl border border-red-100 bg-red-50/50 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700">ลบทีม</p>
                  <p className="text-xs text-red-400 mt-0.5">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
                </div>
                <button onClick={() => setDeleteTarget(team)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> ลบทีม
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: งานของทีม ── */}
        {detailTab === "tasks" && (
          <div className="space-y-5">
            {/* Range selector header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-gray-400" />
                  กราฟผลงาน
                  <span className="text-xs font-normal text-gray-400">· {totalInRange} งานในช่วงที่เลือก</span>
                </h3>
                {chartRange === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStart}
                      max={customEnd}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="h-8 px-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                    />
                    <span className="text-xs text-gray-400">ถึง</span>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="h-8 px-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {(["1w","1m","3m","6m","1y","custom"] as const).map((r) => (
                  <button key={r} onClick={() => setChartRange(r)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      chartRange === r ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {RANGE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{teamTasks.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">งานทั้งหมด</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{doneTasks.length}</p>
                <p className="text-xs text-emerald-600 mt-0.5">ผ่านแล้ว</p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/80 p-4 text-center">
                <p className="text-2xl font-bold text-violet-600">{passRate}%</p>
                <p className="text-xs text-violet-600 mt-0.5">อัตราผ่าน</p>
              </div>
            </div>

            {/* 2 donuts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">สัดส่วนสถานะงาน</h4>
                {statusChartData.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-gray-300 text-sm">ไม่มีงาน</div>
                ) : (
                  <ResponsiveContainer width="100%" height={176}>
                    <PieChart>
                      <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                        {statusChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number, n: string) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                  {statusChartData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-600">{d.name} <span className="font-semibold">{d.value}</span></span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">จำนวนงานตามประเภท</h4>
                <ResponsiveContainer width="100%" height={176}>
                  <PieChart>
                    <Pie data={typeChartData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                      {typeChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                  {typeChartData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-600">{d.name} <span className="font-semibold">{d.value}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Done tasks */}
            {doneTasks.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">ผลงานที่สำเร็จ</h4>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{doneTasks.length} งาน</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {doneTasks.map((t) => {
                    const assignee = t.assigned_to ? profileMap[t.assigned_to] : null;
                    return (
                      <div key={t.id} className="px-5 py-3.5 flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{t.title}</p>
                          {assignee && <p className="text-xs text-gray-400">{assignee.display_name || assignee.email}</p>}
                        </div>
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium shrink-0">ผ่านแล้ว</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: สมาชิก ── */}
        {detailTab === "members" && (
          <div className="space-y-5">
            {/* Line chart */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <h4 className="text-sm font-semibold text-gray-700">
                  แนวโน้มงานตามช่วงเวลา
                  <span className="ml-1.5 text-xs font-normal text-gray-400">· {totalInRange} งาน</span>
                </h4>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  {(["1w","1m","3m","6m","1y","custom"] as const).map((r) => (
                    <button key={r} onClick={() => setChartRange(r)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        chartRange === r ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {RANGE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              {chartRange === "custom" && (
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                  />
                  <span className="text-xs text-gray-400">ถึง</span>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                  />
                </div>
              )}

              {lineData.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-gray-300 text-sm">ไม่มีข้อมูลในช่วงที่เลือก</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={lineData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#818cf8" strokeWidth={2} dot={{ fill: "#818cf8", r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Contributor list */}
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">ผลงานแยกตามสมาชิก</h4>
                <span className="text-xs text-gray-400">{memberContribData.length} คน</span>
              </div>
              {memberContribData.every((m) => m.count === 0) ? (
                <p className="text-gray-400 text-sm text-center py-8">ยังไม่มีงานที่มอบหมาย</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  {memberContribData.map((m, idx) => {
                    const memberProfile = profileMap[m.userId];
                    const memberDone = tasks.filter((t) => t.assigned_to === m.userId && t.team_id === team.id && t.status === "done").length;
                    const memberRate = m.count > 0 ? Math.round((memberDone / m.count) * 100) : 0;
                    const barPct = Math.round((m.count / maxContrib) * 100);
                    const color = getTeamColor(team);
                    return (
                      <div
                        key={m.userId}
                        onClick={() => setViewingUserId(m.userId)}
                        className="group relative rounded-xl border border-gray-200 p-4 hover:border-blue-200 hover:shadow-md transition-all duration-200 bg-white cursor-pointer"
                      >
                        {/* Log button */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setContribLogMember({ name: m.name, userId: m.userId }); }}
                          className="absolute top-3 right-3 p-1 rounded-md text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                          title="ดู log รายสัปดาห์"
                        >
                          <TableProperties className="w-3.5 h-3.5" />
                        </button>

                        {/* Header */}
                        <div className="flex items-center gap-2.5 mb-3 pr-6">
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarImage src={memberProfile?.avatar_url ?? undefined} />
                            <AvatarFallback className={`text-[10px] font-bold ${m.isLeader ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600"}`}>
                              {m.name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{m.name}</span>
                              {m.isLeader && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                              <span className="ml-auto text-[11px] font-bold text-gray-300">#{idx + 1}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-gray-500">{m.count} งาน</span>
                              <span className="text-gray-200">·</span>
                              <span className="text-xs text-emerald-600 font-medium">{memberDone} เสร็จ</span>
                              <span className="text-gray-200">·</span>
                              <span className={`text-xs font-semibold ${memberRate >= 70 ? "text-emerald-600" : memberRate >= 40 ? "text-amber-500" : "text-gray-400"}`}>{memberRate}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Horizontal bar */}
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${color.bar} transition-all duration-500`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[10px] text-gray-400">{barPct}% ของทีม</span>
                          <span className="text-[10px] text-gray-400">{m.count}/{maxContrib}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Invite dialog */}
        <Dialog open={!!inviteDialogTeamId} onOpenChange={(o) => { if (!o) { setInviteDialogTeamId(null); setSelectedUserId(""); setInviteSearch(""); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>เพิ่มสมาชิก — {inviteTeam?.name ?? team.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input className="pl-9" placeholder="ค้นหาชื่อหรืออีเมล..."
                  value={selectedProfile ? (selectedProfile.display_name || selectedProfile.email || "") : inviteSearch}
                  onChange={(e) => { setInviteSearch(e.target.value); setSelectedUserId(""); }} />
              </div>
              {inviteSearch && !selectedUserId && inviteAvailable.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                  {inviteAvailable.map((p) => (
                    <button key={p.id} type="button" className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors" onClick={() => { setSelectedUserId(p.id); setInviteSearch(""); }}>
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs bg-blue-50 text-blue-600">{(p.display_name || p.email || "?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.display_name || p.email}</p>
                        {p.display_name && <p className="text-xs text-gray-400 truncate">{p.email}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <button onClick={() => { setInviteDialogTeamId(null); setSelectedUserId(""); setInviteSearch(""); }} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors">ยกเลิก</button>
              <button disabled={!selectedUserId} onClick={() => { addMember(inviteDialogTeamId ?? team.id); setInviteDialogTeamId(null); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">เพิ่มสมาชิก</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Weekly commit log dialog */}
        {contribLogMember && selectedTeam && (() => {
          const logEnd = new Date(2026, 5, 8);
          const logStart = new Date(logEnd);
          logStart.setDate(logStart.getDate() - 12 * 7);
          const weeks: { weekOf: string; count: number }[] = [];
          const cur = new Date(logStart);
          while (cur <= logEnd) {
            const bs = new Date(cur);
            const be = new Date(cur);
            be.setDate(be.getDate() + 7);
            const iso = bs.toISOString().slice(0, 10);
            const count = tasks.filter((t) =>
              t.assigned_to === contribLogMember.userId &&
              t.team_id === selectedTeam.id &&
              t.status === "done" && t.completed_at &&
              new Date(t.completed_at) >= bs && new Date(t.completed_at) < be
            ).length;
            weeks.push({ weekOf: iso, count });
            cur.setDate(cur.getDate() + 7);
          }
          const csvContent = ["Week of,Commits", ...weeks.map((w) => `${w.weekOf},${w.count}`)].join("\n");
          const downloadCsv = () => {
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `${contribLogMember.name}_weekly.csv`; a.click();
            URL.revokeObjectURL(url);
          };
          return (
            <Dialog open onOpenChange={(o) => { if (!o) setContribLogMember(null); }}>
              <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>{contribLogMember.name}'s งาน</DialogTitle>
                </DialogHeader>
                <div className="overflow-y-auto flex-1 -mx-6 px-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2.5 font-medium text-gray-500">Week of</th>
                        <th className="text-left py-2.5 font-medium text-gray-500">งานเสร็จ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map((w) => (
                        <tr key={w.weekOf} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 text-gray-700 font-mono text-xs">{w.weekOf}</td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${w.count > 0 ? "text-gray-900" : "text-gray-300"}`}>{w.count}</span>
                              {w.count > 0 && (
                                <div className="flex gap-0.5">
                                  {Array.from({ length: w.count }).map((_, i) => (
                                    <div key={i} className="w-1.5 h-1.5 rounded-sm bg-indigo-400" />
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <DialogFooter className="pt-3 border-t border-gray-100">
                  <button
                    onClick={downloadCsv}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })()}

        <AlertDialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>นำสมาชิกออก</AlertDialogTitle>
              <AlertDialogDescription>ต้องการนำ <strong>{removeTarget?.name}</strong> ออกจากทีม <strong>{removeTarget?.teamName}</strong>?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => removeTarget && removeMember(removeTarget.memberId)}>นำออก</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!swapTarget} onOpenChange={(o) => { if (!o) setSwapTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>สลับหัวหน้าทีม</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-1 text-sm">
                  {swapTarget?.oldLeaderName && <p><strong>{swapTarget.oldLeaderName}</strong> → สมาชิก</p>}
                  <p><strong>{swapTarget?.newLeaderName}</strong> → หัวหน้าทีม</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction className="bg-amber-500 hover:bg-amber-600 text-white" disabled={swapping} onClick={confirmSwapLeader}>ยืนยัน</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ลบทีม</AlertDialogTitle>
              <AlertDialogDescription>ลบทีม <strong>{deleteTarget?.name}</strong>? การดำเนินการนี้ไม่สามารถย้อนกลับได้</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteTarget && deleteTeam(deleteTarget)}>ลบทีม</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <UserProfileViewDialog userId={viewingUserId} open={!!viewingUserId} onOpenChange={(o) => { if (!o) setViewingUserId(null); }} />

        <Dialog open={editOpen} onOpenChange={(o) => { if (!o) { setEditOpen(false); setEditTeam(null); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>แก้ไขทีม</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">ชื่อทีม *</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="ชื่อทีม" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">คำอธิบาย</label>
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="รายละเอียด" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">ประเภท SME</label>
                <Select value={editTag} onValueChange={setEditTag}>
                  <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                  <SelectContent>{SME_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <ColorPicker value={editColorIndex} onChange={setEditColorIndex} />
            </div>
            <DialogFooter>
              <button onClick={() => { setEditOpen(false); setEditTeam(null); }} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors">ยกเลิก</button>
              <button onClick={updateTeam} disabled={updating || !editName.trim()} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40">
                {updating ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Team List ────────────────────────────────────────────────────────────
  const allTags = Array.from(new Set(teams.flatMap((t) => t.tags ?? []))).sort();
  const myTeamIds = new Set(members.filter((m) => m.user_id === user?.id).map((m) => m.team_id));
  const filteredTeams = teams.filter((t) => {
    const matchSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.description ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    if (filterTag === "mine") return matchSearch && myTeamIds.has(t.id);
    const matchTag = filterTag === "all" || t.tags?.includes(filterTag);
    return matchSearch && matchTag;
  });
  const totalPages = Math.ceil(filteredTeams.length / PAGE_SIZE);
  const pagedTeams = filteredTeams.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const fromEntry = filteredTeams.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const toEntry = Math.min(currentPage * PAGE_SIZE, filteredTeams.length);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">ทีม</h1>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">{teams.length}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{teams.length} ทีม · {members.length} สมาชิกทั้งหมด</p>
        </div>
        {canManage && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> สร้างทีม
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาทีม หรือคำอธิบาย..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="h-10 w-full pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
          />
        </div>

        {/* Filter dropdown */}
        <Select value={filterTag} onValueChange={(v) => { setFilterTag(v); setCurrentPage(1); }}>
          <SelectTrigger className="h-10 w-36 rounded-xl border-gray-200 text-sm gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="mine">ทีมของฉัน</SelectItem>
            {allTags.length > 0 && (
              <div className="mx-2 my-1 border-t border-gray-100" />
            )}
            {allTags.map((tag) => (
              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex items-center rounded-xl border border-gray-200 bg-white p-0.5 shrink-0">
          <button
            onClick={() => setViewMode("large")}
            className={`p-2 rounded-lg transition-colors ${viewMode === "large" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-600"}`}
            title="มุมมองการ์ด"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("small")}
            className={`p-2 rounded-lg transition-colors ${viewMode === "small" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-600"}`}
            title="มุมมองรายการ"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {teams.length === 0 ? (
        /* Empty State */
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Users className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">ยังไม่มีทีม</p>
            <p className="text-sm text-gray-500 mt-0.5">สร้างทีมแรกของคุณเพื่อเริ่มจัดการสมาชิก</p>
          </div>
          {canManage && (
            <button onClick={() => setCreateOpen(true)} className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" /> สร้างทีมแรก
            </button>
          )}
        </div>
      ) : filteredTeams.length === 0 ? (
        /* No search results */
        <div className="rounded-xl border border-gray-200 bg-white py-14 flex flex-col items-center gap-2 text-center">
          <Search className="w-7 h-7 text-gray-300" />
          <p className="text-sm text-gray-500">ไม่พบทีมที่ตรงกับการค้นหา</p>
          <button onClick={() => { setSearchQuery(""); setFilterTag("all"); }} className="text-xs text-blue-600 hover:underline">ล้างตัวกรอง</button>
        </div>
      ) : viewMode === "large" ? (
        /* ── Large View: 2-col grid ── */
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pagedTeams.map((team) => {
              const color = getTeamColor(team);
              const teamMembers = members.filter((m) => m.team_id === team.id);
              const teamTasks = tasks.filter((t) => t.team_id === team.id);
              const activeTasks = teamTasks.filter((t) => t.status === "in_progress").length;
              const waitingTasks = teamTasks.filter((t) => t.status === "open").length;
              const doneTasks = teamTasks.filter((t) => t.status === "done").length;
              const totalTasks = teamTasks.length;
              const completion = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
              const initials = team.name.slice(0, 2).toUpperCase();
              return (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-sm transition-all cursor-pointer flex flex-col"
                >
                  {/* Gradient top strip */}
                  <div className={`h-1.5 bg-gradient-to-r ${color.bar}`} />

                  <div className="p-5 flex flex-col gap-4">
                    {/* Header: avatar + name + description */}
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-xl ${color.avatar} flex items-center justify-center text-white font-bold text-base shrink-0`}>
                        {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover rounded-xl" alt="" /> : initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900">{team.name}</p>
                          {team.tags?.[0] && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{team.tags[0]}</span>
                          )}
                        </div>
                        {team.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{team.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Members */}
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        {teamMembers.slice(0, 4).map((m) => {
                          const p = profileMap[m.user_id];
                          const n = (p?.display_name || p?.email || "?")[0].toUpperCase();
                          return (
                            <Avatar key={m.id} className="w-7 h-7 border-2 border-white">
                              <AvatarImage src={p?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[10px] font-bold bg-gray-200 text-gray-600">{n}</AvatarFallback>
                            </Avatar>
                          );
                        })}
                        {teamMembers.length > 4 && (
                          <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                            +{teamMembers.length - 4}
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{teamMembers.length} สมาชิก</span>
                    </div>

                    {/* Stat boxes */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-amber-500">{activeTasks}</p>
                        <p className="text-xs text-amber-500 mt-0.5">กำลังทำ</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-gray-600">{waitingTasks}</p>
                        <p className="text-xs text-gray-500 mt-0.5">รอรับ</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-emerald-600">{totalTasks > 0 ? `${completion}%` : "—"}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">สำเร็จ</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {totalTasks > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-gray-400">ความคืบหน้า</span>
                          <span className="text-xs font-medium text-gray-600">{completion}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${color.bar} rounded-full transition-all`} style={{ width: `${completion}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && <PaginationBar currentPage={currentPage} totalPages={totalPages} fromEntry={fromEntry} toEntry={toEntry} total={filteredTeams.length} onChange={setCurrentPage} />}
        </>
      ) : (
        /* ── Small View: compact list ── */
        <>
          <div className="flex flex-col gap-2">
            {pagedTeams.map((team) => {
              const color = getTeamColor(team);
              const teamMembers = members.filter((m) => m.team_id === team.id);
              const teamTasks = tasks.filter((t) => t.team_id === team.id);
              const activeTasks = teamTasks.filter((t) => t.status === "in_progress").length;
              const waitingTasks = teamTasks.filter((t) => t.status === "open").length;
              const doneTasks = teamTasks.filter((t) => t.status === "done").length;
              const totalTasks = teamTasks.length;
              const completion = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null;
              const initials = team.name.slice(0, 2).toUpperCase();
              return (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className="bg-white border border-gray-200 rounded-xl flex items-center gap-3 px-4 py-3.5 hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-all group"
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl ${color.avatar} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                    {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover rounded-xl" alt="" /> : initials}
                  </div>

                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{team.name}</p>
                      {team.tags?.[0] && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium shrink-0">{team.tags[0]}</span>
                      )}
                    </div>
                    {team.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{team.description}</p>
                    )}
                  </div>

                  {/* Member avatars */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <div className="flex -space-x-1.5">
                      {teamMembers.slice(0, 3).map((m) => {
                        const p = profileMap[m.user_id];
                        const n = (p?.display_name || p?.email || "?")[0].toUpperCase();
                        return (
                          <Avatar key={m.id} className="w-6 h-6 border-2 border-white">
                            <AvatarImage src={p?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[9px] font-bold bg-gray-200 text-gray-600">{n}</AvatarFallback>
                          </Avatar>
                        );
                      })}
                    </div>
                    {teamMembers.length > 3 && (
                      <span className="text-xs text-gray-400 font-medium">+{teamMembers.length - 3}</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-sm font-medium text-amber-600">{activeTasks}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Circle className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm text-gray-500">{waitingTasks}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600">{completion !== null ? `${completion}%` : "—"}</span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {totalPages > 1 && <PaginationBar currentPage={currentPage} totalPages={totalPages} fromEntry={fromEntry} toEntry={toEntry} total={filteredTeams.length} onChange={setCurrentPage} />}
        </>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setNewName(""); setNewDesc(""); setNewTag(""); setNewLogoPreview(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>สร้างทีมใหม่</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <button type="button" onClick={() => newLogoRef.current?.click()}
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-400 transition-colors overflow-hidden flex items-center justify-center bg-gray-50 hover:bg-blue-50">
                {newLogoPreview ? (
                  <img src={newLogoPreview} className="w-full h-full object-cover" alt="logo" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-400">
                    <Users className="w-6 h-6" />
                    <span className="text-[10px]">อัปโหลด</span>
                  </div>
                )}
              </button>
              <input ref={newLogoRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setNewLogoPreview(ev.target?.result as string); r.readAsDataURL(f); } }} />
              <p className="text-xs text-gray-400">รูปโปรไฟล์ทีม (ไม่บังคับ)</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">ชื่อทีม *</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="เช่น ทีม Alpha" autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">คำอธิบาย</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="รายละเอียดของทีม" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">ประเภท SME *</label>
              <Select value={newTag} onValueChange={setNewTag}>
                <SelectTrigger><SelectValue placeholder="เลือกประเภท SME" /></SelectTrigger>
                <SelectContent>{SME_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <ColorPicker value={newColorIndex} onChange={setNewColorIndex} />
          </div>
          <DialogFooter>
            <button onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors">ยกเลิก</button>
            <button onClick={createTeam} disabled={creating || !newName.trim() || !newTag} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {creating ? "กำลังสร้าง..." : "สร้างทีม"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserProfileViewDialog userId={viewingUserId} open={!!viewingUserId} onOpenChange={(o) => { if (!o) setViewingUserId(null); }} />
    </div>
  );
}

function PaginationBar({ currentPage, totalPages, fromEntry, toEntry, total, onChange }: {
  currentPage: number; totalPages: number; fromEntry: number; toEntry: number; total: number;
  onChange: (p: number) => void;
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
    <div className="flex items-center justify-between gap-4 px-1">
      <p className="text-xs text-gray-500">
        Showing <span className="font-semibold text-gray-900">{fromEntry}–{toEntry}</span> of <span className="font-semibold text-gray-900">{total}</span> entries
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium border transition-colors ${currentPage === p ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

const COLOR_SWATCHES = [
  { label: "น้ำเงิน",  from: "from-blue-500",    to: "to-indigo-600"  },
  { label: "เขียว",    from: "from-emerald-400", to: "to-teal-600"    },
  { label: "ส้ม-แดง", from: "from-orange-400",  to: "to-red-500"     },
  { label: "ม่วง",    from: "from-violet-500",  to: "to-purple-600"  },
  { label: "ชมพู",    from: "from-pink-400",    to: "to-rose-600"    },
  { label: "ฟ้า",     from: "from-cyan-400",    to: "to-blue-500"    },
];

function ColorPicker({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">สีทีม</label>
      <div className="flex items-center gap-2">
        {COLOR_SWATCHES.map((c, i) => (
          <button
            key={i}
            type="button"
            title={c.label}
            onClick={() => onChange(i)}
            className={`w-7 h-7 rounded-full bg-gradient-to-br ${c.from} ${c.to} transition-all ${value === i ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`}
          />
        ))}
      </div>
    </div>
  );
}
