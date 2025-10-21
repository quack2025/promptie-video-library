import { RAGIE_API_BASE_URL, ALLOWED_ORIGINS } from "@/lib/server/settings";
import { NextRequest } from "next/server";
import { z } from "zod";

const paramsSchema = z.object({
  partition: z.string(),
  url: z.string(),
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
  try {
    const params = paramsSchema.parse({
      partition: request.nextUrl.searchParams.get("partition"),
      url: request.nextUrl.searchParams.get("url"),
    });

    if (!params.url.startsWith(RAGIE_API_BASE_URL)) {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        }
      });
    }
    // Forward Range header if present (critical for video seeking on mobile)
    const requestHeaders: Record<string, string> = {
      authorization: `Bearer ${process.env.RAGIE_API_KEY}`,
      partition: params.partition,
    };

    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      requestHeaders['range'] = rangeHeader;
    }

    const upstreamResponse = await fetch(params.url, {
      headers: requestHeaders,
    });

    // If there's no body, bail out:
    if (!upstreamResponse.body) {
      console.error("No body in upstream response");
      return new Response("No body in upstream response", { status: 500 });
    }

    // Stream the upstream response directly back to the client preserving status, headers, etc...
    const headers = new Headers();
    headers.set("Content-Type", upstreamResponse.headers.get("Content-Type") ?? "application/octet-stream");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGINS);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Range");

    // Preserve Content-Length and Range headers for video seeking
    const contentLength = upstreamResponse.headers.get("Content-Length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    const contentRange = upstreamResponse.headers.get("Content-Range");
    if (contentRange) {
      headers.set("Content-Range", contentRange);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers,
    });
  } catch (error) {
    console.error("Error in stream route:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({
        error: "Invalid parameters",
        details: error.errors
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        }
      });
    }

    return new Response(JSON.stringify({
      error: "Error fetching stream",
      message: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      }
    });
  }
}
