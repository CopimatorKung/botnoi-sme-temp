import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CustomersTab } from "./tabs/CustomersTab";
import { TasksTab } from "./tabs/TasksTab";
import { TeamTab } from "./tabs/TeamTab";
import { TeamsTab } from "./tabs/TeamsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { NotificationBell } from "./NotificationBell";
import { LogOut, Users, ListTodo, Settings, UserCog, UsersRound } from "lucide-react";

export function Dashboard() {
  const { user, role, signOut } = useAuth();
  const [tab, setTab] = useState("customers");
  const [pendingCustomerId, setPendingCustomerId] = useState<string | null>(null);

  const goToCustomer = (customerId: string) => {
    setPendingCustomerId(customerId);
    setTab("customers");
  };

  const isAdminOrCEO = role === "admin" || role === "ceo" || role === "developer";

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-slate-100 p-1">
              <img src="/botnoi-logo.svg" alt="Botnoi" className="w-full h-full" />
            </div>
            <div>
              <h1 className="font-semibold text-base leading-tight">LINE CRM</h1>
              <p className="text-xs text-muted-foreground leading-tight">จัดการลูกค้าและทีมร่วมกัน</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-tight">{user?.email}</p>
              <p className="text-xs text-muted-foreground leading-tight capitalize">{role}</p>
            </div>
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={signOut} title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className={`grid w-full max-w-2xl ${isAdminOrCEO ? "grid-cols-5" : "grid-cols-4"}`}>
            <TabsTrigger value="customers"><Users className="w-4 h-4 mr-1.5" />ลูกค้า</TabsTrigger>
            <TabsTrigger value="tasks"><ListTodo className="w-4 h-4 mr-1.5" />งาน</TabsTrigger>
            <TabsTrigger value="team"><UserCog className="w-4 h-4 mr-1.5" />สมาชิก</TabsTrigger>
            <TabsTrigger value="teams"><UsersRound className="w-4 h-4 mr-1.5" />ทีม</TabsTrigger>
            {isAdminOrCEO && (
              <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1.5" />ตั้งค่า</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="customers" className="mt-6"><CustomersTab setActiveTab={setTab} pendingCustomerId={pendingCustomerId} clearPendingCustomer={() => setPendingCustomerId(null)} /></TabsContent>
          <TabsContent value="tasks" className="mt-6"><TasksTab goToCustomer={goToCustomer} /></TabsContent>
          <TabsContent value="team" className="mt-6"><TeamTab /></TabsContent>
          <TabsContent value="teams" className="mt-6"><TeamsTab /></TabsContent>
          {isAdminOrCEO && <TabsContent value="settings" className="mt-6"><SettingsTab /></TabsContent>}
        </Tabs>
      </main>
    </div>
  );
}
