import { createPrivateKey, sign as cryptoSign } from "crypto";
import http2 from "http2";
import { log } from "@/lib/logger";

/**
 * Send Live Activity updates to Apple Push Notification service.
 *
 * Why this exists: a Live Activity can only be changed by the app that started
 * it, and only while that app is running. An employee who ends a break in the
 * web app leaves the card on their lock screen still saying "on break" -- not
 * lagging, but asserting something false, with no way to correct itself until
 * the phone app is next opened. ActivityKit push is the only mechanism Apple
 * provides for updating it from anywhere else.
 *
 * Two details that are easy to get wrong and fail opaquely:
 *
 *  - APNs is HTTP/2 only. `fetch` in Node speaks HTTP/1.1, so this uses the
 *    `http2` module directly. A request over 1.1 is simply refused.
 *  - The ES256 signature must be raw r||s (JOSE), not the DER encoding Node
 *    produces by default. `dsaEncoding: "ieee-p1363"` selects the right one;
 *    without it every push comes back 403 InvalidProviderToken, which reads
 *    like a bad key rather than a bad encoding.
 */

const APNS_HOST_PROD = "api.push.apple.com";
const APNS_HOST_SANDBOX = "api.sandbox.push.apple.com";

/** Apple caps provider-token lifetime at 1h and rejects reuse under ~20min. */
const TOKEN_TTL_MS = 45 * 60 * 1000;

let cachedToken: { value: string; expiresAt: number } | null = null;

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  /** Contents of the .p8 file, PEM encoded. */
  privateKey: string;
  /** The APP's bundle id; the Live Activity topic is derived from it. */
  bundleId: string;
  useSandbox: boolean;
}

export function apnsConfigFromEnv(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  // Stored with literal \n in most hosts' env UIs; accept both spellings.
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!keyId || !teamId || !bundleId || !privateKey) return null;

  return {
    keyId,
    teamId,
    bundleId,
    privateKey,
    /**
     * TestFlight and App Store builds both use PRODUCTION APNs. Only a build
     * installed straight from Xcode uses sandbox, so this defaults to
     * production and is opt-in the other way.
     */
    useSandbox: process.env.APNS_USE_SANDBOX === "true",
  };
}

function providerToken(cfg: ApnsConfig): string {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const header = { alg: "ES256", kid: cfg.keyId };
  const claims = { iss: cfg.teamId, iat: Math.floor(now / 1000) };

  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const signingInput = `${b64(header)}.${b64(claims)}`;
  const key = createPrivateKey(cfg.privateKey);
  const signature = cryptoSign("sha256", Buffer.from(signingInput), {
    key,
    // Raw r||s, not DER. See the note at the top of this file.
    dsaEncoding: "ieee-p1363",
  })
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const value = `${signingInput}.${signature}`;
  cachedToken = { value, expiresAt: now + TOKEN_TTL_MS };
  return value;
}

export type ApnsEvent = "update" | "end";

export interface ApnsResult {
  ok: boolean;
  status: number;
  /** Apple's machine-readable reason, e.g. "BadDeviceToken". */
  reason?: string;
  /** True when the token is dead and the row should be deleted. */
  gone: boolean;
}

/**
 * Push one Live Activity update.
 *
 * `contentState` must match the Swift ContentState's encoded shape. Every
 * property there carries a default, so a key omitted here decodes to that
 * default rather than failing -- which also means a partial payload silently
 * blanks whatever it leaves out. Send the whole state.
 */
