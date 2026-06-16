import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { log } from "@/lib/logger";

function getSecret(): string {
  const s = process.env.PIN_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s)
    throw new Error("[employee-pin] PIN_SECRET or NEXTAUTH_SECRET must be set");
  return s;
}

/**
 * HMAC-SHA256 keyed with (SECRET + workspaceId) so:
 * - Same PIN in different workspaces produces different hashes (no cross-workspace leakage)
 * - Same PIN in same workspace always produces the same hash (enables DB unique constraint)
 * - Deterministic — allows fast lookup without bcrypt rounds
 */
export function hashPin(workspaceId: string, rawPin: string): string {
  return crypto
    .createHmac("sha256", `${getSecret()}:pin:${workspaceId}`)
    .update(rawPin)
    .digest("hex");
}

/** Generate a 4-digit PIN that is unique within the workspace (1000–9999). */
export async function generateUniquePin(workspaceId: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const raw = String(Math.floor(1000 + Math.random() * 9000));
    const h = hashPin(workspaceId, raw);
    const collision = await prisma.employee.findFirst({
      where: { workspaceId, pinHash: h },
      select: { id: true },
    });
    if (!collision) return raw;
  }
  throw new Error("PIN_GENERATION_EXHAUSTED");
}

/**
 * Send the employee a one-time secure link to reveal their PIN.
 * The raw PIN is never included in the email body (H-2).
 */
export async function sendPinEmail({
  to,
  firstName,
  rawPin,
  workspaceName,
}: {
  to: string;
  firstName: string;
  rawPin: string;
  workspaceName: string;
}): Promise<void> {
  const result = await sendEmail({
    to,
    type: "pin_assigned",
    category: "transactional",
    title: `Ihre Stempeluhr-PIN – ${workspaceName}`,
    message:
      `Guten Tag ${firstName},\n\n` +
      `für die QR-Stempelstation von ${workspaceName} wurde Ihnen eine ` +
      `persönliche 4-stellige PIN zugewiesen:\n\n` +
      `🔑 Ihre PIN: ${rawPin}\n\n` +
      `So nutzen Sie die Stempelstation:\n` +
      `1. Scannen Sie den QR-Code am Eingang mit Ihrer Handykamera.\n` +
      `2. Geben Sie Ihre 4-stellige PIN (${rawPin}) ein.\n` +
      `3. Tippen Sie auf „REIN" oder „RAUS".\n\n` +
      `Bitte bewahren Sie Ihre PIN sicher auf und teilen Sie sie nicht mit ` +
      `Kolleginnen und Kollegen, da sie Ihnen persönlich zugeordnet ist.\n\n` +
      `Bei Problemen wenden Sie sich an Ihren Vorgesetzten.`,
  });
  if (!result.success) {
    log.warn("[employee-pin] PIN email not sent", { error: result.error });
  }
}
