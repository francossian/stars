# Star Explorer

An interactive 3D star map built with React and Three.js, powered by the HYG v4.1 stellar catalogue. Fly freely through the solar neighbourhood, inspect individual stars, and filter the visible sky by distance.

![Star Explorer](public/favicon.svg)

## Features

- **120 000+ stars** rendered as GPU points
- **B–V color mapping** — each star is colored by its spectral temperature, from deep blue (O-type) through white, yellow, orange to red (M-type)
- **Distance-based culling** — a radius slider controls a GPU-side visibility sphere; only stars within range are rendered, with zero JS overhead per frame
- **Free-flight navigation** — drag to look, WASD to fly, E/Q to move vertically, arrow keys to rotate; no fixed pivot point
- **Star tooltip** — hover any in-range star to see its name, spectral type, magnitude, B–V index, and distance from your position and from Sol
- **Live HUD** — bottom-left panel shows stars in range, nearest star, and a spectral-type breakdown bar
- **Glossary** — in-app reference for every abbreviated term (pc, Mag, B–V, spectral types, catalogue IDs, etc.)
- **Sol marker** — the Sun is always rendered at the origin with a distinct warm-white point

## Dataset

**HYG v4.1** — a merged catalogue combining:
- **H**ipparcos (ESA astrometry satellite, ~118 000 stars with precise parallax)
- **Y**ale Bright Star Catalogue
- **G**liese Catalogue of Nearby Stars

Stars are stored in Cartesian coordinates (parsecs, Sun at origin). More info: [astronexus/HYG-Database](https://github.com/astronexus/HYG-Database)

## Navigation

| Input | Action |
|---|---|
| Click + drag | Look around |
| W / S | Fly forward / backward |
| A / D | Strafe left / right |
| E / Q | Move up / down |
| Arrow keys or D-pad | Rotate view |
| Radius buttons (I–VI) | Expand / shrink the visible star sphere (1 pc → MAX) |
| Speed slider | Set flight speed (0.1 – 200 pc/s) |
| Return to Sol | Reset position to 1 pc from the Sun |

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 19 + Vite |
| 3D rendering | Three.js via `@react-three/fiber` |
| Helpers | `@react-three/drei` (OrbitControls base) |
| Data loading | D3 (`d3.csv`) |
| Shaders | Custom GLSL — per-vertex color, size attenuation, GPU radius cull |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The catalogue (~8 MB CSV) is fetched on first load.

## Project Structure

```
src/
  StarMap.jsx   # All scene logic: shaders, flight controls, HUD, sidebar, tooltip, glossary
  index.css     # Global reset + range slider + glossary scrollbar styles
public/
  hygdata_v41.csv   # HYG v4.1 stellar catalogue (served as static asset)
```

## Data License

The HYG v4.1 catalogue is released under [Creative Commons Attribution-ShareAlike (CC BY-SA)](https://creativecommons.org/licenses/by-sa/2.5/) by David Nash. The CSV is distributed here unchanged and under the same license. See the [HYG-Database repository](https://github.com/astronexus/HYG-Database) for the authoritative license text.

## Credits

Dataset — HYG v4.1 by [David Nash](https://github.com/astronexus)

Built by **Franco Guiragossian** — [dataviz.ar](https://dataviz.ar)
