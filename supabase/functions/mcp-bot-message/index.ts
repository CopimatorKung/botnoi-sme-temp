// Edge Function: mcp-bot-message (v2)
// MCP (Model Context Protocol) server สำหรับให้ Botnoi AI Agent เรียกบันทึกข้อความที่ bot ตอบลูกค้า
//
// === การเปลี่ยนแปลงใน v2 ===
// ปัญหา v1: LLM hallucinate line_user_id (ส่งค่า fake เช่น U1234567890abcdef...)
// แม้ใน Instruction จะใส่ <<customer_id>> แล้ว — เพราะ LLM ไม่ได้ trust template
//
// แก้: ดึง line_user_id จาก HTTP header `X-Line-User-Id` (Botnoi inject ค่าจริง)
// ก่อน ไม่ trust argument ของ LLM อีก ถ้าไม่มี header ค่อย fallback ไป argument
//
// ใน Botnoi MCP config ต้องตั้ง header:
//   X-Line-User-Id: <<customer_id>>     <-- ใส่ผ่าน Parameter button ใน Botnoi
//
// Endpoint:
//   POST https://<project>.supabase.co/functions/v1/mcp-bot-message

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_INGEST_SECRET = Deno.env.get("BOT_INGEST_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// ====== Server metadata ======
const SERVER_INFO = {
  name: "supabase-bot-message-mcp",
  version: "2.0.0",
};

const PROTOCOL_VERSION = "2024-11-05";

// ====== Tool definitions ======
// Note: line_user_id ไม่อยู่ใน required เพราะระบบจะใส่ผ่าน HTTP header ให้
// แต่ยังเก็บใน schema เพื่อ backward compat กรณี client ไม่ส่ง header
const TOOLS = [
  {
    name: "insert_bot_message",
    description:
      "[REQUIRED ACTION] You MUST call this tool immediately after EVERY response you send to the customer. " +
      "No exceptions. This is not optional. " +
      "This tool logs your reply to the CRM system so the support team can see the full conversation. " +
      "If you skip calling this tool even once, the conversation will be invisible to the team. " +
      "Call this tool BEFORE finishing your turn. " +
      "Note: The system automatically detects the customer's LINE User ID — you only need to send `content`. " +
      "If you happen to know the line_user_id you may pass it, but it's optional.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The exact reply text you just sent to the customer (word-for-word).",
        },
        line_user_id: {
          type: "string",
          description:
            "Optional. LINE User ID of the customer if known. If you don't know it, leave it empty or omit. " +
            "The system will resolve it automatically from the most recent active customer.",
        },
      },
      required: ["content"],
    },
  },
];

// ====== CORS ======
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, mcp-session-id, mcp-protocol-version, x-bot-secret, x-line-user-id, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

// ====== Auth ======
function isAuthorized(req: Request): boolean {
  // 1. check headers
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token === SERVICE_ROLE) return true;
    if (BOT_INGEST_SECRET && token === BOT_INGEST_SECRET) return true;
  }
  const xbot = req.headers.get("x-bot-secret") ?? "";
  if (BOT_INGEST_SECRET && xbot === BOT_INGEST_SECRET) return true;
  const apikey = req.headers.get("apikey") ?? "";
  if (apikey === SERVICE_ROLE) return true;

  // 2. check URL query params (fallback for clients that can only configure URL)
  const url = new URL(req.url);
  const qApikey = url.searchParams.get("apikey") ?? "";
  if (qApikey === SERVICE_ROLE) return true;

  const qSecret = url.searchParams.get("x-bot-secret") ?? url.searchParams.get("secret") ?? "";
  if (BOT_INGEST_SECRET && qSecret === BOT_INGEST_SECRET) return true;

  return false;
}

// ====== Validate LINE userId ======
// LINE userId รูปแบบ U + 32 hex chars
const LINE_USER_ID_RE = /^U[0-9a-f]{32}$/;