export async function sendLiveActivityPush(opts: {
  cfg: ApnsConfig;
  deviceToken: string;
  event: ApnsEvent;
  contentState: Record<string, unknown>;
  /** Seconds since epoch after which iOS may dismiss an ended activity. */
  dismissalDate?: number;
  /** When the state was true, so Apple can discard a stale update. */
  timestamp?: number;
}): Promise<ApnsResult> {
  const { cfg, deviceToken, event, contentState, dismissalDate } = opts;
  const host = cfg.useSandbox ? APNS_HOST_SANDBOX : APNS_HOST_PROD;

  const payload: Record<string, unknown> = {
    aps: {
      timestamp: opts.timestamp ?? Math.floor(Date.now() / 1000),
      event,
      "content-state": contentState,
      ...(event === "end" && dismissalDate
        ? { "dismissal-date": dismissalDate }
        : {}),
    },
  };

  const body = Buffer.from(JSON.stringify(payload));

  return new Promise<ApnsResult>((resolve) => {
    let settled = false;
    const done = (r: ApnsResult) => {
      if (settled) return;
      settled = true;
      client.close();
      resolve(r);
    };

    const client = http2.connect(`https://${host}`);
    client.on("error", () =>
      done({ ok: false, status: 0, reason: "connection", gone: false }),
    );

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken(cfg)}`,
      "apns-push-type": "liveactivity",
      // The Live Activity topic is the app's bundle id with this suffix. A
      // plain bundle id is rejected with TopicDisallowed.
      "apns-topic": `${cfg.bundleId}.push-type.liveactivity`,
      // 10 = deliver immediately. The whole point is that the lock screen is
      // right now rather than eventually.
      "apns-priority": "10",
      "content-type": "application/json",
      "content-length": body.length,
    });

    let status = 0;
    let raw = "";

    req.setTimeout(10_000, () =>
      done({ ok: false, status: 0, reason: "timeout", gone: false }),
    );
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("error", () =>
      done({ ok: false, status, reason: "stream", gone: false }),
    );
    req.on("end", () => {
      let reason: string | undefined;
      try {
        reason = raw ? (JSON.parse(raw).reason as string) : undefined;
      } catch {
        reason = raw || undefined;
      }
      /**
       * 410 means the activity is over and the token is dead. 400 with
       * BadDeviceToken means the same thing for a token that was never valid.
       * Both should remove the row, or every later push retries a corpse.
       */
      const gone =
        status === 410 ||
        reason === "BadDeviceToken" ||
        reason === "Unregistered";

      done({ ok: status >= 200 && status < 300, status, reason, gone });
    });

    req.end(body);
  });
}

/** Push to several tokens, reporting which are dead so callers can prune. */
export async function pushToTokens(opts: {
  cfg: ApnsConfig;
  tokens: string[];
  event: ApnsEvent;
  contentState: Record<string, unknown>;
}): Promise<{ sent: number; failed: number; dead: string[] }> {
  const dead: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    opts.tokens.map(async (deviceToken) => {
      const res = await sendLiveActivityPush({
        cfg: opts.cfg,
        deviceToken,
        event: opts.event,
        contentState: opts.contentState,
      });
      if (res.ok) {
        sent += 1;
        return;
      }
      failed += 1;
      if (res.gone) dead.push(deviceToken);
      else
        log.warn("[apns] live activity push failed", {
          status: res.status,
          reason: res.reason,
        });
    }),
  );

  return { sent, failed, dead };
}

/**
 * A standard user-visible push notification.
 *
 * Distinct from the Live Activity path above in every header that matters: a
 * plain bundle id as the topic (not the .push-type.liveactivity suffix) and
 * `apns-push-type: alert`. Sending one with the other's headers is rejected
 * with TopicDisallowed, which reads like a permissions problem rather than the
 * wrong constant.
 */
export async function sendAlertPush(opts: {
  cfg: ApnsConfig;
  deviceToken: string;
  title: string;
  body: string;
  /** Deep-link path the app opens on tap, e.g. "/(app)/schicht/abc". */
  link?: string;
  /** Unread count to show on the app icon. Omit to leave it unchanged. */
  badge?: number;
  /**
   * Grouping key. iOS collapses notifications sharing one, so a schedule
   * republished three times reads as one update rather than three alerts.
   */
  collapseId?: string;
  /** Extra values delivered to the app alongside the alert. */
  data?: Record<string, unknown>;
}): Promise<ApnsResult> {
  const { cfg, deviceToken, title, body, link, badge, collapseId, data } = opts;
  const host = cfg.useSandbox ? APNS_HOST_SANDBOX : APNS_HOST_PROD;

  const payload = {
    aps: {
      alert: { title, body },
      sound: "default",
      ...(badge != null ? { badge } : {}),
      // Lets the app update its badge and cache before the user taps.
      "mutable-content": 1,
    },
    ...(link ? { link } : {}),
    ...(data ?? {}),
  };

  const raw = Buffer.from(JSON.stringify(payload));

  return new Promise<ApnsResult>((resolve) => {
    let settled = false;
    const done = (r: ApnsResult) => {
      if (settled) return;
      settled = true;
      client.close();
      resolve(r);
    };

    const client = http2.connect(`https://${host}`);
    client.on("error", () =>
      done({ ok: false, status: 0, reason: "connection", gone: false }),
    );

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken(cfg)}`,
      "apns-push-type": "alert",
      "apns-topic": cfg.bundleId,
      // 10 = deliver immediately. A shift change the reader needs now is the
      // whole reason this exists.
      "apns-priority": "10",
      ...(collapseId ? { "apns-collapse-id": collapseId.slice(0, 64) } : {}),
      "content-type": "application/json",
      "content-length": raw.length,
    });

    let status = 0;
    let bodyText = "";

    req.setTimeout(10_000, () =>
      done({ ok: false, status: 0, reason: "timeout", gone: false }),
    );
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.on("data", (chunk) => {
      bodyText += chunk;
    });
    req.on("error", () =>
      done({ ok: false, status, reason: "stream", gone: false }),
    );
    req.on("end", () => {
      let reason: string | undefined;
      try {
        reason = bodyText ? (JSON.parse(bodyText).reason as string) : undefined;
      } catch {
        reason = bodyText || undefined;
      }
      const gone =
        status === 410 ||
        reason === "BadDeviceToken" ||
        reason === "Unregistered";
      done({ ok: status >= 200 && status < 300, status, reason, gone });
    });

    req.end(raw);
  });
}
