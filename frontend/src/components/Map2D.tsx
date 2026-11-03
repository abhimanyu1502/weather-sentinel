import { useEffect, useRef, useState, useCallback, memo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { INDIA_BOUNDS, INDIA_FIT_BOUNDS, INDIA_REGIONAL_MAX_BOUNDS, City, ALL_CITIES } from "../data/indiaGeo";
import { ALL_SUBDISTRICTS, subdistrictById, subdistrictToCity } from "../data/subdistricts";
import { CityWeather, HazardLevel, StormCell } from "../lib/weatherEngine";
import { STRATEGIC_LANDMARKS } from "../data/landmarks";
import { MapLegend } from "./MapLegend";
import {
  Layers,
  Compass,
  Maximize2,
  Clock,
  Radio,
  Zap,
  Activity,
  Plane,
  Train,
  Mountain,
  Building2,
  RefreshCw,
  Eye,
  EyeOff,
  Crosshair,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Props {
  cities: CityWeather[];
  cells: StormCell[];
  selectedCity: City | null;
  selectedCellId: string | null;
  layers: Record<string, boolean>;
  theme?: "dark" | "light";
  viewCenter?: [number, number];
  viewZoom?: number;
  onPickCity: (c: City) => void;
  onPickLocation: (lat: number, lon: number) => void;
  onPickCell: (c: StormCell) => void;
  onToggleLayer?: (k: string) => void;
  projectionStep?: number;
  onSelectProjectionStep?: (step: number) => void;
  onClearSelectedCity?: () => void;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes geodesic circle polygon coordinates (WGS-84 approximation)
 * for high-precision micro-scale convective perimeters.
 */
export function createGeodesicCircle(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  points = 64
): [number, number][] {
  const coords: [number, number][] = [];
  const kmPerLat = 110.574;
  const kmPerLon = 111.320 * Math.cos((centerLat * Math.PI) / 180);
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * (2 * Math.PI);
    const dLat = (radiusKm / kmPerLat) * Math.sin(angle);
    const dLon = (radiusKm / kmPerLon) * Math.cos(angle);
    coords.push([centerLon + dLon, centerLat + dLat]);
  }
  return coords;
}

const CITY_LOOKUP = new Map(ALL_CITIES.map((c) => [c.name, c]));

export function hazardColor(h: HazardLevel): string {
  return h === "EXTREME"
    ? "#f43f5e"
    : h === "SEVERE"
    ? "#f97316"
    : h === "WARNING"
    ? "#fbbf24"
    : h === "WATCH"
    ? "#38bdf8"
    : "#64748b";
}

const CARTO_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const CARTO_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

function severityColor(h: HazardLevel): string {
  return hazardColor(h);
}

export const Map2D = memo(function Map2D({
  cities,
  cells,
  selectedCity,
  selectedCellId,
  layers,
  theme = "dark",
  viewCenter,
  viewZoom,
  onPickCity,
  onPickLocation,
  onPickCell,
  onToggleLayer,
  projectionStep = 0,
  onSelectProjectionStep,
  onClearSelectedCity,
}: Props) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const loaded = useRef(false);
  const prevTheme = useRef(theme);
  const timeStepsRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(4.1);
  const [is3D, setIs3D] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const onPickCityRef = useRef(onPickCity);
  const onPickLocationRef = useRef(onPickLocation);
  useEffect(() => {
    onPickCityRef.current = onPickCity;
  }, [onPickCity]);

  useEffect(() => {
    onPickLocationRef.current = onPickLocation;
  }, [onPickLocation]);

  // ── Init Map once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!el.current || map.current) return;

    const initialStyle = theme === "light" ? CARTO_LIGHT : CARTO_DARK;
    const m = new maplibregl.Map({
      container: el.current,
      style: initialStyle,
      center: [82.0, 22.0],
      zoom: 4.1,
      minZoom: 3.0,
      maxZoom: 13,
      maxBounds: INDIA_REGIONAL_MAX_BOUNDS,
      attributionControl: false,
      pitch: 0,
    });

    m.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    m.on("zoom", () => setZoom(m.getZoom()));

    // ── Direct Map Click Location Selection & Layer Hit Detection ───────
    m.on("click", (e) => {
      // 1. Check if clicking directly on a vector city or subdistrict
      const interactiveLayers = [
        "ag-city-dots",
        "ag-city-labels",
        "ag-subdistrict-dots",
        "ag-subdistrict-labels",
      ].filter((lid) => !!m.getLayer(lid));

      if (interactiveLayers.length > 0) {
        const hits = m.queryRenderedFeatures(e.point, { layers: interactiveLayers });
        if (hits && hits.length > 0) {
          const feat = hits[0];
          const fid = feat.properties?.id;
          if (feat.layer.id.startsWith("ag-subdistrict")) {
            const sd = subdistrictById(fid);
            if (sd) {
              onPickCityRef.current(subdistrictToCity(sd));
              return;
            }
          } else {
            const c = ALL_CITIES.find((x) => x.id === fid);
            if (c) {
              onPickCityRef.current(c);
              return;
            }
          }
        }
      }

      // Blank map clicks never create synthetic locations or select a nearby
      // city. They still create an exact coordinate target so every point in
      // the India map can be queried at the same 3 km radius.
      const [lon, lat] = [e.lngLat.lng, e.lngLat.lat];
      if (
        lon >= INDIA_BOUNDS[0] &&
        lon <= INDIA_BOUNDS[2] &&
        lat >= INDIA_BOUNDS[1] &&
        lat <= INDIA_BOUNDS[3]
      ) {
        onPickLocationRef.current(lat, lon);
      }
    });

    m.on("load", () => {
      loaded.current = true;
      m.fitBounds(INDIA_FIT_BOUNDS, {
        padding: { top: 60, bottom: 65, left: 30, right: 50 },
        duration: 0,
      });
      setZoom(m.getZoom());
      injectLayers(m, theme);

      // Register pointer cursor on all interactive vector layers
      const interactiveLayers = [
        "ag-city-dots",
        "ag-city-labels",
        "ag-subdistrict-dots",
        "ag-subdistrict-labels",
      ];
      interactiveLayers.forEach((layerId) => {
        m.on("mouseenter", layerId, () => {
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", layerId, () => {
          m.getCanvas().style.cursor = "";
        });
      });
    });

    const ro = new ResizeObserver(() => {
      if (map.current) {
        map.current.resize();
      }
    });
    if (el.current) ro.observe(el.current);

    map.current = m;
    (window as unknown as Record<string, unknown>).__AG_MAP__ = m;

    return () => {
      ro.disconnect();
      delete (window as unknown as Record<string, unknown>).__AG_MAP__;
      markers.current.forEach((mk) => mk.remove());
      markers.current = [];
      m.remove();
      map.current = null;
      loaded.current = false;
    };
  }, []);

  // ── Dynamic Basemap Theme Switching (Carto Dark Matter <-> Carto Positron) ──
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    if (prevTheme.current === theme) return;
    prevTheme.current = theme;

    const nextStyle = theme === "light" ? CARTO_LIGHT : CARTO_DARK;
    m.setStyle(nextStyle);
    m.once("style.load", () => {
      injectLayers(m, theme);
      const interactiveLayers = [
        "ag-city-dots",
        "ag-city-labels",
        "ag-subdistrict-dots",
        "ag-subdistrict-labels",
      ];
      interactiveLayers.forEach((layerId) => {
        m.on("mouseenter", layerId, () => {
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", layerId, () => {
          m.getCanvas().style.cursor = "";
        });
      });
      setLayersVisible(m, layers);
      paintHeat(m, layers, cities, cells);
      paintTracks(m, layers, cells);
      paintPerimeters(m, layers, selectedCity, cities);
      paintThreatVector(m, selectedCity, cells);
      paintCityVectors(m, cities, selectedCity);
      paintSubdistrictVectors(m, selectedCity);
    });
  }, [theme, layers, cities, cells, selectedCity]);

  // ── Camera moves on selection / zone filter ────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    if (selectedCity) {
      m.flyTo({
        center: [selectedCity.lon, selectedCity.lat],
        zoom: Math.max(m.getZoom(), 8.2),
        duration: 1100,
        essential: true,
      });
    } else if (viewCenter) {
      m.flyTo({
        center: viewCenter,
        zoom: viewZoom ?? 5.4,
        duration: 1100,
        essential: true,
      });
    } else {
      m.fitBounds(INDIA_FIT_BOUNDS, {
        padding: { top: 60, bottom: 65, left: 30, right: 50 },
        duration: 900,
      });
    }
  }, [selectedCity, viewCenter, viewZoom]);

  // ── 3D Tilt toggle ─────────────────────────────────────────────────────
  const toggle3D = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const nextPitch = is3D ? 0 : 50;
    m.easeTo({ pitch: nextPitch, duration: 800 });
    setIs3D(!is3D);
  }, [is3D]);

  const resetPanIndia = useCallback(() => {
    const m = map.current;
    if (!m) return;
    onClearSelectedCity?.();
    m.fitBounds(INDIA_FIT_BOUNDS, {
      padding: { top: 60, bottom: 65, left: 30, right: 50 },
      duration: 800,
    });
  }, [onClearSelectedCity]);

  // ── Paint overlays & HTML markers on tick ──────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;

    setLayersVisible(m, layers);
    paintHeat(m, layers, cities, cells);
    paintTracks(m, layers, cells);
    paintPerimeters(m, layers, selectedCity, cities);
    paintThreatVector(m, selectedCity, cells);
    paintCityVectors(m, cities, selectedCity);
    paintSubdistrictVectors(m, selectedCity);

    markers.current.forEach((mk) => mk.remove());
    markers.current = [];

    // 1. Storm cell markers with intensity halos
    if (layers.reflectivity !== false) {
      cells.forEach((c) => {
        const sev =
          c.severity === "CRITICAL"
            ? "EXTREME"
            : c.severity === "HIGH"
            ? "SEVERE"
            : c.severity === "MODERATE"
            ? "WARNING"
            : "WATCH";
        const col = severityColor(sev);
        const size = Math.max(26, Math.min(72, Math.sqrt(c.areaKm2) * 5.2));

        const box = document.createElement("button");
        box.setAttribute("aria-label", `Cell ${c.cellId} ${c.severity} ${c.maxDbz.toFixed(0)} dBZ`);
        box.style.cssText = `position:relative;width:${size}px;height:${size}px;border-radius:50%;
          background:radial-gradient(circle at 42% 38%, ${col}88, ${col}22 62%, transparent 75%);
          border:1.8px solid ${col};cursor:pointer;display:grid;place-items:center;padding:0;
          box-shadow:0 0 ${c.severity === "CRITICAL" ? 24 : 12}px ${col}80;transition:transform .18s ease;`;
        box.innerHTML = `<span style="font:800 10px var(--font-mono);color:#fff;text-shadow:0 1px 4px #000">${c.maxDbz.toFixed(0)}</span>`;

        if (c.severity === "CRITICAL" || c.severity === "HIGH") {
          const ring = document.createElement("span");
          ring.style.cssText = `position:absolute;inset:-3px;border-radius:50%;border:1.5px solid ${col};animation:ping 2.2s cubic-bezier(0,0,.2,1) infinite;pointer-events:none`;
          box.appendChild(ring);
        }

        box.onmouseenter = () => (box.style.transform = "scale(1.22)");
        box.onmouseleave = () => (box.style.transform = "scale(1)");
        box.onclick = (e) => {
          e.stopPropagation();
          onPickCell(c);
        };
        if (selectedCellId === c.cellId) {
          box.style.outline = `3px solid #38bdf8`;
          box.style.boxShadow = `0 0 20px #38bdf8`;
        }

        markers.current.push(new maplibregl.Marker({ element: box }).setLngLat([c.lon, c.lat]).addTo(m));
      });
    }

    // 2. Dedicated Selected Target Reticle Marker & 3km Micro-Perimeter Callouts
    if (selectedCity) {
      const matchWeather = cities.find((c) => c.cityName === selectedCity.name);
      const hazCol = hazardColor(matchWeather ? matchWeather.hazard : "NONE");

      const isLight = theme === "light";
      const targetPin = document.createElement("div");
      targetPin.setAttribute("aria-label", `Selected Target: ${selectedCity.name}`);
      targetPin.style.cssText = `position:relative;width:36px;height:36px;display:grid;place-items:center;pointer-events:none;z-index:90;`;
      targetPin.innerHTML = `
        <div style="position:absolute;inset:-12px;border-radius:50%;border:2px solid ${hazCol};animation:ping 1.8s cubic-bezier(0,0,.2,1) infinite;"></div>
        <div style="position:absolute;inset:-4px;border-radius:50%;background:${hazCol}33;border:1.5px solid ${hazCol};"></div>
        <div style="width:12px;height:12px;border-radius:50%;background:${hazCol};box-shadow:0 0 16px ${hazCol};"></div>
        <div style="position:absolute;top:-48px;left:50%;transform:translateX(-50%);background:${isLight ? "rgba(255,255,255,0.96)" : "rgba(10,16,28,0.96)"};border:1.2px solid ${hazCol};border-radius:6px;padding:4px 9px;font:700 11px var(--font-mono);color:${isLight ? "#0f172a" : hazCol};white-space:nowrap;box-shadow:${isLight ? "0 4px 16px rgba(0,0,0,0.15)" : "0 4px 16px rgba(0,0,0,0.8)"};display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;">
          <div style="display:flex;align-items:center;gap:4px;">
            <span>📍</span>
            <span>${selectedCity.lat.toFixed(2)}°N, ${selectedCity.lon.toFixed(2)}°E</span>
          </div>
          <div style="font-size:9px;color:${isLight ? "#0284c7" : "#38bdf8"};font-weight:700;display:flex;align-items:center;gap:3px;">
            <span>🎯</span>
            <span>3.0 km Radius Core (28.3 km²)</span>
          </div>
        </div>
      `;
      markers.current.push(
        new maplibregl.Marker({ element: targetPin }).setLngLat([selectedCity.lon, selectedCity.lat]).addTo(m)
      );

      // Micro-Perimeter edge markers at higher zoom levels
      if (layers.threeKmRadius !== false && zoom >= 8.5) {
        const badge3km = document.createElement("div");
        badge3km.style.cssText = `position:relative;width:max-content;display:inline-flex;background:${isLight ? "rgba(255,255,255,0.95)" : "rgba(8,14,26,0.94)"};border:1.2px solid ${hazCol};
          border-radius:5px;padding:2px 6px;font:700 9px var(--font-mono);color:${isLight ? "#0f172a" : hazCol};white-space:nowrap;
          box-shadow:${isLight ? "0 2px 8px rgba(0,0,0,0.12)" : "0 2px 10px rgba(0,0,0,0.6)"};pointer-events:none;align-items:center;gap:3px;z-index:85;`;
        badge3km.innerHTML = `<span>🎯</span><span>3km Perimeter Border</span>`;
        markers.current.push(
          new maplibregl.Marker({ element: badge3km, anchor: "top" })
            .setLngLat([selectedCity.lon, selectedCity.lat - (3.0 / 110.574)])
            .addTo(m)
        );

        if (zoom >= 9.5) {
          const badge10km = document.createElement("div");
          badge10km.style.cssText = `position:relative;width:max-content;display:inline-flex;background:${isLight ? "rgba(255,255,255,0.9)" : "rgba(8,14,26,0.85)"};border:1px dashed ${hazCol};
            border-radius:5px;padding:1px 5px;font:600 8.5px var(--font-mono);color:${isLight ? "#334155" : hazCol};opacity:0.85;white-space:nowrap;pointer-events:none;`;
          badge10km.innerHTML = `<span>10 km Buffer Ring</span>`;
          markers.current.push(
            new maplibregl.Marker({ element: badge10km, anchor: "top" })
              .setLngLat([selectedCity.lon, selectedCity.lat - (10.0 / 110.574)])
              .addTo(m)
          );
        }
      }
    }

    const b = m.getBounds();
    const pad = 0.6;
    const inView = (lon: number, lat: number) =>
      lon > b.getWest() - pad && lon < b.getEast() + pad && lat > b.getSouth() - pad && lat < b.getNorth() + pad;

    // 3. High-threat pulse halos for EXTREME/SEVERE cities
    cities
      .filter((w) => (w.hazard === "EXTREME" || w.hazard === "SEVERE") && inView(w.lon, w.lat))
      .forEach((w) => {
        const col = hazardColor(w.hazard);
        const halo = document.createElement("div");
        halo.style.cssText = `position:relative;width:26px;height:26px;border-radius:50%;
          border:1.8px solid ${col};animation:pingSoft 2s cubic-bezier(0,0,.2,1) infinite;pointer-events:none;`;
        markers.current.push(
          new maplibregl.Marker({ element: halo }).setLngLat([w.lon, w.lat]).addTo(m)
        );
      });

    // 3. Impact countdown rings
    if (layers.countdown !== false) {
      cities
        .filter((w) => (w.hazard === "SEVERE" || w.hazard === "EXTREME") && inView(w.lon, w.lat))
        .slice(0, 22)
        .forEach((w) => {
          const col = hazardColor(w.hazard);
          const ring = document.createElement("div");
          const etaMin = Math.max(4, Math.round(90 - w.hazardScore));
          ring.style.cssText = `position:relative;width:36px;height:36px;border-radius:50%;
            border:1.2px dashed ${col};display:grid;place-items:center;pointer-events:none;`;
          const txt = document.createElement("span");
          txt.className = "mono";
          txt.textContent = `${etaMin}m`;
          txt.style.cssText = `font:700 9px var(--font-mono);color:${col};text-shadow:0 1px 3px #000`;
          ring.appendChild(txt);
          markers.current.push(
            new maplibregl.Marker({ element: ring }).setLngLat([w.lon, w.lat - 0.42]).addTo(m)
          );
        });
    }

    // 4. Strategic landmarks (airports, railway hubs, hill stations, etc.)
    if (layers.landmarks !== false) {
      STRATEGIC_LANDMARKS.forEach((lm) => {
        if (!inView(lm.lon, lm.lat)) return;

        let nearestDist = 999;
        cells.forEach((c) => {
          const d = Math.hypot((c.lat - lm.lat) * 111, (c.lon - lm.lon) * 111 * Math.cos((lm.lat * Math.PI) / 180));
          nearestDist = Math.min(nearestDist, d);
        });
        const inThreat = nearestDist <= lm.alert_radius_km * 2.2;

        const icon =
          lm.category === "Airport"
            ? "✈"
            : lm.category === "Railway"
            ? "🚆"
            : lm.category === "Hill Station"
            ? "⛰"
            : "🏢";

        const btn = document.createElement("div");
        btn.setAttribute("aria-label", lm.name);
        btn.style.cssText = `position:relative;display:flex;align-items:center;gap:4px;cursor:pointer;`;

        const badge = document.createElement("div");
        badge.style.cssText = `width:20px;height:20px;border-radius:5px;
          background:${inThreat ? "rgba(244,63,94,0.4)" : "rgba(16,26,46,0.85)"};
          border:1px solid ${inThreat ? "#f43f5e" : "#38bdf8"};
          display:grid;place-items:center;font-size:10px;
          box-shadow:0 0 ${inThreat ? "12px #f43f5e" : "6px rgba(56,189,248,0.3)"};`;
        badge.innerHTML = `<span style="line-height:1">${icon}</span>`;
        badge.title = `${lm.name} (${lm.category}) - Alert radius: ${lm.alert_radius_km} km`;
        btn.appendChild(badge);

        if (zoom >= 6.8) {
          const lbl = document.createElement("span");
          lbl.textContent = lm.name.split(" ")[0];
          lbl.style.cssText = `font:700 9px var(--font-sans);color:#93c5fd;white-space:nowrap;
            text-shadow:0 1px 3px #000;pointer-events:none;`;
          btn.appendChild(lbl);
        }

        markers.current.push(new maplibregl.Marker({ element: btn }).setLngLat([lm.lon, lm.lat]).addTo(m));
      });
    }
  }, [cities, cells, layers, selectedCity, selectedCellId, onPickCity, onPickCell, zoom]);

  // Lead time timeline steps for 6-Hour Severe Weather Anomaly Prediction
  const PROJECTION_STEPS = [
    { label: "Now (0h)", value: 0 },
    { label: "+1h (60m)", value: 60 },
    { label: "+2h (120m)", value: 120 },
    { label: "+3h (180m)", value: 180 },
    { label: "+4h (240m)", value: 240 },
    { label: "+5h (300m)", value: 300 },
    { label: "+6h (360m)", value: 360 },
  ];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* MapLibre DOM container */}
      <div ref={el} style={{ position: "absolute", inset: 0 }} />

      {/* ── Top Tactical Overlay Navigation Bar (Unified Non-overlapping Flex Bar) ── */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 50,
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        {/* Left: Location Selection Indicator */}
        <div
          className="panel-glass rise"
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "5px 10px",
            borderRadius: 8,
            border: selectedCity ? "1px solid var(--signal)" : "1px solid var(--hair)",
            background: "var(--panel-glass)",
            boxShadow: "var(--shadow-sm)",
            maxWidth: "50%",
            overflow: "hidden",
          }}
        >
          <Crosshair
            size={13}
            color="var(--signal)"
            style={{ flexShrink: 0, animation: selectedCity ? "pulseLight 1.5s infinite" : "none" }}
          />
          {selectedCity ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                  {selectedCity.id.startsWith("grid-") ? "3 km target" : selectedCity.name.split(" ")[0]}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 9.5,
                  color: "var(--signal)",
                  background: "rgba(56,189,248,0.15)",
                  padding: "1px 5px",
                  borderRadius: 4,
                  border: "1px solid rgba(56,189,248,0.3)",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedCity.lat.toFixed(2)}°N, {selectedCity.lon.toFixed(2)}°E
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  color: "var(--signal-bright)",
                  background: "rgba(56,189,248,0.12)",
                  padding: "1px 5px",
                  borderRadius: 4,
                  border: "1px solid rgba(56,189,248,0.3)",
                  whiteSpace: "nowrap",
                }}
              >
                🎯 3km Core
              </span>
              {onClearSelectedCity && (
                <button
                  onClick={onClearSelectedCity}
                  className="btn"
                  title="Clear selected map pin"
                  style={{
                    fontSize: 9.5,
                    padding: "1px 5px",
                    borderRadius: 3,
                    background: "var(--inset)",
                    border: "1px solid var(--hair)",
                    color: "var(--text-dim)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>
              Click anywhere in India to query a 3 km weather radius
            </span>
          )}
        </div>

        {/* Right: Tactical Layer Chips & Map View Actions */}
        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {onToggleLayer && (
            <div style={{ display: "flex", gap: 3 }}>
              <button
                className="btn btn-pill"
                data-active={layers.threeKmRadius !== false}
                onClick={() => onToggleLayer("threeKmRadius")}
                title="Toggle 3km Micro-Radius Convective Perimeter & 10km Buffer Ring"
                style={{ fontSize: 10, padding: "3px 8px" }}
              >
                <Crosshair size={11} color="var(--signal)" />
                <span>3km Radius</span>
              </button>
              <button
                className="btn btn-pill"
                data-active={layers.reflectivity !== false}
                onClick={() => onToggleLayer("reflectivity")}
                title="Toggle Radar Reflectivity dBZ Heat Layer"
                style={{ fontSize: 10, padding: "3px 8px" }}
              >
                <Radio size={11} color="var(--signal)" />
                <span>Radar dBZ</span>
              </button>
              <button
                className="btn btn-pill"
                data-active={layers.lightning !== false}
                onClick={() => onToggleLayer("lightning")}
                title="Toggle Lightning Strikes Layer"
                style={{ fontSize: 10, padding: "3px 8px" }}
              >
                <Zap size={11} color="#fbbf24" />
                <span>Lightning</span>
              </button>
              <button
                className="btn btn-pill"
                data-active={layers.landmarks !== false}
                onClick={() => onToggleLayer("landmarks")}
                title="Toggle Strategic Airports & Infrastructure"
                style={{ fontSize: 10, padding: "3px 8px" }}
              >
                <Plane size={11} color="var(--signal)" />
                <span>Hubs</span>
              </button>
            </div>
          )}

          {/* 3D Tilt Toggle */}
          <button
            className="btn btn-icon"
            onClick={toggle3D}
            data-active={is3D}
            title={is3D ? "Switch to 2D Top-Down View" : "Tilt to 3D Perspective"}
            style={{ width: 28, height: 28 }}
          >
            <Compass size={13} />
          </button>

          {/* Reset Pan-India View */}
          <button
            className="btn btn-icon"
            onClick={resetPanIndia}
            title="Reset to Pan-India Extent"
            style={{ width: 28, height: 28 }}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Forecast Projection Timeline Strip (Bottom Center) ── */}
      <div
        className="panel-glass rise map-time-scrubber"
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 65,
          padding: "4px 8px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "var(--shadow-panel)",
          maxWidth: "calc(100% - 24px)",
        }}
      >
        <div
          className="map-time-label"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            color: "var(--signal)",
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
            userSelect: "none",
          }}
        >
          <Clock size={12} />
          <span id="map-time-horizon-label" className="display">6-HOUR PREDICTION HORIZON:</span>
        </div>

        {/* Scroll Left Chevron */}
        <button
          type="button"
          onClick={() => {
            timeStepsRef.current?.scrollBy({ left: -90, behavior: "smooth" });
          }}
          className="btn btn-icon"
          title="Scroll earlier timeline steps"
          aria-label="Scroll timeline steps left"
          style={{
            width: 22,
            height: 22,
            minWidth: 22,
            padding: 0,
            borderRadius: 4,
            background: "rgba(56,189,248,0.08)",
            border: "1px solid var(--hair)",
            color: "var(--signal)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={13} />
        </button>

        <div
          ref={timeStepsRef}
          className="map-time-steps"
          role="radiogroup"
          aria-labelledby="map-time-horizon-label"
          aria-orientation="horizontal"
          onWheel={(e) => {
            if (e.deltaY !== 0 || e.deltaX !== 0) {
              e.preventDefault();
              e.currentTarget.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
            }
          }}
          style={{
            display: "flex",
            gap: 3,
            overflowX: "auto",
            overflowY: "hidden",
            whiteSpace: "nowrap",
            scrollBehavior: "smooth",
            minWidth: 0,
            flex: 1,
            paddingBottom: 2,
          }}
        >
          {PROJECTION_STEPS.map((step) => {
            const active = projectionStep === step.value;
            const stepIndex = PROJECTION_STEPS.findIndex((item) => item.value === step.value);
            return (
              <button
                key={step.value}
                onClick={() => onSelectProjectionStep?.(step.value)}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const nextIndex =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                      ? PROJECTION_STEPS.length - 1
                      : (stepIndex + (event.key === "ArrowRight" ? 1 : -1) + PROJECTION_STEPS.length) % PROJECTION_STEPS.length;
                  const nextStep = PROJECTION_STEPS[nextIndex];
                  const group = event.currentTarget.parentElement;
                  onSelectProjectionStep?.(nextStep.value);
                  requestAnimationFrame(() => {
                    (group?.querySelector<HTMLButtonElement>(
                      `[data-horizon-step="${nextStep.value}"]`
                    ))?.focus();
                  });
                }}
                className="btn btn-pill"
                data-active={active}
                data-horizon-step={step.value}
                role="radio"
                aria-checked={active}
                aria-label={`${step.label} prediction horizon`}
                tabIndex={active ? 0 : -1}
                style={{
                  fontSize: 10,
                  padding: "3px 8px",
                  fontWeight: active ? 700 : 500,
                  background: active ? "rgba(56,189,248,0.25)" : "transparent",
                  borderColor: active ? "var(--signal)" : "transparent",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </button>
            );
          })}
        </div>

        {/* Scroll Right Chevron */}
        <button
          type="button"
          onClick={() => {
            timeStepsRef.current?.scrollBy({ left: 90, behavior: "smooth" });
          }}
          className="btn btn-icon"
          title="Scroll later timeline steps"
          aria-label="Scroll timeline steps right"
          style={{
            width: 22,
            height: 22,
            minWidth: 22,
            padding: 0,
            borderRadius: 4,
            background: "rgba(56,189,248,0.08)",
            border: "1px solid var(--hair)",
            color: "var(--signal)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* ── Map Legend ── */}
      <MapLegend />
    </div>
  );
});

// ── GIS Boundary & Vector Layer Injections ─────────────────────────────────
function has(m: maplibregl.Map, id: string): boolean {
  return !!m.getLayer(id) || !!m.getSource(id);
}

function injectLayers(m: maplibregl.Map, theme: "dark" | "light" = "dark") {
  const isLight = theme === "light";

  // Suppress third-party basemap boundary layers to ensure official Survey of India boundaries
  const cartoBoundaryLayers = [
    "boundary_county",
    "boundary_state",
    "boundary_country_outline",
    "boundary_country_inner",
  ];
  cartoBoundaryLayers.forEach((id) => {
    if (m.getLayer(id)) {
      m.setLayoutProperty(id, "visibility", "none");
    }
  });

  // Official Survey of India national boundary & landmass (public/geo/india-outline.geojson)
  if (!has(m, "ag-land")) {
    m.addSource("ag-land", {
      type: "geojson",
      data: "/geo/india-outline.geojson",
    });
    m.addLayer({
      id: "ag-land-fill",
      type: "fill",
      source: "ag-land",
      paint: {
        "fill-color": isLight ? "#dbeafe" : "#0d1829",
        "fill-opacity": isLight ? 0.40 : 0.70,
      },
    });
    m.addLayer({
      id: "ag-land-glow",
      type: "line",
      source: "ag-land",
      paint: {
        "line-color": isLight ? "#0284c7" : "#38bdf8",
        "line-opacity": isLight ? 0.15 : 0.22,
        "line-width": 6,
        "line-blur": 3,
      },
    });
    m.addLayer({
      id: "ag-land-border",
      type: "line",
      source: "ag-land",
      paint: {
        "line-color": isLight ? "#0284c7" : "#38bdf8",
        "line-opacity": 0.95,
        "line-width": 1.5,
      },
    });
  }

  // State / UT interior borders
  if (!has(m, "ag-states")) {
    m.addSource("ag-states", {
      type: "geojson",
      data: "/geo/india-states.geojson",
    });
    m.addLayer({
      id: "ag-states-line",
      type: "line",
      source: "ag-states",
      paint: {
        "line-color": isLight ? "#64748b" : "#94a3b8",
        "line-opacity": isLight ? 0.35 : 0.28,
        "line-width": 0.8,
        "line-dasharray": [1.6, 1.4],
      },
    });
  }

  // State / UT name labels (zoom-aware)
  if (!has(m, "ag-state-labels")) {
    m.addSource("ag-state-labels", {
      type: "geojson",
      data: "/geo/india-state-labels.geojson",
    });
    m.addLayer({
      id: "ag-state-labels",
      type: "symbol",
      source: "ag-state-labels",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Open Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 9, 6, 12, 8, 14],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.18,
        "text-anchor": "center",
        "text-allow-overlap": false,
        "symbol-placement": "point",
      },
      paint: {
        "text-color": isLight ? "#1e293b" : "#c9dcf2",
        "text-halo-color": isLight ? "#ffffff" : "#04070c",
        "text-halo-width": isLight ? 2.2 : 1.6,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 3.6, 0, 4.4, 0.95],
      },
    });
  }

  // Radar reflectivity & convective intensity points
  if (!has(m, "ag-pts")) {
    m.addSource("ag-pts", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    m.addLayer({
      id: "ag-pts",
      type: "circle",
      source: "ag-pts",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 8, 16],
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "w"],
          0,
          "#38bdf8",
          22,
          "#38bdf8",
          34,
          "#4ade80",
          42,
          "#fbbf24",
          52,
          "#f97316",
          62,
          "#f43f5e",
        ],
        "circle-opacity": 0.18,
        "circle-blur": 1,
      },
    });
  }

  // Storm cell movement tracks
  if (!has(m, "ag-tracks")) {
    m.addSource("ag-tracks", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    m.addLayer({
      id: "ag-tracks",
      type: "line",
      source: "ag-tracks",
      paint: { "line-color": ["get", "col"], "line-width": 2, "line-opacity": 0.85, "line-dasharray": [2, 2] },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }

  // 3km High-Precision Threat Perimeter (Convective Core & Deluge Inundation Area)
  if (!has(m, "ag-3km-perimeter")) {
    m.addSource("ag-3km-perimeter", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    m.addLayer({
      id: "ag-3km-perimeter-fill",
      type: "fill",
      source: "ag-3km-perimeter",
      paint: {
        "fill-color": ["coalesce", ["get", "fillColor"], isLight ? "rgba(2,132,199,0.18)" : "rgba(56,189,248,0.18)"],
        "fill-opacity": isLight ? 0.28 : 0.22,
      },
    });
    m.addLayer({
      id: "ag-3km-perimeter-glow",
      type: "line",
      source: "ag-3km-perimeter",
      paint: {
        "line-color": ["coalesce", ["get", "strokeColor"], isLight ? "#0284c7" : "#38bdf8"],
        "line-width": 7,
        "line-opacity": 0.35,
        "line-blur": 3,
      },
    });
    m.addLayer({
      id: "ag-3km-perimeter-stroke",
      type: "line",
      source: "ag-3km-perimeter",
      paint: {
        "line-color": ["coalesce", ["get", "strokeColor"], isLight ? "#0284c7" : "#38bdf8"],
        "line-width": 2.2,
      },
    });
  }

  // 10km Outer Buffer Ring
  if (!has(m, "ag-10km-buffer")) {
    m.addSource("ag-10km-buffer", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    m.addLayer({
      id: "ag-10km-buffer-line",
      type: "line",
      source: "ag-10km-buffer",
      paint: {
        "line-color": ["coalesce", ["get", "strokeColor"], isLight ? "#0284c7" : "#38bdf8"],
        "line-width": 1.4,
        "line-dasharray": [3, 2.5],
        "line-opacity": 0.6,
      },
    });
  }

  // Tactical Convective Threat Vector (connecting selected target to approaching storm cell)
  if (!has(m, "ag-threat-vector")) {
    m.addSource("ag-threat-vector", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    m.addLayer({
      id: "ag-threat-vector-glow",
      type: "line",
      source: "ag-threat-vector",
      paint: {
        "line-color": ["coalesce", ["get", "color"], isLight ? "#0284c7" : "#38bdf8"],
        "line-width": 7,
        "line-opacity": 0.4,
        "line-blur": 3.5,
      },
    });
    m.addLayer({
      id: "ag-threat-vector-line",
      type: "line",
      source: "ag-threat-vector",
      paint: {
        "line-color": ["coalesce", ["get", "color"], isLight ? "#0284c7" : "#38bdf8"],
        "line-width": 2.2,
        "line-dasharray": [3.5, 2.5],
        "line-opacity": 0.95,
      },
    });
    m.addLayer({
      id: "ag-threat-vector-label",
      type: "symbol",
      source: "ag-threat-vector",
      layout: {
        "symbol-placement": "line-center",
        "text-field": ["get", "label"],
        "text-font": ["Open Sans Bold"],
        "text-size": 10.5,
        "text-offset": [0, -1],
        "text-allow-overlap": true,
        "text-keep-upright": true,
      },
      paint: {
        "text-color": isLight ? "#0f172a" : "#ffffff",
        "text-halo-color": isLight ? "#ffffff" : "#020617",
        "text-halo-width": 2.2,
      },
    });
  }

  // All Cities Hardware-Accelerated Vector Layer (Labels & Dots across India)
  if (!has(m, "ag-all-cities")) {
    m.addSource("ag-all-cities", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    m.addLayer({
      id: "ag-city-dots",
      type: "circle",
      source: "ag-all-cities",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3.5, 5,
          6, 6,
          9, 7,
          12, 8.5
        ],
        "circle-color": ["coalesce", ["get", "color"], isLight ? "#0284c7" : "#38bdf8"],
        "circle-stroke-width": 1.2,
        "circle-stroke-color": ["case", ["get", "isSelected"], isLight ? "#0284c7" : "#38bdf8", isLight ? "#ffffff" : "rgba(255,255,255,0.75)"],
        "circle-opacity": 0.95,
      },
    });
    m.addLayer({
      id: "ag-city-labels",
      type: "symbol",
      source: "ag-all-cities",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Open Sans Bold", "Open Sans Regular"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4, 9,
          6.5, 11,
          9, 12.5,
          12, 14
        ],
        "text-offset": [0, 0.85],
        "text-anchor": "top",
        "text-optional": true,
        "text-allow-overlap": false,
        "symbol-sort-key": ["get", "hazardRank"],
      },
      paint: {
        "text-color": ["case", ["get", "isSelected"], isLight ? "#0284c7" : "#38bdf8", isLight ? "#0f172a" : "#f1f5f9"],
        "text-halo-color": isLight ? "#ffffff" : "#020617",
        "text-halo-width": isLight ? 2.4 : 2.0,
      },
    });
  }

  // Subdistricts & Talukas Vector Layer (Visible at regional and local zoom)
  if (!has(m, "ag-subdistricts")) {
    m.addSource("ag-subdistricts", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    m.addLayer({
      id: "ag-subdistrict-dots",
      type: "circle",
      source: "ag-subdistricts",
      minzoom: 5.8,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6, 4.5,
          8, 5.5,
          10, 6.5,
          13, 8
        ],
        "circle-color": ["case", ["get", "isSelected"], isLight ? "#0284c7" : "#38bdf8", isLight ? "#0284c7" : "#06b6d4"],
        "circle-stroke-width": 1.0,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.9,
      },
    });
    m.addLayer({
      id: "ag-subdistrict-labels",
      type: "symbol",
      source: "ag-subdistricts",
      minzoom: 6.2,
      layout: {
        "text-field": ["concat", ["get", "name"], " (", ["get", "parentCityName"], ")"],
        "text-font": ["Open Sans Regular"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6.5, 9,
          8.5, 11,
          11, 12.5,
          13, 14
        ],
        "text-offset": [0, 0.8],
        "text-anchor": "top",
        "text-optional": false,
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": ["case", ["get", "isSelected"], isLight ? "#0284c7" : "#38bdf8", isLight ? "#0369a1" : "#a5f3fc"],
        "text-halo-color": isLight ? "#ffffff" : "#020617",
        "text-halo-width": isLight ? 2.4 : 2.2,
      },
    });
  }
}

function setLayersVisible(m: maplibregl.Map, layers: Record<string, boolean>) {
  const vis = (id: string, on: boolean) => {
    if (has(m, id)) m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  };

  vis("ag-pts", layers.reflectivity !== false || layers.lightning !== false || layers.satellite !== false);
  vis("ag-tracks", layers.tracks !== false);
  vis("ag-states-line", layers.states !== false);
  vis("ag-state-labels", layers.labels !== false);

  const show3km = layers.threeKmRadius !== false;
  vis("ag-3km-perimeter-fill", show3km);
  vis("ag-3km-perimeter-glow", show3km);
  vis("ag-3km-perimeter-stroke", show3km);
  vis("ag-10km-buffer-line", show3km);

  const showLabels = layers.labels !== false;
  vis("ag-city-dots", showLabels);
  vis("ag-city-labels", showLabels);
  vis("ag-subdistrict-dots", showLabels);
  vis("ag-subdistrict-labels", showLabels);

  const showThreat = layers.tracks !== false;
  vis("ag-threat-vector-glow", showThreat);
  vis("ag-threat-vector-line", showThreat);
  vis("ag-threat-vector-label", showThreat);

  if (has(m, "ag-pts")) {
    m.setPaintProperty("ag-pts", "circle-opacity", layers.lightning ? 0.32 : 0.18);
  }
}

function paintPerimeters(
  m: maplibregl.Map,
  layers: Record<string, boolean>,
  selectedCity: City | null,
  cities: CityWeather[]
) {
  const src3km = m.getSource("ag-3km-perimeter") as maplibregl.GeoJSONSource | undefined;
  const src10km = m.getSource("ag-10km-buffer") as maplibregl.GeoJSONSource | undefined;
  if (!src3km || !src10km) return;

  if (!selectedCity || layers.threeKmRadius === false) {
    src3km.setData({ type: "FeatureCollection", features: [] });
    src10km.setData({ type: "FeatureCollection", features: [] });
    return;
  }

  const matchWeather = cities.find((c) => c.cityName === selectedCity.name);
  const haz = matchWeather ? matchWeather.hazard : "NONE";
  const color = hazardColor(haz);
  const fillColor =
    haz === "EXTREME"
      ? "rgba(244,63,94,0.25)"
      : haz === "SEVERE"
      ? "rgba(249,115,22,0.22)"
      : haz === "WARNING"
      ? "rgba(251,191,36,0.20)"
      : "rgba(56,189,248,0.18)";

  const ring3km = createGeodesicCircle(selectedCity.lat, selectedCity.lon, 3.0);
  const ring10km = createGeodesicCircle(selectedCity.lat, selectedCity.lon, 10.0);

  src3km.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { strokeColor: color, fillColor },
        geometry: { type: "Polygon", coordinates: [ring3km] },
      },
    ],
  });

  src10km.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { strokeColor: color },
        geometry: { type: "Polygon", coordinates: [ring10km] },
      },
    ],
  });
}

