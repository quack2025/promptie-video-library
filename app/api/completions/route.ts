import { getRagieClient } from "@/lib/server/utils";
import {
  OPENROUTER_API_KEY,
  ALLOWED_ORIGINS,
} from "@/lib/server/settings";
import Anthropic from "@anthropic-ai/sdk";
import Handlebars from "handlebars";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const ragie = getRagieClient();
const anthropic = new Anthropic();

const payloadSchema = z.object({
  message: z.string().min(1).max(10000),
  partition: z.string().min(1),
  topK: z.number().int().min(1).max(100),
  rerank: z.boolean(),
  systemPrompt: z.string(),
  provider: z.enum(["anthropic", "openrouter"]),
  openrouterModel: z.string(),
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS,
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
  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);

    const ragieResponse = await ragie.retrievals.retrieve({
      query: payload.message,
      partition: payload.partition,
      topK: payload.topK,
      rerank: payload.rerank,
    });

  const compiled = Handlebars.compile(payload.systemPrompt);

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
      // Default to Anthropic
      const anthropicResponse = await anthropic.messages.create({
        model: "claude-3-7-sonnet-latest",
        max_tokens: 1000,
        messages: [
          {
            role: "user", // Anthropic typically starts with a user role for system-like prompts
            content: systemPromptContent,
          },
          {
            role: "user", // Or assistant, depending on how you structure conversation for Anthropic
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
    }

    return NextResponse.json({
      modelResponse: modelResponse,
      retrievalResponse: ragieResponse,
    }, {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error in completions route:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400, headers: corsHeaders }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        error: "Failed to generate completion",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
