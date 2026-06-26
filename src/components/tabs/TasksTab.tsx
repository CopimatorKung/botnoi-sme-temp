import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserCheck, Plus, Upload, Trash2, Loader2, Search, X, Building2, Phone, MapPin, Hash, Tag, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { th } from "date-fns/locale";

type Status = "open" | "in_progress" | "done" | "cancelled";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  assigned_to: string | null;
  created_by: string | null;
  customer_id: string | null;
  team_id: string | null;
  due_date: string | null;
  created_at: string;
  work_type?: string;
  job_id?: string;
  company_name?: string;
  phone?: string;
  business_type?: string;
  address?: string;
  ref_number?: string;
}

interface Profile { id: string; display_name: string | null; email: string | null; }
interface Customer { id: string; display_name: string | null; line_user_id: string | null; }

// ป้ายชื่อสำหรับแสดงบน badge / filter button
const statusLabel: Record<string, string> = {
  open: "งานอิสระ", in_progress: "กำลังทำ", done: "รอตรวจสอบ", cancelled: "ยกเลิก",
  approved: "ผ่านแล้ว",
};
const statusSelectLabel: Record<Status, string> = {
  open: "งานอิสระ", in_progress: "กำลังทำ", done: "เสร็จแล้ว", cancelled: "ยกเลิก",
};
const statusColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  done: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

interface MyTeam { id: string; name: string; }

const MOCK_PROFILES: Profile[] = [
  { id: "p_admin", display_name: "Admin", email: "admin@demo.com" },
  { id: "p1",      display_name: "วิชัย สุขใส", email: "wichai@demo.com" },
  { id: "p2",      display_name: "นภา พงษ์ดี", email: "napa@demo.com" },
];

const MOCK_CUSTOMERS: Customer[] = [
  { id: "c1", display_name: "yosolo",                  line_user_id: null },
  { id: "c2", display_name: "ร้านกาแฟ The Brew",       line_user_id: null },
  { id: "c3", display_name: "Trendy Fashion",           line_user_id: null },
  { id: "c4", display_name: "บริษัท ทรู ดิจิทัล จำกัด", line_user_id: null },
  { id: "c5", display_name: "SCB Thailand",             line_user_id: null },
  { id: "c6", display_name: "โรงพยาบาลเวชธานี",        line_user_id: null },
  { id: "c7", display_name: "MBK Center",               line_user_id: null },
  { id: "c8", display_name: "Lazada Thailand",          line_user_id: null },
];

const MOCK_TEAMS: MyTeam[] = [
  { id: "tm1", name: "ทีมขาย Alpha" },
  { id: "tm2", name: "ทีม Support"  },
];

