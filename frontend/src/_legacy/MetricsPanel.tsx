import React, { useState } from "react";
import { DomainSummary, ConvectiveInitiation, NowcastData } from "../types/weather";
import { NowcastForecastStrip } from "./NowcastForecastStrip";
import {
  Activity, Zap, CloudRain, Radio, Sparkles, RefreshCw,
  FileDown, ShieldCheck, ShieldAlert, Globe2, LayoutDashboard,
  CloudLightning, Gauge, Signal, SatelliteDish, ChevronDown, ChevronRight,
  TrendingUp
} from "lucide-react";

interface RegionOption {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
}

interface MetricsPanelProps {
  summary: DomainSummary | null;
  ci: ConvectiveInitiation | null;
  nowcast?: NowcastData | null;
  connected: boolean;
  simTimestep: number;
  sensorMode: string;
  regions: RegionOption[];
  selectedRegion: string;
  onSelectRegion: (regId: string) => void;
  uxMode: "citizen" | "pro" | "dashboard";
  onSelectUxMode: (mode: "citizen" | "pro" | "dashboard") => void;
  lang: "en" | "hi";
  onToggleLang: () => void;
  onOpenAIAdvisory: () => void;
  onSimulateSevere: () => void;
  onToggleFailover: () => void;
  onDownloadCAP: () => void;
  isSimulating: boolean;
}

