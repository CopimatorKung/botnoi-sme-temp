import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CustomersTab } from "./tabs/CustomersTab";
import { TasksTab } from "./tabs/TasksTab";
import { TeamTab } from "./tabs/TeamTab";
import { TeamsTab } from "./tabs/TeamsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { AdminReviewTab } from "./tabs/AdminReviewTab";
import { AllTasksTab } from "./tabs/AllTasksTab";
import { AdminMembersTab } from "./tabs/AdminMembersTab";
import { NotificationBell } from "./NotificationBell";
import { ProfileDialog } from "./ProfileDialog";
import {
  Users,
  ListTodo,
  Settings,
  UserCog,
  UsersRound,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  ClipboardCheck,
  LayoutList,
  Contact,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ซ่อน tab ลูกค้า
const CUSTOMERS_TAB_HIDDEN = true;

type TabId = "customers" | "tasks" | "team" | "teams" | "settings" | "review" | "alltasks" | "members";

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  hidden?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "customers", label: "ลูกค้า", icon: Users, hidden: CUSTOMERS_TAB_HIDDEN },
  { id: "tasks", label: "งาน", icon: ListTodo },
  { id: "team", label: "สมาชิก", icon: UserCog },
  { id: "teams", label: "ทีม", icon: UsersRound },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: "alltasks", label: "งานทั้งหมด", icon: LayoutList, adminOnly: true },
  { id: "review", label: "ตรวจสอบงาน", icon: ClipboardCheck, adminOnly: true },
  { id: "members", label: "จัดการสมาชิก", icon: Contact, adminOnly: true },
  { id: "settings", label: "ตั้งค่า", icon: Settings, adminOnly: true },
];

export function Dashboard() {
  const { user, role, signOut } = useAuth();
  const [tab, setTab] = useState<TabId>(CUSTOMERS_TAB_HIDDEN ? "tasks" : "customers");
  const [pendingCustomerId, setPendingCustomerId] = useState<string | null>(null);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarAvatarUrl, setSidebarAvatarUrl] = useState<string | null>(null);
  const [sidebarDisplayName, setSidebarDisplayName] = useState<string | null>(null);

  const fetchSidebarProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single();
    if (data) {
      setSidebarAvatarUrl((data as any).avatar_url ?? null);
      setSidebarDisplayName((data as any).display_name ?? null);
    }
  };

  useEffect(() => { fetchSidebarProfile(); }, [user]);

  const isAdminOrCEO = role === "admin" || role === "ceo" || role === "developer";

  const goToCustomer = (customerId: string) => {
    setPendingCustomerId(customerId);
    setTab("customers");
  };

  const goToTask = (taskId: string) => {
    setPendingTaskId(taskId);
    setTab("tasks");
  };

  const goToTeam = (teamId: string) => {
    setPendingTeamId(teamId);
    setTab("teams");
  };

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.hidden) return false;
    return true;
  });

  const allNavItems = [...visibleNav, ...ADMIN_NAV_ITEMS];
  const currentNav = allNavItems.find((n) => n.id === tab);

  const initials = (user?.email ?? "?")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  const handleNav = (id: TabId) => {
    setTab(id);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-muted/30 overflow-hidden">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-card border-r shadow-sm transition-transform duration-200",
          "lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-slate-100 p-1 shrink-0">
            <img src="/botnoi-logo.svg" alt="Botnoi" className="w-full h-full" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">LINE CRM</p>
            <p className="text-xs text-muted-foreground leading-tight truncate">
              จัดการลูกค้าและทีม
            </p>
          </div>
          {/* Close button (mobile) */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto shrink-0 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {/* Main nav */}
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
              </button>
            );
          })}

          {/* Admin section */}
          {isAdminOrCEO && (
            <div className="pt-4">
              <div className="flex items-center gap-1.5 px-3 pb-1.5">
                <ShieldCheck className="w-3 h-3 text-amber-500" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                  Admin Panel
                </p>
              </div>
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                      active
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-muted-foreground hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30 dark:hover:text-amber-400"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {active && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t">
          <div
            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            onClick={() => setProfileOpen(true)}
            title="ดูโปรไฟล์ของฉัน"
          >
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarImage src={sidebarAvatarUrl ?? undefined} className="object-cover" />
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                {sidebarDisplayName?.[0]?.toUpperCase() ?? initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {sidebarDisplayName ?? user?.email}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 w-7 h-7"
              onClick={(e) => { e.stopPropagation(); setProfileOpen(true); }}
              title="ตั้งค่าโปรไฟล์"
            >
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
          {/* Hamburger (mobile) */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Page title */}
          <div className="flex items-center gap-2 min-w-0">
            {currentNav && (
              <currentNav.icon className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <h1 className="font-semibold text-base truncate">
              {currentNav?.label ?? ""}
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell onTaskClick={goToTask} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-6 max-w-6xl">
            {tab === "customers" && !CUSTOMERS_TAB_HIDDEN && (
              <CustomersTab
                setActiveTab={(t) => setTab(t as TabId)}
                pendingCustomerId={pendingCustomerId}
                clearPendingCustomer={() => setPendingCustomerId(null)}
              />
            )}
            {tab === "tasks" && (
              <TasksTab
                goToCustomer={goToCustomer}
                pendingTaskId={pendingTaskId}
                clearPendingTask={() => setPendingTaskId(null)}
              />
            )}
            {tab === "team" && <TeamTab />}
            {tab === "teams" && (
              <TeamsTab
                initialTeamId={pendingTeamId}
                clearInitialTeam={() => setPendingTeamId(null)}
              />
            )}
            {tab === "alltasks" && isAdminOrCEO && <AllTasksTab />}
            {tab === "review" && isAdminOrCEO && <AdminReviewTab goToTeam={goToTeam} />}
            {tab === "members" && isAdminOrCEO && <AdminMembersTab />}
            {tab === "settings" && isAdminOrCEO && <SettingsTab />}
          </div>
        </main>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} onSaved={fetchSidebarProfile} onSignOut={signOut} />
    </div>
  );
}
