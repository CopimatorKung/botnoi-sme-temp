import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "developer" | "ceo" | "admin" | "team_leader" | "member" | "pending" | null;

interface AuthState {
  session: Session | null;
  user: User | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const mockUser: User = {
  id: "mocked-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "demo-user@linecrm.com",
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: { full_name: "Demo User" },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockSession: Session = {
  access_token: "mocked",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "mocked",
  user: mockUser,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .order("role", { ascending: true });
    if (!data || data.length === 0) {
      // ผู้ใช้ใหม่ (รวม Google OAuth) — auto-assign pending
      await supabase.from("user_roles").insert({ user_id: userId, role: "pending" });
      setRole("pending");
      return;
    }
    // priority: developer > ceo > admin > team_leader > member > pending
    const roles = data.map((r) => r.role);
    if (roles.includes("developer")) setRole("developer");
    else if (roles.includes("ceo")) setRole("ceo");
    else if (roles.includes("admin")) setRole("admin");
    else if (roles.includes("team_leader")) setRole("team_leader");
    else if (roles.includes("member")) setRole("member");
    else setRole("pending");
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => fetchRole(s.user.id), 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) fetchRole(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
        refreshRole: async () => {
          if (session?.user) await fetchRole(session.user.id);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

