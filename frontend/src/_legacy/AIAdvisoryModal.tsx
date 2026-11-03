import React from "react";
import { AIAdvisoryData } from "../types/weather";
import { X, Sparkles, Shield, AlertOctagon, List, Clock } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  advisory: AIAdvisoryData | null;
  loading: boolean;
}

const RISK_COLORS: Record<string, string> = {
  LOW:      "var(--sev-low)",
  MODERATE: "var(--sev-moderate)",
  HIGH:     "var(--sev-high)",
  EXTREME:  "var(--sev-critical)",
  CRITICAL: "var(--sev-critical)",
};

function RiskChip({ label, level }: { label: string; level: string }) {
  const upper = (level ?? "").toUpperCase();
  const color = RISK_COLORS[upper] ?? "var(--text-secondary)";
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "10px 12px",
      flex: 1,
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 800, color }}>
        {level || "—"}
      </span>
      <div style={{ height: 3, borderRadius: 3, background: color, opacity: 0.6 }} />
    </div>
  );
}

export function AIAdvisoryModal({ isOpen, onClose, advisory, loading }: Props) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 660 }}>
        {/* Header */}
        <div style={{
          padding: "18px 22px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "linear-gradient(135deg, rgba(56,189,248,0.06), rgba(139,92,246,0.06))",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(139,92,246,0.2))",
            border: "1px solid rgba(56,189,248,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Sparkles size={20} color="var(--cyan)" />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
              AI Meteorological Copilot
            </h2>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Situation diagnosis · Threat matrix · Tactical directives
            </p>
          </div>
          <button onClick={onClose} className="btn btn-sm" style={{ marginLeft: "auto", padding: "5px 7px" }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="scroll-y" style={{ flex: 1, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Generating meteorological assessment…</div>
              <div style={{
                width: 48, height: 48, border: "3px solid var(--border)", borderTopColor: "var(--cyan)",
                borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {!loading && advisory && (
            <>
              {/* Source / urgency */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Source:</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--cyan)" }}>{advisory.source}</span>
                {advisory.urgency && (
                  <span className="badge badge-critical" style={{ marginLeft: "auto" }}>
                    <AlertOctagon size={10} />
                    {advisory.urgency}
                  </span>
                )}
              </div>

              {/* Situation diagnosis */}
              {advisory.diagnosis && (
                <div>
                  <div className="section-header">
                    <Shield size={12} />
                    Situation Diagnosis
                  </div>
                  <div style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: "var(--text-secondary)",
                  }}>
                    {advisory.diagnosis}
                  </div>
                </div>
              )}

              {/* Threat matrix */}
              {advisory.threat_matrix && (
                <div>
                  <div className="section-header">
                    <AlertOctagon size={12} />
                    Threat Matrix
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <RiskChip label="Flash Flood"    level={advisory.threat_matrix.flash_flood_risk} />
                    <RiskChip label="Microburst"     level={advisory.threat_matrix.microburst_risk} />
                    <RiskChip label="Severe Hail"    level={advisory.threat_matrix.severe_hail_risk} />
                    <RiskChip label="Lightning Hazard" level={advisory.threat_matrix.lightning_hazard} />
                  </div>
                </div>
              )}

              {/* Tactical directives */}
              {advisory.tactical_directives && advisory.tactical_directives.length > 0 && (
                <div>
                  <div className="section-header">
                    <List size={12} />
                    Tactical Directives
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {advisory.tactical_directives.map((d, i) => (
                      <div key={i} style={{
                        display: "flex", gap: 10, padding: "9px 12px",
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                          background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)",
                          color: "var(--cyan)", fontSize: 10, fontWeight: 800,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>{i + 1}</span>
                        <span style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* General advisory fallback */}
              {!advisory.diagnosis && advisory.advisory && (
                <div style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "14px 16px",
                  fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)",
                }}>
                  {advisory.advisory}
                </div>
              )}
            </>
          )}

          {!loading && !advisory && (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: 12 }}>
              No advisory data available.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 10,
          color: "var(--text-dim)",
        }}>
          <Clock size={11} />
          Advisory generated at {new Date().toLocaleTimeString()} IST · For authorized meteorological use only
        </div>
      </div>
    </div>
  );
}