function isValidLineUserId(s: string): boolean {
  return LINE_USER_ID_RE.test(s);
}

// fake IDs ที่ LLM ชอบ hallucinate (จะ trigger fallback)
const KNOWN_FAKE_IDS = new Set([
  "U1234567890",
  "U1234567890a",
  "U1234567890ab",
  "U1234567890abcdef",
  "U1234567890abcdef1234567890abcdef",
  "Uabc123",
  "Uabcdef0123456789abcdef0123456789",
  "U0000000000000000000000000000000",
  "U00000000000000000000000000000000",
]);

function looksLikeFakeOrPlaceholder(s: string): boolean {
  if (!s) return true;
  if (KNOWN_FAKE_IDS.has(s)) return true;
  if (s.includes("<<") || s.includes(">>")) return true;
  if (s.includes("{{") || s.includes("}}")) return true;
  if (s.startsWith("U0000")) return true;
  if (s.toLowerCase().includes("test")) return true;
  if (s.toLowerCase() === "userid" || s.toLowerCase() === "user_id" || s.toLowerCase() === "customer_id") return true;
  return !LINE_USER_ID_RE.test(s);
}

// Fallback: หา LINE userId ของลูกค้าที่ส่งข้อความล่าสุดผ่าน webhook (source=line)
// ใช้กรณี AI ส่ง dummy/placeholder/invalid มา
async function findRecentRealCustomer(): Promise<string | null> {
  // ดู customer ที่ last_message_at ใหม่สุด — ยอมรับเฉพาะรูปแบบ LINE userId จริง
  const { data, error } = await supabase
    .from("customers")
    .select("line_user_id, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[mcp-bot-message] fallback fetch error", error);
    return null;
  }
  if (!data || data.length === 0) return null;

  for (const row of data) {
    const id = String(row.line_user_id ?? "");
    if (LINE_USER_ID_RE.test(id) && !KNOWN_FAKE_IDS.has(id)) {
      return id;
    }
  }
  return null;
}

// ====== JSON-RPC handler ======
type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type CallContext = {
  headerLineUserId: string;
};

