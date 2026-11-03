import { useMemo, useState } from "react";
import {
  Activity,
  Siren,
  Zap,
  CloudRain,
  Wind,
  Snowflake,
  ArrowUpRight,
  Gauge,
  Radar,
  Timer,
  MapPin,
  TrendingUp,
  Search,
  ChevronRight,
  ShieldAlert,
  Flame,
  Globe2,
} from "lucide-react";
import { CityWeather, HazardLevel, NationalSummary, StormCell, NowcastData } from "../lib/weatherEngine";
import { INDIA_REGIONS } from "../data/indiaGeo";

interface Props {
  cities: CityWeather[];
  cells: StormCell[];
  summary: NationalSummary;
  selectedCellId: string | null;
  nowcast?: NowcastData | null;
  onPickCell: (c: StormCell) => void;
  onPickCityName: (n: string) => void;
}

const HAZ_CLASS: Record<HazardLevel, string> = {
  NONE: "sev-none",
  WATCH: "sev-watch",
  WARNING: "sev-warning",
  SEVERE: "sev-severe",
  EXTREME: "sev-extreme",
};

function BentoKpiCard({
  icon: Icon,
  label,
  value,
  unit,
  sev,
  sub,
  meter,
  trend,
}: {
  icon: any;
  label: string;
  value: string;
  unit?: string;
  sev?: string;
  sub?: string;
  meter?: number;
  trend?: string;
}) {
  return (
    <div
      className={`bento-card ${sev ?? ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 104,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span className="label" style={{ fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "rgba(56,189,248,0.1)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon size={12} color="var(--sev, var(--signal))" />
        </div>
      </div>

      <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          className="mono"
          style={{
            fontSize: 24,
            fontWeight: 800,
            lineHeight: 1,
            color: "var(--sev, var(--text))",
            letterSpacing: "-0.03em",
          }}
        >
          {value}
        </span>
        {unit && <span className="label" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{unit}</span>}
      </div>

      <div style={{ marginTop: 6 }}>
        {sub && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 9, color: "var(--text-dim)" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
            {trend && <span className="mono" style={{ color: "var(--signal)", fontWeight: 700 }}>{trend}</span>}
          </div>
        )}
        {meter !== undefined && (
          <div className={`meter ${sev ?? ""}`} style={{ marginTop: 6, height: 4 }}>
            <i style={{ width: `${Math.max(2, Math.min(100, meter))}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** SVG Sparkline for Trend Visualizations */
function Sparkline({ data, sev, w = 92, h = 22 }: { data: number[]; sev?: string; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`)
    .join(" ");

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke="var(--sev, var(--signal))" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={w} cy={h - 2 - ((data[data.length - 1] - min) / span) * (h - 4)} r="2" fill="var(--sev, var(--signal))" />
    </svg>
  );
}

export function DashboardGrid({
  cities,
  cells,
  summary,
  selectedCellId,
  nowcast,
  onPickCell,
  onPickCityName,
}: Props) {
  const [cellSearch, setCellSearch] = useState("");
  const [stateSearch, setStateSearch] = useState("");

  const sortedCells = useMemo(() => [...cells].sort((a, b) => b.maxDbz - a.maxDbz), [cells]);

  const filteredCells = useMemo(() => {
    if (!cellSearch) return sortedCells;
    const q = cellSearch.toLowerCase();
    return sortedCells.filter(
      (c) => c.cellId.toLowerCase().includes(q) || c.severity.toLowerCase().includes(q)
    );
  }, [sortedCells, cellSearch]);

  const topRain = useMemo(() => [...cities].sort((a, b) => b.rainMmHr - a.rainMmHr).slice(0, 8), [cities]);

  // Warning and Severe/Extreme cities
  const warnCities = useMemo(
    () =>
      cities
        .filter((c) => c.hazard === "WARNING" || c.hazard === "SEVERE" || c.hazard === "EXTREME")
        .sort((a, b) => b.hazardScore - a.hazardScore),
    [cities]
  );
  const watchCount = useMemo(() => cities.filter((c) => c.hazard === "WATCH").length, [cities]);

  // 36 State roll-up table
  const stateRows = useMemo(() => {
    const rank = ["EXTREME", "SEVERE", "WARNING", "WATCH", "NONE"];
    const rows = INDIA_REGIONS.map((r) => {
      const ws = r.cities.map((c) => cities.find((x) => x.cityId === c.id)).filter(Boolean) as CityWeather[];
      const worst = ws.reduce<HazardLevel>((acc, w) => (rank.indexOf(w.hazard) < rank.indexOf(acc) ? w.hazard : acc), "NONE");
      return {
        name: r.name,
        short: r.short,
        zone: r.zone,
        worst,
        maxDbz: ws.length ? Math.max(...ws.map((w) => w.reflectivityDbz)) : 0,
        rain: ws.length ? Math.max(...ws.map((w) => w.rainMmHr)) : 0,
        alerts: ws.filter((w) => w.hazard === "WARNING" || w.hazard === "SEVERE" || w.hazard === "EXTREME").length,
      };
    }).sort((a, b) => rank.indexOf(a.worst) - rank.indexOf(b.worst) || b.maxDbz - a.maxDbz);

    if (!stateSearch) return rows;
    const q = stateSearch.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.zone.toLowerCase().includes(q));
  }, [cities, stateSearch]);

  const maxScore = Math.max(1, ...cities.map((c) => c.hazardScore));
  const hasMlNowcast = !!(nowcast && nowcast.timesteps && nowcast.timesteps.length > 0);

  return (
    <div
      className="scroll"
      style={{
        flex: 1,
        padding: 12,
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(12, 1fr)",
        gridAutoRows: "min-content",
        background: "transparent",
      }}
    >
      {/* ── 1. Top Hero KPI Cards (Bento Strip) ── */}
      <div className="kpi-grid" style={{ gridColumn: "span 12" }}>
        <BentoKpiCard
          icon={ShieldAlert}
          label="National Hazard"
          value={summary.nationalHazard}
          sev={HAZ_CLASS[summary.nationalHazard]}
          sub="Composite Warning Index"
          trend="Realtime"
        />
        <BentoKpiCard
          icon={Radar}
          label="Peak Reflectivity"
          value={summary.maxDbz.toFixed(0)}
          unit="dBZ"
          sev={summary.maxDbz >= 55 ? "sev-extreme" : summary.maxDbz >= 45 ? "sev-severe" : "sev-warning"}
          meter={(summary.maxDbz / 70) * 100}
          sub="Doppler Core Peak"
        />
        <BentoKpiCard
          icon={CloudRain}
          label="Max Precipitation"
          value={summary.maxRainMmHr.toFixed(0)}
          unit="mm/h"
          sev={summary.maxRainMmHr >= 100 ? "sev-extreme" : summary.maxRainMmHr >= 40 ? "sev-severe" : "sev-watch"}
          meter={(summary.maxRainMmHr / 150) * 100}
          sub={summary.cloudburstCells > 0 ? `${summary.cloudburstCells} Cloudburst Cells` : "Normal Drainage"}
        />
        <BentoKpiCard
          icon={Zap}
          label="Lightning Activity"
          value={summary.totalLightning.toFixed(0)}
          unit="fl/km²"
          sev="sev-warning"
          meter={(summary.totalLightning / 400) * 100}
          sub="DAMINI Sensor Matrix"
        />
        <BentoKpiCard
          icon={Activity}
          label="Active Storm Cells"
          value={String(summary.totalCells)}
          sev={summary.criticalCells > 0 ? "sev-extreme" : summary.highCells > 0 ? "sev-severe" : "sev-watch"}
          sub={`${summary.criticalCells} Critical · ${summary.highCells} High`}
        />
        <BentoKpiCard
          icon={Siren}
          label="Cities At Risk"
          value={String(summary.citiesUnderWarning + summary.citiesUnderSevere)}
          sev={summary.citiesUnderSevere > 0 ? "sev-extreme" : "sev-warning"}
          sub={`${summary.citiesUnderSevere} Severe · ${summary.citiesUnderWarning} Warning`}
        />
        <BentoKpiCard
          icon={Snowflake}
          label="Severe Hail Threat"
          value={String(summary.severeHailCells)}
          unit="cells"
          sev={summary.severeHailCells > 0 ? "sev-extreme" : "sev-none"}
          sub="MESH ≥ 25mm Threshold"
        />
        <BentoKpiCard
          icon={Wind}
          label="Monsoon Dynamic"
          value={`${summary.monsoonIntensityPct}%`}
          sev={summary.monsoonIntensityPct > 70 ? "sev-severe" : "sev-watch"}
          meter={summary.monsoonIntensityPct}
          sub="SW Synoptic Index"
        />
      </div>

      {/* ── 2. Active Alert Priority Matrix (Span 4) ── */}
      <div className="panel-glass" style={{ gridColumn: "span 4", display: "flex", flexDirection: "column", minHeight: 290 }}>
        <div className="panel-head">
          <span className="accent">
            <Siren size={13} style={{ verticalAlign: -1 }} /> Active Warning Alerts
          </span>
          <span className="pill pill--alert" style={{ fontSize: 9 }}>
            {warnCities.length} Issued {watchCount > 0 && `· ${watchCount} Watch`}
          </span>
        </div>

        <div className="scroll" style={{ flex: 1, padding: "8px 12px" }}>
          {warnCities.length === 0 ? (
            <div style={{ padding: "34px 0", textAlign: "center", color: "var(--text-dim)", fontSize: 11 }}>
              No critical convective weather alerts active across monitored cities.
            </div>
          ) : (
            warnCities.map((c) => (
              <button
                key={c.cityId}
                onClick={() => onPickCityName(c.cityName)}
                className={`bento-card ${HAZ_CLASS[c.hazard]}`}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  marginBottom: 8,
                  cursor: "pointer",
                  borderLeftWidth: 3,
                  borderLeftColor: "var(--sev)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="dot" style={{ background: "var(--sev)", boxShadow: "0 0 6px var(--sev)" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.cityName}</span>
                    <span style={{ fontSize: 9.5, color: "var(--text-dim)" }}>({c.state})</span>
                  </div>
                  <span className={`pill ${HAZ_CLASS[c.hazard]}`} style={{ fontSize: 8.5 }}>
                    {c.hazard} {c.hazardScore}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    marginTop: 4,
                    lineHeight: 1.35,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.alertHeadline.replace(/^(EXTREME|SEVERE|WARNING|WATCH):\s*/, "")}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── 3. Storm Cell Radar Register (Span 5) ── */}
      <div className="panel-glass" style={{ gridColumn: "span 5", display: "flex", flexDirection: "column", minHeight: 290 }}>
        <div className="panel-head">
          <span className="accent">
            <Radar size={13} style={{ verticalAlign: -1 }} /> Tracked Storm Cells
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "var(--inset)",
                border: "1px solid var(--hair)",
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              <Search size={10} color="var(--text-dim)" />
              <input
                type="text"
                value={cellSearch}
                onChange={(e) => setCellSearch(e.target.value)}
                placeholder="Search cell..."
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text)",
                  fontSize: 10,
                  width: 70,
                }}
              />
            </div>
            <span className="mono label" style={{ fontSize: 9 }}>{cells.length} cells</span>
          </div>
        </div>

        <div className="scroll" style={{ flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "var(--inset)" }}>
                {["Cell", "Tier", "dBZ", "Rain", "Hail", "Gust", "Vector"].map((h) => (
                  <th
                    key={h}
                    className="label"
                    style={{
                      fontSize: 8.5,
                      textAlign: "left",
                      padding: "6px 8px",
                      borderBottom: "1px solid var(--hair)",
                      fontWeight: 700,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCells.map((c) => {
                const sev =
                  c.severity === "CRITICAL"
                    ? "sev-extreme"
                    : c.severity === "HIGH"
                    ? "sev-severe"
                    : c.severity === "MODERATE"
                    ? "sev-warning"
                    : "sev-watch";
                const isSel = selectedCellId === c.cellId;

                return (
                  <tr
                    key={c.cellId}
                    onClick={() => onPickCell(c)}
                    style={{
                      cursor: "pointer",
                      background: isSel ? "rgba(56,189,248,0.18)" : "transparent",
                      borderBottom: "1px solid rgba(148,163,184,0.06)",
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.035)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td className="mono" style={{ padding: "6px 8px", fontWeight: 700, color: "var(--text)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span className={`dot ${sev}`} />
                        {c.cellId.replace("CELL-", "#")}
                      </div>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <span className={`pill ${sev}`} style={{ fontSize: 8 }}>{c.severity}</span>
                    </td>
                    <td className={`mono ${sev}`} style={{ padding: "6px 8px", fontWeight: 700 }}>
                      {c.maxDbz.toFixed(0)}
                    </td>
                    <td className="mono" style={{ padding: "6px 8px", color: c.rainRateMmHr >= 80 ? "var(--h-extreme)" : "var(--text-muted)" }}>
                      {c.rainRateMmHr.toFixed(0)} <span style={{ fontSize: 8.5, color: "var(--text-dim)" }}>mm/h</span>
                    </td>
                    <td className="mono" style={{ padding: "6px 8px", color: c.hailMeshMm >= 25 ? "var(--h-extreme)" : "var(--text-dim)" }}>
                      {c.hailMeshMm > 0 ? `${c.hailMeshMm.toFixed(0)}mm` : "—"}
                    </td>
                    <td className="mono" style={{ padding: "6px 8px", color: "var(--text-dim)" }}>
                      {c.gustKmph.toFixed(0)} km/h
                    </td>
                    <td className="mono" style={{ padding: "6px 8px", color: "var(--signal)", fontSize: 9.5 }}>
                      {c.speedKmph} km/h {c.direction}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. 0–6 Hour Weather Anomaly Horizon (T-6h Advance Warning) (Span 3) ── */}
      <div className="panel-glass" style={{ gridColumn: "span 3", display: "flex", flexDirection: "column", minHeight: 290 }}>
        <div className="panel-head">
          <span className="accent">
            <TrendingUp size={13} style={{ verticalAlign: -1 }} /> 0–6h Anomaly Horizon
          </span>
          <span className="pill pill--live" style={{ fontSize: 8 }}>
            T-6h Advance
          </span>
        </div>

        <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          {hasMlNowcast && (
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(56,189,248,0.08)",
                border: "1px solid rgba(56,189,248,0.25)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--signal)", fontSize: 9.5, fontWeight: 700 }}>
                <span>6-Hour Convective Projection</span>
                <span>{nowcast!.timesteps.length} Steps</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "var(--text-muted)" }}>
                <span>+1h: {nowcast!.timesteps[0]?.predicted_max_dbz.toFixed(0)} dBZ</span>
                <span>+3h: {nowcast!.timesteps[Math.floor(nowcast!.timesteps.length / 2)]?.predicted_max_dbz.toFixed(0)} dBZ</span>
                <span>+6h: {nowcast!.timesteps[nowcast!.timesteps.length - 1]?.predicted_max_dbz.toFixed(0)} dBZ</span>
              </div>
            </div>
          )}

          <div className="scroll" style={{ flex: 1 }}>
            {sortedCells.slice(0, 6).map((c) => {
              const base = c.maxDbz;
              let proj: number[];
              if (hasMlNowcast) {
                const maxSteps = nowcast!.timesteps;
                const refBase = maxSteps[0]?.predicted_max_dbz || 45;
                proj = maxSteps.slice(0, 7).map((ts) => Math.max(15, base * (ts.predicted_max_dbz / refBase)));
              } else {
                proj = Array.from({ length: 7 }, (_, i) => {
                  const decay = 1 - Math.min(0.55, i * 0.08);
                  return base * decay + Math.sin(i * 1.1 + c.maxDbz) * 2.4;
                });
              }

              const sev =
                c.severity === "CRITICAL" ? "sev-extreme" : c.severity === "HIGH" ? "sev-severe" : "sev-warning";

              return (
                <div key={c.cellId} style={{ marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span className={`dot ${sev}`} />
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                        {c.cellId.replace("CELL-", "#")}
                      </span>
                    </div>
                    <Sparkline data={proj} sev={sev} w={80} h={18} />
                  </div>
                  <div className="label mono" style={{ fontSize: 8.5 }}>
                    +30m: {(proj[1] ?? base * 0.98).toFixed(0)} dBZ → +120m: {(proj[proj.length - 1] ?? base * 0.6).toFixed(0)} dBZ
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 5. State / UT Roll-up Matrix (Span 7) ── */}
      <div className="panel-glass" style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", minHeight: 280 }}>
        <div className="panel-head">
          <span className="accent">
            <MapPin size={13} style={{ verticalAlign: -1 }} /> 36 States &amp; UTs Synthesis
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "var(--inset)",
              border: "1px solid var(--hair)",
              borderRadius: 4,
              padding: "2px 6px",
            }}
          >
            <Search size={10} color="var(--text-dim)" />
            <input
              type="text"
              value={stateSearch}
              onChange={(e) => setStateSearch(e.target.value)}
              placeholder="Filter state..."
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text)",
                fontSize: 10,
                width: 75,
              }}
            />
          </div>
        </div>

        <div className="scroll" style={{ flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "var(--inset)" }}>
                {["State / UT", "Zone", "Worst Tier", "Max dBZ", "Peak Rain", "Alerts", "Reflectivity Bar"].map(
                  (h, i) => (
                    <th
                      key={i}
                      className="label"
                      style={{
                        fontSize: 8.5,
                        textAlign: "left",
                        padding: "6px 8px",
                        borderBottom: "1px solid var(--hair)",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {stateRows.map((r) => (
                <tr key={r.short} style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className={`dot ${HAZ_CLASS[r.worst]}`} />
                      {r.name}
                    </div>
                  </td>
                  <td className="label" style={{ fontSize: 9, padding: "6px 8px" }}>{r.zone}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <span className={`pill ${HAZ_CLASS[r.worst]}`} style={{ fontSize: 8 }}>{r.worst}</span>
                  </td>
                  <td className="mono" style={{ padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}>
                    {r.maxDbz.toFixed(0)}
                  </td>
                  <td className="mono" style={{ padding: "6px 8px", color: r.rain >= 70 ? "var(--h-extreme)" : "var(--text-muted)" }}>
                    {r.rain.toFixed(0)} <span style={{ fontSize: 8.5, color: "var(--text-dim)" }}>mm/h</span>
                  </td>
                  <td className="mono" style={{ padding: "6px 8px", color: r.alerts > 0 ? "var(--h-warning)" : "var(--text-dim)" }}>
                    {r.alerts}
                  </td>
                  <td style={{ padding: "6px 8px", width: 90 }}>
                    <div className={`meter ${HAZ_CLASS[r.worst]}`} style={{ height: 4 }}>
                      <i style={{ width: `${(r.maxDbz / 70) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 6. Precipitation Velocity Leaders (Span 5) ── */}
      <div className="panel-glass" style={{ gridColumn: "span 5", display: "flex", flexDirection: "column", minHeight: 280 }}>
        <div className="panel-head">
          <span className="accent">
            <CloudRain size={13} style={{ verticalAlign: -1 }} /> Rainfall Velocity Leaders
          </span>
          <span className="label mono" style={{ fontSize: 9 }}>mm/h Instantaneous</span>
        </div>

        <div className="scroll" style={{ flex: 1, padding: "8px 12px" }}>
          {topRain.map((c, i) => (
            <div
              key={c.cityId}
              onClick={() => onPickCityName(c.cityName)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 6,
                cursor: "pointer",
                marginBottom: 3,
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.035)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="mono label" style={{ fontSize: 9, width: 14 }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: "var(--text)" }}>{c.cityName}</span>
              <div className="meter sev-watch" style={{ width: 100, height: 5 }}>
                <i style={{ width: `${Math.min(100, (c.rainMmHr / 140) * 100)}%` }} />
              </div>
              <span
                className={`mono ${c.rainMmHr >= 80 ? "sev-extreme" : "sev-watch"}`}
                style={{ fontSize: 11, width: 60, textAlign: "right", fontWeight: 700 }}
              >
                {c.rainMmHr.toFixed(0)} mm/h
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 7. National Hazard Distribution Matrix (Span 12) ── */}
      <div className="panel-glass" style={{ gridColumn: "span 12", padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div className="label" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Gauge size={12} color="var(--signal)" /> Pan-India City Hazard Distribution Matrix
          </div>
          <span className="label mono" style={{ fontSize: 9.5 }}>{cities.length} Monitored Metros &amp; Towns</span>
        </div>

        <div style={{ display: "flex", gap: 4, height: 28, borderRadius: 6, overflow: "hidden", border: "1px solid var(--hair)" }}>
          {(["NONE", "WATCH", "WARNING", "SEVERE", "EXTREME"] as HazardLevel[]).map((h) => {
            const n = cities.filter((c) => c.hazard === h).length;
            return (
              <div
                key={h}
                className={HAZ_CLASS[h]}
                title={`${h}: ${n} cities`}
                style={{
                  width: `${(n / maxScore) * 100}%`,
                  minWidth: n > 0 ? 32 : 0,
                  background: "color-mix(in srgb, var(--sev) 35%, transparent)",
                  borderRight: "1px solid rgba(0,0,0,0.4)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  color: "var(--text)",
                }}
              >
                {n > 0 && n}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
          {(["NONE", "WATCH", "WARNING", "SEVERE", "EXTREME"] as HazardLevel[]).map((h) => (
            <span key={h} className={HAZ_CLASS[h]} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700 }}>
              <span className="dot" style={{ background: "currentColor" }} />
              {h}: {cities.filter((c) => c.hazard === h).length}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
