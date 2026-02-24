import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <span className="text-2xl font-bold text-emerald-600">404</span>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-gray-900">
          Seite nicht gefunden
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
