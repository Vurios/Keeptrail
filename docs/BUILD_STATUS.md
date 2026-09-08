# Keeptrail Local Android Pilot — Build Status

**Edition:** Free Local Android APK Pilot
**Source of truth:** `Keeptrail_Free_APK_Pilot_Blueprint_V2.md` (Revision 8) and
`Keeptrail_Local_Storage_and_Backup_Guide.md`
**Branch:** `pilot/local-free-apk`
**Release:** v1.1.1 (versionCode 6)
**Last audited:** September 9, 2026

---

## How to read this file

Every row states what is implemented and names the file, command or device test
that proves it. A stage is **Done** only when its behaviour is exercised by a
test that runs in CI or by a verified artifact.

An earlier revision of this document marked all fifteen stages VERIFIED,
including stages with no implementation. Those claims were corrected; this file
is the easiest place in the repository to break the rule that nothing is
reported without evidence.

---

## 1. Stage status

| Stage                   | Scope                                                                                                                    | Status                           | Evidence                                                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L0**                  | Safe migration; preserve prior work; strip account/sync/Gemini/billing from the local variant                            | **Done**                         | `docs/MIGRATION_AUDIT.md`; `services/api`, `apps/web`, `supabase/` intact with 83 pytest passing; sync manager, upload queue, queue/camera/passport screens removed; enforced every run by `apps/mobile/src/__tests__/local-only-guarantee.test.ts`                                                     |
| **L1**                  | Physical-device spike: bundled OCR, embedded inference, pinned licensed model                                            | **Gate not passed — documented** | `docs/L1_MODEL_GATE.md`. `llama.rn` has no stable release (`latest` is `0.13.0-rc.2`); a 4-bit 1.5B model takes the sideload artifact past 1 GB; no device tiers available to benchmark. Basic Helper remains the sole mode, as §5 permits                                                              |
| **S0**                  | Durable file lifecycle, checksums, crash-safe writes, reconciliation                                                     | **Done**                         | `apps/mobile/src/storage/file-vault-store.ts` writes under `Paths.document`, reads back every index write before rotating the previous copy; `reconcileAttachments()` in `local-vault.ts`; device-verified below                                                                                        |
| **S1**                  | Reviewed encryption, platform key handling, no hardcoded keys, storage controls, Trash                                   | **Done**                         | Index and every original sealed with AES-256-GCM under a device key held in `expo-secure-store` (`storage/vault-key.ts`, `storage/encrypted-vault-store.ts`); CSPRNG from `expo-crypto` with no `Math.random` fallback; `allowBackup="false"` keeps records out of Android's cloud backup               |
| **L2**                  | Schema and migrations, camera/gallery/file capture, tags, custom fields, duplicates, Trash, draft survives process death | **Done**                         | Versioned index with additive v1→v2 migration; `services/capture-sources.ts` (camera, gallery, document import) with permission at point of use; tags, typed custom fields, hash and field-similarity duplicate suggestions; capture drafts persisted with their originals and offered back on relaunch |
| **S2**                  | Versioned `.keeptrail` export, manifest hashes, authenticated encryption, document picker                                | **Done**                         | `backup-encryption.ts` writing a real file; `services/exports.ts` adds the system document picker for restore-from-anywhere and the share sheet for sending an archive off the device                                                                                                                   |
| **S3**                  | Staged validated restore; wrong password, corruption and interruption leave records untouched                            | **Done**                         | Decryption and every SHA-256 verified before any record is written; proven in `pilot-acceptance.test.ts` for a wrong password and a tampered archive                                                                                                                                                    |
| **L3**                  | Reminders with notifications, timezone and reboot handling; per-currency summaries; PDF/CSV exports                      | **Done**                         | `services/reminder-notifications.ts` schedules at 09:00 local on the due date from calendar parts, re-syncs on launch, cancels on completion or deletion; CSV and PDF built by `local-reports.ts` with formula-injection escaping and per-currency separation                                           |
| **S4**                  | Typed read-only tools, full-scope aggregation, injection resistance, on-device benchmark                                 | **Done**                         | `assistant-engine.ts` read-only and deterministic; `services/device-benchmark.ts` measures encryption, backup derivation and search on the device against the real vault, replacing the simulated Node timings                                                                                          |
| **L4**                  | Ask Keeptrail on an embedded model                                                                                       | **Basic Helper only, by design** | No model runtime ships, so §5's second mode is the only one. `isModelAvailable: false`; the app bar and the opening message both say it is rule-based, not a chatbot                                                                                                                                    |
| **Visual system**       | Named palette, 4/8/12/16/24/32 spacing, 16sp body, 48dp targets, font scaling, reduced motion                            | **Done**                         | `theme/tokens.ts`, `theme/ThemeContext.tsx`, `components/primitives.tsx`; consumed by every shipped screen                                                                                                                                                                                              |
| **Logo**                | Symbol, wordmark, monochrome, adaptive icon, splash-safe symbol                                                          | **Done**                         | Six SVGs in `packages/shared/brand/keeptrail/`; adaptive icon layers in `apps/mobile/assets/`; `keeptrail-brand.test.ts`                                                                                                                                                                                |
| **Onboarding & splash** | Three steps; no account recovery explained; never seed fake receipts into real totals                                    | **Done**                         | `screens/OnboardingModal.tsx`; first-run flag persisted; sample data is an explicit, labelled, disposable choice                                                                                                                                                                                        |
| **L5**                  | Airplane mode, force-stop and reboot verified on a device                                                                | **Done**                         | Emulator (Android 16, x86_64). Screenshots in `dist/screens/`: `L5-forcestop.png`, `L5-airplane.png`, `L5-reboot.png`                                                                                                                                                                                   |
| **L6**                  | Signed standalone release APK; clean install; upgrade preserving records                                                 | **Done**                         | `dist/keeptrail-pilot-v1.1.1.apk`, locally built and signed. Clean install and in-place upgrade over v1.1.0 both verified, `dist/screens/L6-upgrade.png`                                                                                                                                                |
| **L7**                  | Authorized GitHub push                                                                                                   | **Done**                         | Pushed to `github.com/Vurios/Keeptrail.git` on `pilot/local-free-apk`                                                                                                                                                                                                                                   |

