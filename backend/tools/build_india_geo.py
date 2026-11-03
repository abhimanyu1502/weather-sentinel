#!/usr/bin/env python3
"""
build_india_geo.py — Generate official Survey of India boundary assets for StormSentinel.

Input : Survey of India–derived India state GeoJSON (`india_states_soi.geojson`).
        Follows the official Government of India / Survey of India political boundary
        including full Jammu & Kashmir (up to 37.08° N), Ladakh, Aksai Chin,
        Arunachal Pradesh (McMahon Line), and island territories.

Output (written into frontend/public/geo/ and frontend/dist/geo/ if present):
  - india-outline.geojson        national landmass MultiPolygon (fill + crisp border)
  - india-states.geojson         simplified state/UT polygons (interior borders)
  - india-state-labels.geojson   label Point features for the map label layer
  - bounds.json                  computed national bounding box (for fitBounds)
"""

import json
import math
import os
import shutil
import sys

from shapely.geometry import MultiPolygon, Point, shape, mapping
from shapely.ops import unary_union

NAME_MAP = {
    "Andaman & Nicobar Island": ("Andaman & Nicobar Islands", "Islands"),
    "Andhra Pradesh": ("Andhra Pradesh", "South"),
    "Arunanchal Pradesh": ("Arunachal Pradesh", "Northeast"),
    "Assam": ("Assam", "Northeast"),
    "Bihar": ("Bihar", "East"),
    "Chandigarh": ("Chandigarh", "North"),
    "Chhattisgarh": ("Chhattisgarh", "Central"),
    "Dadara & Nagar Havelli": ("Dadra & Nagar Haveli", "West"),
    "Daman & Diu": ("Daman & Diu", "West"),
    "Goa": ("Goa", "West"),
    "Gujarat": ("Gujarat", "West"),
    "Haryana": ("Haryana", "North"),
    "Himachal Pradesh": ("Himachal Pradesh", "North"),
    "Jammu & Kashmir": ("Jammu & Kashmir", "North"),
    "Jharkhand": ("Jharkhand", "East"),
    "Karnataka": ("Karnataka", "South"),
    "Kerala": ("Kerala", "South"),
    "Lakshadweep": ("Lakshadweep", "Islands"),
    "Madhya Pradesh": ("Madhya Pradesh", "Central"),
    "Maharashtra": ("Maharashtra", "West"),
    "Manipur": ("Manipur", "Northeast"),
    "Meghalaya": ("Meghalaya", "Northeast"),
    "Mizoram": ("Mizoram", "Northeast"),
    "Nagaland": ("Nagaland", "Northeast"),
    "NCT of Delhi": ("NCT Delhi", "North"),
    "Puducherry": ("Puducherry", "South"),
    "Punjab": ("Punjab", "North"),
    "Rajasthan": ("Rajasthan", "North"),
    "Sikkim": ("Sikkim", "Northeast"),
    "Tamil Nadu": ("Tamil Nadu", "South"),
    "Telangana": ("Telangana", "Central"),
    "Tripura": ("Tripura", "Northeast"),
    "Uttar Pradesh": ("Uttar Pradesh", "North"),
    "Uttarakhand": ("Uttarakhand", "North"),
    "West Bengal": ("West Bengal", "East"),
    "Odisha": ("Odisha", "East"),
}

DEG_KM = 111.32


def deg2_km2(deg_area, lat_c):
    return deg_area * (DEG_KM * math.cos(math.radians(lat_c))) * DEG_KM


def geom_km2(geom):
    total = 0.0
    polys = [geom] if isinstance(geom, MultiPolygon) is False and hasattr(geom, "exterior") else list(geom.geoms)
    for poly in polys:
        c = poly.centroid.y
        total += deg2_km2(poly.area, c)
    return total


def geom_km(geom):
    polys = [geom] if hasattr(geom, "exterior") else list(geom.geoms)
    total = 0.0
    for poly in polys:
        c = poly.centroid.y
        total += poly.length * DEG_KM * math.cos(math.radians(c))
    return total


def to_multipolygon(geom):
    if hasattr(geom, "exterior"):
        return MultiPolygon([geom])
    return MultiPolygon(list(geom.geoms))


