import { useMemo, useState } from "react";
import {
  ChevronDown,
  Layers,
  MapPinned,
  Siren,
  Search,
  Filter,
  Check,
  Eye,
  EyeOff,
  CloudRain,
  Radio,
  SlidersHorizontal,
  Crosshair,
} from "lucide-react";
import { INDIA_REGIONS, StateRegion, ZONE_CLUSTERS, INDIA_BOUNDS } from "../data/indiaGeo";
import { ALL_SUBDISTRICTS, subdistrictById, Subdistrict } from "../data/subdistricts";
import { CityWeather, HazardLevel, NationalSummary, HAZ_CLASS } from "../lib/weatherEngine";

interface Props {
  cities: CityWeather[];
  summary: NationalSummary;
  selectedRegionId: string | null;
  selectedCityId: string | null;
  onPickRegion: (id: string | null) => void;
  onPickCity: (id: string) => void;
  layers: Record<string, boolean>;
  onToggleLayer: (k: string) => void;
}

const LAYER_DEFS: { k: string; label: string; hint: string }[] = [
  { k: "reflectivity", label: "Radar Reflectivity", hint: "dBZ composite" },
  { k: "lightning", label: "Lightning Density", hint: "flashes/km²" },
  { k: "satellite", label: "Infrared Satellite", hint: "cloud-top TIR" },
  { k: "tracks", label: "Storm Tracks", hint: "past 60 min" },
  { k: "countdown", label: "Impact Countdowns", hint: "city ETAs" },
  { k: "landmarks", label: "Strategic Hubs", hint: "airports & rail" },
  { k: "states", label: "State Borders", hint: "S/UT outlines" },
  { k: "labels", label: "City Labels", hint: "annotate dots" },
];

type SeverityFilter = "ALL" | "EXTREME" | "SEVERE+" | "WARNING+";

