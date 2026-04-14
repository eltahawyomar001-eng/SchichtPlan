"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ShiftfyMark,
  ArrowRightIcon,
  ClockIcon,
  CalendarIcon,
  FileExportIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
} from "@/components/icons";

/* ─── Constants ─── */
const PLANNING_SAVINGS_PCT = 0.7; // 70% faster
const TRACKING_SAVINGS_PCT = 0.8; // 80% faster
const PAYROLL_SAVINGS_PCT = 0.6; // 60% faster
const ERROR_REDUCTION_PCT = 0.05; // 5% of labor cost
const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;
const SHIFTFY_PRICE_PER_USER_MONTH = 2.99; // Basic plan

export default function SavingsCalculatorPage() {
  const t = useTranslations("calculator");

  /* ─── Inputs with sensible defaults ─── */
  const [employees, setEmployees] = useState(15);
  const [hourlyRate, setHourlyRate] = useState(18);
  const [hoursPlanning, setHoursPlanning] = useState(4);
  const [hoursTracking, setHoursTracking] = useState(3);
  const [hoursPayroll, setHoursPayroll] = useState(8);

  /* ─── Calculations ─── */
  const results = useMemo(() => {
    const planningHoursSavedYear =
      hoursPlanning * PLANNING_SAVINGS_PCT * WEEKS_PER_YEAR;
    const trackingHoursSavedYear =
      hoursTracking * TRACKING_SAVINGS_PCT * WEEKS_PER_YEAR;
    const payrollHoursSavedYear =
      hoursPayroll * PAYROLL_SAVINGS_PCT * MONTHS_PER_YEAR;

    const totalHoursSaved =
      planningHoursSavedYear + trackingHoursSavedYear + payrollHoursSavedYear;
    const timeMoneySaved = totalHoursSaved * hourlyRate;

    // Error reduction: 5% of annual labor cost
    const annualLaborCost = employees * hourlyRate * 8 * 250; // 250 working days
    const errorSavings = annualLaborCost * ERROR_REDUCTION_PCT;

    const totalMoneySaved = timeMoneySaved + errorSavings;

    const shiftfyCostYear =
      employees * SHIFTFY_PRICE_PER_USER_MONTH * MONTHS_PER_YEAR;
    const netSavings = totalMoneySaved - shiftfyCostYear;

    return {
      planningHoursSavedYear: Math.round(planningHoursSavedYear),
      trackingHoursSavedYear: Math.round(trackingHoursSavedYear),
      payrollHoursSavedYear: Math.round(payrollHoursSavedYear),
      totalHoursSaved: Math.round(totalHoursSaved),
      timeMoneySaved: Math.round(timeMoneySaved),
      errorSavings: Math.round(errorSavings),
      totalMoneySaved: Math.round(totalMoneySaved),
      shiftfyCostYear: Math.round(shiftfyCostYear),
      netSavings: Math.round(netSavings),
      perEmployeeMonth: Math.round(netSavings / employees / MONTHS_PER_YEAR),
    };
  }, [employees, hourlyRate, hoursPlanning, hoursTracking, hoursPayroll]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="h-7 w-7" />
            <span className="font-bold text-base text-gray-900">
              Shift<span className="text-gradient">fy</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            {t("backToHome")}
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 text-gray-500 text-base sm:text-lg max-w-2xl mx-auto">
            {t("heroSubtitle")}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* ─── Left: Inputs ─── */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
            <div className="space-y-6">
              {/* Employees */}
              <InputSlider
                label={t("inputEmployees")}
                value={employees}
                onChange={setEmployees}
                min={1}
                max={200}
                step={1}
                unit=""
              />

              {/* Hourly rate */}
              <InputSlider
                label={t("inputHourlyRate")}
                value={hourlyRate}
                onChange={setHourlyRate}
                min={10}
                max={60}
                step={1}
                unit="€"
              />

              {/* Hours for planning */}
              <InputSlider
                label={t("inputHoursPlanning")}
                value={hoursPlanning}
                onChange={setHoursPlanning}
                min={0}
                max={20}
                step={0.5}
                unit="h"
              />

              {/* Hours for time tracking */}
              <InputSlider
                label={t("inputHoursTimeTracking")}
                value={hoursTracking}
                onChange={setHoursTracking}
                min={0}
                max={20}
                step={0.5}
                unit="h"
              />

              {/* Hours for payroll */}
              <InputSlider
                label={t("inputHoursPayroll")}
                value={hoursPayroll}
                onChange={setHoursPayroll}
                min={0}
                max={40}
                step={1}
                unit="h"
              />
            </div>
          </div>

          {/* ─── Right: Results ─── */}
          <div className="space-y-6">
            {/* Big number cards */}
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 sm:p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                {t("resultTitle")}
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl bg-white border border-emerald-100 p-4 text-center">
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                    {results.totalHoursSaved}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t("resultTimeSaved")}
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-emerald-100 p-4 text-center">
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                    {formatCurrency(results.totalMoneySaved)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t("resultMoneySaved")}
                  </div>
                </div>
              </div>

              {/* Net savings highlight */}
              <div className="rounded-xl bg-emerald-600 p-5 text-center">
                <div className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-1">
                  {t("resultNetSavings")}
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white">
                  {formatCurrency(results.netSavings)}
                </div>
                <div className="text-sm text-emerald-200 mt-1">
                  {formatCurrency(results.perEmployeeMonth)}{" "}
                  {t("resultPerEmployee")}
                </div>
              </div>

              {/* Shiftfy cost line */}
              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <span>{t("resultShiftfyCost")}</span>
                <span className="font-semibold text-gray-700">
                  {formatCurrency(results.shiftfyCostYear)}
                  {t("perYear")}
                </span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">
                {t("resultBreakdown")}
              </h3>
              <div className="space-y-3">
                <BreakdownRow
                  icon={CalendarIcon}
                  label={t("breakdownPlanning")}
                  hours={results.planningHoursSavedYear}
                  amount={formatCurrency(
                    results.planningHoursSavedYear * hourlyRate,
                  )}
                  hoursUnit={t("resultHoursUnit")}
                />
                <BreakdownRow
                  icon={ClockIcon}
                  label={t("breakdownTracking")}
                  hours={results.trackingHoursSavedYear}
                  amount={formatCurrency(
                    results.trackingHoursSavedYear * hourlyRate,
                  )}
                  hoursUnit={t("resultHoursUnit")}
                />
                <BreakdownRow
                  icon={FileExportIcon}
                  label={t("breakdownPayroll")}
                  hours={results.payrollHoursSavedYear}
                  amount={formatCurrency(
                    results.payrollHoursSavedYear * hourlyRate,
                  )}
                  hoursUnit={t("resultHoursUnit")}
                />
                <BreakdownRow
                  icon={ShieldCheckIcon}
                  label={t("breakdownErrors")}
                  hours={null}
                  amount={formatCurrency(results.errorSavings)}
                  hoursUnit={t("resultHoursUnit")}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Assumptions */}
        <div className="mt-10 rounded-xl bg-gray-50 border border-gray-100 p-5">
          <p className="text-xs text-gray-400">
            <strong className="text-gray-500">{t("assumptions")}:</strong>{" "}
            {t("assumptionText")}
          </p>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {t("ctaTitle")}
          </h2>
          <div className="mt-6">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-brand-gradient text-white font-semibold px-8 py-4 rounded-full text-base hover:shadow-xl hover:shadow-emerald-200 transition-all"
            >
              {t("ctaButton")}
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
          </div>
          <p className="mt-3 text-sm text-gray-400">{t("ctaSubNote")}</p>
        </div>
      </main>
    </div>
  );
}

/* ─── Input Slider Component ─── */
function InputSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-1 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1">
          {unit === "€" && unit}
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= min && v <= max) onChange(v);
            }}
            className="w-12 bg-transparent text-center text-sm font-bold text-emerald-700 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={min}
            max={max}
            step={step}
          />
          {unit !== "€" && unit}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>
          {unit === "€" && unit}
          {min}
          {unit !== "€" && unit}
        </span>
        <span>
          {unit === "€" && unit}
          {max}
          {unit !== "€" && unit}
        </span>
      </div>
    </div>
  );
}

/* ─── Breakdown Row ─── */
function BreakdownRow({
  icon: Icon,
  label,
  hours,
  amount,
  hoursUnit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hours: number | null;
  amount: string;
  hoursUnit: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-700">{label}</div>
        {hours !== null && (
          <div className="text-[10px] text-gray-400">
            {hours} {hoursUnit}
          </div>
        )}
      </div>
      <div className="text-sm font-bold text-emerald-700">{amount}</div>
    </div>
  );
}