function paintHeat(m: maplibregl.Map, layers: Record<string, boolean>, cities: CityWeather[], cells: StormCell[]) {
  const src = m.getSource("ag-pts") as maplibregl.GeoJSONSource | undefined;
  if (!src) return;

  const feats: GeoJSON.Feature[] = [];
  cells.forEach((c) => {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const r = Math.sqrt(c.areaKm2) / 111;
      feats.push({
        type: "Feature",
        properties: { w: c.maxDbz },
        geometry: { type: "Point", coordinates: [c.lon + Math.cos(a) * r * 0.9, c.lat + Math.sin(a) * r * 0.7] },
      });
    }
  });

  cities.forEach((w) => {
    if (w.reflectivityDbz < 26) return;
    feats.push({
      type: "Feature",
      properties: { w: w.reflectivityDbz },
      geometry: { type: "Point", coordinates: [w.lon, w.lat] },
    });
  });

  src.setData({ type: "FeatureCollection", features: feats });
}

function paintTracks(m: maplibregl.Map, layers: Record<string, boolean>, cells: StormCell[]) {
  const src = m.getSource("ag-tracks") as maplibregl.GeoJSONSource | undefined;
  if (!src) return;

  const feats: GeoJSON.Feature[] = cells.map((c) => ({
    type: "Feature",
    properties: {
      col: hazardColor(
        c.severity === "CRITICAL"
          ? "EXTREME"
          : c.severity === "HIGH"
          ? "SEVERE"
          : c.severity === "MODERATE"
          ? "WARNING"
          : "WATCH"
      ),
    },
    geometry: { type: "LineString", coordinates: c.history.map((h) => [h.lon, h.lat] as [number, number]) },
  }));

  src.setData({ type: "FeatureCollection", features: feats });
}

