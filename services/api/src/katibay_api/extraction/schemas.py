"""Pydantic schemas for Gemini multimodal receipt extraction."""

from pydantic import BaseModel, Field


class ExtractedLineItem(BaseModel):
    """Line item extracted from receipt. Money values in integer centavos."""

    description: str = Field(
        ...,
        description="Name or description of the purchased item or service",
    )
    qty: float = Field(
        default=1.0,
        description="Quantity of items purchased",
    )
    unit_price: int = Field(
        default=0,
        ge=0,
        description="Unit price in integer centavos (e.g. ₱10.50 -> 1050)",
    )
    line_total: int = Field(
        default=0,
        ge=0,
        description="Total amount for this line item in integer centavos",
    )
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Confidence score for this line item (0.0 to 1.0)",
    )


class ReceiptExtraction(BaseModel):
    """Strict structured extraction output from Gemini for a receipt image."""

    merchant_name: str | None = Field(
        default=None,
        description="Business or store name printed on the receipt",
    )
    merchant_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    merchant_tin: str | None = Field(
        default=None,
        description="Taxpayer Identification Number (TIN)",
    )
    merchant_tin_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    merchant_address: str | None = Field(
        default=None,
        description="Physical store address if printed",
    )
    merchant_address_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    txn_date: str | None = Field(
        default=None,
        description="Transaction date in YYYY-MM-DD format",
    )
    txn_date_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    txn_time: str | None = Field(
        default=None,
        description="Transaction time in HH:MM 24-hour format",
    )
    txn_time_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    or_number: str | None = Field(
        default=None,
        description="Official Receipt (OR) number or Invoice / Sales Slip number",
    )
    or_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    line_items: list[ExtractedLineItem] = Field(
        default_factory=list,
        description="List of purchased line items",
    )

    subtotal: int | None = Field(
        default=None,
        ge=0,
        description="Subtotal in integer centavos (excluding VAT/service charge)",
    )
    subtotal_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    vat_amount: int | None = Field(
        default=None,
        ge=0,
        description="Value Added Tax (VAT) in integer centavos",
    )
    vat_amount_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    total_amount: int | None = Field(
        default=None,
        ge=0,
        description="Final total amount paid in integer centavos",
    )
    total_amount_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    payment_method: str | None = Field(
        default=None,
        description="Payment method (e.g. 'Cash', 'GCash', 'Maya', 'Credit Card')",
    )
    payment_method_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Overall extraction confidence score (0.0 to 1.0)",
    )
