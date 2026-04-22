/**
 * Shift planning is included in all paid plans (Basic, Professional, Enterprise).
 * The parent (dashboard)/layout.tsx already gates on hasActiveSubscription, so
 * no additional gating is needed here.
 */
export default function SchichtplanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
