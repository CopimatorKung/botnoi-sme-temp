import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, X, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
}

interface Message {
  id: string;
  message_type: string;
  content: string | null;
  received_at: string;
}

export function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    loadCustomers();
    const ch = supabase.channel("customers-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => loadCustomers())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        if (selected) loadMessages(selected.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected?.id]);

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) { toast.error(error.message); return; }
    setCustomers(data || []);
  };

  const loadMessages = async (customerId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("customer_id", customerId)
      .order("received_at", { ascending: false })
      .limit(50);
    setMessages(data || []);
  };

  const handleSelect = (c: Customer) => {
    setSelected(c);
    loadMessages(c.id);
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

  const removeTag = async (tag: string) => {
    if (!selected) return;
    const tags = (selected.tags || []).filter((t) => t !== tag);
    const { error } = await supabase.from("customers").update({ tags }).eq("id", selected.id);
    if (error) toast.error(error.message);
    else setSelected({ ...selected, tags });
  };

  const filtered = customers.filter((c) =>
    !search ||
    c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.line_user_id.includes(search) ||
    (c.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
      <Card className="lg:col-span-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b">
          <Input placeholder="ค้นหาชื่อ, แท็ก, LINE ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-2">{filtered.length} ลูกค้า</p>
        </div>
        <ScrollArea className="flex-1">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              ยังไม่มีลูกค้า — เมื่อมีคนทักเข้ามาที่ LINE OA จะปรากฏที่นี่
            </div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className={`w-full text-left p-3 border-b hover:bg-muted/50 transition ${selected?.id === c.id ? "bg-muted" : ""}`}
            >
              <div className="flex gap-3 items-start">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={c.picture_url || undefined} />
                  <AvatarFallback>{c.display_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.display_name || "ไม่ทราบชื่อ"}</p>
                  {c.last_message_at && (
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: th })}
                    </p>
                  )}
                  {c.tags && c.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {c.tags.slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </Card>

      <Card className="lg:col-span-2 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            เลือกลูกค้าเพื่อดูรายละเอียด
          </div>
        ) : (
          <>
            <div className="p-4 border-b flex items-start gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={selected.picture_url || undefined} />
                <AvatarFallback>{selected.display_name?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{selected.display_name || "ไม่ทราบชื่อ"}</h3>
                <p className="text-xs text-muted-foreground font-mono break-all">{selected.line_user_id}</p>
                {selected.status_message && <p className="text-sm mt-1 text-muted-foreground italic">"{selected.status_message}"</p>}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <section>
                  <h4 className="text-sm font-medium mb-2">แท็ก</h4>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {(selected.tags || []).map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1">
                        {t}
                        <button onClick={() => removeTag(t)}><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="เพิ่มแท็ก เช่น VIP, ลูกค้าใหม่"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTag()}
                    />
                    <Button onClick={addTag} size="icon"><Plus className="w-4 h-4" /></Button>
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-medium mb-2">โน้ตเกี่ยวกับลูกค้า</h4>
                  <Textarea
                    defaultValue={selected.notes || ""}
                    placeholder="ข้อมูลเพิ่มเติม, ความชอบ, ที่อยู่..."
                    rows={3}
                    onBlur={(e) => e.target.value !== selected.notes && saveNotes(e.target.value)}
                  />
                </section>

                <section>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" /> ข้อความล่าสุด ({messages.length})
                  </h4>
                  <div className="space-y-2">
                    {messages.length === 0 && <p className="text-xs text-muted-foreground">ยังไม่มีข้อความ</p>}
                    {messages.map((m) => (
                      <div key={m.id} className="bg-muted/50 rounded-md p-3 text-sm">
                        <div className="flex justify-between items-start gap-2">
                          <Badge variant="outline" className="text-[10px]">{m.message_type}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(m.received_at), { addSuffix: true, locale: th })}
                          </span>
                        </div>
                        {m.content && <p className="mt-1.5 whitespace-pre-wrap">{m.content}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </ScrollArea>
          </>
        )}
      </Card>
    </div>
  );
}
