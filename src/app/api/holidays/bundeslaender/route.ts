import { NextResponse } from "next/server";
import { BUNDESLAENDER } from "@/lib/holidays";

/**
 * GET /api/holidays/bundeslaender
 * Returns all 16 German Bundesländer.
 */
export async function GET() {
  const list = Object.entries(BUNDESLAENDER).map(([code, name]) => ({
    code,
    name,
  }));

  return NextResponse.json(list);
}
