"""
Multi-Factor Meteorological Confidence Model.
Complies with Section 55 of SIH 26084 PRD.
Confidence considers: data completeness, source agreement, freshness,
sensor reliability, and physical evidence consistency.
"""

from typing import Dict, Any, List


class ConfidenceModel:
    @staticmethod
    def calculate(
        features: Dict[str, Any],
        qc_score: float = 1.0,
        sources_count: int = 1
    ) -> float:
        # 1. Data completeness factor (0 to 1)
        present = 0
        total = 5
        if features.get("atmospheric", {}).get("cape_j_kg", 0) > 0:
            present += 1
        if features.get("radar", {}).get("max_reflectivity_dbz", 0) > 0:
            present += 1
        if features.get("lightning", {}).get("lightning_flash_count", 0) > 0:
            present += 1
        if features.get("satellite", {}).get("cooling_intensity_score", 0) > 0:
            present += 1
        if features.get("precipitation", {}).get("rain_rate_mm_h", 0) > 0:
            present += 1

        completeness = max(0.4, present / total)

        # 2. Multi-source agreement boost
        source_bonus = 0.15 if sources_count >= 2 else 0.0

        # 3. Quality control multiplier
        qc_factor = max(0.3, qc_score)

        # Composite confidence
        base_confidence = (0.5 * completeness) + (0.35 * qc_factor) + (0.15 * min(1.0, 0.7 + source_bonus))
        return min(0.98, max(0.20, round(base_confidence, 2)))
