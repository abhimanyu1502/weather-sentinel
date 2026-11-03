import React, { useState } from "react";
import { StormCell } from "../types/weather";
import {
  X, Zap, CloudRain, Wind, Activity, ThermometerSnowflake,
  AlertTriangle, ChevronDown, ChevronUp, Navigation2
} from "lucide-react";

interface Props {
  cell: StormCell | null;
  onClose: () => void;
}

function Gauge({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color, fontWeight: 700 }}>{value.toFixed(1)}</span>
      </div>
      <div className="gauge-bar">
        <div className="gauge-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function PhysicsGrid({ cell }: { cell: StormCell }) {
  const rows = [
    { key: "Max Reflectivity (dBZ)", val: `${cell.max_dbz.toFixed(1)} dBZ` },
    { key: "Rain Rate", val: `${cell.rain_rate_mm_hr.toFixed(1)} mm/hr` },
    { key: "MESH Hail Size", val: `${cell.hail_mesh_mm.toFixed(1)} mm` },
    { key: "POSH (Hail Prob.)", val: `${cell.hail_posh_pct.toFixed(0)}%` },
    { key: "Downburst Gust", val: `${cell.downburst_gust_kmh.toFixed(0)} km/h` },
    { key: "Lightning Intensity", val: `${cell.lightning_intensity.toFixed(0)} fl/km²` },
    { key: "Cell Area", val: `${cell.area_km2.toFixed(0)} km²` },
    { key: "Speed / Heading", val: `${cell.movement.speed_kmh.toFixed(0)} km/h ${cell.movement.direction}` },
  ];
  return (
    <div>
      {rows.map(({ key, val }) => (
        <div key={key} className="info-row">
          <span className="key">{key}</span>
          <span className="val">{val}</span>
        </div>
      ))}
    </div>
  );
}

