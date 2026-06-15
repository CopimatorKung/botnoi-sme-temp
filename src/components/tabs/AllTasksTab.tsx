import { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, X, Users, User, SlidersHorizontal, ArrowUpDown, ChevronDown, Clock, CheckCircle2, Loader2, ChevronLeft, ChevronRight as ChevronRightIcon, CalendarClock, Flag, UserPlus, Wrench, ClipboardCheck, BadgeCheck, Ban } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

type Priority = "urgent" | "high" | "normal";
interface Task {
  id: string; title: string; description: string | null;
  status: string; assigned_to: string | null; team_id: string | null;
  created_at: string; review_note: string | null;
  due_date?: string | null; created_by?: string | null; priority?: Priority;
}

const PRIORITY_CFG: Record<Priority, { label: string; color: string; dot: string; icon: string }> = {
  urgent: { label: "ด่วนมาก", color: "bg-red-50 text-red-600 border-red-200",    dot: "bg-red-500",    icon: "🔴" },
  high:   { label: "ด่วน",    color: "bg-orange-50 text-orange-600 border-orange-200", dot: "bg-orange-400", icon: "🟠" },
  normal: { label: "ปกติ",    color: "bg-gray-50 text-gray-500 border-gray-200",  dot: "bg-gray-300",   icon: "⚪" },
};
interface Profile { id: string; display_name: string | null; email: string | null; avatar_url: string | null; }
interface Team { id: string; name: string; }

const THREE_HOURS_MS = 1 * 60 * 1000;
const isTeamTaskExpired = (t: Task) =>
  !!t.team_id && t.status === "open" && !t.assigned_to &&
  Date.now() - new Date(t.created_at).getTime() > THREE_HOURS_MS;

const getTaskBadge = (t: Task): { label: string; color: string; dot: string } => {
  if (t.status === "open") {
    if (t.team_id && !t.assigned_to && !isTeamTaskExpired(t))
      return { label: "รอรับงาน", color: "bg-orange-50 text-orange-600 border-orange-200", dot: "bg-orange-400" };
    return { label: "งานอิสระ", color: "bg-blue-50 text-blue-600 border-blue-200", dot: "bg-blue-400" };
  }
  if (t.status === "cancelled") {
    const confirmed = t.review_note?.includes("แอดมินยืนยัน:") ?? false;
    return confirmed
      ? { label: "ยกเลิกแล้ว",       color: "bg-slate-50 text-slate-500 border-slate-200",  dot: "bg-slate-300" }
      : { label: "รอยืนยันยกเลิก",   color: "bg-rose-50 text-rose-500 border-rose-200",     dot: "bg-rose-400"  };
  }
  const MAP: Record<string, { label: string; color: string; dot: string }> = {
    in_progress: { label: "กำลังทำ",   color: "bg-yellow-50 text-yellow-700 border-yellow-200", dot: "bg-yellow-400" },
    done:        { label: "รอตรวจสอบ", color: "bg-amber-50 text-amber-600 border-amber-200",    dot: "bg-amber-400"  },
    approved:    { label: "ผ่านแล้ว",  color: "bg-green-50 text-green-600 border-green-200",    dot: "bg-green-400"  },
  };
  return MAP[t.status] ?? { label: t.status, color: "bg-slate-50 text-slate-500 border-slate-200", dot: "bg-slate-300" };
};

const STATUS_PRIORITY: Record<string, number> = {
  in_progress: 1, open: 2, done: 3, approved: 4, cancelled: 5,
};

type FilterKey = "open_free" | "open_team" | "in_progress" | "done" | "approved" | "pending_cancel" | "cancelled";
type SortKey = "newest" | "oldest" | "title_az" | "title_za" | "status_active" | "status_done" | "wait_first" | "assignee_az" | "assignee_za" | "due_soonest" | "due_latest" | "priority_high" | "priority_low";

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2 };

const FILTER_CHIPS: { key: FilterKey; label: string; activeColor: string; defaultColor?: string }[] = [
  { key: "open_free",      label: "งานอิสระ",        activeColor: "bg-blue-100 text-blue-700 border-blue-300"          },
  { key: "open_team",      label: "รอรับงาน",        activeColor: "bg-orange-100 text-orange-700 border-orange-300"    },
  { key: "in_progress",    label: "กำลังทำ",         activeColor: "bg-yellow-100 text-yellow-700 border-yellow-300"    },
  { key: "done",           label: "รอตรวจสอบ",       activeColor: "bg-amber-100 text-amber-700 border-amber-300"       },
  { key: "approved",       label: "ผ่านแล้ว",        activeColor: "bg-green-100 text-green-700 border-green-300"       },
  { key: "pending_cancel", label: "รอยืนยันยกเลิก", activeColor: "bg-rose-100 text-rose-600 border-rose-300",
                                                       defaultColor: "bg-white text-rose-400 border-rose-200 hover:bg-rose-50" },
  { key: "cancelled",      label: "ยกเลิกแล้ว",     activeColor: "bg-slate-100 text-slate-600 border-slate-300",
                                                       defaultColor: "bg-white text-slate-400 border-slate-200 hover:bg-slate-50" },
];

const SORT_OPTIONS: { value: SortKey; label: string; group: string }[] = [
  { value: "newest",        label: "ล่าสุด",          group: "วันที่สร้าง"   },
  { value: "oldest",        label: "เก่าสุด",          group: "วันที่สร้าง"   },
  { value: "due_soonest",   label: "ใกล้ครบกำหนด",    group: "วันครบกำหนด"  },
  { value: "due_latest",    label: "ไกลครบกำหนด",     group: "วันครบกำหนด"  },
  { value: "priority_high", label: "ด่วน → ปกติ",     group: "ความสำคัญ"    },
  { value: "priority_low",  label: "ปกติ → ด่วน",     group: "ความสำคัญ"    },
  { value: "status_active", label: "กำลังดำเนินการ",   group: "สถานะ"  },
  { value: "status_done",   label: "เสร็จแล้ว",        group: "สถานะ"  },
  { value: "wait_first",    label: "รอรับงาน",          group: "สถานะ"  },
  { value: "assignee_az",   label: "ผู้รับงาน A → Z",   group: "ตัวอักษร" },
  { value: "assignee_za",   label: "ผู้รับงาน Z → A",   group: "ตัวอักษร" },
  { value: "title_az",      label: "ชื่องาน A → Z",      group: "ตัวอักษร" },
  { value: "title_za",      label: "ชื่องาน Z → A",      group: "ตัวอักษร" },
];

const matchStatusFilter = (t: Task, key: FilterKey): boolean => {
  if (key === "open_free")      return t.status === "open" && (!t.team_id || isTeamTaskExpired(t));
  if (key === "open_team")      return t.status === "open" && !!t.team_id && !t.assigned_to && !isTeamTaskExpired(t);
  if (key === "pending_cancel") return t.status === "cancelled" && !(t.review_note?.includes("แอดมินยืนยัน:") ?? false);
  if (key === "cancelled")      return t.status === "cancelled" &&  (t.review_note?.includes("แอดมินยืนยัน:") ?? false);
  return t.status === key;
};

const TIMELINE_STEPS = [
  { key: "created",     label: "สร้างงาน",     Icon: Clock         },
  { key: "assigned",    label: "รับงาน",        Icon: UserPlus      },
  { key: "in_progress", label: "กำลังทำ",       Icon: Wrench        },
  { key: "done",        label: "รอตรวจสอบ",     Icon: ClipboardCheck},
  { key: "approved",    label: "ผ่านแล้ว",      Icon: BadgeCheck    },
];

function getTimelineIndex(t: Task): number {
  if (t.status === "approved")    return 4;
  if (t.status === "done")        return 3;
  if (t.status === "in_progress") return 2;
  if (t.status === "open" && t.assigned_to) return 1;
  return 0;
}

const extractSme = (desc: string | null): string | null => {
  if (!desc) return null;
  const line = desc.split("\n").find((l) => l.startsWith("ประเภท SME:"));
  if (!line) return null;
  return line.slice("ประเภท SME:".length).trim().split(/\s+/)[0] || null;
};

const renderDescription = (desc: string) =>
  desc.split("\n").map((line, i) => {
    if (line.startsWith("ประเภท SME:")) {
      const value = line.slice("ประเภท SME:".length).trim();
      return (
        <span key={i} className="block">
          ประเภท SME:{" "}
          <span className="bg-violet-100 text-violet-700 font-semibold px-1.5 py-0.5 rounded text-[11px]">{value}</span>
        </span>
      );
    }
    return <span key={i} className="block">{line}</span>;
  });

// left-border color by status
const STATUS_BORDER: Record<string, string> = {
  in_progress: "border-l-yellow-400",
  done:        "border-l-amber-400",
  approved:    "border-l-green-400",
  cancelled:   "border-l-slate-300",
  open:        "border-l-blue-300",
};
const getStatusBorder = (t: Task) => {
  if (t.status === "open" && t.team_id && !t.assigned_to && !isTeamTaskExpired(t))
    return "border-l-orange-400";
  return STATUS_BORDER[t.status] ?? "border-l-gray-200";
};