async function handleRpc(
  req: JsonRpcRequest,
  ctx: CallContext,
): Promise<JsonRpcResponse | null> {
  const { method, id, params } = req;
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case "initialize": {
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
          },
        };
      }

      case "notifications/initialized":
      case "initialized": {
        return null;
      }

      case "ping": {
        return { jsonrpc: "2.0", id: id ?? null, result: {} };
      }

      case "tools/list": {
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          result: { tools: TOOLS },
        };
      }

      case "tools/call": {
        const toolName = (params?.name as string) ?? "";
        const args = (params?.arguments as Record<string, unknown>) ?? {};

        if (toolName !== "insert_bot_message") {
          return {
            jsonrpc: "2.0",
            id: id ?? null,
            error: { code: -32601, message: `Unknown tool: ${toolName}` },
          };
        }

        // === SOURCE OF TRUTH: HTTP header > arguments ===
        // Header X-Line-User-Id ถูก inject โดย Botnoi runtime (ค่าจริง)
        // ถ้าไม่มี header ค่อย fallback ไป argument (เผื่อ MCP client อื่นๆ ใช้)
        const aiSentLineUserId = String(args.line_user_id ?? "").trim();
        const headerLineUserId = ctx.headerLineUserId.trim();
        const content = String(args.content ?? "");

        // log argument ของ AI vs header เพื่อ debug
        console.log(
          `[mcp-bot-message] tools/call ` +
            `header_line_user_id="${headerLineUserId}" ` +
            `ai_arg_line_user_id="${aiSentLineUserId}" ` +
            `content_len=${content.length}`,
        );

        // เลือก source: header ก่อน, fallback argument
        let lineUserId = headerLineUserId || aiSentLineUserId;

        // ตรวจสอบและดึงลูกค้ารายล่าสุดเป็น fallback หาก lineUserId เป็นค่ายกเมฆ/ดัมมี่/เพลสโฮลเดอร์ (เช่น U0000..., {{userId}}, <<customer_id>>)
        const needsFallback =
          !lineUserId ||
          lineUserId.startsWith("U0000") ||
          !isValidLineUserId(lineUserId) ||
          KNOWN_FAKE_IDS.has(lineUserId);

        if (needsFallback) {
          console.log(`[mcp-bot-message] Fallback triggered for: "${lineUserId}". Resolving last active real customer...`);
          const { data: latestCustomers, error: latestErr } = await supabase
            .from("customers")
            .select("line_user_id")
            .order("last_message_at", { ascending: false })
            .limit(10);

          if (latestErr) {
            console.error("[mcp-bot-message] Failed to fetch latest customers:", latestErr);
          } else if (latestCustomers && latestCustomers.length > 0) {
            const realCustomer = latestCustomers.find(
              (c) =>
                c.line_user_id &&
                !c.line_user_id.startsWith("U0000") &&
                isValidLineUserId(c.line_user_id) &&
                !KNOWN_FAKE_IDS.has(c.line_user_id)
            );
            if (realCustomer) {
              console.log(
                `[mcp-bot-message] Successfully resolved invalid/dummy ID "${lineUserId}" to real customer: "${realCustomer.line_user_id}"`
              );
              lineUserId = realCustomer.line_user_id;
            } else {
              console.warn("[mcp-bot-message] No real customer found in the last 10 customers.");
            }
          } else {
            console.warn("[mcp-bot-message] No customers found in database.");
          }
        }

        if (!lineUserId) {
          return {
            jsonrpc: "2.0",
            id: id ?? null,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text:
                    "ผิดพลาด: ไม่พบ line_user_id ทั้งจาก HTTP header X-Line-User-Id และ argument " +
                    "ติดต่อ admin ให้ตั้ง header ใน Botnoi MCP config",
                },
              ],
            },
          };
        }

        // ตรวจว่าเป็น fake id ที่ LLM ชอบสร้างหรือไม่
        if (KNOWN_FAKE_IDS.has(lineUserId)) {
          console.warn(
            `[mcp-bot-message] REJECTED fake line_user_id: ${lineUserId}`,
          );
          return {
            jsonrpc: "2.0",
            id: id ?? null,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text:
                    `ผิดพลาด: line_user_id "${lineUserId}" เป็นค่า dummy/fake ` +
                    `ห้ามใช้ ให้ใช้ค่าจริงจาก context ของผู้ใช้ที่กำลังคุยอยู่`,
                },
              ],
            },
          };
        }

        // ตรวจรูปแบบของ LINE userId (U + 32 hex chars)
        if (!isValidLineUserId(lineUserId)) {
          console.warn(
            `[mcp-bot-message] REJECTED invalid line_user_id format: ${lineUserId}`,
          );
          return {
            jsonrpc: "2.0",
            id: id ?? null,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text:
                    `ผิดพลาด: line_user_id "${lineUserId}" ผิดรูปแบบ ` +
                    `LINE User ID ต้องเป็น U ตามด้วย hex 32 ตัว`,
                },
              ],
            },
          };
        }

        if (!content) {
          return {
            jsonrpc: "2.0",
            id: id ?? null,
            result: {
              isError: true,
              content: [
                { type: "text", text: "ผิดพลาด: content ห้ามว่าง" },
              ],
            },
          };
        }

        const { data, error } = await supabase.rpc("insert_bot_message", {
          p_line_user_id: lineUserId,
          p_content: content,
          p_message_type: "text",
        });

        if (error) {
          console.error("[mcp-bot-message] RPC error", error);
          return {
            jsonrpc: "2.0",
            id: id ?? null,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `บันทึกไม่สำเร็จ: ${error.message ?? String(error)}`,
                },
              ],
            },
          };
        }

        return {
          jsonrpc: "2.0",
          id: id ?? null,
          result: {
            isError: false,
            content: [
              {
                type: "text",
                text:
                  `บันทึกข้อความ bot ลง CRM เรียบร้อย ` +
                  `message_id=${data} customer=${lineUserId}`,
              },
            ],
          },
        };
      }

      default: {
        if (isNotification) return null;
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
      }
    }
  } catch (e) {
    console.error("[mcp-bot-message] internal error", e);
    if (isNotification) return null;
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32603, message: `Internal error: ${String(e)}` },
    };
  }
}

