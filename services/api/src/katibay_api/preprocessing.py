"""Receipt image preprocessing module.

Handles:
- Multi-format ingestion (JPEG, PNG, HEIC, PDF)
- EXIF-based auto-rotation
- Auto-deskew via contour/line orientation analysis
- Contrast normalization via CLAHE on the Lightness channel
- Downscaling long edge to 1600px
- JPEG q85 encoding
- Perceptual hash computation (imagehash.phash)
"""

import io
import math
from dataclasses import dataclass

import cv2
import imagehash
import numpy as np
import pillow_heif
import pypdfium2 as pdfium
from PIL import Image, ImageOps

# Register HEIC opener with Pillow
pillow_heif.register_heif_opener()

DEFAULT_LONG_EDGE_PX = 1600
DEFAULT_JPEG_QUALITY = 85


@dataclass(frozen=True)
class PreprocessedReceipt:
    """Artifacts resulting from receipt preprocessing."""

    normalized_jpeg_bytes: bytes
    pil_image: Image.Image
    phash: str
    width: int
    height: int


def load_raw_image(file_bytes: bytes, mime_type: str | None = None) -> Image.Image:
    """Loads raw bytes from JPEG, PNG, HEIC, or PDF into an RGB PIL Image."""
    # Check for PDF magic header or mime type
    if (mime_type and mime_type == "application/pdf") or file_bytes[:4] == b"%PDF":
        pdf = pdfium.PdfDocument(file_bytes)
        if len(pdf) == 0:
            raise ValueError("PDF file contains no pages.")
        # Render the first page at 300 DPI for high fidelity
        page = pdf[0]
        rendered = page.render(scale=300 / 72).to_pil()
        return rendered.convert("RGB")

    # Pillow handles JPEG, PNG, and HEIC (via pillow-heif)
    img = Image.open(io.BytesIO(file_bytes))
    return img.convert("RGB")


def apply_exif_rotation(image: Image.Image) -> Image.Image:
    """Applies rotation indicated by EXIF orientation tags."""
    try:
        return ImageOps.exif_transpose(image)
    except Exception:
        return image


def auto_deskew(cv_bgr: np.ndarray) -> np.ndarray:
    """Detects dominant skew angle of receipt text lines and rotates to level."""
    gray = cv2.cvtColor(cv_bgr, cv2.COLOR_BGR2GRAY)

    # Threshold image to isolate text
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

    # Dilate horizontally to join adjacent words into text-line strips
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (30, 5))
    dilated = cv2.dilate(thresh, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    angles: list[float] = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 300:
            continue
        rect = cv2.minAreaRect(cnt)
        _, (w_box, h_box), angle = rect
        if w_box < h_box:
            angle = angle + 90 if angle < 0 else angle - 90

        # Normalize to [-45, 45]
        while angle < -45:
            angle += 90
        while angle > 45:
            angle -= 90

        if 0.5 <= abs(angle) <= 45:
            angles.append(angle)

    # Hough line fallback if contour analysis produced few angles
    if len(angles) < 5:
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(
            edges, 1, np.pi / 180, threshold=100, minLineLength=80, maxLineGap=10
        )
        if lines is not None:
            for line in lines:
                coords = line.ravel()
                if len(coords) >= 4:
                    x1, y1, x2, y2 = coords[:4]
                    if x2 != x1:
                        deg = math.degrees(math.atan2(y2 - y1, x2 - x1))
                        while deg < -45:
                            deg += 90
                        while deg > 45:
                            deg -= 90
                        if 0.5 <= abs(deg) <= 45:
                            angles.append(deg)

    if not angles:
        return cv_bgr

    median_angle = float(np.median(angles))
    if abs(median_angle) < 0.2 or abs(median_angle) > 45:
        return cv_bgr

    # Rotate around image center
    h, w = cv_bgr.shape[:2]
    center = (w // 2, h // 2)
    m = cv2.getRotationMatrix2D(center, median_angle, 1.0)

    rotated = cv2.warpAffine(
        cv_bgr,
        m,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return rotated


def apply_clahe(
    cv_bgr: np.ndarray,
    clip_limit: float = 2.0,
    tile_grid_size: tuple[int, int] = (8, 8),
) -> np.ndarray:
    """Applies Contrast Limited Adaptive Histogram Equalization (CLAHE)
    in LAB color space.
    """

    lab = cv2.cvtColor(cv_bgr, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    l_clahe = clahe.apply(l_channel)

    merged = cv2.merge((l_clahe, a_channel, b_channel))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def downscale_long_edge(
    image: Image.Image, max_long_edge: int = DEFAULT_LONG_EDGE_PX
) -> Image.Image:
    """Scales image down so its long edge equals max_long_edge if it exceeds it."""
    w, h = image.size
    long_edge = max(w, h)
    if long_edge <= max_long_edge:
        return image

    scale = max_long_edge / float(long_edge)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return image.resize((new_w, new_h), Image.Resampling.LANCZOS)


def preprocess_receipt_image(
    file_bytes: bytes,
    mime_type: str | None = None,
    max_long_edge: int = DEFAULT_LONG_EDGE_PX,
    jpeg_quality: int = DEFAULT_JPEG_QUALITY,
) -> PreprocessedReceipt:
    """Executes the complete preprocessing pipeline on a receipt file."""
    # 1. Decode & EXIF rotate
    raw_image = load_raw_image(file_bytes, mime_type)
    exif_image = apply_exif_rotation(raw_image)

    # 2. Deskew with OpenCV
    cv_bgr = cv2.cvtColor(np.array(exif_image), cv2.COLOR_RGB2BGR)
    deskewed_bgr = auto_deskew(cv_bgr)

    # 3. Contrast normalization (CLAHE)
    clahe_bgr = apply_clahe(deskewed_bgr)

    # 4. Back to PIL & Downscale
    norm_pil = Image.fromarray(cv2.cvtColor(clahe_bgr, cv2.COLOR_BGR2RGB))
    final_pil = downscale_long_edge(norm_pil, max_long_edge=max_long_edge)

    # 5. Output JPEG q85
    buffer = io.BytesIO()
    final_pil.save(buffer, format="JPEG", quality=jpeg_quality, optimize=True)
    jpeg_bytes = buffer.getvalue()

    # 6. Perceptual hash (imagehash.phash)
    hash_obj = imagehash.phash(final_pil)
    phash_str = str(hash_obj)

    return PreprocessedReceipt(
        normalized_jpeg_bytes=jpeg_bytes,
        pil_image=final_pil,
        phash=phash_str,
        width=final_pil.width,
        height=final_pil.height,
    )
