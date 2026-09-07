# Katibay Brand Identity & Logo System Rationale

This document establishes the official visual identity and logo architecture for **Katibay** prior to frontend UI token generation, ensuring the color system, typography, and component styling inherit directly from the mark rather than post-hoc styling.

---

## 1. Design Concept Directions

### Concept 1: The Perforated Seal of Katibayan (`concept-1-seal`)

- **Philosophy**: Directly rooted in the Filipino word **_katibayan_** (certification, proof, affidavit, sealed public record).
- **Construction**: An authoritative octagonal notary seal silhouette punctuated by four cardinal perforation registration holes (representing a torn official stub or voucher), dissected by a bold vertical pillar and a confident $45^\circ$ terracotta certification strike that forms an unmistakable capital letter **K**.
- **Optical Scalability**: Optimized on an integer 32×32 pixel grid with minimum 4px stroke widths. Retains 100% silhouette clarity and negative space definition when scaled down to a 16×16 favicon.
- **Palette**: Deep Midnight Ink (`#0F172A`) paired with Official Certification Terracotta (`#C2410C`).

### Concept 2: The Verified Receipt Record (`concept-2-receipt`)

- **Philosophy**: Grounded in the tangible physical artifact of accountability—the thermal paper receipt slip transformed into an immutable digital record.
- **Construction**: A vertical document silhouette featuring a jagged top serrated tear edge, a sturdy left ledger spine, and an amber verification notch that locks into a structural **K** with an audit barcode anchor at the base.
- **Optical Scalability**: Distinct silhouette at 16px and 32px due to the top serrated teeth and bold interior negative space.
- **Palette**: Archival Forest Slate (`#064E3B`) paired with Verification Amber Gold (`#F59E0B`).

### Concept 3: The Woven Monogram of Tibay (`concept-3-woven`)

- **Philosophy**: Rooted in indigenous Philippine material culture (_banig_ and _abaca_ interlocking diagonal twill weaves) combined with the heavy, unyielding geometric weight of traditional sign-painter typography.
- **Construction**: Two diagonal interlocking warp and weft bands woven through a solid vertical support column, forming an indestructible letter **K** that symbolizes _tibay_ (tensile strength, organizational integrity, and solid financial grounding).
- **Optical Scalability**: Clean, thick geometric diagonals that maintain high contrast in single-color monochrome.
- **Palette**: Charcoal Ironstone (`#18181B`) paired with Manila Cordage Ochre (`#B45309` / `#D97706`).

---

## 2. Recommendation & Decision

### Primary Recommendation: **Concept 1 (The Perforated Seal of Katibayan)**

**Rationale**:

1. **Direct Semantic Grounding**: The product promise of Katibay is not merely "scanning receipts"—it is generating **indisputable, audit-ready proof (_katibayan_)** for student organizations and university councils. The seal motif instantly communicates institutional authority, notary certification, and trust.
2. **Superior 16px Favicon Performance**: The octagonal faceted perimeter and central white negative space strike provide the highest optical contrast of all three concepts when shrunk to browser tabs and mobile home screens.
3. **Print & Grayscale Resilience**: In official A4 liquidation exports and photocopied audit printouts, the monochrome variant of Concept 1 reproduces cleanly without muddying fine details.

---

## 3. Color Token System (Inherited for Prompt 11)

The UI design tokens for `apps/web` and `apps/mobile` inherit directly from **Concept 1**:

| Token Role            | Hex Code  | OKLCH Equivalent         | Semantic Purpose                                     |
| --------------------- | --------- | ------------------------ | ---------------------------------------------------- |
| `--color-primary`     | `#0F172A` | `oklch(0.205 0.03 265)`  | Primary brand ink, headers, active state             |
| `--color-accent`      | `#C2410C` | `oklch(0.570 0.19 38.5)` | Certification seals, key CTA buttons, verified marks |
| `--color-background`  | `#FAFAF9` | `oklch(0.985 0.005 85)`  | Archival bone / paper backdrop                       |
| `--color-card`        | `#FFFFFF` | `oklch(1 0 0)`           | Document card surfaces                               |
| `--color-border`      | `#E2E8F0` | `oklch(0.922 0.01 260)`  | Ledger grid lines and table borders                  |
| `--color-destructive` | `#B91C1C` | `oklch(0.550 0.22 27)`   | Over-budget and blocking exception alerts            |

---

## 4. Verification & Constraints Compliance

- **No AI Slop / Generic Tropes**:
  - 0 gradient blobs, 0 glassmorphism, 0 glow effects.
  - No checkmark-in-a-circle or shield clichés.
  - No purple-to-blue AI gradient fills.
  - No weightless, generic fintech typography.
- **Pure Vector Formats**: All 9 SVG files are hand-tuned, pure vector paths with clean `viewBox` definitions, fully functional in black on white and white on black.
