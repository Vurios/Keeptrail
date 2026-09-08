# Keeptrail Tester Guide — Free Local Android APK Pilot

**App:** Keeptrail
**Package ID:** `com.keeptrail.app`
**Version:** `1.1.1` (versionCode `6`)
**APK:** `dist/keeptrail-pilot-v1.1.1.apk` (77,349,575 bytes)
**SHA-256:** `17ca3241fa50b4a6e130fa9e9e25cb1094e389a1f1a6dbde543c835c418e63fb`
**Signing certificate SHA-256:** `69326c85676279c583d94664530194b8e859478cb360482845aaf6b8f3d72200`

> **If you already have v1.0.x installed, uninstall it first.** This build is
> signed with a different key, so Android will refuse to install it over the old
> one. Uninstalling deletes the receipts that version stored, so export a backup
> from the old app first if you want to keep them.

> **This build has no internet permission at all.** Android will not let it make
> a network request even if it tried to. Nothing about your receipts can leave
> the phone except through a file you export and send yourself.

---

## 1. What is Keeptrail?

Keeptrail is a free, 100% local Android receipt organizer designed to save paper receipts, payment screenshots, and supporting invoices with the reason you saved them—so you can find them and use them when it matters.

### Strict Local Pilot Guarantees:

- **No Accounts:** No email, password, or cloud account creation.
- **No Receipt Backend:** Your receipts, images, and notes never leave your device.
- **No Cloud AI / No Gemini API:** OCR and query tools run entirely on-device; numbers are computed with deterministic application code, never guessed by an LLM.
- **No Ads, Subscriptions, or Paywalls:** All features are unlocked and free during the pilot.
- **User-Controlled Encrypted Backup:** Export `.keeptrail` backup containers protected with AES-256-GCM and PBKDF2 (100,000 rounds SHA-256).

---

## 2. Installation & Update Instructions

### Fresh Installation

1. Download `keeptrail-pilot-v1.0.2.apk` on your Android device (Android 10+ recommended).
2. Tap the downloaded file in your browser or file manager.
3. If prompted: **"For your security, your phone is not allowed to install unknown apps from this source"**, tap **Settings** and enable **"Allow from this source"** for your browser or file manager only.
4. Tap **Install**.
   > **Note on Play Protect:** If Android Play Protect shows a prompt for unknown developer certification, tap "Install anyway". **Never** disable Play Protect globally on your device.
5. Open Keeptrail from your app drawer.

### Updating to a Newer APK Build

- Install the new APK over the existing installation.
- Your local receipts, attachments, collections and settings are preserved in the app's private vault across updates.
- **Warning:** Do not uninstall the app to update, as Android removes app-private storage on uninstallation. Always export a `.keeptrail` backup before major updates.

---

## 3. End-to-End Tester Script (10 Steps)

Follow this test script to verify all core capabilities:

1. **Launch & Onboarding (Prompt U1):**
   - Open Keeptrail. Review the Welcome screen ("Keep the receipts that matter").
   - Tap **"Get started"** to view the Local Vault Notice explaining on-device privacy.
   - Tap **"I understand — Continue"**.
2. **First Capture & Quick Save:**
   - Tap **"Choose a photo"** or **"Enter manually"**.
   - Enter a merchant (e.g., `National Bookstore`) and amount (e.g., `₱450.00`).
   - Tap **"Save receipt"**. Notice the confirmation: _"Saved on this phone"_.
3. **Inspect the Receipts Tab:**
   - Tap the **Receipts** tab at the bottom.
   - Switch between **All** and **Needs Review**.
   - Tap a receipt to open the full review modal with source-above-fields layout.
4. **Test Deterministic Money Calculations:**
   - On the **Home** tab, observe the spending card.
   - Verify that Philippine Pesos (`₱`) and US Dollars (`$`) are strictly segregated and never summed together.
   - Notice that receipts without an amount are labeled _"1 receipt with unknown amount excluded from sum"_.
5. **Add Custom Collections:**
   - Navigate to the **Collections** tab.
   - View default collections (_Purchases_, _Work Expenses_, _Tax Season_).
   - Tap to view receipts filtered by that collection.
6. **Set a Deadline or Warranty Reminder:**
   - Navigate to the **Reminders** tab.
   - Check due dates and tap the status toggle to mark an action completed or pending.
7. **Test "Ask Keeptrail" (Local Assistant):**
   - On the Home tab, tap the **✨ Ask Keeptrail** banner.
   - Ask: _"What is my total spend?"_
   - Observe the calculation card and the honest label: _"Basic Helper • Deterministic Local Engine"_.
   - Ask: _"Which receipts need review?"_ and tap a source chip.
8. **Export Encrypted Backup (.keeptrail):**
   - From the top-right header, tap the **🔒 Vault** button to open **Storage & Backup**.
   - Review storage breakdown (Originals, Database, Previews, Total).
   - Under **Export Encrypted Backup**, enter a strong password (e.g., `pilot2026`).
   - Tap **Export Encrypted Backup**.
   - Observe the confirmation and the file hash. Keep a copy away from this phone (e.g., USB or computer).
9. **Test Trash & Soft-Delete Lifecycle:**
   - In the Receipts tab, tap a receipt and select **Move to Trash**.
   - Switch to the **Trash** tab. Tap **Restore** to bring it back.
10. **Test Airplane Mode (Strict Offline Verification):**
    - Turn on Airplane Mode on your phone.
    - Add a new receipt, search by merchant, and query the assistant.
    - Confirm all features work seamlessly with zero internet connection.

---

## 4. Known Operational Limitations

- **Neural Model Acceleration:** On low-end or unsupported devices (RAM < 4GB), the local assistant runs the deterministic **Basic Helper** engine instead of loading large neural network weights.
- **Backup Passwords:** Because Keeptrail has no accounts or server, backup passwords cannot be reset. If you lose the password, encrypted backup files cannot be restored.
- **Support & Bug Reports:** Send consented feedback and non-sensitive logs to the project repository issues page. Do not include sensitive receipts in bug reports.
