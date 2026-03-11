/**
 * prisma/seed.ts — Seed script for local development.
 *
 * Run via: npx prisma db seed
 * Requires: tsx (already in devDependencies)
 *
 * Creates a demo workspace with employees, shifts, and time entries
 * for local development and testing.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── 1. Create demo owner user ──────────────────────────────────
  const hashedPassword = await bcrypt.hash("Demo1234!", 12);

  const workspace = await prisma.workspace.create({
    data: {
      name: "Demo GmbH",
      slug: "demo-gmbh",
      industry: "Gastronomie",
      bundesland: "NW",
      onboardingCompleted: true,
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: "Max Mustermann",
      email: "owner@demo.de",
      hashedPassword,
      role: "OWNER",
      emailVerified: new Date(),
      consentGivenAt: new Date(),
      workspaceId: workspace.id,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "Anna Admin",
      email: "admin@demo.de",
      hashedPassword,
      role: "ADMIN",
      emailVerified: new Date(),
      consentGivenAt: new Date(),
      workspaceId: workspace.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: "Maria Manager",
      email: "manager@demo.de",
      hashedPassword,
      role: "MANAGER",
      emailVerified: new Date(),
      consentGivenAt: new Date(),
      workspaceId: workspace.id,
    },
  });

  // ── 2. Subscription (BASIC / free) ─────────────────────────────
  await prisma.subscription.create({
    data: {
      plan: "BASIC",
      status: "ACTIVE",
      seatCount: 5,
      workspaceId: workspace.id,
    },
  });

  // ── 3. Location + Department ───────────────────────────────────
  const location = await prisma.location.create({
    data: {
      name: "Hauptstandort",
      address: "Musterstraße 1, 50667 Köln",
      workspaceId: workspace.id,
    },
  });

  const department = await prisma.department.create({
    data: {
      name: "Service",
      color: "#059669",
      locationId: location.id,
      workspaceId: workspace.id,
    },
  });

  // ── 4. Employees ──────────────────────────────────────────────
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        firstName: "Max",
        lastName: "Mustermann",
        email: "owner@demo.de",
        position: "Geschäftsführer",
        hourlyRate: 25.0,
        weeklyHours: 40,
        contractType: "VOLLZEIT",
        color: "#059669",
        workspaceId: workspace.id,
        userId: owner.id,
        departmentId: department.id,
      },
    }),
    prisma.employee.create({
      data: {
        firstName: "Anna",
        lastName: "Admin",
        email: "admin@demo.de",
        position: "Büroleiterin",
        hourlyRate: 20.0,
        weeklyHours: 40,
        contractType: "VOLLZEIT",
        color: "#3B82F6",
        workspaceId: workspace.id,
        userId: admin.id,
        departmentId: department.id,
      },
    }),
    prisma.employee.create({
      data: {
        firstName: "Maria",
        lastName: "Manager",
        email: "manager@demo.de",
        position: "Schichtleiterin",
        hourlyRate: 18.0,
        weeklyHours: 30,
        contractType: "TEILZEIT",
        color: "#F59E0B",
        workspaceId: workspace.id,
        userId: manager.id,
        departmentId: department.id,
      },
    }),
    prisma.employee.create({
      data: {
        firstName: "Lukas",
        lastName: "Servicekraft",
        email: "lukas@demo.de",
        position: "Servicemitarbeiter",
        hourlyRate: 14.0,
        weeklyHours: 20,
        contractType: "MINIJOB",
        color: "#EF4444",
        workspaceId: workspace.id,
        departmentId: department.id,
      },
    }),
    prisma.employee.create({
      data: {
        firstName: "Sophie",
        lastName: "Küche",
        email: "sophie@demo.de",
        position: "Köchin",
        hourlyRate: 16.0,
        weeklyHours: 40,
        contractType: "VOLLZEIT",
        color: "#8B5CF6",
        workspaceId: workspace.id,
        departmentId: department.id,
      },
    }),
  ]);

  // ── 5. Shift templates ────────────────────────────────────────
  await Promise.all([
    prisma.shiftTemplate.create({
      data: {
        name: "Frühschicht",
        startTime: "06:00",
        endTime: "14:00",
        color: "#FCD34D",
        locationId: location.id,
        workspaceId: workspace.id,
      },
    }),
    prisma.shiftTemplate.create({
      data: {
        name: "Spätschicht",
        startTime: "14:00",
        endTime: "22:00",
        color: "#60A5FA",
        locationId: location.id,
        workspaceId: workspace.id,
      },
    }),
    prisma.shiftTemplate.create({
      data: {
        name: "Nachtschicht",
        startTime: "22:00",
        endTime: "06:00",
        color: "#A78BFA",
        locationId: location.id,
        workspaceId: workspace.id,
      },
    }),
  ]);

  // ── 6. Demo shifts for next 7 days ────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 0; d < 7; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);

    // Skip weekends for demo
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (let i = 0; i < Math.min(employees.length, 3); i++) {
      const startTimes = ["06:00", "14:00", "10:00"];
      const endTimes = ["14:00", "22:00", "18:00"];
      await prisma.shift.create({
        data: {
          date,
          startTime: startTimes[i],
          endTime: endTimes[i],
          status: "SCHEDULED",
          employeeId: employees[i].id,
          locationId: location.id,
          workspaceId: workspace.id,
        },
      });
    }
  }

  // ── 7. Vacation balances ──────────────────────────────────────
  const currentYear = new Date().getFullYear();
  for (const emp of employees) {
    await prisma.vacationBalance.create({
      data: {
        year: currentYear,
        totalEntitlement: emp.contractType === "VOLLZEIT" ? 30 : 20,
        remaining: emp.contractType === "VOLLZEIT" ? 30 : 20,
        employeeId: emp.id,
        workspaceId: workspace.id,
      },
    });
  }

  // ── 8. Workspace usage ────────────────────────────────────────
  await prisma.workspaceUsage.create({
    data: {
      userSlotsTotal: 10,
      workspaceId: workspace.id,
    },
  });

  console.log("✅ Seed complete!");
  console.log(`   Workspace: ${workspace.name} (${workspace.slug})`);
  console.log(`   Owner:     ${owner.email} / Demo1234!`);
  console.log(`   Admin:     ${admin.email} / Demo1234!`);
  console.log(`   Manager:   ${manager.email} / Demo1234!`);
  console.log(`   Employees: ${employees.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
