import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { vertexShader, fragmentShader } from "./shaders";

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

export function StarPoints({ data, radiusRef }) {
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
