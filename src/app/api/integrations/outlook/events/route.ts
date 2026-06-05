/**
 * GET /api/integrations/outlook/events?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns the current user's Outlook calendar events for the given window,
 * normalized for the frontend. `end` is treated as inclusive (the whole day),
 * so start === end returns that single day's events.
 *
 * Status codes the UI relies on:
 *   200 → { events: [...] }
 *   409 → { connected: false }   (never linked Outlook)
 *   409 → { reauthRequired: true } (refresh token revoked → reconnect)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { parseDateQueryParam } from "@/lib/validations";
import {
  fetchOutlookEvents,
  OutlookNotConnectedError,
  OutlookReauthRequiredError,
  OutlookApiError,
} from "@/lib/outlook";

export const GET = withRoute(
  "/api/integrations/outlook/events",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const startResult = parseDateQueryParam(searchParams.get("start"), "start");
    if (!startResult.ok) return startResult.response;
    const endResult = parseDateQueryParam(searchParams.get("end"), "end");
    if (!endResult.ok) return endResult.response;

    // Treat `end` as inclusive: extend to the end of that day so a single-day
    // request (start === end) yields a valid, non-empty window for Graph.
    const start = startResult.date;
    const endExclusive = new Date(endResult.date);
    endExclusive.setHours(23, 59, 59, 999);

    try {
      const events = await fetchOutlookEvents(user.id, start, endExclusive);
      return NextResponse.json({ events });
    } catch (err) {
      if (err instanceof OutlookNotConnectedError) {
        return NextResponse.json({ connected: false }, { status: 409 });
      }
      if (err instanceof OutlookReauthRequiredError) {
        return NextResponse.json({ reauthRequired: true }, { status: 409 });
      }
      if (err instanceof OutlookApiError) {
        return NextResponse.json(
          { error: "outlook_api_error" },
          { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
        );
      }
      throw err;
    }
  },
);
