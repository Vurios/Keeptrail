# Katibay — Product Blueprint v2

**Working title:** Katibay (from _katibayan_, Filipino for "proof / documentary evidence")
**Positioning line:** _Turn a pile of receipts into proof that holds up._
**Prepared for:** Philippine Startup Challenge pitch + real product build
**Supersedes:** ResolvePass_Product_Blueprint.md

---

## 0. The naming decision

| Candidate     | Read                                                                                                      | Verdict           |
| ------------- | --------------------------------------------------------------------------------------------------------- | ----------------- |
| **Katibay**   | Filipino "proof/certificate", short, `.ph` and `.app` likely free, works as verb ("ka-katibay mo na ba?") | **Chosen**        |
| Resibo        | Instantly clear, but generic and hard to trademark                                                        | Backup            |
| Provenly      | Clean English SaaS name, no local hook                                                                    | Backup for global |
| ResolvePass   | Sounds like a support-ticket tool; ties you to the weakest of the three modules                           | Dropped           |
| Talaan / Tala | "Tala" collides with a well-known PH fintech                                                              | Avoid             |

Use **Katibay** for the pitch. The name carries both halves of the product: a liquidation packet is _katibayan_ of how money was spent; a Purchase Passport is _katibayan_ of ownership and warranty. One word, two use cases — judges will get it in three seconds.

Register `katibay.ph`, `katibay.app`, and the handle `@katibayph` before the pitch deck is printed.

---

## 1. The core strategic call: one object, two workflows, one launch surface

Your draft has three surfaces (Personal, Organization, Merchant). That is the right _long-term_ map and the wrong _launch_ map. Here is why, and what to do instead.

### What is wrong with shipping all three

1. **The Merchant / Service Desk is a two-sided marketplace.** Repair shops will not log in until claim volume exists; claim volume will not exist until users trust the app. Student teams die in this loop. It is also the module with the least defensible tech — it is mostly CRUD and status fields.
2. **Consumer warranty tracking is a low-frequency habit.** A user touches it maybe four times a year. Retention metrics will look terrible next to the org workflow, and judges look at retention.
3. **Three surfaces means three onboarding flows, three permission models, three demo scripts.** In an eight-minute pitch you get to show one thing working end-to-end.

### The reframe that keeps everything

Do not think of Katibay as three apps sharing a backend. Think of it as **one canonical object with two workflows on top.**

> **The Verified Receipt Record (VRR)** — a receipt that has been extracted, arithmetically checked, confidence-scored, deduplicated, and sealed with an audit trail.

Everything else is a _lens_ on the same object:

| Lens                             | What it does with the VRR                                                                                    | Launch status                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| **Liquidation** (org/team)       | Groups VRRs against a budget + cash advance, flags exceptions, exports the PH liquidation packet             | **v1 — hero workflow**             |
| **Purchase Passport** (consumer) | Promotes a single VRR into a durable asset record: warranty window, serial, coverage countdown, claim packet | **v1 — light, 3 screens**          |
| **Service Desk** (merchant)      | Accepts a claim packet, updates repair milestones, records custody                                           | **v3 — after claim volume exists** |

**Why this wins the pitch:** you are not presenting a bundle of features. You are presenting a thesis — _the receipt is the wrong unit; verified proof is the right unit_ — and then demonstrating that the same verified object closes two completely different pains. That reads as platform thinking, not scope creep.

**Why this wins commercially:** the org workflow gives you weekly-to-monthly frequency and a natural viral loop (every officer of every org in a university is a user, and treasurers turn over annually so the account renews itself). The Passport gives you long-lived data that nobody else holds.

### The one-line pitch

> Katibay turns receipt photos into verified financial records — so a student-org treasurer can close a ₱30,000 cash advance in ten minutes instead of a weekend, and so anyone can prove what they bought years later.

---

## 2. Competitor analysis

### 2.1 Segment map

**A. Global expense-management suites** — Expensify, Zoho Expense, Dext, SAP Concur, QuickBooks receipt capture.
Trade coverage of this category is consistent on what these tools are: receipt scanning is now a _feature_ inside broader accounting and expense platforms rather than a standalone product, with OCR pulling vendor, date, amount, and tax into an expense line (Bill.com, Forbes Advisor roundups, 2026). Zoho Expense in particular is praised for approval workflows and per-active-user pricing.

**Their shape:** built around the _corporate reimbursement_ model — employee spends own money, submits report, company pays back, manager approves.
**Where they cannot follow you:**

- The Philippine model is inverted. A student org or a barangay project receives a **cash advance first**, then must liquidate against it. There is no "reimbursement" object in Expensify that maps to an unliquidated advance with a return-of-excess-cash line.
- They output _expense reports_, not the specific liquidation report, cash-advance voucher, and summary-of-expenses set that PH university accounting offices actually accept.
- USD per-seat pricing is a non-starter for an org with a ₱15,000 semester budget.
- No org-turnover model: they assume stable employees, not a treasurer replaced every school year.

