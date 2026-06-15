import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Dashboard } from "@/components/Dashboard";
import { PendingApproval } from "@/components/PendingApproval";
import { OnboardingForm } from "@/components/OnboardingForm";
import { InternshipExpiredScreen } from "@/components/InternshipExpiredScreen";

export const Route = createFileRoute("/")({ component: Index });

// role ที่ไม่ต้องตรวจวันฝึกงาน (staff ถาวร)
const EXEMPT_ROLES = ["admin", "ceo", "developer"];

// ── Discord popup callback handler ──────────────────────────────────────────
// เมื่อ Discord OAuth redirect กลับมาใน popup window
// ดึง access_token จาก URL hash แล้ว call Discord API เพื่อเอา username
// ส่งกลับ parent ด้วย postMessage แล้วปิด popup
function DiscordPopupCallback() {
  useEffect(() => {
    // อ่าน hash จาก sessionStorage ที่ดักไว้ก่อน Supabase clear
    const savedHash = sessionStorage.getItem("discord_callback_hash") || window.location.hash;
    sessionStorage.removeItem("discord_callback_hash");

    const params = new URLSearchParams(savedHash.startsWith("#") ? savedHash.slice(1) : savedHash);
    const accessToken = params.get("access_token");

    if (!accessToken) {
      window.opener?.postMessage({ type: "discord_auth_error", error: "no token" }, window.location.origin);
      window.close();
      return;
    }

    fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        window.opener?.postMessage(
          { type: "discord_auth", username: data.global_name || data.username || "", id: data.id },
          window.location.origin
        );
      })
      .catch(() => {
        window.opener?.postMessage({ type: "discord_auth_error", error: "api failed" }, window.location.origin);
      })
      .finally(() => setTimeout(() => window.close(), 300));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground gap-2">
      <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      กำลังเชื่อม Discord...
    </div>
  );
}

function Index() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  // ถ้าเป็น popup จาก Discord OAuth — render callback handler แล้วจบ
  // เช็ค sessionStorage ด้วยเพราะ Supabase อาจ clear hash ไปแล้วตอน render
  const isDiscordCallback =
    typeof window !== "undefined" &&
    !!window.opener &&
    (window.location.hash.includes("access_token") ||
      !!sessionStorage.getItem("discord_callback_hash"));

  if (isDiscordCallback) {
    return <DiscordPopupCallback />;
  }
  return <Dashboard />;
}
