"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  BellIcon,
  CalendarIcon,
  AlertTriangleIcon,
  ClipboardIcon,
  CircleCheckIcon,
  CircleXIcon,
  RefreshIcon,
  ClockIcon,
  PencilIcon,
  AlertCircleIcon,
  TicketIcon,
  MessageCircleIcon,
  FileCheckIcon,
} from "@/components/icons";
import { useLocale, useTranslations } from "next-intl";
import type { SVGProps, ComponentType } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string | null;
  createdAt: string;
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const t = useTranslations("notifications");

  // ── Client-side title/message translation by notification type ──
  const titleMap: Record<string, string> = {
    SHIFT_ASSIGNED: t("types.shiftAssigned"),
    SHIFTS_CANCELLED_ABSENCE: t("types.shiftsCancelledAbsence"),
    ABSENCE_REQUESTED: t("types.absenceRequested"),
    ABSENCE_AUTO_APPROVED: t("types.absenceAutoApproved"),
    ABSENCE_APPROVED: t("types.absenceApproved"),
    ABSENCE_REJECTED: t("types.absenceRejected"),
    SWAP_REQUESTED: t("types.swapRequested"),
    SWAP_AUTO_APPROVED: t("types.swapAutoApproved"),
    SWAP_GENEHMIGT: t("types.swapApproved"),
    SWAP_ABGELEHNT: t("types.swapRejected"),
    TIME_ENTRY_SUBMITTED: t("types.timeEntrySubmitted"),
    TIME_ENTRY_APPROVED: t("types.timeEntryApproved"),
    TIME_ENTRY_REJECTED: t("types.timeEntryRejected"),
    TIME_ENTRY_CORRECTED: t("types.timeEntryCorrected"),
    TIME_ENTRY_CONFIRMED: t("types.timeEntryConfirmed"),
    OVERTIME_ALERT: t("types.overtimeAlert"),
    BREAK_REMINDER: t("types.breakReminder"),
    TICKET_ASSIGNED: t("types.ticketAssigned"),
    TICKET_STATUS_CHANGED: t("types.ticketStatusChanged"),
    TICKET_COMMENT: t("types.ticketComment"),
    TICKET_CREATED: t("types.ticketCreated"),
    VISIT_SIGNED: t("types.visitSigned"),
  };

  function getTranslatedTitle(n: Notification) {
    return titleMap[n.type] || n.title;
  }

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silent fail - notifications will retry on next poll
    }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        (!portalRef.current || !portalRef.current.contains(target))
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAllRead() {
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Silent fail
    }
  }

  function handleNotificationClick(n: Notification) {
    if (!n.read) markRead(n.id);
    if (n.link) {
      window.location.href = n.link;
    }
    setOpen(false);
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHrs = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMin < 1) return t("justNow");
    if (diffMin < 60) return t("minutesAgo", { count: diffMin });
    if (diffHrs < 24) return t("hoursAgo", { count: diffHrs });
    if (diffDays < 7) return t("daysAgo", { count: diffDays });
    return date.toLocaleDateString(locale === "de" ? "de-DE" : "en-US");
  }

  const typeIconMap: Record<
    string,
    { icon: ComponentType<SVGProps<SVGSVGElement>>; color: string }
  > = {
    SHIFT_ASSIGNED: { icon: CalendarIcon, color: "text-emerald-500" },
    SHIFTS_CANCELLED_ABSENCE: {
      icon: AlertTriangleIcon,
      color: "text-amber-500",
    },
    ABSENCE_REQUESTED: { icon: ClipboardIcon, color: "text-orange-500" },
    ABSENCE_AUTO_APPROVED: { icon: CircleCheckIcon, color: "text-emerald-500" },
    ABSENCE_APPROVED: { icon: CircleCheckIcon, color: "text-emerald-500" },
    ABSENCE_REJECTED: { icon: CircleXIcon, color: "text-red-500" },
    SWAP_REQUESTED: { icon: RefreshIcon, color: "text-emerald-500" },
    SWAP_AUTO_APPROVED: { icon: CircleCheckIcon, color: "text-emerald-500" },
    SWAP_GENEHMIGT: { icon: CircleCheckIcon, color: "text-emerald-500" },
    SWAP_ABGELEHNT: { icon: CircleXIcon, color: "text-red-500" },
    TIME_ENTRY_SUBMITTED: { icon: ClockIcon, color: "text-emerald-500" },
    TIME_ENTRY_APPROVED: { icon: CircleCheckIcon, color: "text-emerald-500" },
    TIME_ENTRY_REJECTED: { icon: CircleXIcon, color: "text-red-500" },
    TIME_ENTRY_CORRECTED: { icon: PencilIcon, color: "text-amber-500" },
    TIME_ENTRY_CONFIRMED: { icon: CircleCheckIcon, color: "text-emerald-600" },
    OVERTIME_ALERT: { icon: AlertCircleIcon, color: "text-red-600" },
    BREAK_REMINDER: { icon: AlertTriangleIcon, color: "text-orange-500" },
    TICKET_ASSIGNED: { icon: TicketIcon, color: "text-emerald-500" },
    TICKET_STATUS_CHANGED: { icon: TicketIcon, color: "text-blue-500" },
    TICKET_COMMENT: { icon: MessageCircleIcon, color: "text-emerald-500" },
    TICKET_CREATED: { icon: TicketIcon, color: "text-amber-500" },
    VISIT_SIGNED: { icon: FileCheckIcon, color: "text-emerald-600" },
  };

  function getNotificationIcon(type: string) {
    const entry = typeIconMap[type] || {
      icon: BellIcon,
      color: "text-gray-400",
    };
    const Icon = entry.icon;
    return <Icon className={`h-4 w-4 ${entry.color}`} />;
  }

  // Notification list shared between mobile and desktop
  function NotificationList() {
    return (
      <>
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
            {t("empty")}
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors ${
                !n.read ? "bg-emerald-50/50 dark:bg-emerald-950/30" : ""
              }`}
            >
              <div className="flex gap-2.5">
                <span className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(n.type)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium truncate ${
                        !n.read
                          ? "text-gray-900 dark:text-zinc-100"
                          : "text-gray-600 dark:text-zinc-400"
                      }`}
                    >
                      {getTranslatedTitle(n)}
                    </span>
                    {!n.read && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                    {n.message}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">
                    {formatTime(n.createdAt)}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </>
    );
  }

  function NotificationHeader() {
    return (
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 px-4 py-3">
        <h3 className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">
          {t("title")}
        </h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={loading}
            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50"
          >
            {t("markAllRead")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-xl p-2.5 sm:p-2 text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-300 active:bg-gray-200 dark:active:bg-zinc-700 transition-colors"
        aria-label={t("title")}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-red-500 text-[10px] sm:text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Desktop dropdown — absolute, inside relative container, no portal needed */}
      {open && (
        <div className="hidden sm:block absolute right-0 top-full mt-2 w-96 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden z-50">
          <NotificationHeader />
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-zinc-800">
            <NotificationList />
          </div>
        </div>
      )}

      {/* Mobile bottom sheet — rendered via portal into document.body to escape
          sticky/transform stacking contexts that break fixed positioning */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div ref={portalRef} className="sm:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            {/* Sheet */}
            <div className="fixed inset-x-0 bottom-0 z-[9999] rounded-t-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
              {/* Drag handle */}
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-zinc-600" />
              </div>
              <NotificationHeader />
              <div
                className="overflow-y-auto divide-y divide-gray-50 dark:divide-zinc-800"
                style={{
                  maxHeight: "60svh",
                  paddingBottom: "env(safe-area-inset-bottom)",
                }}
              >
                <NotificationList />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
