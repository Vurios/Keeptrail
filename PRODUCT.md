# Product: Keeptrail (Free Local Android APK Pilot)

<!-- impeccable:product-schema 1 -->

## Platform

android

## Stack

React Native, Expo, TypeScript, Local SQLite Vault, On-Device OCR, AES-256-GCM Backup Encryption, Deterministic Money Engine. (Historical services/api Python backend and apps/web Next.js app preserved intact for future cloud evaluation).

## Users

- **Primary:** Individuals, project leads, consumers, and expense managers who need to reliably save, find, and use receipts, payment screenshots, and supporting documents on their Android phone without creating accounts or uploading private financial documents to the cloud.
- **Audience Context:** Testers evaluating offline reliability, on-device search, encrypted backup/restore, and deterministic calculations without ads, subscriptions, or paywalls.

## Product Purpose

Keeptrail keeps your receipts, payment screenshots, and supporting documents together with the reason you saved them—so you can find the right record, share it, or follow up when it matters. Everything runs locally on the phone: zero accounts, zero cloud receipt backend, zero multi-phone sync, zero subscriptions.

## Positioning

Save it. Find it. Use it.
Unlike cloud tools that monetize personal financial transactions or require monthly subscriptions, Keeptrail runs entirely as a private on-device vault. Financial totals are computed deterministically in application code with exact minor unit integers (no floating point errors, no LLM math hallucinations). AI assistance is local, read-only, and honestly labeled as a Basic Helper on phones without neural model acceleration.

## Operating Context

- Android mobile devices running offline or online.
- Camera captures, gallery photo imports, payment app screenshots, PDFs, and manual entries.
- Private on-device SQLite database + byte-for-byte evidence file storage with SHA-256 integrity checksums.
- Encrypted password-protected `.keeptrail` backup containers (AES-256-GCM + PBKDF2).

## Core Capabilities and Constraints

- **Private On-Device Vault:** All metadata and original receipt files remain strictly on the user's phone.
- **Deterministic Money Tools:** Exact integer minor unit math; multi-currency segregation (never blends PHP, USD, etc.); CSV formula injection sanitization.
- **On-Device OCR & Extraction:** Extracts merchant, date, amount, items, and flags ambiguous dates without cloud dependencies.
- **Portable Encrypted Backup (.keeptrail):** User-controlled AES-256-GCM archive with cryptographic manifest and file checksums.
- **Ask Keeptrail (Local Assistant):** Read-only exploration tool with trusted deterministic calculation cards and honest Basic Helper labeling.
- **Zero Cloud Leakage:** No background network calls for receipts, no third-party tracking, no cloud inference.

## Brand Commitments

- **Name:** Keeptrail (one word, English compound).
- **Tagline:** *Save it. Find it. Use it.*
- **Palette:** Evergreen `#146B55` primary, Warm Neutral `#F7F8F4` background, Surface `#FFFFFF`, Obsidian Dark `#111A16`.
- **Icon Mark:** Folded document shape with continuous trail path in negative space.

---

## Historical Provenance: Katibay Baseline (Preserved)

Prior to Revision 8 (September 2026), the codebase was developed as *Katibay* (Philippine liquidation packet and warranty passport system). All existing Python backend endpoints (`services/api`), web routes (`apps/web`), and database migrations (`supabase/`) are preserved intact and unaffected to allow future cloud edition exploration (Path 4B) without data loss or destructive rewrites.
