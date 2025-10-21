import { getRagieClient } from "@/lib/server/utils";
import { ALLOWED_ORIGINS } from "@/lib/server/settings";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ragie = getRagieClient();

const payloadSchema = z.object({
  message: z.string().min(1).max(10000),
  partition: z.string().min(1),
  topK: z.number().int().min(1).max(100),
  rerank: z.boolean(),
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

    return NextResponse.json({
      retrievalResponse: ragieResponse,
    }, {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error in search route:", error);

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
        error: "Failed to search",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
