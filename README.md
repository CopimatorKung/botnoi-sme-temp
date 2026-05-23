# Customer Flow Hub — LINE OA CRM Dashboard

ระบบ CRM สำหรับจัดการบทสนทนาจาก LINE Official Account พร้อม AI bot (Botnoi) แบบ real-time

---

## Features

- **Real-time Chat** — ดูและตอบข้อความลูกค้า LINE ได้ทันที ผ่าน Supabase Realtime
- **Botnoi AI Integration** — บอท Botnoi ตอบลูกค้าอัตโนมัติ + บันทึกข้อความลง CRM
- **Customer Management** — จัดการข้อมูลลูกค้า กำหนดผู้ดูแล (assigned_to) กรองด้วยแท็ก
- **Team Management** — สร้างทีม เชิญสมาชิก กำหนดบทบาท (admin / member / team_leader / CEO)
- **Task Management** — สร้างและติดตาม task ในแต่ละทีม
- **Notification Bell** — แจ้งเตือน real-time เมื่อมีข้อความใหม่
- **Role-based Access** — ควบคุมสิทธิ์ตามบทบาทผู้ใช้

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Router/Start, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Radix UI) |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Realtime | Supabase Realtime |
| AI Bot | Botnoi Custom Channel |
| LINE | LINE Messaging API |
| Deploy | Cloudflare (Vite plugin) |

---

## Architecture

```
LINE User
   │
   ▼
LINE Messaging API
   │
   ▼
[line-webhook] ──────────────────────────────────► Supabase DB (messages table)
   │                                                       ▲
   │  forward text to Botnoi                               │
   ▼                                                       │
Botnoi AI (Custom Channel)                                 │
   │                                                       │
   │  Transmit Endpoint                                    │
   ▼                                                       │
[botnoi-reply] ─── save bot message ──────────────────────┘
   │
   │  push reply to LINE user
   ▼
LINE User
```

### Edge Functions

| Function | Path | Description |
|---|---|---|
| `line-webhook` | `/functions/v1/line-webhook` | รับ webhook จาก LINE + forward ไป Botnoi |
| `botnoi-reply` | `/functions/v1/botnoi-reply` | รับ reply จาก Botnoi → save DB + push LINE |
| `bot-message` | `/functions/v1/bot-message` | REST endpoint บันทึกข้อความ bot ลง DB |
| `mcp-bot-message` | `/functions/v1/mcp-bot-message` | MCP server (JSON-RPC 2.0) สำหรับ Botnoi AI tool calling |

---

## Getting Started

### Prerequisites

- Node.js 18+ / Bun
- Supabase CLI (`npm install -g supabase`)
- LINE Developer Account
- Botnoi Account (Custom Channel)

### 1. Clone & Install

```bash
git clone https://github.com/pannawat1233/customer-flow-hub.git
cd customer-flow-hub
npm install
```

### 2. Environment Variables

สร้างไฟล์ `.env` ที่ root:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

### 3. Supabase Edge Function Secrets

ตั้งค่า secrets ผ่าน Supabase Dashboard หรือ CLI:

```bash
supabase secrets set --project-ref <project-ref> \
  LINE_CHANNEL_ACCESS_TOKEN=... \
  LINE_CHANNEL_SECRET=... \
  BOTNOI_BOT_ID=... \
  BOTNOI_SIGNING_SECRET=... \
  BOT_INGEST_SECRET=...
```

### 4. Apply Database Migrations

```bash
# Apply migrations ทั้งหมดไปยัง remote DB
supabase db query --linked --file supabase/migrations/<filename>.sql
```

### 5. Deploy Edge Functions

```bash
supabase functions deploy line-webhook --project-ref <project-ref>
supabase functions deploy botnoi-reply --project-ref <project-ref>
supabase functions deploy bot-message --project-ref <project-ref>
supabase functions deploy mcp-bot-message --project-ref <project-ref>
```

### 6. Run Locally

```bash
npm run dev
```

---

## Botnoi Custom Channel Setup

1. เข้า Botnoi → Custom Channel
2. ตั้งค่า **Receive Endpoint**:
   ```
   https://<project-ref>.supabase.co/functions/v1/line-webhook
   ```
3. ตั้งค่า **Transmit Endpoint**:
   ```
   https://<project-ref>.supabase.co/functions/v1/botnoi-reply
   ```

---

## LINE Webhook Setup

1. เข้า LINE Developers Console → Messaging API
2. ตั้งค่า Webhook URL:
   ```
   https://<project-ref>.supabase.co/functions/v1/line-webhook
   ```
3. เปิด **Use webhook**

---

## Database Schema (Key Tables)

| Table | Description |
|---|---|
| `customers` | ข้อมูลลูกค้าจาก LINE (line_user_id, display_name, picture_url) |
| `messages` | ข้อความทั้งหมด (source: `line` / `agent` / `bot`) |
| `profiles` | ข้อมูลผู้ใช้ระบบ (role, display_name) |
| `teams` | ทีมงาน |
| `team_invitations` | คำเชิญเข้าทีม |
| `tasks` | งานที่มอบหมาย |

### `insert_bot_message` RPC

```sql
SELECT insert_bot_message(
  p_line_user_id  => 'Uxxxxxxxx...',
  p_content       => 'ข้อความ',
  p_message_type  => 'text',      -- text | image | carousel | sticker | video
  p_raw_event     => '{}',        -- JSON ดิบ
  p_received_at   => NOW()        -- timestamp (optional)
);
```

---

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx          # Main dashboard layout
│   │   ├── NotificationBell.tsx   # Real-time notification
│   │   └── tabs/
│   │       ├── CustomersTab.tsx   # จัดการลูกค้า + chat
│   │       ├── TasksTab.tsx       # จัดการ task
│   │       ├── TeamsTab.tsx       # จัดการทีม
│   │       └── SettingsTab.tsx    # ตั้งค่า
│   ├── hooks/
│   │   └── useAuth.tsx            # Auth hook
│   └── routes/
│       ├── index.tsx              # Dashboard route
│       └── auth.tsx               # Login/Register
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   ├── line-webhook/
│   │   ├── botnoi-reply/
│   │   ├── bot-message/
│   │   └── mcp-bot-message/
│   └── migrations/
└── README.md
```

---

## Scripts

```bash
npm run dev        # Development server
npm run build      # Production build
npm run lint       # ESLint
npm run format     # Prettier
```
