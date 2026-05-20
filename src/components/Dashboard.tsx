import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CustomersTab } from "./tabs/CustomersTab";
import { TasksTab } from "./tabs/TasksTab";
import { TeamTab } from "./tabs/TeamTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { LogOut, Users, ListTodo, Settings, UserCog } from "lucide-react";

export function Dashboard() {
  const { user, role, signOut } = useAuth();
  const [tab, setTab] = useState("customers");

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500 flex items-center justify-center text-white font-bold">L</div>
            <div>
              <h1 className="font-semibold text-base leading-tight">LINE CRM</h1>
              <p className="text-xs text-muted-foreground leading-tight">จัดการลูกค้าและทีมร่วมกัน</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-tight">{user?.email}</p>
              <p className="text-xs text-muted-foreground leading-tight capitalize">{role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="customers"><Users className="w-4 h-4 mr-1.5" />ลูกค้า</TabsTrigger>
            <TabsTrigger value="tasks"><ListTodo className="w-4 h-4 mr-1.5" />งาน</TabsTrigger>
            <TabsTrigger value="team"><UserCog className="w-4 h-4 mr-1.5" />ทีม</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1.5" />ตั้งค่า</TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="mt-6"><CustomersTab /></TabsContent>
          <TabsContent value="tasks" className="mt-6"><TasksTab /></TabsContent>
          <TabsContent value="team" className="mt-6"><TeamTab /></TabsContent>
          <TabsContent value="settings" className="mt-6"><SettingsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
