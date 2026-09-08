import io
from PIL import Image

# Dimension thresholds
MIN_DIMENSION = 200        # below this the image is genuinely too small to OCR
MAX_DIMENSION = 3000       # cap for both Cloud Vision and Tesseract accuracy
ALLOWED_FORMATS = {"PNG", "JPEG", "JPG", "WEBP", "BMP", "TIFF", "TIF"}


def preprocess_image(image_bytes: bytes) -> bytes | None:
    """Validate, and if needed resize, an image for OCR.

    Returns:
        Processed JPEG bytes ready for OCR, or None when the image is
        fundamentally unusable (unsupported format, corrupt file, too small).

    Resizing policy:
        If either dimension exceeds MAX_DIMENSION the image is scaled down
        proportionally so the longest edge equals MAX_DIMENSION.  This keeps
        handwriting legible while staying within Cloud Vision / Tesseract limits.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))

        # Format check
        fmt = (img.format or "").upper()
        if fmt not in ALLOWED_FORMATS:
            print(f"Preprocessing: Unsupported format '{fmt}'")
            return None

        # Convert palette / RGBA modes that JPEG can't encode
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        width, height = img.size

        # Too small to OCR reliably
        if width < MIN_DIMENSION or height < MIN_DIMENSION:
            print(f"Preprocessing: Image too small ({width}x{height}), skipping.")
            return None

        # Resize if too large
        if width > MAX_DIMENSION or height > MAX_DIMENSION:
            scale = MAX_DIMENSION / max(width, height)
            new_w = max(1, int(width  * scale))
            new_h = max(1, int(height * scale))
            print(f"Preprocessing: Resizing {width}x{height} → {new_w}x{new_h}")
            img = img.resize((new_w, new_h), Image.LANCZOS)

        # Encode to JPEG for downstream OCR services
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=92)
        return buf.getvalue()

    except Exception as exc:
        print(f"Preprocessing: Corrupt or invalid image — {exc}")
        return None


def validate_image(image_bytes: bytes) -> bool:
    """Backwards-compatible wrapper; returns True only when preprocessing succeeds."""
    return preprocess_image(image_bytes) is not None
