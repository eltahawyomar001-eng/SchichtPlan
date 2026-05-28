"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ShieldCheckIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from "@/components/icons";

interface Location {
  id: string;
  name: string;
  address: string | null;
}

interface RequiredSkill {
  skillId: string;
  skillName: string;
  category: string | null;
}

interface CertStatus {
  skillId: string;
  skillName: string;
  status: "VALID" | "EXPIRED" | "MISSING";
  expiresAt: string | null;
}

interface Guard {
  employeeId: string;
  name: string;
  email: string | null;
  shiftCount: number;
  certStatus: CertStatus[];
  compliant: boolean;
}

interface Report {
  location: { id: string; name: string; address: string | null };
  period: { from: string; to: string };
  requiredSkills: RequiredSkill[];
  summary: {
    totalShifts: number;
    totalGuards: number;
    compliantGuards: number;
    nonCompliantGuards: number;
    overallCompliant: boolean;
  };
  guards: Guard[];
  generatedAt: string;
}

function today() {
  return new Date().toLocaleDateString("en-CA");
}
function monthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toLocaleDateString("en-CA");
}

export default function CompliancePage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const locs: Location[] = d?.data ?? d ?? [];
        setLocations(locs);
        if (locs.length > 0) setSelectedLocation(locs[0].id);
      })
      .catch(() => {});
  }, []);

  const generateReport = async () => {
    if (!selectedLocation) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(
        `/api/compliance/34a?locationId=${selectedLocation}&from=${from}&to=${to}`,
      );
      const data = await res.json();
      if (res.ok) {
        setReport(data);
      } else {
        setError(data.message || data.error || "Failed to generate report");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => window.print();

  const statusBadge = (status: "VALID" | "EXPIRED" | "MISSING") => {
    if (status === "VALID")
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircleIcon className="h-3 w-3" /> Valid
        </span>
      );
    if (status === "EXPIRED")
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          <AlertTriangleIcon className="h-3 w-3" /> Expired
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
        <AlertTriangleIcon className="h-3 w-3" /> Missing
      </span>
    );
  };

  return (
    <div>
      <Topbar
        title="§34a Compliance Report"
        description="Guard certification status per location and date range"
        actions={
          report ? (
            <Button size="sm" variant="outline" onClick={printReport}>
              Print / Export PDF
            </Button>
          ) : undefined
        }
      />

      <PageContent>
        {/* Filters */}
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Location</Label>
                <Select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>From</Label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={generateReport}
                disabled={loading || !selectedLocation}
              >
                {loading ? "Generating…" : "Generate Report"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {report && (
          <div className="space-y-6 print:space-y-4">
            {/* Header for print */}
            <div className="hidden print:block border-b pb-4 mb-4">
              <h1 className="text-xl font-bold">§34a Compliance Report</h1>
              <p className="text-sm text-gray-600">
                {report.location.name}
                {report.location.address ? ` · ${report.location.address}` : ""}
              </p>
              <p className="text-sm text-gray-600">
                Period:{" "}
                {new Date(report.period.from).toLocaleDateString("de-DE")} –{" "}
                {new Date(report.period.to).toLocaleDateString("de-DE")}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Generated:{" "}
                {new Date(report.generatedAt).toLocaleString("de-DE")}
              </p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card
                className={`border-2 ${report.summary.overallCompliant ? "border-emerald-300 dark:border-emerald-700" : "border-red-300 dark:border-red-700"}`}
              >
                <CardContent className="p-4 text-center">
                  <div
                    className={`text-2xl font-bold ${report.summary.overallCompliant ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {report.summary.overallCompliant ? "✓" : "✗"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    {report.summary.overallCompliant
                      ? "Compliant"
                      : "Non-Compliant"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                    {report.summary.totalShifts}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    Total Shifts
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">
                    {report.summary.compliantGuards}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    Compliant Guards
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {report.summary.nonCompliantGuards}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    Non-Compliant
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Required certifications */}
            {report.requiredSkills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
                    Required Certifications for This Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 flex flex-wrap gap-2">
                  {report.requiredSkills.map((rs) => (
                    <span
                      key={rs.skillId}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1 text-sm font-medium text-emerald-800 dark:text-emerald-300"
                    >
                      <ShieldCheckIcon className="h-3.5 w-3.5" />
                      {rs.skillName}
                    </span>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* No required certs */}
            {report.requiredSkills.length === 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 p-4 text-sm text-gray-500 dark:text-zinc-400">
                No certifications required for this location. Add requirements
                in{" "}
                <a href="/standorte" className="text-emerald-600 underline">
                  Locations
                </a>{" "}
                to enable §34a enforcement.
              </div>
            )}

            {/* Guard detail table */}
            {report.guards.length === 0 ? (
              <div className="rounded-xl border border-gray-200 dark:border-zinc-700 p-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                No shifts found for this location in the selected period.
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Guard Certification Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900">
                          <th className="px-5 py-3 text-left font-medium text-gray-500 dark:text-zinc-400">
                            Guard
                          </th>
                          <th className="px-5 py-3 text-center font-medium text-gray-500 dark:text-zinc-400">
                            Shifts
                          </th>
                          {report.requiredSkills.map((rs) => (
                            <th
                              key={rs.skillId}
                              className="px-5 py-3 text-center font-medium text-gray-500 dark:text-zinc-400"
                            >
                              {rs.skillName}
                            </th>
                          ))}
                          <th className="px-5 py-3 text-center font-medium text-gray-500 dark:text-zinc-400">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {report.guards.map((guard) => (
                          <tr
                            key={guard.employeeId}
                            className={
                              guard.compliant
                                ? ""
                                : "bg-red-50/50 dark:bg-red-950/10"
                            }
                          >
                            <td className="px-5 py-3">
                              <div className="font-medium text-gray-900 dark:text-zinc-100">
                                {guard.name}
                              </div>
                              {guard.email && (
                                <div className="text-xs text-gray-400 dark:text-zinc-500">
                                  {guard.email}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3 text-center text-gray-700 dark:text-zinc-300">
                              {guard.shiftCount}
                            </td>
                            {guard.certStatus.map((cs) => (
                              <td
                                key={cs.skillId}
                                className="px-5 py-3 text-center"
                              >
                                <div className="flex flex-col items-center gap-1">
                                  {statusBadge(cs.status)}
                                  {cs.expiresAt && (
                                    <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                                      exp.{" "}
                                      {new Date(
                                        cs.expiresAt,
                                      ).toLocaleDateString("de-DE")}
                                    </span>
                                  )}
                                </div>
                              </td>
                            ))}
                            <td className="px-5 py-3 text-center">
                              {guard.compliant ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                  <CheckCircleIcon className="h-3.5 w-3.5" />
                                  Compliant
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                                  <AlertTriangleIcon className="h-3.5 w-3.5" />
                                  Non-Compliant
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Footer for print */}
            <div className="hidden print:block border-t pt-4 mt-6 text-xs text-gray-400">
              <p>
                This report was generated by Shiftfy on{" "}
                {new Date(report.generatedAt).toLocaleString("de-DE")} and
                reflects certification data at time of generation. Document
                reference: §34a SachkPrüfungsV / BewachV.
              </p>
            </div>
          </div>
        )}
      </PageContent>
    </div>
  );
}
