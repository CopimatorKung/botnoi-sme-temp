import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function SettingsTab() {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/line-webhook`;

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("คัดลอกแล้ว");
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>เชื่อมต่อกับ LINE Official Account</CardTitle>
          <CardDescription>นำ URL ด้านล่างไปวางใน LINE Developers Console เพื่อให้ข้อความวิ่งเข้าระบบอัตโนมัติ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Webhook URL</label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)}><Copy className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-4 text-sm space-y-2">
            <p className="font-medium">วิธีตั้งค่า:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>เข้า <a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">LINE Developers Console <ExternalLink className="w-3 h-3" /></a></li>
              <li>เลือก Channel ของ Messaging API ที่คุณใช้</li>
              <li>ไปที่แท็บ <strong>Messaging API</strong></li>
              <li>วาง Webhook URL ด้านบนในช่อง Webhook URL แล้วกด <strong>Update</strong></li>
              <li>กด <strong>Verify</strong> เพื่อทดสอบ — ควรขึ้น Success</li>
              <li>เปิดสวิตช์ <strong>Use webhook</strong> ให้เป็น ON</li>
              <li>ปิด <strong>Auto-reply messages</strong> ถ้าไม่อยากให้บอทตอบอัตโนมัติ</li>
            </ol>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-md p-4 text-sm">
            <p className="font-medium text-yellow-900 dark:text-yellow-200">💡 ความปลอดภัย</p>
            <p className="text-yellow-800 dark:text-yellow-300 mt-1">
              Channel Access Token และ Channel Secret ถูกเก็บเป็น secret อย่างปลอดภัยใน backend แล้ว
              ถ้าต้องการเปลี่ยน token ใหม่ติดต่อ admin ได้
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
