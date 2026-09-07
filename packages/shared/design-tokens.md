# Katibay Visual Design Tokens & System Specification

This document defines the foundational visual tokens for the **Katibay** ecosystem across web, mobile, and print reports. These tokens originate directly from the brand architecture established in `packages/shared/brand/rationale.md` (Concept 1: _The Perforated Seal of Katibayan_).

---

## 1. Design Rationale & Philosophy

Katibay is built for student organization treasurers, university auditors, and student leaders in the Philippines. It is not an abstract Silicon Valley SaaS; its visual language balances **institutional trust, financial precision, and Filipino material culture**:

1. **Deep Midnight Ink (`#0F172A`)**: Represents official notary ink, permanent ledger records, and academic authority.
2. **Terracotta Certification Wax (`#C2410C`)**: An assertive, warm red-orange accent inspired by official Philippine document certification stamps and wax seals.
3. **Archival Bone / Paper Surface (`#FAFAF9`)**: A warm, off-white surface tone reminiscent of official university vouchers and thermal receipt stock.
4. **Monospace Tabular Precision**: Strict use of monospace numbers and tables for all centavo arithmetic and hash verification.

---

## 2. Color Palette & Token Scales

### A. Brand Core

| Token Name            | Hex Code  | OKLCH Value              | Purpose                                              |
| --------------------- | --------- | ------------------------ | ---------------------------------------------------- |
| `brand-primary`       | `#0F172A` | `oklch(0.205 0.03 265)`  | Primary navigation, headers, key actions             |
| `brand-primary-hover` | `#1E293B` | `oklch(0.275 0.03 265)`  | Primary button hover state                           |
| `brand-primary-fg`    | `#F8FAFC` | `oklch(0.985 0.005 265)` | Text on primary fill                                 |
| `brand-accent`        | `#C2410C` | `oklch(0.570 0.19 38.5)` | Certification stamps, primary CTAs, highlight badges |
| `brand-accent-hover`  | `#9A3412` | `oklch(0.480 0.18 38.5)` | Accent button hover state                            |
| `brand-accent-fg`     | `#FFFFFF` | `oklch(1 0 0)`           | Text on accent fill                                  |
| `brand-surface`       | `#FAFAF9` | `oklch(0.985 0.005 85)`  | Page canvas and light card backdrop                  |

### B. Semantic Status Scales

Each semantic scale contains 4 required steps: **background (`-bg`)**, **border (`-border`)**, **high-contrast text (`-text`)**, and **solid fill (`-fill`)**.

#### 1. Success (Approved, Verified, On Track, Balanced)

- `status-success-bg`: `oklch(0.96 0.04 145)` / `#ECFDF5`
- `status-success-border`: `oklch(0.85 0.08 145)` / `#A7F3D0`
- `status-success-text`: `oklch(0.35 0.12 145)` / `#065F46`
- `status-success-fill`: `oklch(0.55 0.16 145)` / `#059669`
- `status-success-fg`: `#FFFFFF`

#### 2. Warning (Soft-Flagged, Review Recommended, Collecting)

- `status-warning-bg`: `oklch(0.97 0.06 85)` / `#FFFBEB`
- `status-warning-border`: `oklch(0.88 0.12 85)` / `#FDE68A`
- `status-warning-text`: `oklch(0.42 0.14 85)` / `#92400E`
- `status-warning-fill`: `oklch(0.72 0.16 85)` / `#D97706`
- `status-warning-fg`: `#1F1300`

#### 3. Danger (Exception, Over Budget, Blocking, Rejected)

- `status-danger-bg`: `oklch(0.96 0.04 25)` / `#FEF2F2`
- `status-danger-border`: `oklch(0.86 0.10 25)` / `#FECACA`
- `status-danger-text`: `oklch(0.40 0.18 25)` / `#991B1B`
- `status-danger-fill`: `oklch(0.55 0.22 25)` / `#DC2626`
- `status-danger-fg`: `#FFFFFF`

#### 4. Neutral (Queued, Draft, Waived, Inactive)