**B. OCR / document-AI APIs** — Veryfi, Mindee, Taggun.
Veryfi is explicitly an API rather than a consumer product, processes receipts and invoices with on-device options, and is priced per scan; it has no built-in expense reporting or categorization (Simular comparison, 2026).
**Where they cannot follow you:** they sell the engine. They will never build a Philippine liquidation form. They are a potential _supplier_ or a fallback, not a competitor. Say this out loud in the pitch — it shows you know the difference between a model and a product.

**C. Consumer warranty trackers** — Warranty Tracker (Execulia), Receipt Vault, various app-store trackers.
The 2026 category is defined by photo-a-receipt OCR plus automated expiry reminders across electronics, vehicles, and policies; Receipt Vault similarly frames itself around searchable storage plus return-and-warranty deadline alerts.
**Where they cannot follow you:** they stop at the reminder. None of them assemble a _claim packet_ (receipt + serial + warranty terms + fault description + timeline) or model chain of custody at a repair center. None of them are localized to PH warranty practice or to the reality that the "warranty card" here is often a stapled thermal slip.

**D. The real incumbent — Excel, Google Drive, and a Messenger group chat.**
This is what 95% of your actual users use today. Envelope of receipts, a shared spreadsheet, a panicked night before the deadline. Free, universal, and terrible.
**Where they cannot follow you:** no arithmetic verification, no duplicate detection, no audit trail, and the reconciliation labor is 100% human.

**E. Local adjacent tools** — PH accounting/POS SaaS (JuanTax, QNE, Loyverse and similar).
These serve registered businesses and tax filing. None target the non-corporate, non-registered spender: student orgs, church groups, barangay committees, small event teams, freelancers.

### 2.2 Where Katibay actually wins

| Axis                       | Incumbents                     | Katibay                                                                                         |
| -------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Financial model            | Reimbursement                  | **Cash advance → liquidation → return of excess**                                               |
| Output                     | Generic expense report / CSV   | **PH-format liquidation packet: report, voucher, summary, variance, evidence ZIP**              |
| Receipt quality assumption | Clean printed invoices         | **Faded thermal, handwritten, crumpled — confidence-scored, never silently guessed**            |
| Verification               | Trusts OCR                     | **Recomputes arithmetic, cross-checks printed total, flags duplicates and out-of-period items** |
| Failure behavior           | Wrong number in a cell         | **Exception queue with one precise question per item**                                          |
| Long tail                  | Receipt archived and forgotten | **Durable purchase promoted to a Passport with warranty countdown**                             |
| Price                      | USD, per seat                  | **Free for student orgs; ₱ pricing for SMEs and institutions**                                  |
| Connectivity               | Cloud-assumed                  | **Offline capture, queued sync**                                                                |

### 2.3 The strategic tailwind — say this to judges

The Philippines is mid-transition to structured electronic invoicing. Under the CREATE MORE Act and Revenue Regulations 11-2025, as amended by RR 26-2025, the first group of covered taxpayers must issue structured electronic invoices and report sales data through the BIR's Electronic Invoicing System by **31 December 2026**, with later phases expected to widen the scope. Crucially, the rules distinguish a _document_ from a _data process_ — a scanned PDF is not a compliant e-invoice; the data must move as structured JSON through the EIS.

**What this means for Katibay:** the supply of _structured_ receipt data is about to increase enormously, from the top of the market downward. Every current incumbent is on the seller side of that pipe. Katibay sits on the **buyer/holder** side — the wallet that receives, verifies, organizes, and proves. As structured receipts arrive, your OCR cost per receipt falls and your data quality rises, without changing your product. You are building for the world that regulation is creating.

That is the single strongest slide you can put in front of a DICT-affiliated judging panel: you are not fighting the direction of policy, you are downstream of it.

> Sanity note: do not overclaim BIR "accreditation." The BIR has publicly advised that only mandated or notified _taxpayers_ apply for EIS certification and a Permit to Transmit — not software providers. Frame it as alignment and readiness, never as accreditation you do not have.

### 2.4 Competitive risks to name honestly

Judges reward founders who name their own risks.

1. **Zoho or Expensify adds a PH liquidation template.** Unlikely (market too small for them, form set too idiosyncratic) but possible. Your defense is depth in the vertical: forms per university, offline capture, org-turnover handover.
2. **A university builds it internally.** Happens; usually a thesis project with no maintenance. Your defense is multi-campus network effects and continuity across treasurer turnover.
3. **Gemini pricing shifts.** Your defense is the deterministic layer: extraction is replaceable, the verification and reporting engine is yours.
4. **Thermal receipt OCR failure.** Already the right answer in your draft: confidence scores plus human correction. Never pretend uncertain OCR is correct. Show a _failed_ receipt in the demo and show it being handled gracefully — this earns more credibility than a perfect run.

---

## 3. Product architecture

### 3.1 Surfaces in v1

