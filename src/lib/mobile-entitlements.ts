/**
 * Mobile entitlements — the subscription/add-on state the native app needs to
 * mirror the web's access gating.
 *
 * The web dashboard hard-gates its whole UI on `getSubscriptionState` (see the
 * dashboard layout) and gates individual modules on the add-on flags. The
 * mobile app calls the regular API routes directly, which do NOT re-check the
 * subscription on every call, so the app must gate its own UI. These fields are
 * attached to the mobile login + profile responses so the app can show the
 * right paywall ("workspace inactive", "trial expired") and add-on upsells
 * instead of silently failing.
 */
import {
  getSubscriptionState,
  type SubscriptionState,
} from "@/lib/subscription";
import { hasTicketingAddon } from "@/lib/ticketing-addon";
import { hasSchichtplanungAddon } from "@/lib/schichtplanung-addon";

export interface MobileEntitlements {
  /** "active" | "trial_expired" | "inactive" — drives the blocking paywall. */
  subscriptionState: SubscriptionState;
  /** Ticketing add-on booked & active. */
  ticketingActive: boolean;
  /** Shift-planning add-on active (or Enterprise plan). */
  schichtplanungActive: boolean;
}

export async function getMobileEntitlements(
  workspaceId: string | null | undefined,
): Promise<MobileEntitlements> {
  if (!workspaceId) {
    return {
      subscriptionState: "inactive",
      ticketingActive: false,
      schichtplanungActive: false,
    };
  }

  const [subscriptionState, ticketingActive, schichtplanungActive] =
    await Promise.all([
      getSubscriptionState(workspaceId),
      hasTicketingAddon(workspaceId),
      hasSchichtplanungAddon(workspaceId),
    ]);

  return { subscriptionState, ticketingActive, schichtplanungActive };
}
