import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Shiftfy – Intelligente Schichtplanung und Zeiterfassung";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background:
          "linear-gradient(135deg, #047857 0%, #059669 50%, #10b981 100%)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 80,
          height: 80,
          borderRadius: 20,
          background: "rgba(255,255,255,0.2)",
          marginBottom: 24,
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        </svg>
      </div>

      {/* Brand name */}
      <div
        style={{
          display: "flex",
          fontSize: 64,
          fontWeight: 800,
          color: "white",
          letterSpacing: "-0.02em",
          marginBottom: 16,
        }}
      >
        Shiftfy
      </div>

      {/* Tagline */}
      <div
        style={{
          display: "flex",
          fontSize: 28,
          fontWeight: 500,
          color: "rgba(255,255,255,0.85)",
          textAlign: "center",
          maxWidth: 700,
          lineHeight: 1.4,
        }}
      >
        Schichtplanung · Zeiterfassung · Personalmanagement
      </div>

      {/* Subtitle */}
      <div
        style={{
          display: "flex",
          fontSize: 18,
          fontWeight: 400,
          color: "rgba(255,255,255,0.6)",
          marginTop: 16,
        }}
      >
        DSGVO-konform · Made in Germany · Kostenlos starten
      </div>
    </div>,
    { ...size },
  );
}