def dump_rounded(geom, nd=4):
    g = mapping(geom)

    def rnd(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [rnd(x) for x in c]

    g["coordinates"] = rnd(g["coordinates"])
    return g


def main(src_path=None, frontend_root=None):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if not src_path:
        src_path = os.path.join(base_dir, "data", "geo", "india_states_soi.geojson")
    if not frontend_root:
        frontend_root = os.path.join(base_dir, "frontend")

    print(f"Reading official Survey of India boundaries from: {src_path}", flush=True)
    with open(src_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data["features"]
    print(f"Loaded {len(features)} state/UT features", flush=True)

    state_polys = []
    for f in features:
        st_raw = f["properties"].get("ST_NM") or f["properties"].get("NAME_1", "Unknown")
        name, zone = NAME_MAP.get(st_raw, (st_raw, "North"))
        g = shape(f["geometry"])
        if not g.is_valid:
            g = g.buffer(0)
        state_polys.append((name, zone, to_multipolygon(g)))

    # 1. Exact national landmass union
    union = to_multipolygon(unary_union([p for _, _, p in state_polys]))
    union_area = geom_km2(union)
    minx, miny, maxx, maxy = union.bounds
    bbox = [round(minx, 3), round(miny, 3), round(maxx, 3), round(maxy, 3)]
    print(f"Official Survey of India Union bounds: {bbox}", flush=True)
    print(f"Union contains {len(union.geoms)} polygons, estimated area: {union_area:,.0f} km2", flush=True)

    # 2. Outline simplification (0.010° ~1.1 km preserves coastlines & northern crown)
    outline = to_multipolygon(union.simplify(0.010, preserve_topology=True))
    out_verts = sum(
        len(poly.exterior.coords) + sum(len(h.coords) for h in poly.interiors)
        for poly in outline.geoms
    )
    print(f"Simplified outline: {len(outline.geoms)} polygons, {out_verts:,} vertices", flush=True)

    outline_fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "India"},
                "geometry": dump_rounded(outline, 4),
            }
        ],
    }

    # 3. Simplify state polygons + compute label anchor points
    state_features = []
    label_features = []
    for name, zone, poly in state_polys:
        simp = to_multipolygon(poly.simplify(0.020, preserve_topology=True))
        keep = [p for p in simp.geoms if p.area > 0.0001]
        if not keep:
            keep = list(simp.geoms)
        state_features.append(
            {
                "type": "Feature",
                "properties": {"name": name, "zone": zone},
                "geometry": dump_rounded(MultiPolygon(keep), 4),
            }
        )
        biggest = max(keep, key=lambda p: p.area)
        lp = biggest.representative_point()
        label_features.append(
            {
                "type": "Feature",
                "properties": {"name": name, "zone": zone},
                "geometry": {"type": "Point", "coordinates": [round(lp.x, 4), round(lp.y, 4)]},
            }
        )

    states_fc = {"type": "FeatureCollection", "features": state_features}
    labels_fc = {"type": "FeatureCollection", "features": label_features}

    targets = [os.path.join(frontend_root, "public", "geo")]
    dist_geo = os.path.join(frontend_root, "dist", "geo")
    if os.path.exists(os.path.join(frontend_root, "dist")):
        targets.append(dist_geo)

    for geo_dir in targets:
        os.makedirs(geo_dir, exist_ok=True)
        for fname, fc in [
            ("india-outline.geojson", outline_fc),
            ("india-states.geojson", states_fc),
            ("india-state-labels.geojson", labels_fc),
        ]:
            p = os.path.join(geo_dir, fname)
            with open(p, "w", encoding="utf-8") as fh:
                json.dump(fc, fh, separators=(",", ":"))
            print(f"Wrote {p} ({os.path.getsize(p) // 1024} KB)", flush=True)

        bounds_path = os.path.join(geo_dir, "bounds.json")
        with open(bounds_path, "w", encoding="utf-8") as fh:
            json.dump(
                {
                    "bbox": bbox,
                    "outline_km": round(geom_km(outline)),
                    "vertices": out_verts,
                    "source": "Survey of India Official Political Map (Complete J&K, Ladakh, Arunachal)",
                },
                fh,
                indent=2,
            )
        print(f"Wrote {bounds_path}", flush=True)


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else None
    dest = sys.argv[2] if len(sys.argv) > 2 else None
    main(src, dest)
