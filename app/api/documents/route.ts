import { getRagieClient } from "@/lib/server/utils";
import { NextResponse } from "next/server";

const ragie = getRagieClient();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET() {
  try {
    // List all documents in Ragie
    const documents = await ragie.documents.list();

    return NextResponse.json({
      documents: documents,
      count: documents.length,
    }, {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error listing documents:", error);
    return NextResponse.json({
      error: "Failed to list documents",
      message: error instanceof Error ? error.message : "Unknown error"
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}
