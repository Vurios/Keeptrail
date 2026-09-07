"""Bilingual (English / Filipino) exception questions and translation keys."""

from typing import Any


def format_centavos_peso(centavos: int | None) -> str:
    """Formats integer centavos into a formatted Philippine Peso string."""
    if centavos is None:
        return "0.00"
    pesos = centavos / 100.0
    return f"{pesos:,.2f}"


def get_question(
    key: str,
    params: dict[str, Any] | None = None,
) -> tuple[str, dict[str, str]]:
    """Returns (english_question, {"en": english_q, "fil": filipino_q})."""
    p = params or {}

    templates = {
        "arith_mismatch_line_items": {
            "en": (
                f"The line items sum to ₱{p.get('line_sum', '0.00')}, but the "
                f"subtotal is ₱{p.get('subtotal', '0.00')}. "
                f"Which amount is correct?"
            ),
            "fil": (
                f"Ang kabuuan ng mga item ay ₱{p.get('line_sum', '0.00')}, "
                f"ngunit ang subtotal ay ₱{p.get('subtotal', '0.00')}. "
                f"Aling halaga ang tama?"
            ),
        },
        "arith_mismatch_total": {
            "en": (
                f"The subtotal (₱{p.get('subtotal', '0.00')}) plus VAT "
                f"(₱{p.get('vat', '0.00')}) equals "
                f"₱{p.get('computed_total', '0.00')}, but the receipt total "
                f"shows ₱{p.get('total', '0.00')}. Which total amount is correct?"
            ),
            "fil": (
                f"Ang subtotal (₱{p.get('subtotal', '0.00')}) at VAT "
                f"(₱{p.get('vat', '0.00')}) ay "
                f"₱{p.get('computed_total', '0.00')}, ngunit ang kabuuang "
                f"resibo ay ₱{p.get('total', '0.00')}. Alin ang tamang kabuuan?"
            ),
        },
        "arith_mismatch_vat": {
            "en": (
                f"The extracted VAT (₱{p.get('vat', '0.00')}) does not match "
                f"the 12% standard rate (expected "
                f"~₱{p.get('expected_vat', '0.00')}). Is this item "
                f"VAT-exempt or discounted?"
            ),
            "fil": (
                f"Ang VAT (₱{p.get('vat', '0.00')}) ay hindi tumutugma sa 12% "
                f"karaniwang rate (inaasahan "
                f"~₱{p.get('expected_vat', '0.00')}). Ito ba ay VAT-exempt "
                f"o may espesyal na diskwento?"
            ),
        },
        "out_of_period_window": {
            "en": (
                f"The transaction date ({p.get('txn_date', 'N/A')}) falls "
                f"outside the activity period ({p.get('start_date', 'N/A')} to "
                f"{p.get('end_date', 'N/A')}). "
                f"Was this expense incurred for this activity?"
            ),
            "fil": (
                f"Ang petsa ng transaksyon ({p.get('txn_date', 'N/A')}) ay "
                f"nasa labas ng panahon ng aktibidad "
                f"({p.get('start_date', 'N/A')} hanggang "
                f"{p.get('end_date', 'N/A')}). Para ba ito sa aktibidad na ito?"
            ),
        },
        "out_of_period_future": {
            "en": (
                f"The transaction date ({p.get('txn_date', 'N/A')}) is in the "
                f"future. What was the actual date of purchase?"
            ),
            "fil": (
                f"Ang petsa ng transaksyon ({p.get('txn_date', 'N/A')}) ay "
                f"nasa hinaharap. Ano ang totoong petsa ng pagbili?"
            ),
        },
        "missing_doc_or_number": {
            "en": (
                "The Official Receipt (OR) or Sales Invoice number is missing "
                "or unreadable. What is the official reference number?"
            ),
            "fil": (
                "Nawawala o hindi mabasa ang numero ng Opisyal na Resibo (OR) "
                "o Sales Invoice. Ano ang opisyal na reference number nito?"
            ),
        },
        "low_confidence": {
            "en": (
                f"The extraction confidence ({p.get('confidence_pct', '0%')}) "
                f"is below the automated threshold. "
                f"Please review the extracted receipt fields."
            ),
            "fil": (
                f"Ang kumpiyansa sa pagbasa ({p.get('confidence_pct', '0%')}) "
                f"ay mas mababa sa inaasahan. "
                f"Pakisuri ang mga nakuhang datos sa resibo."
            ),
        },
    }

    entry = templates.get(
        key,
        {
            "en": "Please review and confirm this receipt exception.",
            "fil": "Pakisuri at kumpirmahin ang exception na ito sa resibo.",
        },
    )
    return entry["en"], entry
