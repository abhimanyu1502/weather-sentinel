import React, { useState, useEffect } from "react";
import { CountdownTarget } from "../types/weather";
import { MapPin, AlertTriangle, AlertCircle, Info } from "lucide-react";

interface Props {
  target: CountdownTarget;
  compact?: boolean;
}

function hazardColor(level: string): "red" | "orange" | "yellow" {
  if (level === "RED_ALERT" || level?.includes("RED")) return "red";
  if (level === "ORANGE_ALERT" || level?.includes("ORANGE")) return "orange";
  return "yellow";
}

function HazardIcon({ level }: { level: string }) {
  const c = hazardColor(level);
  const color = c === "red" ? "#ff1f4b" : c === "orange" ? "#ff6b00" : "#ffcc00";
  const size = 14;
  if (c === "red") return <AlertTriangle size={size} color={color} />;
  if (c === "orange") return <AlertCircle size={size} color={color} />;
  return <Info size={size} color={color} />;
}

const CATEGORY_ICONS: Record<string, string> = {
  Airport:      "✈",
  Railway:      "🚄",
  "Hill Station": "⛰",
  Commercial:   "🏙",
  Urban:        "🏛",
  default:      "📍",
};

export function CountdownCard({ target, compact = false }: Props) {
  const [secs, setSecs] = useState(target.eta_seconds);

  // sync when new data arrives
  useEffect(() => {
    setSecs(target.eta_seconds);
  }, [target.eta_seconds]);

  useEffect(() => {
    if (secs <= 0) return;
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [target.target_name]);

  const totalMin = Math.floor(secs / 60);
  const totalHr  = Math.floor(totalMin / 60);
  const dispMin  = totalHr > 0 ? totalMin % 60 : totalMin;
  const dispSec  = secs % 60;
  const color = hazardColor(target.hazard_level);

  const timerStr = totalHr > 0
    ? `${String(totalHr).padStart(2, "0")}:${String(dispMin).padStart(2, "0")}:${String(dispSec).padStart(2, "0")}`
    : `${String(dispMin).padStart(2, "0")}:${String(dispSec).padStart(2, "0")}`;

  const icon = CATEGORY_ICONS[target.category] ?? CATEGORY_ICONS.default;
  const urgency = secs < 600 ? "< 10 min" : secs < 1800 ? "< 30 min" : secs < 3600 ? "< 1 hr" : null;

  if (compact) {
    return (
      <div className={`countdown-card ${color}`} style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {target.target_name}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{target.distance_km.toFixed(1)} km</div>
        </div>
        <div className={`countdown-timer ${color}`} style={{ fontSize: 18, flexShrink: 0 }}>{timerStr}</div>
      </div>
    );
  }

  return (
    <div className={`countdown-card ${color}`}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {target.target_name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: 2 }}>
              <MapPin size={9} color="var(--text-muted)" />
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{target.distance_km.toFixed(1)} km away</span>
              {urgency && (
                <span style={{ fontSize: 10, fontWeight: 700, color: color === "red" ? "var(--sev-critical)" : color === "orange" ? "var(--sev-high)" : "var(--sev-moderate)", marginLeft: 4 }}>
                  ⚡ {urgency}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <HazardIcon level={target.hazard_level} />
        </div>
      </div>

      {/* Timer */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
        <div className={`countdown-timer ${color}`}>{timerStr}</div>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>TO ARRIVAL</span>
      </div>

      {/* Gauge */}
      <div style={{ marginTop: 8 }}>
        <div className="gauge-bar">
          <div
            className="gauge-fill"
            style={{
              width: `${Math.min(100, Math.max(2, (1 - secs / Math.max(1, target.eta_seconds + 60)) * 100))}%`,
              background: color === "red" ? "var(--sev-critical)" : color === "orange" ? "var(--sev-high)" : "var(--sev-moderate)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
