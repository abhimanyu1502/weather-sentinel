import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  X,
  MapPin,
  Globe2,
  AlertTriangle,
  Siren,
  Clock,
  Sparkles,
  ChevronRight,
  Compass,
  Building2,
  Crosshair,
} from "lucide-react";
import { ALL_CITIES, City, INDIA_REGIONS, ZONE_CLUSTERS } from "../data/indiaGeo";
import { ALL_SUBDISTRICTS, subdistrictById, subdistrictToCity, Subdistrict } from "../data/subdistricts";
import { CityWeather, HazardLevel, HAZ_CLASS } from "../lib/weatherEngine";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cities: CityWeather[];
  onPickCity: (c: City) => void;
  onPickZone: (zoneId: string) => void;
}

type SearchCategory = "ALL" | "ANOMALIES" | "CITIES" | "SUBDISTRICTS" | "STATES" | "ZONES";

export function CommandSearchModal({
  isOpen,
  onClose,
  cities,
  onPickCity,
  onPickZone,
}: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("ALL");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fast weather lookup map
  const cityMap = useMemo(() => {
    const map = new Map<string, CityWeather>();
    cities.forEach((c) => map.set(c.cityId, c));
    return map;
  }, [cities]);

  // Cities with active 6-hour anomalies
  const anomalyCities = useMemo(() => {
    return cities
      .filter((c) => c.hazard === "EXTREME" || c.hazard === "SEVERE" || c.hazard === "WARNING")
      .sort((a, b) => b.hazardScore - a.hazardScore);
  }, [cities]);

  // Filtered results based on category & text query
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 1. 6-Hour Anomalies
    const anomalyHits = anomalyCities
      .filter((c) => !q || c.cityName.toLowerCase().includes(q) || c.state.toLowerCase().includes(q) || c.hazard.toLowerCase().includes(q))
      .map((c) => {
        const leadH = Math.max(1, Math.min(6, Math.round((100 - c.hazardScore) / 16) + 1));
        return {
          kind: "anomaly" as const,
          id: c.cityId,
          name: c.cityName,
          sub: `${c.state} · Predicted in ~${leadH}h (Lead Time) · ${c.rainMmHr.toFixed(0)} mm/h core`,
          hazard: c.hazard,
          score: c.hazardScore,
          temp: c.temperatureC,
        };
      });

    // 2. All Cities
    const cityHits = ALL_CITIES.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
    )
      .slice(0, q ? 25 : 12)
      .map((c) => {
        const w = cityMap.get(c.id);
        return {
          kind: "city" as const,
          id: c.id,
          name: c.name,
          sub: `${c.state} · ${c.type.replace("-", " ")}${w ? ` · ${w.temperatureC.toFixed(0)}°C` : ""}`,
          hazard: w?.hazard ?? "NONE",
          score: w?.hazardScore ?? 0,
          temp: w?.temperatureC ?? 28,
        };
      });

    // 3. Subdistricts, Talukas & Urban Sectors
    const subdistrictHits = ALL_SUBDISTRICTS.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.parentCityName.toLowerCase().includes(q) ||
        s.district.toLowerCase().includes(q) ||
        s.state.toLowerCase().includes(q)
    )
      .slice(0, q ? 30 : 12)
      .map((s) => ({
        kind: "subdistrict" as const,
        id: s.id,
        name: s.name,
        sub: `${s.parentCityName} · ${s.district}, ${s.state} · ${s.category} · ${s.lat.toFixed(4)}°N, ${s.lon.toFixed(4)}°E`,
        hazard: "NONE" as HazardLevel,
        score: 0,
        temp: 0,
      }));

    // 4. States & UTs
    const stateHits = INDIA_REGIONS.filter(
      (r) => !q || r.name.toLowerCase().includes(q) || r.short.toLowerCase().includes(q)
    )
      .slice(0, q ? 10 : 6)
      .map((r) => ({
        kind: "state" as const,
        id: r.id,
        name: r.name,
        sub: `${r.zone} Zone · Capital: ${r.capital} · ${r.cities.length} monitored cities`,
        hazard: "NONE" as HazardLevel,
        score: 0,
        temp: 0,
      }));

    // 5. Macro-Zones
    const zoneHits = ZONE_CLUSTERS.filter(
      (z) => !q || z.name.toLowerCase().includes(q)
    ).map((z) => ({
      kind: "zone" as const,
      id: z.id,
      name: z.name,
      sub: `Macro-geographical weather cluster · ${z.states.length} States/UTs`,
      hazard: "NONE" as HazardLevel,
      score: 0,
      temp: 0,
    }));

    if (category === "ANOMALIES") return anomalyHits;
    if (category === "CITIES") return cityHits;
    if (category === "SUBDISTRICTS") return subdistrictHits;
    if (category === "STATES") return stateHits;
    if (category === "ZONES") return zoneHits;

    // For ALL: If query is empty, prioritize 6-Hour Anomalies and key locations
    if (!q) {
      return [
        ...anomalyHits.slice(0, 5),
        ...cityHits.slice(0, 5),
        ...subdistrictHits.slice(0, 5),
        ...zoneHits.slice(0, 2),
      ];
    }

    return [
      ...anomalyHits.slice(0, 4),
      ...cityHits.slice(0, 8),
      ...subdistrictHits.slice(0, 10),
      ...stateHits.slice(0, 3),
      ...zoneHits.slice(0, 2),
    ];
  }, [query, category, anomalyCities, cityMap]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, category]);

  const handleSelect = (index: number) => {
    const item = results[index];
    if (!item) return;

    if (item.kind === "subdistrict") {
      const sd = subdistrictById(item.id);
      if (sd) onPickCity(subdistrictToCity(sd));
    } else if (item.kind === "anomaly" || item.kind === "city") {
      const c = ALL_CITIES.find((x) => x.id === item.id);
      if (c) onPickCity(c);
    } else if (item.kind === "zone") {
      onPickZone(item.id);
    } else if (item.kind === "state") {
      const reg = INDIA_REGIONS.find((x) => x.id === item.id);
      if (reg && reg.cities[0]) onPickCity(reg.cities[0]);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(results.length - 1, prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(selectedIndex);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2500,
        background: "var(--backdrop)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "grid",
        placeItems: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="panel-glass rise"
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-glass), 0 0 35px -8px var(--signal-glow)",
          overflow: "hidden",
          border: "1.5px solid var(--hair-strong)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Search Input Field ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderBottom: "1px solid var(--hair)",
            background: "var(--inset)",
          }}
        >
          <Search size={18} color="var(--signal)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search 152+ cities, 120+ subdistricts & talukas, 36 states, or 6h anomalies..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 14,
              fontFamily: "var(--font-sans)",
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="btn btn-icon"
              style={{ width: 24, height: 24 }}
            >
              <X size={13} />
            </button>
          )}
          <span
            className="mono label"
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(255,255,255,0.08)",
              fontSize: 9.5,
              color: "var(--text-dim)",
            }}
          >
            ESC to close
          </span>
        </div>

        {/* ── Category Filter Tabs ── */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "8px 16px",
            borderBottom: "1px solid var(--hair)",
            background: "rgba(6,10,20,0.5)",
            overflowX: "auto",
          }}
        >
          {[
            { id: "ALL", label: "All Results" },
            { id: "ANOMALIES", label: `🚨 6h Anomalies (${anomalyCities.length})` },
            { id: "CITIES", label: "Cities (152+)" },
            { id: "SUBDISTRICTS", label: `Subdistricts (${ALL_SUBDISTRICTS.length})` },
            { id: "STATES", label: "States & UTs (36)" },
            { id: "ZONES", label: "Macro-Zones" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id as SearchCategory)}
              className="btn btn-pill"
              data-active={category === cat.id}
              style={{
                fontSize: 10.5,
                padding: "4px 10px",
                borderColor: category === cat.id ? "var(--signal)" : "transparent",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* ── Search Results List ── */}
        <div className="scroll" style={{ flex: 1, padding: "8px 12px" }}>
          {results.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-dim)" }}>
              No matches found for &quot;{query}&quot;. Try searching for cities like Mumbai, Delhi, Guwahati, or states like Maharashtra, Assam.
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isAnomaly = item.kind === "anomaly";

              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: isSelected
                      ? isAnomaly
                        ? "rgba(244,63,94,0.18)"
                        : "rgba(56,189,248,0.15)"
                      : "transparent",
                    border: `1px solid ${
                      isSelected
                        ? isAnomaly
                          ? "rgba(244,63,94,0.4)"
                          : "rgba(56,189,248,0.35)"
                        : "transparent"
                    }`,
                    cursor: "pointer",
                    marginBottom: 3,
                    transition: "all 0.12s ease",
                  }}
                >
                  {/* Leading Icon */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: isAnomaly
                        ? "rgba(244,63,94,0.15)"
                        : item.kind === "zone"
                        ? "rgba(56,189,248,0.12)"
                        : "rgba(148,163,184,0.1)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isAnomaly ? (
                      <AlertTriangle size={15} color="var(--h-extreme)" />
                    ) : item.kind === "city" ? (
                      <span className={`dot ${HAZ_CLASS[item.hazard]}`} />
                    ) : item.kind === "subdistrict" ? (
                      <Crosshair size={15} color="#06b6d4" />
                    ) : item.kind === "zone" ? (
                      <Globe2 size={15} color="var(--signal)" />
                    ) : (
                      <Building2 size={15} color="var(--violet)" />
                    )}
                  </div>

                  {/* Text Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                        {item.name}
                      </span>
                      {isAnomaly && (
                        <span
                          className={`pill ${HAZ_CLASS[item.hazard]}`}
                          style={{ fontSize: 8.5, padding: "1px 6px" }}
                        >
                          6H ANOMALY
                        </span>
                      )}
                      {item.kind === "subdistrict" && (
                        <span
                          className="label mono"
                          style={{
                            fontSize: 8.5,
                            color: "#06b6d4",
                            background: "rgba(6,182,212,0.14)",
                            border: "1px solid rgba(6,182,212,0.3)",
                            padding: "1px 5px",
                            borderRadius: 4,
                          }}
                        >
                          SUBDISTRICT / TALUKA
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--text-muted)",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.sub}
                    </div>
                  </div>

                  {/* Trailing Temperature / Metric */}
                  {item.temp > 0 && (
                    <div className="mono" style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
                      {item.temp.toFixed(0)}°C
                    </div>
                  )}

                  <ChevronRight size={14} color="var(--text-faint)" />
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer Hints ── */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--hair)",
            background: "var(--inset)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 10,
            color: "var(--text-dim)",
          }}
        >
          <div style={{ display: "flex", gap: 14 }}>
            <span><kbd className="mono">↑</kbd> <kbd className="mono">↓</kbd> to navigate</span>
            <span><kbd className="mono">↵</kbd> to select</span>
            <span><kbd className="mono">ESC</kbd> to exit</span>
          </div>
          <span style={{ color: "var(--signal)", fontWeight: 600 }}>
            Pan-India 6-Hour Early Warning Engine
          </span>
        </div>
      </div>
    </div>
  );
}