```
Katibay
├── Personal (default on signup)
│   ├── Capture → Verified Receipt Record
│   ├── Purchase Passport (durable items only, promoted from a VRR)
│   └── Claim packet export
│
└── Workspace (created, not defaulted to)
    ├── Activity: budget + cash advance
    ├── Batch capture (multi-member)
    ├── Reconciliation + exception queue
    └── Liquidation packet export
```

The Merchant Service Desk is **not built in v1**. It appears in the pitch deck as roadmap with one wireframe. If a judge asks, the answer is: "We don't build the second side of a marketplace before the first side has volume."

### 3.2 The agent pipeline (the technical heart)

A deterministic, resumable state machine — not a chatbot. Each stage writes state and can be retried independently.

```
INTAKE → EXTRACT → VERIFY → CLASSIFY → RECONCILE → EXCEPTION → EXPORT → SEAL
```

| Stage         | Owner              | What happens                                                                                                                                             | Failure mode                                                    |
| ------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **INTAKE**    | Deterministic      | Image normalize (deskew, contrast), perceptual hash, dedupe by hash, virus/size guard, job row created                                                   | Reject with reason, never silently drop                         |
| **EXTRACT**   | Gemini multimodal  | Strict JSON schema: merchant, TIN, address, date, time, receipt/OR number, line items, subtotal, VAT, total, payment method, per-field confidence        | Retry once at higher fidelity, then mark `needs_review`         |
| **VERIFY**    | Deterministic code | Re-sum line items; compare to printed subtotal/VAT/total; validate VAT math (12%); date sanity vs activity window; OR-number format                      | Any mismatch → exception, never auto-correct                    |
| **CLASSIFY**  | Gemini + rules     | Map to budget category with confidence; rules override the model for known merchant patterns                                                             | Low confidence → exception                                      |
| **RECONCILE** | Deterministic      | Sum per category vs approved budget; total vs cash advance; compute variance and excess to return; detect duplicate OR numbers and near-duplicate images | —                                                               |
| **EXCEPTION** | Human + agent      | Queue of items, each with **exactly one precise question** ("Printed total reads ₱1,240 but line items sum to ₱1,140. Which is correct?")                | Blocks export until resolved or explicitly waived with a reason |
| **EXPORT**    | Deterministic      | Liquidation report, expense summary, variance report, evidence ZIP/PDF                                                                                   | Deterministic templating only — no LLM in the final numbers     |
| **SEAL**      | Deterministic      | Immutable audit log, content hash of packet, approver identity + timestamp                                                                               | —                                                               |

**Two rules that make this credible to technical judges:**

1. **No LLM output ever reaches a financial total without deterministic recomputation.** The model reads; the code computes.
2. **Every number in an exported report is traceable to a receipt image and a confidence score.** Tap any figure in the report, land on the source image.

### 3.3 Confidence policy

| Field confidence                  | Behavior                       |
| --------------------------------- | ------------------------------ |
| ≥ 0.92 and arithmetic checks pass | Auto-approve into ledger       |
| 0.70 – 0.92                       | Soft flag, one-tap confirm     |
| < 0.70 or any check fails         | Exception queue, blocks export |

Tune the thresholds against your own labeled set of PH thermal receipts. Do not ship the numbers you read here — measure them.

---

## 4. Tech stack (final, consolidated)

Your draft mixed two incompatible stacks (Supabase in one paragraph, Firestore + ADK in another). Pick one. Here is the pick and the reasoning.

### 4.1 The decision

| Layer                   | Choice                                                                                 | Why this and not the alternative                                                                                                                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database**            | **Postgres via Supabase**                                                              | Liquidation is relational accounting: budgets → categories → entries → exceptions, with SUM/GROUP BY on every screen. Firestore forces denormalization and makes ledger integrity your problem. Postgres gives you constraints, transactions, and a real audit table. Row-Level Security handles multi-tenant workspaces natively. |
| **Auth**                | Supabase Auth (email + Google)                                                         | Same system, RLS-aware JWTs, no second identity provider                                                                                                                                                                                                                                                                           |
| **Storage**             | Supabase Storage, private buckets, signed URLs                                         | Receipts are sensitive; never public-read                                                                                                                                                                                                                                                                                          |
| **Extraction model**    | **Gemini Flash (multimodal)**                                                          | Best cost-per-page on messy photos; strong at Filipino/English mixed text. Verify the exact current model ID at build time — Google's model names change and any ID quoted in a document goes stale. Put it in one config constant, never inline.                                                                                  |
| **Agent orchestration** | **Plain Python state machine on a worker** — not an agent framework                    | You need resumability and auditability, not autonomy. A framework adds a dependency and hides control flow from judges. If you later want ADK/LangGraph, the state machine ports cleanly.                                                                                                                                          |
| **API**                 | FastAPI (Python) on Cloud Run or Fly.io                                                | Python for the image/PDF/report tooling; scales to zero for cost                                                                                                                                                                                                                                                                   |
| **Queue**               | Postgres-backed job queue (`pgmq` or a simple `jobs` table + `FOR UPDATE SKIP LOCKED`) | One fewer system than Pub/Sub, fully inspectable, plenty fast at your volume                                                                                                                                                                                                                                                       |
| **Web app**             | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui                               | Fast to build, deploys on Vercel free tier, great for the demo                                                                                                                                                                                                                                                                     |
| **Mobile**              | Expo (React Native), offline-first with SQLite queue                                   | Receipt capture is a phone job. Offline capture is a real PH differentiator                                                                                                                                                                                                                                                        |
| **Report generation**   | HTML template → WeasyPrint (or Playwright) → PDF                                       | Deterministic, styleable, no LLM in the output path                                                                                                                                                                                                                                                                                |
| **Evidence packet**     | Python `zipfile` + a manifest JSON with SHA-256 per file                               | Makes "audit trail" a real artifact, not a claim                                                                                                                                                                                                                                                                                   |
| **Observability**       | Sentry + structured JSON logs + a `pipeline_events` table                              | You need to _show_ the audit trail on stage                                                                                                                                                                                                                                                                                        |
| **i18n**                | **English + Filipino only**                                                            | Bikol is removed. Ship EN + FIL, structured so a third locale is a JSON file, not a refactor                                                                                                                                                                                                                                       |

