"""
Tests for Alert Deduplication and Hysteresis.
Complies with Section 20 of SIH 26084 PRD.
"""

from app.alerts.deduplication import AlertDeduplicator
from app.schemas.hazard import SeverityLevel


def test_alert_deduplication_and_cooldown():
    dedup = AlertDeduplicator(cooldown_seconds=300)
    grid_id = "GRID-TEST-COOLDOWN"

    # 1. First alert should not be suppressed
    suppress, action = dedup.should_suppress_or_escalate(grid_id, SeverityLevel.HIGH, 0.65)
    assert suppress is False
    assert action == "NEW"

    # Simulate recording
    class DummyAlert:
        alert_id = "ALT-001"
        severity = SeverityLevel.HIGH
        risk_score = 0.65

    dedup.record_alert(grid_id, DummyAlert())

    # 2. Duplicate alert with identical severity within cooldown should be SUPPRESSED
    suppress2, action2 = dedup.should_suppress_or_escalate(grid_id, SeverityLevel.HIGH, 0.68)
    assert suppress2 is True
    assert action2 == "SUPPRESSED"

    # 3. Escalation to SEVERE breaks cooldown and is emitted
    suppress3, action3 = dedup.should_suppress_or_escalate(grid_id, SeverityLevel.SEVERE, 0.92)
    assert suppress3 is False
    assert action3 == "ESCALATED"
