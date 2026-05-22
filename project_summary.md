# 📋 สรุปงานทั้งหมด — Botnoid CRM Dashboard

> Project: `d:\Code\Botnoid\dashboard line oa`  
> Supabase Project: `yrqcmnbeohtwfppxsitz`  
> อัปเดตล่าสุด: 2026-05-21

---

## 🏗️ ภาพรวมระบบ (Architecture)

```
[ลูกค้า] → LINE OA → [LINE Servers]
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
           [line-webhook]      [mcp-bot-message]
           Edge Function        Edge Function
           (รับข้อความจาก        (รับข้อความจาก
            ลูกค้า → DB)          Botnoi AI → DB)
                    │                 │
                    └────────┬────────┘
                             ▼
                    [Supabase Database]
                    table: messages
                    table: customers
                             │
                             ▼
                    [CRM Web Dashboard]
                    (React + TanStack)
                    แสดงแชทแบบ Realtime
```

---

## ✅ สิ่งที่ทำเสร็จแล้ว

### 1. Frontend — หน้า CRM Dashboard

| ส่วน | รายละเอียด | สถานะ |
|------|-----------|-------|
| หน้าลูกค้า (CustomersTab) | แสดงรายชื่อลูกค้า + ห้องแชท | ✅ ทำงาน |
| แสดงข้อความ | แยกซ้าย (ลูกค้า) / ขวา (บอท+เจ้าหน้าที่) | ✅ ทำงาน |
| Realtime | รับข้อความใหม่ทันทีผ่าน Supabase Realtime | ✅ ทำงาน |
| ส่งข้อความจาก Dashboard | เจ้าหน้าที่พิมพ์ตอบลูกค้าผ่านเว็บ | ✅ ทำงาน |
| แท็กลูกค้า / หมายเหตุ | เพิ่ม/ลบแท็ก, บันทึก notes | ✅ ทำงาน |
| มอบหมายงาน (Assign) | กำหนดผู้รับผิดชอบลูกค้า | ✅ ทำงาน |
| สร้าง Task จากลูกค้า | สร้างงานจากหน้าแชท | ✅ ทำงาน |

**Logic การแสดงข้อความในห้องแชท:**
```typescript
// CustomersTab.tsx บรรทัด 513
const isAgent = m.source === "agent" || m.source === "bot";
// → ถ้า source = "agent" หรือ "bot" → แสดงฝั่งขวา (สีเขียว)
// → ถ้า source = "line"             → แสดงฝั่งซ้าย (ลูกค้า)
```

---

### 2. Backend — Supabase Edge Functions

#### `line-webhook` — รับข้อความจากลูกค้า
- **URL:** `POST https://yrqcmnbeohtwfppxsitz.supabase.co/functions/v1/line-webhook`
- **ทำหน้าที่:** LINE Server ยิง Webhook มาเมื่อลูกค้าส่งข้อความ
- **Flow:** รับ event → ตรวจ Signature → Upsert customer → Insert message (`source = 'line'`)
- **สถานะ:** ✅ ทำงานได้ปกติ — บันทึกข้อความลูกค้าลง DB สำเร็จ

#### `mcp-bot-message` — รับข้อความจาก Botnoi AI (MCP)
- **URL:** `POST https://yrqcmnbeohtwfppxsitz.supabase.co/functions/v1/mcp-bot-message`
- **ทำหน้าที่:** Botnoi AI เรียก Tool `insert_bot_message` เมื่อบอทตอบลูกค้า
- **Protocol:** JSON-RPC 2.0 (MCP Standard)
- **Tool ที่ให้บริการ:** `insert_bot_message(line_user_id, content)`
- **สถานะ:** ⚠️ Deploy แล้ว — รอยืนยันผลหลังแก้ Botnoi config

#### `bot-message` — HTTP endpoint สำรอง
- **URL:** `POST https://yrqcmnbeohtwfppxsitz.supabase.co/functions/v1/bot-message`
- **ทำหน้าที่:** รองรับการยิง HTTP POST ธรรมดา (ไม่ใช้ MCP)
- **สถานะ:** ✅ Deploy แล้ว (อยู่ใน Debug Mode)

---

### 3. Database — Supabase

