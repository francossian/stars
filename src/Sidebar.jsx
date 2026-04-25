import { useState } from "react";

// ─── Glossary data ────────────────────────────────────────────────────────────

const GLOSSARY = [
  {
    title: "MEASUREMENTS & UNITS",
    items: [
      [
        "pc",
        "Parsec — the standard unit of distance in this map. 1 pc = 3.26 light-years ≈ 31 trillion km.",
      ],
      [
        "ly",
        "Light-year — distance light travels in one year (~9.46 trillion km). Not used directly in HYG data, but useful for context.",
      ],
      [
        "Mag",
        "Apparent magnitude — how bright a star looks from Earth. Scale is inverted: lower = brighter. Sun = −26.7. Naked-eye limit ≈ 6.5.",
      ],
      [
        "Abs Mag",
        "Absolute magnitude — intrinsic brightness of a star measured from a standard distance of 10 pc.",
      ],
      [
        "B–V",
        "Color index — blue-band magnitude minus visual magnitude. Negative values = hot blue stars; positive = cool red stars. Sun ≈ +0.66.",
      ],
      [
        "Dist",
        "Distance from Sol (the Sun) to the star, in parsecs, as catalogued in HYG.",
      ],
    ],
  },
  {
    title: "SPECTRAL TYPES",
    subtitle:
      "Harvard classification by surface temperature, hottest → coolest: O B A F G K M",
    items: [
      [
        "O",
        "Hot blue stars  > 30,000 K — extremely rare and luminous (e.g. Mintaka in Orion's Belt).",
      ],
      ["B", "Blue-white stars  10,000–30,000 K (e.g. Rigel, Spica)."],
      ["A", "White stars  7,500–10,000 K (e.g. Sirius, Vega, Altair)."],
      ["F", "Yellow-white stars  6,000–7,500 K (e.g. Procyon, Canopus)."],
      [
        "G",
        "Yellow stars  5,200–6,000 K — Sol (our Sun) is type G2V (e.g. Capella A).",
      ],
      ["K", "Orange stars  3,700–5,200 K (e.g. Arcturus, Aldebaran)."],
      [
        "M",
        "Red dwarfs  < 3,700 K — by far the most common star type in the Milky Way.",
      ],
      ["?", "Unknown or unlisted spectral type in the HYG catalogue."],
    ],
  },
  {
    title: "STAR CATALOGUES",
    items: [
      ["Sol", "The Sun — placed at the origin (0, 0, 0 pc) of this map."],
      [
        "HIP",
        "Hipparcos catalogue — ESA astrometry satellite (1989–1993) that precisely measured parallaxes for ~118,000 stars. Number is the star's ID in that catalogue.",
      ],
      [
        "HD",
        "Henry Draper catalogue — one of the first large spectral surveys, covering ~225,000 stars in the early 20th century.",
      ],
      [
        "HYG",
        "The dataset powering this app — a merged catalogue combining Hipparcos, Yale Bright Star, and Gliese data. Version 4.1 (~120,000 stars).",
      ],
    ],
  },
  {
    title: "NAVIGATION & UI",
    items: [
      [
        "RADIUS",
        "The radius of the visibility sphere in parsecs, centred on your current position. Stars outside this sphere are hidden by the GPU.",
      ],
      ["IN RANGE", "Count of stars falling inside the current radius sphere."],
      [
        "NEAREST",
        "Closest star to your current position, regardless of the radius setting.",
      ],
      [
        "POSITION",
        "Your XYZ coordinates in parsecs, relative to Sol at the origin.",
      ],
      [
        "SPEED",
        "Flight speed in parsecs per second (pc/s). 1 pc/s ≈ 3.26 ly/s.",
      ],
      [
        "WASD",
        "Keyboard keys: W/S move forward/backward, A/D strafe left/right.",
      ],
      [
        "E / Q",
        "Keyboard keys: E moves up, Q moves down, relative to your current orientation.",
      ],
    ],
  },
];

// ─── Radius buttons ───────────────────────────────────────────────────────────

const RADIUS_LEVELS = [
  { ordinal: "I",   value: 1,    label: "1 pc"    },
  { ordinal: "II",  value: 50,   label: "50 pc"   },
  { ordinal: "III", value: 100,  label: "100 pc"  },
  { ordinal: "IV",  value: 500,  label: "500 pc"  },
  { ordinal: "V",   value: 1000, label: "1000 pc" },
  { ordinal: "VI",  value: 1e9,  label: "MAX"     },
];

