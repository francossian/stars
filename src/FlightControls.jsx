import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _proj = new THREE.Vector3();

export const RESET_POS = [0, 0, 1];

export function CameraResizer() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

export function FlightControls({
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
  const touch = useRef({ active: false, x: 0, y: 0, t: 0, moved: 0 });
  const holdTimer = useRef(null);
  const holdActive = useRef(false);
  const pinchRef = useRef({ active: false, dist: 0 });
  const pinchDelta = useRef(0);

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

    const onTouchStart = (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touch.current = { active: true, x: t.clientX, y: t.clientY, t: Date.now(), moved: 0 };
        clearTimeout(holdTimer.current);
        holdActive.current = false;
        holdTimer.current = setTimeout(() => {
          if (touch.current.moved < 18) holdActive.current = true;
        }, 350);
      } else if (e.touches.length >= 2) {
        clearTimeout(holdTimer.current);
        holdActive.current = false;
        touch.current.active = false;
        const t0 = e.touches[0], t1 = e.touches[1];
        const dx = t0.clientX - t1.clientX, dy = t0.clientY - t1.clientY;
        pinchRef.current = { active: true, dist: Math.sqrt(dx * dx + dy * dy) };
      }
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && touch.current.active) {
        const t = e.touches[0];
        const dx = t.clientX - touch.current.x;
        const dy = t.clientY - touch.current.y;
        touch.current.moved += Math.sqrt(dx * dx + dy * dy);
        touch.current.x = t.clientX;
        touch.current.y = t.clientY;
        if (touch.current.moved > 18 && !holdActive.current) clearTimeout(holdTimer.current);
        yaw.current -= dx * 0.005;
        pitch.current = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.49, pitch.current - dy * 0.005));
      } else if (e.touches.length >= 2 && pinchRef.current.active) {
        const t0 = e.touches[0], t1 = e.touches[1];
        const dx = t0.clientX - t1.clientX, dy = t0.clientY - t1.clientY;
        const newDist = Math.sqrt(dx * dx + dy * dy);
        pinchDelta.current += (newDist - pinchRef.current.dist) * 0.02;
        pinchRef.current.dist = newDist;
      }
    };
    const onTouchEnd = (e) => {
      e.preventDefault();
      clearTimeout(holdTimer.current);
      if (e.touches.length === 0) {
        if (touch.current.active && !holdActive.current) {
          const elapsed = Date.now() - touch.current.t;
          if (elapsed < 250 && touch.current.moved < 18) findStar(touch.current.x, touch.current.y);
        }
        holdActive.current = false;
        touch.current.active = false;
        pinchRef.current.active = false;
      } else if (e.touches.length === 1) {
        pinchRef.current.active = false;
        const t = e.touches[0];
        touch.current = { active: true, x: t.clientX, y: t.clientY, t: Date.now(), moved: 0 };
        holdActive.current = false;
      }
    };

    el.addEventListener("mousedown", onDown);
    el.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
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
    if (holdActive.current) camera.position.addScaledVector(_fwd, d);
    if (pinchDelta.current !== 0) {
      camera.position.addScaledVector(_fwd, pinchDelta.current);
      pinchDelta.current = 0;
    }

    const rot = 1.2 * dt;
    if (k.has("ArrowLeft")) yaw.current += rot;
    if (k.has("ArrowRight")) yaw.current -= rot;
    if (k.has("ArrowUp"))
      pitch.current = Math.max(-Math.PI * 0.49, pitch.current - rot);
    if (k.has("ArrowDown"))
      pitch.current = Math.min(Math.PI * 0.49, pitch.current + rot);

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