#### Tables หลัก
| Table | ข้อมูลที่เก็บ |
|-------|-------------|
| `customers` | ข้อมูลลูกค้า LINE (line_user_id, display_name, tags, notes, assigned_to) |
| `messages` | ข้อความทั้งหมด (content, source, customer_id, received_at) |
| `profiles` | ข้อมูลเจ้าหน้าที่ที่ Login |
| `tasks` | งานที่สร้างจากลูกค้า |
| `teams` / `team_members` | ทีมและสมาชิก |

#### SQL Function (RPC)
```sql
-- insert_bot_message(p_line_user_id, p_content, p_message_type)
-- ค้นหา customer จาก line_user_id → บันทึก message (source = 'bot')
-- มี fallback: ถ้า line_user_id เป็นค่า dummy → ดึงลูกค้ารายล่าสุดแทน
```
**Migrations ที่รัน:**
- `20260521000001` — สร้าง `insert_bot_message` RPC ครั้งแรก
- `20260521000002` — แก้ไข parameter (เปลี่ยนเป็น 3 params)
- `20260521000003` — เพิ่ม Fallback สำหรับ dummy ID

---

### 4. Botnoi MCP Configuration

| ฟิลด์ | ค่า |
|-------|-----|
| ชื่อ MCP | `bot-message-crm-v3` |
| MCP Server URL | `https://yrqcmnbeohtwfppxsitz.supabase.co/functions/v1/mcp-bot-message` |
| Header Key | `Authorization` |
| Header Value | `Bearer sb_publishable_rM3kXzlEU2wRCtEC23T53w_13Ut-VcA` |

---

## 🔍 การแก้ไขปัญหา (Debug History)

### ปัญหา: ข้อความบอทไม่ขึ้นในเว็บ และไม่มีในฐานข้อมูล

| ขั้นตอน | สิ่งที่ค้นพบ | วิธีแก้ |
|---------|------------|---------|
| 1 | ข้อความลูกค้า (`source='line'`) บันทึกได้ปกติ | — |
| 2 | ข้อความบอทไม่มีใน DB เลย | ต้องให้ Botnoi ยิงมาที่ MCP |
| 3 | Log ของ `mcp-bot-message` ว่างสนิท → ไม่มี request มาถึงเลย | สงสัย Supabase Gateway block |
| 4 | ตรวจพบ: Botnoi ส่ง `Bearer sb_secret_pls000...` ซึ่งไม่ใช่คีย์ที่ Supabase รู้จัก | เปลี่ยน Header เป็น Publishable Key |
| 5 | ถอด Auth guard ออก (Debug Mode) ใน `mcp-bot-message` และ `bot-message` | Deploy ขึ้น Supabase แล้ว |
| 6 | อัปเดต Header ใน Botnoi เป็น `Bearer sb_publishable_rM3kXzlEU2wRCtEC23T53w_13Ut-VcA` | ✅ ทำแล้ว รอทดสอบ |

---

## 🚦 สถานะปัจจุบัน

| ส่วน | สถานะ | หมายเหตุ |
|------|-------|---------|
| ลูกค้าส่งข้อความ → ขึ้นเว็บ | ✅ ทำงาน | `source = 'line'` |
| เจ้าหน้าที่ตอบจาก Dashboard → บันทึก + ขึ้นเว็บ | ✅ ทำงาน | `source = 'agent'` |
| บอท Botnoi ตอบ → บันทึก + ขึ้นเว็บ | ⏳ รอทดสอบ | `source = 'bot'` ← ยังไม่มีในDB |

---

## 📌 สิ่งที่ต้องทำต่อ (Next Steps)

1. **[ทดสอบ]** ทักแชท LINE OA → ดูว่าข้อความบอทขึ้นในเว็บ CRM หรือไม่
2. **[ถ้าสำเร็จ]** ปิด Debug Mode กลับมาตรวจ Auth จริง เพื่อความปลอดภัย
3. **[Optional]** เพิ่ม Parameter `X-Line-User-Id: <<customer_id>>` ใน Botnoi เพื่อให้บอทส่ง LINE User ID ที่ถูกต้องทุกครั้ง

---

## 🔑 ข้อมูลสำคัญ

| รายการ | ค่า |
|--------|-----|
| Supabase Project URL | `https://yrqcmnbeohtwfppxsitz.supabase.co` |
| Publishable Key (Anon Key) | `sb_publishable_rM3kXzlEU2wRCtEC23T53w_13Ut-VcA` |
| MCP Endpoint | `.../functions/v1/mcp-bot-message` |
| LINE Webhook | `.../functions/v1/line-webhook` |
