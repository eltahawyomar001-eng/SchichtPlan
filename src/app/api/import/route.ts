import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import ExcelJS from "exceljs";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

// ── Import limits ──────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 500;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];
const BATCH_SIZE = 50; // rows per createMany batch

/**
 * POST /api/import
 * Import employees or shifts from an uploaded CSV/Excel file.
 * Expects multipart/form-data with:
 *  - file: The .csv or .xlsx file
 *  - type: "employees" | "shifts"
 *
 * Security hardening (H4/M6):
 *  - 5 MB file size limit
 *  - 500 row limit
 *  - File extension validation
 *  - Batch inserts via createMany in a transaction
 *  - Duplicate detection for employees (by email within workspace)
 */
export const POST = withRoute(
  "/api/import",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const forbidden = requirePermission(user, "employees", "create");
    if (forbidden) return forbidden;

    // Check plan feature — CSV import requires paid plan
    const planGate = await requirePlanFeature(
      user.workspaceId!,
      "csvPdfExport",
    );
    if (planGate) return planGate;

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    if (!["employees", "shifts", "time-entries"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'employees', 'shifts', or 'time-entries'" },
        { status: 400 },
      );
    }

    // ── File size guard ──────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Datei zu groß. Maximum: ${MAX_FILE_SIZE / 1024 / 1024} MB`,
          code: "FILE_TOO_LARGE",
        },
        { status: 413 },
      );
    }

    // ── File extension guard ─────────────────────────────────────
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          error: `Ungültiges Dateiformat. Erlaubt: ${ALLOWED_EXTENSIONS.join(", ")}`,
          code: "INVALID_FILE_TYPE",
        },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = new ExcelJS.Workbook();

    if (ext === ".csv") {
      const { Readable } = await import("stream");
      await workbook.csv.read(Readable.from(buffer));
    } else {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "Empty spreadsheet" }, { status: 400 });
    }

    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || "")
        .trim()
        .toLowerCase();
    });

    const rows: Record<string, string>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const obj: Record<string, string> = {};
      row.eachCell((cell, colNumber) => {
        const key = headers[colNumber - 1];
        if (key) obj[key] = String(cell.value || "").trim();
      });
      rows.push(obj);
    });

    // ── Row count guard ──────────────────────────────────────────
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        {
          error: `Zu viele Zeilen (${rows.length}). Maximum: ${MAX_ROWS} Zeilen pro Import.`,
          code: "TOO_MANY_ROWS",
        },
        { status: 400 },
      );
    }

    let created = 0;
    let skipped = 0;
    let duplicates = 0;

    if (type === "employees") {
      // ── Duplicate detection: fetch existing emails in this workspace ──
      const existingEmployees = await prisma.employee.findMany({
        where: { workspaceId: user.workspaceId },
        select: { email: true },
      });
      const existingEmails = new Set(
        existingEmployees
          .map((e: { email: string | null }) => e.email?.toLowerCase())
          .filter(Boolean),
      );

      // Parse and validate all rows first
      const validRows: {
        firstName: string;
        lastName: string;
        email: string | null;
        phone: string | null;
        position: string | null;
        hourlyRate: number | null;
        weeklyHours: number | null;
        color: string;
      }[] = [];

      for (const row of rows) {
        const firstName =
          row["vorname"] || row["firstname"] || row["first_name"];
        const lastName = row["nachname"] || row["lastname"] || row["last_name"];
        if (!firstName || !lastName) {
          skipped++;
          continue;
        }

        const email = (row["email"] || "").toLowerCase() || null;

        // Email is mandatory for employee assignment & billing
        if (!email) {
          skipped++;
          continue;
        }

        if (existingEmails.has(email)) {
          duplicates++;
          continue;
        }

        // Mark email as seen to detect intra-file duplicates
        if (email) existingEmails.add(email);

        validRows.push({
          firstName,
          lastName,
          email,
          phone: row["telefon"] || row["phone"] || null,
          position: row["position"] || row["rolle"] || null,
          hourlyRate:
            row["stundenlohn"] || row["hourlyrate"]
              ? parseFloat(row["stundenlohn"] || row["hourlyrate"])
              : null,
          weeklyHours:
            row["wochenstunden"] || row["weeklyhours"]
              ? parseFloat(row["wochenstunden"] || row["weeklyhours"])
              : null,
          color: `#${Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, "0")}`,
        });
      }

      // Batch insert in a transaction
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          await tx.employee.createMany({
            data: batch.map((r) => ({
              ...r,
              workspaceId: user.workspaceId!,
            })),
            skipDuplicates: true,
          });
        }
      });

      created = validRows.length;
    }

    if (type === "shifts") {
      // Parse and validate all rows first
      const validRows: {
        date: Date;
        startTime: string;
        endTime: string;
        notes: string | null;
      }[] = [];

      for (const row of rows) {
        const date = row["datum"] || row["date"];
        const startTime = row["start"] || row["startzeit"] || row["starttime"];
        const endTime = row["ende"] || row["endzeit"] || row["endtime"];

        if (!date || !startTime || !endTime) {
          skipped++;
          continue;
        }

        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          skipped++;
          continue;
        }

        validRows.push({
          date: parsedDate,
          startTime,
          endTime,
          notes: row["notizen"] || row["notes"] || null,
        });
      }

      // Batch insert in a transaction
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          await tx.shift.createMany({
            data: batch.map((r) => ({
              ...r,
              workspaceId: user.workspaceId!,
            })),
          });
        }
      });

      created = validRows.length;
    }

    if (type === "time-entries") {
      // Build employee lookup by email within this workspace
      const employees = await prisma.employee.findMany({
        where: { workspaceId: user.workspaceId! },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      const emailToId = new Map<string, string>();
      const nameToId = new Map<string, string>();
      for (const emp of employees) {
        if (emp.email) emailToId.set(emp.email.toLowerCase(), emp.id);
        nameToId.set(
          `${emp.firstName.toLowerCase()} ${emp.lastName.toLowerCase()}`,
          emp.id,
        );
        nameToId.set(
          `${emp.lastName.toLowerCase()}, ${emp.firstName.toLowerCase()}`,
          emp.id,
        );
      }

      // Helper to parse HH:MM time strings
      const isValidTime = (t: string) => /^\d{1,2}:\d{2}$/.test(t);

      const validRows: {
        date: Date;
        startTime: string;
        endTime: string;
        breakMinutes: number;
        grossMinutes: number;
        netMinutes: number;
        employeeId: string;
        remarks: string | null;
      }[] = [];

      for (const row of rows) {
        const date = row["datum"] || row["date"];
        const startTime =
          row["start"] || row["startzeit"] || row["starttime"] || row["von"];
        const endTime =
          row["ende"] || row["endzeit"] || row["endtime"] || row["bis"];

        if (!date || !startTime || !endTime) {
          skipped++;
          continue;
        }

        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          skipped++;
          continue;
        }

        if (!isValidTime(startTime) || !isValidTime(endTime)) {
          skipped++;
          continue;
        }

        // Resolve employee
        const empEmail = (row["email"] || row["e-mail"] || "").toLowerCase();
        const empName = (
          row["mitarbeiter"] ||
          row["employee"] ||
          row["name"] ||
          ""
        ).toLowerCase();

        let employeeId: string | undefined;
        if (empEmail && emailToId.has(empEmail)) {
          employeeId = emailToId.get(empEmail);
        } else if (empName && nameToId.has(empName)) {
          employeeId = nameToId.get(empName);
        }

        if (!employeeId) {
          skipped++;
          continue;
        }

        // Calculate minutes
        const breakStr =
          row["pause"] || row["pauseminuten"] || row["break"] || "0";
        const breakMinutes = parseInt(breakStr, 10) || 0;

        const [sH, sM] = startTime.split(":").map(Number);
        const [eH, eM] = endTime.split(":").map(Number);
        let grossMinutes = eH * 60 + eM - (sH * 60 + sM);
        if (grossMinutes < 0) grossMinutes += 24 * 60; // overnight
        const netMinutes = Math.max(0, grossMinutes - breakMinutes);

        validRows.push({
          date: parsedDate,
          startTime: startTime.padStart(5, "0"),
          endTime: endTime.padStart(5, "0"),
          breakMinutes,
          grossMinutes,
          netMinutes,
          employeeId,
          remarks: row["bemerkung"] || row["remarks"] || row["notizen"] || null,
        });
      }

      // Batch insert in a transaction
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          await tx.timeEntry.createMany({
            data: batch.map((r) => ({
              ...r,
              workspaceId: user.workspaceId!,
            })),
          });
        }
      });

      created = validRows.length;
    }

    log.info("[import] Complete", {
      type,
      created,
      skipped,
      duplicates,
      total: rows.length,
      workspaceId: user.workspaceId,
    });

    return NextResponse.json({
      created,
      skipped,
      duplicates,
      total: rows.length,
    });
  },
  { idempotent: true },
);
