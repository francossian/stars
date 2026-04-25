import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as d3 from "d3";
import { FlightControls, CameraResizer, RESET_POS } from "./FlightControls";
import { StarPoints } from "./StarPoints";
import { HUD, computeHud } from "./HUD";
import { Sidebar } from "./Sidebar";
import { Tooltip } from "./Tooltip";

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
  const [isMobile] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const speedRef = useRef(speed);
  const radiusRef = useRef(radius);
  const starsRef = useRef(null);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { radiusRef.current = radius; }, [radius]);

  useEffect(() => {
    d3.csv("/hygdata_v41.csv").then((raw) => {
      const filtered = raw
        .filter((d) => isFinite(+d.mag) && +d.dist > 0)
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
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99,
            background: "rgba(0,0,0,0.4)",
          }}
        />
      )}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          style={{
            position: "fixed",
            top: 14,
            left: 14,
            zIndex: 101,
            background: "rgba(7,7,15,0.88)",
            border: "1px solid #1a1a3a",
            borderRadius: 6,
            color: "#7788cc",
            fontFamily: "monospace",
            fontSize: "1.2rem",
            width: 40,
            height: 40,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {sidebarOpen ? "✕" : "☰"}
        </button>
      )}

      <Sidebar
        speed={speed}
        onSpeed={setSpeed}
        radius={radius}
        onRadius={setRadius}
        onReset={handleReset}
        loading={!stars}
        camPos={camPos}
        isMobile={isMobile}
        isOpen={sidebarOpen}
      />

      <div style={{ flex: 1, position: "relative", background: "#000" }}>
        <Canvas
          style={{ background: "#000", cursor: "crosshair" }}
          camera={{ position: RESET_POS, fov: 75, near: 0.001, far: 100000 }}
        >
          <CameraResizer />
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
                color: "#4a5880",
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

      <Tooltip info={tooltip} isMobile={isMobile} onClose={() => setTooltip(null)} />
    </div>
  );
}