### 4.2 Cost sanity (pitch-ready)

Per receipt: one Flash multimodal call, roughly one page of image input plus a small JSON output. At typical Flash pricing this is a fraction of a peso. A 40-receipt liquidation therefore costs single-digit pesos in model spend, and Supabase's free tier plus Cloud Run scale-to-zero covers the rest during the competition. **Verify live pricing before you put a number on a slide** — quote a range, not a false precision.

### 4.3 What you are explicitly NOT using in v1

- No blockchain. If a judge asks about tamper-proofing, the answer is content hashing plus append-only audit rows. Blockchain here is a red flag, not a feature.
- No custom-trained OCR model. You are not going to beat a frontier multimodal model with a student dataset. Your edge is the verification layer.
- No merchant portal. See §3.1.
- No bank integrations. Out of scope and a compliance rabbit hole.

---

## 5. Data model

Core tables (Postgres, all with `created_at`, `updated_at`, and RLS policies):

```sql
-- Identity & tenancy
users(id, email, full_name, locale)             -- locale: 'en' | 'fil'
workspaces(id, name, type, institution, created_by)
                                                -- type: 'personal' | 'organization'
workspace_members(workspace_id, user_id, role)  -- 'owner'|'treasurer'|'member'|'auditor'

-- The liquidation domain
activities(id, workspace_id, title, start_date, end_date,
           cash_advance_amount, status)         -- 'draft'|'collecting'|'review'|'closed'
budget_lines(id, activity_id, category, approved_amount, notes)

-- The canonical object
receipts(id, workspace_id, activity_id NULL, uploaded_by,
         storage_path, perceptual_hash, sha256,
         status,                                 -- 'queued'|'extracted'|'verified'|'exception'|'approved'|'rejected'
         merchant_name, merchant_tin, txn_date, or_number,
         subtotal, vat_amount, total_amount, payment_method,
         extraction_confidence, model_version, raw_extraction jsonb)

receipt_line_items(id, receipt_id, description, qty, unit_price, line_total, confidence)

-- Verification & reconciliation
exceptions(id, receipt_id, activity_id, kind, severity,
           question_text, suggested_values jsonb,
           status, resolved_by, resolution_note)
                                                 -- kind: 'arith_mismatch'|'duplicate'|'out_of_period'
                                                 --      |'over_budget'|'low_confidence'|'missing_doc'
ledger_entries(id, activity_id, receipt_id, budget_line_id,
               amount, category, approved_by, approved_at)

-- The consumer domain
passports(id, workspace_id, receipt_id, item_name, brand, model, serial_number,
          purchase_date, warranty_months, warranty_expires_at,
          coverage_notes, status)                -- 'active'|'expiring'|'expired'|'claimed'
claims(id, passport_id, fault_description, opened_at, status, packet_path)

-- Trust
audit_events(id, workspace_id, actor_id, entity_type, entity_id,
             action, before jsonb, after jsonb, occurred_at)
exports(id, activity_id, kind, file_path, content_sha256,
        generated_by, generated_at)
jobs(id, kind, payload jsonb, status, attempts, locked_at, last_error)
```

**Design notes worth defending in Q&A:**

- `audit_events` is append-only (revoke UPDATE/DELETE at the role level). This is what makes "full audit trail" true rather than aspirational.
- `ledger_entries` is separate from `receipts` on purpose: a receipt is _evidence_, a ledger entry is an _accounting fact_. One receipt can split across two budget lines.
- `perceptual_hash` catches the same receipt photographed twice from different angles; `sha256` catches the identical file. You need both.
- `passports.receipt_id` is the seam between the two workflows. Same object, promoted.

---

## 6. Build procedure — step by step

### Phase 0 — Validate before you code (3–5 days, do not skip)