const getMockTasks = (): Task[] => {
  const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  const daysAgo  = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  return [
    {
      id: "m1", title: "[LINE OA] KickStory Onboarding Flow",
      status: "open", assigned_to: null, created_by: "p_admin",
      customer_id: "c1", team_id: "tm1", due_date: null,
      created_at: minsAgo(90),
      work_type: "LINE OA", job_id: "KS-99421",
      company_name: "KickStory Digital Agency", phone: "02-123-4567",
      business_type: "ร้านอาหาร/คาเฟ่",
      address: "123/45 Sukhumvit Rd, Khlong Toei, Bangkok 10110",
      ref_number: "SN-B4D315BB",
      description: "พัฒนาระบบ LINE Official Account พร้อมเชื่อมต่อ API สำหรับระบบสมาชิก และทำ Rich Menu แบบ Dynamic ตาม Segment ของลูกค้า เน้นการใช้งานที่ง่ายและตอบโจทย์ UX สำหรับกลุ่มผู้ใช้ภาษาไทย",
    },
    {
      id: "m2", title: "[แชทบอท] ระบบตอบคำถามอัตโนมัติ The Brew",
      status: "open", assigned_to: null, created_by: "p_admin",
      customer_id: "c2", team_id: "tm1", due_date: null,
      created_at: minsAgo(45),
      work_type: "แชทบอท", job_id: "TB-00123",
      company_name: "The Brew Coffee", phone: "081-234-5678",
      business_type: "ร้านกาแฟ",
      address: "45 Rama 4 Rd, Klong Toey, Bangkok 10110",
      ref_number: "SN-C9F201AA",
      description: "ติดตั้งระบบ Chatbot สำหรับตอบคำถามเรื่องเมนู ราคา และโปรโมชั่น ผ่านช่องทาง LINE OA ของร้าน",
    },
    {
      id: "m3", title: "[เว็บไซต์] Trendy Fashion E-Commerce",
      status: "in_progress", assigned_to: "p1", created_by: "p_admin",
      customer_id: "c3", team_id: "tm2",
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      created_at: hoursAgo(5),
      work_type: "เว็บไซต์", job_id: "TF-00456",
      company_name: "Trendy Fashion Co., Ltd.", phone: "02-456-7890",
      business_type: "แฟชั่น/เครื่องแต่งกาย",
      address: "789 Silom Rd, Bang Rak, Bangkok 10500",
      ref_number: "SN-A7E102CC",
      description: "พัฒนาเว็บไซต์ E-Commerce สำหรับขายเสื้อผ้าแฟชั่น พร้อมระบบตะกร้าสินค้าและชำระเงินออนไลน์",
    },
    {
      id: "m4", title: "[LINE OA] True Digital CRM Integration",
      status: "done", assigned_to: "p2", created_by: "p_admin",
      customer_id: "c4", team_id: null, due_date: null,
      created_at: daysAgo(2),
      work_type: "LINE OA", job_id: "TD-00789",
      company_name: "True Digital Group", phone: "02-555-8000",
      business_type: "เทคโนโลยีดิจิทัล",
      address: "18 True Tower, Ratchadaphisek Rd, Bangkok 10310",
      ref_number: "SN-D3B409DD",
      description: "เชื่อมต่อระบบ CRM ของ True Digital กับ LINE OA เพื่อจัดการลูกค้าและแจ้งเตือนอัตโนมัติ",
    },
    {
      id: "m5", title: "[แชทบอท] AI Sales Bot สำหรับ SCB",
      status: "open", assigned_to: null, created_by: "p_admin",
      customer_id: "c5", team_id: "tm2", due_date: null,
      created_at: minsAgo(20),
      work_type: "แชทบอท", job_id: "SCB-00210",
      company_name: "SCB Thailand", phone: "02-777-7777",
      business_type: "ธนาคาร/การเงิน",
      address: "9 Ratchadaphisek Rd, Chatuchak, Bangkok 10900",
      ref_number: "SN-E5C312EE",
      description: "พัฒนา AI Chatbot เพื่อช่วยงานขายและให้ข้อมูลผลิตภัณฑ์ทางการเงิน ตอบโจทย์ลูกค้า 24/7 บนช่องทาง LINE",
    },
    {
      id: "m6", title: "[เว็บไซต์] Landing Page โรงพยาบาลเวชธานี",
      status: "in_progress", assigned_to: "p1", created_by: "p_admin",
      customer_id: "c6", team_id: "tm1",
      due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      created_at: daysAgo(1),
      work_type: "เว็บไซต์", job_id: "VT-00334",
      company_name: "โรงพยาบาลเวชธานี", phone: "02-734-0000",
      business_type: "สุขภาพ/โรงพยาบาล",
      address: "14 Lat Phrao 111, Wang Thonglang, Bangkok 10310",
      ref_number: "SN-F6D413FF",
      description: "ออกแบบและพัฒนา Landing Page สำหรับแคมเปญเจาะกลุ่มลูกค้าใหม่ พร้อมระบบนัดหมายแพทย์ออนไลน์",
    },
    {
      id: "m7", title: "[LINE OA] Loyalty Program มาบุญครอง",
      status: "open", assigned_to: null, created_by: "p_admin",
      customer_id: "c7", team_id: null, due_date: null,
      created_at: hoursAgo(3),
      work_type: "LINE OA", job_id: "MBK-00567",
      company_name: "MBK Center", phone: "02-620-9000",
      business_type: "ห้างสรรพสินค้า/รีเทล",
      address: "444 Phayathai Rd, Wang Mai, Pathum Wan, Bangkok 10330",
      ref_number: "SN-G7E514GG",
      description: "ระบบสะสมแต้มและแลกของรางวัลผ่าน LINE OA เชื่อมต่อกับฐานข้อมูลสมาชิกที่มีอยู่กว่า 200,000 คน",
    },
    {
      id: "m8", title: "[แชทบอท] Order Tracking Bot LAZADA TH",
      status: "cancelled", assigned_to: "p2", created_by: "p_admin",
      customer_id: "c8", team_id: null, due_date: null,
      created_at: daysAgo(5),
      work_type: "แชทบอท", job_id: "LZ-00891",
      company_name: "Lazada Thailand", phone: "02-018-0000",
      business_type: "E-Commerce",
      address: "29 Bhiraj Tower, Asok Montri Rd, Khlong Toei Nuea, Bangkok 10110",
      ref_number: "SN-H8F615HH",
      description: "Bot ติดตามพัสดุอัตโนมัติ เชื่อมต่อกับ logistics API แจ้งสถานะ real-time ผ่าน LINE Message API",
    },
  ];
};

interface TasksTabProps {
  goToCustomer?: (customerId: string) => void;
  pendingTaskId?: string | null;
  clearPendingTask?: () => void;
}