const SENSOR_LABELS: Record<string, string> = {
  RADAR_FUSED: "DWR + INSAT Fused",
  SATELLITE_FALLBACK: "INSAT Only (Radar Offline)",
};

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  summary, ci, nowcast, connected, simTimestep, sensorMode,
  regions, selectedRegion, onSelectRegion,
  uxMode, onSelectUxMode, lang, onToggleLang,
  onOpenAIAdvisory, onSimulateSevere, onToggleFailover, onDownloadCAP,
  isSimulating,
}) => {
  const [proExpanded, setProExpanded] = useState(true);

  const isOffline = sensorMode === "SATELLITE_FALLBACK";
  const maxDbz   = summary?.max_reflectivity_dbz ?? 0;
  const maxRain  = summary?.max_rain_rate_mm_hr  ?? 0;
  const lightning = summary?.total_lightning_strokes ?? 0;
  const cells    = summary?.active_storm_cells    ?? 0;

  const dbzColor = maxDbz >= 55 ? "var(--sev-critical)" : maxDbz >= 45 ? "var(--sev-high)" : maxDbz >= 35 ? "var(--sev-moderate)" : "var(--sev-low)";
  const rainColor = maxRain >= 100 ? "var(--sev-critical)" : maxRain >= 50 ? "var(--sev-high)" : "var(--col-rain)";

  const t = {
    header:    lang === "hi" ? "AntiGravity · मौसम नियंत्रण" : "AntiGravity",
    subtitle:  lang === "hi" ? "पान-इंडिया गंभीर मौसम निगरानी" : "Pan-India Severe Weather Nowcasting",
    live:      lang === "hi" ? "सीधा प्रसारण" : "LIVE",
    offline:   lang === "hi" ? "उपग्रह मोड" : "OFFLINE",
    region:    lang === "hi" ? "राडार क्षेत्र" : "Radar Domain",
    viewMode:  lang === "hi" ? "दृश्य मोड" : "View Mode",
    citizen:   lang === "hi" ? "नागरिक" : "Citizen",
    pro:       lang === "hi" ? "प्रो" : "Pro",
    dashboard: lang === "hi" ? "डैशबोर्ड" : "Dashboard",
    ai:        lang === "hi" ? "AI सलाहकार" : "AI Copilot Briefing",
    simulate:  lang === "hi" ? "भीषण घटना अनुकरण" : "Severe Event Sim",
    failover:  lang === "hi" ? "सेंसर विफलता मोड" : "Toggle Sensor Failover",
    cap:       lang === "hi" ? "NDMA CAP XML" : "Export CAP XML",
    ciTitle:   lang === "hi" ? "संवहनी प्रज्वलन (CI) सक्रिय" : "CONVECTIVE INITIATION DETECTED",
    ciClear:   lang === "hi" ? "CI निगरानी · कोई खतरा नहीं" : "CI Monitor · No Active Triggers",
    maxDbz:    lang === "hi" ? "अधिकतम परावर्तनशीलता" : "Max Reflectivity",
    maxRain:   lang === "hi" ? "अधिकतम वर्षा दर" : "Peak Rain Rate",
    lightning: lang === "hi" ? "बिजली प्रहार" : "Lightning Strokes",
    cells_lbl: lang === "hi" ? "सक्रिय तूफान" : "Active Cells",
    ctcr:      lang === "hi" ? "CTCR शीतलन दर" : "CTCR Cloud-Top Cooling",
    swd:       lang === "hi" ? "SWD विभाजन" : "SWD Split-Window",
    confid:    lang === "hi" ? "CI विश्वास स्तर" : "CI Confidence",
    prdSince:  lang === "hi" ? "पूर्वानुमान क्षितिज" : "Forecast Horizon",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* ── Brand header ── */}
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: "linear-gradient(135deg, #0369a1, #38bdf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 18px rgba(56,189,248,0.35)", flexShrink: 0,
          }}>
            <CloudLightning size={20} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 15, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {t.header}
            </h1>
            <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.03em" }}>
              {t.subtitle}
            </p>
          </div>
          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <div className={`live-dot ${connected ? "" : "offline"}`} />
            <span style={{ fontSize: 10, fontWeight: 700, color: connected ? "var(--sev-low)" : "var(--text-muted)" }}>
              {connected ? t.live : t.offline}
            </span>
          </div>
        </div>

        {/* Sensor mode + timestep */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <div className={`sensor-chip ${isOffline ? "warn" : "ok"}`}>
            {isOffline ? <SatelliteDish size={10} /> : <Signal size={10} />}
            {SENSOR_LABELS[sensorMode] ?? sensorMode}
          </div>
          <div className="sensor-chip" style={{ marginLeft: "auto" }}>
            <Activity size={10} />
            T+{simTimestep}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="scroll-y" style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Region selector */}
        <div>
          <div className="section-header">
            <Globe2 size={11} />
            {t.region}
          </div>
          <div style={{ position: "relative" }}>
            <select
              className="region-select"
              value={selectedRegion}
              onChange={(e) => onSelectRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <ChevronDown size={13} color="var(--text-muted)" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          </div>
        </div>

        {/* View mode tabs */}
        <div>
          <div className="section-header">
            <LayoutDashboard size={11} />
            {t.viewMode}
          </div>
          <div className="tab-bar">
            <button className={`tab-btn ${uxMode === "citizen" ? "active" : ""}`} onClick={() => onSelectUxMode("citizen")}>
              {t.citizen}
            </button>
            <button className={`tab-btn ${uxMode === "pro" ? "active" : ""}`} onClick={() => onSelectUxMode("pro")}>
              {t.pro}
            </button>
            <button className={`tab-btn ${uxMode === "dashboard" ? "active" : ""}`} onClick={() => onSelectUxMode("dashboard")}>
              {t.dashboard}
            </button>
          </div>
        </div>

        <div className="divider" />

        {/* ── CI Status Card ── */}
        <div style={{
          border: `1px solid ${ci?.detected ? "rgba(255,31,75,0.4)" : "var(--border)"}`,
          borderRadius: 10,
          padding: "10px 12px",
          background: ci?.detected ? "rgba(255,31,75,0.08)" : "var(--bg-card)",
          transition: "all 0.3s",
          animation: ci?.detected ? "ciPulse 2s infinite" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {ci?.detected
              ? <ShieldAlert size={16} color="var(--sev-critical)" />
              : <ShieldCheck size={16} color="var(--sev-low)" />
            }
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: ci?.detected ? "var(--sev-critical)" : "var(--sev-low)",
              letterSpacing: "0.04em",
            }}>
              {ci?.detected ? t.ciTitle : t.ciClear}
            </span>
          </div>

          {ci?.detected && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {/* Trigger chips */}
              {ci.triggers && ci.triggers.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {ci.triggers.map((tr, i) => (
                    <span key={i} style={{
                      fontSize: 9, fontWeight: 700, color: "var(--sev-critical)",
                      background: "rgba(255,31,75,0.12)", border: "1px solid rgba(255,31,75,0.3)",
                      borderRadius: 4, padding: "1px 5px",
                    }}>{tr}</span>
                  ))}
                </div>
              )}
              <div className="info-row" style={{ marginTop: 4 }}>
                <span className="key">{t.ctcr}</span>
                <span className="val" style={{ color: "var(--sev-critical)" }}>{ci.ctcr_k_per_15min.toFixed(1)} K/15min</span>
              </div>
              <div className="info-row">
                <span className="key">{t.confid}</span>
                <span className="val" style={{ color: "var(--sev-high)" }}>{(ci.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Domain Metrics: Citizen mode = big simple numbers, Pro = detailed ── */}
        {uxMode === "citizen" ? (
          <div>
            <div className="section-header">
              <Radio size={11} />
              {lang === "hi" ? "मुख्य संकेतक" : "Key Indicators"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div className="metric-box">
                <div className="metric-label">{t.maxDbz}</div>
                <div className="metric-value" style={{ color: dbzColor, fontSize: 28 }}>{maxDbz.toFixed(0)}</div>
                <div className="metric-sub">dBZ</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">{t.maxRain}</div>
                <div className="metric-value" style={{ color: rainColor, fontSize: 28 }}>{maxRain.toFixed(0)}</div>
                <div className="metric-sub">mm/hr {maxRain >= 100 && <span style={{ color: "var(--sev-critical)", fontWeight: 800 }}>⚠ CLOUDBURST</span>}</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">{t.lightning}</div>
                <div className="metric-value" style={{ color: "var(--col-lightning)", fontSize: 28 }}>{lightning}</div>
                <div className="metric-sub">{lang === "hi" ? "कुल आघात" : "total strokes"}</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">{t.cells_lbl}</div>
                <div className="metric-value" style={{ fontSize: 28 }}>{cells}</div>
                <div className="metric-sub">{lang === "hi" ? "ट्रैक किए गए" : "tracked"}</div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div
              className="section-header"
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => setProExpanded(!proExpanded)}
            >
              <Gauge size={11} />
              {lang === "hi" ? "उन्नत मौसम टेलीमेट्री" : "Advanced Telemetry"}
              <div style={{ marginLeft: "auto" }}>
                {proExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </div>
            </div>
            {proExpanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Reflectivity */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Radar Reflectivity (dBZ)</span>
                    <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: dbzColor, fontWeight: 700 }}>{maxDbz.toFixed(1)}</span>
                  </div>
                  <div className="gauge-bar">
                    <div className="gauge-fill" style={{ width: `${(maxDbz / 75) * 100}%`, background: dbzColor }} />
                  </div>
                </div>

                {/* Rain rate */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Rain Rate (mm/hr){maxRain >= 100 && " ⚠"}</span>
                    <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: rainColor, fontWeight: 700 }}>{maxRain.toFixed(1)}</span>
                  </div>
                  <div className="gauge-bar">
                    <div className="gauge-fill" style={{ width: `${Math.min(100, (maxRain / 200) * 100)}%`, background: rainColor }} />
                  </div>
                </div>

                {/* Pro table rows */}
                <div style={{ marginTop: 4 }}>
                  {[
                    { key: "Lightning Strokes", val: `${lightning}`, color: "var(--col-lightning)" },
                    { key: "Active Storm Cells", val: `${cells}`, color: "var(--cyan)" },
                    { key: "Cloudburst Cells", val: `${summary?.cloudburst_cells ?? 0}`, color: "var(--sev-critical)" },
                    { key: "Severe Hail Cells", val: `${summary?.severe_hail_cells ?? 0}`, color: "var(--col-hail)" },
                    { key: "CTCR (K/15min)", val: ci ? `${ci.ctcr_k_per_15min.toFixed(2)}` : "—", color: ci?.detected ? "var(--sev-critical)" : "var(--text-secondary)" },
                    { key: "SWD (TIR1-TIR2 K)", val: ci ? `${ci.min_swd_k.toFixed(2)}` : "—", color: "var(--col-sat)" },
                  ].map(({ key, val, color }) => (
                    <div key={key} className="info-row">
                      <span className="key">{key}</span>
                      <span className="val" style={{ color }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nowcast strip — only in pro mode */}
        {(uxMode === "pro") && (
          <div>
            <div className="section-header">
              <TrendingUp size={11} />
              {lang === "hi" ? "ConvLSTM पूर्वानुमान (0–120 मि)" : "ConvLSTM Forecast (0–120 min)"}
            </div>
            <NowcastForecastStrip nowcast={nowcast} compact={true} />
          </div>
        )}

        <div className="divider" />

        {/* Language toggle */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className={`btn btn-sm ${lang === "en" ? "btn-cyan" : ""}`}
            style={{ flex: 1 }}
            onClick={() => lang !== "en" && onToggleLang()}
          >
            🇬🇧 English
          </button>
          <button
            className={`btn btn-sm ${lang === "hi" ? "btn-cyan" : ""}`}
            style={{ flex: 1 }}
            onClick={() => lang !== "hi" && onToggleLang()}
          >
            🇮🇳 हिन्दी
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button className="btn btn-full btn-cyan" onClick={onOpenAIAdvisory}>
            <Sparkles size={13} />
            {t.ai}
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button
              className={`btn btn-sm ${isSimulating ? "btn-critical" : ""}`}
              onClick={onSimulateSevere}
              disabled={isSimulating}
            >
              <RefreshCw size={12} className={isSimulating ? "animate-spin" : ""} />
              {isSimulating ? (lang === "hi" ? "अनुकरण..." : "Simulating…") : t.simulate}
            </button>
            <button className="btn btn-sm" onClick={onToggleFailover}>
              <SatelliteDish size={12} />
              {t.failover}
            </button>
          </div>

          <button className="btn btn-full btn-sm" onClick={onDownloadCAP}>
            <FileDown size={12} />
            {t.cap}
          </button>
        </div>

        {/* Footer */}
        <div style={{ paddingTop: 6, borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-dim)", display: "flex", justifyContent: "space-between" }}>
          <span>AntiGravity v3.0.0 · SIH 2024</span>
          <span className="mono">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};
