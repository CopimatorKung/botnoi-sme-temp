import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Paperclip, Settings2 } from "lucide-react";
import { toast } from "sonner";

export function SettingsTab() {
  const { role } = useAuth();
  const [allowFileUpload, setAllowFileUpload] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManage = role === "admin" || role === "ceo" || role === "developer";

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("app_settings" as any)
      .select("value")
      .eq("key", "allow_file_upload")
      .single();
    if (data) setAllowFileUpload((data as any).value === "true");
    setLoadingSettings(false);
  };

  const toggleFileUpload = async (enabled: boolean) => {
    if (!canManage || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("app_settings" as any)
      .update({ value: enabled ? "true" : "false" })
      .eq("key", "allow_file_upload");
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      setAllowFileUpload(enabled);
      toast.success(enabled ? "เปิดการแนบไฟล์แล้ว" : "ปิดการแนบไฟล์แล้ว");
    }
  };

  if (!canManage) {
    return (
      <div className="space-y-4 max-w-3xl">
        <p className="text-sm text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-100 border flex items-center justify-center">
          <Settings2 className="w-4 h-4 text-slate-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold leading-tight">จัดการเว็บ</h2>
          <p className="text-xs text-muted-foreground">ควบคุมฟีเจอร์และการตั้งค่าของระบบ</p>
        </div>
      </div>

      {/* Feature flags */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5">
          ฟีเจอร์เว็บ
        </p>

        <Card className="divide-y">
          {/* Allow file upload toggle */}
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <Paperclip className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">อนุญาตให้แนบไฟล์</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  เปิด/ปิดการอัปโหลดไฟล์แนบในหน้า
                  <br />
                  "ส่งงานให้แอดมินตรวจสอบ"
                </p>
                <span className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  allowFileUpload
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${allowFileUpload ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {allowFileUpload ? "เปิดอยู่" : "ปิดอยู่"}
                </span>
              </div>
            </div>
            <Switch
              checked={allowFileUpload}
              onCheckedChange={toggleFileUpload}
              disabled={loadingSettings || saving}
              className="shrink-0"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
