import { getRagieClient } from "@/lib/server/utils";
import { NextResponse } from "next/server";

const ragie = getRagieClient();

export async function GET() {
  try {
    const names: string[] = [];
    const page = await ragie.partitions.list();
    // Each page is { result: { partitions: Partition[] } }
    for await (const p of page) {
      for (const partition of p.result.partitions) {
        if (partition.name) names.push(partition.name);
      }
    }
    names.sort();
    return NextResponse.json(names);
  } catch (error) {
    console.error("Failed to list partitions:", error);
    return NextResponse.json(["default"], { status: 200 });
  }
}