function paintCityVectors(
  m: maplibregl.Map,
  cities: CityWeather[],
  selectedCity: City | null
) {
  const src = m.getSource("ag-all-cities") as maplibregl.GeoJSONSource | undefined;
  if (!src) return;

  const weatherMap = new Map<string, CityWeather>();
  cities.forEach((c) => weatherMap.set(c.cityName, c));

  const feats: GeoJSON.Feature[] = ALL_CITIES.map((c) => {
    const w = weatherMap.get(c.name);
    const haz = w ? w.hazard : "NONE";
    const col = hazardColor(haz);
    const isSelected = selectedCity?.name === c.name || selectedCity?.id === c.id;
    const rank =
      haz === "EXTREME" ? 1 : haz === "SEVERE" ? 2 : haz === "WARNING" ? 3 : haz === "WATCH" ? 4 : 5;

    return {
      type: "Feature",
      properties: {
        id: c.id,
        name: c.name,
        state: c.state,
        hazard: haz,
        hazardRank: rank,
        color: col,
        isSelected,
      },
      geometry: {
        type: "Point",
        coordinates: [c.lon, c.lat],
      },
    };
  });

  src.setData({ type: "FeatureCollection", features: feats });
}

function paintSubdistrictVectors(
  m: maplibregl.Map,
  selectedCity: City | null
) {
  const src = m.getSource("ag-subdistricts") as maplibregl.GeoJSONSource | undefined;
  if (!src) return;

  const feats: GeoJSON.Feature[] = ALL_SUBDISTRICTS.map((sd) => {
    const isSelected =
      selectedCity?.id === sd.id ||
      selectedCity?.name.toLowerCase().startsWith(sd.name.toLowerCase());

    return {
      type: "Feature",
      properties: {
        id: sd.id,
        name: sd.name,
        parentCityName: sd.parentCityName,
        district: sd.district,
        state: sd.state,
        type: sd.type,
        category: sd.category,
        isSelected,
      },
      geometry: {
        type: "Point",
        coordinates: [sd.lon, sd.lat],
      },
    };
  });

  src.setData({ type: "FeatureCollection", features: feats });
}

