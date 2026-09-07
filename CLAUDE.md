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
7. UI never hardcodes colors. Every component consumes the shared design tokens from
   `packages/shared/design-tokens.md` (Prompt 11); no raw hex values in components.

## Stack

Postgres/Supabase · FastAPI (Python 3.12) · Next.js App Router + TypeScript +
Tailwind + shadcn/ui · Expo · WeasyPrint · pytest + Vitest

## Conventions

snake_case in Python and SQL, camelCase in TypeScript. Types shared via
packages/shared. Every endpoint gets a test.
