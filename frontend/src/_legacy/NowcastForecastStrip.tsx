import React from "react";
import { NowcastData } from "../types/weather";
import { TrendingUp } from "lucide-react";

interface Props {
  nowcast: NowcastData | null | undefined;
  compact?: boolean;
}

const COLORS = [
  "#38bdf8", "#5eead4", "#86efac", "#fde68a", "#fbbf24",
  "#f97316", "#ef4444", "#dc2626", "#b91c1c", "#7f1d1d",
  "#6d28d9", "#7c3aed",
];

function dbzToColor(dbz: number): string {
  if (dbz < 20) return "#4ade80";
  if (dbz < 30) return "#86efac";
  if (dbz < 40) return "#fde68a";
  if (dbz < 45) return "#fbbf24";
  if (dbz < 50) return "#f97316";
  if (dbz < 55) return "#ef4444";
  if (dbz < 60) return "#dc2626";
  return "#ff1f4b";
}

export function NowcastForecastStrip({ nowcast, compact = false }: Props) {
  if (!nowcast || !nowcast.forecast_available || nowcast.timesteps.length === 0) {
    return (
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
          Accumulating frames for nowcast… (need 4 timesteps)
        </div>
      </div>
    );
  }

  const maxDbzOverall = Math.max(...nowcast.timesteps.map(t => t.predicted_max_dbz));
  const maxRainOverall = Math.max(...nowcast.timesteps.map(t => t.predicted_max_rain_rate_mm_hr));

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: compact ? "8px 12px" : "10px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TrendingUp size={13} color="var(--cyan)" />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>
            ConvLSTM Nowcast · 0–120 min
          </span>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
          {nowcast.timesteps.length} steps
        </span>
      </div>

      {/* Timeline bars */}
      <div style={{ padding: "10px 12px" }}>
        <div className="timeline-grid" style={{ gridTemplateColumns: `repeat(${nowcast.timesteps.length}, 1fr)` }}>
          {nowcast.timesteps.map((step, i) => {
            const heightPct = maxDbzOverall > 0 ? (step.predicted_max_dbz / maxDbzOverall) : 0;
            const barH = Math.max(4, Math.round(heightPct * 48));
            const col = dbzToColor(step.predicted_max_dbz);
            return (
              <div
                key={i}
                className="timeline-cell"
                title={`+${step.lead_time_min}m | ${step.predicted_max_dbz.toFixed(0)} dBZ | ${step.predicted_max_rain_rate_mm_hr.toFixed(0)} mm/hr`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
              >
                <div style={{ display: "flex", alignItems: "flex-end", height: 52, width: "100%" }}>
                  <div
                    className="tc-bar"
                    style={{
                      height: barH,
                      background: `linear-gradient(180deg, ${col}cc, ${col})`,
                      borderRadius: "2px 2px 0 0",
                      width: "80%",
                      margin: "0 auto",
                    }}
                  />
                </div>
                <div style={{ fontSize: 8, color: "var(--text-muted)", fontWeight: 600 }}>
                  +{step.lead_time_min}m
                </div>
                <div style={{ fontSize: 8, fontFamily: "JetBrains Mono, monospace", color: col, fontWeight: 700 }}>
                  {step.predicted_max_dbz.toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend row */}
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {[
            { label: "Peak dBZ", val: `${maxDbzOverall.toFixed(0)} dBZ`, color: dbzToColor(maxDbzOverall) },
            { label: "Peak Rain", val: `${maxRainOverall.toFixed(0)} mm/hr`, color: maxRainOverall >= 100 ? "var(--sev-critical)" : "var(--col-rain)" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}: </span>
              <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "JetBrains Mono, monospace" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
