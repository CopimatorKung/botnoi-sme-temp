import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarX2, LogOut, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function InternshipExpiredScreen() {
  const { user, signOut, refreshRole } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleReRegister = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // ล้างวันฝึกงานออก (จะต้องกรอกใหม่หลัง admin อนุมัติ)
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ internship_start: null, internship_end: null } as any)
        .eq("id", user.id);

      if (profErr) throw new Error(profErr.message);

      // ตั้ง role กลับเป็น pending — delete แล้ว insert ใหม่
      await supabase.from("user_roles" as any).delete().eq("user_id", user.id);
      const { error: roleErr } = await supabase
        .from("user_roles" as any)
        .insert({ user_id: user.id, role: "pending" });

      if (roleErr) throw new Error(roleErr.message);

      toast.success("ส่งคำขอแล้ว — กรุณารอ admin อนุมัติ");
      // refresh role → จะ trigger PendingApproval ใน index.tsx
      await refreshRole();
    } catch (e: any) {
      toast.error("เกิดข้อผิดพลาด: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-md w-full shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <CalendarX2 className="w-7 h-7 text-red-500" />
          </div>
          <CardTitle className="mt-3 text-lg">วันฝึกงานสิ้นสุดแล้ว</CardTitle>
        </CardHeader>

        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            บัญชี <strong className="text-foreground">{user?.email}</strong>{" "}
            ไม่สามารถเข้าใช้งานระบบได้ เนื่องจากครบกำหนดวันฝึกงานแล้ว
          </p>

          <div className="rounded-lg bg-muted/60 px-4 py-3 text-xs text-muted-foreground text-left space-y-1">
            <p className="font-medium text-foreground">หากต้องการเข้าใช้งานต่อ:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>กด "สมัครใหม่" เพื่อส่งคำขอ</li>
              <li>รอ admin อนุมัติบัญชีของคุณ</li>
              <li>กรอกวันฝึกงานใหม่อีกครั้ง</li>
            </ol>
          </div>

          <div className="space-y-2 pt-1">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
              onClick={handleReRegister}
              disabled={loading}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังส่งคำขอ...</>
                : <><RefreshCw className="w-4 h-4" /> สมัครใหม่</>
              }
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={signOut}
              disabled={loading}
            >
              <LogOut className="w-4 h-4" />
              ออกจากระบบ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
