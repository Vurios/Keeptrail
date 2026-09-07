"""Claim Packet generator for Katibay Passports."""

import hashlib
import logging
from typing import Any

from katibay_api.reports.renderer import jinja_env, render_html_to_pdf

logger = logging.getLogger("katibay_api.reports.claim_packet")


def generate_claim_packet_pdf(
    passport: dict[str, Any],
    claim: dict[str, Any],
) -> tuple[bytes, str]:
    """Renders the official warranty claim packet PDF with SHA-256.


    Args:
        passport: Passport dictionary with item, serial, purchase, and warranty details.
        claim: Claim dictionary with fault_description, opened_at, and claim ID.

    Returns:
        tuple of (pdf_bytes, sha256_hash_hex)
    """
    template = jinja_env.get_template("claim_packet.html")
    html_rendered = template.render(
        passport=passport,
        claim=claim,
    )

    pdf_bytes = render_html_to_pdf(html_rendered)
    sha256_hash = hashlib.sha256(pdf_bytes).hexdigest()

    return pdf_bytes, sha256_hash