export function LeftRail({
  cities,
  summary,
  selectedRegionId,
  selectedCityId,
  onPickRegion,
  onPickCity,
  layers,
  onToggleLayer,
}: Props) {
  const [filterQuery, setFilterQuery] = useState("");
  const [sevFilter, setSevFilter] = useState<SeverityFilter>("ALL");
  // Keep the first render scannable. Users can progressively open a state and city
  // when they need locality-level detail.
  const [expandedStates, setExpandedStates] = useState<Set<string>>(() => new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(() => new Set());
  const [layersExpanded, setLayersExpanded] = useState(false);

  // Fast city lookup map
  const cityMap = useMemo(() => {
    const map = new Map<string, CityWeather>();
    cities.forEach((c) => map.set(c.cityId, c));
    return map;
  }, [cities]);

  // Macro-zone summary calculation
  const zoneStats = useMemo(() => {
    const stats: Record<string, { worst: HazardLevel; count: number; alertCount: number }> = {};
    const rank: HazardLevel[] = ["EXTREME", "SEVERE", "WARNING", "WATCH", "NONE"];

    ZONE_CLUSTERS.forEach((z) => {
      const zStates = new Set(z.states);
      const zCities = INDIA_REGIONS.filter((r) => zStates.has(r.id)).flatMap((r) => r.cities);
      let worst: HazardLevel = "NONE";
      let alertCount = 0;

      zCities.forEach((c) => {
        const w = cityMap.get(c.id);
        if (w) {
          if (rank.indexOf(w.hazard) < rank.indexOf(worst)) worst = w.hazard;
          if (w.hazard === "WARNING" || w.hazard === "SEVERE" || w.hazard === "EXTREME") {
            alertCount++;
          }
        }
      });
      stats[z.id] = { worst, count: zCities.length, alertCount };
    });
    return stats;
  }, [cityMap]);

  // Filtered state list
  const filteredRegions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const rank: HazardLevel[] = ["EXTREME", "SEVERE", "WARNING", "WATCH", "NONE"];

    return INDIA_REGIONS.filter((r) => {
      // Zone filter check
      if (selectedRegionId) {
        const zone = ZONE_CLUSTERS.find((z) => z.id === selectedRegionId);
        if (zone && !zone.states.includes(r.id)) return false;
      }

      // Severity filter check
      const stateCities = r.cities.map((c) => cityMap.get(c.id)).filter(Boolean) as CityWeather[];
      const worst = stateCities.reduce<HazardLevel>(
        (acc, c) => (rank.indexOf(c.hazard) < rank.indexOf(acc) ? c.hazard : acc),
        "NONE"
      );

      if (sevFilter === "EXTREME" && worst !== "EXTREME") return false;
      if (sevFilter === "SEVERE+" && worst !== "EXTREME" && worst !== "SEVERE") return false;
      if (sevFilter === "WARNING+" && worst !== "EXTREME" && worst !== "SEVERE" && worst !== "WARNING") return false;

      // Text query check
      if (!q) return true;
      if (r.name.toLowerCase().includes(q)) return true;
      if (r.cities.some((c) => c.name.toLowerCase().includes(q))) return true;
      return ALL_SUBDISTRICTS.some(
        (sd) =>
          (sd.state.toLowerCase() === r.name.toLowerCase() ||
            r.cities.some((c) => c.id === sd.parentCityId)) &&
          sd.name.toLowerCase().includes(q)
      );
    });
  }, [filterQuery, selectedRegionId, sevFilter, cityMap]);

  const toggleExpand = (stateId: string) => {
    setExpandedStates((prev) => {
      const next = new Set(prev);
      if (next.has(stateId)) next.delete(stateId);
      else next.add(stateId);
      return next;
    });
  };

  return (
    <aside
      className="panel-glass"
      style={{
        width: 320,
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── Header: Explorer Title & Summary Counts ── */}
      <div className="panel-head">
        <span className="accent">
          <MapPinned size={13} style={{ verticalAlign: -1 }} /> Regional Explorer
        </span>
        <span className="label mono" style={{ fontSize: 9.5 }}>
          {filteredRegions.length} of 36 States
        </span>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--hair)", display: "flex", flexDirection: "column", gap: 7 }}>
        {/* Quick Filter Input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--inset)",
            border: "1px solid var(--hair-medium)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 8px",
          }}
        >
          <Search size={13} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter states, cities or subdistricts..."
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 11,
              width: "100%",
            }}
          />
        </div>

        {/* Hazard Severity Filter Chips */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(["ALL", "EXTREME", "SEVERE+", "WARNING+"] as SeverityFilter[]).map((sf) => (
            <button
              key={sf}
              onClick={() => setSevFilter(sf)}
              className="btn btn-pill"
              data-active={sevFilter === sf}
              style={{
                fontSize: 9.5,
                padding: "2px 7px",
                borderColor: sevFilter === sf ? "var(--signal)" : "var(--hair)",
              }}
            >
              {sf}
            </button>
          ))}
        </div>
      </div>

      {/* ── Macro-Zone Quick Strip ── */}
      <div
        className="scroll"
        style={{
          display: "flex",
          gap: 5,
          padding: "6px 10px",
          borderBottom: "1px solid var(--hair)",
          overflowX: "auto",
          flexShrink: 0,
        }}
      >
        <button
          className="btn btn-pill"
          data-active={!selectedRegionId}
          onClick={() => onPickRegion(null)}
          style={{ fontSize: 9.5, padding: "3px 8px" }}
        >
          All India
        </button>
        {ZONE_CLUSTERS.map((z) => {
          const zs = zoneStats[z.id];
          return (
            <button
              key={z.id}
              className="btn btn-pill"
              data-active={selectedRegionId === z.id}
              onClick={() => onPickRegion(selectedRegionId === z.id ? null : z.id)}
              style={{ fontSize: 9.5, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              {zs?.worst !== "NONE" && <span className={`dot ${HAZ_CLASS[zs.worst]}`} />}
              <span>{z.name.replace(" India", "")}</span>
              {zs?.alertCount > 0 && (
                <span className="mono" style={{ color: "var(--h-extreme)", fontSize: 8.5, fontWeight: 700 }}>
                  ({zs.alertCount})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── State & City List ── */}
      <div className="scroll" style={{ flex: 1, padding: "4px 0" }}>
        {filteredRegions.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-dim)", fontSize: 11 }}>
            No states or cities match &quot;{filterQuery}&quot; with filter {sevFilter}.
          </div>
        ) : (
          filteredRegions.map((region) => {
            const isExpanded = expandedStates.has(region.id) || !!filterQuery;
            const rank: HazardLevel[] = ["EXTREME", "SEVERE", "WARNING", "WATCH", "NONE"];
            const stateCities = region.cities.map((c) => cityMap.get(c.id)).filter(Boolean) as CityWeather[];
            const worst = stateCities.reduce<HazardLevel>(
              (acc, c) => (rank.indexOf(c.hazard) < rank.indexOf(acc) ? c.hazard : acc),
              "NONE"
            );
            const avgTemp =
              stateCities.length > 0
                ? stateCities.reduce((s, c) => s + c.temperatureC, 0) / stateCities.length
                : 28;

            return (
              <div key={region.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                {/* State Accordion Header */}
                <div
                  onClick={() => toggleExpand(region.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 12px",
                    cursor: "pointer",
                    background: isExpanded ? "rgba(56,189,248,0.06)" : "transparent",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <ChevronDown
                    size={13}
                    style={{
                      color: "var(--text-faint)",
                      transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 0.18s ease",
                      flexShrink: 0,
                    }}
                  />
                  <span className={`dot ${HAZ_CLASS[worst]}`} style={{ boxShadow: "0 0 6px currentColor" }} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {region.name}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>
                    {avgTemp.toFixed(0)}°C
                  </span>
                  <span
                    className="label mono"
                    style={{
                      fontSize: 8.5,
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: "rgba(148,163,184,0.1)",
                    }}
                  >
                    {region.cities.length}
                  </span>
                </div>

                {/* Cities within this state */}
                {isExpanded && (
                  <div style={{ background: "var(--inset)", padding: "2px 0 4px" }}>
                    {region.cities.map((city) => {
                      const weather = cityMap.get(city.id);
                      const isSel = selectedCityId === city.id;
                      const hz = weather?.hazard ?? "NONE";

                      const citySubdistricts = ALL_SUBDISTRICTS.filter(
                        (s) =>
                          s.parentCityId === city.id ||
                          s.parentCityName.toLowerCase() === city.name.toLowerCase()
                      );
                      const hasSubdistricts = citySubdistricts.length > 0;
                      const isCityExpanded =
                        expandedCities.has(city.id) ||
                        (!!filterQuery &&
                          citySubdistricts.some((s) =>
                            s.name.toLowerCase().includes(filterQuery.toLowerCase())
                          ));

                      return (
                        <div key={city.id} style={{ display: "flex", flexDirection: "column" }}>
                          <button
                            onClick={() => onPickCity(city.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              padding: "6px 12px 6px 30px",
                              background: isSel ? "rgba(56,189,248,0.16)" : "transparent",
                              border: "none",
                              borderLeft: `2px solid ${isSel ? "var(--signal)" : "transparent"}`,
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "all 0.12s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isSel) e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <span className={`dot ${HAZ_CLASS[hz]}`} />
                            <span
                              style={{
                                flex: 1,
                                fontSize: 11.5,
                                fontWeight: isSel ? 700 : 500,
                                color: isSel ? "var(--signal-bright)" : "var(--text-muted)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {city.name}
                            </span>

                            {hasSubdistricts && (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedCities((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(city.id)) next.delete(city.id);
                                    else next.add(city.id);
                                    return next;
                                  });
                                }}
                                className="label mono"
                                style={{
                                  fontSize: 8,
                                  padding: "1px 5px",
                                  borderRadius: 3,
                                  background: isCityExpanded
                                    ? "rgba(56,189,248,0.2)"
                                    : "rgba(148,163,184,0.1)",
                                  color: isCityExpanded ? "var(--signal)" : "var(--text-dim)",
                                  cursor: "pointer",
                                }}
                                title="Toggle Sub-districts & Localities"
                              >
                                {isCityExpanded ? "▾" : "▸"} {citySubdistricts.length}
                              </span>
                            )}

                            {weather && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {weather.rainMmHr > 0 && (
                                  <span
                                    className="mono"
                                    style={{
                                      fontSize: 9.5,
                                      color: weather.rainMmHr >= 40 ? "var(--h-extreme)" : "var(--signal)",
                                    }}
                                  >
                                    {weather.rainMmHr.toFixed(0)} mm/h
                                  </span>
                                )}
                                <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>
                                  {weather.temperatureC.toFixed(0)}°
                                </span>
                              </div>
                            )}
                          </button>

                          {/* Sub-districts & Talukas under this city */}
                          {isCityExpanded && hasSubdistricts && (
                            <div
                              style={{
                                paddingLeft: 34,
                                background: "var(--inset)",
                                borderLeft: "1px dashed var(--hair)",
                              }}
                            >
                              {citySubdistricts
                                .filter(
                                  (sd) =>
                                    !filterQuery ||
                                    sd.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
                                    city.name.toLowerCase().includes(filterQuery.toLowerCase())
                                )
                                .map((sd) => {
                                  const isSdSel = selectedCityId === sd.id;
                                  return (
                                    <button
                                      key={sd.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPickCity(sd.id);
                                      }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        width: "100%",
                                        padding: "4px 8px 4px 10px",
                                        background: isSdSel
                                          ? "rgba(56,189,248,0.22)"
                                          : "transparent",
                                        border: "none",
                                        borderLeft: `2px solid ${
                                          isSdSel ? "var(--signal)" : "transparent"
                                        }`,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        transition: "all 0.12s ease",
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!isSdSel)
                                          e.currentTarget.style.background =
                                            "rgba(56,189,248,0.06)";
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!isSdSel)
                                          e.currentTarget.style.background = "transparent";
                                      }}
                                    >
                                      <Crosshair
                                        size={9}
                                        color={isSdSel ? "#38bdf8" : "#06b6d4"}
                                        style={{ flexShrink: 0 }}
                                      />
                                      <span
                                        style={{
                                          flex: 1,
                                          fontSize: 10.5,
                                          color: isSdSel ? "#38bdf8" : "var(--text-dim)",
                                          fontWeight: isSdSel ? 700 : 500,
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {sd.name}
                                      </span>
                                      <span
                                        className="mono"
                                        style={{
                                          fontSize: 7.5,
                                          color: "var(--text-faint)",
                                          background: "var(--raised)",
                                          padding: "1px 4px",
                                          borderRadius: 3,
                                        }}
                                      >
                                        {sd.type}
                                      </span>
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Collapsible GIS Map Layers Control Drawer ── */}
      <div className="ag-layer-drawer" style={{ borderTop: "1px solid var(--hair)" }}>
        <button
          onClick={() => setLayersExpanded((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "8px 12px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={13} color="var(--signal)" /> Map Overlays &amp; Sensors
          </span>
          <ChevronDown
            size={12}
            style={{
              transform: layersExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.18s",
            }}
          />
        </button>

        {layersExpanded && (
          <div className="scroll" style={{ maxHeight: 180, padding: "6px 12px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {LAYER_DEFS.map((l) => {
              const active = !!layers[l.k];
              return (
                <button
                  key={l.k}
                  onClick={() => onToggleLayer(l.k)}
                  className="btn"
                  data-active={active}
                  style={{
                    padding: "4px 8px",
                    justifyContent: "flex-start",
                    fontSize: 10,
                    borderRadius: 6,
                  }}
                  title={l.hint}
                >
                  {active ? <Eye size={11} color="var(--signal)" /> : <EyeOff size={11} color="var(--text-faint)" />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{l.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

export { HAZ_CLASS, INDIA_BOUNDS };
