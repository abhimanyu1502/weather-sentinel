import { useEffect, useState } from "react";
import { X, Sparkles, Shield, AlertOctagon, List, RefreshCw, Zap } from "lucide-react";
import { fetchAiAdvisory, AIAdvisoryResponse } from "../lib/apiClient";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const RISK_COLORS: Record<string, string> = {
  LOW: "var(--mint)",
  MODERATE: "var(--h-warning)",
  HIGH: "var(--h-severe)",
  EXTREME: "var(--h-extreme)",
  CRITICAL: "var(--h-extreme)",
};

function RiskCard({ label, level }: { label: string; level?: string }) {
  const upper = (level ?? "").toUpperCase();
  const color = RISK_COLORS[upper] ?? "var(--text-dim)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        background: "var(--raised)",
        border: "1px solid var(--hair)",
        borderRadius: 8,
        padding: "8px 10px",
      }}
    >
      <span className="label" style={{ fontSize: 7.5, textTransform: "uppercase" }}>{label}</span>
      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>
        {level || "NORMAL"}
      </span>
      <div style={{ height: 2, borderRadius: 2, background: color, opacity: 0.7 }} />
    </div>
  );
}

export function AIAdvisoryModal({ isOpen, onClose }: Props) {
  const [advisory, setAdvisory] = useState<AIAdvisoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const loadAdvisory = async () => {
    setLoading(true);
    try {
      const res = await fetchAiAdvisory();
      if (res) {
        setAdvisory(res);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !advisory) {
      loadAdvisory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "var(--backdrop)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="panel rise"
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-glass), 0 0 35px -10px rgba(76,201,240,0.3)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderBottom: "1px solid var(--hair)",
            background: "linear-gradient(135deg, rgba(76,201,240,0.08), rgba(244,63,94,0.06))",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0e7490, #4cc9f0)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Sparkles size={16} color="#04070c" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>AI Meteorological Copilot</div>
            <div className="label" style={{ fontSize: 8.5 }}>
              Deep Learning convective analysis · Multi-source diagnostic rationale
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={loadAdvisory} disabled={loading} className="btn" style={{ padding: "4px 8px" }} title="Regenerate reasoning">
            <RefreshCw size={11} className={loading ? "critical-pulse" : ""} />
            <span style={{ fontSize: 9 }}>Refresh</span>
          </button>
          <button onClick={onClose} className="btn" style={{ padding: "4px 8px" }} aria-label="Close modal">
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="scroll" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <div style={{ color: "var(--signal)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                Synthesizing multi-modal atmospheric state…
              </div>
              <div className="label" style={{ fontSize: 9 }}>
                Evaluating Doppler reflectivity convergence, INSAT IR glaciation, and lightning burst kinematics
              </div>
            </div>
          ) : advisory ? (
            <>
              {/* Urgency & Source */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="pill" style={{ color: "var(--signal)", fontSize: 9.5 }}>
                  <Zap size={10} /> Model: {advisory.source}
                </span>
                {advisory.urgency && (
                  <span className="pill sev-extreme" style={{ fontSize: 9.5 }}>
                    <AlertOctagon size={10} /> {advisory.urgency}
                  </span>
                )}
              </div>

              {/* Diagnosis */}
              {advisory.diagnosis && (
                <div>
                  <div className="label" style={{ marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
                    <Shield size={11} color="var(--signal)" /> Situation Diagnosis
                  </div>
                  <div
                    style={{
                      background: "var(--raised)",
                      border: "1px solid var(--hair)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "var(--text-dim)",
                    }}
                  >
                    {advisory.diagnosis}
                  </div>
                </div>
              )}

              {/* Threat Matrix */}
              {advisory.threat_matrix && (
                <div>
                  <div className="label" style={{ marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
                    <AlertOctagon size={11} color="var(--h-extreme)" /> Threat Matrix
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    <RiskCard label="Flash Flood" level={advisory.threat_matrix.flash_flood_risk} />
                    <RiskCard label="Microburst" level={advisory.threat_matrix.microburst_risk} />
                    <RiskCard label="Severe Hail" level={advisory.threat_matrix.severe_hail_risk} />
                    <RiskCard label="Lightning" level={advisory.threat_matrix.lightning_hazard} />
                  </div>
                </div>
              )}

              {/* Directives */}
              {advisory.tactical_directives && advisory.tactical_directives.length > 0 && (
                <div>
                  <div className="label" style={{ marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
                    <List size={11} color="var(--mint)" /> Tactical Directives for Disaster Authorities (NDRF/SDMA)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {advisory.tactical_directives.map((dir, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          padding: "6px 10px",
                          background: "rgba(74,222,128,0.06)",
                          borderLeft: "2px solid var(--mint)",
                          borderRadius: "0 6px 6px 0",
                          fontSize: 11,
                          color: "var(--text)",
                        }}
                      >
                        <span className="mono" style={{ color: "var(--mint)", fontWeight: 700, fontSize: 10 }}>
                          {i + 1}.
                        </span>
                        <span>{dir}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {advisory.advisory && (
                <div style={{ fontSize: 11, color: "var(--text-faint)", fontStyle: "italic", borderTop: "1px solid var(--hair)", paddingTop: 8 }}>
                  {advisory.advisory}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-faint)" }}>
              No advisory data returned. Ensure backend is active at http://localhost:8000.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
