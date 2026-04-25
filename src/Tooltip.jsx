export function TRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ color: "#4a5880", minWidth: 36 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function Tooltip({ info, isMobile, onClose }) {
  if (!info) return null;
  const { star: s, x, y, camDist } = info;
  const name = s.proper || (s.hip ? `HIP ${s.hip}` : s.hd ? `HD ${s.hd}` : "—");
  return (
    <div
      style={{
        position: "fixed",
        ...(isMobile
          ? { left: "50%", top: 16, transform: "translateX(-50%)" }
          : { left: x + 14, top: y - 8 }),
        background: "rgba(4, 4, 18, 0.92)",
        border: "1px solid rgba(60, 100, 255, 0.3)",
        borderRadius: 4,
        padding: "8px 12px",
        fontFamily: "monospace",
        fontSize: "0.7rem",
        color: "#9aaac8",
        pointerEvents: isMobile ? "auto" : "none",
        lineHeight: 1.85,
        zIndex: 200,
        minWidth: 180,
        backdropFilter: "blur(6px)",
      }}
    >
      {isMobile && (
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            background: "none",
            border: "none",
            color: "#5566aa",
            cursor: "pointer",
            fontSize: "1rem",
            fontFamily: "monospace",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
      <div
        style={{
          color: "#e8eeff",
          fontWeight: 700,
          fontSize: "0.8rem",
          marginBottom: 5,
          paddingRight: isMobile ? 18 : 0,
        }}
      >
        {name}
      </div>
      {s.spect && <TRow label="Type" value={s.spect} />}
      <TRow label="Mag" value={s.mag.toFixed(2)} />
      <TRow label="B–V" value={isFinite(s.ci) ? s.ci.toFixed(3) : "—"} />
      <TRow label="Dist" value={`${camDist.toFixed(2)} pc from you`} />
      {s.dist > 0 && <TRow label="Sol" value={`${s.dist.toFixed(2)} pc`} />}
      <div style={{ marginTop: 6, color: "#4a5880", fontSize: "0.62rem" }}>
        {s.x.toFixed(2)}, {s.y.toFixed(2)}, {s.z.toFixed(2)} pc
      </div>
    </div>
  );
}
