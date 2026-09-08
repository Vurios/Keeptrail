# Keeptrail Migration Audit & Inventory (Pilot L0)

**Date:** September 6, 2026
**Scope:** Migration from Katibay v2 (cloud-backed monorepo) to Keeptrail Free Local Android APK Pilot (100% local, no accounts, no cloud backend, no subscriptions).
**Source of Truth:** `Keeptrail_Free_APK_Pilot_Blueprint_V2.md` and `Keeptrail_Local_Storage_and_Backup_Guide.md`.

---

## 1. Executive Summary & Safety Checkpoint

- **Git Checkpoint:** Committed on branch `main` at commit baseline (`chore: checkpoint Katibay v2 baseline before Keeptrail local pilot migration`).
- **Working Branch:** `pilot/local-free-apk`.
- **Preservation Policy:** No project deletion, no database resets, no destructive rollbacks. All existing FastAPI backend services, Next.js web application files, and Supabase migrations are parked intact in the repository for potential future cloud iterations (Path 4B), while the mobile app (`apps/mobile`) is pivoted to a 100% local-first SQLite architecture.

---

## 2. Component Inventory & Audit

| Component / Subsystem                   | Current State in Repository                                                                          | Pilot Disposition                                | Evidence & Rationale                                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FastAPI Backend (`services/api`)**    | Comprehensive FastAPI service with extraction, verification, passports, reports, duplicates, worker. | **Parked (Keep in repo, uncoupled from mobile)** | Contains complete backend business logic and report templates. Parked for future cloud roadmap; mobile pilot runs 100% locally without calling it.                          |
| **Next.js Web App (`apps/web`)**        | Next.js 15 app with Tailwind, activities, passports, and preview.                                    | **Parked (Keep in repo)**                        | Preserved intact. Not bundled into Expo mobile app.                                                                                                                         |
| **Supabase Migrations (`supabase/`)**   | SQL migrations `0001` through `0004` and seed.sql.                                                   | **Parked (Keep in repo)**                        | Preserved intact as reference schema for potential future cloud backends.                                                                                                   |
| **Shared Package (`packages/shared`)**  | TypeScript definitions, i18n (`en`, `fil`), design tokens, exception types.                          | **Keep & Adapt**                                 | Tokens (`tokens.ts`, brand colors), i18n strings, and currency helpers reused across mobile.                                                                                |
| **Mobile Core (`apps/mobile`)**         | Expo SDK 57 app with CameraScreen, QueueScreen, PassportMobileScreen, offline-queue, sync-manager.   | **Adapt & Expand**                               | Migrate from cloud sync queue to local-first SQLite vault. Replace old screens with Keeptrail 4-tab navigation (Home, Receipts, Collections, Reminders) + Storage & Backup. |
| **Local Database**                      | Previously relied on Supabase Postgres and in-memory/file queue.                                     | **Missing / Implement (L2)**                     | Build private SQLite database (`keeptrail_local.db`) with tables for receipts, attachments, collections, actions, custom fields.                                            |
| **Durable File Storage**                | Temporary staging paths.                                                                             | **Missing / Implement (L2)**                     | Create durable directory hierarchy (`receipts/originals/`, `previews/`, `staging/`, `backups/`). Byte-for-byte original storage.                                            |
| **Receipt Extraction / OCR**            | Relied on server-side Gemini 1.5/Flash.                                                              | **Adapt / Implement (L1/L3)**                    | On-device OCR / regex-based extractor + manual review UI. Zero external cloud API calls.                                                                                    |
| **Receipt Assistant ("Ask Keeptrail")** | Specified for cloud Gemini in v6.                                                                    | **Adapt / Implement (L1/L4)**                    | Local on-device assistant interface + deterministic financial calculation tools + honestly labeled "Basic Helper" on unsupported phones. No fake self-training claims.      |
| **Backup & Restore**                    | None existed (relied on cloud sync).                                                                 | **Missing / Implement (L5)**                     | Versioned `.keeptrail` encrypted archive (AES-256-GCM + PBKDF2). Portable password recovery.                                                                                |
| **APK Release Packaging**               | Basic Expo dev client configuration.                                                                 | **Missing / Implement (L6)**                     | Add EAS pilot profile (`developmentClient: false`, standalone APK) and release asset configs.                                                                               |

---

## 3. Detailed File-Level Status

### A. Services / Backend (`services/api`) — PARKED

- `services/api/src/katibay_api/main.py`: Preserved intact.
- `services/api/src/katibay_api/extraction/`: Preserved intact.
- `services/api/src/katibay_api/reports/`: Preserved intact.
- `services/api/tests/`: All tests preserved.

### B. Shared Library (`packages/shared`) — KEEP & ADAPT

- `packages/shared/src/i18n/`: Preserved. Add Keeptrail-specific translations as needed.
- `packages/shared/src/brand/`: Update brand identity to Keeptrail evergreen (`#146B55`) and warm neutral (`#F7F8F4`).

### C. Mobile App (`apps/mobile`) — ADAPT FOR LOCAL PILOT

- `apps/mobile/App.tsx`: Refactored to Keeptrail navigation: Home, Receipts, Collections, Reminders, Storage/Backup, and Ask Keeptrail.
- `apps/mobile/src/queue/offline-queue.ts`: Refactored from cloud upload queue to local SQLite transaction queue.
- `apps/mobile/src/sync/sync-manager.ts`: Parked / adapted into local vault synchronization and backup scheduler.
- `apps/mobile/src/screens/CameraScreen.tsx`: Updated to store originals directly into app-private durable storage.
- `apps/mobile/src/screens/ReceiptDetailScreen.tsx`: New local review and source-above-fields editor.
- `apps/mobile/src/screens/CollectionsScreen.tsx`: New local collections management.
- `apps/mobile/src/screens/StorageBackupScreen.tsx`: New encrypted backup export/restore screen.
- `apps/mobile/src/screens/AskKeeptrailScreen.tsx`: New local receipt assistant with deterministic money tools and Basic Helper fallback.

---

## 4. Verification Checkpoint

- No user receipts or credentials exposed in git.
- Git tree is clean on branch `pilot/local-free-apk`.
- Reversible changes only; baseline commit preserved on `main`.