export function AllTasksTab() {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams]       = useState<Team[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [search, setSearch]                     = useState("");
  const [statusFilter, setStatusFilter]         = useState<FilterKey | null>(null);
  const [showAdvanced, setShowAdvanced]         = useState(false);
  const [smeFilter, setSmeFilter]               = useState("__all__");
  const [teamFilter, setTeamFilter]             = useState("__all__");
  const [assigneeFilter, setAssigneeFilter]     = useState("__all__");
  const [assigneeSearch, setAssigneeSearch]     = useState("");
  const [assigneeOpen, setAssigneeOpen]         = useState(false);
  const [creatorFilter, setCreatorFilter]       = useState("__all__");
  const [creatorSearch, setCreatorSearch]       = useState("");
  const [creatorOpen, setCreatorOpen]           = useState(false);
  const [priorityFilter, setPriorityFilter]     = useState<Priority | "__all__">("__all__");
  const [dueDateRange, setDueDateRange]         = useState<"__all__" | "overdue" | "today" | "week" | "month" | "none">("__all__");
  const [assignmentFilter, setAssignmentFilter] = useState<"__all__" | "assigned" | "unassigned">("__all__");
  const [sortKey, setSortKey]                   = useState<SortKey>("newest");
  const [sortPopoverOpen, setSortPopoverOpen]   = useState(false);
  const [currentPage, setCurrentPage]           = useState(1);
  const PAGE_SIZE = 10;

  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);
  const teamMap    = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])),    [teams]);

  useEffect(() => { loadMock(); }, []);

  const loadMock = () => {
    const now = new Date();
    const ago = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
    const minsAgo = (m: number) => new Date(now.getTime() - m * 60000).toISOString();

    const mockProfiles: Profile[] = [
      { id: "p1",  display_name: "วิชัย สุขใส",    email: "wichai@demo.com",   avatar_url: null },
      { id: "p2",  display_name: "นภา พงษ์ดี",     email: "napa@demo.com",     avatar_url: null },
      { id: "p3",  display_name: "มานี รักดี",      email: "manee@demo.com",    avatar_url: null },
      { id: "p4",  display_name: "ปิยะ รุ่งเรือง",  email: "piya@demo.com",     avatar_url: null },
      { id: "p5",  display_name: "ธนา ศรีสุข",     email: "thana@demo.com",    avatar_url: null },
      { id: "p6",  display_name: "กิตติ์ เจริญ",   email: "kitti@demo.com",    avatar_url: null },
      { id: "p7",  display_name: "พิมพ์ ใจงาม",    email: "pim@demo.com",      avatar_url: null },
      { id: "p8",  display_name: "อรุณ สว่าง",     email: "arun@demo.com",     avatar_url: null },
      { id: "p9",  display_name: "เอก ชาญชัย",     email: "ake@demo.com",      avatar_url: null },
      { id: "p10", display_name: "Demo Admin",      email: "admin@demo.com",    avatar_url: null },
    ];

    const mockTeams: Team[] = [
      { id: "tm1", name: "ทีมขาย Alpha"  },
      { id: "tm2", name: "ทีมขาย Beta"   },
      { id: "tm3", name: "ทีม CRM"       },
      { id: "tm4", name: "ทีม Support"   },
      { id: "tm5", name: "ทีม Marketing" },
    ];

    const sme = (n: string) => `ประเภท SME: #SME${n}\nรายละเอียด: งานที่มอบหมายตามประเภท SME`;
    const noDesc = null;
    const due = (days: number) => new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
    // due(3)=อีก3วัน, due(-2)=เลยกำหนด2วัน, due(0)=วันนี้

    const mockTasks: Task[] = [
      // งานอิสระ ×8
      { id:"tk01", title:"สร้าง Proposal สำหรับลูกค้าใหม่",        status:"open", assigned_to:"p1",  team_id:null,  created_at:ago(2),       review_note:null,                            description:sme("01"), due_date:due(3),   created_by:"p10", priority:"urgent" },
      { id:"tk02", title:"วิเคราะห์ข้อมูลลูกค้า Q2",               status:"open", assigned_to:"p2",  team_id:null,  created_at:ago(5),       review_note:null,                            description:sme("02"), due_date:due(7),   created_by:"p10", priority:"high"   },
      { id:"tk03", title:"จัดทำรายงาน Pipeline ประจำเดือน",        status:"open", assigned_to:"p4",  team_id:null,  created_at:ago(1),       review_note:null,                            description:noDesc,    due_date:due(5),   created_by:"p10", priority:"normal" },
      { id:"tk04", title:"อัปเดต Contact List ทั้งหมด",            status:"open", assigned_to:"p5",  team_id:null,  created_at:ago(3),       review_note:null,                            description:sme("03"), due_date:due(-1),  created_by:"p1",  priority:"urgent" },
      { id:"tk05", title:"ทำ Presentation Deck สำหรับ Pitch",      status:"open", assigned_to:"p6",  team_id:null,  created_at:ago(4),       review_note:null,                            description:noDesc,    due_date:due(2),   created_by:"p10", priority:"high"   },
      { id:"tk06", title:"ส่งรายงานสรุปประจำสัปดาห์",              status:"open", assigned_to:"p3",  team_id:null,  created_at:ago(1),       review_note:null,                            description:noDesc,    due_date:due(0),   created_by:"p10", priority:"normal" },
      { id:"tk07", title:"จัดทำ KPI Dashboard รายเดือน",           status:"open", assigned_to:"p8",  team_id:null,  created_at:ago(6),       review_note:null,                            description:sme("04"), due_date:due(10),  created_by:"p2",  priority:"normal" },
      { id:"tk08", title:"ประเมินผลลูกค้า Tier A",                 status:"open", assigned_to:"p9",  team_id:null,  created_at:ago(2),       review_note:null,                            description:noDesc,    due_date:due(-2),  created_by:"p10", priority:"urgent" },
      // รอรับงาน ×8
      { id:"tk09", title:"ติดต่อลูกค้าใหม่รอบสัปดาห์",            status:"open", assigned_to:null,  team_id:"tm1", created_at:minsAgo(10),  review_note:null,                            description:sme("01"), due_date:due(4),   created_by:"p1",  priority:"high"   },
      { id:"tk10", title:"เตรียมเอกสาร Onboarding ลูกค้าใหม่",     status:"open", assigned_to:null,  team_id:"tm1", created_at:minsAgo(5),   review_note:null,                            description:noDesc,    due_date:due(6),   created_by:"p1",  priority:"normal" },
      { id:"tk11", title:"ส่งมอบ Proposal รอบ Q2",                 status:"open", assigned_to:null,  team_id:"tm2", created_at:minsAgo(20),  review_note:null,                            description:sme("02"), due_date:due(1),   created_by:"p4",  priority:"urgent" },
      { id:"tk12", title:"ติดตาม Follow-up ลูกค้าเก่า",            status:"open", assigned_to:null,  team_id:"tm2", created_at:minsAgo(8),   review_note:null,                            description:noDesc,    due_date:due(8),   created_by:"p4",  priority:"normal" },
      { id:"tk13", title:"อัปเดตข้อมูล CRM ระบบใหม่",             status:"open", assigned_to:null,  team_id:"tm3", created_at:minsAgo(15),  review_note:null,                            description:sme("05"), due_date:due(3),   created_by:"p6",  priority:"high"   },
      { id:"tk14", title:"จัดประชุมทีม Weekly Sync",               status:"open", assigned_to:null,  team_id:"tm3", created_at:minsAgo(30),  review_note:null,                            description:noDesc,    due_date:due(2),   created_by:"p6",  priority:"normal" },
      { id:"tk15", title:"ตอบ Ticket ลูกค้า Urgent",               status:"open", assigned_to:null,  team_id:"tm4", created_at:minsAgo(2),   review_note:null,                            description:noDesc,    due_date:due(0),   created_by:"p7",  priority:"urgent" },
      { id:"tk16", title:"จัดทำ Content Calendar เดือนหน้า",        status:"open", assigned_to:null,  team_id:"tm5", created_at:minsAgo(45),  review_note:null,                            description:sme("06"), due_date:due(14),  created_by:"p9",  priority:"normal" },
      // expired ×3
      { id:"tk17", title:"ติดตาม Lead ที่ไม่มีคนรับ (หมดเวลา)",    status:"open", assigned_to:null,  team_id:"tm1", created_at:ago(10),      review_note:null,                            description:noDesc,    due_date:due(-5),  created_by:"p1",  priority:"high"   },
      { id:"tk18", title:"งานค้างเก่าที่ไม่มีคนรับ",                status:"open", assigned_to:null,  team_id:"tm2", created_at:ago(7),       review_note:null,                            description:noDesc,    due_date:due(-3),  created_by:"p4",  priority:"normal" },
      { id:"tk19", title:"อัปเดต Database เก่า (ไม่มีคนรับ)",       status:"open", assigned_to:null,  team_id:"tm3", created_at:ago(14),      review_note:null,                            description:sme("03"), due_date:due(-8),  created_by:"p6",  priority:"normal" },
      // in_progress ×12
      { id:"tk20", title:"ปิดการขาย Enterprise Client X",           status:"in_progress", assigned_to:"p1",  team_id:"tm1", created_at:ago(3),  review_note:null, description:sme("01"), due_date:due(2),   created_by:"p10", priority:"urgent" },
      { id:"tk21", title:"จัด Training ทีมใหม่ประจำเดือน",          status:"in_progress", assigned_to:"p2",  team_id:"tm1", created_at:ago(5),  review_note:null, description:noDesc,    due_date:due(5),   created_by:"p1",  priority:"normal" },
      { id:"tk22", title:"วิเคราะห์ผล Campaign Q1",                 status:"in_progress", assigned_to:"p3",  team_id:"tm5", created_at:ago(4),  review_note:null, description:sme("06"), due_date:due(3),   created_by:"p9",  priority:"high"   },
      { id:"tk23", title:"พัฒนา Script การขายชุดใหม่",              status:"in_progress", assigned_to:"p4",  team_id:"tm2", created_at:ago(2),  review_note:null, description:noDesc,    due_date:due(7),   created_by:"p4",  priority:"normal" },
      { id:"tk24", title:"ติดตามลูกค้า Re-sign รายใหญ่",            status:"in_progress", assigned_to:"p5",  team_id:"tm2", created_at:ago(6),  review_note:null, description:sme("02"), due_date:due(1),   created_by:"p10", priority:"urgent" },
      { id:"tk25", title:"อัปเดต Product Knowledge ทีม",            status:"in_progress", assigned_to:"p6",  team_id:"tm3", created_at:ago(3),  review_note:null, description:noDesc,    due_date:due(4),   created_by:"p6",  priority:"normal" },
      { id:"tk26", title:"แก้ปัญหา Support Ticket #123",            status:"in_progress", assigned_to:"p7",  team_id:"tm4", created_at:ago(1),  review_note:null, description:sme("07"), due_date:due(0),   created_by:"p7",  priority:"urgent" },
      { id:"tk27", title:"จัดทำรายงาน ROI ลูกค้า",                 status:"in_progress", assigned_to:"p8",  team_id:"tm1", created_at:ago(4),  review_note:null, description:noDesc,    due_date:due(6),   created_by:"p1",  priority:"high"   },
      { id:"tk28", title:"ทำ Social Media Content ชุดใหม่",         status:"in_progress", assigned_to:"p9",  team_id:"tm5", created_at:ago(2),  review_note:null, description:sme("06"), due_date:due(-1),  created_by:"p9",  priority:"high"   },
      { id:"tk29", title:"ประสานงาน Partner Network",               status:"in_progress", assigned_to:"p1",  team_id:"tm3", created_at:ago(7),  review_note:null, description:noDesc,    due_date:due(9),   created_by:"p10", priority:"normal" },
      { id:"tk30", title:"เตรียม Demo สำหรับ Pitch วันศุกร์",       status:"in_progress", assigned_to:"p3",  team_id:"tm2", created_at:ago(1),  review_note:null, description:sme("02"), due_date:due(0),   created_by:"p4",  priority:"urgent" },
      { id:"tk31", title:"ทดสอบระบบ CRM Version ใหม่",             status:"in_progress", assigned_to:"p2",  team_id:"tm3", created_at:ago(3),  review_note:null, description:noDesc,    due_date:due(5),   created_by:"p6",  priority:"high"   },
      // done ×10
      { id:"tk32", title:"ส่ง Invoice ลูกค้า #A001",                status:"done", assigned_to:"p1",  team_id:"tm1", created_at:ago(8),  review_note:null,             description:sme("01"), due_date:due(-2),  created_by:"p10", priority:"urgent" },
      { id:"tk33", title:"จัดทำ Report สรุปเดือน พ.ค.",            status:"done", assigned_to:"p4",  team_id:"tm2", created_at:ago(10), review_note:null,             description:noDesc,    due_date:due(1),   created_by:"p4",  priority:"normal" },
      { id:"tk34", title:"อบรมทีมเรื่อง LINE OA",                   status:"done", assigned_to:"p5",  team_id:"tm1", created_at:ago(7),  review_note:null,             description:sme("01"), due_date:due(0),   created_by:"p1",  priority:"high"   },
      { id:"tk35", title:"ติดตามการชำระเงินลูกค้า B",               status:"done", assigned_to:"p2",  team_id:"tm2", created_at:ago(9),  review_note:null,             description:noDesc,    due_date:due(2),   created_by:"p10", priority:"normal" },
      { id:"tk36", title:"จัด Kickoff Meeting โปรเจกต์ใหม่",        status:"done", assigned_to:"p6",  team_id:"tm3", created_at:ago(5),  review_note:null,             description:noDesc,    due_date:due(3),   created_by:"p6",  priority:"normal" },
      { id:"tk37", title:"ส่งมอบงาน Re-design UX ระบบ CRM",         status:"done", assigned_to:"p7",  team_id:"tm4", created_at:ago(6),  review_note:null,             description:noDesc,    due_date:due(-1),  created_by:"p7",  priority:"high"   },
      { id:"tk38", title:"เขียน Case Study ลูกค้า C",               status:"done", assigned_to:"p8",  team_id:"tm5", created_at:ago(4),  review_note:null,             description:sme("06"), due_date:due(4),   created_by:"p9",  priority:"normal" },
      { id:"tk39", title:"ตรวจสอบ Contract ลูกค้า D",               status:"done", assigned_to:"p9",  team_id:"tm1", created_at:ago(11), review_note:null,             description:noDesc,    due_date:due(0),   created_by:"p1",  priority:"urgent" },
      { id:"tk40", title:"ทำ FAQ เพื่อตอบลูกค้า",                  status:"done", assigned_to:"p3",  team_id:"tm4", created_at:ago(3),  review_note:null,             description:noDesc,    due_date:due(2),   created_by:"p7",  priority:"normal" },
      { id:"tk41", title:"จัดทำ Content ประจำสัปดาห์",              status:"done", assigned_to:"p1",  team_id:"tm5", created_at:ago(8),  review_note:null,             description:sme("06"), due_date:due(1),   created_by:"p9",  priority:"high"   },
      // approved ×10
      { id:"tk42", title:"ปิดการขาย SME ลูกค้า #SME01",            status:"approved", assigned_to:"p1", team_id:"tm1", created_at:ago(20), review_note:"ผ่านการตรวจสอบแล้ว", description:sme("01"), due_date:due(-5),  created_by:"p10", priority:"urgent" },
      { id:"tk43", title:"จัดทำรายงาน Q4 ประจำปี",                 status:"approved", assigned_to:"p2", team_id:"tm2", created_at:ago(25), review_note:"ผ่าน",               description:noDesc,    due_date:due(-10), created_by:"p10", priority:"normal" },
      { id:"tk44", title:"ทำ Onboarding ลูกค้าใหม่ 5 ราย",          status:"approved", assigned_to:"p4", team_id:"tm1", created_at:ago(15), review_note:"เรียบร้อย",          description:noDesc,    due_date:due(-3),  created_by:"p1",  priority:"high"   },
      { id:"tk45", title:"วิเคราะห์ข้อมูล Customer Segment",        status:"approved", assigned_to:"p5", team_id:"tm3", created_at:ago(30), review_note:"ผ่าน",               description:sme("05"), due_date:due(-12), created_by:"p6",  priority:"normal" },
      { id:"tk46", title:"พัฒนา Pitch Deck v2.0",                   status:"approved", assigned_to:"p6", team_id:"tm2", created_at:ago(18), review_note:"ดีมาก",              description:noDesc,    due_date:due(-2),  created_by:"p4",  priority:"high"   },
      { id:"tk47", title:"ปิด Ticket Support #456",                 status:"approved", assigned_to:"p7", team_id:"tm4", created_at:ago(22), review_note:"แก้ไขเสร็จ",        description:noDesc,    due_date:due(-5),  created_by:"p7",  priority:"urgent" },
      { id:"tk48", title:"จัด Event ลูกค้า VIP",                    status:"approved", assigned_to:"p8", team_id:"tm5", created_at:ago(40), review_note:"ผ่าน",               description:sme("06"), due_date:due(-20), created_by:"p9",  priority:"high"   },
      { id:"tk49", title:"ทำสรุปผล Campaign ไตรมาส 1",             status:"approved", assigned_to:"p9", team_id:"tm5", created_at:ago(35), review_note:"ผ่านการตรวจ",       description:noDesc,    due_date:due(-15), created_by:"p9",  priority:"normal" },
      { id:"tk50", title:"อัปเดต SLA Document",                     status:"approved", assigned_to:"p3", team_id:"tm4", created_at:ago(28), review_note:"ผ่าน",               description:noDesc,    due_date:due(-8),  created_by:"p7",  priority:"normal" },
      { id:"tk51", title:"ส่งรายงาน Weekly ครบ 4 สัปดาห์",         status:"approved", assigned_to:"p1", team_id:"tm1", created_at:ago(45), review_note:"เสร็จสมบูรณ์",      description:noDesc,    due_date:due(-25), created_by:"p10", priority:"normal" },
      // รอยืนยันยกเลิก ×8
      { id:"tk52", title:"ติดต่อลูกค้า X (เลิกกิจการแล้ว)",        status:"cancelled", assigned_to:"p2", team_id:"tm1", created_at:ago(12), review_note:"ลูกค้าขอยกเลิก",          description:noDesc,    due_date:null,    created_by:"p10", priority:"normal" },
      { id:"tk53", title:"จัด Workshop ที่ถูกยกเลิกกะทันหัน",       status:"cancelled", assigned_to:"p4", team_id:"tm2", created_at:ago(9),  review_note:"venue ยกเลิก",              description:noDesc,    due_date:null,    created_by:"p4",  priority:"high"   },
      { id:"tk54", title:"เตรียม Proposal ที่ลูกค้าถอนตัว",         status:"cancelled", assigned_to:"p6", team_id:"tm3", created_at:ago(6),  review_note:"ลูกค้าเปลี่ยนใจ",          description:sme("05"), due_date:null,    created_by:"p6",  priority:"normal" },
      { id:"tk55", title:"ทำรายงาน Q3 (พบว่าซ้ำกัน)",              status:"cancelled", assigned_to:"p8", team_id:"tm5", created_at:ago(15), review_note:"ซ้ำกับงานอื่น",            description:noDesc,    due_date:null,    created_by:"p9",  priority:"normal" },
      { id:"tk56", title:"ติดตาม Lead ที่หมดอายุ",                  status:"cancelled", assigned_to:"p3", team_id:null,  created_at:ago(5),  review_note:"lead หมดอายุ",              description:noDesc,    due_date:null,    created_by:"p10", priority:"normal" },
      { id:"tk57", title:"จัด Meeting ที่ถูกเลื่อนแล้วยกเลิก",      status:"cancelled", assigned_to:"p5", team_id:"tm4", created_at:ago(3),  review_note:"ยกเลิกโดยลูกค้า",          description:noDesc,    due_date:null,    created_by:"p7",  priority:"normal" },
      { id:"tk58", title:"ส่ง Email Campaign ผิด Segment",          status:"cancelled", assigned_to:"p9", team_id:"tm5", created_at:ago(8),  review_note:"ส่งผิดกลุ่ม ต้องรอยืนยัน", description:sme("06"), due_date:null,    created_by:"p9",  priority:"high"   },
      { id:"tk59", title:"อัปเดต Database ข้อมูลซ้ำซ้อน",          status:"cancelled", assigned_to:"p7", team_id:"tm3", created_at:ago(4),  review_note:"ข้อมูลซ้ำ ยกเลิก",         description:noDesc,    due_date:null,    created_by:"p6",  priority:"normal" },
      // ยกเลิกแล้ว ×8
      { id:"tk60", title:"สร้าง Report ที่ไม่ต้องการแล้ว",          status:"cancelled", assigned_to:"p1", team_id:"tm1", created_at:ago(30), review_note:"แอดมินยืนยัน: ยกเลิกเรียบร้อย", description:noDesc,    due_date:null,    created_by:"p10", priority:"normal" },
      { id:"tk61", title:"ติดต่อลูกค้า Y ที่ยุติ Engagement",        status:"cancelled", assigned_to:"p2", team_id:"tm2", created_at:ago(25), review_note:"แอดมินยืนยัน: ปิดเคส",         description:noDesc,    due_date:null,    created_by:"p10", priority:"normal" },
      { id:"tk62", title:"จัดทำ Content แคมเปญที่ถูกยกเลิก",        status:"cancelled", assigned_to:"p6", team_id:"tm5", created_at:ago(20), review_note:"แอดมินยืนยัน: ยกเลิก Q2",      description:sme("06"), due_date:null,    created_by:"p9",  priority:"normal" },
      { id:"tk63", title:"ทำ Analysis ที่ไม่ได้ใช้งาน",             status:"cancelled", assigned_to:"p3", team_id:"tm3", created_at:ago(35), review_note:"แอดมินยืนยัน: deprecated",      description:noDesc,    due_date:null,    created_by:"p6",  priority:"normal" },
      { id:"tk64", title:"เตรียม Doc สำหรับ Meeting ที่ยกเลิกไปแล้ว",status:"cancelled",assigned_to:"p5", team_id:"tm1", created_at:ago(18), review_note:"แอดมินยืนยัน: ยกเลิกแล้ว",     description:noDesc,    due_date:null,    created_by:"p1",  priority:"normal" },
      { id:"tk65", title:"อัปเดต Pipeline สาขาที่ปิดตัว",           status:"cancelled", assigned_to:"p4", team_id:"tm2", created_at:ago(40), review_note:"แอดมินยืนยัน: สาขาปิด",        description:noDesc,    due_date:null,    created_by:"p4",  priority:"normal" },
      { id:"tk66", title:"ส่ง Follow-up ที่ลูกค้าไม่ตอบ 3 เดือน",   status:"cancelled", assigned_to:"p8", team_id:null,  created_at:ago(60), review_note:"แอดมินยืนยัน: หมดเวลา",        description:noDesc,    due_date:null,    created_by:"p10", priority:"normal" },
      { id:"tk67", title:"จัดทำ Template ที่เลิกใช้แล้ว",           status:"cancelled", assigned_to:"p9", team_id:"tm4", created_at:ago(50), review_note:"แอดมินยืนยัน: เลิกใช้",        description:noDesc,    due_date:null,    created_by:"p7",  priority:"normal" },

      // ─── +100 งาน ───────────────────────────────────────────────────────────
      // งานอิสระ ×15
      { id:"tk68",  title:"ติดต่อลูกค้าใหม่ SME รายย่อย",            status:"open", assigned_to:"p1",  team_id:null,  created_at:ago(1),      review_note:null, description:sme("08"), due_date:due(5),   created_by:"p10", priority:"high"   },
      { id:"tk69",  title:"ส่งใบเสนอราคา Package LINE OA",            status:"open", assigned_to:"p2",  team_id:null,  created_at:ago(3),      review_note:null, description:sme("02"), due_date:due(3),   created_by:"p10", priority:"urgent" },
      { id:"tk70",  title:"เจรจาต่อสัญญาลูกค้าเดิม",                 status:"open", assigned_to:"p3",  team_id:null,  created_at:ago(2),      review_note:null, description:noDesc,    due_date:due(7),   created_by:"p1",  priority:"high"   },
      { id:"tk71",  title:"ปิดการขาย Package Premium ลูกค้า E",       status:"open", assigned_to:"p4",  team_id:null,  created_at:ago(1),      review_note:null, description:sme("04"), due_date:due(1),   created_by:"p10", priority:"urgent" },
      { id:"tk72",  title:"ติดตาม Lead จาก Facebook Ads",             status:"open", assigned_to:"p5",  team_id:null,  created_at:ago(4),      review_note:null, description:noDesc,    due_date:due(4),   created_by:"p10", priority:"normal" },
      { id:"tk73",  title:"ทำ Proposal สำหรับลูกค้าองค์กร F",         status:"open", assigned_to:"p6",  team_id:null,  created_at:ago(2),      review_note:null, description:sme("03"), due_date:due(2),   created_by:"p10", priority:"urgent" },
      { id:"tk74",  title:"นำเสนอ LINE OA Solution ลูกค้า G",         status:"open", assigned_to:"p7",  team_id:null,  created_at:ago(1),      review_note:null, description:noDesc,    due_date:due(6),   created_by:"p7",  priority:"normal" },
      { id:"tk75",  title:"ส่ง Demo Video ให้ลูกค้า H",               status:"open", assigned_to:"p8",  team_id:null,  created_at:ago(3),      review_note:null, description:noDesc,    due_date:due(8),   created_by:"p9",  priority:"normal" },
      { id:"tk76",  title:"อัปเดตข้อมูล Contact ลูกค้าใหม่",          status:"open", assigned_to:"p9",  team_id:null,  created_at:ago(2),      review_note:null, description:sme("05"), due_date:due(3),   created_by:"p10", priority:"normal" },
      { id:"tk77",  title:"ทำรายงานสรุปลูกค้าใหม่รายเดือน",           status:"open", assigned_to:"p1",  team_id:null,  created_at:ago(5),      review_note:null, description:noDesc,    due_date:due(10),  created_by:"p10", priority:"normal" },
      { id:"tk78",  title:"วิเคราะห์ Churn Rate ไตรมาส 2",            status:"open", assigned_to:"p2",  team_id:null,  created_at:ago(4),      review_note:null, description:sme("09"), due_date:due(14),  created_by:"p2",  priority:"high"   },
      { id:"tk79",  title:"ตรวจสอบ Database ลูกค้าทั้งหมด",           status:"open", assigned_to:"p3",  team_id:null,  created_at:ago(6),      review_note:null, description:noDesc,    due_date:due(-1),  created_by:"p10", priority:"urgent" },
      { id:"tk80",  title:"แก้ปัญหา Bot ลูกค้า I ไม่ตอบสนอง",        status:"open", assigned_to:"p4",  team_id:null,  created_at:ago(1),      review_note:null, description:noDesc,    due_date:due(0),   created_by:"p4",  priority:"urgent" },
      { id:"tk81",  title:"ช่วยตั้งค่า Rich Menu ลูกค้า J",           status:"open", assigned_to:"p5",  team_id:null,  created_at:ago(2),      review_note:null, description:sme("07"), due_date:due(5),   created_by:"p7",  priority:"high"   },
      { id:"tk82",  title:"จัดทำ Customer Journey Map",               status:"open", assigned_to:"p6",  team_id:null,  created_at:ago(3),      review_note:null, description:sme("10"), due_date:due(7),   created_by:"p10", priority:"normal" },
      // รอรับงาน ×10
      { id:"tk83",  title:"ทำ Content IG Reel ประจำสัปดาห์",          status:"open", assigned_to:null,  team_id:"tm5", created_at:minsAgo(25), review_note:null, description:sme("06"), due_date:due(3),   created_by:"p9",  priority:"high"   },
      { id:"tk84",  title:"วางแผน Email Campaign เดือนหน้า",           status:"open", assigned_to:null,  team_id:"tm5", created_at:minsAgo(40), review_note:null, description:noDesc,    due_date:due(10),  created_by:"p9",  priority:"normal" },
      { id:"tk85",  title:"ออกแบบ Banner โปรโมชัน Summer",            status:"open", assigned_to:null,  team_id:"tm5", created_at:minsAgo(12), review_note:null, description:noDesc,    due_date:due(5),   created_by:"p10", priority:"normal" },
      { id:"tk86",  title:"จัดทำ Landing Page ลูกค้า K",              status:"open", assigned_to:null,  team_id:"tm2", created_at:minsAgo(18), review_note:null, description:sme("03"), due_date:due(7),   created_by:"p4",  priority:"high"   },
      { id:"tk87",  title:"ส่ง Proposal ลูกค้า L ก่อนสิ้นเดือน",     status:"open", assigned_to:null,  team_id:"tm1", created_at:minsAgo(6),  review_note:null, description:sme("01"), due_date:due(1),   created_by:"p1",  priority:"urgent" },
      { id:"tk88",  title:"ตั้งค่า Automation สำหรับลูกค้า M",        status:"open", assigned_to:null,  team_id:"tm3", created_at:minsAgo(35), review_note:null, description:sme("05"), due_date:due(6),   created_by:"p6",  priority:"normal" },
      { id:"tk89",  title:"ทดสอบ Chatbot ลูกค้า N",                   status:"open", assigned_to:null,  team_id:"tm4", created_at:minsAgo(22), review_note:null, description:noDesc,    due_date:due(2),   created_by:"p7",  priority:"high"   },
      { id:"tk90",  title:"จัดประชุม Kickoff ลูกค้า O",               status:"open", assigned_to:null,  team_id:"tm1", created_at:minsAgo(50), review_note:null, description:noDesc,    due_date:due(4),   created_by:"p1",  priority:"normal" },
      { id:"tk91",  title:"ส่ง Monthly Report ให้ลูกค้า P",           status:"open", assigned_to:null,  team_id:"tm2", created_at:minsAgo(15), review_note:null, description:sme("02"), due_date:due(3),   created_by:"p4",  priority:"high"   },
      { id:"tk92",  title:"ตรวจสอบ Broadcast ที่มีปัญหา",             status:"open", assigned_to:null,  team_id:"tm4", created_at:minsAgo(8),  review_note:null, description:noDesc,    due_date:due(0),   created_by:"p7",  priority:"urgent" },
      // open expired (ทีม + เก่า = งานอิสระ) ×5
      { id:"tk93",  title:"Follow-up ลูกค้า Q ค้างมานาน (หมดเวลา)",   status:"open", assigned_to:null,  team_id:"tm1", created_at:ago(8),      review_note:null, description:noDesc,    due_date:due(-4),  created_by:"p1",  priority:"high"   },
      { id:"tk94",  title:"Proposal ที่ไม่มีคนรับ (หมดเวลา)",          status:"open", assigned_to:null,  team_id:"tm2", created_at:ago(12),     review_note:null, description:sme("02"), due_date:due(-7),  created_by:"p4",  priority:"normal" },
      { id:"tk95",  title:"อัปเดต CRM เก่าที่ค้างอยู่ (หมดเวลา)",     status:"open", assigned_to:null,  team_id:"tm3", created_at:ago(9),      review_note:null, description:noDesc,    due_date:due(-6),  created_by:"p6",  priority:"normal" },
      { id:"tk96",  title:"รายงานค้างส่งสัปดาห์ที่แล้ว (หมดเวลา)",    status:"open", assigned_to:null,  team_id:"tm4", created_at:ago(11),     review_note:null, description:noDesc,    due_date:due(-9),  created_by:"p7",  priority:"urgent" },
      { id:"tk97",  title:"งาน Marketing ไม่มีคนรับนาน (หมดเวลา)",     status:"open", assigned_to:null,  team_id:"tm5", created_at:ago(15),     review_note:null, description:sme("06"), due_date:due(-11), created_by:"p9",  priority:"normal" },
      // in_progress ×20
      { id:"tk98",  title:"วิเคราะห์ผล A/B Test แคมเปญล่าสุด",        status:"in_progress", assigned_to:"p1", team_id:"tm5", created_at:ago(2),  review_note:null, description:sme("06"), due_date:due(3),   created_by:"p9",  priority:"high"   },
      { id:"tk99",  title:"ทำวิดีโอ Tutorial LINE OA",                 status:"in_progress", assigned_to:"p2", team_id:"tm5", created_at:ago(4),  review_note:null, description:noDesc,    due_date:due(7),   created_by:"p9",  priority:"normal" },
      { id:"tk100", title:"แก้ข้อผิดพลาด API Integration",             status:"in_progress", assigned_to:"p3", team_id:"tm4", created_at:ago(1),  review_note:null, description:sme("07"), due_date:due(1),   created_by:"p7",  priority:"urgent" },
      { id:"tk101", title:"ทำ SEO Report เว็บไซต์ลูกค้า R",            status:"in_progress", assigned_to:"p4", team_id:"tm5", created_at:ago(3),  review_note:null, description:noDesc,    due_date:due(5),   created_by:"p10", priority:"normal" },
      { id:"tk102", title:"ออกแบบ UX ระบบ Dashboard ใหม่",             status:"in_progress", assigned_to:"p5", team_id:"tm3", created_at:ago(5),  review_note:null, description:sme("09"), due_date:due(10),  created_by:"p6",  priority:"high"   },
      { id:"tk103", title:"ประสานงานกับ Partner ภาคเหนือ",             status:"in_progress", assigned_to:"p6", team_id:"tm1", created_at:ago(2),  review_note:null, description:noDesc,    due_date:due(4),   created_by:"p1",  priority:"normal" },
      { id:"tk104", title:"เตรียมข้อมูลการประชุมผู้บริหาร",             status:"in_progress", assigned_to:"p7", team_id:"tm3", created_at:ago(1),  review_note:null, description:noDesc,    due_date:due(0),   created_by:"p10", priority:"urgent" },
      { id:"tk105", title:"สรุปผลการขายประจำสัปดาห์",                  status:"in_progress", assigned_to:"p8", team_id:"tm2", created_at:ago(3),  review_note:null, description:sme("02"), due_date:due(2),   created_by:"p4",  priority:"high"   },
      { id:"tk106", title:"ทำ Infographic ผลิตภัณฑ์ใหม่",              status:"in_progress", assigned_to:"p9", team_id:"tm5", created_at:ago(2),  review_note:null, description:noDesc,    due_date:due(6),   created_by:"p9",  priority:"normal" },
      { id:"tk107", title:"จัดทำแผนธุรกิจ Q3",                         status:"in_progress", assigned_to:"p1", team_id:"tm1", created_at:ago(6),  review_note:null, description:sme("01"), due_date:due(14),  created_by:"p10", priority:"high"   },
      { id:"tk108", title:"ทำ Customer Feedback Survey",               status:"in_progress", assigned_to:"p2", team_id:"tm3", created_at:ago(4),  review_note:null, description:noDesc,    due_date:due(5),   created_by:"p6",  priority:"normal" },
      { id:"tk109", title:"ตรวจสอบความถูกต้อง Data Migration",         status:"in_progress", assigned_to:"p3", team_id:"tm3", created_at:ago(2),  review_note:null, description:sme("05"), due_date:due(3),   created_by:"p6",  priority:"urgent" },
      { id:"tk110", title:"จัดทำ SOP การรับลูกค้าใหม่",               status:"in_progress", assigned_to:"p4", team_id:"tm1", created_at:ago(5),  review_note:null, description:noDesc,    due_date:due(8),   created_by:"p1",  priority:"normal" },
      { id:"tk111", title:"ทำ Competitive Analysis รายคู่แข่ง",        status:"in_progress", assigned_to:"p5", team_id:"tm2", created_at:ago(3),  review_note:null, description:sme("03"), due_date:due(7),   created_by:"p10", priority:"high"   },
      { id:"tk112", title:"อัปเดต Product Roadmap",                    status:"in_progress", assigned_to:"p6", team_id:"tm3", created_at:ago(7),  review_note:null, description:noDesc,    due_date:due(21),  created_by:"p6",  priority:"normal" },
      { id:"tk113", title:"ฝึกอบรมทีม Support รุ่นใหม่",              status:"in_progress", assigned_to:"p7", team_id:"tm4", created_at:ago(4),  review_note:null, description:noDesc,    due_date:due(5),   created_by:"p7",  priority:"normal" },
      { id:"tk114", title:"ทำ Budget Plan ครึ่งปีหลัง",                status:"in_progress", assigned_to:"p8", team_id:"tm1", created_at:ago(2),  review_note:null, description:noDesc,    due_date:due(3),   created_by:"p10", priority:"urgent" },
      { id:"tk115", title:"แก้ปัญหา Webhook ลูกค้า S ใช้ไม่ได้",       status:"in_progress", assigned_to:"p9", team_id:"tm4", created_at:ago(1),  review_note:null, description:sme("07"), due_date:due(0),   created_by:"p7",  priority:"urgent" },
      { id:"tk116", title:"จัดทำ Loyalty Program สำหรับลูกค้า VIP",     status:"in_progress", assigned_to:"p1", team_id:"tm5", created_at:ago(5),  review_note:null, description:sme("08"), due_date:due(9),   created_by:"p9",  priority:"high"   },
      { id:"tk117", title:"สร้าง Template ข้อความ LINE OA",             status:"in_progress", assigned_to:"p2", team_id:"tm4", created_at:ago(3),  review_note:null, description:noDesc,    due_date:due(4),   created_by:"p7",  priority:"normal" },
      // done (รอตรวจสอบ) ×15
      { id:"tk118", title:"ส่ง Weekly Report ครบทุกทีม",               status:"done", assigned_to:"p3", team_id:"tm2", created_at:ago(7),  review_note:null, description:sme("02"), due_date:due(-1),  created_by:"p4",  priority:"normal" },
      { id:"tk119", title:"จัด Workshop LINE OA ให้ลูกค้า T",          status:"done", assigned_to:"p4", team_id:"tm1", created_at:ago(5),  review_note:null, description:sme("01"), due_date:due(0),   created_by:"p1",  priority:"high"   },
      { id:"tk120", title:"ทำ Scorecard ผลลัพธ์ลูกค้ารายใหญ่",         status:"done", assigned_to:"p5", team_id:"tm2", created_at:ago(9),  review_note:null, description:noDesc,    due_date:due(1),   created_by:"p10", priority:"normal" },
      { id:"tk121", title:"เขียน Blog ให้ความรู้ LINE OA",              status:"done", assigned_to:"p6", team_id:"tm5", created_at:ago(6),  review_note:null, description:noDesc,    due_date:due(2),   created_by:"p9",  priority:"normal" },
      { id:"tk122", title:"ตรวจสอบ NPS Score ลูกค้า",                  status:"done", assigned_to:"p7", team_id:"tm4", created_at:ago(4),  review_note:null, description:noDesc,    due_date:due(-2),  created_by:"p7",  priority:"high"   },
      { id:"tk123", title:"อัปเดต Pricing ใหม่ในระบบ",                 status:"done", assigned_to:"p8", team_id:"tm1", created_at:ago(8),  review_note:null, description:sme("04"), due_date:due(0),   created_by:"p1",  priority:"normal" },
      { id:"tk124", title:"ส่งมอบ Report ผลลัพธ์ Campaign ลูกค้า U",    status:"done", assigned_to:"p9", team_id:"tm5", created_at:ago(5),  review_note:null, description:sme("06"), due_date:due(1),   created_by:"p9",  priority:"normal" },
      { id:"tk125", title:"จัดทำ Case Study ลูกค้า V",                  status:"done", assigned_to:"p1", team_id:"tm3", created_at:ago(10), review_note:null, description:noDesc,    due_date:due(3),   created_by:"p6",  priority:"normal" },
      { id:"tk126", title:"ทำ Post-Sales Checklist ลูกค้าใหม่",         status:"done", assigned_to:"p2", team_id:"tm1", created_at:ago(7),  review_note:null, description:noDesc,    due_date:due(-1),  created_by:"p1",  priority:"high"   },
      { id:"tk127", title:"สรุปข้อมูลลูกค้า Churn เดือนที่แล้ว",       status:"done", assigned_to:"p3", team_id:"tm3", created_at:ago(11), review_note:null, description:sme("05"), due_date:due(2),   created_by:"p10", priority:"urgent" },
      { id:"tk128", title:"ทำ Pre-sales Demo สำหรับลูกค้า W",           status:"done", assigned_to:"p4", team_id:"tm2", created_at:ago(6),  review_note:null, description:sme("03"), due_date:due(0),   created_by:"p4",  priority:"high"   },
      { id:"tk129", title:"จัดทำคู่มือการใช้งาน LINE OA",               status:"done", assigned_to:"p5", team_id:"tm4", created_at:ago(4),  review_note:null, description:noDesc,    due_date:due(1),   created_by:"p7",  priority:"normal" },
      { id:"tk130", title:"ตอบ Ticket Support #789",                   status:"done", assigned_to:"p6", team_id:"tm4", created_at:ago(3),  review_note:null, description:noDesc,    due_date:due(-1),  created_by:"p7",  priority:"urgent" },
      { id:"tk131", title:"ส่งรายงาน KPI ให้ผู้บริหาร",                status:"done", assigned_to:"p7", team_id:"tm1", created_at:ago(8),  review_note:null, description:noDesc,    due_date:due(2),   created_by:"p10", priority:"high"   },
      { id:"tk132", title:"อัปเดตข้อมูล Competitor ในระบบ",            status:"done", assigned_to:"p8", team_id:"tm2", created_at:ago(5),  review_note:null, description:sme("09"), due_date:due(0),   created_by:"p4",  priority:"normal" },
      // approved ×15
      { id:"tk133", title:"จัดทำ Roadmap ลูกค้า X ปีหน้า",             status:"approved", assigned_to:"p1", team_id:"tm1", created_at:ago(30), review_note:"ผ่านการตรวจสอบ",        description:sme("01"), due_date:due(-10), created_by:"p10", priority:"high"   },
      { id:"tk134", title:"ปิดการขาย Enterprise Y สำเร็จ",             status:"approved", assigned_to:"p2", team_id:"tm2", created_at:ago(22), review_note:"ผ่าน สุดยอด",            description:noDesc,    due_date:due(-5),  created_by:"p4",  priority:"urgent" },
      { id:"tk135", title:"ทำ Post-Campaign Report Q1",                status:"approved", assigned_to:"p3", team_id:"tm5", created_at:ago(18), review_note:"เสร็จสมบูรณ์",           description:sme("06"), due_date:due(-3),  created_by:"p9",  priority:"normal" },
      { id:"tk136", title:"อบรมการใช้ CRM ทีมใหม่",                    status:"approved", assigned_to:"p4", team_id:"tm3", created_at:ago(25), review_note:"ผ่าน",                   description:noDesc,    due_date:due(-8),  created_by:"p6",  priority:"normal" },
      { id:"tk137", title:"จัดทำ SLA ฉบับใหม่สำหรับ Enterprise",       status:"approved", assigned_to:"p5", team_id:"tm4", created_at:ago(20), review_note:"ตรวจสอบแล้ว ผ่าน",      description:noDesc,    due_date:due(-6),  created_by:"p7",  priority:"normal" },
      { id:"tk138", title:"ส่งมอบงาน Branding ลูกค้า Z",               status:"approved", assigned_to:"p6", team_id:"tm5", created_at:ago(15), review_note:"งานดีมาก ผ่าน",          description:noDesc,    due_date:due(-2),  created_by:"p9",  priority:"high"   },
      { id:"tk139", title:"ทำ Win/Loss Analysis Q2",                   status:"approved", assigned_to:"p7", team_id:"tm2", created_at:ago(32), review_note:"ผ่านการตรวจสอบแล้ว",    description:sme("03"), due_date:due(-12), created_by:"p10", priority:"normal" },
      { id:"tk140", title:"จัดเตรียม Marketing Budget ปีหน้า",          status:"approved", assigned_to:"p8", team_id:"tm5", created_at:ago(28), review_note:"อนุมัติแล้ว",            description:noDesc,    due_date:due(-9),  created_by:"p9",  priority:"high"   },
      { id:"tk141", title:"ตรวจสอบ Contract ลูกค้า AA",                status:"approved", assigned_to:"p9", team_id:"tm1", created_at:ago(17), review_note:"ถูกต้อง ผ่าน",           description:sme("01"), due_date:due(-4),  created_by:"p1",  priority:"urgent" },
      { id:"tk142", title:"ส่งรายงาน Onboarding 30 วัน",               status:"approved", assigned_to:"p1", team_id:"tm3", created_at:ago(35), review_note:"ผ่าน",                   description:noDesc,    due_date:due(-14), created_by:"p6",  priority:"normal" },
      { id:"tk143", title:"ทำ Partner Agreement ฉบับสมบูรณ์",          status:"approved", assigned_to:"p2", team_id:"tm2", created_at:ago(40), review_note:"เสร็จสมบูรณ์ ผ่าน",      description:noDesc,    due_date:due(-18), created_by:"p4",  priority:"normal" },
      { id:"tk144", title:"ปิด Lead โอกาสสูง Batch 3",                 status:"approved", assigned_to:"p3", team_id:"tm1", created_at:ago(12), review_note:"ผ่านการตรวจสอบ",        description:sme("01"), due_date:due(-1),  created_by:"p1",  priority:"high"   },
      { id:"tk145", title:"จัดทำ Customer Retention Plan",             status:"approved", assigned_to:"p4", team_id:"tm3", created_at:ago(45), review_note:"ผ่าน แผนดีมาก",          description:sme("05"), due_date:due(-20), created_by:"p10", priority:"normal" },
      { id:"tk146", title:"ส่งมอบโปรเจกต์ LINE OA ลูกค้า BB",          status:"approved", assigned_to:"p5", team_id:"tm4", created_at:ago(19), review_note:"ส่งมอบเรียบร้อย ผ่าน",  description:noDesc,    due_date:due(-7),  created_by:"p7",  priority:"high"   },
      { id:"tk147", title:"ทำ Annual Review ลูกค้า Platinum",           status:"approved", assigned_to:"p6", team_id:"tm1", created_at:ago(50), review_note:"ผ่าน รายงานครบถ้วน",    description:sme("08"), due_date:due(-22), created_by:"p10", priority:"urgent" },
      // รอยืนยันยกเลิก ×10
      { id:"tk148", title:"Proposal ลูกค้า CC ที่ขอยกเลิก",            status:"cancelled", assigned_to:"p7", team_id:"tm2", created_at:ago(5),  review_note:"ลูกค้าขอยกเลิก",      description:noDesc,    due_date:null, created_by:"p4",  priority:"normal" },
      { id:"tk149", title:"Campaign ถูกยกเลิกเพราะงบถูกตัด",           status:"cancelled", assigned_to:"p8", team_id:"tm5", created_at:ago(7),  review_note:"งบถูกตัด รอยืนยัน",   description:sme("06"), due_date:null, created_by:"p9",  priority:"high"   },
      { id:"tk150", title:"จัด Event ที่ลูกค้าเปลี่ยนแผนกะทันหัน",     status:"cancelled", assigned_to:"p9", team_id:"tm5", created_at:ago(3),  review_note:"ลูกค้าเปลี่ยนแผน",    description:noDesc,    due_date:null, created_by:"p9",  priority:"normal" },
      { id:"tk151", title:"ติดตาม Lead ที่ซ้ำกับทีม Alpha",             status:"cancelled", assigned_to:"p1", team_id:"tm1", created_at:ago(4),  review_note:"งานซ้ำซ้อน",          description:noDesc,    due_date:null, created_by:"p1",  priority:"normal" },
      { id:"tk152", title:"ส่ง Report ที่ปรากฎว่าไม่ต้องการแล้ว",      status:"cancelled", assigned_to:"p2", team_id:"tm2", created_at:ago(6),  review_note:"ยกเลิกโดยหัวหน้าทีม", description:noDesc,    due_date:null, created_by:"p10", priority:"normal" },
      { id:"tk153", title:"Integration ที่ถูกเลื่อนไม่มีกำหนด",         status:"cancelled", assigned_to:"p3", team_id:"tm3", created_at:ago(8),  review_note:"เลื่อนออกไปก่อน",     description:sme("05"), due_date:null, created_by:"p6",  priority:"high"   },
      { id:"tk154", title:"ส่ง Broadcast ที่มี Error ในข้อความ",        status:"cancelled", assigned_to:"p4", team_id:"tm4", created_at:ago(2),  review_note:"ข้อความผิด รอยืนยัน", description:noDesc,    due_date:null, created_by:"p7",  priority:"urgent" },
      { id:"tk155", title:"อัปเดต Pricing ที่มีข้อมูลผิดพลาด",          status:"cancelled", assigned_to:"p5", team_id:"tm1", created_at:ago(1),  review_note:"ข้อมูลไม่ถูกต้อง",    description:noDesc,    due_date:null, created_by:"p10", priority:"urgent" },
      { id:"tk156", title:"จัด Training ที่ทีมไม่ครบ",                  status:"cancelled", assigned_to:"p6", team_id:"tm3", created_at:ago(5),  review_note:"ทีมไม่ครบ รอยืนยัน",  description:noDesc,    due_date:null, created_by:"p6",  priority:"normal" },
      { id:"tk157", title:"ปิด Deal ที่ลูกค้าขอ Hold ก่อน",             status:"cancelled", assigned_to:"p7", team_id:"tm2", created_at:ago(3),  review_note:"ลูกค้าขอ Hold",       description:sme("03"), due_date:null, created_by:"p4",  priority:"normal" },
      // ยกเลิกแล้ว (admin confirmed) ×10
      { id:"tk158", title:"งาน Legacy ที่เลิกใช้ระบบแล้ว",              status:"cancelled", assigned_to:"p8", team_id:"tm4", created_at:ago(60), review_note:"แอดมินยืนยัน: ปิดเคสแล้ว",      description:noDesc,    due_date:null, created_by:"p7",  priority:"normal" },
      { id:"tk159", title:"Proposal สำหรับโปรเจกต์ที่ยุติไปแล้ว",       status:"cancelled", assigned_to:"p9", team_id:"tm1", created_at:ago(45), review_note:"แอดมินยืนยัน: ยกเลิกถาวร",     description:noDesc,    due_date:null, created_by:"p1",  priority:"normal" },
      { id:"tk160", title:"Campaign ที่หมดงบก่อนกำหนด",                 status:"cancelled", assigned_to:"p1", team_id:"tm5", created_at:ago(55), review_note:"แอดมินยืนยัน: ยกเลิก Q1",      description:sme("06"), due_date:null, created_by:"p9",  priority:"normal" },
      { id:"tk161", title:"อัปเดตลูกค้าที่เลิกใช้บริการแล้ว",           status:"cancelled", assigned_to:"p2", team_id:"tm3", created_at:ago(70), review_note:"แอดมินยืนยัน: ลูกค้าออกจากระบบ", description:noDesc,    due_date:null, created_by:"p6",  priority:"normal" },
      { id:"tk162", title:"จัด Event ที่ถูกยกเลิกถาวร",                 status:"cancelled", assigned_to:"p3", team_id:"tm5", created_at:ago(38), review_note:"แอดมินยืนยัน: ยกเลิกแล้ว",     description:noDesc,    due_date:null, created_by:"p10", priority:"high"   },
      { id:"tk163", title:"Report ที่ซ้ำกับงานอื่น (ยืนยันแล้ว)",       status:"cancelled", assigned_to:"p4", team_id:"tm2", created_at:ago(42), review_note:"แอดมินยืนยัน: งานซ้ำ ยกเลิก",  description:noDesc,    due_date:null, created_by:"p4",  priority:"normal" },
      { id:"tk164", title:"Integration กับระบบเก่าที่ปิดตัวแล้ว",        status:"cancelled", assigned_to:"p5", team_id:"tm3", created_at:ago(50), review_note:"แอดมินยืนยัน: ระบบเก่าปิดตัว",  description:sme("07"), due_date:null, created_by:"p7",  priority:"normal" },
      { id:"tk165", title:"Branding สำหรับสินค้าที่ยกเลิก Production",   status:"cancelled", assigned_to:"p6", team_id:"tm5", created_at:ago(65), review_note:"แอดมินยืนยัน: ยกเลิกสินค้า",    description:noDesc,    due_date:null, created_by:"p9",  priority:"normal" },
      { id:"tk166", title:"ส่ง Report ลูกค้าที่ยุติสัญญาแล้ว",           status:"cancelled", assigned_to:"p7", team_id:"tm1", created_at:ago(80), review_note:"แอดมินยืนยัน: สิ้นสุดสัญญา",    description:sme("04"), due_date:null, created_by:"p1",  priority:"normal" },
      { id:"tk167", title:"ปิด Account ลูกค้าที่ไม่ต่ออายุ",             status:"cancelled", assigned_to:"p8", team_id:"tm2", created_at:ago(90), review_note:"แอดมินยืนยัน: หมดสัญญา ปิด",   description:noDesc,    due_date:null, created_by:"p10", priority:"normal" },
    ];

    setProfiles(mockProfiles);
    setTeams(mockTeams);
    setTasks(mockTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setLoading(false);
  };

  const smeOptions = useMemo(
    () => [...new Set(tasks.map((t) => extractSme(t.description)).filter(Boolean))] as string[],
    [tasks]
  );
  const assigneeOptions = useMemo(() => {
    const ids = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[];
    return ids.map((id) => profileMap[id]).filter(Boolean);
  }, [tasks, profileMap]);
  const creatorOptions = useMemo(() => {
    const ids = [...new Set(tasks.map((t) => t.created_by).filter(Boolean))] as string[];
    return ids.map((id) => profileMap[id]).filter(Boolean);
  }, [tasks, profileMap]);
  const teamOptions = useMemo(() => {
    const ids = [...new Set(tasks.map((t) => t.team_id).filter(Boolean))] as string[];
    return ids.map((id) => teamMap[id]).filter(Boolean);
  }, [tasks, teamMap]);

  const advancedActive = smeFilter !== "__all__" || teamFilter !== "__all__" || assigneeFilter !== "__all__" || creatorFilter !== "__all__" || priorityFilter !== "__all__" || dueDateRange !== "__all__" || assignmentFilter !== "__all__";
  const resetAdvanced = () => {
    setSmeFilter("__all__"); setTeamFilter("__all__"); setAssigneeFilter("__all__"); setAssigneeSearch("");
    setCreatorFilter("__all__"); setCreatorSearch(""); setPriorityFilter("__all__"); setDueDateRange("__all__"); setAssignmentFilter("__all__");
    setCurrentPage(1);
  };
  const changeStatus     = (v: FilterKey | null) => { setStatusFilter(v); setCurrentPage(1); };
  const changeSearch     = (v: string) => { setSearch(v); setCurrentPage(1); };
  const changeSort       = (v: SortKey) => { setSortKey(v); setCurrentPage(1); };
  const changeSme        = (v: string) => { setSmeFilter(v); setCurrentPage(1); };
  const changeTeam       = (v: string) => { setTeamFilter(v); setCurrentPage(1); };
  const changeAssignee   = (v: string) => { setAssigneeFilter(v); setCurrentPage(1); };
  const changeCreator    = (v: string) => { setCreatorFilter(v); setCurrentPage(1); };
  const changePriority   = (v: string) => { setPriorityFilter(v as Priority | "__all__"); setCurrentPage(1); };
  const changeDueRange   = (v: string) => { setDueDateRange(v as typeof dueDateRange); setCurrentPage(1); };
  const changeAssignment = (v: string) => { setAssignmentFilter(v as typeof assignmentFilter); setCurrentPage(1); };

  const filtered = tasks.filter((t) => {
    if (statusFilter && !matchStatusFilter(t, statusFilter)) return false;
    if (smeFilter !== "__all__" && extractSme(t.description) !== smeFilter) return false;
    if (teamFilter !== "__all__" && t.team_id !== teamFilter) return false;
    if (assigneeFilter !== "__all__" && t.assigned_to !== assigneeFilter) return false;
    if (creatorFilter !== "__all__" && t.created_by !== creatorFilter) return false;
    if (priorityFilter !== "__all__" && (t.priority ?? "normal") !== priorityFilter) return false;
    if (assignmentFilter === "assigned"   && !t.assigned_to) return false;
    if (assignmentFilter === "unassigned" && !!t.assigned_to) return false;
    if (dueDateRange !== "__all__") {
      const today     = new Date().toISOString().slice(0, 10);
      const weekLater = new Date(Date.now() + 7  * 86400000).toISOString().slice(0, 10);
      const monthLater= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      if (dueDateRange === "none"    && t.due_date)                               return false;
      if (dueDateRange === "overdue" && (!t.due_date || t.due_date >= today))     return false;
      if (dueDateRange === "today"   && t.due_date !== today)                     return false;
      if (dueDateRange === "week"    && (!t.due_date || t.due_date > weekLater))  return false;
      if (dueDateRange === "month"   && (!t.due_date || t.due_date > monthLater)) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const assignee = t.assigned_to ? profileMap[t.assigned_to] : null;
      const assigneeName = (assignee?.display_name || assignee?.email || "").toLowerCase();
      const teamName = (t.team_id ? teamMap[t.team_id]?.name || "" : "").toLowerCase();
      return t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q) || assigneeName.includes(q) || teamName.includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "newest")        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortKey === "oldest")        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortKey === "title_az")      return a.title.localeCompare(b.title, "th");
    if (sortKey === "title_za")      return b.title.localeCompare(a.title, "th");
    if (sortKey === "status_active") return (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9);
    if (sortKey === "status_done")   return (STATUS_PRIORITY[b.status] ?? 9) - (STATUS_PRIORITY[a.status] ?? 9);
    if (sortKey === "due_soonest") {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    }
    if (sortKey === "due_latest") {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return b.due_date.localeCompare(a.due_date);
    }
    if (sortKey === "priority_high") return (PRIORITY_ORDER[a.priority ?? "normal"] ?? 2) - (PRIORITY_ORDER[b.priority ?? "normal"] ?? 2);
    if (sortKey === "priority_low")  return (PRIORITY_ORDER[b.priority ?? "normal"] ?? 2) - (PRIORITY_ORDER[a.priority ?? "normal"] ?? 2);
    if (sortKey === "wait_first") {
      const aWait = a.status === "open" && !!a.team_id && !a.assigned_to && !isTeamTaskExpired(a) ? 0 : 1;
      const bWait = b.status === "open" && !!b.team_id && !b.assigned_to && !isTeamTaskExpired(b) ? 0 : 1;
      return aWait - bWait;
    }
    if (sortKey === "assignee_az" || sortKey === "assignee_za") {
      const na = (a.assigned_to ? (profileMap[a.assigned_to]?.display_name || profileMap[a.assigned_to]?.email || "") : "ๆ");
      const nb = (b.assigned_to ? (profileMap[b.assigned_to]?.display_name || profileMap[b.assigned_to]?.email || "") : "ๆ");
      return sortKey === "assignee_az" ? na.localeCompare(nb, "th") : nb.localeCompare(na, "th");
    }
    return 0;
  });

  const totalPages  = Math.ceil(sorted.length / PAGE_SIZE);
  const fromEntry   = sorted.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const toEntry     = Math.min(currentPage * PAGE_SIZE, sorted.length);
  const paged       = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = Object.fromEntries(
    FILTER_CHIPS.map(({ key }) => [key, tasks.filter((t) => matchStatusFilter(t, key)).length])
  );

  const anyFilterActive = statusFilter || search.trim() || advancedActive;

  return (
    <div className="space-y-3">

      {/* ── Control bar ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">

        {/* Search + filter toggle */}
        <div className="flex gap-2 px-3 pt-3 pb-2.5 border-b border-gray-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหางาน ชื่อคน หรือทีม..."
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-9 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
            />
            {search && (
              <button type="button" onClick={() => changeSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors ${
              advancedActive || showAdvanced
                ? "border-blue-300 text-blue-600 bg-blue-50"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            ตัวกรอง
            {advancedActive && (
              <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {[smeFilter !== "__all__", teamFilter !== "__all__", assigneeFilter !== "__all__", creatorFilter !== "__all__", priorityFilter !== "__all__", dueDateRange !== "__all__", assignmentFilter !== "__all__"].filter(Boolean).length}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => changeStatus(null)}
            className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
              !statusFilter ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            ทั้งหมด <span className="opacity-60">{tasks.length}</span>
          </button>
          {FILTER_CHIPS.map(({ key, label, activeColor, defaultColor }) => (
            <button key={key}
              onClick={() => changeStatus(statusFilter === key ? null : key)}
              className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
                statusFilter === key ? activeColor : (defaultColor ?? "bg-white text-gray-500 border-gray-200 hover:bg-gray-50")
              }`}
            >
              {label} <span className="opacity-60">{counts[key]}</span>
            </button>
          ))}
        </div>

        {/* Advanced filter panel */}
        {showAdvanced && (
          <div className="border-t border-gray-100 bg-gray-50/80 px-3 pt-2.5 pb-2.5 rounded-b-xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

              {/* Sort — Popover + Radio Group */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">เรียงตาม</label>
                <Popover open={sortPopoverOpen} onOpenChange={setSortPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="w-full h-8 pl-3 pr-2 rounded-md border border-gray-200 bg-white text-xs flex items-center justify-between text-gray-700 hover:bg-gray-50 transition-colors">
                      <span className="truncate">{SORT_OPTIONS.find((o) => o.value === sortKey)?.label}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 ml-1 transition-transform duration-150 ${sortPopoverOpen ? "rotate-180" : ""}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-2" align="start">
                    <RadioGroup value={sortKey} onValueChange={(v) => { changeSort(v as SortKey); setSortPopoverOpen(false); }}>
                      {["วันที่สร้าง", "วันครบกำหนด", "ความสำคัญ", "สถานะ", "ตัวอักษร"].map((group) => {
                        const opts = SORT_OPTIONS.filter((o) => o.group === group);
                        if (!opts.length) return null;
                        return (
                          <div key={group} className="mb-2 last:mb-0">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 pb-1">{group}</p>
                            {opts.map((o) => (
                              <label key={o.value} className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer">
                                <RadioGroupItem value={o.value} className="h-3.5 w-3.5 border-gray-300 shrink-0" />
                                <span className={`text-xs leading-none ${sortKey === o.value ? "font-semibold text-blue-600" : "text-gray-600"}`}>{o.label}</span>
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </PopoverContent>
                </Popover>
              </div>

              {/* SME */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ประเภท SME</label>
                <Select value={smeFilter} onValueChange={changeSme}>
                  <SelectTrigger className="h-8 text-xs bg-white border-gray-200">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">ทั้งหมด</SelectItem>
                    {smeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Team */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ทีม</label>
                <Select value={teamFilter} onValueChange={changeTeam}>
                  <SelectTrigger className="h-8 text-xs bg-white border-gray-200">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">ทั้งหมด</SelectItem>
                    {teamOptions.map((tm) => tm && <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ความสำคัญ</label>
                <Select value={priorityFilter} onValueChange={changePriority}>
                  <SelectTrigger className="h-8 text-xs bg-white border-gray-200">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">ทั้งหมด</SelectItem>
                    <SelectItem value="urgent">🔴 ด่วนมาก</SelectItem>
                    <SelectItem value="high">🟠 ด่วน</SelectItem>
                    <SelectItem value="normal">⚪ ปกติ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ผู้รับงาน</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={assigneeFilter === "__all__" ? "ทั้งหมด" : (profileMap[assigneeFilter]?.display_name || profileMap[assigneeFilter]?.email || "ทั้งหมด")}
                    value={assigneeSearch}
                    onChange={(e) => { setAssigneeSearch(e.target.value); setAssigneeOpen(true); }}
                    onFocus={() => setAssigneeOpen(true)}
                    onBlur={() => setTimeout(() => setAssigneeOpen(false), 150)}
                    className="w-full h-8 pl-3 pr-7 rounded-md border border-gray-200 bg-white text-xs outline-none focus:border-blue-400 transition"
                  />
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  {assigneeOpen && (
                    <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                      <button type="button"
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${assigneeFilter === "__all__" ? "font-semibold text-blue-600" : ""}`}
                        onMouseDown={() => { changeAssignee("__all__"); setAssigneeSearch(""); setAssigneeOpen(false); }}>
                        ทั้งหมด
                      </button>
                      {assigneeOptions
                        .filter((p) => !assigneeSearch.trim() || (p?.display_name || p?.email || "").toLowerCase().includes(assigneeSearch.toLowerCase()))
                        .map((p) => p && (
                          <button key={p.id} type="button"
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2 ${assigneeFilter === p.id ? "font-semibold text-blue-600" : ""}`}
                            onMouseDown={() => { changeAssignee(p.id); setAssigneeSearch(""); setAssigneeOpen(false); }}>
                            <Avatar className="w-5 h-5 shrink-0">
                              <AvatarImage src={p.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[8px] bg-blue-100 text-blue-600">
                                {(p.display_name || p.email || "?")[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {p.display_name || p.email}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Creator (ผู้ส่งงาน) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ผู้ส่งงาน</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={creatorFilter === "__all__" ? "ทั้งหมด" : (profileMap[creatorFilter]?.display_name || profileMap[creatorFilter]?.email || "ทั้งหมด")}
                    value={creatorSearch}
                    onChange={(e) => { setCreatorSearch(e.target.value); setCreatorOpen(true); }}
                    onFocus={() => setCreatorOpen(true)}
                    onBlur={() => setTimeout(() => setCreatorOpen(false), 150)}
                    className="w-full h-8 pl-3 pr-7 rounded-md border border-gray-200 bg-white text-xs outline-none focus:border-blue-400 transition"
                  />
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  {creatorOpen && (
                    <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                      <button type="button"
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${creatorFilter === "__all__" ? "font-semibold text-blue-600" : ""}`}
                        onMouseDown={() => { changeCreator("__all__"); setCreatorSearch(""); setCreatorOpen(false); }}>
                        ทั้งหมด
                      </button>
                      {creatorOptions
                        .filter((p) => !creatorSearch.trim() || (p?.display_name || p?.email || "").toLowerCase().includes(creatorSearch.toLowerCase()))
                        .map((p) => p && (
                          <button key={p.id} type="button"
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2 ${creatorFilter === p.id ? "font-semibold text-blue-600" : ""}`}
                            onMouseDown={() => { changeCreator(p.id); setCreatorSearch(""); setCreatorOpen(false); }}>
                            <Avatar className="w-5 h-5 shrink-0">
                              <AvatarImage src={p.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[8px] bg-violet-100 text-violet-600">
                                {(p.display_name || p.email || "?")[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {p.display_name || p.email}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Due date range */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">วันครบกำหนด</label>
                <Select value={dueDateRange} onValueChange={changeDueRange}>
                  <SelectTrigger className="h-8 text-xs bg-white border-gray-200">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">ทั้งหมด</SelectItem>
                    <SelectItem value="overdue">เกินกำหนดแล้ว</SelectItem>
                    <SelectItem value="today">วันนี้</SelectItem>
                    <SelectItem value="week">ภายใน 7 วัน</SelectItem>
                    <SelectItem value="month">ภายใน 30 วัน</SelectItem>
                    <SelectItem value="none">ไม่ระบุกำหนด</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assignment status */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">การมอบหมาย</label>
                <Select value={assignmentFilter} onValueChange={changeAssignment}>
                  <SelectTrigger className="h-8 text-xs bg-white border-gray-200">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">ทั้งหมด</SelectItem>
                    <SelectItem value="assigned">มีผู้รับงานแล้ว</SelectItem>
                    <SelectItem value="unassigned">ยังไม่มีผู้รับงาน</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Result summary — single row */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-xs text-gray-400">
          {anyFilterActive ? `แสดง ${sorted.length} จาก ${tasks.length} รายการ` : `${tasks.length} รายการทั้งหมด`}
          {advancedActive && (() => {
            const n = [smeFilter !== "__all__", teamFilter !== "__all__", assigneeFilter !== "__all__", creatorFilter !== "__all__", priorityFilter !== "__all__", dueDateRange !== "__all__", assignmentFilter !== "__all__"].filter(Boolean).length;
            return n > 0 ? <span className="ml-1.5 text-gray-300">• กรอง {n} เงื่อนไข</span> : null;
          })()}
        </p>
        {anyFilterActive && (
          <button onClick={() => { changeStatus(null); changeSearch(""); resetAdvanced(); }}
            className="text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> ล้างทั้งหมด
          </button>
        )}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">กำลังโหลด...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <Search className="w-8 h-8 opacity-30" />
          <span className="text-sm">ไม่พบงาน</span>
        </div>
      ) : (
        <>
          {totalPages > 1 && <PaginationBar currentPage={currentPage} totalPages={totalPages} fromEntry={fromEntry} toEntry={toEntry} total={sorted.length} onChange={setCurrentPage} />}
          <div className="grid gap-2">
          {paged.map((t) => {
            const assignee = t.assigned_to ? profileMap[t.assigned_to] : null;
            const team     = t.team_id ? teamMap[t.team_id] : null;
            const badge    = getTaskBadge(t);
            const borderColor = getStatusBorder(t);
            const todayStr = new Date().toISOString().slice(0, 10);
            const overdue  = !!t.due_date && t.due_date < todayStr && t.status !== "approved" && t.status !== "cancelled";
            const p        = t.priority ?? "normal";
            const cfg      = PRIORITY_CFG[p];
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTask(t)}
                className={`group flex items-start gap-3 bg-white rounded-xl border border-gray-200 border-l-4 ${borderColor} px-4 py-3.5 cursor-pointer hover:bg-blue-50/40 hover:border-blue-200 hover:shadow-sm transition-all duration-150 ${t.status === "cancelled" ? "opacity-60" : ""}`}
              >
                {/* Left: content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Title + badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-gray-900 group-hover:text-blue-700 transition-colors">{t.title}</h3>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                    {team && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                        <Users className="w-3 h-3" />{team.name}
                      </span>
                    )}
                    {!team && t.assigned_to && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                        <User className="w-3 h-3" />งานเดี่ยว
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    {t.due_date && (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${overdue ? "bg-red-50 text-red-500 border-red-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                        <CalendarClock className="w-3 h-3" />
                        {t.due_date}
                        {overdue && <span className="ml-0.5">· เกินกำหนด</span>}
                      </span>
                    )}
                  </div>

                  {/* Description — 2 line clamp */}
                  {t.description && (
                    <div className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                      {renderDescription(t.description)}
                    </div>
                  )}

                  {/* Date */}
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    {format(new Date(t.created_at), "d MMM yyyy, HH:mm น.", { locale: th })}
                  </div>
                </div>

                {/* Right: assignee */}
                <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                  {assignee ? (
                    <>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={assignee.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[11px] font-semibold bg-blue-100 text-blue-600">
                          {(assignee.display_name || assignee.email || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] text-gray-500 max-w-[96px] truncate text-right">
                        {assignee.display_name || assignee.email}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-300 italic mt-1">ไม่มีคนรับ</span>
                  )}
                </div>
              </div>
            );
          })}
          </div>
          {totalPages > 1 && <PaginationBar currentPage={currentPage} totalPages={totalPages} fromEntry={fromEntry} toEntry={toEntry} total={sorted.length} onChange={setCurrentPage} />}
        </>
      )}

      {/* Task detail dialog */}
      {selectedTask && (() => {
        const t = selectedTask;
        const assignee  = t.assigned_to ? profileMap[t.assigned_to] : null;
        const creator   = t.created_by  ? profileMap[t.created_by]  : null;
        const team      = t.team_id     ? teamMap[t.team_id]         : null;
        const badge     = getTaskBadge(t);
        const priority  = t.priority ?? "normal";
        const pcfg      = PRIORITY_CFG[priority];
        const todayStr  = new Date().toISOString().slice(0, 10);
        const isOverdue = !!t.due_date && t.due_date < todayStr && t.status !== "approved" && t.status !== "cancelled";
        const timelineIdx = getTimelineIndex(t);
        return (
          <Dialog open onOpenChange={(o) => { if (!o) setSelectedTask(null); }}>
            <DialogContent className="max-w-lg" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold leading-snug pr-4">{t.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-1">

                {/* Badges row */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${badge.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                    {badge.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${pcfg.color}`}>
                    <Flag className="w-3 h-3" /> {pcfg.label}
                  </span>
                  {team && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                      <Users className="w-3 h-3" /> {team.name}
                    </span>
                  )}
                  {!team && t.assigned_to && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                      <User className="w-3 h-3" /> งานเดี่ยว
                    </span>
                  )}
                </div>

                {/* Description */}
                {t.description && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-600 leading-relaxed">
                    {renderDescription(t.description)}
                  </div>
                )}

                {/* Status timeline stepper */}
                {t.status !== "cancelled" && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">ความคืบหน้า</p>
                    <div className="flex items-start gap-0">
                      {TIMELINE_STEPS.map((step, idx) => {
                        const done    = idx < timelineIdx;
                        const current = idx === timelineIdx;
                        return (
                          <div key={step.key} className="flex flex-col items-center flex-1 relative">
                            {/* connector line */}
                            {idx < TIMELINE_STEPS.length - 1 && (
                              <div className={`absolute top-3 left-1/2 w-full h-0.5 ${done || current ? "bg-blue-400" : "bg-gray-200"}`} style={{ left: "50%" }} />
                            )}
                            {/* circle */}
                            <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                              done    ? "bg-blue-500 border-blue-500 text-white" :
                              current ? "bg-white border-blue-500 text-blue-600 shadow-sm shadow-blue-100" :
                                        "bg-white border-gray-200 text-gray-300"
                            }`}>
                              <step.Icon className="w-3 h-3" />
                            </div>
                            {/* label */}
                            <span className={`mt-1.5 text-center text-[10px] leading-tight ${
                              done ? "text-blue-500 font-medium" : current ? "text-blue-600 font-semibold" : "text-gray-300"
                            }`}>{step.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <p className="text-gray-400 mb-1 flex items-center gap-1"><User className="w-3 h-3" />ผู้รับงาน</p>
                    {assignee ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={assignee.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[8px] bg-blue-100 text-blue-600">
                            {(assignee.display_name || assignee.email || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-gray-800">{assignee.display_name || assignee.email}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">ยังไม่มีคนรับ</span>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1 flex items-center gap-1"><UserPlus className="w-3 h-3" />ผู้สร้างงาน</p>
                    {creator ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={creator.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[8px] bg-violet-100 text-violet-600">
                            {(creator.display_name || creator.email || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-gray-800">{creator.display_name || creator.email}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">ไม่ระบุ</span>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />วันที่สร้าง</p>
                    <p className="font-medium text-gray-800">{format(new Date(t.created_at), "d MMM yyyy, HH:mm น.", { locale: th })}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1 flex items-center gap-1"><CalendarClock className="w-3 h-3" />กำหนดส่ง</p>
                    {t.due_date ? (
                      <div className="flex items-center gap-1.5">
                        <p className={`font-medium ${isOverdue ? "text-red-500" : "text-gray-800"}`}>{t.due_date}</p>
                        {isOverdue && <span className="text-[10px] font-semibold text-white bg-red-400 px-1.5 py-0.5 rounded-full">เกินกำหนด</span>}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">ไม่ระบุ</span>
                    )}
                  </div>
                </div>

                {/* Review note */}
                {t.review_note && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> หมายเหตุ / ผลการตรวจสอบ
                    </p>
                    <p className="text-xs text-amber-800 whitespace-pre-line">{t.review_note}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-1 border-t border-gray-100">
                <button onClick={() => setSelectedTask(null)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors">
                  ปิด
                </button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

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
    <div className="flex items-center justify-end gap-4 px-1">
      <div className="flex items-center gap-1">
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
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
