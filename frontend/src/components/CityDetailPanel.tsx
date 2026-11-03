import { useEffect, useMemo, useState } from "react";
import {
  CloudRain,
  Wind,
  Droplets,
  Gauge,
  Eye,
  Zap,
  Snowflake,
  Thermometer,
  Compass,
  ArrowDownRight,
  Radar,
  TrendingUp,
  X,
  AlertTriangle,
  MapPin,
  Flame,
  ShieldAlert,
  Clock,
  Radio,
  Crosshair,
  Activity,
  CloudLightning,
  Check,
} from "lucide-react";
import { City } from "../data/indiaGeo";
import { ALL_SUBDISTRICTS, subdistrictById, Subdistrict } from "../data/subdistricts";
import { CityWeather, HazardLevel, StormCell, cardinal, HAZ_CLASS } from "../lib/weatherEngine";
import { fetchLiveCityWeather, LiveCityTelemetry, HourlyPrediction } from "../lib/realtimeWeatherApi";

interface Props {
  city: City | null;
  weather: CityWeather | null;
  cells: StormCell[];
  nearbyCities: CityWeather[];
  onPickCityName: (name: string) => void;
  onClose?: () => void;
}

function MetricRow({
  icon: Icon,
  label,
  value,
  unit,
  sev,
  bar,
}: {
  icon: any;
  label: string;
  value: string;
  unit?: string;
  sev?: string;
  bar?: number;
}) {
  return (
    <div style={{ padding: "7px 0", borderBottom: "1px solid var(--hair)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: bar !== undefined ? 4 : 0 }}>
        <span style={{ color: "var(--text-faint)", display: "grid", placeItems: "center", width: 14 }}>
          <Icon size={13} color="var(--signal)" />
        </span>
        <span className="label" style={{ fontSize: 9.5, flex: 1 }}>{label}</span>
        <span className={`mono ${sev ?? ""}`} style={{ fontSize: 13, fontWeight: 700 }}>
          {value}
          {unit && <span style={{ fontSize: 9.5, color: "var(--text-dim)", marginLeft: 3 }}>{unit}</span>}
        </span>
      </div>
      {bar !== undefined && (
        <div className={`meter ${sev ?? ""}`} style={{ height: 4 }}>
          <i style={{ width: `${Math.max(2, Math.min(100, bar))}%` }} />
        </div>
      )}
    </div>
  );
}

export function CityDetailPanel({ city, weather, cells, nearbyCities, onPickCityName, onClose }: Props) {
  const [tab, setTab] = useState<"conditions" | "forecast6h" | "indices" | "proximity">("conditions");
  const [liveTelemetry, setLiveTelemetry] = useState<LiveCityTelemetry | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [copiedGps, setCopiedGps] = useState(false);

  // Fetch real-time Open-Meteo free weather and 6h predictions whenever selected city changes
  useEffect(() => {
    if (!city) {
      setLiveTelemetry(null);
      return;
    }
    let isMounted = true;
    setLoadingLive(true);
    fetchLiveCityWeather(city.lat, city.lon, city.name).then((data) => {
      if (isMounted) {
        setLiveTelemetry(data);
        setLoadingLive(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [city]);

  const effectiveWeather: CityWeather = useMemo(() => {
    if (weather) return weather;
    if (!city) return null as any;
    const temp = liveTelemetry?.temperature_c ?? 27.0;
    const rh = liveTelemetry?.relative_humidity_pct ?? 68;
    const wind = liveTelemetry?.wind_speed_kmh ?? 14;
    const rain = liveTelemetry?.precipitation_mm_hr ?? 0;
    const press = liveTelemetry?.surface_pressure_hpa ?? 1008;
    const cape = liveTelemetry?.cape_j_kg ?? 850;
    const haz: HazardLevel =
      rain >= 70 || (rain >= 35 && cape >= 1800)
        ? "EXTREME"
        : rain >= 30 || cape >= 2000
        ? "SEVERE"
        : rain >= 10 || cape >= 1200
        ? "WARNING"
        : rain > 0
        ? "WATCH"
        : "NONE";

    return {
      cityId: city.id || `custom-${city.lat}-${city.lon}`,
      cityName: city.name,
      state: city.state,
      lat: city.lat,
      lon: city.lon,
      temperatureC: temp,
      feelsLikeC: liveTelemetry?.apparent_temp_c ?? temp + 2.5,
      humidityPct: rh,
      windKmph: wind,
      windDirDeg: liveTelemetry?.wind_direction_deg ?? 210,
      pressureHpa: press,
      visibilityKm: 10.0,
      rainMmHr: rain,
      accumulatedMm: rain * 1.5,
      cloudCoverPct: 55,
      reflectivityDbz: rain > 0 ? 35 : 12,
      hailMeshMm: 0,
      hailPoshPct: 0,
      lightningFlashesKm2: 0,
      gustKmph: liveTelemetry?.wind_gusts_kmh ?? wind * 1.3,
      ctcrKPer15min: 0,
      hazard: haz,
      hazardScore: haz === "EXTREME" ? 92 : haz === "SEVERE" ? 75 : haz === "WARNING" ? 50 : 20,
      alertHeadline: `${haz}: Selected Map Coordinates (${city.lat.toFixed(2)}°N, ${city.lon.toFixed(2)}°E)`,
      updatedAt: new Date().toISOString(),
    };
  }, [weather, city, liveTelemetry]);

  const threateningCells = useMemo(() => {
    if (!city || !effectiveWeather) return [];
    const R = 520;
    const km = 111;
    return cells
      .map((c) => {
        const d = Math.hypot((c.lat - city.lat) * km, (c.lon - city.lon) * km * Math.cos((city.lat * Math.PI) / 180));
        const deg = (Math.atan2(c.lon - city.lon, c.lat - city.lat) * 180) / Math.PI;
        const normDeg = (deg + 360) % 360;
        const etaMin = Math.max(3, Math.round((d / 36) * 60));
        return {
          c,
          d,
          distKm: d,
          bearing: cardinal(normDeg),
          etaMin,
        };
      })
      .filter((x) => x.d < R)
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);
  }, [city, effectiveWeather, cells]);

  if (!city) {
    return (
      <aside
        className="panel-glass"
        style={{
          width: 324,
          flex: "0 0 auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          height: "100%",
          maxHeight: "100%",
        }}
      >
        <div className="panel-head">
          <span className="accent">
            <Radar size={13} style={{ verticalAlign: -1 }} /> Atmospheric Intel
          </span>
        </div>
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 28, textAlign: "center" }}>
          <div>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "rgba(56,189,248,0.08)",
                border: "1px solid rgba(56,189,248,0.2)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 14px",
              }}
            >
              <Radar size={26} color="var(--signal)" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
              No Location Selected
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
              Select a marked city or subdivision on the map, choose a city from the explorer rail, or search with{" "}
              <span className="mono" style={{ color: "var(--signal)", background: "rgba(56,189,248,0.1)", padding: "1px 4px", borderRadius: 3 }}>
                Ctrl+K
              </span>
              .
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const tabs = [
    { k: "conditions" as const, label: "Conditions" },
    { k: "forecast6h" as const, label: "6h Anomaly" },
    { k: "indices" as const, label: "Severe Indices" },
    { k: "proximity" as const, label: "Threat Radar" },
  ];

  const hzClass = HAZ_CLASS[effectiveWeather.hazard];

  return (
    <aside
      className="panel-glass rise"
      style={{
        width: 334,
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        height: "100%",
        maxHeight: "100%",
        minHeight: 0,
      }}
    >
      {/* ── Header: City Identity, State & Close Action ── */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--hair)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={`dot ${hzClass}`} style={{ boxShadow: "0 0 8px currentColor" }} />
              <h2
                className="display"
                style={{
                  fontSize: 17,
                  fontWeight: 900,
                  color: "var(--text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {city.name}
              </h2>
            </div>
            <div className="label mono" style={{ fontSize: 9.5, marginTop: 3 }}>
              {city.id?.startsWith("sd-") && subdistrictById(city.id) ? (
                <>
                  <span style={{ color: "var(--signal)" }}>
                    {subdistrictById(city.id)?.parentCityName}
                  </span>
                  {" · "}
                  <span>{subdistrictById(city.id)?.district}</span>
                  {" · "}
                  <span>{subdistrictById(city.id)?.state}</span>
                </>
              ) : (
                <span>{city.state} · Indian Territory</span>
              )}
              {" · "}
              <span style={{ color: "var(--signal-bright)", fontWeight: 700 }}>
                {city.lat.toFixed(4)}°N {city.lon.toFixed(4)}°E
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className={`pill ${hzClass}`} style={{ fontSize: 9 }}>
              {effectiveWeather.hazard} {effectiveWeather.hazardScore}
            </span>
            <button
              onClick={() => {
                if (navigator?.clipboard) {
                  navigator.clipboard.writeText(`${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}`);
                  setCopiedGps(true);
                  setTimeout(() => setCopiedGps(false), 2000);
                }
              }}
              className="btn btn-icon"
              title={copiedGps ? "GPS Copied to Clipboard!" : "Copy Exact GPS Coordinates"}
              aria-label="Copy Coordinates"
              style={{
                width: 26,
                height: 26,
                background: copiedGps ? "rgba(16,185,129,0.22)" : undefined,
                borderColor: copiedGps ? "var(--mint)" : undefined,
              }}
            >
              {copiedGps ? (
                <Check size={12} color="var(--mint)" />
              ) : (
                <MapPin size={12} color="var(--signal)" />
              )}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="btn btn-icon"
                title="Close Location Details"
                style={{ width: 26, height: 26 }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Hazard Headline Alert Banner with Lead Time */}
        {effectiveWeather.hazard !== "NONE" && (
          <div
            className={`bento-card ${hzClass}`}
            style={{
              marginTop: 10,
              padding: "8px 10px",
              borderLeftWidth: 3,
              borderLeftColor: "var(--sev)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ShieldAlert size={13} color="var(--sev)" />
                <span style={{ fontSize: 10, fontWeight: 800, color: "var(--sev)" }}>
                  {effectiveWeather.hazard} ANOMALY ALERT
                </span>
              </div>
              <span className="mono label" style={{ fontSize: 8.5, color: "#fff", background: "rgba(0,0,0,0.4)", padding: "1px 5px", borderRadius: 3 }}>
                T-6h Advance
              </span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.35 }}>
              {effectiveWeather.alertHeadline.replace(/^(EXTREME|SEVERE|WARNING|WATCH):\s*/, "")}
            </div>
          </div>
        )}
        {/* ── 3.0 km Micro-Radius Threat Zone Card ── */}
        <div
          className="bento-card"
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: "var(--raised)",
            border: "1px solid var(--hair-accent)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "rgba(56,189,248,0.2)",
                  border: "1.2px solid var(--signal)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Crosshair size={11} color="var(--signal)" />
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--signal)", letterSpacing: "0.03em" }}>
                3.0 KM MICRO-RADIUS IMPACT ZONE
              </span>
            </div>
            <span
              className="mono"
              style={{
                fontSize: 8.5,
                color: "var(--text-dim)",
                background: "var(--inset)",
                padding: "1px 5px",
                borderRadius: 4,
              }}
            >
              Area: 28.3 km²
            </span>
          </div>

          {/* 3km 4-Grid Tactical Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
            {/* Metric 1: Core Deluge Volume */}
            <div
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                background: "var(--inset)",
                border: "1px solid var(--hair)",
              }}
            >
              <div className="label" style={{ fontSize: 8.5, color: "var(--text-dim)" }}>
                Core Deluge Vol
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: (liveTelemetry?.three_km_metrics.estimated_deluge_volume_m3_hr ?? 0) > 0 ? "var(--signal)" : "var(--text-muted)", marginTop: 2 }}>
                {liveTelemetry
                  ? liveTelemetry.three_km_metrics.estimated_deluge_volume_m3_hr.toLocaleString()
                  : Math.round(effectiveWeather.rainMmHr * 28.27 * 1000).toLocaleString()}
                <span style={{ fontSize: 8.5, color: "var(--text-dim)", marginLeft: 2 }}>m³/h</span>
              </div>
            </div>

            {/* Metric 2: Downburst Shear Velocity */}
            <div
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                background: "var(--inset)",
                border: "1px solid var(--hair)",
              }}
            >
              <div className="label" style={{ fontSize: 8.5, color: "var(--text-dim)" }}>
                Downburst Shear
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>
                {liveTelemetry
                  ? `${liveTelemetry.three_km_metrics.downburst_shear_velocity_kmh.toFixed(0)}`
                  : `${Math.round(effectiveWeather.gustKmph * 1.05)}`}
                <span style={{ fontSize: 8.5, color: "var(--text-dim)", marginLeft: 2 }}>km/h</span>
              </div>
            </div>

            {/* Metric 3: Flash Runoff Risk */}
            <div
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                background: "var(--inset)",
                border: "1px solid var(--hair)",
              }}
            >
              <div className="label" style={{ fontSize: 8.5, color: "var(--text-dim)" }}>
                Flash Runoff Risk
              </div>
              <div style={{ marginTop: 2 }}>
                {(() => {
                  const risk = liveTelemetry?.three_km_metrics.flash_runoff_risk ?? (effectiveWeather.rainMmHr >= 40 ? "CRITICAL" : effectiveWeather.rainMmHr >= 20 ? "HIGH" : effectiveWeather.rainMmHr >= 8 ? "MODERATE" : "LOW");
                  const col = risk === "CRITICAL" ? "var(--h-extreme)" : risk === "HIGH" ? "var(--h-severe)" : risk === "MODERATE" ? "var(--h-warning)" : "var(--mint)";
                  return (
                    <span
                      className="pill mono"
                      style={{
                        fontSize: 8.5,
                        padding: "1px 5px",
                        background: `${col}22`,
                        color: col,
                        borderColor: col,
                        fontWeight: 700,
                      }}
                    >
                      {risk}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Metric 4: Convective Initiation / Core dBZ */}
            <div
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                background: "var(--inset)",
                border: "1px solid var(--hair)",
              }}
            >
              <div className="label" style={{ fontSize: 8.5, color: "var(--text-dim)" }}>
                Core Reflectivity
              </div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: "var(--signal)", marginTop: 2 }}>
                {liveTelemetry
                  ? `${liveTelemetry.three_km_metrics.convective_core_dbz.toFixed(0)} dBZ`
                  : `${effectiveWeather.reflectivityDbz.toFixed(0)} dBZ`}
                <span style={{ fontSize: 8.5, color: "var(--text-dim)", marginLeft: 4 }}>
                  (CI: {liveTelemetry?.three_km_metrics.convective_initiation_eta_min ?? 60}m)
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Radar Threat Vector Line Connection */}
          {threateningCells.length > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: "6px 8px",
                borderRadius: 6,
                background: "rgba(56,189,248,0.08)",
                border: "1px dashed rgba(56,189,248,0.35)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Zap size={11} color="var(--signal)" />
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--signal)" }}>
                    RADAR THREAT VECTOR TRACE
                  </span>
                </div>
                <span className="mono label" style={{ fontSize: 8.5, color: "var(--text-dim)" }}>
                  Cell {threateningCells[0].c.cellId}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                <span className="mono" style={{ fontSize: 10, color: "var(--text)", fontWeight: 600 }}>
                  Dist: {threateningCells[0].distKm.toFixed(1)} km ({threateningCells[0].bearing})
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    color: threateningCells[0].etaMin <= 30 ? "var(--h-extreme)" : "var(--signal)",
                    fontWeight: 700,
                  }}
                >
                  ETA: ~{threateningCells[0].etaMin}m ({threateningCells[0].c.maxDbz.toFixed(0)} dBZ)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Segmented Navigation Tabs ── */}
      <div
        className="city-detail-tabs-bar"
        style={{
          display: "flex",
          padding: "6px 8px",
          borderBottom: "1px solid var(--hair)",
          gap: 3,
          overflowX: "auto",
          overflowY: "hidden",
          whiteSpace: "nowrap",
          flexShrink: 0,
          scrollbarWidth: "none",
        }}
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className="btn btn-pill"
            data-active={tab === t.k}
            style={{
              flex: "1 0 auto",
              minWidth: "fit-content",
              fontSize: 9.5,
              padding: "4px 7px",
              textAlign: "center",
              borderColor: tab === t.k ? "var(--signal)" : "transparent",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Contents (Fully scrollable with mouse wheel, touch, and custom scrollbar) ── */}
      <div
        className="scroll city-detail-scroll-area"
        style={{
          flex: "1 1 0",
          minHeight: 0,
          maxHeight: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          padding: "8px 14px 14px",
        }}
      >
        {/* TAB 1: Surface Meteorology */}
        {tab === "conditions" && (
          <div>
            {/* Real-time WMO Condition Badge */}
            {liveTelemetry && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  borderRadius: 6,
                  background: "rgba(56,189,248,0.08)",
                  border: "1px solid rgba(56,189,248,0.25)",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <CloudLightning size={14} color="var(--signal)" />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
                      {liveTelemetry.weather_description}
                    </div>
                    <div className="label mono" style={{ fontSize: 8.5, color: "var(--text-dim)" }}>
                      WMO Standard Code #{liveTelemetry.weather_code}
                    </div>
                  </div>
                </div>
                <span
                  className="pill mono"
                  style={{
                    fontSize: 8.5,
                    background: "rgba(34,197,94,0.15)",
                    color: "var(--mint)",
                    borderColor: "rgba(34,197,94,0.3)",
                  }}
                >
                  LIVE WMO
                </span>
              </div>
            )}

            <MetricRow
              icon={Thermometer}
              label="Dry-Bulb Temperature"
              value={liveTelemetry ? liveTelemetry.temperature_c.toFixed(1) : effectiveWeather.temperatureC.toFixed(1)}
              unit="°C"
              bar={((liveTelemetry ? liveTelemetry.temperature_c : effectiveWeather.temperatureC) / 50) * 100}
            />
            <MetricRow
              icon={Thermometer}
              label="Apparent Feels Like"
              value={liveTelemetry ? liveTelemetry.apparent_temp_c.toFixed(1) : effectiveWeather.feelsLikeC.toFixed(1)}
              unit="°C"
            />
            <MetricRow
              icon={Droplets}
              label="Relative Humidity"
              value={liveTelemetry ? liveTelemetry.relative_humidity_pct.toFixed(0) : effectiveWeather.humidityPct.toFixed(0)}
              unit="%"
              bar={liveTelemetry ? liveTelemetry.relative_humidity_pct : effectiveWeather.humidityPct}
            />
            <MetricRow
              icon={Droplets}
              label="Dew Point (Td)"
              value={liveTelemetry ? liveTelemetry.dew_point_c.toFixed(1) : (effectiveWeather.temperatureC - 4.5).toFixed(1)}
              unit="°C"
            />
            <MetricRow
              icon={Activity}
              label="Dew Point Depression (T - Td)"
              value={liveTelemetry ? `${liveTelemetry.dew_point_depression_c.toFixed(1)}°C` : "4.5°C"}
              unit={
                (liveTelemetry?.dew_point_depression_c ?? 4.5) <= 3.0
                  ? "(Near Saturation)"
                  : "(Boundary Layer Unsaturated)"
              }
            />
            <MetricRow
              icon={Gauge}
              label="Mean Sea Level Pressure (MSL)"
              value={liveTelemetry ? liveTelemetry.pressure_msl_hpa.toFixed(1) : (effectiveWeather.pressureHpa + 5).toFixed(1)}
              unit="hPa (MSL)"
            />
            <MetricRow
              icon={Gauge}
              label="Ground Station Pressure"
              value={(liveTelemetry ? liveTelemetry.surface_pressure_hpa : effectiveWeather.pressureHpa).toFixed(1)}
              unit="hPa (Station)"
            />
            <MetricRow
              icon={Wind}
              label="Surface Wind Velocity"
              value={`${(liveTelemetry ? liveTelemetry.wind_speed_kmh : effectiveWeather.windKmph).toFixed(0)} km/h`}
              unit={`${cardinal(effectiveWeather.windDirDeg)} (${effectiveWeather.windDirDeg}°)`}
              bar={((liveTelemetry ? liveTelemetry.wind_speed_kmh : effectiveWeather.windKmph) / 90) * 100}
            />
            <MetricRow
              icon={Wind}
              label="Peak Convective Gust"
              value={(liveTelemetry ? liveTelemetry.wind_gusts_kmh : effectiveWeather.gustKmph).toFixed(0)}
              unit="km/h"
              sev={(liveTelemetry?.wind_gusts_kmh ?? effectiveWeather.gustKmph) >= 65 ? "sev-extreme" : undefined}
            />
            <MetricRow
              icon={CloudRain}
              label="Rainfall Deluge Rate"
              value={(liveTelemetry ? liveTelemetry.precipitation_mm_hr : effectiveWeather.rainMmHr).toFixed(1)}
              unit="mm/h"
              sev={effectiveWeather.rainMmHr >= 70 ? "sev-extreme" : effectiveWeather.rainMmHr >= 20 ? "sev-warning" : undefined}
              bar={(effectiveWeather.rainMmHr / 120) * 100}
            />
            <MetricRow
              icon={Eye}
              label="Cloud Cover"
              value={liveTelemetry ? liveTelemetry.cloud_cover_pct.toFixed(0) : "55"}
              unit="%"
              bar={liveTelemetry ? liveTelemetry.cloud_cover_pct : 55}
            />
            <MetricRow
              icon={Eye}
              label="Optical Visibility"
              value={effectiveWeather.visibilityKm.toFixed(1)}
              unit="km"
            />
          </div>
        )}

        {/* TAB 2: 6-Hour Weather Anomaly Hourly Breakdown */}
        {tab === "forecast6h" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <span className="label" style={{ fontSize: 9.5, display: "flex", alignItems: "center", gap: 5 }}>
                <Clock size={11} color="var(--signal)" /> 6-Hour Advance Prediction
              </span>
              <span className="mono label" style={{ fontSize: 8.5, color: "var(--mint)" }}>
                Backend 3 km grid · 5 min refresh
              </span>
            </div>

            {loadingLive ? (
              <div style={{ padding: "30px 0", textAlign: "center", color: "var(--signal)", fontSize: 11 }}>
                Querying live 6-hour forecast...
              </div>
            ) : liveTelemetry?.hourly6h && liveTelemetry.hourly6h.length > 0 ? (
              liveTelemetry.hourly6h.map((h) => {
                const isAnomaly = h.anomaly_severity !== "NORMAL";
                const sevCol =
                  h.anomaly_severity === "EXTREME"
                    ? "var(--h-extreme)"
                    : h.anomaly_severity === "SEVERE"
                    ? "var(--h-severe)"
                    : h.anomaly_severity === "WARNING"
                    ? "var(--h-warning)"
                    : "var(--mint)";

                return (
                  <div
                    key={h.hourOffset}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: isAnomaly ? "rgba(244,63,94,0.1)" : "var(--inset)",
                      border: `1px solid ${isAnomaly ? sevCol : "var(--hair)"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
                          +{h.hourOffset}h ({h.hourOffset * 60}m)
                        </span>
                        {isAnomaly ? (
                          <span
                            className="pill"
                            style={{
                              fontSize: 8,
                              padding: "1px 5px",
                              background: `${sevCol}22`,
                              color: sevCol,
                              borderColor: sevCol,
                            }}
                          >
                            {h.anomaly_severity}
                          </span>
                        ) : (
                          <span className="label mono" style={{ fontSize: 8.5, color: "var(--text-dim)" }}>
                            {h.weather_description}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
                          {h.temperature_c.toFixed(0)}°C
                        </span>
                        <span className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>
                          ({h.pressure_msl_hpa} hPa)
                        </span>
                      </div>
                    </div>

                    {/* Meteorological Parameters */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 9.5, color: "var(--text-dim)" }}>
                      <span>Rain: <strong style={{ color: "var(--text)" }}>{h.precipitation_mm.toFixed(1)} mm/h</strong> ({h.precipitation_probability_pct}%)</span>
                      <span>CAPE: <strong style={{ color: h.cape_j_kg >= 1500 ? "var(--h-extreme)" : "var(--text)" }}>{h.cape_j_kg.toFixed(0)} J/kg</strong></span>
                      <span>Depression: <strong style={{ color: h.dew_point_depression_c <= 3 ? "var(--signal)" : "var(--text)" }}>{h.dew_point_depression_c.toFixed(1)}°C</strong></span>
                    </div>

                    {/* 3km Micro-Radius Impact Indicator */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 4,
                        paddingTop: 4,
                        borderTop: "1px dashed rgba(255,255,255,0.08)",
                        fontSize: 8.5,
                      }}
                    >
                      <span className="mono" style={{ color: "var(--signal)" }}>
                        🎯 3km Vol: <strong>{h.three_km_deluge_volume_m3_hr.toLocaleString()} m³/h</strong>
                      </span>
                      <span
                        className="mono"
                        style={{
                          color:
                            h.three_km_flash_flood_risk === "CRITICAL"
                              ? "var(--h-extreme)"
                              : h.three_km_flash_flood_risk === "HIGH"
                              ? "var(--h-severe)"
                              : h.three_km_flash_flood_risk === "MODERATE"
                              ? "var(--h-warning)"
                              : "var(--text-dim)",
                          fontWeight: 700,
                        }}
                      >
                        Flash Risk: {h.three_km_flash_flood_risk}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              // Fallback 6-hour simulation projections
              [1, 2, 3, 4, 5, 6].map((hour) => {
                const precip = Math.max(0, effectiveWeather.rainMmHr * (1 - hour * 0.12) + (hour === 2 ? 15 : 0));
                return (
                  <div
                    key={hour}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 6,
                      background: "var(--inset)",
                      border: "1px solid var(--hair)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                      +{hour}h ({hour * 60}m)
                    </span>
                    <span className="mono" style={{ fontSize: 10, color: precip >= 40 ? "var(--h-extreme)" : "var(--text-muted)" }}>
                      Rain: {precip.toFixed(1)} mm/h
                    </span>
                    <span className="label" style={{ fontSize: 8.5, color: "var(--signal)" }}>
                      Sim Model
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: Convective & Severe Radar Indices */}
        {tab === "indices" && (
          <div>
            <MetricRow
              icon={Radar}
              label="Radar Reflectivity (Z)"
              value={effectiveWeather.reflectivityDbz.toFixed(0)}
              unit="dBZ"
              sev={
                effectiveWeather.reflectivityDbz >= 55
                  ? "sev-extreme"
                  : effectiveWeather.reflectivityDbz >= 45
                  ? "sev-severe"
                  : "sev-warning"
              }
              bar={(effectiveWeather.reflectivityDbz / 70) * 100}
            />
            <MetricRow
              icon={Snowflake}
              label="Severe Hail MESH"
              value={effectiveWeather.hailMeshMm > 0 ? effectiveWeather.hailMeshMm.toFixed(0) : "0"}
              unit="mm"
              sev={effectiveWeather.hailMeshMm >= 25 ? "sev-extreme" : undefined}
            />
            <MetricRow
              icon={Snowflake}
              label="Severe Hail Probability (POSH)"
              value={effectiveWeather.hailPoshPct.toFixed(0)}
              unit="%"
              bar={effectiveWeather.hailPoshPct}
            />
            <MetricRow
              icon={Zap}
              label="Lightning Strike Density"
              value={effectiveWeather.lightningFlashesKm2.toFixed(1)}
              unit="fl/km²"
              sev={effectiveWeather.lightningFlashesKm2 >= 15 ? "sev-extreme" : undefined}
              bar={(effectiveWeather.lightningFlashesKm2 / 30) * 100}
            />
            <MetricRow
              icon={Wind}
              label="Convective Wind Gust Peak"
              value={effectiveWeather.gustKmph.toFixed(0)}
              unit="km/h"
              sev={effectiveWeather.gustKmph >= 65 ? "sev-extreme" : undefined}
              bar={(effectiveWeather.gustKmph / 110) * 100}
            />
            <MetricRow
              icon={TrendingUp}
              label="Cloud-Top Cooling (CTCR)"
              value={effectiveWeather.ctcrKPer15min.toFixed(1)}
              unit="K/15m"
              sev={effectiveWeather.ctcrKPer15min <= -4 ? "sev-extreme" : undefined}
            />
          </div>
        )}

        {/* TAB 4: Proximity & Surrounding Threat Radar */}
        {tab === "proximity" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div className="label" style={{ fontSize: 9.5, marginBottom: 6 }}>
                Nearest Storm Cells (&lt; 500 km)
              </div>
              {threateningCells.length === 0 ? (
                <div style={{ fontSize: 10.5, color: "var(--text-dim)", padding: "12px 0", textAlign: "center" }}>
                  No active storm cells detected in 500 km radius.
                </div>
              ) : (
                threateningCells.map(({ c, d }) => {
                  const sev =
                    c.severity === "CRITICAL"
                      ? "sev-extreme"
                      : c.severity === "HIGH"
                      ? "sev-severe"
                      : "sev-warning";
                  return (
                    <div
                      key={c.cellId}
                      className={`bento-card ${sev}`}
                      style={{
                        padding: "7px 10px",
                        marginBottom: 6,
                        borderLeftWidth: 3,
                        borderLeftColor: "var(--sev)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                          {c.cellId.replace("CELL-", "#")}
                        </span>
                        <span className={`pill ${sev}`} style={{ fontSize: 8 }}>
                          {c.severity} · {c.maxDbz.toFixed(0)} dBZ
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9.5, color: "var(--text-muted)" }}>
                        <span>Distance: {d.toFixed(0)} km</span>
                        <span>Vector: {c.speedKmph} km/h {c.direction}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div>
              <div className="label" style={{ fontSize: 9.5, marginBottom: 6 }}>
                Adjacent Monitored Cities
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {nearbyCities.slice(0, 6).map((nc) => (
                  <button
                    key={nc.cityId}
                    onClick={() => onPickCityName(nc.cityName)}
                    className="btn"
                    style={{
                      width: "100%",
                      justifyContent: "space-between",
                      padding: "5px 8px",
                      fontSize: 11,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className={`dot ${HAZ_CLASS[nc.hazard]}`} />
                      <span>{nc.cityName}</span>
                    </div>
                    <span className="mono" style={{ color: "var(--text-dim)", fontSize: 10 }}>
                      {nc.temperatureC.toFixed(0)}°C
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
