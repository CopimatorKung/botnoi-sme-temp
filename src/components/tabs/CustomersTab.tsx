import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, MessageSquare, Send, Phone, Tag, FileText, ChevronRight, UserCheck, SlidersHorizontal, UserPlus, UserMinus, Copy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow, format } from "date-fns";
import { th } from "date-fns/locale";

interface Customer {
  id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  status_message: string | null;
  tags: string[] | null;
  notes: string | null;
  last_message_at: string | null;
  created_at: string;
  assigned_to: string | null;
}

interface Profile { id: string; display_name: string | null; email: string | null; avatar_url: string | null; }

interface Message {
  id: string;
  message_type: string;
  content: string | null;
  received_at: string;
  source: string | null;
  raw_event?: any;
}

const RECOMMENDED_TAGS = [
  "ลูกค้า VIP",
  "ลูกค้าประจำ",
  "สั่งบ่อย",
  "ชอบรสจัด",
  "ไม่ใส่ต้นหอม",
  "ไม่ใส่กระเทียมเจียว",
  "กลับบ้าน (TA)",
  "เดลิเวอรี",
  "ลูกค้าใหม่",
  "รอการติดต่อ"
];

interface CustomersTabProps {
  setActiveTab?: (tab: string) => void;
  pendingCustomerId?: string | null;
  clearPendingCustomer?: () => void;
}

