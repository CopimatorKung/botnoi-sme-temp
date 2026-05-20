import { useEffect, useState, useRef } from "react";
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
import { Plus, X, MessageSquare, Send, Phone, Tag, FileText, ChevronRight, UserCheck } from "lucide-react";
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

export function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

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

  const allTags = Array.from(new Set(customers.flatMap((c) => c.tags || []))).sort();

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const filtered = customers.filter((c) => {
    const matchSearch =
      !search ||
      c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.line_user_id.includes(search) ||
      (c.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchTags =
      selectedTags.length === 0 ||
      selectedTags.every((t) => (c.tags || []).includes(t));
    return matchSearch && matchTags;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
      {/* LEFT SIDE: Customers List */}
      <Card className="lg:col-span-1 flex flex-col overflow-hidden bg-card/60 backdrop-blur-sm border-muted">
        <div className="p-4 border-b bg-muted/20">
          <Input 
            placeholder="ค้นหาชื่อ, แท็ก, LINE ID..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background/80 focus-visible:ring-emerald-500"
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-muted-foreground font-medium">{filtered.length} ลูกค้าทั้งหมด</span>
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors font-medium"
              >
                ล้างตัวกรอง ×
              </button>
            )}
          </div>
          {allTags.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2 max-h-20 overflow-y-auto pr-1">
              {allTags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-all ${
                      active
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-background text-muted-foreground border-muted hover:border-emerald-400 hover:text-emerald-700"
                    }`}
                  >
                    {active && "✓ "}{tag}
                  </button>
                );
              })}
            </div>
          )}
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
                    <h3 className="font-bold text-sm leading-tight">{selected.display_name || "ไม่ทราบชื่อ"}</h3>
                    <span className="text-[10px] text-emerald-100 flex items-center gap-1 font-light">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block animate-ping"></span>
                      LINE OA Connected
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="text-white hover:bg-emerald-600 w-8 h-8 rounded-full" onClick={() => window.open(`tel:${selected.notes || ""}`)}>
                    <Phone className="w-4 h-4" />
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

              {/* Handler Section */}
              <section className="flex flex-col gap-2">
                <h5 className="text-xs font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-sky-500" />
                  ผู้ดูแล
                </h5>
                <Select
                  value={selected.assigned_to || "none"}
                  onValueChange={(v) => assignHandler(selected.id, v === "none" ? null : v)}
                >
                  <SelectTrigger className="h-8 text-xs rounded-lg focus:ring-sky-400">
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
                      setShowTagMenu(true);
                    }}
                    onFocus={() => setShowTagMenu(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        addTag();
                        setShowTagMenu(false);
                      }
                    }}
                    className="h-8 text-xs bg-slate-50/50 rounded-lg focus-visible:ring-emerald-500 w-full"
                  />
                  <Button 
                    onClick={() => setShowTagMenu(!showTagMenu)} 
                    size="icon" 
                    className="w-8 h-8 shrink-0 bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </Button>

                  {/* Floating Suggested Tags Popover */}
                  {showTagMenu && (
                    <>
                      {/* Transparent overlay backdrop to close the popup on click outside */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowTagMenu(false)} />
                      
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
                                setShowTagMenu(false);
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
    </div>
  );
}
