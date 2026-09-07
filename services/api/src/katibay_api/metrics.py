"""Metrics, Prometheus exporters, and telemetry for Katibay API."""

import math
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response

from katibay_api.db import DatabaseRepository, PipelineCounters, get_db_repository
from katibay_api.logging import logger

router = APIRouter(tags=["Metrics & Telemetry"])


class MetricsCollector:
    """Collects real-time latency percentiles, error rates, and queue depths."""

    def __init__(self) -> None:
        # Starts empty on purpose. Seeding sample latencies would make a
        # freshly started process report percentiles it never measured.
        self.extraction_latencies_ms: list[float] = []

    def record_extraction_latency(self, latency_ms: float) -> None:
        self.extraction_latencies_ms.append(latency_ms)
        if len(self.extraction_latencies_ms) > 1000:
            self.extraction_latencies_ms = self.extraction_latencies_ms[-1000:]

    def get_percentiles(self) -> tuple[float, float]:
        if not self.extraction_latencies_ms:
            return 0.0, 0.0
        sorted_lat = sorted(self.extraction_latencies_ms)
        n = len(sorted_lat)
        p50_idx = min(n - 1, math.floor(0.50 * n))
        p95_idx = min(n - 1, math.floor(0.95 * n))
        return round(sorted_lat[p50_idx], 2), round(sorted_lat[p95_idx], 2)


metrics_collector = MetricsCollector()


@router.get("/metrics")
async def get_system_metrics(
    db_repo: Annotated[DatabaseRepository, Depends(get_db_repository)],
    format: str = Query("json", description="Output format: 'json' or 'prometheus'"),
) -> Any:
    """Returns real-time pipeline telemetry:

    - Job queue depth
    - Extraction latency percentiles (p50, p95 in ms)
    - Exception rate (exceptions per receipt)
    """
    p50, p95 = metrics_collector.get_percentiles()

    # Counters come from the repository itself. The previous version fell back
    # to invented totals when the repository was not the in-memory one, which
    # meant a real deployment reported numbers nobody measured.
    try:
        counters = await db_repo.get_pipeline_counters()
        healthy = True
    except Exception:
        logger.exception("Failed to read pipeline counters for /metrics")
        counters = PipelineCounters(queue_depth=0, total_receipts=0, total_exceptions=0)
        healthy = False

    queue_depth = counters.queue_depth
    total_receipts = counters.total_receipts
    total_exceptions = counters.total_exceptions
    exception_rate = round(total_exceptions / max(1, total_receipts), 4)

    metrics_data = {
        "job_queue_depth": queue_depth,
        "extraction_latency_p50_ms": p50,
        "extraction_latency_p95_ms": p95,
        "total_receipts_processed": total_receipts,
        "total_exceptions_raised": total_exceptions,
        "exception_rate": exception_rate,
        "status": "healthy" if healthy else "degraded",
    }

    if format == "prometheus":
        prom_lines = [
            "# HELP katibay_job_queue_depth Queued background jobs",
            "# TYPE katibay_job_queue_depth gauge",
            f"katibay_job_queue_depth {queue_depth}",
            "# HELP katibay_extraction_latency_p50_ms Extraction P50 in ms",
            "# TYPE katibay_extraction_latency_p50_ms gauge",
            f"katibay_extraction_latency_p50_ms {p50}",
            "# HELP katibay_extraction_latency_p95_ms Extraction P95 in ms",
            "# TYPE katibay_extraction_latency_p95_ms gauge",
            f"katibay_extraction_latency_p95_ms {p95}",
            "# HELP katibay_exception_rate Exception rate per receipt",
            "# TYPE katibay_exception_rate gauge",
            f"katibay_exception_rate {exception_rate}",
            "# HELP katibay_receipts_total Total receipts ingested",
            "# TYPE katibay_receipts_total counter",
            f"katibay_receipts_total {total_receipts}",
        ]
        return Response(content="\n".join(prom_lines) + "\n", media_type="text/plain")

    return metrics_data
