# Design System: StormSentinel Pan-India Severe Weather Nowcasting
**Project ID:** `stormsentinel-pan-india-v2`

## 1. Visual Theme & Atmosphere
The design atmosphere of StormSentinel embodies **Deep Cyber-Meteorological Telemetry & Mission-Critical Clarity**. It balances the dense, high-precision needs of IMD Duty Meteorologists with the hyper-clear, low-cognitive-load urgency needed by Disaster Management Incident Commanders (NDRF/SDMA) and general citizens.

The aesthetic philosophy centers on:
- **Atmospheric Dark Glassmorphism**: High-contrast, space-navy translucent backdrops (`#030712`, `#0f172a`) with subtle 20px Gaussian blurs, giving full visual prominence to vibrant radar reflectivity polygons and satellite heatmaps.
- **Urgency Glows & Micro-Pulses**: Oscillating neon red (`#ff2042`) and solar orange (`#ff7200`) aura animations for impending Convective Initiation (CI) and critical countdown timers, ensuring immediate visual alerting without clutter.
- **Dual Cognitive Modality**: Intuitive "Citizen Mode" using natural human language (e.g. "Gale Force Squall Impacting in 14 Mins") seamlessly switchable with "Pro Meteorologist Mode" (Marshall-Palmer Z-R rain rate, CTCR, SWD glaciation, MESH hail size).

---

## 2. Color Palette & Roles

| Semantic Descriptive Name | Hex Code | Functional Role |
| :--- | :--- | :--- |
| **Deep Space Obsidian** | `#030712` | Primary viewport background; minimizes eye fatigue in operational command rooms |
| **Translucent Navy Glass** | `rgba(15, 23, 42, 0.78)` | Card, panel, and modal containers with 20px backdrop blur |
| **Doppler Electric Cyan** | `#38bdf8` | Radar telemetry borders, primary interactive accents, active focus rings |
| **Extreme Critical Crimson** | `#ff2042` | CRITICAL storm cell cores, cloudburst warnings ($\ge 100\text{ mm/hr}$), imminent countdowns ($<10\text{ min}$) |
| **Squall Alert Orange** | `#ff7200` | HIGH severity warnings, downburst gusts ($\ge 60\text{ km/h}$), secondary countdown alarms |
| **Convective Amber Gold** | `#ffd200` | MODERATE storm cells, lightning strike clusters, watch-level countdowns |
| **Operational Emerald** | `#00e5a0` | Active real-time sensor streams, nominal status, low severity zones |
| **INSAT Spectral Violet** | `#a855f7` | Satellite Infrared (TIR-1/TIR-2) and Water Vapor (WV) cloud top indicators |
| **Luminescent Pure White** | `#f8fafc` | Primary typography for titles and key metrics |
| **Muted Slate Grey** | `#94a3b8` | Secondary labels, units, and non-critical auxiliary information |

---

## 3. Typography Rules
- **Primary Interface Font**: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - Headers: Semi-Bold (600) to Extra-Bold (800) with `-0.02em` tight letter spacing for maximum crispness.
  - Body: Regular (400) and Medium (500) with `1.5` line height for legible tactical directives.
- **Monospace Telemetry Font**: `JetBrains Mono, monospace`
  - Used for numerical radar reflectivity values (`dBZ`), live ticking countdown timers (`MM:SS`), GPS coordinates, and physics calculations.
  - Formatted with subtle glow shadows (`0 0 12px rgba(255, 32, 66, 0.5)`) on critical values.

---

## 4. Component Stylings
- **Countdown Cards**:
  - Pill-shaped category badges (`Airport`, `Railway`, `Urban`, `Hill Station`).
  - Large monospace `MM:SS` countdown timer with real-time ticking animations.
  - Subtly rounded corners (`border-radius: 12px`), 1px translucent glowing border, and dynamic red/orange gradient backings based on ETA urgency.
- **3D Atmospheric Convective Explorer (Three.js)**:
  - Interactive 3D WebGL viewport rendering the vertical atmospheric column ($0\text{--}18\text{ km}$).
  - Translucent convective cloud volume, $0^\circ\text{C}$ freezing isotherm plane ($4500\text{ m}$), MESH hail suspension zone, downburst divergence shear vectors, and dynamic lightning stroke particle arcs.
- **Interactive MapLibre GIS Map**:
  - Dark Matter GIS basemap covering Pan-India and key regional meteorological hubs.
  - Centroid radar markers with oscillating pulse rings sized proportionally to storm cell area ($\text{km}^2$).
  - Region quick-switcher (Pan-India, Western India, Delhi-NCR, Kolkata/East, Bengaluru/South).
- **AI Advisory Modal**:
  - Frosted glass window with dual-source AI synthesis (NVIDIA NIM / OpenRouter / Neural-Expert rule system).
  - Categorized diagnosis, 4-hazard severity matrix, and tactical action directives for incident commanders.

---

## 5. Layout Principles
- **3-Panel Mission Control Architecture**:
  - **Left Telemetry & Control Panel (330px)**: Live sensor mode, Pan-India region switcher, Convective Initiation alarm card, domain telemetry gauges, and AI incident command tools.
  - **Center Interactive GIS & 3D Center (Flex 1)**: Full-viewport geospatial map with real-time overlays, layer controls, and bottom detail drawer for deep-dive cell physics.
  - **Right Impact Countdown Panel (310px)**: Ticking landmark arrival countdowns sorted by ETA, deduplicated across monitored national assets.