function RadiusButtons({ value, onChange }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "0.68rem",
          color: "#4a5880",
          letterSpacing: "0.1em",
          marginBottom: 10,
        }}
      >
        VISIBLE RADIUS
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 3 }}>
        {RADIUS_LEVELS.map((lvl) => {
          const active = value === lvl.value;
          return (
            <button
              key={lvl.ordinal}
              onClick={() => onChange(lvl.value)}
              style={{
                background: active ? "#0d1a3a" : "transparent",
                border: `1px solid ${active ? "#3355aa" : "#1a1a3a"}`,
                borderRadius: 3,
                padding: "6px 2px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                transition: "all 0.15s",
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  color: active ? "#aabbff" : "#3a4870",
                }}
              >
                {lvl.ordinal}
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.48rem",
                  color: active ? "#6677aa" : "#3a4870",
                }}
              >
                {lvl.label}
              </span>
            </button>
          );
        })}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "0.56rem",
          color: "#3a4870",
          marginTop: 6,
        }}
      >
        1 pc ≈ 3.26 light-years
      </div>
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Val({ children }) {
  return <span style={{ color: "#8899cc" }}>{children}</span>;
}

function Divider() {
  return <div style={{ borderTop: "1px solid #13132a", margin: "0 -18px" }} />;
}

function SliderControl({ label, value, unit, min, max, step, onChange }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "monospace",
          fontSize: "0.68rem",
          marginBottom: 10,
        }}
      >
        <span style={{ color: "#4a5880", letterSpacing: "0.1em" }}>
          {label}
        </span>
        <span style={{ color: "#8899cc" }}>
          {value} <span style={{ color: "#3a4870" }}>{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="star-slider"
        style={{ width: "100%" }}
      />
    </div>
  );
}

function GlossaryButton({ onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? "#0d0d22" : "transparent",
        border: `1px solid ${hover ? "#223366" : "#13132a"}`,
        borderRadius: 4,
        color: hover ? "#7788cc" : "#4a5880",
        fontFamily: "monospace",
        fontSize: "0.7rem",
        letterSpacing: "0.14em",
        padding: "9px 0",
        cursor: "pointer",
        width: "100%",
        transition: "all 0.18s",
      }}
    >
      ☰ GLOSSARY
    </button>
  );
}

function ResetButton({ onClick, loading }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? "#0d0d22" : "transparent",
        border: `1px solid ${hover ? "#3344aa" : "#1a1a3a"}`,
        borderRadius: 4,
        color: hover ? "#aabbff" : "#5566aa",
        fontFamily: "monospace",
        fontSize: "0.7rem",
        letterSpacing: "0.14em",
        padding: "9px 0",
        cursor: "pointer",
        width: "100%",
        transition: "all 0.18s",
      }}
    >
      {loading ? "LOADING…" : "⊙  RETURN TO SOL"}
    </button>
  );
}

// ─── Glossary modal ───────────────────────────────────────────────────────────