function paintThreatVector(
  m: maplibregl.Map,
  selectedCity: City | null,
  cells: StormCell[]
) {
  const src = m.getSource("ag-threat-vector") as maplibregl.GeoJSONSource | undefined;
  if (!src) return;

  if (!selectedCity || cells.length === 0) {
    src.setData({ type: "FeatureCollection", features: [] });
    return;
  }

  // Find nearest convective storm cell
  let nearestCell: StormCell | null = null;
  let minDistance = Infinity;

  cells.forEach((cell) => {
    const d = haversineDistanceKm(selectedCity.lat, selectedCity.lon, cell.lat, cell.lon);
    if (d < minDistance) {
      minDistance = d;
      nearestCell = cell;
    }
  });

  if (!nearestCell || minDistance > 750) {
    src.setData({ type: "FeatureCollection", features: [] });
    return;
  }

  // Estimate arrival ETA assuming storm propagation speed ~36 km/h
  const speedKmh = 36;
  const etaMinutes = Math.max(3, Math.round((minDistance / speedKmh) * 60));
  const cellSev = (nearestCell as StormCell).severity;
  const sevCol = severityColor(
    cellSev === "CRITICAL"
      ? "EXTREME"
      : cellSev === "HIGH"
      ? "SEVERE"
      : cellSev === "MODERATE"
      ? "WARNING"
      : "WATCH"
  );

  const label = `⚡ THREAT VECTOR: ${minDistance.toFixed(1)} km · ETA ~${etaMinutes}m (${(nearestCell as StormCell).maxDbz.toFixed(0)} dBZ Core)`;

  src.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          color: sevCol,
          label,
          distanceKm: minDistance,
          etaMinutes,
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [selectedCity.lon, selectedCity.lat],
            [(nearestCell as StormCell).lon, (nearestCell as StormCell).lat],
          ],
        },
      },
    ],
  });
}
