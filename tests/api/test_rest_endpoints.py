"""
API Integration Tests for Master PRD and Frontend Endpoints.
Complies with Section 24 and Section 44 of SIH 26084 PRD.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app, initialize_providers


@pytest.fixture(autouse=True)
def setup_test_providers():
    initialize_providers()


@pytest.mark.asyncio
async def test_health_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r1 = await ac.get("/health")
        assert r1.status_code == 200
        assert r1.json()["status"] == "healthy"

        r2 = await ac.get("/health/providers")
        assert r2.status_code == 200
        assert "providers" in r2.json()


@pytest.mark.asyncio
async def test_weather_and_forecast_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Current weather
        r1 = await ac.get("/api/v1/weather/current?lat=28.61&lon=77.21")
        assert r1.status_code == 200
        data1 = r1.json()
        assert "observation" in data1
        assert "mode" in data1

        # 2. 0-6h forecast
        r2 = await ac.get("/api/v1/forecast?lat=28.61&lon=77.21")
        assert r2.status_code == 200
        data2 = r2.json()
        assert len(data2["predictions"]) == 7
        assert data2["horizon_hours"] == 6

        # 3. Hazards
        r3 = await ac.get("/api/v1/hazards?lat=28.61&lon=77.21")
        assert r3.status_code == 200
        assert "thunderstorm" in r3.json()
        assert "cloudburst" in r3.json()

        # 4. Specific hazard
        r4 = await ac.get("/api/v1/hazards/thunderstorm?lat=28.61&lon=77.21")
        assert r4.status_code == 200
        assert r4.json()["hazard"] == "thunderstorm"

        # 5. Risk map
        r5 = await ac.get("/api/v1/risk-map")
        assert r5.status_code == 200
        assert r5.json()["type"] == "FeatureCollection"


@pytest.mark.asyncio
async def test_alerts_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Trigger test alert
        r_test = await ac.post("/api/v1/alerts/test?hazard=thunderstorm&severity=SEVERE&lead_time_minutes=300")
        assert r_test.status_code == 200
        assert r_test.json()["status"] == "TEST_ALERT_ISSUED"

        # Retrieve alerts
        r_list = await ac.get("/api/v1/alerts")
        assert r_list.status_code == 200
        assert r_list.json()["count"] >= 1


@pytest.mark.asyncio
async def test_frontend_compatibility_endpoints():
    """
    CRITICAL: Verifies that existing frontend endpoints remain 100% operational
    without needing any changes to the frontend.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Landmarks
        r_lm = await ac.get("/api/landmarks")
        assert r_lm.status_code == 200
        assert "landmarks" in r_lm.json()

        # 2. Regions
        r_reg = await ac.get("/api/regions")
        assert r_reg.status_code == 200
        assert "regions" in r_reg.json()

        # 3. Dashboard summary
        r_dash = await ac.get("/api/dashboard/summary")
        assert r_dash.status_code == 200
        assert "sensor_health" in r_dash.json()

        # 4. CAP-CP XML
        r_cap = await ac.get("/api/alerts/cap")
        assert r_cap.status_code == 200
        assert "alert" in r_cap.text.lower()
