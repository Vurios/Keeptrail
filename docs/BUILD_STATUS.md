# Keeptrail Local Android Pilot — Build Status

**Edition:** Free Local Android APK Pilot
**Source of truth:** `Keeptrail_Free_APK_Pilot_Blueprint_V2.md` (Revision 8) and
`Keeptrail_Local_Storage_and_Backup_Guide.md`
**Branch:** `pilot/local-free-apk`
**Last audited:** September 8, 2026

---

## How to read this file

Every row states what is actually implemented and names the file or command that
proves it. A stage is only **Done** when its behaviour is exercised by a test
that runs in CI or by an artifact on disk.

A previous revision of this document marked all fifteen stages **VERIFIED**,
including stages with no implementation at all. Those claims are corrected
below. The blueprint forbids reporting a test pass or an APK build without
evidence, and this file is the place that rule is easiest to break.

---

## 1. Stage status

| Stage                   | Scope                                                                                                                                                 | Status                | Evidence                                                                                                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L0**                  | Safe migration; preserve prior work; strip account/sync/Gemini/billing from the local variant                                                         | **Done**              | `docs/MIGRATION_AUDIT.md`; `services/api`, `apps/web`, `supabase/` untouched and 83 pytest passing; sync manager, upload queue, queue screen, camera screen, passport screen and sync status chip removed; enforced by `apps/mobile/src/__tests__/local-only-guarantee.test.ts` |
| **L1**                  | Physical-device spike: bundled OCR, PDF rendering, SQLite, embedded inference, pinned licensed model                                                  | **Missing**           | No ML Kit, llama.cpp bridge, model weights, SQLite or PDF renderer in `apps/mobile/package.json`. `packages/shared/src/local-pilot/ocr-extractor.ts` parses text; it is not an OCR engine. No device benchmark has been run                                                     |
| **S0**                  | Durable file lifecycle, authoritative data out of cache, checksums, crash-safe staged commits, reconciliation                                         | **Done**              | `apps/mobile/src/storage/file-vault-store.ts` writes under `Paths.document`; index staged to `.tmp` then moved into place; `reconcileAttachments()` in `packages/shared/src/local-pilot/local-vault.ts`; covered by `pilot-acceptance.test.ts` ("durability across a restart")  |
| **S1**                  | Reviewed encryption and platform key handling; no hardcoded keys; storage totals; Trash                                                               | **Partial**           | CSPRNG comes from `expo-crypto` with no `Math.random` fallback (`crypto-shim.js`); the hardcoded demo password is gone. **Still missing: at-rest encryption of the record index and originals, and OS cloud-backup exclusion rules beyond `allowBackup=false`**                 |
| **L2**                  | Canonical schema and migrations; camera/gallery/Share/PDF capture; tags and custom fields; duplicate suggestions; Trash; draft survives process death | **Partial**           | Records, attachments, collections and actions persist with a versioned index and additive collection migration. **Missing: camera, gallery, Android Share, PDF rendering, tags, custom fields, duplicate detection, capture draft recovery**                                    |
| **S2**                  | Versioned `.keeptrail` export with manifest hashes and authenticated encryption                                                                       | **Partial**           | `backup-encryption.ts` (AES-256-GCM, PBKDF2-SHA256 100k) writing a real file to `<documents>/keeptrail/backups/`. **Missing: the Android document picker, so the archive lands in app-private storage the user must reach with a file manager**                                 |
| **S3**                  | Staged validated restore; wrong password, corruption and interruption leave records untouched                                                         | **Done**              | Decryption and every SHA-256 are verified before any record is written; `pilot-acceptance.test.ts` proves an existing vault is unchanged after a wrong password and after a tampered archive                                                                                    |
| **L3**                  | Reminders with notifications, timezone and reboot handling; per-currency summaries; PDF/CSV exports                                                   | **Partial**           | Reminders sort by urgency and state overdue/soon in words; per-currency totals are exact and never blended. **Missing: OS notifications and PDF/CSV export**                                                                                                                    |
| **S4**                  | Typed read-only tools, full-scope aggregation, injection resistance, benchmark, labelled Basic Helper                                                 | **Partial**           | `assistant-engine.ts` is read-only and deterministic; injection resistance covered by `local-ai-benchmark.test.ts`. The benchmark is a Node unit test, not a measurement on device                                                                                              |
| **L4**                  | Ask Keeptrail on an embedded model                                                                                                                    | **Partial by design** | No model runtime ships, so the honest Basic Helper is the only mode — permitted by blueprint §5. `isModelAvailable: false` in `apps/mobile/src/vault-context.tsx`, and the screen says so in its app bar                                                                        |
| **Visual system**       | Named palette, 4/8/12/16/24/32 spacing, 16sp body, 48dp targets, font scaling, reduced motion                                                         | **Done**              | `apps/mobile/src/theme/tokens.ts`, `theme/ThemeContext.tsx`, `components/primitives.tsx`; every shipped screen consumes them                                                                                                                                                    |
| **Logo**                | Symbol, wordmark, monochrome, adaptive icon, splash-safe symbol                                                                                       | **Done**              | Six SVGs in `packages/shared/brand/keeptrail/`; adaptive icon layers in `apps/mobile/assets/`; `keeptrail-brand.test.ts`                                                                                                                                                        |
| **Onboarding & splash** | Three steps; no account recovery explained; never seed fake receipts into real totals                                                                 | **Done**              | `apps/mobile/src/screens/OnboardingModal.tsx`; first-run flag persisted in `App.tsx`; sample data is an explicit, labelled, disposable choice                                                                                                                                   |
| **L5**                  | Apply visual prompts; audit release traffic, OS backup rules, logs; airplane-mode verification                                                        | **Partial**           | Network absence is enforced by `local-only-guarantee.test.ts` (13 checks over the real source tree and dependency list). **Not done: on-device airplane-mode, force-stop and reboot verification**                                                                              |
| **L6**                  | Signed standalone release APK; clean install; upgrade preserving records                                                                              | **Stale**             | `dist/keeptrail-pilot-v1.0.{0,1,2}.apk` are real, signed EAS artifacts, but every one predates the current code. **No APK reflects this build**                                                                                                                                 |
| **L7**                  | Authorized GitHub push and Release                                                                                                                    | **Blocked**           | No authorized remote, branch or visibility has been supplied. See §4                                                                                                                                                                                                            |

