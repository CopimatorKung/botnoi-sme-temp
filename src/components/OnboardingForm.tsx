import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle, Loader2, CheckCircle2, LogOut } from "lucide-react";
import { toast } from "sonner";

interface OnboardingFormProps {
  onComplete: () => void;
}

export function OnboardingForm({ onComplete }: OnboardingFormProps) {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill ชื่อจาก profile ที่มีอยู่แล้ว (กรณี Google OAuth ที่มีชื่อแล้ว)
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, internship_start, internship_end")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
        if (data?.internship_start) setStartDate(data.internship_start as string);
        if (data?.internship_end) setEndDate(data.internship_end as string);
      });
  }, [user]);

  const canSubmit = displayName.trim() && startDate && endDate;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    if (endDate < startDate) {
      toast.error("วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น");
      return;
    }
    setSaving(true);
    // ใช้ upsert แทน update เพื่อรองรับกรณีที่ยังไม่มี profile row
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        display_name: displayName.trim(),
        internship_start: startDate,
        internship_end: endDate,
      } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("บันทึกข้อมูลแล้ว ยินดีต้อนรับ!");
      onComplete();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      {/* ปุ่ม logout มุมขวาบน */}
      <button
        onClick={signOut}
        className="fixed top-4 right-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted"
        title="ออกจากระบบ"
      >
        <LogOut className="w-3.5 h-3.5" />
        ออกจากระบบ
      </button>

      <Card className="max-w-md w-full shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
            <UserCircle className="w-7 h-7 text-emerald-600" />
          </div>
          <CardTitle className="mt-3 text-lg">ยินดีต้อนรับ!</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            กรอกข้อมูลเพื่อเริ่มต้นใช้งานระบบ
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* ชื่อ-นามสกุล */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              ชื่อ-นามสกุล <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="เช่น สมชาย ใจดี"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="border-2"
            />
          </div>

          {/* วันฝึกงาน */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                วันเริ่มฝึกงาน <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-10 px-3 rounded-md border-2 border-border bg-background text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                วันสิ้นสุด <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-10 px-3 rounded-md border-2 border-border bg-background text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* ระยะเวลา */}
          {startDate && endDate && endDate >= startDate && (
            <p className="text-xs text-muted-foreground text-center">
              ระยะเวลาฝึกงาน{" "}
              <strong className="text-foreground">
                {Math.ceil(
                  (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                    (1000 * 60 * 60 * 24)
                )}{" "}
                วัน
              </strong>
            </p>
          )}

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            disabled={!canSubmit || saving}
            onClick={handleSubmit}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" />กำลังบันทึก...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" />เริ่มต้นใช้งาน</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
