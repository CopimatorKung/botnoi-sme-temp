import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

interface LogEntry {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  customer: { display_name: string | null; line_user_id: string | null } | null;
}

const fieldLabel: Record<string, string> = {
  "ชื่อธุรกิจ": "ชื่อธุรกิจ",
  "โทรศัพท์": "โทรศัพท์",
  "ประเภท SME": "ประเภท SME",
  "รายละเอียด": "รายละเอียด",
};

function parseDescription(desc: string) {
  return desc.split("\n").map((line) => {
    const colonIdx = line.indexOf(": ");
    if (colonIdx === -1) return { key: null, value: line };
    return { key: line.slice(0, colonIdx), value: line.slice(colonIdx + 2) };
  });
}

export function TestTab() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, status, created_at, customer_id")
      .ilike("title", "[LINE OA]%")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!data) { setLoading(false); return; }

    const customerIds = [...new Set(data.map((t: any) => t.customer_id).filter(Boolean))];
    let customerMap: Record<string, { display_name: string | null; line_user_id: string | null }> = {};

    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, display_name, line_user_id")
        .in("id", customerIds);
      if (customers) {
        customerMap = Object.fromEntries(customers.map((c: any) => [c.id, c]));
      }
    }

    setEntries(
      data.map((t: any) => ({
        ...t,
        customer: t.customer_id ? (customerMap[t.customer_id] ?? null) : null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("test-tab-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">ข้อมูลที่รับจาก LINE OA Bot</h2>
          <p className="text-xs text-muted-foreground mt-0.5">แสดง payload ที่บอทส่งมาผ่าน API line-oa-registration</p>
        </div>
        <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
          รีเฟรช
        </button>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground text-center py-8">กำลังโหลด...</p>
      )}

      {!loading && entries.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          ยังไม่มีข้อมูลที่รับจากบอท
        </Card>
      )}

      <div className="grid gap-3">
        {entries.map((e) => {
          const lines = parseDescription(e.description ?? "");
          return (
            <Card key={e.id} className="p-4 border-l-4 border-l-violet-400">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-2">
                  {/* header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                      LINE OA
                    </span>
                    {e.customer && (
                      <span className="text-sm font-semibold text-slate-800">
                        {e.customer.display_name || "ไม่ระบุชื่อ"}
                      </span>
                    )}
                    {e.customer?.line_user_id && (
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[160px]">
                        {e.customer.line_user_id}
                      </span>
                    )}
                  </div>

                  {/* payload fields */}
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                    {lines.map((l, i) => {
                      if (!l.key) return <div key={i} className="text-xs text-slate-400">{l.value}</div>;
                      const isSme = l.key === "ประเภท SME";
                      return (
                        <div key={i} className="flex gap-2 text-sm items-start">
                          <span className="text-slate-500 shrink-0 w-28">{l.key}</span>
                          {isSme ? (
                            <span className="bg-violet-100 text-violet-700 font-semibold text-xs px-2 py-0.5 rounded-full">
                              {l.value}
                            </span>
                          ) : (
                            <span className="font-medium text-slate-800 break-all">{l.value}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* timestamp */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: th })}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(e.created_at).toLocaleString("th-TH")}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
