export interface ActivitySummary {
  id: string;
  workspace_id: string;
  title: string;
  start_date: string;
  end_date: string;
  cash_advance_amount: number; // in centavos
  status: "draft" | "collecting" | "review" | "closed";
  budget_lines_count: number;
  total_spend: number; // in centavos
}

export interface BudgetLine {
  id: string;
  activity_id: string;
  category: string;
  approved_amount: number; // in centavos
}

export interface CategoryVariance {
  category: string;
  approved_amount: number; // in centavos
  actual_amount: number; // in centavos
  variance: number; // approved - actual (centavos)
  is_over_budget: boolean;
  utilization_pct: number;
}

export interface ReceiptItem {
  id: string;
  activity_id: string;
  merchant_name: string;
  or_number: string;
  txn_date: string;
  category: string;
  amount: number; // in centavos
  confidence: number; // 0.0 to 1.0
  status: "queued" | "extracted" | "verified" | "exception" | "approved" | "rejected";
}

export interface ReconciliationDetails {
  activity: ActivitySummary;
  cash_advance_amount: number;
  total_approved: number;
  total_actual_spend: number;
  net_balance: number; // cash_advance - total_actual_spend
  is_over_budget: boolean;
  overall_utilization_pct: number;
  categories: CategoryVariance[];
  receipts: ReceiptItem[];
}

