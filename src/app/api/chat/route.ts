import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { jsonSchema } from "@ai-sdk/provider-utils";
import { google } from "@ai-sdk/google";
import { searchSimilarChunks, buildContext, type SearchResult } from "@/lib/rag";
import { rewriteQuery } from "@/lib/query-rewrite";
import { db } from "@/lib/db";
import { z } from "zod/v4";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/prompts";
import { logApiCall } from "@/lib/api-logger";

const ChatRequestSchema = z.object({
  contentId: z.string().min(1).max(100),
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(z.object({
      type: z.string(),
      text: z.string().max(10_000).optional(),
    }).passthrough()).max(20),
  }).passthrough()).min(1).max(50),
});

// In-memory rate limiter with periodic cleanup
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const CLEANUP_INTERVAL_MS = 5 * 60_000;

let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}

function extractClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function checkRateLimit(ip: string): boolean {
  cleanupExpiredEntries();
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: Request) {
  const ip = extractClientIp(req);

  if (!checkRateLimit(ip)) {
    return new Response("Хэт олон хүсэлт илгээлээ. Түр хүлээнэ үү.", { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Bad request", { status: 400 });
  }

  const { contentId } = parsed.data;
  const uiMessages = parsed.data.messages as unknown as UIMessage[];
  const modelMessages = await convertToModelMessages(uiMessages);

  const content = await db.content.findUnique({
    where: { id: contentId, isProcessed: true },
    select: { id: true, title: true, systemPrompt: true },
  });

  if (!content) {
    return new Response("Not found", { status: 404 });
  }

  // Get user query + rewrite for better RAG retrieval
  const lastUserMsg = [...uiMessages].reverse().find((m) => m.role === "user");
  let context = "";
  let ragChunks: SearchResult[] = [];
  let userQuery = "";
  let rewrittenQuery = "";

  if (lastUserMsg) {
    userQuery = lastUserMsg.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ") ?? "";

    if (userQuery) {
      // Query rewriting for short/vague queries
      rewrittenQuery = await rewriteQuery(userQuery, content.title);
      ragChunks = await searchSimilarChunks(contentId, rewrittenQuery, 5);
      context = buildContext(ragChunks);
    }
  }

  const basePrompt = content.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = basePrompt.includes("{context}")
    ? basePrompt.replace("{context}", context || "Контекст олдсонгүй.")
    : `${basePrompt}\n\nКОНТЕКСТ:\n${context || "Контекст олдсонгүй."}`;

  const streamResult = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      searchContent: {
        description: "Контентоос нэмэлт мэдээлэл хайх. Хэрэв өгөгдсөн контекстод хариулт олдохгүй бол энэ tool ашиглана.",
        inputSchema: jsonSchema<{ query: string }>({
          type: "object",
          properties: {
            query: { type: "string", description: "Хайх асуулт" },
          },
          required: ["query"],
        }),
        execute: async ({ query }: { query: string }) => {
          const additional = await searchSimilarChunks(contentId, query, 3);
          ragChunks.push(...additional);
          return buildContext(additional) || "Нэмэлт мэдээлэл олдсонгүй.";
        },
      },
    },
    toolChoice: "auto",
    onFinish({ usage }) {
      logApiCall({
        type: "chat",
        model: "gemini-2.5-flash",
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        contentId,
        metadata: {
          chunkCount: ragChunks.length,
          similarities: ragChunks.slice(0, 5).map((c) => +c.similarity.toFixed(3)),
          query: userQuery.slice(0, 200),
          rewrittenQuery: rewrittenQuery !== userQuery ? rewrittenQuery.slice(0, 200) : undefined,
        },
      });
    },
  });

  return streamResult.toUIMessageStreamResponse();
}