1. Interview **8 treasurers** across at least 3 organizations. Ask what forms they submit, to whom, and how long it takes.
2. Collect the **actual blank forms** your target university's accounting office requires. Photograph them. These are your export templates and your real moat.
3. Collect **60–100 real receipt photos** from past activities, deliberately including bad ones — faded thermal, folded, glare, handwritten. This is your test set.
4. Time the current process with a stopwatch. "It takes a treasurer 6 hours" is a pitch line only if you measured it.

### Phase 1 — Foundations (week 1)

5. Repo setup: monorepo (`apps/web`, `apps/mobile`, `services/api`, `packages/shared`), pnpm, ESLint/Prettier, Ruff/Black, pre-commit.
6. Supabase project, schema migration #1, RLS policies, seed script.
7. FastAPI skeleton with health check, auth middleware validating Supabase JWTs, structured logging.
8. CI: lint + typecheck + tests on every PR.

### Phase 2 — Capture and extraction (week 2)

9. Upload endpoint → storage → `receipts` row → job enqueued.
10. Image preprocessing: EXIF rotate, deskew, contrast normalize, downscale to model-optimal size.
11. Gemini extraction call with a strict JSON schema and per-field confidence. Model ID in config.
12. Golden-file tests against your 60–100 receipt set. Record extraction accuracy per field. **This number goes in your pitch.**

### Phase 3 — Verification engine (week 3) — _the differentiator, build it carefully_

13. Arithmetic verifier: line items → subtotal → VAT → total, with tolerance for rounding.
14. Duplicate detector: exact hash, perceptual hash, and OR-number collision.
15. Date-window validator against the activity period.
16. Confidence router that assigns each receipt to auto-approve / soft-flag / exception.
17. Exception generator that produces **one question per exception**, in plain language, with suggested values.

### Phase 4 — Reconciliation and the treasurer UI (week 4)

18. Activity creation: budget lines + cash advance.
19. Batch upload with live progress per receipt.
20. Reconciliation dashboard: per-category spend vs approved, running variance, excess to return.
21. Exception queue UI — this is the screen you demo. Make it fast, one keystroke per resolution.
22. Approve-into-ledger transitions with audit events.

### Phase 5 — Export packet (week 5)

23. HTML templates for liquidation report, expense summary, variance report — matched to the real forms from Phase 0.
24. PDF rendering, deterministic, with page numbers and a signature block.
25. Evidence ZIP: all receipt images, a manifest with SHA-256 per file, and the reports.
26. Seal step: content hash, approver, timestamp, immutable `exports` row.

### Phase 6 — Purchase Passport (week 6, keep it to 3 screens)

27. "Promote to Passport" action on any approved receipt.
28. Passport detail: item, serial, warranty window, countdown, coverage notes.
29. Expiry notifications at 60/30/7 days.
30. Claim packet export: receipt + passport + fault description → single PDF.

### Phase 7 — Mobile capture (week 7)

31. Expo app: camera with edge detection, multi-shot batch, offline SQLite queue, background sync.
32. Auth via the same Supabase session.

### Phase 8 — Pilot and pitch prep (week 8)

33. Run **one real liquidation end-to-end** with a real org. Ship whatever that breaks.
34. Instrument: time-to-close, receipts per activity, exception rate, correction rate.
35. Build the demo script (§8).
36. Load-test the demo path. Rehearse with airplane mode on to prove offline capture.

---

## 7. Claude Code prompts — split for quality

Each prompt is self-contained, ends with explicit acceptance criteria, and assumes the previous ones are done. Run them in order. **Do not merge them** — long combined prompts are where quality degrades.

Before prompt 1, put this in `CLAUDE.md` at the repo root so every session inherits it:

```markdown
# Katibay — project context

Katibay verifies receipts and produces Philippine liquidation packets and
warranty Purchase Passports.

## Non-negotiable rules

1. No LLM output ever becomes a financial total. The model extracts; Python recomputes.
2. Every stage of the pipeline is resumable and writes an audit event.
3. Uncertain extraction becomes an exception with one precise question. Never guess.
4. All money is stored in integer centavos. Never floats.
5. Locales: 'en' and 'fil' only. No other locale is supported.
6. The Gemini model ID lives in one config constant, never inline in call sites.

## Stack

Postgres/Supabase · FastAPI (Python 3.12) · Next.js App Router + TypeScript +
Tailwind + shadcn/ui · Expo · WeasyPrint · pytest + Vitest

## Conventions

snake_case in Python and SQL, camelCase in TypeScript. Types shared via
packages/shared. Every endpoint gets a test.
```

---

**Prompt 1 — Repo scaffold**

> Set up a pnpm monorepo named `katibay` with workspaces: `apps/web` (Next.js App Router + TypeScript + Tailwind + shadcn/ui), `apps/mobile` (Expo, blank TypeScript), `services/api` (FastAPI, Python 3.12, uv for deps), `packages/shared` (shared TypeScript types).
> Add: root `pnpm-workspace.yaml`, ESLint + Prettier for TS, Ruff + Black for Python, pre-commit hooks, a `Makefile` with `dev`, `test`, `lint`, `migrate` targets, and a GitHub Actions workflow running lint + typecheck + tests on PRs.
> Add `.env.example` with placeholders for `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL_ID`.
> Do not write any application logic yet.
> **Acceptance:** `make lint` and `make test` both pass on an empty project; `pnpm dev` starts the web app.

