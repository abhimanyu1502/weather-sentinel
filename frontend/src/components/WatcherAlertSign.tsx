import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Siren,
  Volume2,
  VolumeX,
  X,
  MapPin,
  Clock,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import { soundAlerts } from "../lib/soundAlerts";
import { CityWeather } from "../lib/weatherEngine";
import { City } from "../data/indiaGeo";

interface Props {
  cities: CityWeather[];
  onPickCityByName: (name: string) => void;
  audioMuted: boolean;
  onToggleAudio: () => void;
}

export function WatcherAlertSign({
  cities,
  onPickCityByName,
  audioMuted,
  onToggleAudio,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  // Find the most critical active anomaly in the country
  const extremeCities = cities.filter((c) => c.hazard === "EXTREME");
  const severeCities = cities.filter((c) => c.hazard === "SEVERE");
  const activeThreats = extremeCities.length > 0 ? extremeCities : severeCities;
  const topThreat = activeThreats[0];

  // Trigger audio alert when a new extreme threat arises
  useEffect(() => {
    if (extremeCities.length > 0 && !audioMuted) {
      soundAlerts.playEmergencyAlarm();
    } else if (severeCities.length > 0 && !audioMuted) {
      soundAlerts.playWarningChime();
    }
  }, [extremeCities.length, severeCities.length, audioMuted]);

  if (!topThreat || dismissed) {
    if (activeThreats.length > 0 && dismissed) {
      // Compact collapsed banner button
      return (
        <div
          style={{
            position: "fixed",
            top: 68,
            right: 18,
            zIndex: 900,
          }}
        >
          <button
            onClick={() => setDismissed(false)}
            className="btn btn-pill sev-extreme"
            style={{
              padding: "4px 10px",
              fontSize: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 4px 16px rgba(244,63,94,0.4)",
              background: "rgba(244,63,94,0.2)",
              borderColor: "var(--h-extreme)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <AlertTriangle size={12} color="var(--h-extreme)" />
            <span>{activeThreats.length} Active 6h Anomalies</span>
          </button>
        </div>
      );
    }
    return null;
  }

  const isExtreme = topThreat.hazard === "EXTREME";
  const sevColor = isExtreme ? "var(--h-extreme)" : "var(--h-severe)";
  const leadTimeHours = Math.max(1, Math.min(6, Math.round((100 - topThreat.hazardScore) / 16) + 1));
  const leadTimeMinutes = leadTimeHours * 60 - Math.round(topThreat.hazardScore % 30);

  return (
    <div
      className="rise"
      style={{
        position: "relative",
        zIndex: 90,
        margin: "0 0 4px 0",
        padding: "6px 14px",
        borderRadius: "var(--radius-sm)",
        background: isExtreme
          ? "linear-gradient(90deg, rgba(244,63,94,0.25) 0%, var(--panel-glass) 50%, rgba(244,63,94,0.18) 100%)"
          : "linear-gradient(90deg, rgba(249,115,22,0.22) 0%, var(--panel-glass) 50%, rgba(249,115,22,0.15) 100%)",
        border: `1.5px solid ${sevColor}`,
        boxShadow: `0 4px 20px -4px ${sevColor}66, 0 0 16px -2px ${sevColor}44`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "nowrap",
      }}
    >
      {/* ── Left Indicator & Anomaly Content ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {/* Pulsing Warning Sign Icon */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: `${sevColor}26`,
            border: `1.5px solid ${sevColor}`,
            display: "grid",
            placeItems: "center",
            animation: "pingSoft 1.8s infinite",
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={15} color={sevColor} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className="mono"
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: sevColor,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {isExtreme ? "CRITICAL WEATHER ANOMALY DETECTED" : "SEVERE ANOMALY EARLY WARNING"}
            </span>
            <span
              className="pill mono"
              style={{
                fontSize: 8.5,
                padding: "1px 6px",
                background: "var(--inset)",
                borderColor: sevColor,
                color: "var(--text)",
              }}
            >
              T-6H LEAD TIME: ~{leadTimeHours}h ({leadTimeMinutes}m)
            </span>
          </div>

          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--text)",
              marginTop: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span style={{ color: "var(--signal-bright)", fontWeight: 800 }}>{topThreat.cityName}</span> ({topThreat.state}):{" "}
            {topThreat.alertHeadline.replace(/^(EXTREME|SEVERE|WARNING|WATCH):\s*/, "")}
          </div>
        </div>
      </div>

      {/* ── Right Actions: Audio Alarm & Inspect on Map ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Audio Alert Toggle */}
        <button
          onClick={onToggleAudio}
          className="btn"
          title={audioMuted ? "Unmute Disaster Alarm Sounds" : "Mute Disaster Alarm Sounds"}
          style={{
            padding: "4px 8px",
            fontSize: 10,
            background: audioMuted ? "rgba(100,116,139,0.2)" : "rgba(244,63,94,0.22)",
            borderColor: audioMuted ? "var(--hair)" : "var(--h-extreme)",
            color: audioMuted ? "var(--text-dim)" : "var(--h-extreme)",
          }}
        >
          {audioMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          <span>{audioMuted ? "Muted" : "Alarm Active"}</span>
        </button>

        {/* 1-Click Fly to Map */}
        <button
          onClick={() => onPickCityByName(topThreat.cityName)}
          className="btn btn-primary"
          style={{
            padding: "4px 10px",
            fontSize: 10.5,
            fontWeight: 700,
            background: `linear-gradient(135deg, ${sevColor} 0%, #b91c1c 100%)`,
            borderColor: sevColor,
          }}
        >
          <MapPin size={11} />
          <span>Inspect Location</span>
        </button>

        {/* Dismiss Button */}
        <button
          onClick={() => setDismissed(true)}
          className="btn btn-icon"
          title="Dismiss Banner"
          style={{ width: 24, height: 24 }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
