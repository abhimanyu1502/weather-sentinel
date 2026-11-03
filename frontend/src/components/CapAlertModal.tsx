import { useEffect, useState } from "react";
import { X, Siren, AlertTriangle, FileCode, CheckCircle2, Copy } from "lucide-react";
import { fetchCapAlert, CapAlertData } from "../lib/apiClient";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CapAlertModal({ isOpen, onClose }: Props) {
  const [alert, setAlert] = useState<CapAlertData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showXml, setShowXml] = useState<boolean>(false);

  const loadAlert = async () => {
    setLoading(true);
    try {
      const res = await fetchCapAlert();
      if (res) {
        setAlert(res);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAlert();
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (!alert?.rawXml) return;
    navigator.clipboard.writeText(alert.rawXml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          maxWidth: 620,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-glass), 0 0 35px -10px rgba(244,63,94,0.3)",
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
            background: "linear-gradient(135deg, rgba(244,63,94,0.1), rgba(251,146,60,0.06))",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #e11d48, #f43f5e)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Siren size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>OASIS CAP v1.2 Warning Feed</div>
            <div className="label" style={{ fontSize: 8.5 }}>
              NDMA / IMD Common Alerting Protocol export for siren networks &amp; cell broadcast
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} className="btn" style={{ padding: "4px 8px" }} aria-label="Close modal">
            <X size={13} />
          </button>
        </div>

        {/* Content */}
        <div className="scroll" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "var(--signal)" }}>
              Fetching latest CAP XML alert packet…
            </div>
          ) : alert ? (
            <>
              {/* Alert Badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "rgba(244,63,94,0.12)",
                  border: "1px solid rgba(244,63,94,0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--h-extreme)", fontWeight: 800, fontSize: 12 }}>
                  <AlertTriangle size={14} />
                  <span>{alert.severity.toUpperCase()} ALERT — {alert.event}</span>
                </div>
                <span className="mono label" style={{ fontSize: 9 }}>
                  {alert.alertId}
                </span>
              </div>

              {/* Headline */}
              <div>
                <div className="label" style={{ fontSize: 8, marginBottom: 2 }}>HEADLINE</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                  {alert.headline}
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="label" style={{ fontSize: 8, marginBottom: 2 }}>METEOROLOGICAL DIAGNOSIS</div>
                <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                  {alert.description}
                </div>
              </div>

              {/* Public Instructions */}
              <div
                style={{
                  padding: "10px 12px",
                  background: "var(--raised)",
                  borderLeft: "3px solid var(--h-extreme)",
                  borderRadius: "0 6px 6px 0",
                }}
              >
                <div className="label" style={{ fontSize: 8, color: "var(--h-extreme)", marginBottom: 3 }}>
                  PUBLIC SAFETY DIRECTIVE
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                  {alert.instruction}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setShowXml((s) => !s)}
                  className="btn"
                  style={{ fontSize: 10, padding: "5px 10px" }}
                >
                  <FileCode size={11} />
                  <span>{showXml ? "Hide CAP XML" : "Inspect OASIS XML"}</span>
                </button>
                <button
                  onClick={handleCopy}
                  className="btn"
                  style={{ fontSize: 10, padding: "5px 10px" }}
                >
                  {copied ? <CheckCircle2 size={11} color="var(--mint)" /> : <Copy size={11} />}
                  <span>{copied ? "Copied XML!" : "Copy Raw XML"}</span>
                </button>
              </div>

              {/* XML Viewer */}
              {showXml && (
                <div
                  style={{
                    background: "var(--inset)",
                    border: "1px solid var(--hair)",
                    borderRadius: 6,
                    padding: 10,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  <pre className="mono" style={{ fontSize: 9.5, color: "var(--signal)", margin: 0, whiteSpace: "pre-wrap" }}>
                    {alert.rawXml}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-faint)" }}>
              No active CAP alerts found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
