import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ANTHROPIC_API_KEY, ALLOWED_ORIGINS } from "@/lib/server/settings";

// Input validation schema
const requestSchema = z.object({
  text: z.string().min(1).max(100000), // Max 100k chars
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
    // Parse and validate request body
    const json = await request.json();
    const { text } = requestSchema.parse(json);

    const anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      messages: [
        { role: "user", content: "Summarize the following text:\n\n" + text },
      ],
      max_tokens: 1000,
    });

    return NextResponse.json({
      summary:
        response.content[0].type === "text" ? response.content[0].text : "",
    }, {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error in chunk-summary route:", error);

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
        error: "Failed to generate summary",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
