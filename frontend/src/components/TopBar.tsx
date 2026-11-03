import { useEffect, useMemo, useRef, useState, memo } from "react";
import {
  ChevronDown,
  Columns2,
  Globe2,
  LayoutGrid,
  Map as MapIcon,
  Moon,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  Radio,
  Search,
  Sun,
} from "lucide-react";
import { ZONE_CLUSTERS } from "../data/indiaGeo";
import { CityWeather } from "../lib/weatherEngine";

export type AppViewMode = "2d" | "dashboard" | "split";

interface Props {
  live: boolean;
  updatedAt: string;
  cities: CityWeather[];
  compact: boolean;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  currentView?: AppViewMode;
  onChangeView?: (v: AppViewMode) => void;
  railOpen?: boolean;
  detailOpen?: boolean;
  selectedZoneId?: string | null;
  onOpenSearch: () => void;
  onPickZone: (zoneId: string) => void;
  onToggleRail: () => void;
  onToggleDetail: () => void;
  onToggleLive?: () => void;
}

export const TopBar = memo(function TopBar({
  live,
  updatedAt,
  cities,
  compact,
  theme = "dark",
  onToggleTheme,
  currentView = "2d",
  onChangeView,
  railOpen = true,
  detailOpen = true,
  selectedZoneId,
  onOpenSearch,
  onPickZone,
  onToggleRail,
  onToggleDetail,
  onToggleLive,
}: Props) {
  const [zoneDropdownOpen, setZoneDropdownOpen] = useState(false);
  const zoneDropdownRef = useRef<HTMLDivElement>(null);

  const anomalyCount = useMemo(
    () => cities.filter((c) => c.hazard === "EXTREME" || c.hazard === "SEVERE").length,
    [cities]
  );

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (zoneDropdownRef.current && !zoneDropdownRef.current.contains(event.target as Node)) {
        setZoneDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const activeZoneName = useMemo(
    () => (selectedZoneId ? ZONE_CLUSTERS.find((z) => z.id === selectedZoneId)?.name : "All India") || "All India",
    [selectedZoneId]
  );

  return (
    <header className="ag-topbar" role="banner" aria-label="AntiGravity Mission Control Navigation">
      <div className="ag-topbar-brand">
        <button
          className="btn btn-icon ag-rail-toggle"
          onClick={onToggleRail}
          title={railOpen ? "Hide regional explorer" : "Show regional explorer"}
          aria-label={railOpen ? "Hide regional explorer" : "Show regional explorer"}
          data-active={railOpen}
        >
          <PanelLeft size={17} />
        </button>

        <div className="ag-brand-mark" aria-hidden="true">
          <Radio size={17} />
          <span className={live ? "is-live" : "is-paused"} />
        </div>

        <div className="ag-brand-copy">
          <div className="ag-brand-title-row">
            <span className="ag-brand-name">AntiGravity</span>
            <span className="ag-brand-badge">NOWCAST</span>
          </div>
          <div className="ag-brand-meta">
            <span className={`ag-feed-status ${live ? "is-live" : "is-paused"}`}>
              <span className="ag-feed-dot" /> {live ? "Live feed" : "Paused"}
            </span>
            <span className="ag-meta-separator">·</span>
            <span className="mono">{updatedAt || "UTC 00:00"}</span>
          </div>
        </div>
      </div>

      <div className="ag-topbar-center">
        <button className="ag-search-trigger" onClick={onOpenSearch} aria-label="Search cities and regions, Ctrl+K">
          <span className="ag-search-label">
            <Search size={15} aria-hidden="true" />
            <span>Search cities, states and subdistricts</span>
          </span>
          {anomalyCount > 0 && <span className="ag-search-alert">{anomalyCount} alerts</span>}
          <kbd>Ctrl K</kbd>
        </button>

        {onChangeView && (
          <nav className="ag-view-switcher" role="tablist" aria-label="View switcher">
            <button role="tab" aria-selected={currentView === "2d"} onClick={() => onChangeView("2d")}>
              <MapIcon size={14} aria-hidden="true" /> Map
            </button>
            <button role="tab" aria-selected={currentView === "dashboard"} onClick={() => onChangeView("dashboard")}>
              <LayoutGrid size={14} aria-hidden="true" /> Dashboard
            </button>
            {!compact && (
              <button role="tab" aria-selected={currentView === "split"} onClick={() => onChangeView("split")}>
                <Columns2 size={14} aria-hidden="true" /> Split
              </button>
            )}
          </nav>
        )}
      </div>

      <div className="ag-topbar-actions">
        <div ref={zoneDropdownRef} className="ag-zone-control">
          <button
            className="btn ag-zone-button"
            onClick={() => setZoneDropdownOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={zoneDropdownOpen}
            title="Filter map by region"
          >
            <Globe2 size={14} aria-hidden="true" />
            <span>{activeZoneName}</span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>
          {zoneDropdownOpen && (
            <div className="ag-zone-menu" role="listbox" aria-label="Regions">
              {[{ id: "", name: "All India" }, ...ZONE_CLUSTERS].map((zone) => (
                <button
                  key={zone.id || "all"}
                  role="option"
                  aria-selected={(zone.id || null) === (selectedZoneId || null)}
                  onClick={() => {
                    onPickZone(zone.id);
                    setZoneDropdownOpen(false);
                  }}
                >
                  {zone.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {onToggleTheme && (
          <button
            className="btn btn-icon ag-theme-button"
            onClick={onToggleTheme}
            title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        )}

        {onToggleLive && (
          <button
            className={`btn ag-live-button ${live ? "is-live" : "is-paused"}`}
            onClick={onToggleLive}
            title={live ? "Pause live stream" : "Resume live stream"}
            aria-label={live ? "Pause live stream" : "Resume live stream"}
          >
            {live ? <Pause size={14} /> : <Play size={14} />}
            <span>{live ? "Live" : "Paused"}</span>
          </button>
        )}

        <button
          className="btn btn-icon ag-detail-toggle"
          onClick={onToggleDetail}
          title={detailOpen ? "Hide intelligence panel" : "Show intelligence panel"}
          aria-label={detailOpen ? "Hide intelligence panel" : "Show intelligence panel"}
          data-active={detailOpen}
        >
          <PanelRight size={17} />
        </button>
      </div>
    </header>
  );
});
