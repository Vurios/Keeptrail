# Keeptrail — project context

Keeptrail is a **fully local** Android receipt organizer. It saves receipts,
payment screenshots and supporting documents on the user's phone together with
the reason they were kept, so the right record can be found, shown or acted on
later.

**The single authoritative specification is `Keeptrail_Free_APK_Pilot_Blueprint_V2.md`
(Revision 8)**, read alongside `Keeptrail_Local_Storage_and_Backup_Guide.md` and
`Keeptrail_Start_Here.md`. The earlier `Keeptrail_Free_APK_Pilot_Blueprint.md`
and `Katibay_Product_Blueprint_v2.md` have been deleted; their M/P prompt
sequences, cloud/Gemini architecture and Purchase Passport feature do not apply.

## Non-negotiable rules

1. **No accounts, no backend, no cloud AI, no sync, no billing** in the app.
   There is no Keeptrail server. Nothing about a receipt leaves the device.
2. No model output ever becomes a financial total. The model may interpret a
   question; application code computes every number.
3. All money is integer minor units with currency-specific precision. Never
   floats. Unknown amounts stay null and are never treated as zero.
4. Currencies are never blended. A receipt filed in several collections is still
   counted once.
5. Uncertain extraction becomes a review item with a precise question. Never
   guess a merchant, amount, warranty or return deadline.
6. Never claim in the UI or in docs something the code does not do — no "backed
   up" without a written file, no "SQLite" without a database, no "AI" over a
   rule-based helper. Honesty about limits is a product requirement, not a
   nicety.
7. UI never hardcodes colors or dimensions. Every mobile component consumes the
   tokens in `apps/mobile/src/theme/tokens.ts` through `useTheme()`, and the
   shared primitives in `apps/mobile/src/components/primitives.tsx`.
8. Locales: 'en' and 'fil' only.

## Stack

**Shipping app:** React Native + Expo + TypeScript, app-private file storage,
on-device text extraction, AES-256-GCM encrypted backup archives.

**Preserved, not shipped:** `services/api` (FastAPI), `apps/web` (Next.js) and
`supabase/` are retained Katibay history for a possible future cloud edition.
They are not part of the local pilot and the app does not reach them.

## Conventions

snake_case in Python and SQL, camelCase in TypeScript. Domain types shared via
`packages/shared`. Every endpoint and every user-visible guarantee gets a test —
`apps/mobile/src/__tests__/local-only-guarantee.test.ts` is what keeps rule 1
true over time.
