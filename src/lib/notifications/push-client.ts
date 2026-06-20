"use client";

/**
 * Client-side push subscription helper.
 *
 * Shared by the time-clock (stempeluhr) and the settings page so there is a
 * single, correct subscribe path. Previously the time-clock only called
 * `Notification.requestPermission()` and never actually subscribed, so granting
 * permission there created no PushSubscription — devices never received pushes.
 */

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushSubscribeResult =
  | "subscribed" // newly subscribed and registered with the backend
  | "already" // a subscription already existed (re-registered, no-op for the user)
  | "denied" // user has blocked notifications
  | "dismissed" // user dismissed the permission prompt without granting
  | "unsupported"; // browser / config does not support web push

/**
 * Ensure the current device is subscribed to web push and registered with the
 * backend. Requests notification permission if it has not been decided yet.
 * Safe to call repeatedly — it reuses any existing subscription.
 */
export async function ensurePushSubscribed(): Promise<PushSubscribeResult> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return "unsupported";

  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission === "denied") return "denied";
    if (permission !== "granted") return "dismissed";
  }

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));

  await fetch("/api/push-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });

  return existing ? "already" : "subscribed";
}

/** Unsubscribe the current device from web push and de-register it. */
export async function unsubscribePush(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push-subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}
