import { prisma } from "@/lib/db";

/**
 * Resolve a user's preferred locale from the database.
 * Falls back to "de" if the user is not found or has no preference.
 *
 * Use this in background jobs / server contexts where there is no
 * HTTP request cookie available (webhooks, dispatchers, automations).
 */
export async function getUserLocale(userId: string): Promise<"de" | "en"> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLocale: true },
    });
    const loc = user?.preferredLocale;
    return loc === "en" ? "en" : "de";
  } catch {
    return "de";
  }
}

/**
 * Resolve the workspace owner's preferred locale.
 * Useful for billing/system emails where we only have a workspaceId.
 */
export async function getWorkspaceOwnerLocale(
  workspaceId: string,
): Promise<"de" | "en"> {
  try {
    const owner = await prisma.user.findFirst({
      where: { workspaceId, role: "OWNER" },
      select: { preferredLocale: true },
    });
    const loc = owner?.preferredLocale;
    return loc === "en" ? "en" : "de";
  } catch {
    return "de";
  }
}
