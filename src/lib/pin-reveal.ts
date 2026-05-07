import { cache } from "@/lib/cache";

const TTL_SECONDS = 15 * 60; // 15 minutes
const KEY_PREFIX = "pin_reveal:";

/** Store a raw PIN under a one-time token. Returns the token. */
export async function createPinRevealToken(rawPin: string): Promise<string> {
  const token = crypto.randomUUID();
  await cache.set(`${KEY_PREFIX}${token}`, rawPin, TTL_SECONDS);
  return token;
}

/**
 * Retrieve and immediately delete a stored raw PIN.
 * Returns the PIN on first call, null on any subsequent call (one-time use).
 */
export async function consumePinRevealToken(
  token: string,
): Promise<string | null> {
  const key = `${KEY_PREFIX}${token}`;
  const pin = await cache.get<string>(key);
  if (!pin) return null;
  await cache.del(key);
  return pin;
}
