import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "omarragehfulda@gmail.com" },
    select: { workspaceId: true, name: true },
  });
  console.log("user:", user);
  if (!user?.workspaceId) {
    console.log("not found");
    return;
  }

  const current = await prisma.subscription.findUnique({
    where: { workspaceId: user.workspaceId },
  });
  console.log(
    "current plan:",
    current?.plan,
    "status:",
    current?.status,
    "priceId:",
    current?.stripePriceId,
  );

  const updated = await prisma.subscription.update({
    where: { workspaceId: user.workspaceId },
    data: {
      plan: "BASIC",
      status: "ACTIVE",
      stripePriceId: null,
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      cancelAtPeriodEnd: false,
    },
  });
  console.log("✓ repaired → plan:", updated.plan, "status:", updated.status);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