export function formatPeso(centavos: number): string {
  const isNegative = centavos < 0;
  const absCentavos = Math.abs(centavos);
  const pesos = Math.floor(absCentavos / 100);
  const cents = absCentavos % 100;
  const formattedPesos = pesos.toLocaleString("en-US");
  const formattedCents = cents.toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}₱${formattedPesos}.${formattedCents}`;
}

// Initial Seed Data for Instant Local Verification
export const ACTIVITY_SUMMIT: ActivitySummary = {
  id: "act-summit-2026",
  workspace_id: "ws-guild-001",
  title: "Leadership Summit 2026",
  start_date: "2026-08-10",
  end_date: "2026-08-12",
  cash_advance_amount: 3000000, // ₱30,000.00
  status: "collecting",
  budget_lines_count: 3,
  total_spend: 2500000, // ₱25,000.00
};

export const ACTIVITY_HACKATHON: ActivitySummary = {
  id: "act-hackathon-2026",
  workspace_id: "ws-guild-001",
  title: "Katibay Hackathon & Demo Day",
  start_date: "2026-09-01",
  end_date: "2026-09-02",
  cash_advance_amount: 5000000, // ₱50,000.00
  status: "review",
  budget_lines_count: 4,
  total_spend: 5450000, // ₱54,500.00 (Over budget)
};

export const SEED_ACTIVITIES: ActivitySummary[] = [ACTIVITY_SUMMIT, ACTIVITY_HACKATHON];

export const SEED_RECONCILIATION: Record<string, ReconciliationDetails> = {
  "act-summit-2026": {
    activity: ACTIVITY_SUMMIT,

    cash_advance_amount: 3000000,
    total_approved: 3000000,
    total_actual_spend: 2500000,
    net_balance: 500000, // ₱5,000 excess to return
    is_over_budget: false,
    overall_utilization_pct: 83.3,
    categories: [
      {
        category: "Food & Catering",
        approved_amount: 1500000, // ₱15,000
        actual_amount: 1250000, // ₱12,500
        variance: 250000,
        is_over_budget: false,
        utilization_pct: 83.3,
      },
      {
        category: "Transportation",
        approved_amount: 800000, // ₱8,000
        actual_amount: 600000, // ₱6,000
        variance: 200000,
        is_over_budget: false,
        utilization_pct: 75.0,
      },
      {
        category: "Materials & Printing",
        approved_amount: 700000, // ₱7,000
        actual_amount: 650000, // ₱6,500
        variance: 50000,
        is_over_budget: false,
        utilization_pct: 92.9,
      },
    ],
    receipts: [
      {
        id: "rec-001",
        activity_id: "act-summit-2026",
        merchant_name: "Jollibee Summit Branch",
        or_number: "OR-100234",
        txn_date: "2026-08-10",
        category: "Food & Catering",
        amount: 1250000,
        confidence: 0.98,
        status: "approved",
      },
      {
        id: "rec-002",
        activity_id: "act-summit-2026",
        merchant_name: "Shell Gas Station",
        or_number: "SI-889921",
        txn_date: "2026-08-11",
        category: "Transportation",
        amount: 600000,
        confidence: 0.95,
        status: "approved",
      },
      {
        id: "rec-003",
        activity_id: "act-summit-2026",
        merchant_name: "National Book Store",
        or_number: "OR-554412",
        txn_date: "2026-08-12",
        category: "Materials & Printing",
        amount: 650000,
        confidence: 0.88,
        status: "verified",
      },
    ],
  },
  "act-hackathon-2026": {
    activity: ACTIVITY_HACKATHON,
    cash_advance_amount: 5000000, // ₱50,000

    total_approved: 5000000,
    total_actual_spend: 5450000, // ₱54,500 (₱4,500 overage)
    net_balance: -450000,
    is_over_budget: true,
    overall_utilization_pct: 109.0,
    categories: [
      {
        category: "Prizes & Grants",
        approved_amount: 2500000,
        actual_amount: 2500000,
        variance: 0,
        is_over_budget: false,
        utilization_pct: 100.0,
      },
      {
        category: "Food & Refreshments",
        approved_amount: 1500000,
        actual_amount: 1950000, // Over budget by ₱4,500
        variance: -450000,
        is_over_budget: true,
        utilization_pct: 130.0,
      },
      {
        category: "Venue & Equipment",
        approved_amount: 1000000,
        actual_amount: 1000000,
        variance: 0,
        is_over_budget: false,
        utilization_pct: 100.0,
      },
    ],
    receipts: [
      {
        id: "rec-h1",
        activity_id: "act-hackathon-2026",
        merchant_name: "Pizza Republic",
        or_number: "OR-99120",
        txn_date: "2026-09-01",
        category: "Food & Refreshments",
        amount: 1950000,
        confidence: 0.84,
        status: "verified",
      },
      {
        id: "rec-h2",
        activity_id: "act-hackathon-2026",
        merchant_name: "Tech Hub Venue",
        or_number: "SI-33100",
        txn_date: "2026-09-01",
        category: "Venue & Equipment",
        amount: 1000000,
        confidence: 0.99,
        status: "approved",
      },
    ],
  },
};

export type ExceptionKind =
  | "arith_mismatch"
  | "duplicate"
  | "out_of_period"
  | "over_budget"
  | "low_confidence"
  | "missing_doc";

export type ExceptionSeverity = "info" | "warning" | "blocking";
export type ExceptionStatus = "open" | "resolved" | "waived";

export interface ExceptionReviewItem {
  id: string;
  activity_id: string;
  receipt_id: string;
  kind: ExceptionKind;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  question_text: string;
  question_text_fil: string;
  suggested_values: Record<string, string | number> | null;
  extracted_values: {
    merchant_name?: string;
    or_number?: string;
    txn_date?: string;
    subtotal?: number;
    vat_amount?: number;
    total_amount?: number;
    category?: string;
  };
  confidence: number;
  image_url: string;
  resolution_note?: string;
  resolved_value?: string;
}

export const SEED_EXCEPTIONS: ExceptionReviewItem[] = [
  {
    id: "exc-001",
    activity_id: "act-summit-2026",
    receipt_id: "rec-001",
    kind: "arith_mismatch",
    severity: "blocking",
    status: "open",
    question_text:
      "Line items sum to ₱1,250.00 but receipt subtotal is printed as ₱1,350.00. Which amount is correct?",
    question_text_fil:
      "Ang kabuuan ng mga aytem ay ₱1,250.00 ngunit ang subtotal ay ₱1,350.00. Alin ang tamang halaga?",
    suggested_values: { "Sum of Line Items": "₱1,250.00", "Printed Subtotal": "₱1,350.00" },
    extracted_values: {
      merchant_name: "Jollibee Summit Branch",
      or_number: "OR-100234",
      txn_date: "2026-08-10",
      subtotal: 135000,
      total_amount: 135000,
      category: "Food & Catering",
    },
    confidence: 0.68,
    image_url: "/placeholder-receipt.png",
  },
  {
    id: "exc-002",
    activity_id: "act-summit-2026",
    receipt_id: "rec-002",
    kind: "duplicate",
    severity: "blocking",
    status: "open",
    question_text:
      "A receipt with matching SHA-256 or perceptual hash within distance 5 already exists in this workspace. Is this a duplicate upload?",
    question_text_fil:
      "May resibong kapareho ang hash na umiiral na sa workspace na ito. Doble ba itong na-upload?",
    suggested_values: { "Existing Receipt ID": "rec-original-001", Action: "Reject as Duplicate" },
    extracted_values: {
      merchant_name: "Shell Gas Station",
      or_number: "SI-889921",
      txn_date: "2026-08-11",
      total_amount: 60000,
      category: "Transportation",
    },
    confidence: 0.95,
    image_url: "/placeholder-receipt.png",
  },
  {
    id: "exc-003",
    activity_id: "act-summit-2026",
    receipt_id: "rec-003",
    kind: "out_of_period",
    severity: "blocking",
    status: "open",
    question_text:
      "Transaction date (2026-07-28) falls outside the activity date window (2026-08-10 to 2026-08-12). Was this an authorized pre-event purchase?",
    question_text_fil:
      "Ang petsa ng transaksyon (2026-07-28) ay labas sa panahon ng aktibidad. Awtorisado ba itong paunang pagbili?",
    suggested_values: {
      "Activity Start": "2026-08-10",
      "Pre-event Purchase Approved": "Waive with Note",
    },
    extracted_values: {
      merchant_name: "National Book Store",
      or_number: "OR-554412",
      txn_date: "2026-07-28",
      total_amount: 65000,
      category: "Materials & Printing",
    },
    confidence: 0.88,
    image_url: "/placeholder-receipt.png",
  },
  {
    id: "exc-004",
    activity_id: "act-summit-2026",
    receipt_id: "rec-004",
    kind: "over_budget",
    severity: "blocking",
    status: "open",
    question_text:
      "Category 'Food & Catering' exceeds its approved allocation by ₱4,500.00. Do you authorize budget reallocation?",
    question_text_fil:
      "Ang kategoryang 'Food & Catering' ay lumampas sa aprubadong badyet ng ₱4,500.00. Pinapahintulutan mo ba ang re-alokasyon?",
    suggested_values: { "Approved Ceiling": "₱15,000.00", "Current Spend": "₱19,500.00" },
    extracted_values: {
      merchant_name: "Catering Masters Inc.",
      or_number: "SI-990011",
      txn_date: "2026-08-12",
      total_amount: 450000,
      category: "Food & Catering",
    },
    confidence: 0.99,
    image_url: "/placeholder-receipt.png",
  },
  {
    id: "exc-005",
    activity_id: "act-summit-2026",
    receipt_id: "rec-005",
    kind: "low_confidence",
    severity: "warning",
    status: "open",
    question_text:
      "OCR confidence for merchant name is below 0.70 ('7-Eleve?'). Please confirm the vendor name.",
    question_text_fil:
      "Mababa ang kumpiyansa ng OCR para sa pangalan ng tindahan ('7-Eleve?'). Pakikumpirma ang pangalan.",
    suggested_values: {
      "Suggested Match 1": "7-Eleven Philippines",
      "Suggested Match 2": "Seven Eleven Taft",
    },
    extracted_values: {
      merchant_name: "7-Eleve?",
      or_number: "OR-12903",
      txn_date: "2026-08-10",
      total_amount: 34500,
      category: "Materials & Printing",
    },
    confidence: 0.58,
    image_url: "/placeholder-receipt.png",
  },
  {
    id: "exc-006",
    activity_id: "act-summit-2026",
    receipt_id: "rec-006",
    kind: "missing_doc",
    severity: "blocking",
    status: "open",
    question_text:
      "No Official Receipt (OR) or Sales Invoice (SI) number detected on this document. Please enter the valid OR number.",
    question_text_fil:
      "Walang nakitang numero ng Opisyal na Resibo (OR) sa dokumentong ito. Pakipasok ang tamang numero.",
    suggested_values: null,
    extracted_values: {
      merchant_name: "Grab Transport PH",
      or_number: "",
      txn_date: "2026-08-11",
      total_amount: 28000,
      category: "Transportation",
    },
    confidence: 0.62,
    image_url: "/placeholder-receipt.png",
  },
  {
    id: "exc-007",
    activity_id: "act-summit-2026",
    receipt_id: "rec-007",
    kind: "arith_mismatch",
    severity: "blocking",
    status: "open",
    question_text:
      "VAT amount is ₱144.00, but 12% of VATable sales (₱1,000.00) is ₱120.00. Please correct the tax breakdown.",
    question_text_fil:
      "Ang halaga ng VAT ay ₱144.00, ngunit ang 12% ng VATable sales ay ₱120.00. Pakitama ang buwis.",
    suggested_values: { "Calculated 12% VAT": "₱120.00", "Non-VAT Exempt Total": "₱1,120.00" },
    extracted_values: {
      merchant_name: "Mercury Drug",
      or_number: "OR-87721",
      txn_date: "2026-08-10",
      subtotal: 100000,
      vat_amount: 14400,
      total_amount: 114400,
      category: "Materials & Printing",
    },
    confidence: 0.74,
    image_url: "/placeholder-receipt.png",
  },
  {
    id: "exc-008",
    activity_id: "act-summit-2026",
    receipt_id: "rec-008",
    kind: "low_confidence",
    severity: "warning",
    status: "open",
    question_text:
      "Digit transposition suspected in total: ₱2,890.00 extracted vs ₱2,980.00 in line sum. Please confirm.",
    question_text_fil:
      "Posibleng nagkapalit ang mga numero sa kabuuan: ₱2,890.00 vs ₱2,980.00. Pakikumpirma.",
    suggested_values: { "Line Items Sum": "₱2,980.00", "Printed Total": "₱2,890.00" },
    extracted_values: {
      merchant_name: "Ace Hardware",
      or_number: "SI-44219",
      txn_date: "2026-08-11",
      total_amount: 289000,
      category: "Materials & Printing",
    },
    confidence: 0.65,
    image_url: "/placeholder-receipt.png",
  },
  {
    id: "exc-009",
    activity_id: "act-summit-2026",
    receipt_id: "rec-009",
    kind: "out_of_period",
    severity: "warning",
    status: "open",
    question_text:
      "Transaction date is 2026-08-13 (1 day after event close). Was this a post-event cleanup expense?",
    question_text_fil:
      "Ang petsa ay 2026-08-13 (1 araw pagkatapos ng event). Ito ba ay gastusin para sa pagliligpit?",
    suggested_values: { "Post-event Cleanup": "Waive with Justification" },
    extracted_values: {
      merchant_name: "Clean & Fresh Laundry Services",
      or_number: "OR-3301",
      txn_date: "2026-08-13",
      total_amount: 45000,
      category: "Materials & Printing",
    },
    confidence: 0.89,
    image_url: "/placeholder-receipt.png",
  },
  {
    id: "exc-010",
    activity_id: "act-summit-2026",
    receipt_id: "rec-010",
    kind: "arith_mismatch",
    severity: "blocking",
    status: "open",
    question_text:
      "Off-by-one centavo rounding discrepancy: Subtotal (₱499.99) + VAT (₱60.00) = ₱559.99, but total shows ₱560.00.",
    question_text_fil:
      "May 1-sentimo diperensya sa rounding: ₱499.99 + ₱60.00 = ₱559.99, ngunit ₱560.00 ang nakasaad.",
    suggested_values: { "Round to Exact ₱560.00": "₱560.00", "Keep ₱559.99": "₱559.99" },
    extracted_values: {
      merchant_name: "Mini Stop Store",
      or_number: "OR-11002",
      txn_date: "2026-08-10",
      subtotal: 49999,
      vat_amount: 6000,
      total_amount: 56000,
      category: "Food & Catering",
    },
    confidence: 0.91,
    image_url: "/placeholder-receipt.png",
  },
  {
    id: "exc-011",
    activity_id: "act-summit-2026",
    receipt_id: "rec-011",
    kind: "low_confidence",
    severity: "warning",
    status: "open",
    question_text:
      "Category classification confidence below 0.75 for merchant 'Office Depot Manila'. Please confirm budget category.",
    question_text_fil:
      "Mababang kumpiyansa sa kategorya para sa 'Office Depot Manila'. Pakipili ang tamang kategorya.",
    suggested_values: {
      "Option A": "Materials & Printing",
      "Option B": "General Operating Expenses",
    },
    extracted_values: {
      merchant_name: "Office Depot Manila",
      or_number: "SI-77881",
      txn_date: "2026-08-11",
      total_amount: 110000,
      category: "Materials & Printing",
    },
    confidence: 0.72,
    image_url: "/placeholder-receipt.png",
  },
  {
    id: "exc-012",
    activity_id: "act-summit-2026",
    receipt_id: "rec-012",
    kind: "missing_doc",
    severity: "blocking",
    status: "open",
    question_text:
      "Document image is faint or cut off at the header. Please manually confirm the vendor TIN and OR number.",
    question_text_fil:
      "Malabo o putol ang tuktok ng resibo. Pakipasok nang manu-mano ang TIN at OR number.",
    suggested_values: null,
    extracted_values: {
      merchant_name: "Local Printing Press",
      or_number: "",
      txn_date: "2026-08-12",
      total_amount: 150000,
      category: "Materials & Printing",
    },
    confidence: 0.52,
    image_url: "/placeholder-receipt.png",
  },
];

export interface PassportClaimItem {
  id: string;
  passport_id: string;
  fault_description: string;
  opened_at: string;
  status: "open" | "submitted" | "resolved";
  packet_path?: string;
}

export interface PassportItem {
  id: string;
  workspace_id: string;
  receipt_id: string;
  item_name: string;
  brand: string;
  model: string;
  serial_number: string;
  purchase_date: string;
  warranty_months: number;
  warranty_expires_at: string;
  coverage_notes: string;
  status: "active" | "expiring" | "expired" | "claimed";
  merchant_name: string;
  or_number: string;
  total_amount: number; // in centavos
  claims: PassportClaimItem[];
}

export function computeWarrantyCountdown(
  expiresAtStr: string,
  referenceDateStr?: string,
): {
  daysRemaining: number;
  status: "active" | "expiring" | "expired";
  tier: "active" | "notice_60d" | "warning_30d" | "critical_7d" | "expired";
  label: string;
  statusChipStatus: "active" | "expiring" | "expired";
  chipCustomLabel: string;
} {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date("2026-09-02"); // Consistent demo baseline
  const expDate = new Date(expiresAtStr);
  const diffTime = expDate.getTime() - refDate.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    const daysAgo = Math.abs(daysRemaining);
    return {
      daysRemaining,
      status: "expired",
      tier: "expired",
      label: daysAgo === 0 ? "Expired today" : `Expired ${daysAgo} days ago`,
      statusChipStatus: "expired",
      chipCustomLabel: "Coverage Expired",
    };
  }

  if (daysRemaining <= 7) {
    return {
      daysRemaining,
      status: "expiring",
      tier: "critical_7d",
      label: `${daysRemaining} days left (Critical 7-Day Window)`,
      statusChipStatus: "expiring",
      chipCustomLabel: "Critical Expiry (≤7d)",
    };
  }

  if (daysRemaining <= 30) {
    return {
      daysRemaining,
      status: "expiring",
      tier: "warning_30d",
      label: `${daysRemaining} days left (Expiring soon)`,
      statusChipStatus: "expiring",
      chipCustomLabel: "Expiring Soon (≤30d)",
    };
  }

  if (daysRemaining <= 60) {
    return {
      daysRemaining,
      status: "expiring",
      tier: "notice_60d",
      label: `${daysRemaining} days left (60-Day Expiry Notice)`,
      statusChipStatus: "expiring",
      chipCustomLabel: "Expiry Notice (≤60d)",
    };
  }

  return {
    daysRemaining,
    status: "active",
    tier: "active",
    label: `${daysRemaining} days of protection remaining`,
    statusChipStatus: "active",
    chipCustomLabel: "Active Coverage",
  };
}

export const SEED_PASSPORTS: PassportItem[] = [
  {
    id: "pass-sony-fx3",
    workspace_id: "ws-guild-001",
    receipt_id: "rec-001",
    item_name: "Sony FX3 Full-Frame Cinema Camera",
    brand: "Sony",
    model: "ILME-FX3",
    serial_number: "SN-88210992-FX3",
    purchase_date: "2026-03-01",
    warranty_months: 12,
    warranty_expires_at: "2027-03-01",
    coverage_notes:
      "Official Sony Philippines 1-year service and parts warranty covering internal sensor, shutter, and motherboard defects.",
    status: "active",
    merchant_name: "Sony Centre Megamall",
    or_number: "SI-889912",
    total_amount: 19500000, // ₱195,000.00
    claims: [],
  },
  {
    id: "pass-dell-ultrasharp",
    workspace_id: "ws-guild-001",
    receipt_id: "rec-002",
    item_name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor',
    brand: "Dell",
    model: "U2723QE",
    serial_number: "CN-08K90-74261",
    purchase_date: "2023-09-30",
    warranty_months: 36,
    warranty_expires_at: "2026-09-30", // 28 days left (≤30d tier)
    coverage_notes:
      "3-Year Dell Advanced Exchange Service with Premium Panel Guarantee for zero bright dot defect.",
    status: "expiring",
    merchant_name: "Octagon Computer Superstore",
    or_number: "OR-10294",
    total_amount: 3800000, // ₱38,000.00
    claims: [],
  },
  {
    id: "pass-audio-technica-mic",
    workspace_id: "ws-guild-001",
    receipt_id: "rec-003",
    item_name: "Audio-Technica Dual Wireless Mic System",
    brand: "Audio-Technica",
    model: "ATW-1322",
    serial_number: "AT-99410-MIC",
    purchase_date: "2025-09-07",
    warranty_months: 12,
    warranty_expires_at: "2026-09-07", // 5 days left (≤7d critical tier)
    coverage_notes:
      "Full manufacturer coverage for transmitter capsule and wireless receiver synchronization faults.",
    status: "expiring",
    merchant_name: "Audiophile Components Manila",
    or_number: "SI-77401",
    total_amount: 2450000, // ₱24,500.00
    claims: [
      {
        id: "claim-001",
        passport_id: "pass-audio-technica-mic",
        fault_description:
          "Handheld transmitter channel B experiences sudden audio dropouts beyond 10 meters line of sight.",
        opened_at: "2026-09-01",
        status: "open",
        packet_path: "claims/pass-audio-technica-mic/claim-001.pdf",
      },
    ],
  },
  {
    id: "pass-epson-ecotank",
    workspace_id: "ws-guild-001",
    receipt_id: "rec-004",
    item_name: "Epson EcoTank All-in-One Ink Tank Printer",
    brand: "Epson",
    model: "L3210",
    serial_number: "X942-019941",
    purchase_date: "2024-10-24",
    warranty_months: 24,
    warranty_expires_at: "2026-10-24", // 52 days left (≤60d notice tier)
    coverage_notes:
      "2-Year or 30,000-page official Epson warranty covering printhead and main board replacement.",
    status: "expiring",
    merchant_name: "Silicon Valley Computer",
    or_number: "OR-44910",
    total_amount: 890000, // ₱8,900.00
    claims: [],
  },
  {
    id: "pass-jbl-eon",
    workspace_id: "ws-guild-001",
    receipt_id: "rec-005",
    item_name: 'JBL EON715 15" 1300W Powered PA Speaker',
    brand: "JBL Professional",
    model: "EON715",
    serial_number: "JBL-88019-EON",
    purchase_date: "2025-08-15",
    warranty_months: 12,
    warranty_expires_at: "2026-08-15", // Expired 18 days ago
    coverage_notes:
      "1-Year Harman Professional warranty covering amplifier module and compression driver.",
    status: "expired",
    merchant_name: "JB Music & Sports",
    or_number: "SI-22091",
    total_amount: 3200000, // ₱32,000.00
    claims: [],
  },
];

export interface AuditEventItem {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;

  occurred_at: string;
}

export const SEED_AUDIT_EVENTS: AuditEventItem[] = [
  {
    id: "aud-001",
    workspace_id: "ws-guild-001",
    actor_id: "usr-treasurer-01",
    actor_name: "Maria Santos",
    actor_role: "Treasurer",
    entity_type: "activities",
    entity_id: "act-summit-2026",
    action: "activity_created",
    before: null,
    after: {
      title: "Leadership Summit 2026",
      cash_advance_amount: 3000000,
      start_date: "2026-08-10",
      end_date: "2026-08-12",
      status: "collecting",
    },
    occurred_at: "2026-08-10 08:30:15 UTC",
  },
  {
    id: "aud-002",
    workspace_id: "ws-guild-001",
    actor_id: "usr-officer-02",
    actor_name: "Juan Dela Cruz",
    actor_role: "Logistics Head",
    entity_type: "receipts",
    entity_id: "rec-001",
    action: "receipt_queued",
    before: null,
    after: {
      storage_path: "receipts/rec-001.jpg",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      status: "queued",
    },
    occurred_at: "2026-08-11 10:14:22 UTC",
  },
  {
    id: "aud-003",
    workspace_id: "ws-guild-001",
    actor_id: null,
    actor_name: "Gemini 2.5 OCR Engine",
    actor_role: "System Pipeline",
    entity_type: "receipts",
    entity_id: "rec-001",
    action: "receipt_extracted",
    before: { status: "queued" },
    after: {
      merchant_name: "National Book Store",
      or_number: "OR-2026-0881",
      subtotal: 379464,
      vat_amount: 45536,
      total_amount: 425000,
      confidence: 0.96,
      status: "extracted",
    },
    occurred_at: "2026-08-11 10:14:26 UTC",
  },
  {
    id: "aud-004",
    workspace_id: "ws-guild-001",
    actor_id: null,
    actor_name: "Pure Verification Engine",
    actor_role: "Rule Engine",
    entity_type: "exceptions",
    entity_id: "exc-arith-001",
    action: "exception_raised",
    before: null,
    after: {
      receipt_id: "rec-001",
      kind: "missing_line_item",
      severity: "blocking",
      question_text: "The line items sum to ₱4,000.00 but subtotal is ₱4,250.00. Is item missing?",
      status: "open",
    },
    occurred_at: "2026-08-11 10:14:27 UTC",
  },
  {
    id: "aud-005",
    workspace_id: "ws-guild-001",
    actor_id: "usr-treasurer-01",
    actor_name: "Maria Santos",
    actor_role: "Treasurer",
    entity_type: "exceptions",
    entity_id: "exc-arith-001",
    action: "exception_resolved",
    before: {
      status: "open",
      line_items_total: 400000,
    },
    after: {
      status: "resolved",
      line_items_total: 425000,
      resolution_note: "Included missing ₱250 index card pack from receipt breakdown.",
    },
    occurred_at: "2026-08-11 14:02:11 UTC",
  },
  {
    id: "aud-006",
    workspace_id: "ws-guild-001",
    actor_id: "usr-treasurer-01",
    actor_name: "Maria Santos",
    actor_role: "Treasurer",
    entity_type: "receipts",
    entity_id: "rec-001",
    action: "receipt_approved",
    before: { status: "verified" },
    after: {
      status: "approved",
      ledger_entry_id: "ledg-881029",
      category: "Office Supplies",
      amount: 425000,
    },
    occurred_at: "2026-08-11 14:02:15 UTC",
  },
  {
    id: "aud-007",
    workspace_id: "ws-guild-001",
    actor_id: "usr-treasurer-01",
    actor_name: "Maria Santos",
    actor_role: "Treasurer",
    entity_type: "passports",
    entity_id: "pass-sony-fx3",
    action: "passport_promoted",
    before: null,
    after: {
      item_name: "Sony FX3 Cinema Camera",
      serial_number: "SN-8821099",
      purchase_date: "2026-03-01",
      warranty_expires_at: "2027-03-01",
      status: "active",
    },
    occurred_at: "2026-08-12 09:15:30 UTC",
  },
  {
    id: "aud-008",
    workspace_id: "ws-guild-001",
    actor_id: "usr-treasurer-01",
    actor_name: "Maria Santos",
    actor_role: "Treasurer",
    entity_type: "reports",
    entity_id: "exp-zip-001",
    action: "evidence_packet_exported",
    before: null,
    after: {
      activity_id: "act-summit-2026",
      filename: "liquidation_packet_act-summit-2026.zip",
      sha256: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
      receipts_count: 5,
      total_liquidated: 2470000,
    },
    occurred_at: "2026-08-12 16:45:00 UTC",
  },
];
