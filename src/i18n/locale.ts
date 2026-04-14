"use server";

import { cookies } from "next/headers";
import { defaultLocale, type Locale } from "./request";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

interface SessionUser {
  id: string;
  [key: string]: unknown;
}

export async function setLocale(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });

  // Persist to DB so background jobs use the same locale
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (user?.id) {
      await prisma.user.update({
        where: { id: user.id },
        data: { preferredLocale: locale },
      });
    }
  } catch (err) {
    log.warn("[setLocale] Failed to persist locale to DB", { error: err });
  }
}

export async function getLocaleFromCookie(): Promise<Locale> {
  const cookieStore = await cookies();
  return (cookieStore.get("locale")?.value as Locale) || defaultLocale;
}
