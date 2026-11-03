/**
 * regionMapping.ts — Bidirectional mapping between frontend macro-zones
 * and backend radar domains.
 *
 * Solves PRD Gap F7.
 */

export interface RadarRegionMapping {
  zoneId: string;
  backendRegionId: string;
  zoneName: string;
  backendName: string;
}

export const ZONE_TO_BACKEND_MAP: Record<string, string> = {
  WEST: "WEST_INDIA",
  NORTH: "NORTH_INDIA",
  SOUTH: "SOUTH_INDIA",
  EAST: "EAST_INDIA",
  NORTHEAST: "NORTHEAST",
  CENTRAL: "WEST_INDIA", // Or ALL_INDIA
  ISLANDS: "ALL_INDIA",
};

export const BACKEND_TO_ZONE_MAP: Record<string, string> = {
  WEST_INDIA: "WEST",
  NORTH_INDIA: "NORTH",
  SOUTH_INDIA: "SOUTH",
  EAST_INDIA: "EAST",
  NORTHEAST: "NORTHEAST",
  NORTHWEST: "NORTH",
  ALL_INDIA: "ALL",
};

export function getBackendRegionId(zoneId: string | null): string {
  if (!zoneId) return "ALL_INDIA";
  return ZONE_TO_BACKEND_MAP[zoneId.toUpperCase()] || "ALL_INDIA";
}
