import { useEffect, useState } from "react";
import { X, History, CloudRain, Wind, Calendar, Info } from "lucide-react";
import { fetchHistoricalEvents, HistoricalEventItem } from "../lib/apiClient";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  regionId?: string | null;
}

export function HistoricalEventsModal({ isOpen, onClose, regionId }: Props) {
  const [events, setEvents] = useState<HistoricalEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchHistoricalEvents(regionId || "WEST_INDIA")
        .then((res) => setEvents(res))
        .finally(() => setLoading(false));
    }
  }, [isOpen, regionId]);

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
          boxShadow: "var(--shadow-glass), 0 0 35px -10px var(--signal-glow)",
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
            background: "linear-gradient(135deg, rgba(56,189,248,0.12), var(--raised))",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0284c7, #38bdf8)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <History size={16} color="#04070c" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Historical Severe Storm Benchmarks</div>
            <div className="label" style={{ fontSize: 8.5 }}>
              India catastrophic convective records for verification &amp; model stress-testing
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
              Loading historical convective benchmarks…
            </div>
          ) : events.length > 0 ? (
            events.map((ev) => (
              <div
                key={ev.event_id}
                style={{
                  background: "var(--raised)",
                  border: "1px solid var(--hair)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{ev.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "var(--text-faint)" }}>
                    <Calendar size={10} />
                    <span className="mono">{ev.date}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {ev.peak_rain_mm_hr !== undefined && (
                    <span className="pill sev-extreme">
                      <CloudRain size={10} /> Peak Rain: {ev.peak_rain_mm_hr} mm/h
                    </span>
                  )}
                  {ev.total_24h_mm !== undefined && (
                    <span className="pill sev-severe">
                      <Info size={10} /> 24h Total: {ev.total_24h_mm} mm
                    </span>
                  )}
                  {ev.peak_gust_kmh !== undefined && (
                    <span className="pill sev-extreme">
                      <Wind size={10} /> Peak Gust: {ev.peak_gust_kmh} km/h
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
                  {ev.synopsis}
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-faint)" }}>
              No historical event records available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
