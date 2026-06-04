import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-response";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { sendVerificationEmail } from "@/lib/verification";
import { registerSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";
import { initializeTrial, provisionStripeCustomer } from "@/lib/subscription";
import { generateUniquePin, hashPin, sendPinEmail } from "@/lib/employee-pin";
import { invitationTokenLookups } from "@/lib/invitation-token";

export const POST = withRoute("/api/auth/register", "POST", async (req) => {
  const _json = await parseJsonBody(req);
  if (!_json.ok) return _json.response;
  const body = _json.data;
  const parsed = validateBody(registerSchema, body);
  if (!parsed.success) return parsed.response;

  const {
    name,
    email,
    password,
    workspaceName,
    invitationToken,
    consentGiven,
  } = parsed.data;

  // Suppress unused var warning — consentGiven is validated by Zod (must be true)
  void consentGiven;

  // Email verification is always required. selectedPlan owners must verify
  // before completing checkout — "payment proves email" is not true until
  // the payment has actually completed, which happens after sign-in.
  // Previously this was skipped for selectedPlan, allowing an attacker to
  // pre-claim any email address with an immediately-verified account.
  const skipVerification = false;

  // If no invitation token, workspace name is required
  if (!invitationToken && !workspaceName) {
    return NextResponse.json(
      { error: "Alle Felder sind erforderlich." },
      { status: 400 },
    );
  }

  // Check if user already exists.
  // Two legitimate scenarios for an existing row:
  //  (1) Truly active account — has password OR linked OAuth Account row.
  //      → registration is blocked (you cannot take over someone's account).
  //  (2) Placeholder / "ghost" row — no password AND no OAuth accounts.
  //      → an invitation-token-bearing user may CLAIM it, setting the
  //        password and joining the inviting workspace. Without a valid
  //        token, still blocked — placeholder rows must not be hijacked.
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  let claimingExistingUser = false;
  if (existingUser) {
    const oauthAccounts = await prisma.account.findMany({
      where: { userId: existingUser.id },
      select: { provider: true },
    });
    const isPlaceholder =
      !existingUser.hashedPassword && oauthAccounts.length === 0;

    if (invitationToken && isPlaceholder) {
      claimingExistingUser = true; // continue to invitation flow below
    } else {
      // Tailor the hint to how the existing account was originally created
      // so we don't tell an OAuth-only user to "reset their password" when
      // they never set one.
      const provider = oauthAccounts[0]?.provider;
      const message = provider
        ? `Diese E-Mail ist bereits mit ${provider === "google" ? "Google" : provider} verknüpft. Bitte melden Sie sich über „${provider === "google" ? "Weiter mit Google" : provider}“ an.`
        : "Ein Konto mit dieser E-Mail existiert bereits. Bitte melden Sie sich an oder nutzen Sie „Passwort vergessen“, falls Sie Ihr Passwort vergessen haben.";
      return NextResponse.json(
        {
          error: "EMAIL_ALREADY_EXISTS",
          message,
          ...(provider ? { provider } : {}),
        },
        { status: 409 },
      );
    }
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // ── Invitation-based registration ──
  if (invitationToken) {
    const invitation = await prisma.invitation.findFirst({
      where: { token: { in: invitationTokenLookups(invitationToken) } },
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

    // Create user in existing workspace + accept invitation.
    // If a placeholder User row exists for this email (no password, no OAuth),
    // claim it in place — set the password, move them into the inviting
    // workspace, and adopt the role from the invitation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      // Race-safe: claim the invitation atomically before any account writes.
      // If a concurrent request (or the OAuth createUser path) already consumed
      // it, count === 0 and we abort — no orphan user is created against a
      // spent invitation.
      const claim = await tx.invitation.updateMany({
        where: { id: invitation.id, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });
      if (claim.count === 0) {
        return null;
      }

      const user =
        claimingExistingUser && existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                name,
                hashedPassword,
                role: invitation.role,
                workspaceId: invitation.workspaceId,
                consentGivenAt: new Date(),
              },
            })
          : await tx.user.create({
              data: {
                name,
                email,
                hashedPassword,
                role: invitation.role,
                workspaceId: invitation.workspaceId,
                consentGivenAt: new Date(),
              },
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

    if (!result) {
      return NextResponse.json(
        { error: "Diese Einladung ist nicht mehr gültig." },
        { status: 410 },
      );
    }

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
        captureRouteError(err, { route: "/api/auth/register", method: "POST" });
      }
    })();

    let emailSendFailed = false;
    try {
      await sendVerificationEmail(email);
    } catch (err) {
      emailSendFailed = true;
      log.error("Failed to send verification email", { error: err });
    }

    return NextResponse.json(
      {
        message: "Konto erfolgreich erstellt.",
        userId: result.user.id,
        requiresVerification: true,
        ...(emailSendFailed ? { emailSendFailed: true } : {}),
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

  // Create Stripe customer now so stripeCustomerId is available at checkout
  // (fire & forget — a failure here never blocks registration)
  void provisionStripeCustomer(result.workspace.id, email, name);

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
      captureRouteError(err, { route: "/api/auth/register", method: "POST" });
    }
  })();

  let emailSendFailed = false;
  try {
    await sendVerificationEmail(email);
  } catch (err) {
    emailSendFailed = true;
    log.error("Failed to send verification email", { error: err });
  }

  return NextResponse.json(
    {
      message: "Konto erfolgreich erstellt.",
      userId: result.user.id,
      requiresVerification: true,
      autoSignIn: false,
      ...(emailSendFailed ? { emailSendFailed: true } : {}),
    },
    { status: 201 },
  );
});
