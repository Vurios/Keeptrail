# Katibay monorepo targets.
# Recipes use POSIX sh (works in Git Bash / CI). Windows: run `make` from Git Bash.

.PHONY: install dev lint format typecheck test migrate precommit

## install: install JS deps (pnpm) and Python deps (uv)
install:
	pnpm install
	cd services/api && uv sync

## dev: run the Next.js web app
dev:
	pnpm --filter @katibay/web dev

## lint: ESLint + Prettier (TS) and Ruff + Black (Python)
lint:
	pnpm -r lint
	pnpm exec prettier --check .
	cd services/api && uv run ruff check .
	cd services/api && uv run black --check .

## format: auto-fix all formatters
format:
	pnpm exec prettier --write .
	cd services/api && uv run ruff check --fix .
	cd services/api && uv run black .

## typecheck: TypeScript project checks
typecheck:
	pnpm -r typecheck

## test: Vitest (TS) + pytest (Python)
test:
	pnpm -r test
	cd services/api && uv run pytest

## migrate: apply supabase/migrations/*.sql in order against SUPABASE_DB_URL
migrate:
	@if [ -f .env ]; then . ./.env; fi; \
	if [ -z "$$SUPABASE_DB_URL" ]; then \
		echo "SUPABASE_DB_URL is not set — add it to .env"; \
		exit 1; \
	fi; \
	files=$$(ls supabase/migrations/*.sql 2>/dev/null || true); \
	if [ -z "$$files" ]; then \
		echo "No migrations found in supabase/migrations — nothing to apply."; \
	else \
		for f in $$files; do \
			echo "Applying $$f"; \
			psql "$$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$$f" || exit 1; \
		done; \
	fi

## precommit: install git hooks
precommit:
	pre-commit install
