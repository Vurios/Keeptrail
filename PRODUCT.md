# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Expo (React Native), FastAPI (Python 3.12), PostgreSQL / Supabase, WeasyPrint

## Users

- **Primary:** Student organization, NGO, committee, and project treasurers in the Philippines managing cash advances (₱10k–₱100k) with strict liquidation deadlines and annual officer turnover.
- **Secondary:** Consumers and individuals in the Philippines needing durable proof of purchase, warranty countdowns, and claim packets for high-value appliances, electronics, and devices.

## Product Purpose

Katibay transforms messy receipt photos into verified, indisputable financial records (Verified Receipt Records - VRRs). It eliminates manual reconciliation by turning piles of faded thermal slips and crumpled receipts into compliant Philippine liquidation packets (reports, vouchers, summaries, variance analysis, evidence archives) and consumer Purchase Passports.

## Positioning

The receipt is the wrong unit; verified proof is the right unit. Unlike global corporate expense tools built on employee reimbursement, Katibay natively models the inverted Philippine cash-advance-to-liquidation workflow (cash advance → verification → return of excess cash), handles faded thermal paper with deterministic backend arithmetic recomputation (no LLM hallucinated totals), and produces the exact liquidation forms and claim packets accepted by Philippine universities, auditing offices, and service centers.

## Operating Context

- High volume of irregular, crumpled, or fading thermal POS slips, official receipts (OR), collection receipts, and invoices.
- Cash advances disbursed upfront, requiring formal liquidation with return-of-excess or replenishment documentation under strict deadlines.
- Treasurers work in stressful end-of-semester or post-event sprints, often collecting receipts from committee members via mobile photo submissions.
- Annual officer turnover requiring zero-loss institutional memory and immediate usability without corporate training.

## Capabilities and Constraints

- **Verified Receipt Record (VRR):** Multi-pass extraction with deterministic backend arithmetic recomputation; LLMs extract, Python recomputes.
- **Exception Queue:** Low-confidence extractions trigger a single, precise human confirmation question instead of guessing.
- **Philippine Liquidation Packet Generator:** Produces auditable PDFs (Liquidation Report, Summary of Expenses, Cash Advance Voucher, Variance Statement, and stamped evidence compilation).
- **Purchase Passport Vault:** Warranty tracking countdown, serial registration, receipt preservation, and exportable warranty claim packets.
- **Technical Constraints:** Integer centavos for all currency storage (never floats); strict bilingual support (English `en` and Filipino `fil` only); immutable audit trail logs for every state transition; no hardcoded UI colors (tokens only).

## Brand Commitments

- **Name:** Katibay (from *katibayan*, Filipino for "proof / documentary evidence").
- **Tagline:** *Turn a pile of receipts into proof that holds up.*
- **Tone & Voice:** Authoritative, precise, reliable, stress-relieving, and deeply localized to Philippine institutional realities.
- **Design Tokens:** Shared design tokens via `packages/shared` — clean, audit-grade visual hierarchy, no raw hex values.

## Evidence on Hand

- Complete product blueprint: `Katibay_Product_Blueprint_v2.md`
- Non-negotiable engineering rules: `CLAUDE.md`
- Monorepo workspace configuration: `apps/web`, `apps/mobile`, `services/api`, `packages/shared`

## Product Principles

1. **Proof Over Pixels:** Never trust raw OCR/LLM output for math; python recomputes, system verifies, human confirms exceptions.
2. **Inverted Cash Model First:** Built ground-up for cash advances and excess returns, not corporate reimbursement.
3. **One Object, Multiple Lenses:** The Verified Receipt Record (VRR) is the single atomic source of truth for both org liquidations and consumer passports.
4. **Audit-Ready by Default:** Every extraction, edit, and calculation generates an immutable audit trail.
5. **Radical Clarity in Stress:** Designed for anxious treasurers facing deadlines; clear exceptions, immediate feedback, zero financial ambiguity.

## Accessibility & Inclusion

- Support for English (`en`) and Filipino (`fil`) locales.
- High contrast, legible typography optimized for tabular numerical scanning, audit verification, and receipt image inspection.
- WCAG AA compliant interactive elements and keyboard-navigable exception queues.
