import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/admin/pin";
import { callTool, INSTRUCTIONS, listTools } from "@/lib/passage/connector";

// The passage connector (passage-spec §6): a stateless MCP server over
// Streamable HTTP. Each POST carries JSON-RPC and gets JSON back; there are
// no sessions and no server-sent stream. Outside the admin PIN gate: the
// token in the path is the only key (PASSAGE_CONNECTOR_TOKEN).

export const maxDuration = 60;

const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

type Message = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const result = (id: Message["id"], value: unknown) => ({ jsonrpc: "2.0", id, result: value });
const failure = (id: Message["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(msg: Message, origin: string) {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return failure(msg?.id, -32600, "Invalid request");
  // A notification (no id) gets no reply.
  if (msg.id === undefined) return null;
  switch (msg.method) {
    case "initialize": {
      const asked = msg.params?.protocolVersion;
      return result(msg.id, {
        protocolVersion: typeof asked === "string" && PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "ominira", title: "Ominira library", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return result(msg.id, {});
    case "tools/list":
      return result(msg.id, { tools: listTools() });
    case "tools/call":
      return result(msg.id, await callTool(String(msg.params?.name ?? ""), msg.params?.arguments, origin));
    default:
      return failure(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

function authorised(token: string) {
  const expected = process.env.PASSAGE_CONNECTOR_TOKEN?.trim();
  return !!expected && safeEqual(token, expected);
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!authorised((await params).token)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json(failure(null, -32700, "Parse error"), { status: 400 });
  const origin = new URL(request.url).origin;
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((m: Message) => handle(m, origin)))).filter(Boolean);
    return replies.length ? NextResponse.json(replies) : new NextResponse(null, { status: 202 });
  }
  const reply = await handle(body, origin);
  return reply ? NextResponse.json(reply) : new NextResponse(null, { status: 202 });
}

/** No server-sent stream: everything is answered on POST. */
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export const DELETE = GET;
