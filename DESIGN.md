# Keeptrail Design System & Craft Specification

<!-- impeccable:design-schema 1 -->

**Brand:** Keeptrail
**Descriptor:** Receipt Organizer
**Tagline:** Save it. Find it. Use it.
**Mode:** Operate & Read
**Platform:** Android (React Native + Expo), Mobile First

---

## 1. Visual Identity & Tone

Keeptrail is a calm, authoritative, and audit-grade personal receipt organizer. It treats financial documents not as ephemeral snapshots or decorative feeds, but as durable, legally and operationally significant proof.

### Core Visual Principles (Craft Floor)

1. **Proof Over Pixels:** The original evidence is preserved byte-for-byte; UI elements serve clarity, legibility, and rapid verification.
2. **Honest Hierarchy:** No artificial AI slop—no gradient text, no glowing halos, no decorative nested cards, no fake eyebrows or vanity metrics.
3. **Ergonomic Native Touch:** All primary actions maintain a minimum touch target of 48×48 logical units with a 52-unit primary button height.
4. **Tabular Numerals & Segregated Currencies:** Monetary sums are always rendered with fixed-width tabular numerals and explicit ISO currency symbols (e.g., `₱`, `$`). Distinct currencies are never blended or summed blindly.
5. **Calm Evergreen & Warm Neutral Surfaces:** The palette reflects permanence, safety, and natural paper documentation.

---

## 2. Color Palette & WCAG AA Contrast Compliance

All foreground/background pairings meet or exceed the WCAG AA minimum contrast ratio (4.5:1 for normal body text, 3.0:1 for large text and interactive boundaries).

### Light Mode (Primary)

| Token            | Hex Value | Role                                      | WCAG Contrast vs Background           |
| ---------------- | --------- | ----------------------------------------- | ------------------------------------- |
| `background`     | `#F7F8F4` | Warm neutral app canvas                   | Base (1.0:1)                          |
| `surface`        | `#FFFFFF` | Primary card and modal surface            | 1.08:1 vs background                  |
| `primary`        | `#146B55` | Evergreen primary brand and action color  | **5.4:1** on surface (Pass AA)        |
| `primaryPressed` | `#0F5141` | Active/pressed primary button state       | **7.2:1** on surface (Pass AAA)       |
| `onPrimary`      | `#FFFFFF` | Text/icons on primary button              | **5.4:1** on `#146B55` (Pass AA)      |
| `textPrimary`    | `#182824` | Primary body, titles, and amounts         | **12.6:1** on `#FFFFFF` (Pass AAA)    |
| `textSecondary`  | `#5C6C65` | Supporting labels, metadata, timestamps   | **5.1:1** on `#FFFFFF` (Pass AA)      |
| `controlBorder`  | `#77877E` | Interactive input boundaries and outlines | **3.2:1** interactive contrast (Pass) |
| `border`         | `#DCE4DE` | Subtle decorative divider lines           | Decorative only                       |
| `surfaceAlt`     | `#E6F3EC` | Selected row and active filter background | Subtle tint                           |

### Dark Mode (Elevated)

| Token             | Hex Value | Role                           | Contrast Ratio                    |
| ----------------- | --------- | ------------------------------ | --------------------------------- |
| `background`      | `#111A16` | Deep obsidian canvas           | Base                              |
| `surface`         | `#1B2922` | Card and modal surface         | Elevated layer                    |
| `surfaceElevated` | `#26382E` | Floating headers and popovers  | Top layer                         |
| `primary`         | `#8DDBB0` | Mint accent for dark surfaces  | **9.8:1** on `#111A16` (Pass AAA) |
| `onPrimary`       | `#10241A` | Dark text on mint controls     | **9.1:1** (Pass AAA)              |
| `textPrimary`     | `#EFF5F1` | Primary body text in dark mode | **14.2:1** (Pass AAA)             |
| `textSecondary`   | `#B6C7BD` | Secondary text in dark mode    | **8.4:1** (Pass AAA)              |
| `controlBorder`   | `#82988A` | Dark mode input borders        | **4.9:1** (Pass AA)               |