---

## 2. Test and build results

```text
$ pnpm -r typecheck
packages/shared typecheck: Done
apps/mobile   typecheck: Done
apps/web      typecheck: Done

$ pnpm -r lint
packages/shared lint: Done
apps/web       lint: Done

$ npx vitest run --root packages/shared
      Tests  105 passed (105)

$ cd apps/mobile && npx vitest run
      Tests  44 passed (44)

$ cd services/api && python -m pytest -q
83 passed, 1 skipped, 1 warning

$ cd services/api && python -m ruff check src tests
All checks passed!

$ cd apps/mobile/android && ./gradlew assembleRelease
BUILD SUCCESSFUL
```

**Totals: 149 TypeScript tests, 83 Python tests, 0 type errors, 0 lint errors.**

### Release artifact

- **File:** `dist/keeptrail-pilot-v1.1.1.apk`
- **Size:** 77,349,575 bytes
- **SHA-256:** `17ca3241fa50b4a6e130fa9e9e25cb1094e389a1f1a6dbde543c835c418e63fb`
- **Package:** `com.keeptrail.app`, versionCode 6, versionName 1.1.1
- **Signing certificate SHA-256:**
  `69326c85676279c583d94664530194b8e859478cb360482845aaf6b8f3d72200`
  (`CN=Keeptrail Pilot, O=Keeptrail, C=PH`)
- Built locally with Gradle. The keystore lives outside the repository and is
  supplied as Gradle properties; `apps/mobile/plugins/with-release-signing.js`
  reapplies the signing config on every prebuild so the build is reproducible.

### Device verification (Android 16 emulator, x86_64)

