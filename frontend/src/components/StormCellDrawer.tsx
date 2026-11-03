import {
  X,
  Zap,
  Snowflake,
  Wind,
  CloudRain,
  Radar,
  Timer,
  TrendingUp,
  ArrowRight,
  Compass,
  Navigation,
} from "lucide-react";
import { StormCell, HAZ_CLASS, cardinal } from "../lib/weatherEngine";

interface Props {
  cell: StormCell | null;
  onClose: () => void;
}

/** ETA estimate for nearest major metros from the cell centroid */
function nearbyImpact(cell: StormCell) {
  const metros: [string, number, number][] = [
    ["Mumbai", 19.076, 72.878],
    ["Delhi", 28.614, 77.209],
    ["Kolkata", 22.573, 88.364],
    ["Chennai", 13.083, 80.271],
    ["Bengaluru", 12.972, 77.595],
    ["Hyderabad", 17.385, 78.487],
    ["Ahmedabad", 23.022, 72.571],
    ["Pune", 18.52, 73.856],
    ["Kochi", 9.931, 76.267],
    ["Guwahati", 26.145, 91.736],
  ];
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;

  return metros
    .map(([name, lat, lon]) => {
      const dLat = toRad(cell.lat - lat);
      const dLon = toRad(cell.lon - lon);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat)) * Math.cos(toRad(cell.lat)) * Math.sin(dLon / 2) ** 2;
      const km = 2 * R * Math.asin(Math.sqrt(a));
      const etaMin = (km / Math.max(cell.speedKmph, 1)) * 60;
      const dLonB = toRad(lon - cell.lon);
      const lat1 = toRad(cell.lat);
      const lat2 = toRad(lat);
      const y = Math.sin(dLonB) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLonB);
      const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      const diff = Math.abs(((bearing - cell.headingDeg + 540) % 360) - 180);
      const onTrack = diff < 55;
      return { name, km, etaMin: Math.round(etaMin), onTrack };
    })
    .filter((x) => x.onTrack && x.km < 700)
    .sort((a, b) => a.etaMin - b.etaMin)
    .slice(0, 4);
}

function StatTile({
  label,
  value,
  unit,
  sev,
}: {
  label: string;
  value: string;
  unit?: string;
  sev?: string;
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "var(--inset)",
        borderRadius: 8,
        border: "1px solid var(--hair)",
      }}
    >
      <div className="label" style={{ fontSize: 8.5 }}>{label}</div>
      <div className={`mono ${sev ?? ""}`} style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
        {value}
        {unit && <span style={{ fontSize: 9.5, color: "var(--text-dim)", marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

export function StormCellDrawer({ cell, onClose }: Props) {
  if (!cell) return null;

  const sev =
    cell.severity === "CRITICAL"
      ? "sev-extreme"
      : cell.severity === "HIGH"
      ? "sev-severe"
      : cell.severity === "MODERATE"
      ? "sev-warning"
      : "sev-watch";

  const impacts = nearbyImpact(cell);

  return (
    <div
      className={`panel-glass rise ${sev}`}
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 150,
        maxHeight: "50%",
        display: "flex",
        flexDirection: "column",
        borderTopWidth: 2,
        borderTopColor: "var(--sev)",
        boxShadow: "0 -12px 48px -10px rgba(0,0,0,0.9), 0 0 24px -10px var(--sev)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "10px 14px",
          borderBottom: "1px solid var(--hair)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`pill ${sev}`} style={{ padding: "4px 10px", fontSize: 10.5 }}>
            {cell.severity} CELL
          </span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
            {cell.cellId.replace("CELL-", "STORM #")}
          </span>
          <span className="mono label" style={{ fontSize: 9.5 }}>
            {cell.lat.toFixed(2)}°N, {cell.lon.toFixed(2)}°E · Area: {cell.areaKm2.toFixed(0)} km²
          </span>
        </div>

        <button
          onClick={onClose}
          className="btn btn-icon"
          title="Close Storm Cell Inspector (Esc)"
          aria-label="Close Inspector"
          style={{ width: 28, height: 28 }}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Body: Telemetry Metrics & Metro Impact Cards ── */}
      <div className="scroll" style={{ flex: 1, padding: "12px 14px" }}>
        {/* Core Convective Parameters */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <StatTile
            label="Peak Reflectivity"
            value={cell.maxDbz.toFixed(0)}
            unit="dBZ"
            sev={cell.maxDbz >= 55 ? "sev-extreme" : "sev-severe"}
          />
          <StatTile
            label="Rainfall Rate"
            value={cell.rainRateMmHr.toFixed(0)}
            unit="mm/h"
            sev={cell.rainRateMmHr >= 80 ? "sev-extreme" : "sev-warning"}
          />
          <StatTile
            label="Severe Hail MESH"
            value={cell.hailMeshMm > 0 ? cell.hailMeshMm.toFixed(0) : "0"}
            unit="mm"
            sev={cell.hailMeshMm >= 25 ? "sev-extreme" : undefined}
          />
          <StatTile
            label="Peak Wind Gust"
            value={cell.gustKmph.toFixed(0)}
            unit="km/h"
            sev={cell.gustKmph >= 65 ? "sev-extreme" : undefined}
          />
          <StatTile
            label="Lightning Rate"
            value={cell.lightningRate.toFixed(1)}
            unit="fl/min"
            sev={cell.lightningRate >= 20 ? "sev-extreme" : undefined}
          />
          <StatTile
            label="Vector Dynamics"
            value={`${cell.speedKmph} km/h`}
            unit={`${cell.direction} (${cell.headingDeg}°)`}
          />
        </div>

        {/* Downwind Metro Threat ETAs */}
        <div>
          <div className="label" style={{ fontSize: 9.5, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <Timer size={11} color="var(--signal)" /> Downwind Major Metro Proximity &amp; ETA Forecast
          </div>
          {impacts.length === 0 ? (
            <div style={{ fontSize: 10.5, color: "var(--text-dim)", padding: "6px 0" }}>
              Trajectory does not intersect monitored tier-1 metro airspaces within the next 4 hours.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
              {impacts.map((im) => (
                <div
                  key={im.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "var(--raised)",
                    border: "1px solid var(--hair-medium)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{im.name}</div>
                    <div className="label mono" style={{ fontSize: 9, marginTop: 2 }}>
                      Distance: {im.km.toFixed(0)} km
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: im.etaMin <= 30 ? "var(--h-extreme)" : "var(--h-warning)",
                      }}
                    >
                      ~{im.etaMin} min
                    </div>
                    <div className="label" style={{ fontSize: 8 }}>Impact Window</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
