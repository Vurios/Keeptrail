"""Helper utilities for generating test receipts and PDFs."""

import io

import cv2
import numpy as np
from PIL import Image

DEFAULT_TEST_RECEIPT_TEXT = (
    "7-ELEVEN PHILIPPINES\nTOTAL: PHP 150.00\nTIN: 000-111-222-000\nOR#: 98765"
)


def create_synthetic_receipt(
    text: str = DEFAULT_TEST_RECEIPT_TEXT,
    rotation_angle_deg: float = 0.0,
    width: int = 800,
    height: int = 1200,
    contrast_offset: int = 0,
) -> bytes:
    """Generates a synthetic receipt image for testing."""
    img = np.full((height, width, 3), 245 + contrast_offset, dtype=np.uint8)

    # Draw receipt header and lines
    lines = text.split("\n")
    y = 120
    for line in lines:
        cv2.putText(
            img,
            line,
            (60, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (20, 20, 20),
            2,
            cv2.LINE_AA,
        )
        y += 80

    # Draw separator lines
    cv2.line(img, (50, 80), (width - 50, 80), (100, 100, 100), 2)
    cv2.line(img, (50, y + 20), (width - 50, y + 20), (100, 100, 100), 2)

    if rotation_angle_deg != 0.0:
        center = (width // 2, height // 2)
        matrix = cv2.getRotationMatrix2D(center, rotation_angle_deg, 1.0)
        img = cv2.warpAffine(
            img,
            matrix,
            (width, height),
            borderValue=(245, 245, 245),
            flags=cv2.INTER_CUBIC,
        )

    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def create_synthetic_pdf() -> bytes:
    """Creates a 1-page PDF containing a receipt."""
    img_bytes = create_synthetic_receipt("MCDONALD'S PH\nMEAL: PHP 250.00")
    pil_img = Image.open(io.BytesIO(img_bytes))

    pdf_buf = io.BytesIO()
    pil_img.save(pdf_buf, format="PDF")
    return pdf_buf.getvalue()
