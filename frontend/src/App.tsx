import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles/theme.css";
import { Info } from "lucide-react";

import { City, ZONE_CLUSTERS, INDIA_REGIONS, ALL_CITIES } from "./data/indiaGeo";
import { subdistrictById, subdistrictToCity } from "./data/subdistricts";
import { getSnapshot, WeatherSnapshot, CityWeather, StormCell, HAZ_CLASS } from "./lib/weatherEngine";
import { useLiveWeatherSocket } from "./lib/useLiveWeatherSocket";
import { getBackendRegionId } from "./data/regionMapping";
import { soundAlerts } from "./lib/soundAlerts";

import { TopBar, AppViewMode } from "./components/TopBar";
import { LeftRail } from "./components/LeftRail";
import { Map2D } from "./components/Map2D";
import { CityDetailPanel } from "./components/CityDetailPanel";
import { DashboardGrid } from "./components/DashboardGrid";
import { StormCellDrawer } from "./components/StormCellDrawer";
import { CommandSearchModal } from "./components/CommandSearchModal";
import { WatcherAlertSign } from "./components/WatcherAlertSign";

const TICK_MS = 3000;

/** Reactive CSS media query hook */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ag_theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  const [snap, setSnap] = useState<WeatherSnapshot>(() => getSnapshot());
  const [live, setLive] = useState(true);
  const [view, setView] = useState<AppViewMode>("2d");
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(true);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [audioMuted, setAudioMuted] = useState<boolean>(() => soundAlerts.isMuted());
  const [projectionStep, setProjectionStep] = useState<number>(0);
  const compact = useMediaQuery("(max-width: 1040px)");

  // ── Sync Theme Attribute & Persistence ────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "light") {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
    try {
      localStorage.setItem("ag_theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const [layers, setLayers] = useState<Record<string, boolean>>({
    reflectivity: true,
    lightning: true,
    satellite: false,
    tracks: true,
    countdown: true,
    landmarks: false,
    labels: true,
    states: true,
    threeKmRadius: true,
  });

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Live WebSocket Connection to FastAPI Engine ───────────────────────
  const backendRegion = useMemo(() => getBackendRegionId(regionFilter), [regionFilter]);

  const {
    connected: wsConnected,
    connecting: wsConnecting,
    normalizedSnapshot,
  } = useLiveWeatherSocket({
    enabled: live,
    regionId: backendRegion,
  });

  // When live WebSocket packets arrive from FastAPI, update state seamlessly
  useEffect(() => {
    if (normalizedSnapshot) {
      setSnap(normalizedSnapshot);
    }
  }, [normalizedSnapshot]);

  // Fallback to local simulation when WebSocket is offline or reconnecting
  useEffect(() => {
    if (!live || wsConnected) {
      if (timer.current) clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(() => setSnap(getSnapshot()), TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [live, wsConnected]);

  // Default panel collapse on compact screens
  useEffect(() => {
    if (compact) {
      setRailOpen(false);
      setDetailOpen(false);
    } else {
      setRailOpen(true);
      setDetailOpen(true);
    }
  }, [compact]);

  // ── Derived Data Computations ──────────────────────────────────────────
  const cityWeatherByName = useMemo(() => {
    const m = new Map<string, CityWeather>();
    snap.cities.forEach((c) => m.set(c.cityName, c));
    return m;
  }, [snap]);

  const selectedWeather = selectedCity ? cityWeatherByName.get(selectedCity.name) ?? null : null;

  const selectedCell: StormCell | null = useMemo(
    () => snap.cells.find((c) => c.cellId === selectedCellId) ?? null,
    [snap.cells, selectedCellId]
  );

  // Cities visible under active macro-zone filter
  const visibleCities = useMemo(() => {
    const zone = regionFilter ? ZONE_CLUSTERS.find((z) => z.id === regionFilter) : undefined;
    if (!zone) return snap.cities;
    const allowed = new Set(zone.states.map((id) => STATE_NAME_BY_ID[id]).filter(Boolean));
    return snap.cities.filter((c) => allowed.has(c.state));
  }, [snap.cities, regionFilter]);

  // Nearby cities within 350 km of selected city
  const nearbyCities = useMemo(() => {
    if (!selectedCity) return [];
    const R = 350;
    return snap.cities
      .filter((c) => c.cityId !== selectedCity.id)
      .map((c) => {
        const d = Math.hypot(
          (c.lat - selectedCity.lat) * 111,
          (c.lon - selectedCity.lon) * 111 * Math.cos((selectedCity.lat * Math.PI) / 180)
        );
        return { c, d };
      })
      .filter((x) => x.d < R)
      .sort((a, b) => a.d - b.d)
      .slice(0, 10)
      .map((x) => x.c);
  }, [snap.cities, selectedCity]);

  const viewCenter = useMemo(() => {
    if (!regionFilter) return undefined;
    const z = ZONE_CLUSTERS.find((x) => x.id === regionFilter);
    return z ? z.center : undefined;
  }, [regionFilter]);

  const viewZoom = useMemo(
    () => ZONE_CLUSTERS.find((x) => x.id === regionFilter)?.zoom,
    [regionFilter]
  );

  // ── Handlers ───────────────────────────────────────────────────────────
  const pickCity = useCallback(
    (c: City) => {
      setSelectedCity(c);
      setDetailOpen(true);
      if (compact) {
        setRailOpen(false);
      }
    },
    [compact]
  );

  const pickMapLocation = useCallback(
    (lat: number, lon: number) => {
      const latLabel = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
      const lonLabel = `${Math.abs(lon).toFixed(4)}°${lon >= 0 ? "E" : "W"}`;
      const target: City = {
        id: `grid-${lat.toFixed(4)}-${lon.toFixed(4)}`,
        name: `Grid target · ${latLabel} ${lonLabel}`,
        lat,
        lon,
        state: "India · 3 km weather grid",
        type: "major",
        population_m: 0,
      };
      setSelectedCity(target);
      setDetailOpen(true);
      if (compact) setRailOpen(false);
    },
    [compact]
  );

  const pickCityByName = useCallback(
    (name: string) => {
      const c = snap.cities.find((x) => x.cityName === name);
      if (!c) return;
      setSelectedCity({
        id: c.cityId,
        name: c.cityName,
        lat: c.lat,
        lon: c.lon,
        state: c.state,
        type: "major",
        population_m: 0,
      });
      if (compact) setDetailOpen(true);
    },
    [snap.cities, compact]
  );

  const pickAnyLocationById = useCallback(
    (id: string) => {
      if (id.startsWith("sd-")) {
        const sd = subdistrictById(id);
        if (sd) {
          pickCity(subdistrictToCity(sd));
          return;
        }
      }
      const c = snap.cities.find((x) => x.cityId === id);
      if (c) {
        pickCityByName(c.cityName);
        return;
      }
      const geoC = ALL_CITIES.find((x) => x.id === id);
      if (geoC) {
        pickCity(geoC);
      }
    },
    [snap.cities, pickCity, pickCityByName]
  );

  const pickZone = useCallback((zoneId: string) => {
    setRegionFilter(zoneId || null);
    setSelectedCity(null);
  }, []);

  const toggleLayer = useCallback((k: string) => setLayers((l) => ({ ...l, [k]: !l[k] })), []);

  const pickCell = useCallback(
    (c: StormCell) => {
      setSelectedCellId(c.cellId);
      if (compact) setDetailOpen(true);
    },
    [compact]
  );

  const handleToggleAudio = useCallback(() => {
    const next = soundAlerts.toggleMute();
    setAudioMuted(next);
  }, []);

  // ── Global Keyboard Shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen(true);
        return;
      }

      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (e.key === "Escape") {
        setSelectedCellId(null);
        setSearchModalOpen(false);
        if (compact) {
          setRailOpen(false);
          setDetailOpen(false);
        }
      } else if (e.key.toLowerCase() === "m") {
        setView("2d");
      } else if (e.key.toLowerCase() === "d") {
        setView("dashboard");
      } else if (e.key.toLowerCase() === "s" && !compact) {
        setView("split");
      } else if (e.code === "Space") {
        e.preventDefault();
        setLive((l) => !l);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact]);

  return (
    <>
      {/* Background Atmosphere */}
      <div className="atmosphere" />

      {/* Main Mission Control Shell */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: 8,
          boxSizing: "border-box",
        }}
      >
        {/* Unified Top Command Bar */}
        <TopBar
          live={live}
          updatedAt={snap.timestamp}
          cities={snap.cities}
          compact={compact}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          currentView={view}
          onChangeView={setView}
          railOpen={railOpen}
          detailOpen={detailOpen}
          selectedZoneId={regionFilter}
          onOpenSearch={() => setSearchModalOpen(true)}
          onPickZone={pickZone}
          onToggleRail={() => setRailOpen((o) => !o)}
          onToggleDetail={() => setDetailOpen((o) => !o)}
          onToggleLive={() => setLive((l) => !l)}
        />

        {/* ── Watcher Warning Sign & Emergency Marquee ── */}
        <WatcherAlertSign
          cities={snap.cities}
          onPickCityByName={pickCityByName}
          audioMuted={audioMuted}
          onToggleAudio={handleToggleAudio}
        />

        {/* ── Main Viewport Area ── */}
        <div style={{ flex: 1, display: "flex", gap: 8, minHeight: 0, position: "relative" }}>
          {/* VIEW MODE 1: Analytical Dashboard */}
          {view === "dashboard" ? (
            <DashboardGrid
              cities={visibleCities}
              cells={snap.cells}
              summary={snap.summary}
              selectedCellId={selectedCellId}
              nowcast={snap.nowcast}
              onPickCell={pickCell}
              onPickCityName={pickCityByName}
            />
          ) : view === "split" ? (
            /* VIEW MODE 2: Split Hybrid View (Map + Dashboard Dual Console) */
            <>
              {/* Left Map Half */}
              <div
                className="panel"
                style={{
                  flex: "1 1 54%",
                  position: "relative",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <Map2D
                  cities={visibleCities}
                  cells={snap.cells}
                  selectedCity={selectedCity}
                  selectedCellId={selectedCellId}
                  layers={layers}
                  theme={theme}
                  viewCenter={viewCenter}
                  viewZoom={viewZoom}
                  onPickCity={pickCity}
                  onPickLocation={pickMapLocation}
                  onPickCell={pickCell}
                  onToggleLayer={toggleLayer}
                  projectionStep={projectionStep}
                  onSelectProjectionStep={setProjectionStep}
                />
                <StormCellDrawer cell={selectedCell} onClose={() => setSelectedCellId(null)} />
              </div>

              {/* Right Dashboard Half */}
              <div style={{ flex: "1 1 46%", display: "flex", minWidth: 0 }}>
                <DashboardGrid
                  cities={visibleCities}
                  cells={snap.cells}
                  summary={snap.summary}
                  selectedCellId={selectedCellId}
                  nowcast={snap.nowcast}
                  onPickCell={pickCell}
                  onPickCityName={pickCityByName}
                />
              </div>
            </>
          ) : (
            /* VIEW MODE 3: GIS Radar Map (Tactical Focus) */
            <>
              {/* Left Regional Rail (Collapsible) */}
              {!compact && railOpen && (
                <LeftRail
                  cities={visibleCities}
                  summary={snap.summary}
                  selectedRegionId={regionFilter}
                  selectedCityId={selectedCity?.id ?? null}
                  onPickRegion={(id) => {
                    setRegionFilter(id);
                    setSelectedCity(null);
                  }}
                  onPickCity={pickAnyLocationById}
                  layers={layers}
                  onToggleLayer={toggleLayer}
                />
              )}

              {/* Central Map Stage */}
              <div
                className="panel"
                style={{
                  flex: 1,
                  position: "relative",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <Map2D
                  cities={visibleCities}
                  cells={snap.cells}
                  selectedCity={selectedCity}
                  selectedCellId={selectedCellId}
                  layers={layers}
                  theme={theme}
                  viewCenter={viewCenter}
                  viewZoom={viewZoom}
                  onPickCity={pickCity}
                  onPickLocation={pickMapLocation}
                  onPickCell={pickCell}
                  onToggleLayer={toggleLayer}
                  projectionStep={projectionStep}
                  onSelectProjectionStep={setProjectionStep}
                  onClearSelectedCity={() => setSelectedCity(null)}
                />

                {/* Floating Zone & Telemetry HUD Breadcrumb (Bottom Left, docked above bottom scrubber line) */}
                <div
                  className="panel-glass rise"
                  style={{
                    position: "absolute",
                    bottom: 50,
                    left: 180,
                    zIndex: 60,
                    padding: "6px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 11,
                    maxWidth: "calc(100% - 200px)",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Info size={13} color="var(--signal)" />
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                    {regionFilter
                      ? ZONE_CLUSTERS.find((z) => z.id === regionFilter)?.name
                      : "Pan-India · 36 States & Union Territories"}
                  </span>
                  <span style={{ color: "var(--text-faint)" }}>·</span>
                  <span className="mono" style={{ color: "var(--text-dim)" }}>
                    {visibleCities.length} Cities
                  </span>
                  <span style={{ color: "var(--text-faint)" }}>·</span>
                  <span className="mono" style={{ color: "var(--signal)", fontWeight: 700 }}>
                    {snap.cells.length} Active Cells
                  </span>
                  <span style={{ color: "var(--text-faint)" }}>·</span>
                  <span className={`pill ${HAZ_CLASS[snap.summary.nationalHazard]}`} style={{ fontSize: 8.5 }}>
                    {snap.summary.nationalHazard}
                  </span>
                </div>

                {/* Floating Storm Cell Drawer */}
                <StormCellDrawer cell={selectedCell} onClose={() => setSelectedCellId(null)} />

                {/* Compact Mode Slide-over Drawers */}
                {compact && railOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: 0,
                      zIndex: 800,
                      display: "flex",
                    }}
                  >
                    <LeftRail
                      cities={visibleCities}
                      summary={snap.summary}
                      selectedRegionId={regionFilter}
                      selectedCityId={selectedCity?.id ?? null}
                      onPickRegion={(id) => {
                        setRegionFilter(id);
                        setSelectedCity(null);
                      }}
                      onPickCity={pickAnyLocationById}
                      layers={layers}
                      onToggleLayer={toggleLayer}
                    />
                  </div>
                )}

                {compact && detailOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      right: 0,
                      zIndex: 800,
                      display: "flex",
                    }}
                  >
                    <CityDetailPanel
                      city={selectedCity}
                      weather={selectedWeather}
                      cells={snap.cells}
                      nearbyCities={nearbyCities}
                      onPickCityName={pickCityByName}
                      onClose={() => setDetailOpen(false)}
                    />
                  </div>
                )}

                {/* Backdrop Scrim for Compact Drawer */}
                {compact && (railOpen || detailOpen) && (
                  <button
                    onClick={() => {
                      setRailOpen(false);
                      setDetailOpen(false);
                    }}
                    aria-label="Close navigation overlay"
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 790,
                      background: "rgba(4,7,12,0.65)",
                      backdropFilter: "blur(4px)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  />
                )}
              </div>

              {/* Right City Intelligence Panel */}
              {!compact && detailOpen && (
                <CityDetailPanel
                  city={selectedCity}
                  weather={selectedWeather}
                  cells={snap.cells}
                  nearbyCities={nearbyCities}
                  onPickCityName={pickCityByName}
                  onClose={() => setDetailOpen(false)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Operational Modals ── */}
      <CommandSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        cities={snap.cities}
        onPickCity={pickCity}
        onPickZone={pickZone}
      />
    </>
  );
}

// State ID to Name lookup map for zone clustering
const STATE_NAME_BY_ID: Record<string, string> = Object.fromEntries(
  INDIA_REGIONS.map((r) => [r.id, r.name])
);