export function TasksTab({ goToCustomer, pendingTaskId, clearPendingTask }: TasksTabProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [myTeams, setMyTeams] = useState<MyTeam[]>([]);
  const [filter, setFilter] = useState<"all" | "mine" | "unassigned" | "team" | "approved" | Status>("team");
  const [now, setNow] = useState(Date.now());
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("task_tab_seen") ?? "{}"); } catch { return {}; }
  });
  const [teamSubFilter, setTeamSubFilter] = useState<"waiting" | "claimed" | "done">("waiting");
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [claimWorkType, setClaimWorkType] = useState<"solo" | "team">("solo");
  const [claimTeamId, setClaimTeamId] = useState<string>("");
  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: Status } | null>(null);
  const [cancelTask, setCancelTask] = useState<{ id: string; title: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submitReviewTask, setSubmitReviewTask] = useState<{ id: string; title: string } | null>(null);
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewWorkTypes, setReviewWorkTypes] = useState<string[]>([]);
  const [reviewWorkUrl, setReviewWorkUrl] = useState("");
  const [reviewDragging, setReviewDragging] = useState(false);
  const [reviewUploading, setReviewUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allowFileUpload, setAllowFileUpload] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const WORK_TYPES = ["LINE OA", "แชทบอท", "เว็บไซต์"];
  const toggleWorkType = (type: string) =>
    setReviewWorkTypes((prev) => prev.includes(type) ? [] : [type]);
  const [showCreate, setShowCreate] = useState(false);
  const [createClaimType, setCreateClaimType] = useState<"individual" | "board">("individual");
  const [createWorkType, setCreateWorkType] = useState<"solo" | "team">("solo");
  const [createTeamId, setCreateTeamId] = useState("");
  const [createBusiness, setCreateBusiness] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  useEffect(() => {
    loadAll();
    const ch = supabase.channel("tasks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadTasks())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // tick ทุกวินาทีสำหรับเวลานับถอยหลังของงานทีม
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // เปิด dialog งานเมื่อมาจากการกดแจ้งเตือน
  useEffect(() => {
    if (!pendingTaskId || tasks.length === 0) return;
    const found = tasks.find((t) => t.id === pendingTaskId);
    if (found) {
      setSelectedTask(found);
      clearPendingTask?.();
    }
  }, [pendingTaskId, tasks]);

  const loadAll = async () => { await Promise.all([loadTasks(), loadProfiles(), loadCustomers(), loadMyTeams(), loadAppSettings()]); };

  const loadAppSettings = async () => {
    const { data } = await supabase
      .from("app_settings" as any)
      .select("value")
      .eq("key", "allow_file_upload")
      .single();
    if (data) setAllowFileUpload((data as any).value === "true");
  };

  const loadMyTeams = async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from("team_members" as any).select("team_id").eq("user_id", user.id);
    if (!memberships || (memberships as any[]).length === 0) { setMyTeams(MOCK_TEAMS); return; }
    const teamIds = (memberships as any[]).map((m: any) => m.team_id);
    const { data: teams } = await supabase.from("teams" as any).select("id,name").in("id", teamIds);
    setMyTeams((teams as MyTeam[])?.length ? (teams as MyTeam[]) : MOCK_TEAMS);
  };
  const loadTasks = async () => {
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    setTasks((data as Task[])?.length ? (data as Task[]) : getMockTasks());
  };
  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id,display_name,email");
    setProfiles((data as Profile[])?.length ? (data as Profile[]) : MOCK_PROFILES);
  };
  const loadCustomers = async () => {
    const { data } = await supabase.from("customers").select("id,display_name,line_user_id").order("display_name");
    setCustomers((data as Customer[])?.length ? (data as Customer[]) : MOCK_CUSTOMERS);
  };

  const confirmClaim = async () => {
    if (!claimingTaskId || !user) return;
    if (claimWorkType === "team" && !claimTeamId) { toast.error("กรุณาเลือกทีม"); return; }
    const { error } = await supabase.from("tasks").update({
      assigned_to: user.id,
      status: "in_progress",
      team_id: claimWorkType === "team" ? claimTeamId : null,
    } as any).eq("id", claimingTaskId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(claimWorkType === "solo" ? "รับงานเดี่ยวแล้ว" : "รับงานทีมแล้ว");
      setTasks((prev) => prev.map((t) =>
        t.id === claimingTaskId ? { ...t, assigned_to: user.id, status: "in_progress" as Status } : t
      ));

      // ส่งแจ้งลูกค้าทาง LINE ถ้า task ผูกกับลูกค้า
      const claimedTask = tasks.find((t) => t.id === claimingTaskId);
      if (claimedTask?.customer_id) {
        const customer = customers.find((c) => c.id === claimedTask.customer_id);
        if (customer?.line_user_id) {
          const msg = `✅ รับงานแล้ว\nทีมงานของเรากำลังดูแลคุณอยู่นะครับ/ค่ะ`;
          await supabase.functions.invoke("line-webhook/send", {
            body: { to: customer.line_user_id, text: msg },
          });
          await supabase.from("messages").insert({
            customer_id: customer.id,
            message_type: "text",
            content: msg,
            source: "agent",
          });
        }
      }

      setClaimingTaskId(null);
      setClaimWorkType("solo");
      setClaimTeamId("");
    }
  };

  const resetCreate = () => {
    setCreateClaimType("individual"); setCreateWorkType("solo");
    setCreateTeamId(""); setCreateBusiness(""); setNewTitle(""); setNewDesc("");
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) { toast.error("กรุณาใส่หัวข้องาน"); return; }
    if (createClaimType === "board" && !createTeamId) { toast.error("กรุณาเลือกทีม"); return; }
    if (createWorkType === "team" && !createTeamId) { toast.error("กรุณาเลือกทีม"); return; }
    setCreating(true);
    const isIndividual = createClaimType === "individual";
    const fullDesc = [
      createBusiness ? `ประเภทธุรกิจ: ${createBusiness.trim()}` : null,
      newDesc.trim() || null,
    ].filter(Boolean).join("\n");
    const { error } = await supabase.from("tasks").insert({
      title: newTitle.trim(),
      description: fullDesc || null,
      status: isIndividual ? "in_progress" : "open",
      assigned_to: isIndividual ? (user?.id ?? null) : null,
      team_id: createTeamId || null,
      created_by: user?.id ?? null,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isIndividual ? "รับงานและสร้างเคสเรียบร้อย!" : "โพสงานลงบอร์ดแล้ว!");
    setShowCreate(false);
    resetCreate();
    loadTasks();
  };

  const statusNotify: Record<Status, string> = {
    open: "📋 งานถูกเปิดใหม่อีกครั้งแล้วครับ/ค่ะ",
    in_progress: "⚙️ ทีมงานกำลังดำเนินการงานของคุณอยู่นะครับ/ค่ะ",
    done: "✅ งานของคุณเสร็จสมบูรณ์แล้วครับ/ค่ะ ขอบคุณที่ใช้บริการ!",
    cancelled: "❌ งานถูกยกเลิกแล้วครับ/ค่ะ หากมีข้อสงสัยสามารถติดต่อเราได้เลย",
  };

  const handleSubmitReview = async () => {
    if (!submitReviewTask) return;
    if (reviewWorkTypes.length === 0) {
      toast.error("กรุณาเลือกประเภทงานก่อน");
      return;
    }
    if (!reviewWorkUrl.trim()) {
      toast.error(`กรุณากรอกลิงก์${reviewWorkTypes[0]}`);
      return;
    }
    setReviewUploading(true);

    let attachmentUrls: string[] = [];

    // อัปโหลดไฟล์ทั้งหมดไปยัง Storage
    if (reviewFiles.length > 0) {
      for (const file of reviewFiles) {
        const path = `${submitReviewTask.id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage
          .from("task-attachments")
          .upload(path, file, { upsert: true });
        if (!error) {
          const { data: urlData } = supabase.storage
            .from("task-attachments")
            .getPublicUrl(path);
          if (urlData?.publicUrl) attachmentUrls.push(urlData.publicUrl);
        }
      }
    }

    // รวม note + work types
    const noteLines = [];
    if (reviewWorkTypes.length > 0) {
      const workLine = reviewWorkUrl.trim()
        ? `ประเภทงาน: ${reviewWorkTypes[0]} — ${reviewWorkUrl.trim()}`
        : `ประเภทงาน: ${reviewWorkTypes[0]}`;
      noteLines.push(workLine);
    }
    if (reviewNote.trim()) noteLines.push(reviewNote.trim());

    const updatePayload: any = { status: "done" };
    if (attachmentUrls.length > 0) updatePayload.attachments = attachmentUrls;
    if (noteLines.length > 0) updatePayload.review_note = noteLines.join("\n");

    const { error } = await supabase.from("tasks").update(updatePayload).eq("id", submitReviewTask.id);
    setReviewUploading(false);

    if (error) { toast.error(error.message); return; }

    toast.success("ส่งงานให้แอดมินตรวจสอบแล้ว");
    setTasks((prev) => prev.map((t) => t.id === submitReviewTask.id ? { ...t, status: "done" as Status } : t));
    setSubmitReviewTask(null);
    setReviewFiles([]);
    setReviewNote("");
    setReviewWorkTypes([]);
    setReviewWorkUrl("");
  };

  const addReviewFiles = (files: FileList | null) => {
    if (!files) return;
    const MAX = 4 * 1024 * 1024; // 4 MB
    const valid = Array.from(files).filter((f) => {
      if (f.size > MAX) { toast.error(`${f.name} ใหญ่เกิน 4MB`); return false; }
      return true;
    });
    setReviewFiles((prev) => [...prev, ...valid]);
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));

      // ส่งแจ้งลูกค้าทาง LINE
      const task = tasks.find((t) => t.id === id);
      if (task?.customer_id) {
        const customer = customers.find((c) => c.id === task.customer_id);
        if (customer?.line_user_id) {
          const msg = statusNotify[status];
          await supabase.functions.invoke("line-webhook/send", {
            body: { to: customer.line_user_id, text: msg },
          });
          await supabase.from("messages").insert({
            customer_id: customer.id,
            message_type: "text",
            content: msg,
            source: "agent",
          });
        }
      }
    }
  };

  const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
  const myTeamIds = new Set(myTeams.map((t) => t.id));

  const isTeamTaskExpired = (t: Task) =>
    !!t.team_id &&
    t.status === "open" &&
    !t.assigned_to &&
    Date.now() - new Date(t.created_at).getTime() > THREE_HOURS_MS;

  // เวลานับถอยหลังก่อนงานทีมหมดเวลา (HH:MM:SS) — null ถ้าหมดแล้ว
  const teamTaskCountdown = (t: Task): string | null => {
    const remaining = new Date(t.created_at).getTime() + THREE_HOURS_MS - now;
    if (remaining <= 0) return null;
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const tabCounts = {
    all:         tasks.filter((t) => !(t.team_id && t.status === "open" && !t.assigned_to && !isTeamTaskExpired(t))).length,
    mine:        tasks.filter((t) => t.assigned_to === user?.id && (!t.team_id || myTeamIds.has(t.team_id))).length,
    unassigned:  tasks.filter((t) => !t.assigned_to && (!t.team_id || isTeamTaskExpired(t))).length,
    team:        tasks.filter((t) => t.team_id && myTeamIds.has(t.team_id) && !isTeamTaskExpired(t)).length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done:        tasks.filter((t) => t.status === "done").length,
    approved:    tasks.filter((t) => (t.status as string) === "approved").length,
  };

  const filtered = tasks.filter((t) => {
    if (filter === "all") {
      // แสดงงานที่ไม่มีทีม + งานทีมที่หมดเวลา 3 ชม. แล้ว + งานที่รับแล้ว
      if (t.team_id && t.status === "open" && !t.assigned_to && !isTeamTaskExpired(t)) return false;
      return true;
    }
    if (filter === "mine") return t.assigned_to === user?.id && (!t.team_id || myTeamIds.has(t.team_id));
    if (filter === "unassigned") return !t.assigned_to && (!t.team_id || isTeamTaskExpired(t));
    if (filter === "team") {
      // เฉพาะทีมของตัวเอง และยังไม่หมดเวลา 3 ชม.
      if (!t.team_id || !myTeamIds.has(t.team_id)) return false;
      if (isTeamTaskExpired(t)) return false;
      if (teamSubFilter === "waiting") return t.status === "open" && !t.assigned_to;
      if (teamSubFilter === "claimed") return !!t.assigned_to && t.status === "in_progress";
      if (teamSubFilter === "done") return !!t.assigned_to && (t.status === "done" || (t.status as string) === "approved");
    }
    if (filter === "approved") return (t.status as string) === "approved";
    return t.status === filter;
  });

  const displayTasks = searchQuery.trim()
    ? filtered.filter((t) => {
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q)
        );
      })
    : filtered;

  const renderDescription = (desc: string) => {
    return desc.split("\n").map((line, i) => {
      if (line.startsWith("ลูกค้า: ")) {
        const name = line.slice("ลูกค้า: ".length);
        return (
          <span key={i} className="block">
            ลูกค้า:{" "}
            <span className="bg-yellow-200 text-yellow-900 font-semibold px-1 rounded">
              {name}
            </span>
          </span>
        );
      }
      return <span key={i} className="block">{line}</span>;
    });
  };

  return (
    <div className="space-y-5">

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">งาน</h1>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="ค้นหางาน..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 pl-9 pr-9 rounded-lg border-2 border-border bg-background text-sm outline-none focus:border-primary focus:ring-0 transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {([
            { key: "team",        label: "งานของทีม" },
            { key: "mine",        label: "ของฉัน" },
            { key: "unassigned",  label: "ยังไม่ได้รับ" },
            { key: "in_progress", label: "กำลังทำ" },
            { key: "done",        label: "รอตรวจสอบ" },
            { key: "approved",    label: "เสร็จแล้ว" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setFilter(key as any);
                if (key === "team") setTeamSubFilter("waiting");
                const updated = { ...seenCounts, [key]: tabCounts[key] };
                setSeenCounts(updated);
                localStorage.setItem("task_tab_seen", JSON.stringify(updated));
              }}
              className={`relative px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {label}
              {tabCounts[key] > (seenCounts[key] ?? 0) && filter !== key && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none px-0.5">
                  {(tabCounts[key] - (seenCounts[key] ?? 0)) > 99 ? "99+" : tabCounts[key] - (seenCounts[key] ?? 0)}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          สร้างงาน
        </button>
      </div>

      {/* Sub-filter งานของทีม */}
      {filter === "team" && (
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground">แสดง:</span>
          {([
            { key: "waiting", label: "รอรับงาน",  active: "bg-amber-500 text-white border-amber-500" },
            { key: "claimed", label: "รับแล้ว",   active: "bg-slate-700 text-white border-slate-700" },
            { key: "done",    label: "เสร็จแล้ว", active: "bg-blue-600 text-white border-blue-600" },
          ] as const).map(({ key, label, active }) => (
            <button
              key={key}
              onClick={() => setTeamSubFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                teamSubFilter === key
                  ? active
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3">
        {displayTasks.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            {searchQuery.trim() ? `ไม่พบงานที่ตรงกับ "${searchQuery}"` : "ไม่มีงานในหมวดนี้"}
          </div>
        )}
        {displayTasks.map((t) => {
          const assignee    = t.assigned_to ? profileMap[t.assigned_to] : null;
          const customer    = t.customer_id ? customerMap[t.customer_id] : null;
          const isMine      = t.assigned_to === user?.id;
          const isMyTeamTask = !!t.team_id && myTeams.some((mt) => mt.id === t.team_id);
          const isTeamWaiting = !!t.team_id && t.status === "open" && !t.assigned_to && !isTeamTaskExpired(t);
          const statusBadgeColor = isTeamWaiting
            ? "bg-orange-50 text-orange-600 border-orange-200"
            : statusColor[t.status] ?? "bg-gray-50 text-gray-600 border-gray-200";
          const statusBadgeLabel = isTeamWaiting ? "รอรับงาน" : (statusLabel[t.status] ?? t.status);

          return (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">

              {/* Top badges */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {t.work_type && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                    {t.work_type}
                  </span>
                )}
                {t.job_id && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                    JOB ID: {t.job_id}
                  </span>
                )}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor}`}>
                  {statusBadgeLabel}
                </span>
                {!t.assigned_to && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-500 border border-rose-200">
                    ยังไม่ได้รับ
                  </span>
                )}
                {isTeamWaiting && teamTaskCountdown(t) && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-red-50 text-red-500 border border-red-200">
                    ⏳ {teamTaskCountdown(t)}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="font-bold text-gray-900 text-[15px] mb-3 leading-snug">{t.title}</h3>

              {/* Info grid */}
              {(customer || t.company_name || t.phone || t.business_type || t.address || t.ref_number) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mb-3 text-sm text-gray-600">
                  <div className="space-y-1">
                    {customer && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span>ชื่อลูกค้า: <span className="font-medium text-gray-800">{customer.display_name || "ไม่ระบุชื่อ"}</span></span>
                      </div>
                    )}
                    {t.company_name && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span>{t.company_name}</span>
                      </div>
                    )}
                    {t.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span>{t.phone}</span>
                      </div>
                    )}
                    {t.business_type && (
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span>ประเภท: {t.business_type}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {t.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400 mt-0.5" />
                        <span className="leading-snug">{t.address}</span>
                      </div>
                    )}
                    {t.ref_number && (
                      <div className="flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span>เลขที่อ้างอิง: <span className="font-mono font-medium text-gray-700">{t.ref_number}</span></span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {t.description && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 text-sm text-gray-600 leading-relaxed mb-3 line-clamp-3">
                  {t.description}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-gray-400">
                  {assignee && (
                    <span>รับงานโดย <span className="font-medium text-gray-600">{assignee.display_name || assignee.email}</span> · </span>
                  )}
                  {format(new Date(t.created_at), "d MMM yyyy, HH:mm น.", { locale: th })}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedTask(t)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    ดูรายละเอียด
                  </button>
                  {!t.assigned_to && t.status === "open" && (
                    <button
                      onClick={() => { setClaimingTaskId(t.id); setClaimWorkType("solo"); }}
                      className="px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                    >
                      รับงาน
                    </button>
                  )}
                  {(isMine || isMyTeamTask) && !!t.assigned_to && t.status === "in_progress" && (
                    <Select
                      value={t.status}
                      onValueChange={(v) => {
                        if (v === "done") setSubmitReviewTask({ id: t.id, title: t.title });
                        else if (v === "cancelled") { setCancelTask({ id: t.id, title: t.title }); setCancelReason(""); }
                        else setPendingStatus({ id: t.id, status: v as Status });
                      }}
                    >
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["in_progress", "done", "cancelled"] as Status[]).map((s) => (
                          <SelectItem key={s} value={s}>{statusSelectLabel[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {(isMine || isMyTeamTask) && !!t.assigned_to && (t.status === "done" || (t.status as string) === "approved" || t.status === "cancelled") && (
                    <span className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${
                      (t.status as string) === "approved" ? "bg-green-50 text-green-700 border-green-200" :
                      t.status === "cancelled" ? "bg-gray-50 text-gray-500 border-gray-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {(t.status as string) === "approved" ? "ผ่านแล้ว" : t.status === "cancelled" ? "ยกเลิกแล้ว" : "รอแอดมินตรวจสอบ"}
                    </span>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Create task dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); resetCreate(); } }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">สร้างงานใหม่</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1 max-h-[65vh] overflow-y-auto pr-1">
            {/* การรับงาน */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">การรับงาน</label>
              <div className="flex gap-2">
                {([
                  { key: "individual", label: "รับงานเลย", sub: "assign ให้คุณทันที" },
                  { key: "board",     label: "โพสลงบอร์ด", sub: "ให้ทีมมารับเอง" },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { setCreateClaimType(opt.key); if (opt.key === "board") setCreateWorkType("team"); }}
                    className={`flex-1 flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      createClaimType === opt.key
                        ? "border-emerald-500 bg-blue-50/60 text-blue-800"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-[11px] opacity-60">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* รูปแบบงาน (เฉพาะ individual) */}
            {createClaimType === "individual" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">รูปแบบงาน</label>
                <div className="flex gap-2">
                  {([
                    { key: "solo", label: "งานเดี่ยว", sub: "ทำคนเดียว" },
                    { key: "team", label: "งานทีม",   sub: "ทำร่วมกัน" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setCreateWorkType(opt.key)}
                      className={`flex-1 flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                        createWorkType === opt.key
                          ? "border-emerald-500 bg-blue-50/60 text-blue-800"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-[11px] opacity-60">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Team selector */}
            {(createClaimType === "board" || createWorkType === "team") && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">ทีม</label>
                <Select value={createTeamId} onValueChange={setCreateTeamId}>
                  <SelectTrigger><SelectValue placeholder="เลือกทีม..." /></SelectTrigger>
                  <SelectContent>
                    {myTeams.length === 0
                      ? <SelectItem value="_none" disabled>คุณยังไม่ได้อยู่ในทีมใด</SelectItem>
                      : myTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Business type */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">ประเภทธุรกิจ</label>
              <Input placeholder="เช่น ร้านกาแฟ, ค้าขายออนไลน์..." value={createBusiness} onChange={(e) => setCreateBusiness(e.target.value)} className="border-2" />
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">หัวข้องาน <span className="text-red-500">*</span></label>
              <Input placeholder="เช่น ติดตั้งระบบหน้าร้าน..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="border-2" />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">รายละเอียด</label>
              <Textarea placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} className="resize-none border-2" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => { setShowCreate(false); resetCreate(); }}>ยกเลิก</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreate} disabled={creating}>
              {creating ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />กำลังสร้าง...</> : createClaimType === "individual" ? "รับงาน" : "โพสลงบอร์ด"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Claim work type dialog */}
      <Dialog open={!!claimingTaskId} onOpenChange={(o) => { if (!o) setClaimingTaskId(null); }}>
        <DialogContent className="max-w-sm flex flex-col gap-4" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base">เลือกรูปแบบงาน</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              type="button"
              onClick={() => setClaimWorkType("solo")}
              className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all ${
                claimWorkType === "solo"
                  ? "border-emerald-500 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="text-2xl">👤</span>
              <span className="text-sm font-bold">งานเดี่ยว</span>
              <span className="text-[11px] text-center opacity-70">ทำคนเดียวจบ</span>
            </button>
            <button
              type="button"
              onClick={() => setClaimWorkType("team")}
              className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all ${
                claimWorkType === "team"
                  ? "border-emerald-500 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="text-2xl">👥</span>
              <span className="text-sm font-bold">งานทีม</span>
              <span className="text-[11px] text-center opacity-70">ทำร่วมกันหลายคน</span>
            </button>
          </div>

          {claimWorkType === "team" && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">เลือกทีม</label>
              <Select value={claimTeamId} onValueChange={setClaimTeamId}>
                <SelectTrigger className="focus-visible:ring-blue-500">
                  <SelectValue placeholder="เลือกทีมที่รับงานนี้..." />
                </SelectTrigger>
                <SelectContent>
                  {myTeams.length === 0
                    ? <SelectItem value="_none" disabled>คุณยังไม่ได้อยู่ในทีมใด</SelectItem>
                    : myTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setClaimingTaskId(null)}>ยกเลิก</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={confirmClaim}>
              ยืนยันรับงาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm status change dialog (in_progress / cancelled) */}
      <AlertDialog open={!!pendingStatus} onOpenChange={(o) => { if (!o) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันเปลี่ยนสถานะ</AlertDialogTitle>
            <AlertDialogDescription>
              เปลี่ยนสถานะงานเป็น <strong>{pendingStatus ? statusLabel[pendingStatus.status] : ""}</strong> ใช่ไหม?
              {pendingStatus?.status !== "in_progress" && " ระบบจะแจ้งลูกค้าทาง LINE อัตโนมัติ"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                if (pendingStatus) updateStatus(pendingStatus.id, pendingStatus.status);
                setPendingStatus(null);
              }}
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel task dialog — บังคับใส่เหตุผล */}
      <Dialog open={!!cancelTask} onOpenChange={(o) => { if (!o) { setCancelTask(null); setCancelReason(""); } }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <X className="w-4 h-4 text-red-500" />
              ยกเลิกงาน
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              งาน: <span className="font-medium text-foreground">{cancelTask?.title}</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                เหตุผลในการยกเลิก <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="ระบุเหตุผลที่ยกเลิกงานนี้..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className={`resize-none ${!cancelReason.trim() ? "border-red-200 focus-visible:ring-red-400" : ""}`}
              />
              {!cancelReason.trim() && (
                <p className="text-xs text-red-500">* กรุณาระบุเหตุผลก่อนยกเลิกงาน</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelTask(null); setCancelReason(""); }}>
              ปิด
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
              disabled={!cancelReason.trim()}
              onClick={async () => {
                if (!cancelTask || !cancelReason.trim()) return;
                const reason = cancelReason.trim();
                const { error } = await supabase.from("tasks").update({
                  status: "cancelled",
                  review_note: `เหตุผลยกเลิก: ${reason}`,
                } as any).eq("id", cancelTask.id);
                if (error) { toast.error(error.message); return; }

                // แจ้งลูกค้า LINE
                const task = tasks.find((t) => t.id === cancelTask.id);
                if (task?.customer_id) {
                  const customer = customers.find((c) => c.id === task.customer_id);
                  if (customer?.line_user_id) {
                    const msg = statusNotify["cancelled"];
                    await supabase.functions.invoke("line-webhook/send", { body: { to: customer.line_user_id, text: msg } });
                    await supabase.from("messages").insert({ customer_id: customer.id, message_type: "text", content: msg, source: "agent" });
                  }
                }

                // แจ้ง Admin / CEO / Developer ในระบบ
                const { data: adminRoles } = await supabase
                  .from("user_roles" as any)
                  .select("user_id")
                  .in("role", ["admin", "ceo", "developer"]);
                if (adminRoles && (adminRoles as any[]).length > 0) {
                  const cancellerName = profiles.find((p) => p.id === user?.id)?.display_name
                    || profiles.find((p) => p.id === user?.id)?.email
                    || "สมาชิก";
                  const notifMsg = `❌ งาน "${cancelTask.title}" ถูกยกเลิกโดย ${cancellerName} — เหตุผล: ${reason}`;
                  await supabase.from("notifications" as any).insert(
                    (adminRoles as any[]).map((r: any) => ({
                      user_id: r.user_id,
                      type: "cancelled",
                      task_id: cancelTask.id,
                      message: notifMsg,
                    }))
                  );
                }

                setTasks((prev) => prev.map((t) => t.id === cancelTask.id ? { ...t, status: "cancelled" as Status } : t));
                toast.success("ยกเลิกงานแล้ว");
                setCancelTask(null);
                setCancelReason("");
              }}
            >
              <X className="w-3.5 h-3.5" /> ยืนยันยกเลิก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task detail dialog */}
      {selectedTask && (() => {
        const t = selectedTask;
        const assignee = t.assigned_to ? profileMap[t.assigned_to] : null;
        const creator  = t.created_by  ? profileMap[t.created_by]  : null;
        const customer = t.customer_id ? customerMap[t.customer_id] : null;
        const myTeam   = t.team_id ? myTeams.find((mt) => mt.id === t.team_id) : null;
        return (
          <Dialog open={!!selectedTask} onOpenChange={(o) => { if (!o) setSelectedTask(null); }}>
            <DialogContent className="max-w-md flex flex-col max-h-[90vh]" aria-describedby={undefined}>
              <DialogHeader className="shrink-0">
                <DialogTitle className="text-base font-semibold leading-snug pr-4">{t.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-1 overflow-y-auto flex-1 min-h-0">
                {/* Status + team badges */}
                <div className="flex flex-wrap gap-2 items-center">
                  {t.status === "open" && t.team_id && !t.assigned_to && !isTeamTaskExpired(t) ? (
                    <>
                      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">รอรับงาน</Badge>
                      {teamTaskCountdown(t) && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-mono tabular-nums">
                          ⏳ {teamTaskCountdown(t)}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <Badge className={statusColor[t.status]}>{statusLabel[t.status]}</Badge>
                  )}
                  {myTeam && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      👥 {myTeam.name}
                    </span>
                  )}
                  {!myTeam && t.team_id && (
                    <span className="text-xs text-muted-foreground italic">งานทีม</span>
                  )}
                </div>

                {/* Description */}
                {t.description && (
                  <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground whitespace-pre-line leading-relaxed break-words">
                    {renderDescription(t.description)}
                  </div>
                )}

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">ผู้รับงาน</p>
                    <p className="font-medium">
                      {assignee ? (assignee.display_name || assignee.email) : <span className="text-slate-400 italic">ยังไม่มีคนรับ</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">สร้างโดย</p>
                    <p className="font-medium">{creator ? (creator.display_name || creator.email) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">วันที่รับงาน</p>
                    <p className="font-medium">{format(new Date(t.created_at), "d MMM yyyy HH:mm น.", { locale: th })}</p>
                  </div>
                  {t.due_date && (
                    <div>
                      <p className="text-muted-foreground mb-0.5">กำหนดส่ง</p>
                      <p className="font-medium">{format(new Date(t.due_date), "d MMM yyyy HH:mm น.", { locale: th })}</p>
                    </div>
                  )}
                  {customer && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground mb-0.5">ลูกค้า</p>
                      <p className="font-medium">{customer.display_name || "ไม่ระบุชื่อ"}</p>
                    </div>
                  )}
                </div>

                {/* Review note */}
                {(t as any).review_note && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">หมายเหตุ / ผลการตรวจสอบ</p>
                    <p className="text-xs text-amber-800 whitespace-pre-line break-words">{(t as any).review_note}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1 shrink-0">
                <Button variant="outline" onClick={() => setSelectedTask(null)}>ปิด</Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Submit for review dialog — เฉพาะตอนกด "เสร็จแล้ว" */}
      <Dialog
        open={!!submitReviewTask}
        onOpenChange={(o) => { if (!o) { setSubmitReviewTask(null); setReviewFiles([]); setReviewNote(""); setReviewWorkTypes([]); setReviewWorkUrl(""); } }}
      >
        <DialogContent aria-describedby={undefined} className="max-w-md p-0 overflow-hidden gap-0">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <DialogTitle className="text-lg font-medium">ส่งงานให้แอดมินตรวจสอบ</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              แนบไฟล์หลักฐานผลงาน แล้วส่งให้แอดมินตรวจสอบ
            </p>
          </div>

          {/* Task + status row */}
          <div className="px-6 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">ชื่องาน</p>
                <div className="border rounded-md px-3 py-2 text-sm bg-background truncate">
                  {submitReviewTask?.title}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">สถานะหลังส่ง</p>
                <div className="border rounded-md px-3 py-2 text-sm bg-background text-amber-600 font-medium">
                  รอแอดมินตรวจสอบ
                </div>
              </div>
            </div>
          </div>

          {/* Work type chips */}
          <div className="px-6 pb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">ประเภทงานที่ทำ</p>
            <div className="flex gap-2 flex-wrap">
              {WORK_TYPES.map((type) => {
                const active = reviewWorkTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { toggleWorkType(type); setReviewWorkUrl(""); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            {/* URL input — แสดงเมื่อเลือกประเภทงานแล้ว */}
            {reviewWorkTypes.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1.5">
                  ลิงก์{reviewWorkTypes[0]}
                </p>
                <Input
                  placeholder={
                    reviewWorkTypes[0] === "LINE OA"
                      ? "https://lin.ee/xxxxxxx"
                      : reviewWorkTypes[0] === "แชทบอท"
                      ? "https://chatbot.example.com"
                      : "https://yourwebsite.com"
                  }
                  value={reviewWorkUrl}
                  onChange={(e) => setReviewWorkUrl(e.target.value)}
                  className={`text-sm ${!reviewWorkUrl.trim() ? "border-red-300 focus-visible:ring-red-400" : ""}`}
                />
                {!reviewWorkUrl.trim() && (
                  <p className="text-xs text-red-500 mt-1">* จำเป็นต้องกรอก</p>
                )}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="px-6 pb-4">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">รายละเอียดเพิ่มเติม</p>
            <Textarea
              placeholder="อธิบายสิ่งที่ทำ ผลลัพธ์ที่ได้ หรือข้อมูลอื่นๆ สำหรับแอดมิน..."
              rows={3}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="resize-none text-sm"
            />
          </div>

          {/* Dropzone — เปิด/ปิดตามการตั้งค่าแอดมิน */}
          <div className="px-6 pb-4">
            {allowFileUpload ? (
              <div
                className={`relative border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                  reviewDragging
                    ? "border-blue-400 bg-blue-50/60"
                    : "border-border hover:border-blue-300 hover:bg-muted/20"
                }`}
                onClick={() => document.getElementById("review-file-input")?.click()}
                onDragOver={(e) => { e.preventDefault(); setReviewDragging(true); }}
                onDragLeave={() => setReviewDragging(false)}
                onDrop={(e) => { e.preventDefault(); setReviewDragging(false); addReviewFiles(e.dataTransfer.files); }}
              >
                <input
                  id="review-file-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => addReviewFiles(e.target.files)}
                />
                <div className="mb-2 bg-muted rounded-full p-3">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">แนบไฟล์หลักฐาน</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ลากไฟล์มาวาง หรือ <span className="font-medium">คลิกเพื่อเลือก</span> (สูงสุด 4MB ต่อไฟล์)
                </p>
              </div>
            ) : (
              <div className="relative border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-center select-none pointer-events-none opacity-50 border-border bg-muted/30">
                <div className="mb-2 bg-muted rounded-full p-3">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">แนบไฟล์หลักฐาน</p>
                <p className="text-xs text-muted-foreground mt-1">
                  หรือ <span className="font-medium">คลิกเพื่อเลือก</span> (สูงสุด 4MB ต่อไฟล์)
                </p>
              </div>
            )}

            {/* File list */}
            {reviewFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {reviewFiles.map((file, i) => {
                  const isImage = file.type.startsWith("image/");
                  const previewUrl = isImage ? URL.createObjectURL(file) : null;
                  return (
                    <div key={i} className="border rounded-lg p-2 flex items-center gap-2">
                      {isImage && previewUrl ? (
                        <img src={previewUrl} className="w-12 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                          <span className="text-xs text-muted-foreground">FILE</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 w-7 h-7 hover:text-red-500"
                        onClick={() => setReviewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t bg-muted/40 flex items-center justify-between rounded-b-lg">
            <p className="text-xs text-muted-foreground">
              {reviewFiles.length > 0 ? `${reviewFiles.length} ไฟล์` : "ไม่มีไฟล์แนบก็ได้"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-9 px-4 text-sm"
                disabled={reviewUploading}
                onClick={() => { setSubmitReviewTask(null); setReviewFiles([]); }}
              >
                ยกเลิก
              </Button>
              <Button
                className="h-9 px-4 text-sm bg-foreground text-background hover:bg-foreground/90 gap-1.5"
                disabled={reviewUploading}
                onClick={handleSubmitReview}
              >
                {reviewUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                ส่งให้ตรวจสอบ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
