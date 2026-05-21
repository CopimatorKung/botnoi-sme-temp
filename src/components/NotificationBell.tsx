import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Bell, Check, X } from "lucide-react";

interface Invitation {
  id: string;
  team_id: string;
  invited_by: string | null;
  status: string;
  created_at: string;
  team_name: string;
  inviter_name: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadInvitations();
    const ch = supabase.channel("invitations-rt")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "team_invitations",
        filter: `invited_user_id=eq.${user.id}`,
      }, () => loadInvitations())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const loadInvitations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("team_invitations" as any)
      .select("id,team_id,invited_by,status,created_at")
      .eq("invited_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) { setInvitations([]); return; }

    const teamIds = [...new Set(data.map((d: any) => d.team_id))];
    const inviterIds = [...new Set(data.map((d: any) => d.invited_by).filter(Boolean))];

    const [{ data: teams }, { data: profs }] = await Promise.all([
      supabase.from("teams" as any).select("id,name").in("id", teamIds),
      inviterIds.length > 0
        ? supabase.from("profiles").select("id,display_name,email").in("id", inviterIds)
        : Promise.resolve({ data: [] }),
    ]);

    const teamMap = Object.fromEntries(((teams as any[]) || []).map((t: any) => [t.id, t.name]));
    const profMap = Object.fromEntries(((profs as any[]) || []).map((p: any) => [p.id, p.display_name || p.email]));

    setInvitations(data.map((d: any) => ({
      ...d,
      team_name: teamMap[d.team_id] || "ไม่ทราบชื่อทีม",
      inviter_name: d.invited_by ? (profMap[d.invited_by] || "ไม่ทราบ") : "ไม่ทราบ",
    })));
  };

  const accept = async (inv: Invitation) => {
    const { error } = await supabase.from("team_members" as any).insert({
      team_id: inv.team_id, user_id: user!.id, position: "member",
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("team_invitations" as any).update({ status: "accepted" }).eq("id", inv.id);
    toast.success(`เข้าร่วมทีม ${inv.team_name} แล้ว`);
    loadInvitations();
  };

  const decline = async (invId: string) => {
    await supabase.from("team_invitations" as any).update({ status: "rejected" }).eq("id", invId);
    toast.success("ปฏิเสธคำเชิญแล้ว");
    loadInvitations();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {invitations.length > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {invitations.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden shadow-lg">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <p className="font-semibold text-sm">การแจ้งเตือน</p>
          {invitations.length > 0 && (
            <span className="text-xs text-muted-foreground">{invitations.length} รายการ</span>
          )}
        </div>
        {invitations.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Bell className="w-7 h-7 mx-auto mb-2 opacity-20" />
            ไม่มีการแจ้งเตือน
          </div>
        ) : (
          <div className="divide-y max-h-96 overflow-y-auto">
            {invitations.map((inv) => (
              <div key={inv.id} className="px-4 py-3.5 space-y-2.5">
                <div className="text-sm leading-relaxed">
                  <span className="font-medium">{inv.inviter_name}</span>
                  {" "}ขอเชิญคุณเข้าร่วมทีม{" "}
                  <span className="font-semibold text-emerald-700">「{inv.team_name}」</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 flex-1"
                    onClick={() => accept(inv)}
                  >
                    <Check className="w-3 h-3" />
                    ยอมรับ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-red-200 text-red-500 hover:bg-red-50 gap-1 flex-1"
                    onClick={() => decline(inv.id)}
                  >
                    <X className="w-3 h-3" />
                    ปฏิเสธ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
