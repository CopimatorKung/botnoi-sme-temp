import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

export function PendingApproval() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center">
            <Clock className="w-7 h-7 text-yellow-600" />
          </div>
          <CardTitle className="mt-3">รอการอนุมัติ</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            บัญชี <strong>{user?.email}</strong> ของคุณยังไม่ได้รับการอนุมัติจาก admin
            กรุณาติดต่อ admin ของทีมเพื่อขอเข้าใช้งานระบบ
          </p>
          <Button variant="outline" onClick={signOut} className="w-full">ออกจากระบบ</Button>
        </CardContent>
      </Card>
    </div>
  );
}
