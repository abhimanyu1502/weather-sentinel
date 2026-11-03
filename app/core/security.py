"""
Security and authentication utilities for admin endpoints.
"""

from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader
from app.core.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_admin_key(api_key: str = Security(api_key_header)) -> bool:
    """Verifies that the provided X-API-Key matches the configured ADMIN_API_KEY."""
    if not api_key or api_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid or missing administrator API key."
        )
    return True