- `status-neutral-bg`: `oklch(0.96 0.005 260)` / `#F1F5F9`
- `status-neutral-border`: `oklch(0.88 0.01 260)` / `#CBD5E1`
- `status-neutral-text`: `oklch(0.38 0.02 260)` / `#334155`
- `status-neutral-fill`: `oklch(0.50 0.02 260)` / `#64748B`
- `status-neutral-fg`: `#FFFFFF`

#### 5. Info (Extracted, Processing, Review Stage)

- `status-info-bg`: `oklch(0.96 0.03 240)` / `#F0F9FF`
- `status-info-border`: `oklch(0.86 0.08 240)` / `#BAE6FD`
- `status-info-text`: `oklch(0.38 0.12 240)` / `#0369A1`
- `status-info-fill`: `oklch(0.55 0.15 240)` / `#0284C7`
- `status-info-fg`: `#FFFFFF`

---

## 3. Typography Scale

- **Font Sans**: `Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Font Mono**: `Geist Mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace`

| Role        | Font Size        | Line Height | Weight          | Tracking | Purpose                                          |
| ----------- | ---------------- | ----------- | --------------- | -------- | ------------------------------------------------ |
| `display`   | 2.25rem (36px)   | 1.15        | 800 (Extrabold) | -0.025em | Main dashboard overview titles, hero stat values |
| `heading-1` | 1.75rem (28px)   | 1.20        | 700 (Bold)      | -0.020em | Page titles, major report headers                |
| `heading-2` | 1.375rem (22px)  | 1.25        | 600 (Semibold)  | -0.015em | Section headers, card section titles             |
| `heading-3` | 1.125rem (18px)  | 1.30        | 600 (Semibold)  | 0.000em  | Modal headers, sub-section headers               |
| `body-lg`   | 1.00rem (16px)   | 1.50        | 400 / 500       | 0.000em  | Lead paragraphs, receipt summary rows            |
| `body-base` | 0.875rem (14px)  | 1.50        | 400 / 500       | 0.000em  | Default body text, data table rows, inputs       |
| `body-sm`   | 0.8125rem (13px) | 1.40        | 400 / 500       | 0.000em  | Secondary metadata, helper text                  |
| `caption`   | 0.75rem (12px)   | 1.40        | 600 (Semibold)  | +0.020em | Status badges, table headers, breadcrumbs        |

---

## 4. Spacing Scale (4px Base Grid)

- `space-1`: 0.25rem (4px)
- `space-2`: 0.50rem (8px)
- `space-3`: 0.75rem (12px)
- `space-4`: 1.00rem (16px)
- `space-6`: 1.50rem (24px)
- `space-8`: 2.00rem (32px)
- `space-12`: 3.00rem (48px)
- `space-16`: 4.00rem (64px)

---

## 5. Radius & Elevation

### Radius Levels

- `radius-sm`: `0.25rem` (4px) — Chips, badges, small inputs
- `radius-md`: `0.375rem` (6px) — Buttons, standard input fields
- `radius-lg`: `0.625rem` (10px) — Cards, document containers
- `radius-full`: `9999px` — Circular badges, pill tags

### Elevation & Shadow

- `shadow-card`: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)`
- `shadow-popover`: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)`
- `shadow-modal`: `0 10px 15px -3px rgba(15, 23, 42, 0.10), 0 4px 6px -4px rgba(15, 23, 42, 0.08)`

---

## 6. Shared Component Interface Specifications

1. **`StatusChip`**:
   - Maps status enums (`queued`, `extracted`, `verified`, `exception`, `approved`, `rejected`, `draft`, `collecting`, `review`, `closed`) to semantic tokens, a distinct Lucide icon, and plain-language label.
   - **Never relies on color alone** (always includes icon + text label).
2. **`ConfidenceBar`**:
   - Accepts a numeric score $[0.00, 1.00]$.
   - Displays numeric percentage, animated visual meter, and plain-language tier:
     - $\ge 0.92$: **High Confidence** (`status-success`)
     - $0.70 - 0.92$: **Review Recommended** (`status-warning`)
     - $< 0.70$: **Low Confidence / Check Required** (`status-danger`)
3. **`Card`**:
   - High-contrast document container with `bg-card`, `border-border`, and optional accent header ribbons.
4. **`EmptyState`**:
   - Centered visual state with icon, title, description, and action CTA.
