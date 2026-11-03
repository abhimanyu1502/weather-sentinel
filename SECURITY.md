# Weather Sentinel — Security Policy & Guidelines

### 1. Threat Model & Controls

- **Zero Secrets in Source Control:** API keys and credentials are strictly retrieved via environment variables or `.env` through Pydantic Settings.
- **Admin Endpoint Authentication:** All administrative endpoints (`/api/v1/admin/*`) enforce token verification using the `X-API-Key` HTTP header.
- **Input Sanitization & Bounds Checking:** Geographic coordinates are validated within $[-90, 90]$ latitude and $[-180, 180]$ longitude. Physical bounds reject corrupted or malicious inputs.
- **CORS Protection:** Cross-Origin Resource Sharing is configurable via `settings.py` for trusted production domains.
- **Circuit Breaker Isolation:** External API failures or volumetric rate limits are automatically caught by the circuit breaker to prevent denial-of-service loops.
- **NDMA CAP Alert Integrity:** Common Alerting Protocol (CAP-CP v1.2) XML feeds are structurally verified against OASIS standards before dispatch.

---

### 2. Reporting Vulnerabilities

If you discover any security vulnerabilities within Weather Sentinel, please do not open a public issue. Instead, report it directly to:

- **Security Lead:** Abhimanyu Tiwari
- **Email:** abhimanyutiwari1502@gmail.com
- Or create a private Security Advisory on the GitHub repository.