**Prompt 2 — Database schema and RLS**

> Write Supabase SQL migrations for the Katibay schema. Tables: `users`, `workspaces`, `workspace_members`, `activities`, `budget_lines`, `receipts`, `receipt_line_items`, `exceptions`, `ledger_entries`, `passports`, `claims`, `audit_events`, `exports`, `jobs`.
> Requirements: all money columns are `bigint` centavos; all tables have `created_at`/`updated_at` with a trigger; `audit_events` has UPDATE and DELETE revoked; enums for every status column; indexes on all foreign keys plus `receipts.perceptual_hash`, `receipts.sha256`, and `receipts(activity_id, status)`.
> Write RLS policies so a user can only read or write rows belonging to a workspace they are a member of, with `role` gating writes: `owner` and `treasurer` may approve ledger entries, `member` may only upload receipts, `auditor` is read-only.
> Include a `seed.sql` creating one demo workspace, one activity with five budget lines, and three members.
> **Acceptance:** migration applies cleanly; a test proves a user in workspace A cannot select rows from workspace B.

**Prompt 3 — API skeleton and auth**

> In `services/api`, build a FastAPI app with: Supabase JWT validation middleware that resolves the current user and their workspace memberships; structured JSON logging with a request ID; a global error handler returning RFC-7807 problem details; `/health`; and a `Settings` class reading env vars (including `GEMINI_MODEL_ID`) with Pydantic.
> Add a `db` module using asyncpg with a connection pool, and a `require_role(workspace_id, roles)` dependency.
> **Acceptance:** pytest covers valid token, expired token, missing token, and wrong-workspace access, all passing.

**Prompt 4 — Job queue**

> Implement a Postgres-backed job queue in `services/api/jobs`. Use `SELECT ... FOR UPDATE SKIP LOCKED` for claiming. Support: enqueue, claim with a visibility timeout, complete, fail with exponential backoff, and a dead-letter state after 5 attempts.
> Write a worker entrypoint (`python -m katibay.worker`) that polls, dispatches by `jobs.kind` through a handler registry, and shuts down gracefully on SIGTERM.
> **Acceptance:** tests cover concurrent claiming by two workers with no double-processing, retry backoff, and dead-lettering.

**Prompt 5 — Upload and preprocessing**

> Build `POST /workspaces/{id}/receipts` accepting one or more images (JPEG/PNG/HEIC/PDF, max 10 MB each). For each file: validate type and size, compute SHA-256, upload to the private Supabase Storage bucket `receipts`, compute a perceptual hash (`imagehash.phash`) after normalization, insert a `receipts` row with status `queued`, and enqueue an `extract_receipt` job.
> Preprocessing module: EXIF-based rotation, auto-deskew, contrast normalization (CLAHE), downscale so the long edge is 1600px, output JPEG q85.
> If SHA-256 or a perceptual hash within Hamming distance 5 already exists in the same workspace, still create the row but immediately create a `duplicate` exception instead of enqueueing extraction.
> **Acceptance:** uploading the same file twice produces one extraction job and one duplicate exception; a rotated re-photograph of the same receipt is also caught.

**Prompt 6 — Gemini extraction**

> Build `services/api/extraction`. Define a Pydantic schema `ReceiptExtraction` with: merchant_name, merchant_tin, merchant_address, txn_date, txn_time, or_number, line_items[{description, qty, unit_price, line_total}], subtotal, vat_amount, total_amount, payment_method — each with a paired `*_confidence` float 0–1, plus an overall `confidence`.
> Implement `extract(image_bytes) -> ReceiptExtraction` calling Gemini multimodal with `settings.gemini_model_id`, response MIME type `application/json`, and the schema enforced. The prompt must instruct the model to return `null` with confidence 0 for any field it cannot read, and must explicitly forbid inferring or computing values that are not printed on the receipt.
> Handle: transient errors with one retry at higher image fidelity; refusals or malformed JSON by marking the receipt `exception` with kind `low_confidence`.
> Store the raw response in `receipts.raw_extraction` and the model ID in `receipts.model_version`.
> **Acceptance:** unit tests use recorded fixtures (no live API calls in CI); a golden-file test runs against `tests/fixtures/receipts/` and prints per-field accuracy.

**Prompt 7 — Verification engine**

> Build `services/api/verification` as pure functions over a `ReceiptExtraction` plus activity context. Implement checks, each returning a structured result: `arithmetic` (line items sum to subtotal; subtotal + VAT equals total; VAT is 12% of the VATable base — tolerance ±2 centavos per operation), `date_window` (txn_date within activity start/end), `or_number_format`, `future_date`, and `confidence_routing` (auto-approve ≥0.92 with all checks passing; soft-flag 0.70–0.92; exception below 0.70 or on any failed check).
> Each failure produces an `exceptions` row with a `question_text` written as **one** plain-language question in English with a Filipino translation key, plus `suggested_values`.
> Never mutate extracted values. Verification only classifies.
> **Acceptance:** table-driven tests cover matched totals, off-by-one-centavo rounding, a transposed digit, a missing line item, an out-of-window date, and a future date.

