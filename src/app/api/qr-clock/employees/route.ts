import { NextResponse } from "next/server";
// This endpoint was removed for DSGVO compliance — employee data is no longer
// sent to the client. Identity verification happens server-side via PIN only.
export const GET = () =>
  NextResponse.json({ error: "ENDPOINT_REMOVED" }, { status: 410 });