| Check                              | Result                                                     |
| ---------------------------------- | ---------------------------------------------------------- |
| Clean install and first launch     | Onboarding shown, vault created                            |
| Save records, force-stop, relaunch | All records, totals, reminders and collections restored    |
| Cold start in airplane mode        | Fully functional, no degradation                           |
| Full device reboot                 | All records intact                                         |
| In-place upgrade v1.1.0 → v1.1.1   | No data loss                                               |
| Exact money on device              | ₱302.40 + ₱1,250.00 rendered as ₱1,552.40 across 2 records |

---

## 3. Defects this device pass found

Three bugs that every Node-based test passed straight through, because they are
differences between Node's `Buffer` and the `buffer` polyfill that ships in the
React Native bundle. All are fixed, and all now have regression tests that run a
plain `Uint8Array` through the same paths:

1. **`Buffer.copy` into a `Uint8Array` target.** Node accepts it; the polyfill
   throws `argument should be a Buffer`. The AES key schedule used it, so the
   vault could not be opened at all on device.
2. **`subarray(...).toString("ascii")`.** Node's `subarray` returns a Buffer and
   decodes as text; the polyfill returns a plain `Uint8Array`, whose `toString`
   yields `"75,84,83,49"` instead of `"KTS1"`. Every valid sealed blob and every
   valid backup archive was rejected on device.
3. **Stage-then-rename index writes.** The temporary file verified correctly at
   write time and still produced an unreadable index after relaunch. Replaced
   with a direct write plus a retained previous copy, so at every instant one of
   the two files holds a complete index.

A fourth, more serious defect was found by reading the code during the
investigation: `LocalReceiptVault.load()` swallowed read errors and the
constructor then wrote a fresh empty index over the user's data. An unreadable
vault now throws and reaches the user as a failure they can act on.

---

## 4. Operational disclosure

- **No network code ships, and the OS enforces it.** The release APK does not
  request `INTERNET`. `local-only-guarantee.test.ts` fails the build on `fetch`,
  `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`, any `http(s)`
  endpoint literal in executable code, any cloud/auth/analytics/billing/remote-AI
  dependency, and any mention of a remote AI provider. It also asserts the
  manifest: no overlay, legacy storage, audio, FCM push or install-referrer
  permission, `allowBackup="false"`, system Back intact.
- **Permissions requested:** `CAMERA` (photo capture), `POST_NOTIFICATIONS` and
  `SCHEDULE_EXACT_ALARM` (reminders), `VIBRATE` (haptics), plus
  `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` and `USE_BIOMETRIC` pulled in by the
  notification and secure-store modules. OEM launcher badge permissions from
  `expo-notifications` remain; they are not network-related and blocking each
  vendor variant is not worth the churn.
- **The shipped cryptography is tested against published vectors.** Metro
  substitutes `apps/mobile/src/shims/crypto-shim.js` for Node's `crypto`, so the
  shared package's tests never exercise what the APK runs.
  `crypto-shim.test.ts` closes that gap with FIPS-180-4 SHA-256 and NIST AES-GCM
  vectors plus byte-exact agreement with Node.
- **There is no on-device neural model.** Ask Keeptrail runs a deterministic
  rule-based helper and says so.
- **There is no text recognition.** A photo is stored as the original and its
  fields are typed by hand; the capture screen states this rather than implying
  the image was read.
- **The preserved Katibay backend** (`services/api`, `apps/web`, `supabase/`) is
  retained history. It is not part of this build and the app cannot reach it.

---

## 5. Known gaps

- **L1 model gate** is unstarted work, not a defect. See `docs/L1_MODEL_GATE.md`.
- **Signing continuity with v1.0.x is broken.** Those builds were signed by an
  EAS-managed key that is not available locally, so v1.1.1 cannot upgrade over
  them — a tester on v1.0.2 must uninstall first, losing local data unless they
  export a backup. Either recover the EAS keystore or treat v1.1.1 as the new
  signing baseline.
- **Device coverage is one emulator.** Gestures, real cameras, refresh rates and
  thermal behaviour still need hardware.
- **PDF page rendering for imported PDFs** is not implemented; a PDF is stored
  as the original and its fields are typed.
