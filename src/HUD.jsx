export const SPEC_ORDER = ["O", "B", "A", "F", "G", "K", "M", "?"];
export const SPEC_COLORS = {
  O: "#9bb0ff",
  B: "#aabfff",
  A: "#e0e8ff",
  F: "#fffde8",
  G: "#fff4c2",
  K: "#ffd2a1",
  M: "#ffad60",
  "?": "#2a2a44",
};
const SPEC_LABEL = {
  O: "hot blue",
  B: "blue",
  A: "white",
  F: "yellow-white",
  G: "yellow",
  K: "orange",
  M: "red dwarf",
  "?": "unknown",
};

export function computeHud(stars, camPos, radius) {
  const r2 = radius * radius;
  const spectral = {};
  let count = 0;
  let nearestDist = Infinity,
    nearestStar = null;

  for (const s of stars) {
    const dx = s.x - camPos.x,
      dy = s.y - camPos.y,
      dz = s.z - camPos.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    const d = Math.sqrt(d2);

    if (d < nearestDist) {
      nearestDist = d;
      nearestStar = s;
    }

    if (d2 <= r2) {
      count++;
      const t = s.spect?.[0]?.toUpperCase() || "?";
      const key = "OBAFGKM".includes(t) ? t : "?";
      spectral[key] = (spectral[key] || 0) + 1;
    }
  }

  return { count, spectral, nearestStar, nearestDist };
}

export function HUD({ data }) {
  if (!data) return null;
  const { count, spectral, nearestStar, nearestDist } = data;
  const total = Object.values(spectral).reduce((a, b) => a + b, 0);
  const maxCount = Object.values(spectral).reduce((a, b) => Math.max(a, b), 0);
  const nearName = nearestStar
    ? nearestStar.proper ||
      (nearestStar.hip
        ? `HIP ${nearestStar.hip}`
        : nearestStar.hd
          ? `HD ${nearestStar.hd}`
          : "—")
    : "—";

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        background: "rgba(4, 4, 18, 0.82)",
        border: "1px solid #13132a",
        borderRadius: 6,
        padding: "12px 14px",
        fontFamily: "monospace",
        fontSize: "0.65rem",
        color: "#5566aa",
        pointerEvents: "none",
        minWidth: 190,
        maxWidth: 220,
        backdropFilter: "blur(8px)",
        lineHeight: 1,
      }}
    >
      {/* Stars in range */}
      <div style={{ color: "#4a5880", letterSpacing: "0.12em", marginBottom: 8 }}>
        IN RANGE
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          marginBottom: 14,
        }}
      >
        <span style={{ color: "#c8d8ff", fontSize: "1.6rem", fontWeight: 700 }}>
          {count.toLocaleString()}
        </span>
        <span style={{ color: "#3a4870" }}>stars</span>
      </div>

      {/* Nearest star */}
      <div
        style={{
          borderTop: "1px solid #13132a",
          paddingTop: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ color: "#4a5880", letterSpacing: "0.12em", marginBottom: 7 }}>
          NEAREST
        </div>
        <div style={{ color: "#8899cc", marginBottom: 3 }}>{nearName}</div>
        {nearestStar && (
          <div style={{ color: "#3a4870" }}>
            {nearestDist.toFixed(3)} pc away
          </div>
        )}
      </div>

      {/* Spectral type breakdown */}
      {total > 0 && (
        <div style={{ borderTop: "1px solid #13132a", paddingTop: 10 }}>
          <div
            style={{
              color: "#4a5880",
              letterSpacing: "0.12em",
              marginBottom: 9,
            }}
          >
            STAR TYPES
          </div>

          {/* Stacked bar */}
          <div
            style={{
              display: "flex",
              height: 5,
              borderRadius: 3,
              overflow: "hidden",
              marginBottom: 10,
              gap: 1,
            }}
          >
            {SPEC_ORDER.map((t) =>
              !spectral[t] ? null : (
                <div
                  key={t}
                  title={`${t}: ${SPEC_LABEL[t]} — ${spectral[t]} stars`}
                  style={{
                    flex: spectral[t],
                    background: SPEC_COLORS[t],
                    minWidth: spectral[t] / total > 0.01 ? 2 : 0,
                  }}
                />
              ),
            )}
          </div>

          {/* Legend rows — bar width is relative to the most common type */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {SPEC_ORDER.filter((t) => spectral[t]).map((t) => (
              <div
                key={t}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 1,
                    background: SPEC_COLORS[t],
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "#4a5880", width: 12 }}>{t}</span>
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: "#0d0d22",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(spectral[t] / maxCount) * 100}%`,
                      height: "100%",
                      background: SPEC_COLORS[t],
                      opacity: 0.5,
                    }}
                  />
                </div>
                <span
                  style={{ color: "#4a5880", textAlign: "right", minWidth: 32 }}
                >
                  {spectral[t].toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
