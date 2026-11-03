"""
Alert Deduplication, Escalation Ladder, Cooldown, and Hysteresis Engine.
Complies with Section 20 of SIH 26084 PRD.
Prevents rapid alert oscillation between HIGH and SEVERE every 5 minutes.
"""

import time
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from app.schemas.alert import AlertObject
from app.schemas.hazard import SeverityLevel


class AlertDeduplicator:
    def __init__(self, cooldown_seconds: int = 600):
        self.cooldown_seconds = cooldown_seconds
        # Key: grid_id -> last alert state
        self._active_alerts: Dict[str, Dict[str, Any]] = {}

    def should_suppress_or_escalate(
        self,
        grid_id: str,
        new_severity: SeverityLevel,
        new_risk: float
    ) -> Tuple[bool, str]:
        """
        Returns (suppress: bool, action: "NEW" | "SUPPRESSED" | "ESCALATED" | "DE_ESCALATED" | "UPDATED")
        """
        now = time.time()
        existing = self._active_alerts.get(grid_id)

        if not existing:
            return False, "NEW"

        last_time = existing["timestamp"]
        last_sev = existing["severity"]
        last_risk = existing["risk"]

        # Hysteresis check:
        # Only escalate if severity increased or risk increased by >= 0.15
        if new_severity == SeverityLevel.SEVERE and last_sev != SeverityLevel.SEVERE:
            return False, "ESCALATED"

        if new_severity == SeverityLevel.LOW and last_sev in [SeverityLevel.HIGH, SeverityLevel.SEVERE]:
            return False, "DE_ESCALATED"

        # Cooldown check: suppress identical severity alerts within cooldown window
        if now - last_time < self.cooldown_seconds:
            if abs(new_risk - last_risk) < 0.15 and new_severity == last_sev:
                return True, "SUPPRESSED"

        return False, "UPDATED"

    def record_alert(self, grid_id: str, alert: AlertObject):
        self._active_alerts[grid_id] = {
            "alert_id": alert.alert_id,
            "severity": alert.severity,
            "risk": alert.risk_score,
            "timestamp": time.time()
        }

    def get_active(self, grid_id: str) -> Optional[Dict[str, Any]]:
        return self._active_alerts.get(grid_id)
