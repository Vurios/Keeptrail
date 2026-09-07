# Keeptrail — Local Receipt Storage, Recovery and Research

Required companion to the free local APK pilot and local paid-release blueprint • September 6, 2026

## 1. Recommended approach in plain language

Use a **private receipt vault on the phone**, plus **encrypted backup files the user controls**. No receipt storage subscription or Keeptrail account is required. You are building a local database, not eliminating the database entirely.

The database stores searchable information. Separate private files store the actual photos, screenshots and PDFs. Backup archives contain both, so users can recover the complete collection rather than just a list of amounts.

| Layer            | Contains                                                                                | Location and behavior                                               |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Primary database | IDs, merchant/date/money, notes, tags, collections, field definitions, attachment links | Durable private SQLite database with tested encryption/migrations   |
| Primary evidence | Imported originals and captured receipt images/PDFs                                     | Durable app-private files; never cache-only                         |
| Derived files    | Thumbnails, PDF renderings and temporary previews                                       | Rebuildable cache; safe to clear when no job uses them              |
| Chat and indexes | Device-only conversation, retrieval index, OCR text                                     | Private local storage; delete/rebuild controls as appropriate       |
| Model assets     | Pinned pretrained model/tokenizer                                                       | Separate installed asset area; not copied into receipt backups      |
| Recovery archive | Consistent metadata plus every selected original and integrity manifest                 | Encrypted file saved through the user's chosen document destination |

This is a proposed Keeptrail design, not a claim about Tarsi's internal database implementation.

## 2. What the research found

### Tarsi by Bryl Lim

Tarsi's current Play listing advertises on-device daily backups and CSV/JSON export. Its privacy policy describes local-by-default operation, optional Tarsi Cloud and possible Gemini API features. The listing also uses broader all-local wording, so the public descriptions differ in scope. Treat them as developer descriptions, not a technical audit. Do not repeat the earlier assumption that every Tarsi assistant is necessarily offline or identify an unverified internal model/database.

Lesson for Keeptrail: provide understandable local ownership and export, but give edition-specific privacy explanations. A receipt app also needs the image/PDF files in its recovery format; transaction CSV alone is not sufficient.

Sources: https://play.google.com/store/apps/details?hl=en&id=com.tarsi.app and https://tarsi.pocketdevs.ph/privacy (checked September 6, 2026).

### Smart Receipts

Its official Data & Backups article distinguishes local storage for Free/LITE from cloud backup for PRO/MAX. It warns that unsynchronized data may be unrecoverable if the device is lost, and says manual backup is not currently offered. This is a useful comparison of storage tradeoffs, not an instruction to copy its subscription model.

Lesson for Keeptrail: make a complete user-controlled backup and restore workflow a first-release feature, not an afterthought. Source: https://help.smartreceipts.co/en/articles/14307311-data-backups (checked September 6, 2026).

### Android behavior that affects the design

App-specific files are removed on uninstall. User-created documents outside app-specific storage, accessed through the Storage Access Framework, can remain after uninstall. SAF also lets users choose local or cloud-backed document providers. Android Auto Backup is a separate cloud mechanism with a 25 MB per-app-user limit, so it is not a sound primary design for a growing receipt-image vault. These facts motivate separate durable storage and explicit archives; no backup can guarantee survival of every failure.

Sources: https://developer.android.com/training/data-storage/app-specific ; https://developer.android.com/training/data-storage/shared/documents-files ; https://developer.android.com/identity/data/autobackup (checked September 6, 2026).

## 3. What happens when someone saves a receipt

1. Import/capture into a private staging file and validate type, size and supported page limits. A picker URI alone is not ownership of the source file.
2. Copy the selected original bytes into durable private storage. Do not depend on the source remaining in Gallery/Downloads or on temporary access grants.
3. Assign an attachment ID and checksum, record dimensions/page count/MIME and safe relative storage key. Do not use merchant names as file paths.
4. Commit the receipt and attachment state with crash-recovery bookkeeping. Coordinate filesystem and database operations explicitly; they are not one atomic database transaction.
5. Mark “Saved on this phone” only once the durable copy and metadata are recoverable. Run local OCR and thumbnails separately; failure does not delete the saved evidence.

Use staging/ready states and a startup reconciliation job for interrupted writes. Validate orphan files before cleanup and never remove unknown files simply because a query temporarily failed. On low space, preserve current records and explain what failed.

Store images/PDFs as files, not base64 strings in SQLite. Use attachment links and relative storage keys rather than fragile absolute paths or public URLs. Keep imported originals byte-for-byte; crop, enhance, downscale and redact only derived copies. For new camera captures choose a readable capture setting before the first saved original is produced. Never silently shrink old evidence to meet a storage target.

Encrypted vault integration must protect database, evidence and sensitive indexes consistently. Use reviewed libraries and native platform key protection. Biometric UI alone does not encrypt receipts. Document key invalidation, device lock and recovery behavior; never put a fixed encryption key in source code.