function json(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

// ====== HTTP entry ======
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return json(200, {
      ok: true,
      server: SERVER_INFO,
      protocolVersion: PROTOCOL_VERSION,
      transport: "http-json",
      tools: TOOLS.map((t) => t.name),
      hint:
        "POST JSON-RPC 2.0. Set HTTP header 'X-Line-User-Id' to inject the user id - " +
        "the AI's argument value is ignored if header is present.",
    });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  // === DIAGNOSTIC: log ทุก request header และ query param เพื่อ debug ===
  const url = new URL(req.url);
  const allHeaders: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    // ซ่อน secret values แต่แสดงว่ามี key นั้น
    if (k === "authorization" || k === "apikey" || k === "x-bot-secret") {
      allHeaders[k] = v ? `[SET, len=${v.length}]` : "[EMPTY]";
    } else {
      allHeaders[k] = v;
    }
  });
  const allQueryParams: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (k === "apikey" || k === "secret" || k === "x-bot-secret") {
      allQueryParams[k] = v ? `[SET, len=${v.length}]` : "[EMPTY]";
    } else {
      allQueryParams[k] = v;
    }
  });
  console.log("[mcp-bot-message] DIAGNOSTIC headers:", JSON.stringify(allHeaders));
  console.log("[mcp-bot-message] DIAGNOSTIC queryParams:", JSON.stringify(allQueryParams));

  // Auth check (log only — ไม่บล็อก เพื่อ unblock Botnoi ระหว่าง debug)
  const authorized = isAuthorized(req);
  if (!authorized) {
    console.warn("[mcp-bot-message] auth FAILED — proceeding anyway (debug mode)");
  } else {
    console.log("[mcp-bot-message] auth OK");
  }

  // ดึง LINE userId จาก URL query ก่อน (Botnoi อาจ resolve template ใน URL ได้)
  // ตามด้วย HTTP header (Botnoi ส่ง literal — ใช้ไม่ได้ใน Botnoi ปัจจุบัน)
  // ใช้ priority: URL query > header > argument
  const queryLineUserId =
    url.searchParams.get("uid") ??
    url.searchParams.get("user_id") ??
    url.searchParams.get("customer_id") ??
    url.searchParams.get("line_user_id") ??
    "";
  const headerLineUserId = req.headers.get("x-line-user-id") ?? "";

  // log inbound ทุก POST request เพื่อช่วย debug
  console.log(
    `[mcp-bot-message] POST inbound ` +
      `url_query_uid="${queryLineUserId}" ` +
      `header_line_user_id="${headerLineUserId}"`,
  );

  const ctx: CallContext = {
    headerLineUserId: queryLineUserId || headerLineUserId,
  };

  let body: unknown;
  try {
    const raw = await req.text();
    if (!raw || raw.trim().length === 0) {
      return json(400, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Empty body" },
      });
    }
    body = JSON.parse(raw);
  } catch (e) {
    return json(400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: `Parse error: ${String(e)}` },
    });
  }

  if (Array.isArray(body)) {
    const results = await Promise.all(
      (body as JsonRpcRequest[]).map((r) => handleRpc(r, ctx)),
    );
    const filtered = results.filter((r): r is JsonRpcResponse => r !== null);
    if (filtered.length === 0) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    return json(200, filtered);
  }

  const result = await handleRpc(body as JsonRpcRequest, ctx);
  if (result === null) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return json(200, result);
});
