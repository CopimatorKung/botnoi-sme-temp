import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, User } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) { toast.error("เข้าสู่ระบบไม่สำเร็จ", { description: error.message }); setBusy(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error("เข้าสู่ระบบไม่สำเร็จ", { description: error.message });
    else navigate({ to: "/" });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error("รหัสผ่านไม่ตรงกัน"); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: name } },
    });
    if (error) {
      setBusy(false);
      const msg = error.message.includes("already registered")
        ? "อีเมลนี้ถูกใช้ไปแล้ว" : error.message;
      toast.error("สมัครไม่สำเร็จ", { description: msg });
    } else {
      // insert role "pending" ให้ทันที เพื่อให้ Admin เห็นในแท็บรอดำเนินการ
      if (data?.user?.id) {
        await supabase.from("user_roles").insert({ user_id: data.user.id, role: "pending" });
      }
      setBusy(false);
      toast.success("สมัครสำเร็จ!", { description: "รอ Admin อนุมัติก่อนเข้าใช้งาน" });
      setMode("login");
    }
  };

  const switchMode = (m: "login" | "signup") => {
    setMode(m);
    setEmail(""); setPassword(""); setConfirmPassword(""); setName("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-4 relative overflow-hidden">
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes blobFloat { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-20px) scale(1.05); } }
        .auth-card { animation: fadeInUp .45s cubic-bezier(.16,1,.3,1); }
        .blob1 { animation: blobFloat 7s ease-in-out infinite; }
        .blob2 { animation: blobFloat 9s ease-in-out infinite 1.5s; }
        .blob3 { animation: blobFloat 11s ease-in-out infinite 3s; }
      `}</style>

      {/* Blobs */}
      <div className="blob1 absolute -top-24 -left-24 w-80 h-80 bg-blue-300/25 rounded-full blur-3xl pointer-events-none" />
      <div className="blob2 absolute -bottom-20 -right-20 w-72 h-72 bg-sky-300/25 rounded-full blur-3xl pointer-events-none" />
      <div className="blob3 absolute top-1/3 -right-10 w-48 h-48 bg-indigo-200/30 rounded-full blur-2xl pointer-events-none" />

      <div className="auth-card w-full max-w-sm bg-white rounded-3xl shadow-2xl shadow-blue-100/60 p-8 relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-blue-100 border border-blue-50 mb-3 p-1.5">
            <img src="/botnoi-logo.svg" alt="Botnoi" className="w-full h-full" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">
            {mode === "login" ? "ยินดีต้อนรับกลับ" : "สร้างบัญชีใหม่"}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {mode === "login" ? "เข้าสู่ระบบเพื่อใช้งานบัญชีของคุณ" : "กรอกข้อมูลเพื่อสมัครสมาชิก"}
          </p>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50/60 placeholder:text-slate-300"
              />
            </div>
            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPass ? "text" : "password"} placeholder="กรอกรหัสผ่านของคุณ" value={password}
                onChange={(e) => setPassword(e.target.value)}
                readOnly onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                required
                className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50/60 placeholder:text-slate-300"
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button type="submit" disabled={busy}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[.98]">
              {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>

            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">หรือดำเนินการต่อด้วย</span></div>
            </div>

            <button type="button" onClick={handleGoogle} disabled={busy}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[.98] shadow-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>

            <p className="text-center text-sm text-slate-500 mt-2">
              ยังไม่มีบัญชี?{" "}
              <button type="button" onClick={() => switchMode("signup")} className="text-blue-600 font-semibold hover:underline">
                สมัครสมาชิก
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-3.5" autoComplete="off">
            {/* Name */}
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="ชื่อของคุณ" value={name}
                onChange={(e) => setName(e.target.value)} required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50/60 placeholder:text-slate-300" />
            </div>
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50/60 placeholder:text-slate-300" />
            </div>
            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type={showPass ? "text" : "password"} placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50/60 placeholder:text-slate-300" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Confirm */}
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type={showConfirm ? "text" : "password"} placeholder="ยืนยันรหัสผ่าน" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6}
                className={`w-full pl-10 pr-11 py-3 rounded-xl border text-sm outline-none focus:ring-2 transition-all bg-slate-50/60 placeholder:text-slate-300 ${
                  confirmPassword && password !== confirmPassword
                    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                    : "border-slate-200 focus:border-emerald-400 focus:ring-blue-100"
                }`} />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-500 -mt-1">รหัสผ่านไม่ตรงกัน</p>
            )}

            <button type="submit" disabled={busy}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-blue-200 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[.98]">
              {busy ? "กำลังสมัคร..." : "สมัครสมาชิก"}
            </button>

            <p className="text-xs text-slate-400 text-center">สมาชิกใหม่ต้องรอ admin อนุมัติก่อนใช้งาน</p>

            <p className="text-center text-sm text-slate-500">
              มีบัญชีแล้ว?{" "}
              <button type="button" onClick={() => switchMode("login")} className="text-blue-600 font-semibold hover:underline">
                เข้าสู่ระบบ
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
