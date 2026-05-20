import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, UserCheck, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
  due_date: string | null;
  created_at: string;
}

interface Profile { id: string; display_name: string | null; email: string | null; }
interface Customer { id: string; display_name: string | null; }

const statusLabel: Record<Status, string> = {
  open: "เปิดรับ", in_progress: "กำลังทำ", done: "เสร็จแล้ว", cancelled: "ยกเลิก",
};
const statusColor: Record<Status, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-400",
};

export function TasksTab() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState<"all" | "mine" | "unassigned" | Status>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", customer_id: "", due_date: "" });

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  useEffect(() => {
    loadAll();
    const ch = supabase.channel("tasks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadTasks())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const loadAll = async () => { await Promise.all([loadTasks(), loadProfiles(), loadCustomers()]); };
  const loadTasks = async () => {
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    setTasks((data as Task[]) || []);
  };
  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id,display_name,email");
    setProfiles(data || []);
  };
  const loadCustomers = async () => {
    const { data } = await supabase.from("customers").select("id,display_name").order("display_name");
    setCustomers(data || []);
  };

  const createTask = async () => {
    if (!form.title.trim()) { toast.error("กรุณาใส่หัวข้องาน"); return; }
    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description || null,
      customer_id: form.customer_id || null,
      due_date: form.due_date || null,
      created_by: user!.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("สร้างงานแล้ว"); setOpen(false); setForm({ title: "", description: "", customer_id: "", due_date: "" }); }
  };

  const takeTask = async (id: string) => {
    const { error } = await supabase.from("tasks").update({ assigned_to: user!.id, status: "in_progress" }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("รับงานแล้ว");
  };
  const reassign = async (id: string, uid: string | null) => {
    const { error } = await supabase.from("tasks").update({ assigned_to: uid }).eq("id", id);
    if (error) toast.error(error.message);
  };
  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const filtered = tasks.filter((t) => {
    if (filter === "all") return true;
    if (filter === "mine") return t.assigned_to === user?.id;
    if (filter === "unassigned") return !t.assigned_to;
    return t.status === filter;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(["all", "mine", "unassigned", "open", "in_progress", "done"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? "ทั้งหมด" : f === "mine" ? "ของฉัน" : f === "unassigned" ? "ยังไม่มีคนรับ" : statusLabel[f as Status]}
            </Button>
          ))}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />สร้างงาน</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>สร้างงานใหม่</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>หัวข้องาน *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>รายละเอียด</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div>
                <Label>ลูกค้าที่เกี่ยวข้อง</Label>
                <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="เลือกลูกค้า (ถ้ามี)" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name || c.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>กำหนดส่ง</Label><Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={createTask}>สร้างงาน</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">ไม่มีงานในหมวดนี้</Card>
        )}
        {filtered.map((t) => {
          const assignee = t.assigned_to ? profileMap[t.assigned_to] : null;
          const creator = t.created_by ? profileMap[t.created_by] : null;
          const isMine = t.assigned_to === user?.id;
          return (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{t.title}</h3>
                    <Badge className={statusColor[t.status]}>{statusLabel[t.status]}</Badge>
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{t.description}</p>}
                  <div className="text-xs text-muted-foreground mt-2 flex gap-3 flex-wrap">
                    {creator && <span>สร้างโดย: {creator.display_name || creator.email}</span>}
                    <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: th })}</span>
                    {t.due_date && <span>กำหนดส่ง: {new Date(t.due_date).toLocaleString("th-TH")}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {assignee ? (
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{assignee.display_name || assignee.email}</span>
                    </div>
                  ) : (
                    <Badge variant="outline">ยังไม่มีคนรับ</Badge>
                  )}
                  <div className="flex gap-2 flex-wrap justify-end">
                    {!isMine && <Button size="sm" variant="outline" onClick={() => takeTask(t.id)}><UserPlus className="w-3 h-3 mr-1" />{assignee ? "รับแทน" : "รับงาน"}</Button>}
                    <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v as Status)}>
                      <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(statusLabel) as Status[]).map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={t.assigned_to || "none"} onValueChange={(v) => reassign(t.id, v === "none" ? null : v)}>
                      <SelectTrigger className="w-[150px] h-8"><SelectValue placeholder="มอบหมาย" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ไม่มีผู้รับ</SelectItem>
                        {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name || p.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
