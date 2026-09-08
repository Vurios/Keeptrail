# Keeptrail — Start Here

Current decision pack • Revision 8 • September 6, 2026

## The decision is now clear

Start with a **free fully local APK pilot**. No Keeptrail accounts, receipt backend, automatic multi-phone sync, live shared collections, subscriptions or cloud AI. Use a pretrained model on the phone, on-device OCR and user-controlled encrypted backup/restore.

Your preferred outcome is a one-time paid local Google Play app. Cloud remains an optional later decision, not the expected next step. This corrects the earlier suggestion to start with a cloud-backed pilot: that suggestion does not match your clarified priority of avoiding accounts and backend costs.

## Which files to use

> **Only `Keeptrail_Free_APK_Pilot_Blueprint_V2.md` (Revision 8) is authoritative.**
> The earlier `Keeptrail_Free_APK_Pilot_Blueprint.md` and the Katibay v2 product
> blueprint have been deleted from this repository. Their M/P prompt sequences,
> cloud/Gemini architecture and passport feature do not apply. Where this file
> and the V2 blueprint disagree, the V2 blueprint wins.

| Order | File                                          | When to use                                                   |
| ----- | --------------------------------------------- | ------------------------------------------------------------- |
| 1     | Keeptrail_Free_APK_Pilot_Blueprint_V2.md      | **The single authoritative build specification (Revision 8)** |
| 2     | Keeptrail_Local_Storage_and_Backup_Guide.md   | Required technical companion during pilot implementation      |
| 3     | Keeptrail_Google_Play_Screenshot_Prompts.md   | Brand/splash concepts now; real release captures later        |
| 4A    | Keeptrail_Local_AI_Offline_Blueprint_v7.md    | Recommended local paid-release path after the pilot           |
| 4B    | Keeptrail_Local_AI_Cloud_Sync_Blueprint_v7.md | Optional alternative only after an explicit cloud decision    |

The two v7 filenames remain stable, but their contents are revised to revision 8. Do not run both release alternatives or combine their account/privacy requirements. This Start Here file is the sixth file in the set.

Older Katibay v2–v5, Keeptrail v6 and Keeptrail_Local_Only_One_Time_Purchase.md are history/reference, not active instructions. The old cloud/Gemini content of the pilot file has been replaced. You do not need to re-run all previous prompts.

## Build order

1. Attach the revised pilot, storage guide and this file to the coding assistant in your actual project.
2. Run pilot L0 to inspect existing work and protect source/data. A direction change is a migration, not a destructive reset.
3. Run L1 to prove on-device OCR and model feasibility on real phones.
4. Run L2–L5 to implement persistent local workflows, recovery and UI. Integrate storage S0–S4 at the matching steps.
5. Run L6 to build/test a signed standalone free APK and L7 for authorized GitHub source/release delivery. Missing repo/signing/permission details must be reported, not guessed.
6. Invite a small varied tester group, record consented feedback, fix defects and retest.
7. Choose 4A by default, or explicitly choose 4B and run a second cloud beta.
8. Prepare an AAB, applicable Play testing/compliance, real screenshots and publication approvals for the selected edition.

An APK is a distribution format, not an architecture. The free APK pilot can—and now does—use the same local architecture as the eventual paid app. It is not a temporary fake system.

## What to learn from the pilot

- Can someone save and later retrieve an important receipt without help?
- Do manual entry and OCR review work when recognition is imperfect?
- Can users understand local storage and restore a complete backup?
- Does the chatbot help with real receipt questions on their phones?
- Do they return voluntarily, and what do they miss without the app?

Measure actual tasks, not just whether people say the screens look nice. If users only need occasional phone replacement, backup transfer may solve the need without automatic sync. A local pilot can reveal demand for cloud features but cannot prove those unbuilt features work.

## Decision after testing

| Evidence                                                                         | Next action                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Useful organizer, acceptable backup experience, no repeated sync need            | Finish local paid-release blueprint                                 |
| Confusing backup, missing originals, data loss or slow chatbot                   | Fix and repeat local pilot; do not hide the problem with cloud      |
| Repeated need for remote recovery/live sharing and owner accepts recurring costs | Use cloud alternative, explicit migration consent and separate beta |
| Little repeated use                                                              | Improve capture/retrieval value before either store launch          |

Keep a common receipt domain, stable IDs and portable archives. Do not pre-build auth/server/billing infrastructure merely because you might want cloud later. Interfaces for storage/query/backup are enough preparation; future sync is real engineering, not a switch that becomes safe automatically.

## First prompt to paste

```text
The product direction has changed. Use Keeptrail_Free_APK_Pilot_Blueprint_V2.md
(Revision 8) and Keeptrail_Local_Storage_and_Backup_Guide.md as the current source
of truth.
Build a real free LOCAL Android APK pilot: no accounts, receipt backend, multi-phone
sync, Gemini/cloud inference, ads, subscriptions or paywalls. Preserve existing
project edits and data. Do not delete the project or reset databases.

Start with pilot L0 and report the migration inventory/checkpoint. Then proceed
through L1–L7 with measured native-model/device tests, durable receipt storage and
complete encrypted backup/restore. Use a pretrained model on device, not a claim
that a chatbot is self-training on users' receipts. Keep deterministic money tools
and an honestly labeled Basic Helper on unsupported phones. Cloud is parked until
the owner chooses it after the local pilot. Do not apply the old v6/Gemini prompts.
Implement and verify; report real test/build results and blockers, not mock success.
```

## Publication notes

A free sideload pilot is different from publishing a free Play app. Decide paid-download pricing before offering the store app free; Google's pricing rules restrict converting a free app to a paid download under the same app. Sideload feedback also does not replace applicable Play closed-testing requirements. Check your actual developer account before scheduling launch.

Receipt storage and on-device inference do not require a recurring Keeptrail backend bill. Store fees, development, support, maintenance and possibly distribution/build services still exist. A purchase restores access to installation, not a user's lost receipts.

Sources: https://support.google.com/googleplay/android-developer/answer/6334373?hl=en and https://support.google.com/googleplay/android-developer/answer/14151465?hl=en (checked September 6, 2026).