---

## 2. Test and build results

Commands run on September 8, 2026, output as reported by the tools.

```text
$ pnpm -r typecheck
packages/shared typecheck: Done
apps/mobile   typecheck: Done
apps/web      typecheck: Done

$ pnpm -r lint
packages/shared lint: Done
apps/web       lint: Done

$ npx vitest run --root packages/shared
 Test Files  11 passed (11)
      Tests  68 passed (68)

$ cd apps/mobile && npx vitest run
 Test Files  3 passed (3)
      Tests  39 passed (39)

$ cd services/api && python -m pytest -q
83 passed, 1 skipped, 1 warning

$ cd services/api && python -m ruff check src tests
All checks passed!
```

**Totals: 107 TypeScript tests, 83 Python tests, 0 type errors, 0 lint errors.**

No APK was built during this session, and none is claimed.

---

## 3. Operational disclosure

- **No network code ships.** `apps/mobile/src/__tests__/local-only-guarantee.test.ts`
  walks the shipped source tree and the dependency list on every run and fails
  the build on `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`,
  `EventSource`, any `http(s)` endpoint literal in executable code, any cloud,
  auth, analytics, billing or remote-AI dependency, and any mention of a remote
  AI provider. The Android manifest is asserted too: no overlay or legacy
  storage permission, `allowBackup="false"`, system Back left intact.
- **The `INTERNET` permission is still declared.** Removing it would be the
  strongest possible proof of the local-only claim, and there are no call sites
  that need it, but it would also break the Expo development workflow on device.
  This is an owner decision; see §4.
- **The shipped cryptography is tested.** Metro substitutes
  `apps/mobile/src/shims/crypto-shim.js` for Node's `crypto`, so the shared
  package's backup tests never exercise what the APK actually runs.
  `apps/mobile/src/__tests__/crypto-shim.test.ts` closes that gap with published
  SHA-256 and NIST AES-GCM vectors plus byte-exact agreement with Node.
- **There is no on-device neural model.** Ask Keeptrail runs a deterministic
  rule-based helper and labels itself as one. It is not marketed as a chatbot.
- **Camera and gallery capture are not implemented.** The capture screen says so
  rather than substituting a canned sample behind a camera button.
- **The preserved Katibay backend** (`services/api`, `apps/web`, `supabase/`)
  remains intact as history. It is not part of the local pilot build and is not
  reachable from the app.

---

## 4. Open blockers requiring the owner

1. **L7 GitHub handoff.** The authorized remote, branch and repository
   visibility have not been supplied. Nothing has been pushed.
2. **Commit attribution conflict.** Blueprint L7 forbids bot co-author trailers
   on new commits, while this session is configured to add one. Confirm which
   rule wins before any commit is made.
3. **`INTERNET` permission.** Confirm whether to drop it from the release
   profile, accepting that on-device development builds will need it re-added.
4. **L1 model gate.** Selecting, licensing and benchmarking an on-device model
   is unstarted work, not a defect to be fixed in this pass.
