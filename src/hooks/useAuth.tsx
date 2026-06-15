import { createContext, useContext, ReactNode } from "react";
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
  id: "092b7016-76ca-44dc-810f-d79c42f28cad",
  aud: "authenticated",
  role: "authenticated",
  email: "examini011@gmail.com",
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
  return (
    <AuthContext.Provider
      value={{
        session: mockSession,
        user: mockUser,
        role: "admin",
        loading: false,
        signOut: async () => {},
        refreshRole: async () => {},
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

