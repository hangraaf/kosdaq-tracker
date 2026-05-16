"use client";

export default function LiveBadge({ live }: { live: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "2px 10px",
        fontSize: "0.7rem",
        fontFamily: "var(--mono)",
        fontWeight: 700,
        letterSpacing: "0.08em",
        background: live ? "var(--purple-subtle)" : "rgba(104,107,130,0.10)",
        color: live ? "var(--purple)" : "var(--ink-muted)",
        border: `1px solid ${live ? "var(--purple)" : "var(--ink-soft)"}`,
        borderRadius: "6px",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: live ? "var(--purple)" : "var(--ink-soft)",
          animation: live ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      />
      {live ? "LIVE" : "DEMO"}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </span>
  );
}
