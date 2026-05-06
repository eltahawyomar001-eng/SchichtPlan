import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { sendVerificationEmail } from "@/lib/verification";
import { registerSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { initializeTrial } from "@/lib/subscription";
import { generateUniquePin, hashPin, sendPinEmail } from "@/lib/employee-pin";

export const POST = withRoute("/api/auth/register", "POST", async (req) => {
  const body = await req.json();
  const parsed = validateBody(registerSchema, body);
  if (!parsed.success) return parsed.response;

  const {
    name,
    email,
    password,
    workspaceName,
    invitationToken,
    selectedPlan,
    consentGiven,
  } = parsed.data;

  // Suppress unused var warning — consentGiven is validated by Zod (must be true)
  void consentGiven;

  // Owners signing up with a paid plan skip email verification — Stripe Checkout
  // requires immediate sign-in to call /api/billing/checkout, and a successful
  // payment is itself proof of email ownership.
  const skipVerification = !invitationToken && !!selectedPlan;

  // If no invitation token, workspace name is required
  if (!invitationToken && !workspaceName) {
    return NextResponse.json(
      { error: "Alle Felder sind erforderlich." },
      { status: 400 },
    );
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "Ein Konto mit dieser E-Mail existiert bereits." },
      { status: 409 },
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // ── Invitation-based registration ──
  if (invitationToken) {
    const invitation = await prisma.invitation.findUnique({
      where: { token: invitationToken },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Ungültiger Einladungslink." },
        { status: 400 },
      );
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Diese Einladung ist nicht mehr gültig." },
        { status: 410 },
      );
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Diese Einladung ist abgelaufen." },
        { status: 410 },
      );
    }

    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "E-Mail-Adresse stimmt nicht mit der Einladung überein." },
        { status: 403 },
      );
    }

    // Create user in existing workspace + accept invitation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          hashedPassword,
          role: invitation.role,
          workspaceId: invitation.workspaceId,
          consentGivenAt: new Date(),
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      // Auto-link Employee↔User if an employee with
      // the same email exists in this workspace
      const existingEmployee = await tx.employee.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          workspaceId: invitation.workspaceId,
          userId: null, // not yet linked
        },
      });

      if (existingEmployee) {
        await tx.employee.update({
          where: { id: existingEmployee.id },
          data: { userId: user.id },
        });
      } else {
        // No existing employee — create one and link it
        const nameParts = name.trim().split(/\s+/);
        await tx.employee.create({
          data: {
            firstName: nameParts[0] || name,
            lastName: nameParts.slice(1).join(" ") || "",
            email,
            userId: user.id,
            workspaceId: invitation.workspaceId,
          },
        });
      }

      return { user };
    });

    // ── PIN generation (fire & forget) ──
    (async () => {
      try {
        const emp = await prisma.employee.findFirst({
          where: {
            email: { equals: email, mode: "insensitive" },
            workspaceId: invitation.workspaceId,
            pinHash: null,
          },
          select: { id: true, firstName: true },
        });
        if (emp) {
          const rawPin = await generateUniquePin(invitation.workspaceId);
          const pHash = hashPin(invitation.workspaceId, rawPin);
          await prisma.employee.update({
            where: { id: emp.id },
            data: { pinHash: pHash },
          });
          const ws = await prisma.workspace.findUnique({
            where: { id: invitation.workspaceId },
            select: { name: true },
          });
          await sendPinEmail({
            to: email,
            firstName: emp.firstName,
            rawPin,
            workspaceName: ws?.name ?? "",
          });
        }
      } catch (err) {
        log.error("[register] PIN generation failed (invited)", { error: err });
      }
    })();

    // Send verification email (non-blocking)
    sendVerificationEmail(email).catch((err) =>
      log.error("Failed to send verification email", { error: err }),
    );

    return NextResponse.json(
      {
        message: "Konto erfolgreich erstellt.",
        userId: result.user.id,
        requiresVerification: true,
      },
      { status: 201 },
    );
  }

  // ── Standard registration (create new workspace) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(async (tx: any) => {
    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName!,
        slug: slugify(workspaceName!) + "-" + Date.now().toString(36),
      },
    });

    const user = await tx.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role: "OWNER",
        workspaceId: workspace.id,
        consentGivenAt: new Date(),
        emailVerified: skipVerification ? new Date() : null,
      },
    });

    // Auto-create an Employee profile for the owner so they can use the
    // punch-clock immediately without a manual setup step.
    const nameParts = name.trim().split(/\s+/);
    await tx.employee.create({
      data: {
        firstName: nameParts[0] || name,
        lastName: nameParts.slice(1).join(" ") || "",
        email,
        userId: user.id,
        workspaceId: workspace.id,
        isActive: true,
      },
    });

    // Start the 7-day trial immediately — no checkout required to enter the app.
    await initializeTrial(tx, workspace.id);

    return { user, workspace };
  });

  // ── PIN generation for owner employee (fire & forget) ──
  (async () => {
    try {
      const emp = await prisma.employee.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          workspaceId: result.workspace.id,
          pinHash: null,
        },
        select: { id: true, firstName: true },
      });
      if (emp) {
        const rawPin = await generateUniquePin(result.workspace.id);
        const pHash = hashPin(result.workspace.id, rawPin);
        await prisma.employee.update({
          where: { id: emp.id },
          data: { pinHash: pHash },
        });
        await sendPinEmail({
          to: email,
          firstName: emp.firstName,
          rawPin,
          workspaceName: result.workspace.name,
        });
      }
    } catch (err) {
      log.error("[register] PIN generation failed (owner)", { error: err });
    }
  })();

  // Send verification email (non-blocking) unless the user is going straight to checkout
  if (!skipVerification) {
    sendVerificationEmail(email).catch((err) =>
      log.error("Failed to send verification email", { error: err }),
    );
  }

  return NextResponse.json(
    {
      message: "Konto erfolgreich erstellt.",
      userId: result.user.id,
      requiresVerification: !skipVerification,
      autoSignIn: skipVerification,
    },
    { status: 201 },
  );
});