export function CustomersTab({ setActiveTab, pendingCustomerId, clearPendingCustomer }: CustomersTabProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showSuggestedTags, setShowSuggestedTags] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimTitle, setClaimTitle] = useState("");
  const [claimDesc, setClaimDesc] = useState("");
  const [claimBusiness, setClaimBusiness] = useState("");
  const [claimType, setClaimType] = useState<"individual" | "team">("individual");
  const [claimWorkType, setClaimWorkType] = useState<"solo" | "team">("solo");
  const [claimTeamId, setClaimTeamId] = useState<string>("");
  const [myTeams, setMyTeams] = useState<{ id: string; name: string }[]>([]);
  const [creatingTask, setCreatingTask] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);

  const handleCreateTask = async () => {
    if (!selected || !claimTitle.trim() || creatingTask) return;
    if (claimType === "individual" && claimWorkType === "team" && !claimTeamId) {
      toast.error("กรุณาเลือกทีม"); return;
    }
    setCreatingTask(true);

    const now = new Date();
    const dateStr = format(now, "d MMMM yyyy เวลา HH:mm น.", { locale: th });
    const fullDescription = `ลูกค้า: ${selected.display_name || "ไม่ระบุชื่อ"}\nวันที่รับงาน: ${dateStr}\nประเภทธุรกิจ: ${claimBusiness.trim() || "ไม่ได้ระบุ"}\nรูปแบบงาน: ${claimWorkType === "solo" ? "งานเดี่ยว" : "งานทีม"}\nรายละเอียดงาน: ${claimDesc.trim()}`;
    const isIndividual = claimType === "individual";
    const useTeam = isIndividual && claimWorkType === "team";

    try {
      const { error } = await supabase.from("tasks").insert({
        customer_id: selected.id,
        title: claimTitle.trim(),
        description: fullDescription,
        status: isIndividual ? "in_progress" : "open",
        assigned_to: isIndividual ? (user?.id || null) : null,
        created_by: user?.id || null,
        team_id: useTeam ? claimTeamId : null,
      } as any);

      if (error) {
        toast.error("สร้างงานล้มเหลว: " + error.message);
      } else {
        toast.success("รับเคสและสร้างงานเรียบร้อยแล้ว!");

        // ส่งแจ้งลูกค้าทาง LINE เมื่อรับงานเลย
        if (isIndividual && selected.line_user_id) {
          const msg = `✅ รับงานแล้ว\nทีมงานของเรากำลังดูแลคุณอยู่นะครับ/ค่ะ`;
          await supabase.functions.invoke("line-webhook/send", {
            body: { to: selected.line_user_id, text: msg },
          });
          await supabase.from("messages").insert({
            customer_id: selected.id,
            message_type: "text",
            content: msg,
            source: "agent",
          });
        }

        setShowClaimModal(false);
        setClaimTitle("");
        setClaimDesc("");
        setClaimBusiness("");
        setClaimType("individual");
        setClaimWorkType("solo");
        setClaimTeamId("");
        if (setActiveTab) setActiveTab("tasks");
      }
    } catch (err) {
      toast.error("เกิดข้อผิดพลาดในการสร้างงาน");
    } finally {
      setCreatingTask(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("team_members" as any).select("team_id").eq("user_id", user.id).then(({ data: memberships }) => {
      if (!memberships || (memberships as any[]).length === 0) return;
      const ids = (memberships as any[]).map((m: any) => m.team_id);
      supabase.from("teams" as any).select("id,name").in("id", ids).then(({ data: teams }) => {
        setMyTeams((teams as { id: string; name: string }[]) || []);
      });
    });
  }, [user]);

  // Auto-select customer เมื่อมาจาก TasksTab
  useEffect(() => {
    if (!pendingCustomerId || customers.length === 0) return;
    const target = customers.find((c) => c.id === pendingCustomerId);
    if (target) {
      handleSelect(target);
      clearPendingCustomer?.();
    }
  }, [pendingCustomerId, customers]);

  useEffect(() => {
    loadCustomers();
    loadProfiles();
    const ch = supabase.channel("customers-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => loadCustomers())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        if (selected) loadMessages(selected.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id,display_name,email,avatar_url");
    setProfiles(data || []);
  };

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) { toast.error(error.message); return; }
    setCustomers((data as any) || []);
  };

  const loadMessages = async (customerId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("customer_id", customerId)
      .order("received_at", { ascending: true }) // chronological order for chat window
      .limit(50);
    setMessages(data || []);
  };

  const handleSelect = (c: Customer) => {
    setSelected(c);
    loadMessages(c.id);
  };

  const assignHandler = async (customerId: string, userId: string | null) => {
    const { error } = await supabase.from("customers").update({ assigned_to: userId } as any).eq("id", customerId);
    if (error) toast.error(error.message);
    else {
      setCustomers((prev) => prev.map((c) => c.id === customerId ? { ...c, assigned_to: userId } : c));
      if (selected?.id === customerId) setSelected((s) => s ? { ...s, assigned_to: userId } : s);
    }
  };

  const saveNotes = async (notes: string) => {
    if (!selected) return;
    const { error } = await supabase.from("customers").update({ notes }).eq("id", selected.id);
    if (error) toast.error(error.message);
    else { toast.success("บันทึกแล้ว"); setSelected({ ...selected, notes }); }
  };

  const addTag = async () => {
    if (!selected || !newTag.trim()) return;
    const tags = Array.from(new Set([...(selected.tags || []), newTag.trim()]));
    const { error } = await supabase.from("customers").update({ tags }).eq("id", selected.id);
    if (error) toast.error(error.message);
    else { setSelected({ ...selected, tags }); setNewTag(""); }
  };

  const addSuggestedTag = async (tag: string) => {
    if (!selected) return;
    const tags = Array.from(new Set([...(selected.tags || []), tag]));
    const { error } = await supabase.from("customers").update({ tags }).eq("id", selected.id);
    if (error) toast.error(error.message);
    else { setSelected({ ...selected, tags }); }
  };

  const removeTag = async (tag: string) => {
    if (!selected) return;
    const tags = (selected.tags || []).filter((t) => t !== tag);
    const { error } = await supabase.from("customers").update({ tags }).eq("id", selected.id);
    if (error) toast.error(error.message);
    else setSelected({ ...selected, tags });
  };

  const handleSend = async () => {
    if (!selected || !replyText.trim() || sending) return;
    setSending(true);
    const textToSend = replyText.trim();
    
    try {
      // 1. Invoke Edge Function to push the message directly to LINE
      const { data, error: fnError } = await supabase.functions.invoke("line-webhook/send", {
        body: { to: selected.line_user_id, text: textToSend }
      });

      if (fnError) {
        throw new Error(fnError.message || "Failed to push message via Edge Function");
      }

      // 2. Insert into the database to display in the chat UI
      const { error: dbError } = await supabase.from("messages").insert({
        customer_id: selected.id,
        message_type: "text",
        content: textToSend,
        source: "agent"
      });

      if (dbError) {
        toast.error("บันทึกแชทล้มเหลว: " + dbError.message);
      } else {
        setReplyText("");
        loadMessages(selected.id);
        loadCustomers();
      }
    } catch (err: any) {
      console.error("Send message error:", err);
      toast.error("ส่งข้อความล้มเหลว: " + (err.message || "ไม่สามารถติดต่อไลน์ได้"));
    } finally {
      setSending(false);
    }
  };

  const allTags = useMemo(
    () => Array.from(new Set(customers.flatMap((c) => c.tags || []))).sort(),
    [customers]
  );

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const filtered = useMemo(() => customers.filter((c) => {
    const matchSearch =
      !search ||
      c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.line_user_id.includes(search) ||
      (c.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchTags =
      selectedTags.length === 0 ||
      selectedTags.every((t) => (c.tags || []).includes(t));
    return matchSearch && matchTags;
  }), [customers, search, selectedTags]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
      {/* LEFT SIDE: Customers List */}
      <Card className="lg:col-span-1 flex flex-col overflow-hidden bg-card/60 backdrop-blur-sm border-muted">
        <div className="p-4 border-b bg-muted/20">
          <div className="flex gap-2 items-center">
            <Input
              placeholder="ค้นหาชื่อ, แท็ก, LINE ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background/80 focus-visible:ring-emerald-500"
            />
            <Popover open={showTagMenu} onOpenChange={setShowTagMenu}>
              <PopoverTrigger asChild>
                <button
                  className={`relative shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${
                    showTagMenu || selectedTags.length > 0
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                      : "bg-background border-muted text-muted-foreground hover:border-emerald-400 hover:text-emerald-600"
                  }`}
                  title="กรองด้วยแท็ก"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {selectedTags.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 text-white text-[9px] flex items-center justify-center font-bold leading-none">
                      {selectedTags.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground">กรองด้วยแท็ก</span>
                  {selectedTags.length > 0 && (
                    <button
                      onClick={() => setSelectedTags([])}
                      className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors font-medium"
                    >
                      ล้างทั้งหมด ×
                    </button>
                  )}
                </div>
                {allTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">ยังไม่มีแท็กในระบบ</p>
                ) : (
                  <div className="flex gap-1.5 flex-wrap max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                    {allTags.map((tag) => {
                      const active = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                            active
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-muted/50 text-muted-foreground border-muted hover:border-emerald-400 hover:text-emerald-700"
                          }`}
                        >
                          {active && "✓ "}{tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex justify-between items-center mt-2.5">
            <span className="text-xs text-muted-foreground font-medium">{filtered.length} ลูกค้าทั้งหมด</span>
            {selectedTags.length > 0 && (
              <span className="text-[10px] text-emerald-600 font-medium">
                กรอง {selectedTags.length} แท็ก
              </span>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
              <span>ยังไม่มีลูกค้าทักเข้ามาใน LINE OA</span>
            </div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className={`w-full text-left p-4 border-b transition-all flex items-start gap-3 relative ${
                selected?.id === c.id
                  ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500 pl-3"
                  : c.assigned_to
                  ? "bg-sky-50/60 dark:bg-sky-950/20 border-l-4 border-l-sky-400 pl-3 hover:bg-sky-50/90"
                  : "hover:bg-muted/30"
              }`}
            >
              <Avatar className="w-11 h-11 border border-muted shadow-sm">
                <AvatarImage src={c.picture_url || undefined} />
                <AvatarFallback className="bg-emerald-100 text-emerald-800 font-medium">
                  {c.display_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline gap-2">
                  <p className="font-semibold text-sm text-foreground truncate">{c.display_name || "ไม่ทราบชื่อ"}</p>
                  {c.last_message_at && (
                    <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                      {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: th })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/80 truncate mt-0.5">ID: {c.line_user_id.slice(0, 12)}...</p>
                {c.tags && c.tags.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {c.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[9px] px-1.5 py-0 bg-secondary/80 font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                {c.assigned_to && profileMap[c.assigned_to] && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Avatar className="w-4 h-4 shrink-0">
                      <AvatarImage src={profileMap[c.assigned_to].avatar_url || undefined} />
                      <AvatarFallback className="text-[8px] bg-sky-200 text-sky-800 font-semibold">
                        {(profileMap[c.assigned_to].display_name || profileMap[c.assigned_to].email || "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium truncate">
                      {profileMap[c.assigned_to].display_name || profileMap[c.assigned_to].email}
                    </span>
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 self-center absolute right-3" />
            </button>
          ))}
        </ScrollArea>
      </Card>

      {/* RIGHT SIDE: LINE Styled Chat Screen & Customer CRM Sidebar */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden border-muted bg-card">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-3">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 animate-pulse" />
            <span>กรุณาเลือกลูกค้าทางซ้ายมือเพื่อดูบทสนทนา</span>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden h-full">
            {/* 1. Chat Column (LINE Style) */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#7494C0] relative">
              {/* Chat Header */}
              <div className="p-3 border-b bg-emerald-700 text-white flex justify-between items-center shadow-md z-10">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border border-white/20">
                    <AvatarImage src={selected.picture_url || undefined} />
                    <AvatarFallback className="bg-emerald-800 text-white font-medium">
                      {selected.display_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm leading-tight">{selected.display_name || "ไม่ทราบชื่อ"}</h3>
                      <button
                        title="คัดลอกชื่อ"
                        onClick={() => {
                          navigator.clipboard.writeText(selected.display_name || "");
                          toast.success("คัดลอกชื่อแล้ว");
                        }}
                        className="text-white/60 hover:text-white transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-[10px] text-emerald-100 flex items-center gap-1 font-light">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block animate-ping"></span>
                      LINE OA Connected
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => setShowClaimModal(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1 h-8 rounded-lg font-semibold flex items-center gap-1.5 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>รับงาน / สร้างเคส</span>
                  </Button>
                </div>
              </div>

              {/* LINE Messages List */}
              <ScrollArea className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4 pr-1">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-white/70 text-xs">
                      ยังไม่มีประวัติการส่งข้อความ
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isAgent = m.source === "agent" || m.source === "bot";
                      const isFlex = m.message_type === "flex" || (m.content && (m.content.includes("ขอเมนู") || m.content.includes("เมนู")));

                      return (
                        <div 
                          key={m.id} 
                          className={`flex gap-2 max-w-[85%] ${isAgent ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                        >
                          {/* Avatar for Customer (on the left) */}
                          {!isAgent && (
                            <Avatar className="w-8 h-8 border border-white/10 shrink-0 self-start mt-1">
                              <AvatarImage src={selected.picture_url || undefined} />
                              <AvatarFallback className="bg-slate-200 text-xs text-slate-700">
                                {selected.display_name?.[0] || "?"}
                              </AvatarFallback>
                            </Avatar>
                          )}

                          {/* Chat Bubbles */}
                          <div className="flex flex-col">
                            {/* Display Name if Customer */}
                            {!isAgent && (
                              <span className="text-[10px] text-white/80 font-light mb-0.5 ml-1">
                                {selected.display_name || "ลูกค้า"}
                              </span>
                            )}

                            {/* Bubble Body */}
                            <div className="flex items-end gap-1.5">
                              {/* Left Align timestamp for Agent messages */}
                              {isAgent && (
                                <span className="text-[9px] text-white/60 shrink-0 font-light select-none mb-1">
                                  {format(new Date(m.received_at), "HH:mm")}
                                </span>
                              )}

                              <div 
                                className={`p-2.5 px-3 rounded-2xl text-sm shadow-sm relative break-words leading-relaxed max-w-[280px] md:max-w-[320px] ${
                                  isAgent 
                                    ? "bg-[#85e243] text-black rounded-tr-none" 
                                    : "bg-white text-black rounded-tl-none"
                                }`}
                              >
                                {/* Text Content */}
                                {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}

                                {/* Render beautiful Noodle Shop card (Thai Cuisine Card) */}
                                {isFlex && (
                                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm mt-2 max-w-[240px]">
                                    <img 
                                      src="https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop" 
                                      alt="Noodles Menu" 
                                      className="w-full h-32 object-cover"
                                    />
                                    <div className="p-3 text-left">
                                      <h5 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                                        🍜 ร้านขายก๋วยเตี๋ยว
                                      </h5>
                                      <p className="text-[11px] text-gray-600 mt-1 leading-normal">
                                        อยาก ตรวจสอบเมนู พิมพ์ ขอเมนู ในแชทเลย
                                      </p>
                                      <Button 
                                        variant="outline" 
                                        className="w-full mt-2.5 text-xs py-1 h-7 text-emerald-600 border-emerald-200 hover:bg-emerald-50 rounded-lg font-semibold flex items-center justify-center gap-1"
                                        onClick={() => window.open("tel:0967033424")}
                                      >
                                        <Phone className="w-3 h-3" />
                                        0967033424
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right Align timestamp for Customer messages */}
                              {!isAgent && (
                                <span className="text-[9px] text-white/60 shrink-0 font-light select-none mb-1">
                                  {format(new Date(m.received_at), "HH:mm")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* LINE Message Sender Input Bar */}
              <div className="p-3 bg-slate-100 border-t flex gap-2 items-center z-10 shadow-inner">
                <Input
                  placeholder="พิมพ์ข้อความตอบกลับ LINE..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  disabled={sending}
                  className="flex-1 bg-white border-slate-200 focus-visible:ring-emerald-500 rounded-xl"
                />
                <Button 
                  onClick={handleSend} 
                  disabled={sending || !replyText.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow px-4 flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ส่ง</span>
                </Button>
              </div>
            </div>

            {/* 2. Customer CRM Sidebar Column */}
            <div className="w-80 border-l bg-background p-4 flex flex-col gap-5 overflow-y-auto shrink-0 select-none">
              {/* Profile Card Header */}
              <div className="flex flex-col items-center text-center pb-4 border-b gap-2">
                <Avatar className="w-16 h-16 border-2 border-emerald-100 shadow-md">
                  <AvatarImage src={selected.picture_url || undefined} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 text-xl font-semibold">
                    {selected.display_name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-bold text-base text-foreground leading-tight">{selected.display_name || "ไม่ทราบชื่อ"}</h4>
                  <p className="text-[10px] text-muted-foreground font-mono mt-1 select-all truncate max-w-[240px]">
                    {selected.line_user_id}
                  </p>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => user && assignHandler(selected.id, user.id)}
                  disabled={selected.assigned_to === user?.id}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all text-sm font-semibold ${
                    selected.assigned_to === user?.id
                      ? "bg-emerald-50 border-emerald-200 text-emerald-600 cursor-default"
                      : "bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-sm active:scale-[0.98]"
                  }`}
                >
                  <UserPlus className="w-5 h-5" />
                  {selected.assigned_to === user?.id ? "กำลังดูแล ✓" : "รับดูแล"}
                </button>
                <button
                  onClick={() => assignHandler(selected.id, null)}
                  disabled={!selected.assigned_to}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all text-sm font-semibold ${
                    !selected.assigned_to
                      ? "bg-slate-50 border-slate-200 text-slate-300 cursor-default"
                      : "bg-white border-red-200 text-red-500 hover:bg-red-50 hover:border-red-400 hover:shadow-sm active:scale-[0.98]"
                  }`}
                >
                  <UserMinus className="w-5 h-5" />
                  ปฏิเสธ
                </button>
              </div>

              {/* Handler Section */}
              <section className="flex flex-col gap-2">
                <h5 className="text-xs font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-sky-500" />
                  ผู้ดูแล
                </h5>
                <Select
                  value={selected.assigned_to || "none"}
                  onValueChange={(v) => assignHandler(selected.id, v === "none" ? null : v)}
                  disabled
                >
                  <SelectTrigger className="h-8 text-xs rounded-lg opacity-70 cursor-not-allowed">
                    <SelectValue placeholder="ยังไม่มีผู้ดูแล" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่มีผู้ดูแล</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.display_name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>

              {/* Tags Section */}
              <section className="flex flex-col gap-2">
                <h5 className="text-xs font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  ป้ายกำกับ (Tags)
                </h5>
                <div className="flex gap-1.5 flex-wrap min-h-[24px]">
                  {(selected.tags || []).length === 0 ? (
                    <span className="text-xs text-muted-foreground/75 italic">ยังไม่มีป้ายกำกับ</span>
                  ) : (
                    (selected.tags || []).map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-100 px-2 py-0.5 rounded-md font-medium text-xs">
                        {t}
                        <button onClick={() => removeTag(t)} className="hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>

                <div className="flex gap-1.5 mt-2 relative">
                  <Input
                    placeholder="พิมพ์แท็กเอง หรือเลือกจากปุ่ม +"
                    value={newTag}
                    onChange={(e) => {
                      setNewTag(e.target.value);
                      setShowSuggestedTags(true);
                    }}
                    onFocus={() => setShowSuggestedTags(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        addTag();
                        setShowSuggestedTags(false);
                      }
                    }}
                    className="h-8 text-xs bg-slate-50/50 rounded-lg focus-visible:ring-emerald-500 w-full"
                  />
                  <Button
                    onClick={() => setShowSuggestedTags(!showSuggestedTags)}
                    size="icon"
                    className="w-8 h-8 shrink-0 bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </Button>

                  {/* Floating Suggested Tags Popover */}
                  {showSuggestedTags && (
                    <>
                      {/* Transparent overlay backdrop to close the popup on click outside */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowSuggestedTags(false)} />
                      
                      <div className="absolute top-9 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 z-50 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                        <span className="text-[10px] text-muted-foreground font-semibold px-1">💡 คลิกเพื่อเพิ่มแท็กแนะนำ:</span>
                        
                        <div className="flex gap-1 flex-wrap mt-0.5">
                          {RECOMMENDED_TAGS.map((t) => {
                            const hasTag = (selected.tags || []).includes(t);
                            if (hasTag) return null;
                            return (
                              <button
                                key={t}
                                onClick={() => {
                                  addSuggestedTag(t);
                                  // Keep menu open for multiple tag choices
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200/60 transition-all font-medium text-left"
                              >
                                + {t}
                              </button>
                            );
                          })}
                          
                          {RECOMMENDED_TAGS.every(t => (selected.tags || []).includes(t)) && (
                            <span className="text-[10px] text-muted-foreground/60 italic px-1">
                              เพิ่มแท็กแนะนำครบทั้งหมดแล้ว
                            </span>
                          )}
                        </div>
                        
                        {newTag.trim() && (
                          <div className="border-t pt-1.5 mt-0.5 flex flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground font-semibold px-1">หรือสร้างแท็กใหม่:</span>
                            <button
                              onClick={() => {
                                addTag();
                                setShowSuggestedTags(false);
                              }}
                              className="text-[10px] text-emerald-600 hover:text-emerald-700 px-1 font-semibold text-left"
                            >
                              สร้างแท็ก "{newTag.trim()}"
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Notes Section */}
              <section className="flex flex-col gap-2 flex-1">
                <h5 className="text-xs font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  โน้ตบันทึกข้อมูลลูกค้า
                </h5>
                <Textarea
                  key={selected.id}
                  defaultValue={selected.notes || ""}
                  placeholder="เพิ่มข้อมูลสำคัญ เช่น ชอบกินก๋วยเตี๋ยวรสจัด, ที่อยู่ออฟฟิศ, เบอร์โทรสำรอง..."
                  rows={6}
                  onBlur={(e) => e.target.value !== selected.notes && saveNotes(e.target.value)}
                  className="text-xs bg-slate-50/50 rounded-xl focus:border-emerald-500 focus-visible:ring-emerald-500 resize-none leading-relaxed p-3"
                />
                <span className="text-[10px] text-muted-foreground/75 italic">
                  * ข้อมูลจะถูกบันทึกอัตโนมัติเมื่อกดคลิกออกนอกกล่องข้อความ
                </span>
              </section>
            </div>
          </div>
        )}
      </Card>

      {/* Custom Claim Task / Create Case Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 text-left">
            {/* Modal Header */}
            <div className="bg-emerald-700 text-white p-4 flex justify-between items-center rounded-t-2xl">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
                <h4 className="font-bold text-base">🟢 รับงานและสร้างเคสใหม่</h4>
              </div>
              <button 
                onClick={() => setShowClaimModal(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
              <div className="bg-slate-50 p-3 rounded-xl border leading-relaxed flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  ลูกค้า: <strong className="text-foreground text-sm">{selected?.display_name || "ไม่ระบุชื่อ"}</strong>
                </div>
                <div className="text-[10px] text-muted-foreground/70 shrink-0">
                  🕐 {format(new Date(), "d MMM yyyy HH:mm น.", { locale: th })}
                </div>
              </div>

              {/* Work Type Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  การรับงาน
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setClaimType("individual")}
                    className={`flex flex-col items-center justify-center gap-1 py-3 px-3 rounded-xl border transition-all ${
                      claimType === "individual"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm ring-1 ring-emerald-500/20"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-[0.98]"
                    }`}
                  >
                    <span className="text-xl">🙋</span>
                    <span className="text-xs font-bold">รับงานเลย</span>
                    <span className="text-[10px] font-normal text-center leading-tight opacity-70">
                      งานถูก assign ให้คุณทันที
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimType("team")}
                    className={`flex flex-col items-center justify-center gap-1 py-3 px-3 rounded-xl border transition-all ${
                      claimType === "team"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm ring-1 ring-emerald-500/20"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-[0.98]"
                    }`}
                  >
                    <span className="text-xl">📋</span>
                    <span className="text-xs font-bold">โพสลงบอร์ดงาน</span>
                    <span className="text-[10px] font-normal text-center leading-tight opacity-70">
                      ให้ทีมเห็นและมารับงานเอง
                    </span>
                  </button>
                </div>
              </div>

              {/* Work type — แสดงเฉพาะเมื่อเลือก "รับงานเลย" */}
              {claimType === "individual" && <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  รูปแบบงาน
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setClaimWorkType("solo")}
                    className={`flex flex-col items-center justify-center gap-1 py-3 px-3 rounded-xl border transition-all ${
                      claimWorkType === "solo"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm ring-1 ring-emerald-500/20"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-[0.98]"
                    }`}
                  >
                    <span className="text-xl">👤</span>
                    <span className="text-xs font-bold">งานเดี่ยว</span>
                    <span className="text-[10px] font-normal text-center leading-tight opacity-70">
                      ทำคนเดียวจบ
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimWorkType("team")}
                    className={`flex flex-col items-center justify-center gap-1 py-3 px-3 rounded-xl border transition-all ${
                      claimWorkType === "team"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm ring-1 ring-emerald-500/20"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-[0.98]"
                    }`}
                  >
                    <span className="text-xl">👥</span>
                    <span className="text-xs font-bold">งานทีม</span>
                    <span className="text-[10px] font-normal text-center leading-tight opacity-70">
                      ทำร่วมกันหลายคน
                    </span>
                  </button>
                </div>
              </div>}

              {/* Team selector — แสดงเมื่อ รับงานเลย + งานทีม */}
              {claimType === "individual" && claimWorkType === "team" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">เลือกทีม</label>
                  <Select value={claimTeamId} onValueChange={setClaimTeamId}>
                    <SelectTrigger className="text-xs focus-visible:ring-emerald-500 rounded-xl">
                      <SelectValue placeholder="เลือกทีมที่รับงานนี้..." />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[99999]">
                      {myTeams.length === 0
                        ? <SelectItem value="_none" disabled>คุณยังไม่ได้อยู่ในทีมใด</SelectItem>
                        : myTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Business Type input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  ประเภทธุรกิจ / ธุรกิจนี้คืออะไร
                </label>
                <Input
                  placeholder="เช่น ร้านก๋วยเตี๋ยว, ร้านกาแฟ, ค้าขายออนไลน์..."
                  value={claimBusiness}
                  onChange={(e) => setClaimBusiness(e.target.value)}
                  className="text-xs focus-visible:ring-emerald-500 rounded-xl"
                />
              </div>

              {/* Task Title input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  หัวข้องาน <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="เช่น สั่งก๋วยเตี๋ยว 5 ถุง, ติดตั้งระบบหน้าร้าน..."
                  value={claimTitle}
                  onChange={(e) => setClaimTitle(e.target.value)}
                  className="text-xs focus-visible:ring-emerald-500 rounded-xl"
                />
              </div>

              {/* Task Description textarea */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  รายละเอียดของงาน
                </label>
                <Textarea
                  placeholder="พิมพ์ข้อเสนอ รายละเอียดการสั่งซื้อ หรือความต้องการของลูกค้า..."
                  value={claimDesc}
                  onChange={(e) => setClaimDesc(e.target.value)}
                  rows={4}
                  className="text-xs focus-visible:ring-emerald-500 rounded-xl resize-none"
                />
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2.5 rounded-b-2xl">
              <Button
                variant="ghost"
                onClick={() => setShowClaimModal(false)}
                className="text-slate-600 hover:bg-slate-100 hover:text-slate-800 rounded-xl"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleCreateTask}
                disabled={creatingTask || !claimTitle.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow flex items-center gap-1.5 px-4"
              >
                {creatingTask ? (
                  <span>กำลังสร้าง...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>ยืนยันและรับงาน</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
