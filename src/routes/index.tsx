import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dashboard } from "@/components/Dashboard";
import { PendingApproval } from "@/components/PendingApproval";
import { OnboardingForm } from "@/components/OnboardingForm";
import { InternshipExpiredScreen } from "@/components/InternshipExpiredScreen";

export const Route = createFileRoute("/")({ component: Index });

// role ที่ไม่ต้องตรวจวันฝึกงาน (staff ถาวร)
const EXEMPT_ROLES = ["admin", "ceo", "developer"];

function Index() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  // null = ยังไม่โหลด, true = ต้อง onboard, false = ผ่านแล้ว
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [internshipExpired, setInternshipExpired] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (session?.user && role && role !== "pending" && role !== null) {
      checkProfile(session.user.id, role);
    }
  }, [session?.user?.id, role]);

  const checkProfile = async (userId: string, currentRole: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("internship_start, internship_end")
      .eq("id", userId)
      .single();

    const d = data as any;

    // ตรวจวันฝึกงานหมดอายุ (เฉพาะ role ที่ไม่ใช่ staff ถาวร)
    if (!EXEMPT_ROLES.includes(currentRole) && d?.internship_end) {
      const expired = new Date(d.internship_end).setHours(23, 59, 59, 999) < Date.now();
      if (expired) {
        setInternshipExpired(true);
        setNeedsOnboarding(false);
        return;
      }
    }

    setInternshipExpired(false);
    setNeedsOnboarding(!d?.internship_start);
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        กำลังโหลด...
      </div>
    );
  }

  if (role === "pending" || role === null) {
    return <PendingApproval />;
  }

  // ยังรอเช็ค profile
  if (needsOnboarding === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        กำลังโหลด...
      </div>
    );
  }

  // วันฝึกงานหมดแล้ว
  if (internshipExpired) {
    return <InternshipExpiredScreen />;
  }

  if (needsOnboarding) {
    return <OnboardingForm onComplete={() => setNeedsOnboarding(false)} />;
  }

  return <Dashboard />;
}