**Prompt 8 — Classification and reconciliation**

> Build category classification: a rules layer first (merchant-name patterns → category, stored in a `merchant_rules` table), falling back to a Gemini call that must pick from the activity's existing `budget_lines` categories only. Confidence below 0.75 becomes a `low_confidence` exception.
> Build reconciliation: given an activity, compute per-category actual vs approved, total spend vs cash advance, excess to return or overage, and flag any category exceeding its approved amount as an `over_budget` exception. All arithmetic in integer centavos.
> Expose `GET /activities/{id}/reconciliation` returning the full picture.
> **Acceptance:** tests cover exact-budget, under-budget, single-category overage, and total exceeding the cash advance.

**Prompt 9 — Exception queue API**

> Build endpoints: `GET /activities/{id}/exceptions` (filterable by kind, severity, status), `POST /exceptions/{id}/resolve` (accepts a corrected value or an explicit waiver with a mandatory reason), and `POST /receipts/{id}/approve` (moves a verified receipt into `ledger_entries`, requires `treasurer` or `owner`).
> Every resolution writes an `audit_events` row with before/after JSON. Resolving an exception re-runs verification for that receipt. An activity cannot move to `closed` while open exceptions of severity `blocking` remain.
> **Acceptance:** tests cover correction, waiver-with-reason, waiver-without-reason (rejected), role enforcement, and blocked closure.

**Prompt 10 — Report generation**

> Build `services/api/reports`. Create Jinja2 HTML templates styled for A4 print: `liquidation_report.html`, `expense_summary.html`, `variance_report.html`. Each has a header with the org name, activity title, date range, cash advance, and a signature block for Treasurer / President / Adviser.
> Render to PDF with WeasyPrint. Build `build_evidence_packet(activity_id)` producing a ZIP containing the three PDFs, every approved receipt image under `receipts/`, and `manifest.json` listing each file with its SHA-256, its receipt ID, and its confidence score.
> Compute the SHA-256 of the ZIP, write an `exports` row, and write an audit event. All numbers come from `ledger_entries` — never from an LLM.
> **Acceptance:** a snapshot test asserts the rendered HTML totals equal the reconciliation API output; the ZIP manifest hash-verifies.

**Prompt 11 — Web app: activity and reconciliation**

> Build in `apps/web`: an activity list, an activity creation form (title, dates, cash advance, dynamic budget lines), and the reconciliation dashboard showing per-category progress bars (actual vs approved, red when over), a variance summary card, and a receipt table with status chips and confidence indicators.
> Use server components for data fetching, Supabase client auth, and optimistic updates on approval. All strings go through an i18n layer with `en` and `fil` message files — **no other locales**.
> **Acceptance:** the dashboard renders correctly against the seed data; switching to `fil` translates every visible string.

**Prompt 12 — Web app: the exception queue (demo screen)**

> Build the exception queue as a focused, keyboard-driven review screen: a left-hand list of exceptions grouped by kind, a center pane showing the receipt image with zoom and pan, and a right-hand pane with the single question, the extracted values with confidence bars, an editable correction field, and Accept / Correct / Waive actions.
> Keyboard: `j`/`k` to move, `a` to accept, `c` to focus the correction field, `w` to waive. Show a progress bar ("7 of 12 resolved") and a completion state that offers the export action.
> This is the screen shown in the pitch demo — prioritize speed and clarity over feature count.
> **Acceptance:** a full 12-exception queue is resolvable using only the keyboard; the completion state correctly unlocks export.

**Prompt 13 — Purchase Passport**

> Build the Passport feature: `POST /receipts/{id}/promote` creating a `passports` row (item name, brand, model, serial, purchase date, warranty months, coverage notes, computed `warranty_expires_at`); a passport list with a coverage countdown and status chips; a passport detail page; and `POST /passports/{id}/claim` generating a claim-packet PDF containing the receipt image, purchase and warranty details, the fault description, and a timeline.
> Add a scheduled job posting notifications at 60, 30, and 7 days before expiry.
> Keep this to three screens. Do not build a merchant-facing interface.
> **Acceptance:** promoting a receipt, generating a claim packet, and firing an expiry notification are each covered by a test.

**Prompt 14 — Mobile capture**

> Build the Expo app: Supabase auth, a camera screen with document edge detection and batch multi-shot, a local SQLite queue persisting captures with metadata, and background sync that uploads when connectivity returns and reconciles server IDs. Show per-item sync state (queued / uploading / synced / failed) and support retry.
> The app must be fully usable in airplane mode for capture.
> **Acceptance:** capturing 10 receipts offline, then re-enabling network, results in 10 synced receipts with no duplicates.

**Prompt 15 — Audit trail viewer and hardening**

