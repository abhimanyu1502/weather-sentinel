"""
WarningEngine — Core Early Warning Decision & Dispatch Engine.
Complies with Section 20, 21, and Section 43 of SIH 26084 PRD.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import uuid
from loguru import logger
from app.schemas.forecast import SixHourForecast
from app.schemas.alert import AlertObject, AlertHistoryItem
from app.schemas.hazard import HazardType, SeverityLevel
from app.alerts.rules import WarningRules
from app.alerts.deduplication import AlertDeduplicator
from app.alerts.channels.channels import WebhookChannel, EmailChannel, SMSChannel, CapXmlBuilder
from app.core.config import settings


class WarningEngine:
    """
    Maintains active alert state, verifies lead time constraints,
    applies hysteresis, and emits multi-channel early warnings.
    """

    def __init__(self):
        self.deduplicator = AlertDeduplicator(cooldown_seconds=600)
        self.alert_history: List[AlertHistoryItem] = []
        self.channels = [
            WebhookChannel(webhook_url=settings.ALERT_WEBHOOK_URL),
            EmailChannel(smtp_host=settings.SMTP_HOST),
            SMSChannel()
        ]

    async def evaluate_forecast(
        self,
        forecast: SixHourForecast,
        location_meta: Optional[Dict[str, Any]] = None
    ) -> Optional[AlertObject]:
        should_warn, warning_type, reasons = WarningRules.should_issue_warning(forecast)
        if not should_warn:
            return None

        # Check deduplication and hysteresis
        suppress, action = self.deduplicator.should_suppress_or_escalate(
            forecast.grid_id,
            forecast.peak_severity,
            forecast.peak_risk_score
        )
        if suppress:
            logger.info(f"Alert suppressed by cooldown/hysteresis for {forecast.grid_id} (action={action})")
            return None

        now = datetime.now(timezone.utc)
        alert_seq = len(self.alert_history) + 1
        alert_id = f"ALT-2026-{alert_seq:06d}"

        lead_min = forecast.lead_time_minutes if forecast.lead_time_minutes is not None else 0
        lead_hr = forecast.lead_time_hours if forecast.lead_time_hours is not None else round(lead_min / 60.0, 1)
        event_start = forecast.event_start_estimate or now.isoformat()

        hazard = forecast.primary_hazard or HazardType.THUNDERSTORM

        loc_data = {
            "grid_id": forecast.grid_id,
            "lat": forecast.latitude,
            "lon": forecast.longitude,
            "name": location_meta.get("name", "Monitored Convective Sector") if location_meta else "Sector",
            "state": location_meta.get("state", "Pan-India") if location_meta else "India"
        }

        # Select recommended actions
        actions = []
        if hazard == HazardType.CLOUDBURST:
            actions = [
                "Evacuate vulnerable riverbanks, nullahs, and low-lying basements immediately.",
                "Activate local municipal drainage pumps and flood gates.",
                "Halt vehicular transit along known waterlogging flash corridors."
            ]
        elif hazard == HazardType.HAIL:
            actions = [
                "Move under reinforced concrete shelter immediately.",
                "Park vehicles under solid overhead covering; secure glass facades.",
                "Protect agricultural crops with anti-hail nets where deployed."
            ]
        else:
            actions = [
                "Move indoors to a sturdy building; stay away from windows and doors.",
                "Avoid open grounds, tall solitary trees, and metal fencing.",
                "Disconnect non-essential sensitive electrical equipment."
            ]

        alert = AlertObject(
            alert_id=alert_id,
            hazard=hazard,
            severity=forecast.peak_severity,
            issued_at=now.isoformat(),
            event_start=event_start,
            lead_time_minutes=lead_min,
            lead_time_hours=lead_hr,
            confidence=forecast.confidence,
            risk_score=forecast.peak_risk_score,
            affected_area=loc_data,
            reasons=reasons,
            recommended_actions=actions,
            status="ACTIVE"
        )

        # Dispatch across all channels
        dispatch_status = {}
        for channel in self.channels:
            ch_name = channel.__class__.__name__
            try:
                ok = await channel.send(alert)
                dispatch_status[ch_name] = "DELIVERED" if ok else "FAILED"
            except Exception as e:
                dispatch_status[ch_name] = f"ERROR: {e}"

        # Record in state & history
        self.deduplicator.record_alert(forecast.grid_id, alert)
        self.alert_history.append(AlertHistoryItem(
            alert=alert,
            sent_channels=list(dispatch_status.keys()),
            delivery_status=dispatch_status,
            created_at=now.isoformat()
        ))

        logger.info(f"🚨 Issued early warning {alert.alert_id} for {forecast.grid_id} (Lead Time: {lead_min}m, Severity: {alert.severity})")
        return alert

    def get_recent_alerts(self, limit: int = 50) -> List[AlertObject]:
        return [item.alert for item in reversed(self.alert_history[-limit:])]

    def get_alert_by_id(self, alert_id: str) -> Optional[AlertObject]:
        for item in self.alert_history:
            if item.alert.alert_id == alert_id:
                return item.alert
        return None


warning_engine = WarningEngine()
