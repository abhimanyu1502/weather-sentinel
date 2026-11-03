import React, { useRef, useEffect, useMemo } from "react";
import maplibregl from "maplibre-gl";
import { HazardState, StormCell, CountdownTarget } from "../types/weather";
import { CountdownCard } from "./CountdownCard";
import { NowcastForecastStrip } from "./NowcastForecastStrip";
import {
  X, AlertTriangle, Activity, Zap, CloudRain, Wind,
  Shield, Radio, MapPin, ChevronRight, AlertCircle
} from "lucide-react";

interface Props {
  hazardState: HazardState | null;
  selectedRegion: string;
  onSelectRegion: (id: string) => void;
  onSelectCell: (cell: StormCell) => void;
  onOpenAI: () => void;
  onCloseDashboard: () => void;
  allCountdowns: CountdownTarget[];
}

function SevDot({ sev }: { sev: string }) {
  const color = sev === "CRITICAL" ? "var(--sev-critical)" : sev === "HIGH" ? "var(--sev-high)" : sev === "MODERATE" ? "var(--sev-moderate)" : "var(--sev-low)";
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />;
}

function SummaryTile({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 3,
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 24, fontWeight: 700, lineHeight: 1, color: color ?? "var(--text-primary)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

const REGIONS_LABELS: Record<string, { short: string; color: string }> = {
  ALL_INDIA:  { short: "ALL", color: "#38bdf8" },
  WEST_INDIA: { short: "WEST", color: "#a78bfa" },
  NORTH_INDIA:{ short: "NORTH", color: "#34d399" },
  EAST_INDIA: { short: "EAST", color: "#fbbf24" },
  SOUTH_INDIA:{ short: "SOUTH", color: "#f87171" },
  NORTHWEST:  { short: "NW", color: "#60a5fa" },
  NORTHEAST:  { short: "NE", color: "#86efac" },
};

export function DashboardMissionControl({
  hazardState, selectedRegion, onSelectRegion,
  onSelectCell, onOpenAI, onCloseDashboard, allCountdowns,
}: Props) {
  const cells = hazardState?.active_storm_cells ?? [];
  const summary = hazardState?.domain_summary;
  const ci = hazardState?.convective_initiation;

  const critCount = cells.filter(c => c.severity === "CRITICAL").length;
  const highCount = cells.filter(c => c.severity === "HIGH").length;
  const cloudbursts = cells.filter(c => c.is_cloudburst).length;
  const hailCells   = cells.filter(c => c.is_severe_hail).length;
  const downbursts  = cells.filter(c => c.is_downburst).length;

  const imminentCountdowns = allCountdowns.filter(c => c.eta_seconds < 1800).slice(0, 5);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "var(--bg-base)",
        display: "grid",
        gridTemplateRows: "52px 1fr 200px",
        gridTemplateColumns: "260px 1fr 280px",
        gap: 0,
        overflow: "hidden",
      }}
    >
      {/* ─────────── TOP BAR ─────────── */}
      <div
        style={{
          gridColumn: "1 / -1",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          gap: 16,
        }}
      >
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: "linear-gradient(135deg, #0369a1, #38bdf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Radio size={16} color="#fff" />
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              AntiGravity — Mission Control
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 12, fontFamily: "JetBrains Mono, monospace" }}>
              T+{hazardState?.simulation_timestep ?? 0} · {hazardState?.sensor_mode ?? "—"}
            </span>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Status chips */}
        {ci?.detected && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,31,75,0.12)", border: "1px solid rgba(255,31,75,0.4)",
            borderRadius: 20, padding: "4px 12px",
            fontSize: 11, fontWeight: 800, color: "var(--sev-critical)", letterSpacing: "0.04em",
            animation: "ciPulse 2s infinite",
          }}>
            <AlertTriangle size={12} />
            CONVECTIVE INITIATION ACTIVE
          </div>
        )}

        {critCount > 0 && (
          <div style={{
            fontSize: 11, fontWeight: 800, color: "var(--sev-critical)",
            background: "rgba(255,31,75,0.1)", border: "1px solid rgba(255,31,75,0.3)",
            borderRadius: 20, padding: "4px 12px",
          }}>
            {critCount} CRITICAL CELL{critCount > 1 ? "S" : ""}
          </div>
        )}

        <button className="btn btn-sm" onClick={onCloseDashboard}>
          <X size={14} />
          Exit Mission Control
        </button>
      </div>

      {/* ─────────── LEFT PANEL ─────────── */}
      <div style={{
        gridRow: "2 / 4",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Summary tiles */}
        <div style={{ padding: "12px 14px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <SummaryTile
            label="Max dBZ"
            value={summary?.max_reflectivity_dbz?.toFixed(0) ?? "—"}
            sub="Reflectivity"
            color={(summary?.max_reflectivity_dbz ?? 0) >= 55 ? "var(--sev-critical)" : "var(--cyan)"}
          />
          <SummaryTile
            label="Rain Rate"
            value={`${summary?.max_rain_rate_mm_hr?.toFixed(0) ?? "—"}`}
            sub="mm / hr"
            color={(summary?.max_rain_rate_mm_hr ?? 0) >= 100 ? "var(--sev-critical)" : "var(--col-rain)"}
          />
          <SummaryTile label="Lightning" value={summary?.total_lightning_strokes ?? 0} sub="total strokes" color="var(--col-lightning)" />
          <SummaryTile label="Storm Cells" value={cells.length} sub={`${critCount} critical`} color={critCount > 0 ? "var(--sev-critical)" : "var(--cyan)"} />
        </div>

        {/* Hazard flags row */}
        <div style={{ display: "flex", gap: 6, padding: "10px 14px", flexWrap: "wrap" }}>
          {[
            { label: "Cloudburst", count: cloudbursts, color: "var(--col-rain)" },
            { label: "Hail", count: hailCells, color: "var(--col-hail)" },
            { label: "Downburst", count: downbursts, color: "var(--col-wind)" },
          ].map(({ label, count, color }) => (
            <div key={label} style={{
              flex: 1, textAlign: "center",
              padding: "6px 4px",
              background: count > 0 ? `${color}14` : "var(--bg-card)",
              border: `1px solid ${count > 0 ? `${color}40` : "var(--border)"}`,
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: count > 0 ? color : "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{count}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</div>
            </div>
          ))}
        </div>

        <div className="divider" style={{ margin: "0 14px" }} />

        {/* Storm cell list */}
        <div style={{ padding: "8px 14px 6px" }}>
          <div className="section-header">
            <Activity size={11} />
            Active Storm Cells
          </div>
        </div>
        <div className="scroll-y" style={{ flex: 1, padding: "0 14px 14px" }}>
          {cells.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)", fontSize: 12 }}>
              No active storm cells
            </div>
          ) : (
            cells.map((cell) => (
              <div
                key={cell.cell_id}
                className={`cell-row ${cell.severity.toLowerCase()}`}
                onClick={() => onSelectCell(cell)}
              >
                <SevDot sev={cell.severity} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cell.cell_id}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {cell.max_dbz.toFixed(0)} dBZ · {cell.rain_rate_mm_hr.toFixed(0)} mm/hr
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0, textAlign: "right" }}>
                  <div>{cell.movement.speed_kmh.toFixed(0)} km/h</div>
                  <div>{cell.movement.direction}</div>
                </div>
                <ChevronRight size={13} color="var(--text-muted)" />
              </div>
            ))
          )}
        </div>

        {/* AI Button */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
          <button className="btn btn-full btn-cyan btn-sm" onClick={onOpenAI}>
            <AlertCircle size={13} />
            AI Meteorological Copilot
          </button>
        </div>
      </div>

      {/* ─────────── CENTER (MAP placeholder in dashboard) ─────────── */}
      <div style={{
        gridRow: "2 / 3",
        position: "relative",
        background: "var(--bg-base)",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Region switcher overlay */}
        <div style={{
          position: "absolute", top: 12, left: 12, zIndex: 10,
          display: "flex", gap: 5, flexWrap: "wrap",
        }}>
          {Object.entries(REGIONS_LABELS).map(([id, { short, color }]) => (
            <button
              key={id}
              onClick={() => onSelectRegion(id)}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "1px solid",
                borderColor: selectedRegion === id ? color : "var(--border)",
                background: selectedRegion === id ? `${color}20` : "rgba(6,15,28,0.8)",
                color: selectedRegion === id ? color : "var(--text-muted)",
                fontSize: 10, fontWeight: 700, cursor: "pointer",
                backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                transition: "all 0.15s",
              }}
            >
              {short}
            </button>
          ))}
        </div>

        {/* "Map is behind" instruction */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-dim)",
          fontSize: 12,
          fontWeight: 600,
          textAlign: "center",
          pointerEvents: "none",
          userSelect: "none",
        }}>
          <div>
            <MapPin size={28} color="var(--border)" style={{ marginBottom: 8 }} />
            <div>Map renders beneath this panel</div>
            <div style={{ fontSize: 10, marginTop: 4, color: "var(--text-dim)" }}>Exit Mission Control to interact with the GIS map</div>
          </div>
        </div>
      </div>

      {/* ─────────── BOTTOM CENTER: Nowcast ─────────── */}
      <div style={{
        gridRow: "3 / 4",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-surface)",
        padding: "12px 16px",
        overflow: "hidden",
      }}>
        <div className="section-header" style={{ marginBottom: 10 }}>
          <Activity size={11} />
          ConvLSTM Nowcast · 0–120 min Forecast Horizon
        </div>
        <NowcastForecastStrip nowcast={hazardState?.nowcast} compact={true} />
      </div>

      {/* ─────────── RIGHT PANEL: Countdowns ─────────── */}
      <div style={{
        gridRow: "2 / 4",
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div className="section-header" style={{ marginBottom: 0 }}>
            <Zap size={11} />
            Landmark Impact Countdowns
          </div>
          {imminentCountdowns.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 10, color: "var(--sev-critical)", fontWeight: 700 }}>
              ⚡ {imminentCountdowns.length} target{imminentCountdowns.length > 1 ? "s" : ""} in &lt;30 min
            </div>
          )}
        </div>

        <div className="scroll-y" style={{ flex: 1, padding: "10px 14px" }}>
          {allCountdowns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 10px", color: "var(--text-muted)", fontSize: 12 }}>
              <Shield size={24} style={{ margin: "0 auto 8px", opacity: 0.4, display: "block" }} />
              No active arrival corridors
            </div>
          ) : (
            allCountdowns.slice(0, 10).map((target, i) => (
              <CountdownCard key={`${target.target_name}-${i}`} target={target} compact={true} />
            ))
          )}
        </div>

        {/* Active alerts summary */}
        {cells.length > 0 && (
          <div style={{
            borderTop: "1px solid var(--border)",
            padding: "10px 14px",
          }}>
            <div className="section-header" style={{ marginBottom: 8 }}>
              <AlertTriangle size={11} />
              Hazard Summary
            </div>
            {cells.slice(0, 4).map(cell => (
              <div key={cell.cell_id} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "5px 6px",
                borderRadius: 6,
                marginBottom: 3,
                cursor: "pointer",
                background: "var(--bg-card)",
              }} onClick={() => onSelectCell(cell)}>
                <SevDot sev={cell.severity} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cell.cell_id}
                  </div>
                </div>
                <div style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: cell.max_dbz >= 55 ? "var(--sev-critical)" : "var(--cyan)" }}>
                  {cell.max_dbz.toFixed(0)} dBZ
                </div>
                {cell.is_cloudburst && <span style={{ fontSize: 8, fontWeight: 800, color: "var(--col-rain)", background: "rgba(52,211,153,0.12)", padding: "1px 4px", borderRadius: 3 }}>CB</span>}
                {cell.is_downburst && <span style={{ fontSize: 8, fontWeight: 800, color: "var(--col-wind)", background: "rgba(248,113,113,0.12)", padding: "1px 4px", borderRadius: 3 }}>DB</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
