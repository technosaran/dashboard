"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#06080f",
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          color: "#f1f5f9",
        }}
      >
        <div style={{ maxWidth: "460px", width: "100%", textAlign: "center" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 24px",
              borderRadius: "20px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="28"
              height="28"
              fill="none"
              stroke="#ef4444"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              marginBottom: "8px",
            }}
          >
            Critical Error
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#94a3b8",
              marginBottom: "32px",
              lineHeight: 1.6,
            }}
          >
            A critical error occurred at the application level. Your data is
            safe. Please try refreshing the page.
          </p>

          {error.digest && (
            <p
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "#475569",
                marginBottom: "24px",
                fontFamily: "monospace",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}

          <button type="button"
            onClick={reset}
            style={{
              height: "48px",
              padding: "0 28px",
              borderRadius: "14px",
              border: "none",
              background: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(14, 165, 233, 0.25)",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
