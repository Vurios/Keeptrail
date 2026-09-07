# Katibay

> Turn a pile of receipts into proof that holds up. Katibay verifies official receipts, automates organization budget reconciliation, generates audit-ready liquidation evidence packets, and seals capital equipment purchases into digital Asset Passports.

---

## Quickstart Setup (Clean Clone to Running App in < 10 Commands)

```bash
# 1. Install dependencies
pnpm install
cd services/api && uv sync && cd ../..

# 2. Configure environment
cp .env.example .env

# 3. Apply database migrations & seed demo dataset
supabase db reset   # Or: psql $DATABASE_URL -f supabase/migrations/0001_enums.sql -f supabase/migrations/0002_tables.sql -f supabase/migrations/0003_rls.sql -f supabase/migrations/0004_merchant_rules.sql -f supabase/seed.sql

# 4. Start backend API & workers
cd services/api && uv run uvicorn katibay_api.main:app --reload --port 8000

# 5. Start Next.js web application (in a new terminal)
pnpm --filter @katibay/web dev

# 6. Start Expo mobile application (in a new terminal)
pnpm --filter @katibay/mobile start
```

---

## Monorepo Structure

| Workspace / Service   | Tech Stack                                                | Role                                                                                                      |
| :-------------------- | :-------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| `apps/web`            | Next.js 16 (App Router), TypeScript, Tailwind CSS, Lucide | Reconciliation dashboard, keyboard exception review, asset passports, and immutable audit stream          |
| `apps/mobile`         | React Native, Expo, SQLite, Camera                        | Rapid one-handed multi-shot receipt capture with offline sync and network reconnection engine             |
| `services/api`        | FastAPI (Python 3.12, `uv`), Pydantic, WeasyPrint         | Intake, perceptual hash deduplication, Gemini 2.5 OCR, deterministic verification, and PDF/ZIP generation |
| `packages/shared`     | TypeScript, Vitest                                        | Shared design tokens, brand SVG marks, i18n dictionaries (`en`/`fil`), and validation contracts           |
| `supabase/migrations` | PostgreSQL 16, Row-Level Security (RLS)                   | Strictly typed schema, integer centavos monetary math, append-only audit events, and tenant isolation     |

---

## Verification & Testing Commands

```bash
# Run all TypeScript typechecks
pnpm -r typecheck

# Run Vitest test suites (31 passing tests)
pnpm -r test

# Run all backend pytest suites (75 passing tests including Phase 0 E2E)
cd services/api && uv run pytest

# Production Next.js build
pnpm --filter @katibay/web build
```