## 4. How much phone storage?

Show actual measured use, not a promised number of unlimited receipts. Provide separate totals for originals, database/index, previews, local backup copies and model assets.

Illustrative arithmetic, not a measured Keeptrail compression result: 1,000 single-image receipts averaging 600 KB use about 600 MB in decimal units; 5,000 average about 3 GB. If a full backup is retained on the same phone, it can roughly double the receipt portion before temporary export overhead. PDFs/multiple pages and the model can add substantially more.

A small model's quantized weights may still be hundreds of MB or more; installed size and runtime memory are different. Measure both. Do not display “500 MB free” as enough for a 500 MB backup when staging/validation also needs space.

Storage UI should offer: clear rebuildable previews, inspect large files, export a backup, remove old user-approved backups, and empty Trash with confirmation. It must not automatically delete original receipts, unexported drafts or a user's only recovery copy. Shared references count once when calculating attachment usage.

## 5. Backup choices and the best default

| Choice                                                    | Benefit                                              | Limitation                                                                                |
| --------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| In-app recovery snapshot                                  | Helps recover an accidental edit or failed migration | Usually lost with app data/uninstall; not off-device protection                           |
| Encrypted archive in user-selected local Documents folder | Independent backup file, can survive uninstall       | Same phone can still be lost or fail                                                      |
| Copy archive to computer or USB drive                     | No Keeptrail server; off-device recovery             | User must make and retain the copy                                                        |
| User selects their Drive/other provider in system picker  | Convenient user-controlled external copy             | Third-party cloud, account/quota/connectivity rules apply; not strictly all-local storage |
| Keeptrail hosted sync                                     | Managed remote access/recovery                       | Separate cloud product and ongoing operating cost                                         |

Recommended pilot default: private local vault + prominent **Back up receipts** action exporting an encrypted archive; encourage a computer/USB copy. A cloud document-provider destination is optional and user initiated, not a hidden integration or Keeptrail backend. No direct Drive API/OAuth/sync implementation is needed in the pilot. Never claim provider export proves a remote upload completed if the provider acknowledges only a local write.

A friendly Storage & Backup screen shows last successful export, included receipt/file count, changes since that export, destination label and whether a restore was actually tested. Distinguish “Export completed” from “Off-device backup confirmed.” Do not claim knowledge of physical storage location just from a URI. Permit a user to confirm they copied the archive elsewhere, labeled as self-reported.

Offer a dismissible weekly backup reminder or one after a configurable number of new receipts. Ask notification permission only if enabled. Do not block capture on backup setup. A user who skips receives a clear risk explanation, not guilt or repeated nagging.

Optional automatic local backup can follow after reliable manual recovery: use a user-granted folder, handle permission loss, document-provider limitations, power restrictions and foreground catch-up. Do not promise nightly completion. Retain a small user-configurable set only after successful new-backup validation and delete only archives the app created with explicit retention consent. If permission is lost, never replace the path with a silent public or cloud destination.

## 6. Complete archive format and encryption

Use a versioned `.keeptrail` archive format implemented with reviewed primitives, not a custom cipher. Inside its encrypted payload include a manifest, portable structured records and all selected original attachments. Record format/schema version, export ID, creation time, receipt/attachment counts, relative paths, lengths and cryptographic hashes. Keep filenames/merchant details out of the unencrypted header.

Exclude model weights, caches, regenerable indexes, device credentials and chat history by default. If chat export is added, require an explicit separate checkbox. CSV/PDF are report formats, not complete recovery archives.

Use authenticated encryption and a reviewed password-based key derivation implementation with explicit versioned parameters and unique salts/nonces. Benchmark safe parameters on supported devices; never invent cryptography. For large data use a reviewed streaming authenticated format rather than loading everything into JavaScript memory. Do not write a plaintext temporary archive into public storage.

The export password must let users restore on a different phone; encrypting only with a device-bound Keystore key defeats portable recovery. Never export that device key. For optional unattended backups, document how a backup key is securely wrapped and what device access allows; the initial manual pilot can ask for the password each time without retaining it. Explain there is no server password reset. Allow secure password-manager storage, not emailing the password automatically.

Create a consistent snapshot: use supported SQLite snapshot/backup facilities or a transactionally consistent logical export, and bind attachment versions to that snapshot. Copying a live SQLite main file while ignoring journal/WAL state is not a reliable backup. Stream files, verify output, mark success only at the supported completion point and preserve previous valid backups on failure.

## 7. Restore is part of the product

