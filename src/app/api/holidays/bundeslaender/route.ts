import { NextResponse } from "next/server";
import { BUNDESLAENDER } from "@/lib/holidays";
import { withRoute } from "@/lib/with-route";

/**
 * GET /api/holidays/bundeslaender
 * Returns all 16 German Bundesländer.
 */
export const GET = withRoute(
  "/api/holidays/bundeslaender",
  "GET",
  async (req) => {
    const list = Object.entries(BUNDESLAENDER).map(([code, name]) => ({
      code,
      name,
    }));

    return NextResponse.json(list);
  },
);
