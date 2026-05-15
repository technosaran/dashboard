import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-inter, sans-serif)",
      }}
    >
      <div style={{ maxWidth: "460px", width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontSize: "5rem",
            fontWeight: 900,
            letterSpacing: "-0.06em",
            background: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1,
            marginBottom: "16px",
          }}
        >
          404
        </div>

        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            color: "var(--text-primary, #f1f5f9)",
            marginBottom: "8px",
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "var(--text-secondary, #94a3b8)",
            marginBottom: "32px",
            lineHeight: 1.6,
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            height: "48px",
            padding: "0 28px",
            borderRadius: "14px",
            border: "none",
            background: "var(--gradient-primary, linear-gradient(135deg, #0ea5e9, #38bdf8))",
            color: "white",
            fontSize: "0.875rem",
            fontWeight: 800,
            textDecoration: "none",
            boxShadow: "0 6px 20px rgba(14, 165, 233, 0.25)",
          }}
        >
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