1. Choose archive; check size/type; ask password locally.
2. Validate authenticated contents, archive version, supported schema, relative paths, counts and hashes. Reject zip-slip, symlinks where unsafe, decompression bombs, duplicate paths and excessive resource use.
3. Stage records and files; show preview and selected restore policy. MVP default: restore into an empty/new vault. Never silently replace a nonempty vault.
4. For merging, use stable IDs/checksums and explicit conflict handling. If safe merge is not implemented, offer export of existing data and a separate restored vault rather than destructive overwrite.
5. Commit with recoverable bookkeeping; leave the current vault unchanged on failure. Re-encrypt under the destination device's new protected keys and rebuild indexes.
6. Open sample originals and compare metadata/attachment counts before marking restoration verified. Reset/reconcile notification schedules without duplicate alerts.

Test on a clean test device with the old app unavailable. Also test wrong password, corrupt/truncated archive, low space, killed import, newer unsupported schema, duplicate import, large PDF, missing original and key invalidation. Never use a tester's only live dataset for destructive tests.

## 8. UI copy to use

- Capture success: “Saved on this phone.”
- Backup not set up: “Your receipts are stored here. Export a backup to protect against loss or uninstall.”
- Same-phone export: “Backup file saved. Keep a copy away from this phone.”
- Optional provider export: “Your chosen storage service may upload this encrypted file. Keeptrail does not operate that service.”
- Forgotten archive password: “We cannot reset this password. Your current receipts have not been changed.”
- Purchase/reinstall: “Your purchase restores app access. Import a backup to restore receipts.”

Do not use “permanently safe,” “never leaves your device,” “unlimited storage,” “automatically backed up” without a tested mechanism, or “bank-grade” without a defined verified basis. The assistant's local history should receive the same privacy care as receipt notes.

## 9. Copy-ready storage implementation prompts

### S0 — Storage audit and durable file lifecycle

```text
Implement the Storage and Backup Guide with the local pilot. Audit every receipt,
PDF, thumbnail, OCR text and model path. Move authoritative data out of cache with
safe migrations and no loss. Use durable private SQLite plus separate evidence
files, stable IDs, relative keys and checksums. Preserve originals and copy imports
instead of relying only on picker URIs. Implement crash-safe staged file/database
commits and reconciliation. Test source deletion, force-stop, reboot and low space.
```

### S1 — Encryption, indexing and storage controls

```text
Select reviewed native database/file encryption and platform key handling. Protect
sensitive indexes and histories too; no hardcoded keys or plaintext public temps.
Document key invalidation/recovery and app-lock limits. Add measured storage totals,
safe cache clearing, large-file review and explicit Trash actions. Configure and
test OS cloud-backup exclusions for the strict local edition. Do not use a cache
directory merely to opt out of backup. Verify exact per-currency queries and FTS.
```

### S2 — Complete portable encrypted backup

```text
Implement versioned .keeptrail export with consistent metadata snapshot, originals,
counts/hashes, reviewed authenticated encryption and portable password-based access.
No model weights or default chat export. Stream bounded memory; handle WAL correctly.
Use Android document picker to save outside app-specific storage, disclose optional
cloud destinations and handle cancellation/permissions. Never report remote upload
or off-device safety you cannot verify. Preserve old valid backups on failed export.
```

### S3 — Restore and backup UX

```text
Implement staged validated restore into an empty/new vault first. Protect existing
data, preview counts, reject unsafe archives and document unsupported merge cases.
Use new destination-device encryption keys. Test cross-device restore, wrong password,
corruption, interruption, unsupported versions and missing attachments. Add backup
status, changes-since-export, dismissible reminders and honest loss/uninstall copy.
Keep automatic folder backups optional until manual recovery passes all tests.
```

### S4 — Local AI and evidence acceptance

```text
Connect the local pretrained model through typed read-only receipt/help tools.
Do not embed full photo files or entire histories into every question. Retrieve
bounded evidence; run totals over the complete matching database set in app code.
Validate sources, ignore instructions in OCR and keep currencies/nulls correct.
Benchmark model cold load, latency, RAM/heat and cancellation. Clearly label Basic
Helper fallback. Prove receipt capture/search/export/restore and supported AI work
in airplane mode after installation. Ship no remote model/API fallback or telemetry.
```

## 10. Local model and training clarification

Qwen2.5-1.5B-Instruct is a concrete pretrained baseline to evaluate, not a commitment or a latest-model claim. Check its publisher model card, license and native runtime support; quantify a compatible release with reproducible provenance. llama.cpp is a candidate embedded inference runtime. Neither the model card nor runtime docs guarantee acceptable performance in your React Native app.

Do not train on private tester receipts. Use synthetic fixtures and consented examples for evaluation, not silent training. Later fine-tuning is a separate research project with licensing, dataset consent, privacy review, evaluation and distribution costs; it is not necessary to query receipts accurately. App retrieval and exact calculations provide current facts without retraining model weights.

Sources: https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct ; https://github.com/ggml-org/llama.cpp ; https://developers.google.com/ml-kit/vision/text-recognition/v2/android (checked September 6, 2026).

No APK, custom trained model, benchmark or production security audit has been completed merely by writing these specifications.