function GlossaryModal({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(2, 2, 14, 0.88)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#07070f",
          border: "1px solid #1a1a3a",
          borderRadius: 8,
          padding: "22px 26px",
          width: 520,
          maxHeight: "82vh",
          overflowY: "auto",
          fontFamily: "monospace",
          position: "relative",
        }}
        className="glossary-scroll"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 22,
          }}
        >
          <div
            style={{
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "0.22em",
            }}
          >
            GLOSSARY
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#5566aa",
              fontSize: "1.3rem",
              cursor: "pointer",
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {GLOSSARY.map((section, si) => (
          <div key={section.title} style={{ marginBottom: 22 }}>
            <div
              style={{
                color: "#4a5880",
                fontSize: "0.58rem",
                letterSpacing: "0.18em",
                marginBottom: section.subtitle ? 5 : 12,
              }}
            >
              {section.title}
            </div>
            {section.subtitle && (
              <div
                style={{
                  color: "#3a4870",
                  fontSize: "0.6rem",
                  marginBottom: 10,
                  lineHeight: 1.5,
                }}
              >
                {section.subtitle}
              </div>
            )}
            {section.items.map(([term, def]) => (
              <div
                key={term}
                style={{
                  display: "flex",
                  gap: 14,
                  marginBottom: 9,
                  fontSize: "0.68rem",
                  lineHeight: 1.55,
                }}
              >
                <div
                  style={{
                    color: "#8899cc",
                    minWidth: 56,
                    flexShrink: 0,
                    paddingTop: 1,
                  }}
                >
                  {term}
                </div>
                <div style={{ color: "#4a5880" }}>{def}</div>
              </div>
            ))}
            {si < GLOSSARY.length - 1 && (
              <div style={{ borderTop: "1px solid #13132a", marginTop: 18 }} />
            )}
          </div>
        ))}

        <div
          style={{
            color: "#3a4870",
            fontSize: "0.56rem",
            textAlign: "center",
            marginTop: 8,
          }}
        >
          click outside to close
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  speed,
  onSpeed,
  radius,
  onRadius,
  onReset,
  loading,
  camPos,
  isMobile,
  isOpen,
}) {
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  if (isMobile && !isOpen) return null;
  return (
    <aside
      className="sidebar-scroll"
      style={{
        width: 220,
        flexShrink: 0,
        background: "#07070f",
        borderRight: "1px solid #13132a",
        display: "flex",
        flexDirection: "column",
        padding: "24px 18px",
        gap: 24,
        userSelect: "none",
        overflowY: "auto",
        ...(isMobile && {
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 100,
          boxShadow: "4px 0 24px rgba(0,0,0,0.7)",
        }),
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <div
          style={{
            color: "#4a58a0",
            fontFamily: "monospace",
            fontSize: "0.58rem",
            letterSpacing: "0.28em",
            marginBottom: 8,
          }}
        >
          ✦ MILKY WAY
        </div>
        <div
          style={{
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "1rem",
            fontWeight: 700,
            letterSpacing: "0.22em",
          }}
        >
          LOOK AT THE STARS
        </div>
      </div>

      <Divider />

      {/* Position */}
      <div
        style={{ fontFamily: "monospace", fontSize: "0.62rem", lineHeight: 2 }}
      >
        <div
          style={{ color: "#4a5880", letterSpacing: "0.12em", marginBottom: 2 }}
        >
          POSITION
        </div>
        <div style={{ color: "#5566aa" }}>
          x <Val>{camPos.x.toFixed(1)}</Val>
        </div>
        <div style={{ color: "#5566aa" }}>
          y <Val>{camPos.y.toFixed(1)}</Val>
        </div>
        <div style={{ color: "#5566aa" }}>
          z <Val>{camPos.z.toFixed(1)}</Val>
        </div>
        <div style={{ color: "#3a4870", fontSize: "0.58rem", marginTop: 4 }}>
          parsecs from Sol
        </div>
      </div>

      <Divider />

      {/* Speed */}
      <SliderControl
        label="SPEED"
        value={speed}
        unit="pc/s"
        min={0.1}
        max={200}
        step={0.1}
        onChange={onSpeed}
      />

      <RadiusButtons value={radius} onChange={onRadius} />

      <Divider />

      {/* Controls hint */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "0.62rem",
          color: "#4a5880",
          lineHeight: 2.1,
        }}
      >
        <div
          style={{ color: "#5566aa", marginBottom: 2, letterSpacing: "0.1em" }}
        >
          CONTROLS
        </div>
        {isMobile ? (
          <>
            <div>Drag — look</div>
            <div>Hold — fly forward</div>
            <div>Pinch — move in/out</div>
            <div>Tap — inspect star</div>
          </>
        ) : (
          <>
            <div>Drag / arrows — look</div>
            <div>WASD &nbsp;— fly</div>
            <div>E / Q &nbsp;— up / down</div>
            <div>Hover — inspect star</div>
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <GlossaryButton onClick={() => setGlossaryOpen(true)} />
      <ResetButton onClick={onReset} loading={loading} />

      {glossaryOpen && <GlossaryModal onClose={() => setGlossaryOpen(false)} />}

      <div
        style={{
          fontFamily: "monospace",
          fontSize: "0.54rem",
          color: "#3a4870",
          lineHeight: 1.7,
          borderTop: "1px solid #0f0f22",
          paddingTop: 12,
          marginTop: 4,
        }}
      >
        <div>dataviz.ar</div>
        <div>Franco Guiragossian</div>
      </div>
    </aside>
  );
}
