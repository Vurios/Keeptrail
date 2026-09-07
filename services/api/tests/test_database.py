"""Acceptance and migration tests for Prompt 2: Database Schema & RLS."""

import os
from pathlib import Path

import asyncpg
import pytest

MIGRATIONS_DIR = Path(__file__).parent.parent.parent.parent / "supabase" / "migrations"
SEED_FILE = Path(__file__).parent.parent.parent.parent / "supabase" / "seed.sql"
AUTH_SHIM_FILE = Path(__file__).parent / "fixtures" / "auth_shim.sql"


def test_migration_files_exist_and_contain_required_objects():
    """Validates presence and contents of migrations per Prompt 2 specs."""
    m1 = MIGRATIONS_DIR / "0001_enums.sql"
    m2 = MIGRATIONS_DIR / "0002_tables.sql"
    m3 = MIGRATIONS_DIR / "0003_rls.sql"

    assert m1.exists(), "Migration 0001_enums.sql is missing"
    assert m2.exists(), "Migration 0002_tables.sql is missing"
    assert m3.exists(), "Migration 0003_rls.sql is missing"
    assert SEED_FILE.exists(), "seed.sql is missing"

    m2_sql = m2.read_text(encoding="utf-8")
    # All 14 required tables
    required_tables = [
        "users",
        "workspaces",
        "workspace_members",
        "activities",
        "budget_lines",
        "receipts",
        "receipt_line_items",
        "exceptions",
        "ledger_entries",
        "passports",
        "claims",
        "audit_events",
        "exports",
        "jobs",
    ]
    for table in required_tables:
        assert f"create table public.{table}" in m2_sql, f"Missing table public.{table}"

    # Required indexes
    assert "idx_receipts_sha256" in m2_sql
    assert "idx_receipts_perceptual_hash" in m2_sql
    assert "idx_receipts_activity_status" in m2_sql

    # RLS checks in 0003_rls.sql
    m3_sql = m3.read_text(encoding="utf-8")
    for table in required_tables:
        assert f"alter table public.{table} enable row level security;" in m3_sql

    # Audit events update/delete revoked
    assert "revoke update, delete on table public.audit_events" in m3_sql


@pytest.mark.asyncio
async def test_rls_cross_workspace_isolation_live():
    """Acceptance Criteria (Live DB):

    Proves a user in workspace A cannot select rows from workspace B under RLS.
    """
    db_url = os.getenv("TEST_DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not db_url:
        pytest.skip("No live PostgreSQL connection provided (set SUPABASE_DB_URL).")

    conn = await asyncpg.connect(db_url)
    try:
        if AUTH_SHIM_FILE.exists():
            await conn.execute(AUTH_SHIM_FILE.read_text(encoding="utf-8"))
        for sql_file in sorted(MIGRATIONS_DIR.glob("*.sql")):
            await conn.execute(sql_file.read_text(encoding="utf-8"))
        await conn.execute(SEED_FILE.read_text(encoding="utf-8"))

        user_a_id = "d0000000-0000-4000-8000-000000000001"
        workspace_b_id = "d0000000-0000-4000-8000-000000000099"

        async with conn.transaction():
            await conn.execute("SET LOCAL ROLE authenticated;")
            await conn.execute(f"SET LOCAL request.jwt.claim.sub = '{user_a_id}';")

            rows = await conn.fetch(
                "SELECT * FROM public.receipts WHERE workspace_id = $1",
                workspace_b_id,
            )
            assert len(rows) == 0

    finally:
        await conn.close()