> Build a read-only audit view per activity: a chronological event stream with actor, action, entity, and a before/after diff. Add rate limiting on upload endpoints, signed-URL expiry of 60 seconds for receipt images, Sentry integration, and a `/metrics` endpoint exposing job queue depth, extraction latency p50/p95, and exception rate.
> Write a `docs/ARCHITECTURE.md` with a pipeline diagram and the confidence policy table.
> **Acceptance:** the audit view reconstructs the full history of a demo activity; `docs/ARCHITECTURE.md` is accurate against the code.

---

## 8. The pitch

### 8.1 Demo script (5 minutes, rehearse it 20 times)

1. **(20s)** "This is a real liquidation folder from a real org." Hold up the envelope of receipts.
2. **(30s)** Create the activity: ₱30,000 cash advance, six budget lines.
3. **(40s)** Batch upload 12 receipts from the phone. Show the progress. **Do this on airplane mode first**, then re-enable network to show offline capture syncing.
4. **(60s)** Watch the pipeline: 9 auto-approved, 3 exceptions.
5. **(90s)** Resolve the three exceptions on the queue screen, keyboard only:
   - a **duplicate** (same receipt photographed twice),
   - an **arithmetic mismatch** (printed total disagrees with line items),
   - an **over-budget** category.
6. **(40s)** Export. Open the PDF. Tap a number, land on the source receipt image.
7. **(20s)** Show the audit trail. "Every peso is traceable to an image, a confidence score, and an approver."
8. **(20s)** Promote one receipt — a printer — to a Purchase Passport. "Same verified record. Now it's a three-year warranty countdown."

**Include one receipt the system cannot read.** Show it going to the exception queue rather than being silently guessed. Then say: _"Our competitors' OCR would have put a wrong number in a financial report. Ours asks."_ That is the line judges remember.

### 8.2 Metrics to have ready

- Baseline: hours a treasurer currently spends (measured in Phase 0).
- Katibay: minutes to close the same activity.
- Extraction accuracy per field on your PH thermal-receipt test set.
- Exception rate and average time to resolve one exception.
- Cost per liquidation in pesos.

### 8.3 Business model

| Segment                              | Price                                                   | Rationale                                                     |
| ------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------- |
| Student organizations                | **Free**, capped at 200 receipts/month                  | Distribution and data; treasurers become alumni professionals |
| Universities (org-management office) | Annual site license, per-campus                         | They get compliance visibility across all orgs                |
| SMEs, event teams, cooperatives      | ₱ tiered monthly                                        | The revenue engine                                            |
| Personal Passport                    | Free; paid tier for unlimited passports + claim packets | Retention, not revenue                                        |
| Merchants / repair centers (v3)      | Per-claim or subscription                               | Only after claim volume exists                                |

Land on campuses free, expand to the institution, monetize the SMEs the same treasurers join after graduation.

### 8.4 Roadmap slide

- **v1 (now):** Liquidation + Passport, EN/FIL, web + mobile capture
- **v2:** University admin console, multi-activity budgets, CSV/accounting export
- **v3:** Merchant Service Desk, chain of custody, repair milestones
- **v4:** Structured e-receipt ingestion as BIR EIS adoption widens — receipts arrive as data, not photos

---

## 9. Open decisions for you

1. **Which university's forms are the template?** Pick one, nail it, then generalize. Do not build a form builder in v1.
2. **Do you have a co-founder who can sell?** The tech here is buildable by one strong student. The distribution — 40 campus orgs in a semester — is not.
3. **Registration.** DICT grant programs generally require SEC or DTI registration and registration on the Startup Philippines portal. Check the current PSC mechanics for your cycle; if registration is required to claim a prize, start the DTI process early, it is cheap and slow.
4. **What is your defensible dataset in 12 months?** My answer: PH-specific receipt-to-category mappings, merchant patterns, and per-institution form templates. Start recording them from day one.

---

## 10. Sources consulted

- Bill.com, "Best receipt scanner apps in 2026"
- Forbes Advisor, "Best Receipt Scanner Apps Of 2026"
- Simular, "10 Best Receipt Scanner and Organizer Tools in 2026" (Veryfi as API, not consumer app)
- Foreceipt, "Best Receipt Scanner Apps for 2026"
- Warranty Tracker, "Best Warranty Tracker Apps in 2026"
- Receipt Vault, "The Best Receipt Scanner App"
- Grant Thornton Philippines, "Ready or not: Philippines' shift to e-invoicing and electronic sales reporting" (RR 11-2025, RR 26-2025, CREATE MORE / RA 12066)
- ClearTax PH and RTC Suite, Philippines e-invoicing 2026 guides (EIS, structured JSON, Permit to Transmit; BIR advisory that providers are not accredited)
- DICT Startup Innovations Portal, Philippine Startup Challenge overview and Startup Grant Fund FAQ
- BusinessWorld, Philippine Startup Week 2026 / ISA Committee under DICT

_Regulatory and pricing details change. Re-verify the BIR timeline and Gemini pricing before they go on a slide._
