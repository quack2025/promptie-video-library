import { getRagieClient } from "@/lib/server/utils";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ragie = getRagieClient();

const payloadSchema = z.object({
  message: z.string(),
  partition: z.string(),
  topK: z.number(),
  rerank: z.boolean(),
  ciudad: z.string().optional(),
  tipoConsumidor: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json();
  const payload = payloadSchema.parse(json);

  // Build metadata filter (Ragie uses MongoDB-style filters)
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
    rerank: payload.rerank,
    filter,
  });

  return NextResponse.json({
    retrievalResponse: ragieResponse,
  });
}
