import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import ExcelJS from "exceljs";

/**
 * POST /api/import
 * Import employees or shifts from an uploaded CSV/Excel file.
 * Expects multipart/form-data with:
 *  - file: The .csv or .xlsx file
 *  - type: "employees" | "shifts"
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "employees", "create");
    if (forbidden) return forbidden;

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    if (!["employees", "shifts"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'employees' or 'shifts'" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = new ExcelJS.Workbook();

    if (file.name.endsWith(".csv")) {
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

    let created = 0;
    let skipped = 0;

    if (type === "employees") {
      for (const row of rows) {
        const firstName =
          row["vorname"] || row["firstname"] || row["first_name"];
        const lastName = row["nachname"] || row["lastname"] || row["last_name"];
        if (!firstName || !lastName) {
          skipped++;
          continue;
        }

        try {
          await prisma.employee.create({
            data: {
              firstName,
              lastName,
              email: row["email"] || null,
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
              workspaceId: user.workspaceId,
            },
          });
          created++;
        } catch {
          skipped++;
        }
      }
    }

    if (type === "shifts") {
      for (const row of rows) {
        const date = row["datum"] || row["date"];
        const startTime = row["start"] || row["startzeit"] || row["starttime"];
        const endTime = row["ende"] || row["endzeit"] || row["endtime"];

        if (!date || !startTime || !endTime) {
          skipped++;
          continue;
        }

        try {
          await prisma.shift.create({
            data: {
              date: new Date(date),
              startTime,
              endTime,
              notes: row["notizen"] || row["notes"] || null,
              workspaceId: user.workspaceId,
            },
          });
          created++;
        } catch {
          skipped++;
        }
      }
    }

    return NextResponse.json({ created, skipped, total: rows.length });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
