import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CloudRain,
  Snowflake,
  Wind,
  Zap,
  Plane,
  Train,
  Building2,
  Mountain,
  Info,
} from "lucide-react";

export function MapLegend() {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <div
      className="panel-glass"
      style={{
        position: "absolute",
        bottom: 50,
        left: 12,
        zIndex: 65,
        fontSize: 10,
        maxWidth: 300,
        boxShadow: "0 12px 36px -8px rgba(0,0,0,0.75)",
      }}
    >
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          cursor: "pointer",
          fontWeight: 700,
          color: "var(--text)",
        }}
      >
        <Info size={12} color="var(--signal)" />
        <span style={{ color: "var(--signal)", fontSize: 10.5, fontWeight: 700 }}>
          IMD GIS Tactical Legend
        </span>
        <div style={{ flex: 1 }} />
        {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </div>

      {open && (
        <div
          className="scroll rise"
          style={{
            maxHeight: 320,
            padding: "8px 12px 12px",
            borderTop: "1px solid var(--hair)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Radar Reflectivity Ramp */}
          <div>
            <div className="label" style={{ fontSize: 8.5, marginBottom: 5 }}>
              DOPPLER REFLECTIVITY (dBZ)
            </div>
            <div
              style={{
                display: "flex",
                height: 10,
                borderRadius: 4,
                overflow: "hidden",
                marginBottom: 3,
                boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ flex: 1, background: "#38bdf8" }} title="< 22 dBZ (Light rain)" />
              <div style={{ flex: 1, background: "#4ade80" }} title="22–34 dBZ (Moderate precipitation)" />
              <div style={{ flex: 1, background: "#fbbf24" }} title="35–45 dBZ (Convective initiation)" />
              <div style={{ flex: 1, background: "#f97316" }} title="46–54 dBZ (Severe / hail threat)" />
              <div style={{ flex: 1, background: "#f43f5e" }} title="55+ dBZ (Violent / cloudburst core)" />
            </div>
            <div
              style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "var(--text-dim)" }}
              className="mono"
            >
              <span>15</span>
              <span>25</span>
              <span>38</span>
              <span>49</span>
              <span>65+</span>
            </div>
          </div>

          {/* Hazard Severity Tiers */}
          <div>
            <div className="label" style={{ fontSize: 8.5, marginBottom: 5 }}>
              HAZARD SEVERITY TIERS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dot" style={{ background: "#f43f5e", boxShadow: "0 0 6px #f43f5e" }} />
                <span>EXTREME (≥ 55 dBZ)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dot" style={{ background: "#f97316", boxShadow: "0 0 6px #f97316" }} />
                <span>SEVERE (45–54 dBZ)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dot" style={{ background: "#fbbf24" }} />
                <span>WARNING (35–44 dBZ)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dot" style={{ background: "#38bdf8" }} />
                <span>WATCH (&lt; 35 dBZ)</span>
              </div>
            </div>
          </div>

          {/* Severe Phenomena Signatures */}
          <div>
            <div className="label" style={{ fontSize: 8.5, marginBottom: 5 }}>
              PHENOMENA CRITERIA
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 9.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CloudRain size={11} color="var(--h-extreme)" />
                <span>Cloudburst: Rain ≥ 100 mm/h (IMD)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Snowflake size={11} color="var(--h-extreme)" />
                <span>Severe Hail: MESH ≥ 25 mm / POSH ≥ 50%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Wind size={11} color="var(--h-severe)" />
                <span>Downburst: Wind Gust ≥ 55 km/h</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Zap size={11} color="var(--h-extreme)" />
                <span>Convective Initiation: CTCR ≤ −4 K/15m</span>
              </div>
            </div>
          </div>

          {/* Strategic Landmarks */}
          <div>
            <div className="label" style={{ fontSize: 8.5, marginBottom: 5 }}>
              STRATEGIC INFRASTRUCTURE
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 9.5 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Plane size={11} color="var(--signal)" /> Airport
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Train size={11} color="var(--signal)" /> Railway Hub
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Building2 size={11} color="var(--signal)" /> Commercial
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Mountain size={11} color="var(--signal)" /> Hill Station
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
