import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/notifications/email";

const TECHNICAL_INBOX =
  process.env.FEEDBACK_EMAIL_TECHNICAL ?? "omarragehfulda@gmail.com";
const PRODUCT_INBOX =
  process.env.FEEDBACK_EMAIL_PRODUCT ?? "info@bashabsheh-vergabepartner.de";

const TECHNICAL_CATEGORIES = new Set(["BUG", "QUESTION"]);

const CATEGORY_LABELS: Record<string, string> = {
  BUG: "Fehler",
  FEATURE: "Funktionswunsch",
  QUESTION: "Frage",
  OTHER: "Sonstiges",
};

const bodySchema = z.object({
  category: z.enum(["BUG", "FEATURE", "QUESTION", "OTHER"]),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
  url: z.string().max(500).optional(),
});

/**
 * POST /api/feedback
 * Receives in-app bug reports / feature requests from the floating widget.
 * Persisted to the Feedback table for later triage by the support team.
 */
export const POST = withRoute("/api/feedback", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  await prisma.feedback.create({
    data: {
      workspaceId,
      userId: user.id,
      category: parsed.data.category,
      subject: parsed.data.subject,
      message: parsed.data.message,
      url: parsed.data.url ?? null,
      userAgent,
    },
  });

  log.info("[Feedback] new submission", {
    workspaceId,
    userId: user.id,
    category: parsed.data.category,
  });

  const categoryLabel =
    CATEGORY_LABELS[parsed.data.category] ?? parsed.data.category;
  const inbox = TECHNICAL_CATEGORIES.has(parsed.data.category)
    ? TECHNICAL_INBOX
    : PRODUCT_INBOX;
  const pageNote = parsed.data.url ? `\n\nSeite: ${parsed.data.url}` : "";

  sendEmail({
    to: inbox,
    type: "feedback",
    title: `[${categoryLabel}] ${parsed.data.subject}`,
    message: `${parsed.data.message}${pageNote}\n\nWorkspace: ${workspaceId}\nUser: ${user.id}`,
  }).catch((err) => log.error("[Feedback] email delivery failed", { err }));

  return NextResponse.json({ success: true });
});
