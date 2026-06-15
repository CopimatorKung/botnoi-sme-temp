import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
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
  Users, ListTodo, Settings, UserCog, UsersRound,
  Menu, X, ShieldCheck, ClipboardCheck, LayoutList, Contact, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CUSTOMERS_TAB_HIDDEN = true;

type TabId = "customers" | "tasks" | "team" | "teams" | "settings" | "review" | "alltasks" | "members";

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
  hidden?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "customers", label: "ลูกค้า", icon: Users, hidden: CUSTOMERS_TAB_HIDDEN },
  { id: "tasks", label: "งาน", icon: ListTodo },
  { id: "team", label: "สมาชิก", icon: UserCog },
  { id: "teams", label: "ทีม", icon: UsersRound },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: "alltasks", label: "งานทั้งหมด", icon: LayoutList },
  { id: "review", label: "ตรวจสอบงาน", icon: ClipboardCheck },
  { id: "members", label: "จัดการสมาชิก", icon: Contact },
  { id: "settings", label: "ตั้งค่า", icon: Settings },
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

  const isAdminOrCEO = role === "admin" || role === "ceo" || role === "developer";

  const goToCustomer = (id: string) => { setPendingCustomerId(id); setTab("customers"); };
  const goToTask = (id: string) => { setPendingTaskId(id); setTab("tasks"); };
  const goToTeam = (id: string) => { setPendingTeamId(id); setTab("teams"); };

  const visibleNav = NAV_ITEMS.filter((i) => !i.hidden);
  const currentNav = [...visibleNav, ...ADMIN_NAV_ITEMS].find((n) => n.id === tab);
  const initials = (sidebarDisplayName ?? user?.email ?? "?").slice(0, 2).toUpperCase();

  const handleNav = (id: TabId) => { setTab(id); setSidebarOpen(false); };

  const NavButton = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = tab === item.id;
    return (
      <button
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
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-card border-r border-border shadow-sm transition-transform duration-200 ease-in-out",
          "lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 p-1 border border-border">
            <img src="/botnoi-logo.svg" alt="Botnoi" className="w-full h-full" onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              (e.currentTarget.parentElement as HTMLElement).innerHTML =
                '<span class="text-blue-600 font-black text-sm">B</span>';
            }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate leading-tight">LINE CRM</p>
            <p className="text-[11px] text-muted-foreground truncate leading-tight">จัดการลูกค้าและทีม</p>
          </div>
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {visibleNav.map((item) => <NavButton key={item.id} item={item} />)}

          {isAdminOrCEO && (
            <div className="pt-5">
              <div className="flex items-center gap-1.5 px-3 pb-2">
                <ShieldCheck className="w-3 h-3 text-amber-500" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">
                  Admin Panel
                </p>
              </div>
              <div className="space-y-0.5">
                {ADMIN_NAV_ITEMS.map((item) => <NavButton key={item.id} item={item} />)}
              </div>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="px-2 py-3 border-t border-border shrink-0">
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left group"
            onClick={() => setProfileOpen(true)}
          >
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarImage src={sidebarAvatarUrl ?? undefined} className="object-cover" />
              <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate leading-tight">
                {sidebarDisplayName ?? user?.email}
              </p>
              <p className="text-[11px] text-muted-foreground capitalize leading-tight">{role}</p>
            </div>
            <Settings className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-5 py-3 bg-card border-b border-border shrink-0">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            {currentNav && (
              <currentNav.icon className="w-4 h-4 text-primary shrink-0" />
            )}
            <h1 className="font-semibold text-base text-foreground truncate">
              {currentNav?.label ?? ""}
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell onTaskClick={goToTask} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-6xl mx-auto px-5 py-6">
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

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} onSaved={() => {}} onSignOut={signOut} />
    </div>
  );
}
