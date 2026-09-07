"""Report rendering engine using Jinja2 and WeasyPrint."""

import logging
import re
from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import jinja2

from katibay_api.reports.models import (
    CategoryReportItem,
    LedgerReportItem,
    ReportSignatures,
)
from katibay_api.verification.translations import format_centavos_peso

logger = logging.getLogger("katibay_api.reports.renderer")

TEMPLATES_DIR = Path(__file__).parent / "templates"

jinja_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=jinja2.select_autoescape(["html", "xml"]),
)


def build_report_context(
    activity: dict[str, Any],
    budget_lines: Sequence[dict[str, Any]],
    ledger_entries_raw: Sequence[dict[str, Any]],
    signatures: ReportSignatures | None = None,
    org_name: str | None = None,
) -> dict[str, Any]:
    """Strictly computes all metrics from ledger_entries in integer centavos."""
    sigs = signatures or ReportSignatures()

    # 1. Transform raw ledger rows into LedgerReportItems
    ledger_items: list[LedgerReportItem] = []
    actual_by_category: dict[str, int] = defaultdict(int)

    for entry in ledger_entries_raw:
        amt = entry.get("amount", 0)
        cat = entry.get("category") or "General"
        actual_by_category[cat] += amt

        ledger_items.append(
            LedgerReportItem(
                id=entry["id"],
                receipt_id=entry["receipt_id"],
                txn_date=(
                    str(entry.get("txn_date")) if entry.get("txn_date") else None
                ),
                or_number=entry.get("or_number"),
                merchant_name=entry.get("merchant_name"),
                merchant_tin=entry.get("merchant_tin"),
                category=cat,
                amount=amt,
                amount_formatted=format_centavos_peso(amt),
                confidence=entry.get("confidence", 1.0),
                storage_path=entry.get("storage_path", ""),
                sha256=entry.get("sha256", ""),
            )
        )

    # 2. Build Category Summary
    category_summary: list[CategoryReportItem] = []
    processed_cats: set[str] = set()

    for bl in budget_lines:
        cat = bl["category"]
        processed_cats.add(cat.lower())
        approved = bl["approved_amount"]
        actual = actual_by_category.get(cat, 0)
        if actual == 0:
            for exp_cat, exp_amt in actual_by_category.items():
                if (
                    exp_cat.lower() == cat.lower()
                    and exp_cat.lower() not in processed_cats
                ):
                    actual = exp_amt
                    processed_cats.add(exp_cat.lower())
                    break

        variance = approved - actual
        is_over = actual > approved
        utilization = (
            (actual / approved * 100.0)
            if approved > 0
            else (100.0 if actual > 0 else 0.0)
        )
        progress_width = min(100.0, utilization)

        category_summary.append(
            CategoryReportItem(
                category=cat,
                approved_amount=approved,
                actual_amount=actual,
                variance=variance,
                is_over_budget=is_over,
                utilization_pct=round(utilization, 1),
                progress_width=round(progress_width, 1),
                approved_formatted=format_centavos_peso(approved),
                actual_formatted=format_centavos_peso(actual),
                variance_formatted=format_centavos_peso(abs(variance)),
            )
        )

    # Handle unbudgeted categories
    for exp_cat, exp_amt in actual_by_category.items():
        if exp_cat.lower() not in processed_cats:
            category_summary.append(
                CategoryReportItem(
                    category=exp_cat,
                    approved_amount=0,
                    actual_amount=exp_amt,
                    variance=-exp_amt,
                    is_over_budget=True,
                    utilization_pct=100.0,
                    progress_width=100.0,
                    approved_formatted="0.00",
                    actual_formatted=format_centavos_peso(exp_amt),
                    variance_formatted=format_centavos_peso(exp_amt),
                )
            )

    # 3. Aggregate totals
    cash_advance = activity.get("cash_advance_amount", 0)
    total_approved = sum(c.approved_amount for c in category_summary)
    total_spend = sum(c.actual_amount for c in category_summary)
    net_balance = cash_advance - total_spend
    total_variance = total_approved - total_spend
    is_over_budget = total_spend > total_approved
    overall_utilization = (
        (total_spend / total_approved * 100.0)
        if total_approved > 0
        else (100.0 if total_spend > 0 else 0.0)
    )

    # 4. Grouped categories for Expense Summary
    category_groups_map: dict[str, list[LedgerReportItem]] = defaultdict(list)
    for item in ledger_items:
        category_groups_map[item.category].append(item)

    category_groups = []
    for cat_name, entries in category_groups_map.items():
        subtotal = sum(i.amount for i in entries)
        category_groups.append(
            {
                "category": cat_name,
                "entries": entries,
                "subtotal": subtotal,
                "subtotal_formatted": format_centavos_peso(subtotal),
            }
        )

    return {
        "org_name": org_name or "Katibay Student Organization",
        "activity": activity,
        "generated_date": datetime.now(UTC).strftime("%B %d, %Y"),
        "cash_advance_formatted": format_centavos_peso(cash_advance),
        "total_approved_formatted": format_centavos_peso(total_approved),
        "total_spend_formatted": format_centavos_peso(total_spend),
        "net_balance": net_balance,
        "net_balance_formatted": format_centavos_peso(abs(net_balance)),
        "total_variance": total_variance,
        "total_variance_formatted": format_centavos_peso(abs(total_variance)),
        "is_over_budget": is_over_budget,
        "overall_utilization_pct": round(overall_utilization, 1),
        "category_summary": category_summary,
        "category_groups": category_groups,
        "ledger_entries": ledger_items,
        "signatures": sigs,
    }


def render_report_html(template_name: str, context: dict[str, Any]) -> str:
    """Renders a Jinja2 template with context to HTML string."""
    template = jinja_env.get_template(template_name)
    return template.render(**context)


def render_html_to_pdf(html_content: str) -> bytes:
    """Renders HTML content to PDF bytes using WeasyPrint with fallback."""
    try:
        from weasyprint import HTML

        html = HTML(string=html_content)
        return html.write_pdf()
    except (ImportError, OSError) as exc:
        logger.warning(
            "WeasyPrint native libraries unavailable (%s), using PDF fallback.",
            exc,
        )
        return _generate_fallback_pdf(html_content)


def _generate_fallback_pdf(html_content: str) -> bytes:
    """Generates standard PDF-1.4 document bytes from HTML text."""
    clean_text = re.sub(r"<style[^>]*>.*?</style>", "", html_content, flags=re.DOTALL)
    clean_text = re.sub(r"<[^>]+>", " ", clean_text)
    clean_text = " ".join(clean_text.split())
    clean_text = clean_text.replace("(", "\\(").replace(")", "\\)")
    if len(clean_text) > 400:
        clean_text = clean_text[:400] + "..."

    content = f"BT /F1 10 Tf 50 750 Td ({clean_text}) Tj ET"
    stream_bytes = content.encode("latin-1", "ignore")
    stream_len = len(stream_bytes)

    pdf_data = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
        b"4 0 obj\n<< /Length "
        + str(stream_len).encode("ascii")
        + b" >>\nstream\n"
        + stream_bytes
        + b"\nendstream\nendobj\n"
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
        b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n"
        b"0000000115 00000 n \n0000000244 00000 n \n0000000340 00000 n \n"
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n435\n%%EOF\n"
    )
    return pdf_data
