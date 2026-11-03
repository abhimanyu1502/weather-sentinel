import { useEffect, useState } from "react";
import { Activity, Radio, Satellite, Zap, Gauge, RefreshCw, AlertTriangle } from "lucide-react";
import { fetchDashboardSummary, toggleFailover, SensorHealth } from "../lib/apiClient";

interface Props {
  sensorMode?: string;
  isLiveSocket?: boolean;
}

export function SensorHealthStrip({ sensorMode, isLiveSocket }: Props) {
  const [health, setHealth] = useState<SensorHealth>({
    dwr_network: "OPERATIONAL",
    insat_imager: "OPERATIONAL",
    damini_lightning: "OPERATIONAL",
    aws_stations: "OPERATIONAL",
  });
  const [currentMode, setCurrentMode] = useState<string>(sensorMode || "RADAR_FUSED");
  const [toggling, setToggling] = useState<boolean>(false);

  const loadStatus = async () => {
    const summary = await fetchDashboardSummary();
    if (summary?.sensor_health) {
      setHealth(summary.sensor_health);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (sensorMode) {
      setCurrentMode(sensorMode);
    }
  }, [sensorMode]);

  const handleToggleFailover = async () => {
    setToggling(true);
    try {
      const res = await toggleFailover();
      if (res) {
        setCurrentMode(res.radar_offline_mode ? "SATELLITE_FALLBACK" : "RADAR_FUSED");
        await loadStatus();
      }
    } catch {
      // fallback safe
    } finally {
      setToggling(false);
    }
  };

  const isDegraded = currentMode.includes("SATELLITE") || health.dwr_network === "DEGRADED";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 9px",
        background: isDegraded ? "rgba(249,115,22,0.12)" : "var(--inset)",
        border: `1px solid ${isDegraded ? "rgba(249,115,22,0.4)" : "var(--hair-medium)"}`,
        borderRadius: "var(--radius-sm)",
        fontSize: 10,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-dim)" }}>
        <Activity size={12} color="var(--signal)" />
        <span className="label" style={{ fontSize: 8.5 }}>TELEMETRY:</span>
      </div>

      {/* DWR Network */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="IMD Doppler Weather Radar Network (12 Coastal & Inland Radars)">
        <Radio size={11} color={isDegraded ? "var(--h-severe)" : "var(--mint)"} />
        <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600 }}>DWR</span>
        <span
          className="dot"
          style={{
            width: 5,
            height: 5,
            background: isDegraded ? "var(--h-severe)" : "var(--mint)",
            boxShadow: `0 0 6px ${isDegraded ? "var(--h-severe)" : "var(--mint)"}`,
          }}
        />
      </div>

      {/* INSAT Imager */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="ISRO INSAT-3DR Multispectral Meteorological Imager">
        <Satellite size={11} color="var(--mint)" />
        <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600 }}>INSAT</span>
        <span className="dot" style={{ width: 5, height: 5, background: "var(--mint)", boxShadow: "0 0 5px var(--mint)" }} />
      </div>

      {/* DAMINI Lightning */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="IITM / IMD DAMINI Lightning Location Network">
        <Zap size={11} color="var(--mint)" />
        <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600 }}>DAMINI</span>
        <span className="dot" style={{ width: 5, height: 5, background: "var(--mint)", boxShadow: "0 0 5px var(--mint)" }} />
      </div>

      {/* AWS Surface Stations */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="Automatic Weather Stations & Agro-Met Surface Observation">
        <Gauge size={11} color="var(--mint)" />
        <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600 }}>AWS</span>
        <span className="dot" style={{ width: 5, height: 5, background: "var(--mint)", boxShadow: "0 0 5px var(--mint)" }} />
      </div>

      <div style={{ width: 1, height: 16, background: "var(--hair)" }} />

      {/* Mode & Failover Toggle */}
      <button
        onClick={handleToggleFailover}
        disabled={toggling}
        className="btn"
        style={{
          padding: "3px 8px",
          fontSize: 9.5,
          fontWeight: 700,
          background: isDegraded ? "rgba(249,115,22,0.2)" : "rgba(56,189,248,0.14)",
          borderColor: isDegraded ? "rgba(249,115,22,0.5)" : "rgba(56,189,248,0.4)",
          color: isDegraded ? "var(--h-severe)" : "var(--signal-bright)",
          cursor: "pointer",
        }}
        title="Toggle between Primary Radar Fusion (1 km resolution) and Satellite-Only Fallback (2-3 km resolution)"
      >
        {toggling ? (
          <RefreshCw size={10} style={{ animation: "radarSweep 1s linear infinite" }} />
        ) : isDegraded ? (
          <AlertTriangle size={10} />
        ) : (
          <Radio size={10} />
        )}
        <span>{isDegraded ? "SAT (2-3km)" : "DWR FUSED (1km)"}</span>
      </button>
    </div>
  );
}
