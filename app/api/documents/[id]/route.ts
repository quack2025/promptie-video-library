import { getRagieClient } from "@/lib/server/utils";
import { ALLOWED_ORIGINS } from "@/lib/server/settings";
import { NextRequest, NextResponse } from "next/server";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate document ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400, headers: corsHeaders }
      );
    }

    const ragie = getRagieClient();
    const summary = await ragie.documents.getSummary({ documentId: id });
    return NextResponse.json(summary, { headers: corsHeaders });
  } catch (error) {
    console.error("Error fetching document summary:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch document summary",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
