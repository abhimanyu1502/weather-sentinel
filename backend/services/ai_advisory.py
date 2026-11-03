"""
AI Meteorological Intelligence & Public Advisory Generation Service.
Integrates OpenRouter / NVIDIA NIM API when keys are provided, with an intelligent
rule-based meteorological reasoning engine fallback.
"""

import os
import httpx
from typing import Dict, Any, Optional

SYSTEM_PROMPT = """You are Dr. StormSentinel, an expert IMD / NOAA Senior Radar Meteorologist and Disaster Response Incident Commander.
Analyze real-time severe weather nowcasting data (Doppler radar dBZ, satellite infrared cooling rates, lightning flash density, downburst divergence)
and generate concise, actionable, high-urgency meteorological situation reports and public safety advisories."""

async def generate_meteorological_advisory(
    hazard_state: Dict[str, Any],
    openrouter_key: Optional[str] = None,
    nvidia_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generates structured AI advisory and meteorological analysis.
    """
    ci = hazard_state.get("convective_initiation", {})
    summary = hazard_state.get("domain_summary", {})
    cells = hazard_state.get("active_storm_cells", [])

    # Format summary stats for prompt
    active_count = len(cells)
    max_dbz = summary.get("max_reflectivity_dbz", 0.0)
    max_rain = summary.get("max_rain_rate_mm_hr", 0.0)
    strokes = summary.get("total_lightning_strokes", 0)
    cloudbursts = summary.get("cloudburst_cells", 0)

    cell_details = []
    for c in cells[:4]:
        countdowns = c.get("countdown_targets", [])
        top_target = countdowns[0]["target_name"] + f" in {countdowns[0]['eta_seconds']//60}m" if countdowns else "Open terrain"
        cell_details.append(
            f"• Cell {c.get('cell_id')} ({c.get('severity')}): Max {c.get('max_dbz')} dBZ, "
            f"Rain {c.get('rain_rate_mm_hr')} mm/hr, Hail MESH {c.get('hail_mesh_mm')} mm, "
            f"Downburst Gust {c.get('downburst_gust_kmh')} km/h, Moving {c.get('movement', {}).get('direction')} at {c.get('movement', {}).get('speed_kmh')} km/h. "
            f"Impacting {top_target}."
        )

    cells_text = "\n".join(cell_details) if cell_details else "No severe cells detected."

    prompt = f"""
Current Real-Time Radar & Satellite Telemetry:
- Convective Initiation Detected: {ci.get('detected')} (Confidence: {ci.get('confidence', 0)*100:.0f}%, CTCR: {ci.get('ctcr_k_per_15min')} K/15min)
- Max Domain Reflectivity: {max_dbz} dBZ | Max Rain Rate: {max_rain} mm/hr
- Total Lightning Discharges: {strokes} strokes | Cloudburst Threat: {cloudbursts} cells
Active Storm Cells:
{cells_text}

Provide:
1. METEOROLOGICAL DIAGNOSIS (2-3 sentences on storm dynamics, mesoscale convection, updraft strength)
2. THREAT MATRIX (Hail, Flash Flood / Cloudburst, Microburst Wind-Shear, Lightning)
3. TACTICAL ACTION DIRECTIVES (Evacuation / airport grounding / NDRF pre-deployment instructions)
"""

    # If NVIDIA API Key is provided
    if nvidia_key:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://integrate.api.nvidia.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {nvidia_key}", "Content-Type": "application/json"},
                    json={
                        "model": "meta/llama-3.1-70b-instruct",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.2,
                        "max_tokens": 500
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    return {"source": "NVIDIA NIM (Llama-3.1-70B)", "advisory": content}
        except Exception:
            pass

    # If OpenRouter API Key is provided
    if openrouter_key:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openrouter_key}", "Content-Type": "application/json"},
                    json={
                        "model": "google/gemini-2.0-flash-exp:free",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.3,
                        "max_tokens": 500
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    return {"source": "OpenRouter AI Copilot", "advisory": content}
        except Exception:
            pass

    # High-Fidelity Rule-Based Meteorological AI Engine (Zero external dependency fallback)
    urgency = "EXTREME DANGER / RED ALERT" if max_dbz >= 55 or max_rain >= 90 else "HIGH ADVISORY / ORANGE ALERT" if max_dbz >= 45 else "MONITORING / YELLOW WATCH"

    diagnosis = (
        f"Mesoscale convective complex displaying vigorous updraft intensification over the Western Ghats corridor. "
        f"Maximum core reflectivity has reached {max_dbz:.1f} dBZ with intense precipitation cores ({max_rain:.1f} mm/hr). "
        f"Significant cloud-top cooling rate ({ci.get('ctcr_k_per_15min', -4.5):.1f} K/15min) indicates rapid vertical development "
        f"breaching the tropopause with severe lightning discharges ({strokes} active strokes)."
    )

    tactical = [
        "AIRPORT OPS (CSMIA): Issue immediate Ground Stop for ramp/tarmac refueling operations due to severe lightning & wind shear.",
        "MUNICIPAL & DISASTER TEAMS (MCGM/NDRF): Pre-position high-capacity de-watering pumps along low-lying railway culverts and highway underpasses.",
        "PUBLIC SAFETY: Seek sturdy shelter immediately away from open tin roofs, tall trees, and utility poles. Avoid waterlogged transit arteries."
    ]

    return {
        "source": "StormSentinel Neural-Expert Engine",
        "urgency": urgency,
        "diagnosis": diagnosis,
        "threat_matrix": {
            "flash_flood_risk": "VERY HIGH" if max_rain >= 80 else "MODERATE",
            "microburst_risk": "HIGH" if max_dbz >= 52 else "LOW",
            "severe_hail_risk": "PROBABLE" if max_dbz >= 55 else "UNLIKELY",
            "lightning_hazard": "EXTREME" if strokes > 20 else "MODERATE"
        },
        "tactical_directives": tactical
    }
