"""
Resilience utilities: Exponential backoff, timeout and circuit breakers.
Complies with Section 11 of SIH 26084 PRD.
"""

import asyncio
import time
from typing import Callable, Any, Optional
from loguru import logger


class CircuitBreaker:
    """
    Prevents cascading backend crashes by tripping when external sources fail repeatedly.
    """

    def __init__(self, failure_threshold: int = 4, recovery_timeout: float = 60.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def record_success(self):
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(f"Circuit breaker tripped OPEN after {self.failure_count} failures.")

    def can_attempt(self) -> bool:
        if self.state == "CLOSED":
            return True
        if self.state == "OPEN":
            if time.time() - (self.last_failure_time or 0) > self.recovery_timeout:
                self.state = "HALF_OPEN"
                logger.info("Circuit breaker entered HALF_OPEN state; testing recovery.")
                return True
            return False
        return True  # HALF_OPEN


async def execute_with_retry(
    func: Callable,
    retries: int = 3,
    initial_delay: float = 0.5,
    backoff_factor: float = 2.0,
    circuit_breaker: Optional[CircuitBreaker] = None
) -> Any:
    """
    Executes an async callable with exponential backoff and circuit breaker protection.
    """
    if circuit_breaker and not circuit_breaker.can_attempt():
        raise RuntimeError("Circuit breaker is OPEN. Request aborted.")

    delay = initial_delay
    last_exception = None

    for attempt in range(1, retries + 1):
        try:
            result = await func()
            if circuit_breaker:
                circuit_breaker.record_success()
            return result
        except Exception as e:
            last_exception = e
            logger.warning(f"Attempt {attempt}/{retries} failed: {e}. Retrying in {delay:.2f}s...")
            if attempt < retries:
                await asyncio.sleep(delay)
                delay *= backoff_factor

    if circuit_breaker:
        circuit_breaker.record_failure()
    raise last_exception
