import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as d3 from "d3";
import * as THREE from "three";

// ─── Shaders ─────────────────────────────────────────────────────────────────

const vertexShader = `
  attribute float starSize;
  attribute vec3 starColor;
  varying vec3 vColor;
  uniform float uRadius;

  void main() {
    float camDist = length(position - cameraPosition);
    if (camDist > uRadius) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vColor = starColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float d = max(0.001, -mvPosition.z);
    gl_PointSize = clamp(starSize * (500.0 / d), 0.5, 128.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.15, 0.5, d);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// ─── Color mapping ────────────────────────────────────────────────────────────

function bvToRgb(bv) {
  if (!isFinite(bv)) return [1.0, 1.0, 1.0];
  const t = (Math.max(-0.4, Math.min(2.0, bv)) + 0.4) / 2.4;
  const stops = [
    [0.0, [0.5, 0.6, 1.0]],
    [0.25, [0.8, 0.9, 1.0]],
    [0.45, [1.0, 1.0, 1.0]],
    [0.6, [1.0, 0.95, 0.5]],
    [0.75, [1.0, 0.7, 0.2]],
    [1.0, [1.0, 0.2, 0.05]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const u = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      const [r0, g0, b0] = stops[i - 1][1];
      const [r1, g1, b1] = stops[i][1];
      return [r0 + (r1 - r0) * u, g0 + (g1 - g0) * u, b0 + (b1 - b0) * u];
    }
  }
  return stops[stops.length - 1][1];
}

// ─── StarPoints ───────────────────────────────────────────────────────────────

function StarPoints({ data, radiusRef }) {
  const matRef = useRef();

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(data.length * 3);
    const colors = new Float32Array(data.length * 3);
    const sizes = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const s = data[i];
      positions[i * 3] = s.x;
      positions[i * 3 + 1] = s.y;
      positions[i * 3 + 2] = s.z;
      const [r, g, b] = bvToRgb(s.ci);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
      sizes[i] = s.size ?? Math.max(0.5, Math.min(5.0, 5.0 - s.mag * 0.5));
    }
    return { positions, colors, sizes };
  }, [data]);

  const uniforms = useMemo(() => ({ uRadius: { value: 1 } }), []);

  useFrame(() => {
    if (matRef.current)
      matRef.current.uniforms.uRadius.value = radiusRef.current;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-starColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-starSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

// ─── Module-level temp vectors ────────────────────────────────────────────────

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _proj = new THREE.Vector3();

// ─── FlightControls ───────────────────────────────────────────────────────────

const RESET_POS = [0, 0, 1];

function FlightControls({
  speedRef,
  radiusRef,
  starsRef,
  onTooltip,
  resetSignal,
  onCamPos,
}) {
  const { camera, gl } = useThree();
  const cameraRef = useRef(camera);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const drag = useRef({ active: false, x: 0, y: 0 });
  const keys = useRef(new Set());
  const frameCount = useRef(0);

  useEffect(() => {
    camera.position.set(...RESET_POS);
    yaw.current = 0;
    pitch.current = 0;
  }, [resetSignal, camera]);

  useEffect(() => {
    const onDown = (e) => {
      if (e.target.tagName !== "INPUT") keys.current.add(e.code);
    };
    const onUp = (e) => keys.current.delete(e.code);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  useEffect(() => {
    const el = gl.domElement;

    const findStar = (mx, my) => {
      const cam = cameraRef.current;
      if (!cam || !starsRef.current?.length) return;
      const b = el.getBoundingClientRect();
      if (mx < b.left || mx > b.right || my < b.top || my > b.bottom) {
        onTooltip(null);
        return;
      }
      const ndcX = ((mx - b.left) / b.width) * 2 - 1;
      const ndcY = ((my - b.top) / b.height) * -2 + 1;
      const r2 = radiusRef.current * radiusRef.current;
      const camP = cam.position;
      let best = null,
        bestD2 = 0.025 * 0.025,
        bestCamDist = 0;

      for (const s of starsRef.current) {
        const dx = s.x - camP.x,
          dy = s.y - camP.y,
          dz = s.z - camP.z;
        const cd2 = dx * dx + dy * dy + dz * dz;
        if (cd2 > r2) continue;
        _proj.set(s.x, s.y, s.z).project(cam);
        if (_proj.z > 1) continue;
        const sx = _proj.x - ndcX,
          sy = _proj.y - ndcY;
        const sd2 = sx * sx + sy * sy;
        if (sd2 < bestD2) {
          bestD2 = sd2;
          best = s;
          bestCamDist = Math.sqrt(cd2);
        }
      }

      if (best) {
        _proj.set(best.x, best.y, best.z).project(cam);
        const px = ((_proj.x + 1) / 2) * b.width + b.left;
        const py = ((-_proj.y + 1) / 2) * b.height + b.top;
        onTooltip({ star: best, x: px, y: py, camDist: bestCamDist });
      } else {
        onTooltip(null);
      }
    };

    const onDown = (e) => {
      if (e.button !== 0) return;
      drag.current = { active: true, x: e.clientX, y: e.clientY };
    };
    const onMove = (e) => {
      if (drag.current.active) {
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
        yaw.current -= dx * 0.003;
        pitch.current = Math.max(
          -Math.PI * 0.49,
          Math.min(Math.PI * 0.49, pitch.current - dy * 0.003),
        );
      }
      findStar(e.clientX, e.clientY);
    };
    const onUp = () => {
      drag.current.active = false;
    };
    const onLeave = () => onTooltip(null);

    el.addEventListener("mousedown", onDown);
    el.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [gl, radiusRef, starsRef, onTooltip]);

  useFrame((_, dt) => {
    cameraRef.current = camera;
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;

    const d = speedRef.current * dt;
    camera.getWorldDirection(_fwd);
    _right.setFromMatrixColumn(camera.matrix, 0);
    _up.setFromMatrixColumn(camera.matrix, 1);

    const k = keys.current;
    if (k.has("KeyW")) camera.position.addScaledVector(_fwd, d);
    if (k.has("KeyS")) camera.position.addScaledVector(_fwd, -d);
    if (k.has("KeyA")) camera.position.addScaledVector(_right, -d);
    if (k.has("KeyD")) camera.position.addScaledVector(_right, d);
    if (k.has("KeyE")) camera.position.addScaledVector(_up, d);
    if (k.has("KeyQ")) camera.position.addScaledVector(_up, -d);

    const rot = 1.2 * dt;
    if (k.has("ArrowLeft")) yaw.current += rot;
    if (k.has("ArrowRight")) yaw.current -= rot;
    if (k.has("ArrowUp"))
      pitch.current = Math.max(-Math.PI * 0.49, pitch.current - rot);
    if (k.has("ArrowDown"))
      pitch.current = Math.min(Math.PI * 0.49, pitch.current + rot);

    // Camera pos → sidebar (every 20 frames) and HUD (every 60 frames, throttled)
    frameCount.current++;
    if (frameCount.current % 60 === 0) {
      onCamPos({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      });
    }
  });

  return null;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ info }) {
  if (!info) return null;
  const { star: s, x, y, camDist } = info;
  const name = s.proper || (s.hip ? `HIP ${s.hip}` : s.hd ? `HD ${s.hd}` : "—");
  return (
    <div
      style={{
        position: "fixed",
        left: x + 14,
        top: y - 8,
        background: "rgba(4, 4, 18, 0.92)",
        border: "1px solid rgba(60, 100, 255, 0.3)",
        borderRadius: 4,
        padding: "8px 12px",
        fontFamily: "monospace",
        fontSize: "0.7rem",
        color: "#9aaac8",
        pointerEvents: "none",
        lineHeight: 1.85,
        zIndex: 200,
        minWidth: 180,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          color: "#e8eeff",
          fontWeight: 700,
          fontSize: "0.8rem",
          marginBottom: 5,
        }}
      >
        {name}
      </div>
      {s.spect && <TRow label="Type" value={s.spect} />}
      <TRow label="Mag" value={s.mag.toFixed(2)} />
      <TRow label="B–V" value={isFinite(s.ci) ? s.ci.toFixed(3) : "—"} />
      <TRow label="Dist" value={`${camDist.toFixed(2)} pc from you`} />
      {s.dist > 0 && <TRow label="Sol" value={`${s.dist.toFixed(2)} pc`} />}
      <div style={{ marginTop: 6, color: "#3a4060", fontSize: "0.62rem" }}>
        {s.x.toFixed(2)}, {s.y.toFixed(2)}, {s.z.toFixed(2)} pc
      </div>
    </div>
  );
}

function TRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ color: "#4a5880", minWidth: 36 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ─── HUD (bottom-left overlay) ────────────────────────────────────────────────

const SPEC_ORDER = ["O", "B", "A", "F", "G", "K", "M", "?"];
const SPEC_COLORS = {
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

function HUD({ data }) {
  if (!data) return null;
  const { count, spectral, nearestStar, nearestDist } = data;
  const total = Object.values(spectral).reduce((a, b) => a + b, 0);
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
      <div
        style={{ color: "#2a3460", letterSpacing: "0.12em", marginBottom: 8 }}
      >
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
        <div
          style={{ color: "#2a3460", letterSpacing: "0.12em", marginBottom: 7 }}
        >
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
              color: "#2a3460",
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

          {/* Legend rows */}
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
                <span style={{ color: "#2a3460", width: 12 }}>{t}</span>
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
                      width: `${(spectral[t] / total) * 100}%`,
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

// ─── D-pad ────────────────────────────────────────────────────────────────────



// ─── Glossary ─────────────────────────────────────────────────────────────────

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
        "Apparent magnitude — how bright a star looks from Earth. Scale is inverted: lower = brighter. Sun = −26.7. Naked-eye limit ≈ 6.5. This app shows stars up to mag 8.",
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
        "LOOK",
        "D-pad buttons that rotate the camera (same as physical arrow keys).",
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
        {/* Header */}
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
                color: "#2a3460",
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
            color: "#1e2440",
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

function Sidebar({
  speed,
  onSpeed,
  radius,
  onRadius,
  onReset,
  loading,
  camPos,
}) {
  const [glossaryOpen, setGlossaryOpen] = useState(false);
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
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <div
          style={{
            color: "#2a3580",
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
          style={{ color: "#2a3050", letterSpacing: "0.12em", marginBottom: 2 }}
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
        <div style={{ color: "#1e2444", fontSize: "0.58rem", marginTop: 4 }}>
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

      {/* Radius */}
      <SliderControl
        label="VISIBLE RADIUS"
        value={radius}
        unit="pc"
        min={1}
        max={5000}
        step={1}
        onChange={onRadius}
        note="1 pc ≈ 3.26 light-years"
      />

      <Divider />

      {/* Controls hint */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "0.62rem",
          color: "#2a3050",
          lineHeight: 2.1,
        }}
      >
        <div
          style={{ color: "#333a60", marginBottom: 2, letterSpacing: "0.1em" }}
        >
          CONTROLS
        </div>
        <div>Drag / arrows — look</div>
        <div>WASD &nbsp;— fly</div>
        <div>E / Q &nbsp;— up / down</div>
        <div>Hover — inspect star</div>
      </div>

      <div style={{ flex: 1 }} />

      <GlossaryButton onClick={() => setGlossaryOpen(true)} />
      <ResetButton onClick={onReset} loading={loading} />

      {glossaryOpen && <GlossaryModal onClose={() => setGlossaryOpen(false)} />}

      <div
        style={{
          fontFamily: "monospace",
          fontSize: "0.54rem",
          color: "#1e2240",
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

function Val({ children }) {
  return <span style={{ color: "#8899cc" }}>{children}</span>;
}

function Divider() {
  return <div style={{ borderTop: "1px solid #13132a", margin: "0 -18px" }} />;
}

function SliderControl({ label, value, unit, min, max, step, onChange, note }) {
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
      {note && (
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "0.56rem",
            color: "#1e2440",
            marginTop: 6,
          }}
        >
          {note}
        </div>
      )}
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
        color: hover ? "#7788cc" : "#3a4870",
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

// ─── HUD data computation ─────────────────────────────────────────────────────

function computeHud(stars, camPos, radius) {
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

// ─── Main ─────────────────────────────────────────────────────────────────────

const SUN = {
  x: 0,
  y: 0,
  z: 0,
  mag: 4.85,
  ci: 0.656,
  dist: 0,
  size: 8,
  proper: "Sol",
  hip: "",
  hd: "",
  spect: "G2V",
};

export default function StarMap() {
  const [stars, setStars] = useState(null);
  const [speed, setSpeed] = useState(2);
  const [radius, setRadius] = useState(1);
  const [tooltip, setTooltip] = useState(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [camPos, setCamPos] = useState({ x: 0, y: 0, z: 1 });

  const speedRef = useRef(speed);
  const radiusRef = useRef(radius);
  const starsRef = useRef(null);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    radiusRef.current = radius;
  }, [radius]);

  useEffect(() => {
    d3.csv("/hygdata_v41.csv").then((raw) => {
      const filtered = raw
        .filter((d) => isFinite(+d.mag) && +d.mag < 8 && +d.dist > 0)
        .map((d) => ({
          x: +d.x,
          y: +d.y,
          z: +d.z,
          mag: +d.mag,
          ci: +d.ci,
          dist: +d.dist,
          proper: d.proper || "",
          spect: d.spect || "",
          hip: d.hip || "",
          hd: d.hd || "",
        }));
      const all = [SUN, ...filtered];
      starsRef.current = all;
      setStars(all);
    });
  }, []);

  // Throttled: camPos updates every 60 frames (~1×/sec), so this O(n) scan
  // runs at most 1×/sec regardless of how fast the camera is moving.
  const hudData = useMemo(
    () => (stars ? computeHud(stars, camPos, radius) : null),
    [stars, camPos, radius],
  );

  const handleTooltip = useCallback((info) => setTooltip(info), []);
  const handleReset = useCallback(() => setResetSignal((n) => n + 1), []);
  const handleCamPos = useCallback((p) => setCamPos(p), []);

  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        background: "#05050f",
        overflow: "hidden",
      }}
    >
      <Sidebar
        speed={speed}
        onSpeed={setSpeed}
        radius={radius}
        onRadius={setRadius}
        onReset={handleReset}
        loading={!stars}
        camPos={camPos}
      />

      <div style={{ flex: 1, position: "relative", background: "#000" }}>
        <Canvas
          style={{ background: "#000", cursor: "crosshair" }}
          camera={{ position: RESET_POS, fov: 75, near: 0.001, far: 100000 }}
        >
          <FlightControls
            speedRef={speedRef}
            radiusRef={radiusRef}
            starsRef={starsRef}
            onTooltip={handleTooltip}
            resetSignal={resetSignal}
            onCamPos={handleCamPos}
          />
          {stars && <StarPoints data={stars} radiusRef={radiusRef} />}
        </Canvas>

        {!stars && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                color: "#2a3050",
                fontFamily: "monospace",
                fontSize: "0.78rem",
                letterSpacing: "0.2em",
              }}
            >
              LOADING CATALOGUE…
            </span>
          </div>
        )}

        <HUD data={hudData} />

      </div>

      <Tooltip info={tooltip} />
    </div>
  );
}
