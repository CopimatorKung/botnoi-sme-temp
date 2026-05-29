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

const DRAFT_KEY = "onboarding_discord_draft";

export function OnboardingForm({ onComplete }: OnboardingFormProps) {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [linkingDiscord, setLinkingDiscord] = useState(false);
  const [discordName, setDiscordName] = useState("");

  useEffect(() => {
    if (!user) return;

    // Restore form state ที่ save ไว้ก่อน redirect ไป Discord
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const { displayName: n, startDate: s, endDate: e } = JSON.parse(draft);
        if (n) setDisplayName(n);
        if (s) setStartDate(s);
        if (e) setEndDate(e);
      } catch {}
      localStorage.removeItem(DRAFT_KEY);
    }

    // Pre-fill จาก profile ที่มีอยู่ (ไม่ override ค่าที่ restore มาแล้ว)
    supabase
      .from("profiles")
      .select("display_name, internship_start, internship_end")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName((prev) => prev || data.display_name!);
        if (data?.internship_start) setStartDate((prev) => prev || (data.internship_start as string));
        if (data?.internship_end) setEndDate((prev) => prev || (data.internship_end as string));
      });
  }, [user]);

  const canSubmit = displayName.trim() && startDate && endDate && discordName.trim();

  const handleConnectDiscord = () => {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    if (!clientId) {
      toast.error("ยังไม่ได้ตั้งค่า VITE_DISCORD_CLIENT_ID");
      return;
    }

    const redirectUri = encodeURIComponent(window.location.origin + "/discord-callback.html");
    const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=identify`;

    setLinkingDiscord(true);
    localStorage.removeItem("discord_auth_result");
    const popup = window.open(url, "discord_auth", "width=500,height=750,scrollbars=yes");

    let timer: ReturnType<typeof setInterval>;

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      localStorage.removeItem("discord_auth_result");
      clearInterval(timer);
    };

    const processResult = (data: { type: string; username?: string }) => {
      cleanup();
      if (data.type === "discord_auth") {
        setDiscordName(data.username || "");
        toast.success(`เชื่อม Discord สำเร็จ: ${data.username}`);
      } else {
        toast.error("เชื่อม Discord ไม่สำเร็จ");
      }
      setLinkingDiscord(false);
      popup?.close();
    };

    // รับผ่าน postMessage (กรณีที่ opener ยังใช้งานได้)
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "discord_auth" || event.data?.type === "discord_auth_error") {
        processResult(event.data);
      }
    };
    window.addEventListener("message", handleMessage);

    // รับผ่าน localStorage storage event (กรณี COOP ทำให้ opener เป็น null)
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== "discord_auth_result" || !e.newValue) return;
      try {
        processResult(JSON.parse(e.newValue));
      } catch {}
    };
    window.addEventListener("storage", handleStorage);

    // fallback: popup ปิดโดยไม่ส่งผลลัพธ์
    timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer);
        setTimeout(() => {
          window.removeEventListener("message", handleMessage);
          window.removeEventListener("storage", handleStorage);
          setLinkingDiscord(false);
        }, 1000);
      }
    }, 500);
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    if (endDate < startDate) {
      toast.error("วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        display_name: displayName.trim(),
        discord_name: discordName.trim(),
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

          {/* Discord */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              {/* Discord logo */}
              <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.033.05a19.91 19.91 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Discord <span className="text-red-500">*</span>
            </label>

            {discordName ? (
              /* เชื่อมแล้ว — แสดง username */
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border-2 border-emerald-300 bg-emerald-50">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-emerald-700 truncate">
                  {discordName}
                </span>
                <span className="ml-auto text-xs text-emerald-500 shrink-0">ยืนยันแล้ว</span>
              </div>
            ) : (
              /* ยังไม่เชื่อม — แสดงปุ่ม */
              <button
                type="button"
                onClick={handleConnectDiscord}
                disabled={linkingDiscord}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-md border-2 border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 hover:border-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {linkingDiscord ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />กำลังเชื่อมต่อ...</>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.033.05a19.91 19.91 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                    </svg>
                    เชื่อม Discord
                  </>
                )}
              </button>
            )}
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

          {!discordName && (
            <p className="text-xs text-center text-muted-foreground">
              ต้องเชื่อม Discord ก่อนจึงจะเริ่มต้นใช้งานได้
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
