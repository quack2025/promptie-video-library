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
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
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

  const ragieResponse = await ragie.retrievals.retrieve({
    query: payload.message,
    partition: payload.partition,
    topK: payload.topK,
    rerank: false,
    filter,
  });

  // ALWAYS use the server's DEFAULT_SYSTEM_PROMPT, ignore client's systemPrompt
  // This ensures consistent behavior regardless of what the client sends
  const compiled = Handlebars.compile(DEFAULT_SYSTEM_PROMPT);

  const systemPromptContent = compiled({
    now: new Date().toISOString(),
  });

  let modelResponse;

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
        maxTokens: 1000,
      });
      /** Don't directly set `modelResponse` to the OpenRouter response, as the
       * frontend expect a structure like that returned from an Anthropic call.
       * */
      modelResponse = {
        id: `openrouter-${Date.now()}`, // Placeholder ID
        type: "message",
        role: "assistant",
        model: payload.openrouterModel,
        content: [{ type: "text", text: text }],
        usage: {
          input_tokens: usage.promptTokens,
          output_tokens: usage.completionTokens,
        }, // Placeholder usage
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
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
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

  return NextResponse.json({
    modelResponse: modelResponse,
    retrievalResponse: ragieResponse,
  }, {
    headers: corsHeaders,
  });
}
