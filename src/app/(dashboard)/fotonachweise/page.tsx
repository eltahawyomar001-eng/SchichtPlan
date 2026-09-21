"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdaptiveModal } from "@/components/ui/adaptive-modal";
import {
  ImageIcon,
  MapPinIcon,
  ClockIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  UserIcon,
} from "@/components/icons";

/**
 * Manager view for photographic proof of work.
 *
 * The photo alone is not the evidence — the photo plus a time and a place
 * nobody on site could edit is. So every tile leads with the verdict the
 * server reached, and a photo taken away from the object is called out rather
 * than quietly shown next to the compliant ones. A manager scanning a
 * Winterdienst round needs the exceptions to find them, not the other way
 * round.
 */

type GeofenceStatus = "INSIDE" | "OUTSIDE" | "OVERRIDDEN" | "UNAVAILABLE";

interface ProofPhoto {
  id: string;
  url: string | null;
  fileName: string;
  capturedAt: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  distanceM: number | null;
  geofenceStatus: GeofenceStatus | null;
  locationMocked: boolean;
  note: string | null;
  shiftId: string | null;
  timeEntryId: string | null;
  employee: { id: string; firstName: string; lastName: string } | null;
  location: { id: string; name: string } | null;
}

export default function FotonachweisePage() {
  const t = useTranslations("proofPhotos");

  /**
   * Empty means "everything still retained", not "today".
   *
   * This defaulted to today and always sent ?date=, so a photo taken yesterday
   * vanished from the page overnight with nothing on screen saying it had been
   * filtered out. It looked exactly like the photos were being deleted daily,
   * and the rows were there the whole time. Since proofs are kept for
   * PROOF_RETENTION_DAYS and swept after that, showing everything by default
   * shows precisely what exists.
   */
  const [date, setDate] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [photos, setPhotos] = useState<ProofPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ProofPhoto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        date
          ? `/api/work-proof?date=${encodeURIComponent(date)}`
          : "/api/work-proof",
      );
      if (!res.ok) {
        setError(t("loadError"));
        setPhotos([]);
        return;
      }
      const data = await res.json();
      setPhotos(data.photos ?? []);
    } catch {
      setError(t("loadError"));
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [date, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const employees = Array.from(
    new Map(
      photos
        .filter((p) => p.employee)
        .map((p) => [
          p.employee!.id,
          `${p.employee!.firstName} ${p.employee!.lastName}`,
        ]),
    ),
  );

  const visible = employeeFilter
    ? photos.filter((p) => p.employee?.id === employeeFilter)
    : photos;

  const flagged = visible.filter(
    (p) => p.geofenceStatus === "OUTSIDE" || p.locationMocked,
  ).length;

  return (
    <>
      <Topbar title={t("title")} description={t("description")} />

      <PageContent>
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <div>
              <Label htmlFor="proof-date">{t("filterDate")}</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  id="proof-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                {/* Without a way back to "all", picking a date once would trap
                    the manager on a single day and recreate the illusion that
                    older proofs are gone. */}
                {date && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDate("")}
                  >
                    {t("filterAllDates")}
                  </Button>
                )}
              </div>
            </div>
            <div className="min-w-[12rem]">
              <Label htmlFor="proof-employee">{t("filterEmployee")}</Label>
              <Select
                id="proof-employee"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="mt-1"
              >
                <option value="">{t("allEmployees")}</option>
                {employees.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>

            {flagged > 0 && (
              <div className="ml-auto flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                <AlertTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  {t("flaggedCount", { count: flagged })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="mt-4 rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<ImageIcon className="h-10 w-10" />}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((photo) => (
              <ProofCard
                key={photo.id}
                photo={photo}
                onOpen={() => setActive(photo)}
              />
            ))}
          </div>
        )}
      </PageContent>

      <AdaptiveModal
        open={!!active}
        onClose={() => setActive(null)}
        title={t("detailTitle")}
        size="lg"
      >
        {active && <ProofDetail photo={active} />}
      </AdaptiveModal>
    </>
  );
}

/* ─── Verdict badge ──────────────────────────────────────────── */

