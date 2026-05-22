"use client";

import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  UserIcon,
  ZapIcon,
  XIcon,
  FlagIcon,
} from "@/components/icons";

type SosEventType =
  | "CREATED"
  | "RANKED"
  | "TIER_NOTIFIED"
  | "LINK_OPENED"
  | "ACCEPTED"
  | "DECLINED"
  | "ESCALATED"
  | "FILLED"
  | "EXPIRED"
  | "CANCELLED";

type ActorType = "SYSTEM" | "USER" | "EMPLOYEE";

interface SosEvent {
  id: string;
  type: SosEventType;
  actorType: ActorType;
  actorId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Props {
  events: SosEvent[];
  locale: "de" | "en";
}

/**
 * Chronological audit ledger.
 * Each row: timestamp · icon · actor · localized description · metadata chip.
 */
export function AuditLedger({ events, locale }: Props) {
  const timeFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center">
        <ClockIcon className="h-6 w-6 mx-auto text-gray-300 dark:text-zinc-700" />
        <p className="mt-2 text-sm text-gray-400 dark:text-zinc-500">
          {locale === "en"
            ? "Audit events will appear here as they happen."
            : "Audit-Ereignisse erscheinen hier in Echtzeit."}
        </p>
      </div>
    );
  }

  // Rigid column tracks — every row + the header share the EXACT same
  // grid template, so columns line up regardless of badge text length.
  // 72px time column · 132px event-badge column · flexible details.
  const gridCols = "grid-cols-[72px_132px_minmax(0,1fr)]";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
      <div
        className={`grid ${gridCols} gap-x-4 px-4 py-2 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40 text-[10px] uppercase tracking-wider font-semibold text-gray-400 dark:text-zinc-500`}
      >
        <span>{locale === "en" ? "Time" : "Zeit"}</span>
        <span>{locale === "en" ? "Event" : "Ereignis"}</span>
        <span>{locale === "en" ? "Details" : "Details"}</span>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
        {events.map((ev) => (
          <li
            key={ev.id}
            className={`grid ${gridCols} gap-x-4 items-center px-4 py-2 animate-in fade-in slide-in-from-left-1 duration-300`}
          >
            <time className="text-xs tabular-nums text-gray-500 dark:text-zinc-400">
              {timeFmt.format(new Date(ev.createdAt))}
            </time>
            <EventIconLabel type={ev.type} locale={locale} />
            <EventDescription event={ev} locale={locale} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventIconLabel({
  type,
  locale,
}: {
  type: SosEventType;
  locale: "de" | "en";
}) {
  const config = EVENT_CONFIG[type];
  const Icon = config.icon;
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold min-w-0">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-md shrink-0 ${config.bg}`}
      >
        <Icon className={`h-3 w-3 ${config.fg}`} />
      </span>
      <span className={`${config.fg} truncate`}>{config.label[locale]}</span>
    </span>
  );
}

function EventDescription({
  event,
  locale,
}: {
  event: SosEvent;
  locale: "de" | "en";
}) {
  const m = event.metadata ?? {};
  const actor = event.actorName?.trim()
    ? formatActor(event.actorName)
    : event.actorType === "SYSTEM"
      ? locale === "en"
        ? "System"
        : "System"
      : null;

  switch (event.type) {
    case "CREATED":
      return (
        <p className="text-sm text-gray-700 dark:text-zinc-300">
          {locale === "en"
            ? `${actor} opened the SOS request.`
            : `${actor} hat das SOS gestartet.`}
        </p>
      );
    case "RANKED": {
      const count = (m.candidateCount as number) ?? 0;
      return (
        <p className="text-sm text-gray-700 dark:text-zinc-300">
          {locale === "en"
            ? `System indexed ${count} candidates by reliability score.`
            : `System hat ${count} Kandidaten nach Zuverlässigkeit indexiert.`}
        </p>
      );
    }
    case "TIER_NOTIFIED": {
      const tier = (m.tier as number) ?? 1;
      const count = (m.count as number) ?? 0;
      return (
        <p className="text-sm text-gray-700 dark:text-zinc-300">
          {locale === "en"
            ? `Tier ${tier} dispatched to ${count} employee${count === 1 ? "" : "s"}.`
            : `Stufe ${tier} an ${count} Mitarbeiter verschickt.`}
        </p>
      );
    }
    case "LINK_OPENED":
      return (
        <p className="text-sm text-gray-700 dark:text-zinc-300">
          {locale === "en"
            ? `${actor} opened the response link.`
            : `${actor} hat den Antwort-Link geöffnet.`}
        </p>
      );
    case "ACCEPTED":
      return (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {locale === "en"
            ? `${actor} accepted the shift.`
            : `${actor} hat die Schicht angenommen.`}
        </p>
      );
    case "DECLINED":
      return (
        <p className="text-sm text-gray-700 dark:text-zinc-300">
          {locale === "en"
            ? `${actor} declined the shift.`
            : `${actor} hat die Schicht abgelehnt.`}
        </p>
      );
    case "ESCALATED": {
      const tier = (m.tier as number) ?? 2;
      return (
        <p className="text-sm text-gray-700 dark:text-zinc-300">
          {locale === "en"
            ? `Countdown elapsed — escalated to tier ${tier}.`
            : `Countdown abgelaufen — Eskalation auf Stufe ${tier}.`}
        </p>
      );
    }
    case "FILLED":
      return (
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          {locale === "en"
            ? `Shift filled by ${m.employeeName ?? "—"}.`
            : `Schicht besetzt durch ${m.employeeName ?? "—"}.`}
        </p>
      );
    case "EXPIRED":
      return (
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          {locale === "en"
            ? "Countdown expired — no one accepted in time."
            : "Countdown abgelaufen — niemand hat rechtzeitig angenommen."}
        </p>
      );
    case "CANCELLED":
      return (
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          {locale === "en"
            ? `${actor} cancelled the request.`
            : `${actor} hat das SOS abgebrochen.`}
        </p>
      );
  }
}

function formatActor(raw: string): string {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const EVENT_CONFIG: Record<
  SosEventType,
  {
    icon: typeof AlertCircleIcon;
    bg: string;
    fg: string;
    label: { de: string; en: string };
  }
> = {
  CREATED: {
    icon: FlagIcon,
    bg: "bg-red-50 dark:bg-red-950/30",
    fg: "text-red-600 dark:text-red-400",
    label: { de: "Eröffnet", en: "Opened" },
  },
  RANKED: {
    icon: UsersIcon,
    bg: "bg-gray-100 dark:bg-zinc-800",
    fg: "text-gray-700 dark:text-zinc-300",
    label: { de: "Ranking", en: "Ranked" },
  },
  TIER_NOTIFIED: {
    icon: ZapIcon,
    bg: "bg-amber-50 dark:bg-amber-950/30",
    fg: "text-amber-700 dark:text-amber-400",
    label: { de: "Versendet", en: "Dispatched" },
  },
  LINK_OPENED: {
    icon: UserIcon,
    bg: "bg-gray-100 dark:bg-zinc-800",
    fg: "text-gray-700 dark:text-zinc-300",
    label: { de: "Geöffnet", en: "Opened" },
  },
  ACCEPTED: {
    icon: CheckCircleIcon,
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    fg: "text-emerald-700 dark:text-emerald-400",
    label: { de: "Angenommen", en: "Accepted" },
  },
  DECLINED: {
    icon: XIcon,
    bg: "bg-red-50 dark:bg-red-950/30",
    fg: "text-red-600 dark:text-red-400",
    label: { de: "Abgelehnt", en: "Declined" },
  },
  ESCALATED: {
    icon: ZapIcon,
    bg: "bg-amber-50 dark:bg-amber-950/30",
    fg: "text-amber-700 dark:text-amber-400",
    label: { de: "Eskaliert", en: "Escalated" },
  },
  FILLED: {
    icon: CheckCircleIcon,
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    fg: "text-emerald-700 dark:text-emerald-400",
    label: { de: "Besetzt", en: "Filled" },
  },
  EXPIRED: {
    icon: ClockIcon,
    bg: "bg-gray-100 dark:bg-zinc-800",
    fg: "text-gray-600 dark:text-zinc-400",
    label: { de: "Abgelaufen", en: "Expired" },
  },
  CANCELLED: {
    icon: XIcon,
    bg: "bg-gray-100 dark:bg-zinc-800",
    fg: "text-gray-600 dark:text-zinc-400",
    label: { de: "Abgebrochen", en: "Cancelled" },
  },
};
