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
        background: live ? "rgba(181,69,63,0.12)" : "rgba(67,107,149,0.12)",
        color: live ? "#B5453F" : "#436B95",
        border: `1px solid ${live ? "#B5453F" : "#436B95"}`,
        borderRadius: "2px",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: live ? "#B5453F" : "#436B95",
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