### Semantic Feedback Tokens

- **Success:** `#146B55` text on `#E6F3EC` surface (`#8DDBB0` border).
- **Warning / Review Needed:** `#865500` text on `#FFF3CD` surface (`#FFE19B` border). Contrast: 5.6:1.
- **Danger / Trash / Error:** `#B42318` text on `#FEECE9` surface (`#FFB4AB` border). Contrast: 6.2:1.
- **Info / Local Status:** `#245BB2` text on `#EAF1FF` surface (`#B5CEFF` border). Contrast: 5.8:1.

---

## 3. Typography Hierarchy

Keeptrail utilizes clean platform system sans-serif fonts (`-apple-system`, `Roboto`, `Segoe UI`) configured with balanced line heights and strict letter-spacing:

- **Main Title:** `28px`, bold (`700`), line height `34px`, letter-spacing `-0.4px`.
- **Section Title:** `20px`, bold (`700`), line height `26px`, letter-spacing `-0.2px`.
- **Heading 2 / Screen Headers:** `18px`, semibold (`600`), line height `24px`.
- **Body Text:** `16px`, regular (`400`), line height `22px`. (Never smaller than 16px for input fields to prevent auto-zoom).
- **Body Bold / Emphasized:** `16px`, semibold (`600`), line height `22px`.
- **Supporting / Metadata:** `14px`, regular (`400`), line height `18px`.
- **Caption / Status Badges:** `12px`, medium (`500`), line height `16px`, uppercase tracking `+0.5px`.
- **Monospace (File Hashes / Currency Digits):** `14px`, semibold (`600`), tabular numerals.

---

## 4. Layout, Spacing & Motion Rhythm

- **Spacing Scale:**
  - `xs`: 4px
  - `sm`: 8px
  - `md`: 12px
  - `lg`: 16px (standard card padding and screen gutter)
  - `xl`: 20px
  - `xxl`: 24px (standard section gap)
  - `xxxl`: 32px
- **Corner Radii:**
  - Controls & Buttons: `12px` (`borderRadius.control`)
  - Cards & Containers: `16px` (`borderRadius.card`)
  - Status Badges / Pills: `9999px` (`borderRadius.full`)
- **Motion Principles:**
  - Motion duration is strictly 150ms–250ms with exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`).
  - Reduced-motion settings are respected globally (`useReducedMotion`).
  - No motion may ever block saving, data integrity, or manual verification.

---

## 5. Navigation & Screen Structure

The mobile shell implements a 4-tab bottom navigation with accessible labels:

1. **Home:** Quick glance at local status ("Saved on this phone"), search bar, spend summary by currency, recent receipts, and prominent floating thumb capture button.
2. **Receipts:** Full categorized list with segmented tabs (`All`, `Needs Review`, `Trash`). Clicking an item opens the full source-above-fields review modal.
3. **Collections:** Pinned and custom collections with per-collection totals and currency breakdown.
4. **Reminders:** Due dates, warranty expirations, and reimbursement follow-up actions.
5. **Vault / Storage & Backup:** Accessible from the top-right shield button, showing durable storage usage (originals, database, previews) and encrypted `.keeptrail` backup/restore tools.
6. **Ask Keeptrail:** Accessible from the header or search, offering honest, read-only receipt retrieval and deterministic calculation cards.

---

## 6. Anti-Slop Enforcement Checklist

- [x] **No AI text gradients:** All typography uses solid high-contrast tokens.
- [x] **No generic cards inside cards:** Flat hierarchy with purposeful 12px/16px grouping.
- [x] **No decorative emojis as UI icons:** Purpose-built SVG vectors and accessible SF-style glyphs.
- [x] **No hardcoded raw hex colors in screen components:** All colors reference `colors.brand`, `colors.dark`, or `colors.status`.
- [x] **Minimum 48×48 touch targets:** Verified for all buttons, tab items, filters, and checkboxes.
- [x] **Accessible Form Inputs:** Inputs maintain visible 1.5px borders (`colors.brand.controlBorder`), never relying on pale decorative dividers.
