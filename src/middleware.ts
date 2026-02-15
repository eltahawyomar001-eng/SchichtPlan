import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Protect all dashboard routes
    "/dashboard/:path*",
    "/schichtplan/:path*",
    "/mitarbeiter/:path*",
    "/standorte/:path*",
    "/einstellungen/:path*",
    "/zeiterfassung/:path*",
    "/abwesenheiten/:path*",
    "/schichttausch/:path*",
    "/verfuegbarkeiten/:path*",
    "/zeitkonten/:path*",
    "/lohnexport/:path*",
    // Protect API routes (except auth)
    "/api/employees/:path*",
    "/api/locations/:path*",
    "/api/shifts/:path*",
    "/api/absences/:path*",
    "/api/availability/:path*",
    "/api/shift-swaps/:path*",
    "/api/time-entries/:path*",
    "/api/time-accounts/:path*",
    "/api/notifications/:path*",
    "/api/notification-preferences/:path*",
    "/api/profile/:path*",
    "/api/export/:path*",
    "/api/automations/:path*",
    "/api/test-email/:path*",
  ],
};
