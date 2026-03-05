import { getRagieClient } from "@/lib/server/utils";
import {
  OPENROUTER_API_KEY,
} from "@/lib/server/settings";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/prompts";
import Anthropic from "@anthropic-ai/sdk";
import Handlebars from "handlebars";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const ragie = getRagieClient();
const anthropic = new Anthropic();

const ANTHROPIC_MODEL = "claude-sonnet-4-6-20250514";

const payloadSchema = z.object({
  message: z.string(),
  partition: z.string(),
  topK: z.number(),
  rerank: z.boolean().optional(),
  systemPrompt: z.string().optional(),
  provider: z.enum(["anthropic", "openrouter"]),
  openrouterModel: z.string(),
  ciudad: z.string().optional(),
  tipoConsumidor: z.string().optional(),
  maxChunksPerDocument: z.number().optional(),
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const payload = payloadSchema.parse(json);

  // Build metadata filter from ciudad/tipoConsumidor (Ragie uses MongoDB-style filters)
  const conditions: Record<string, any>[] = [];
  if (payload.ciudad) {
    conditions.push({ ciudad: payload.ciudad });
  }
  if (payload.tipoConsumidor) {
    conditions.push({ tipo_consumidor: payload.tipoConsumidor });
  }
  const filter = conditions.length > 0
    ? conditions.length === 1
      ? conditions[0]
      : { $and: conditions }
    : undefined;

  // Fetch more chunks than requested so we can diversify across documents
  const maxChunksPerDocument = payload.maxChunksPerDocument ?? 0;
  const fetchTopK = maxChunksPerDocument > 0 ? Math.min(payload.topK * 3, 100) : payload.topK;

  const ragieResponse = await ragie.retrievals.retrieve({
    query: payload.message,
    partition: payload.partition,
    topK: fetchTopK,
    rerank: false,
    filter,
  });

  // Diversify: limit chunks per document to spread across more videos
  if (maxChunksPerDocument > 0) {
    const countByDoc: Record<string, number> = {};
    ragieResponse.scoredChunks = ragieResponse.scoredChunks.filter((chunk) => {
      const docId = chunk.documentId;
      countByDoc[docId] = (countByDoc[docId] || 0) + 1;
      return countByDoc[docId] <= maxChunksPerDocument;
    }).slice(0, payload.topK);
  }

  // ALWAYS use the server's DEFAULT_SYSTEM_PROMPT, ignore client's systemPrompt
  // This ensures consistent behavior regardless of what the client sends
  const compiled = Handlebars.compile(DEFAULT_SYSTEM_PROMPT);
  const systemPromptContent = compiled({
    now: new Date().toISOString(),
  });

  let modelResponse;

  // Always use Anthropic unless explicitly set to openrouter AND key is available
  if (payload.provider === "openrouter" && OPENROUTER_API_KEY) {
    const openrouter = createOpenRouter({
      apiKey: OPENROUTER_API_KEY,
    });

    const documentContext = ragieResponse.scoredChunks
      .map((chunk) => `Document: ${chunk.documentName}\n${chunk.text}`)
      .join("\n\n");

    const messages = [
      { role: "system" as const, content: systemPromptContent },
      {
        role: "user" as const,
        content: `${documentContext}\n\nUser Query: ${payload.message}`,
      },
    ];

    try {
      const { text, usage } = await generateText({
        model: openrouter(payload.openrouterModel!),
        messages: messages,
        maxTokens: 4000,
      });

      modelResponse = {
        id: `openrouter-${Date.now()}`,
        type: "message",
        role: "assistant",
        model: payload.openrouterModel,
        content: [{ type: "text", text: text }],
        usage: {
          input_tokens: usage.promptTokens,
          output_tokens: usage.completionTokens,
        },
      };
    } catch (error) {
      console.error("OpenRouter API error:", error);
      return NextResponse.json(
        { error: "Failed to fetch from OpenRouter" },
        { status: 500, headers: corsHeaders }
      );
    }
  } else {
    // Default to Anthropic with citations enabled
    try {
      const anthropicResponse = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: systemPromptContent,
          },
          {
            role: "user",
            content: ragieResponse.scoredChunks.map((chunk) => ({
              type: "document" as const,
              source: {
                type: "text" as const,
                media_type: "text/plain",
                data: chunk.text,
              },
              title: chunk.documentName,
              citations: { enabled: true },
            })),
          },
          {
            role: "user",
            content: payload.message,
          },
        ],
      });
      modelResponse = anthropicResponse;
    } catch (error) {
      console.error("Anthropic API error:", error);
      const message = error instanceof Error ? error.message : "Unknown Anthropic error";
      return NextResponse.json(
        { error: `Anthropic API failed: ${message}` },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return NextResponse.json(
    {
      modelResponse: modelResponse,
      retrievalResponse: ragieResponse,
    },
    { headers: corsHeaders }
  );
}