function VerdictBadge({ photo }: { photo: ProofPhoto }) {
  const t = useTranslations("proofPhotos");

  // A spoofed fix outranks everything else: if the position was fabricated the
  // distance is meaningless, so saying "42 m away" would be worse than useless.
  if (photo.locationMocked) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangleIcon className="h-3 w-3" />
        {t("verdictMocked")}
      </Badge>
    );
  }
  if (photo.geofenceStatus === "INSIDE") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircleIcon className="h-3 w-3" />
        {t("verdictInside")}
      </Badge>
    );
  }
  if (photo.geofenceStatus === "OUTSIDE") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangleIcon className="h-3 w-3" />
        {photo.distanceM != null
          ? t("verdictOutsideDistance", {
              distance: Math.round(photo.distanceM),
            })
          : t("verdictOutside")}
      </Badge>
    );
  }
  // Two different gaps used to share one label. A photo carrying a position
  // that could not be checked means the OBJECT has no coordinates — nothing is
  // wrong with the proof, the site was never geocoded. A photo with no position
  // at all is a gap in the capture itself. Reporting both as "no position" hid
  // an ungeocoded object behind what read like a failure by the worker.
  const hasFix = photo.latitude != null && photo.longitude != null;
  return (
    <Badge variant="outline">
      {hasFix ? t("verdictNoGeofence") : t("verdictUnavailable")}
    </Badge>
  );
}

/* ─── Card ───────────────────────────────────────────────────── */

function ProofCard({
  photo,
  onOpen,
}: {
  photo: ProofPhoto;
  onOpen: () => void;
}) {
  const t = useTranslations("proofPhotos");
  const time = new Date(photo.capturedAt).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <button
      type="button"
      onClick={onOpen}
      className="overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="relative aspect-[4/3] bg-gray-100 dark:bg-zinc-800">
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.note ?? t("photoAlt")}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-gray-300 dark:text-zinc-600" />
          </div>
        )}
        <div className="absolute left-2 top-2">
          <VerdictBadge photo={photo} />
        </div>
      </div>

      <div className="space-y-1.5 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-zinc-100">
          <UserIcon className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
          {photo.employee
            ? `${photo.employee.firstName} ${photo.employee.lastName}`
            : t("unknownEmployee")}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
          <ClockIcon className="h-3.5 w-3.5" />
          <span className="tabular-nums">{time}</span>
          {photo.location && (
            <>
              <MapPinIcon className="ml-1 h-3.5 w-3.5" />
              <span className="truncate">{photo.location.name}</span>
            </>
          )}
        </div>
        {photo.note && (
          <p className="line-clamp-2 text-xs text-gray-600 dark:text-zinc-400">
            {photo.note}
          </p>
        )}
      </div>
    </button>
  );
}

/* ─── Detail ─────────────────────────────────────────────────── */

function ProofDetail({ photo }: { photo: ProofPhoto }) {
  const t = useTranslations("proofPhotos");
  const captured = new Date(photo.capturedAt).toLocaleString("de-DE", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const mapsHref =
    photo.latitude != null && photo.longitude != null
      ? `https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`
      : null;

  return (
    <div className="space-y-4">
      {photo.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt={photo.note ?? t("photoAlt")}
          className="w-full rounded-xl"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge photo={photo} />
        {photo.accuracyM != null && (
          <span className="text-xs text-gray-500 dark:text-zinc-400">
            {t("accuracy", { accuracy: Math.round(photo.accuracyM) })}
          </span>
        )}
      </div>

      <dl className="space-y-2 text-sm">
        <Row label={t("fieldEmployee")}>
          {photo.employee
            ? `${photo.employee.firstName} ${photo.employee.lastName}`
            : t("unknownEmployee")}
        </Row>
        {/* Says "server-confirmed" on purpose: that is the whole claim. */}
        <Row label={t("fieldCapturedAt")}>{captured}</Row>
        {photo.location && (
          <Row label={t("fieldLocation")}>{photo.location.name}</Row>
        )}
        {photo.note && <Row label={t("fieldNote")}>{photo.note}</Row>}
        {/* The address comes first because it is the part a person can read.
            Coordinates stay directly under it: they are what the geofence was
            actually computed from, and an address is only ever a rendering of
            them. Showing the numbers alone is what made a captured position
            look like a missing one. */}
        {photo.address && (
          <Row label={t("fieldAddress")}>
            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                {photo.address}
              </a>
            ) : (
              photo.address
            )}
          </Row>
        )}
        {mapsHref && (
          <Row label={t("fieldCoordinates")}>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-700 underline tabular-nums"
            >
              {photo.latitude!.toFixed(5)}, {photo.longitude!.toFixed(5)}
            </a>
          </Row>
        )}
      </dl>

      <p className="rounded-xl bg-gray-50 dark:bg-zinc-800/50 px-3 py-2 text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
        {t("evidenceNote")}
      </p>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-gray-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="text-gray-900 dark:text-zinc-100">{children}</dd>
    </div>
  );
}