export function StormDetailDrawer({ cell, onClose }: Props) {
  const [tab, setTab] = useState<"overview" | "physics" | "impacts">("overview");
  const [expanded, setExpanded] = useState(true);

  if (!cell) return null;

  const isCrit = cell.severity === "CRITICAL";
  const isHigh = cell.severity === "HIGH";
  const sevColor = isCrit ? "var(--sev-critical)" : isHigh ? "var(--sev-high)" : "var(--sev-moderate)";
  const badgeClass = isCrit ? "badge-critical" : isHigh ? "badge-high" : "badge-moderate";

  const flags: { label: string; active: boolean; color: string }[] = [
    { label: "CLOUDBURST", active: cell.is_cloudburst,   color: "#34d399" },
    { label: "SEVERE HAIL", active: cell.is_severe_hail, color: "#c084fc" },
    { label: "DOWNBURST",  active: cell.is_downburst,   color: "#f87171" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        width: "min(860px, calc(100vw - 32px))",
        background: "var(--bg-panel)",
        border: "1px solid var(--border-bright)",
        borderBottom: "none",
        borderRadius: "16px 16px 0 0",
        boxShadow: "0 -12px 60px rgba(0,0,0,0.7), 0 0 30px -10px " + sevColor,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        maxHeight: expanded ? "440px" : "60px",
      }}
    >
      {/* Handle bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 18px",
          borderBottom: expanded ? "1px solid var(--border)" : "none",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Severity dot */}
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: sevColor, boxShadow: `0 0 8px ${sevColor}`, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
              Cell {cell.cell_id}
            </span>
            <span className={`badge ${badgeClass}`}>{cell.severity}</span>
            {flags.filter(f => f.active).map(f => (
              <span key={f.label} style={{ fontSize: 9, fontWeight: 800, color: f.color, background: `${f.color}18`, border: `1px solid ${f.color}40`, borderRadius: 4, padding: "1px 5px" }}>
                {f.label}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
            {cell.lat.toFixed(4)}°N, {cell.lon.toFixed(4)}°E · {cell.max_dbz.toFixed(0)} dBZ · {cell.rain_rate_mm_hr.toFixed(0)} mm/hr
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="btn btn-sm"
            style={{ padding: "4px 6px" }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="btn btn-sm"
            style={{ padding: "4px 6px" }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div style={{ padding: "0 18px 16px 18px", overflow: "auto", maxHeight: "360px" }}>
          {/* Tabs */}
          <div className="tab-bar" style={{ marginTop: 12, marginBottom: 14 }}>
            {(["overview", "physics", "impacts"] as const).map(t => (
              <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t === "overview" ? "Overview" : t === "physics" ? "Physics Metrics" : `Impacts (${cell.countdown_targets?.length ?? 0})`}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Left: gauges */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Gauge value={cell.max_dbz}           max={75}  color={cell.max_dbz >= 55 ? "var(--sev-critical)" : "var(--cyan)"} label="Reflectivity (dBZ)" />
                <Gauge value={cell.rain_rate_mm_hr}   max={200} color={cell.is_cloudburst ? "var(--sev-critical)" : "var(--col-rain)"} label="Rain Rate (mm/hr)" />
                <Gauge value={cell.downburst_gust_kmh} max={140} color={cell.is_downburst ? "var(--sev-critical)" : "var(--col-wind)"} label="Downburst Gust (km/h)" />
                <Gauge value={cell.hail_posh_pct}     max={100} color={cell.is_severe_hail ? "var(--col-hail)" : "var(--text-muted)"} label="POSH Hail Prob. (%)" />
              </div>

              {/* Right: movement + flags */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Movement */}
                <div className="metric-box">
                  <div className="metric-label">Cell Movement</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <Navigation2
                      size={22}
                      color={sevColor}
                      style={{ transform: `rotate(${cell.movement.heading_deg}deg)`, flexShrink: 0 }}
                    />
                    <div>
                      <div className="metric-value" style={{ fontSize: 18, color: sevColor }}>
                        {cell.movement.speed_kmh.toFixed(0)} km/h
                      </div>
                      <div className="metric-sub">{cell.movement.direction} · {cell.movement.heading_deg.toFixed(0)}°</div>
                    </div>
                  </div>
                </div>

                {/* Lightning */}
                <div className="metric-box">
                  <div className="metric-label">Lightning Activity</div>
                  <div className="metric-value" style={{ fontSize: 18, color: "var(--col-lightning)" }}>
                    {cell.lightning_intensity.toFixed(0)} <span style={{ fontSize: 12 }}>fl/km²</span>
                  </div>
                </div>

                {/* Hazard flags */}
                <div className="metric-box" style={{ gap: 6 }}>
                  <div className="metric-label">Hazard Flags</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                    {flags.map(f => (
                      <span
                        key={f.label}
                        style={{
                          fontSize: 9, fontWeight: 800,
                          color: f.active ? f.color : "var(--text-dim)",
                          background: f.active ? `${f.color}18` : "transparent",
                          border: `1px solid ${f.active ? f.color + "40" : "var(--border)"}`,
                          borderRadius: 4, padding: "2px 6px",
                        }}
                      >
                        {f.active ? "✓" : "–"} {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "physics" && <PhysicsGrid cell={cell} />}

          {tab === "impacts" && (
            <div>
              {cell.countdown_targets && cell.countdown_targets.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {cell.countdown_targets.map((t, i) => {
                    const mins = Math.floor(t.eta_seconds / 60);
                    const secs = t.eta_seconds % 60;
                    const c = t.hazard_level?.includes("RED") ? "var(--sev-critical)" : t.hazard_level?.includes("ORANGE") ? "var(--sev-high)" : "var(--sev-moderate)";
                    return (
                      <div key={i} style={{ background: "var(--bg-card)", border: `1px solid var(--border)`, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.target_name}
                        </div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 16, fontWeight: 700, color: c }}>
                          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                          {t.distance_km.toFixed(1)} km · {t.category}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: 12 }}>
                  No landmark impact zones computed for this cell.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
