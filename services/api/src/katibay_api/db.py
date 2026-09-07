"""Database access layer and repository interface."""

import json
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

import asyncpg

from katibay_api.config import settings
from katibay_api.duplicates import ExistingReceiptCandidate


@dataclass
class ReceiptRecord:
    id: uuid.UUID
    workspace_id: uuid.UUID
    activity_id: uuid.UUID | None
    uploaded_by: uuid.UUID
    storage_path: str
    sha256: str
    perceptual_hash: str | None
    status: str
    created_at: datetime
    updated_at: datetime


@dataclass
class ExceptionRecord:
    id: uuid.UUID
    receipt_id: uuid.UUID | None
    activity_id: uuid.UUID | None
    kind: str
    severity: str
    question_text: str
    suggested_values: dict[str, Any] | None
    status: str
    created_at: datetime
    updated_at: datetime


@dataclass
class JobRecord:
    id: uuid.UUID
    kind: str
    payload: dict[str, Any]
    status: str
    attempts: int
    created_at: datetime
    updated_at: datetime


@dataclass
class AuditEventRecord:
    id: uuid.UUID
    workspace_id: uuid.UUID
    actor_id: uuid.UUID | None
    entity_type: str
    entity_id: uuid.UUID
    action: str
    before: dict[str, Any] | None
    after: dict[str, Any] | None
    occurred_at: datetime


class DatabaseRepository(Protocol):
    """Protocol defining all database operations required by the receipt pipeline."""

    async def get_workspace_receipt_candidates(
        self, workspace_id: uuid.UUID
    ) -> Sequence[ExistingReceiptCandidate]: ...

    async def insert_receipt(
        self,
        receipt_id: uuid.UUID,
        workspace_id: uuid.UUID,
        uploaded_by: uuid.UUID,
        storage_path: str,
        sha256: str,
        perceptual_hash: str,
        status: str = "queued",
        activity_id: uuid.UUID | None = None,
    ) -> ReceiptRecord: ...

    async def insert_duplicate_exception(
        self,
        receipt_id: uuid.UUID,
        activity_id: uuid.UUID | None,
        question_text: str,
        suggested_values: dict[str, Any],
        severity: str = "blocking",
    ) -> ExceptionRecord: ...

    async def enqueue_extract_receipt_job(
        self,
        receipt_id: uuid.UUID,
        workspace_id: uuid.UUID,
        storage_path: str,
    ) -> JobRecord: ...

    async def insert_audit_event(
        self,
        workspace_id: uuid.UUID,
        actor_id: uuid.UUID | None,
        entity_type: str,
        entity_id: uuid.UUID,
        action: str,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
    ) -> AuditEventRecord: ...

    async def get_activity_audit_events(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]: ...

    async def get_activity(self, activity_id: uuid.UUID) -> dict[str, Any] | None: ...

    async def get_budget_lines(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]: ...

    async def get_activity_receipts(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]: ...

    async def get_merchant_rules(
        self, workspace_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]: ...

    async def get_exception(self, exception_id: uuid.UUID) -> dict[str, Any] | None: ...

    async def get_activity_exceptions(
        self,
        activity_id: uuid.UUID,
        kind: str | None = None,
        severity: str | None = None,
        status: str | None = None,
    ) -> Sequence[dict[str, Any]]: ...

    async def update_exception(
        self,
        exception_id: uuid.UUID,
        status: str,
        resolved_by: uuid.UUID,
        resolution_note: str,
    ) -> dict[str, Any]: ...

    async def get_receipt(self, receipt_id: uuid.UUID) -> dict[str, Any] | None: ...

    async def update_receipt(
        self, receipt_id: uuid.UUID, **fields: Any
    ) -> dict[str, Any]: ...

    async def insert_ledger_entry(
        self,
        activity_id: uuid.UUID,
        receipt_id: uuid.UUID,
        budget_line_id: uuid.UUID | None,
        amount: int,
        category: str,
        approved_by: uuid.UUID,
    ) -> dict[str, Any]: ...

    async def get_activity_ledger_entries(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]: ...

    async def update_activity_status(
        self, activity_id: uuid.UUID, status: str
    ) -> dict[str, Any]: ...

    async def insert_export(
        self,
        activity_id: uuid.UUID,
        kind: str,
        file_path: str,
        content_sha256: str,
        generated_by: uuid.UUID | None = None,
    ) -> dict[str, Any]: ...

    async def get_exports(self, activity_id: uuid.UUID) -> Sequence[dict[str, Any]]: ...

    async def insert_passport(
        self,
        workspace_id: uuid.UUID,
        receipt_id: uuid.UUID,
        item_name: str,
        brand: str | None,
        model: str | None,
        serial_number: str | None,
        purchase_date: Any,
        warranty_months: int,
        coverage_notes: str | None,
    ) -> dict[str, Any]: ...

    async def get_passport(self, passport_id: uuid.UUID) -> dict[str, Any] | None: ...

    async def get_workspace_passports(
        self, workspace_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]: ...

    async def update_passport_status(
        self, passport_id: uuid.UUID, status: str
    ) -> dict[str, Any]: ...

    async def insert_claim(
        self,
        passport_id: uuid.UUID,
        fault_description: str,
        packet_path: str | None = None,
    ) -> dict[str, Any]: ...

    async def get_passport_claims(
        self, passport_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]: ...


class AsyncpgRepository:
    """Production database repository using asyncpg connection pool."""

    def __init__(self, dsn: str = settings.supabase_db_url) -> None:
        self.dsn = dsn
        self._pool: asyncpg.Pool | None = None

    async def get_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(self.dsn)
        return self._pool

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def get_workspace_receipt_candidates(
        self, workspace_id: uuid.UUID
    ) -> Sequence[ExistingReceiptCandidate]:
        pool = await self.get_pool()
        rows = await pool.fetch(
            """
            SELECT id, sha256, perceptual_hash
            FROM public.receipts
            WHERE workspace_id = $1
            """,
            workspace_id,
        )
        return [
            ExistingReceiptCandidate(
                id=row["id"],
                sha256=row["sha256"],
                perceptual_hash=row["perceptual_hash"],
            )
            for row in rows
        ]

    async def insert_receipt(
        self,
        receipt_id: uuid.UUID,
        workspace_id: uuid.UUID,
        uploaded_by: uuid.UUID,
        storage_path: str,
        sha256: str,
        perceptual_hash: str,
        status: str = "queued",
        activity_id: uuid.UUID | None = None,
    ) -> ReceiptRecord:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            INSERT INTO public.receipts (
                id, workspace_id, activity_id, uploaded_by,
                storage_path, sha256, perceptual_hash, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, workspace_id, activity_id, uploaded_by, storage_path,
                      sha256, perceptual_hash, status::text, created_at, updated_at
            """,
            receipt_id,
            workspace_id,
            activity_id,
            uploaded_by,
            storage_path,
            sha256,
            perceptual_hash,
            status,
        )
        return ReceiptRecord(
            id=row["id"],
            workspace_id=row["workspace_id"],
            activity_id=row["activity_id"],
            uploaded_by=row["uploaded_by"],
            storage_path=row["storage_path"],
            sha256=row["sha256"],
            perceptual_hash=row["perceptual_hash"],
            status=row["status"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    async def insert_duplicate_exception(
        self,
        receipt_id: uuid.UUID,
        activity_id: uuid.UUID | None,
        question_text: str,
        suggested_values: dict[str, Any],
        severity: str = "blocking",
    ) -> ExceptionRecord:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            INSERT INTO public.exceptions (
                receipt_id, activity_id, kind, severity,
                question_text, suggested_values, status
            ) VALUES ($1, $2, 'duplicate', $3, $4, $5, 'open')
            RETURNING id, receipt_id, activity_id, kind::text,
                      severity::text, question_text, suggested_values,
                      status::text, created_at, updated_at
            """,
            receipt_id,
            activity_id,
            severity,
            question_text,
            json.dumps(suggested_values),
        )
        return ExceptionRecord(
            id=row["id"],
            receipt_id=row["receipt_id"],
            activity_id=row["activity_id"],
            kind=row["kind"],
            severity=row["severity"],
            question_text=row["question_text"],
            suggested_values=(
                json.loads(row["suggested_values"])
                if isinstance(row["suggested_values"], str)
                else row["suggested_values"]
            ),
            status=row["status"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    async def enqueue_extract_receipt_job(
        self,
        receipt_id: uuid.UUID,
        workspace_id: uuid.UUID,
        storage_path: str,
    ) -> JobRecord:
        pool = await self.get_pool()
        payload = {
            "receipt_id": str(receipt_id),
            "workspace_id": str(workspace_id),
            "storage_path": storage_path,
        }
        row = await pool.fetchrow(
            """
            INSERT INTO public.jobs (kind, payload, status)
            VALUES ('extract_receipt', $1, 'pending')
            RETURNING id, kind, payload, status::text, attempts, created_at, updated_at
            """,
            json.dumps(payload),
        )
        return JobRecord(
            id=row["id"],
            kind=row["kind"],
            payload=(
                json.loads(row["payload"])
                if isinstance(row["payload"], str)
                else row["payload"]
            ),
            status=row["status"],
            attempts=row["attempts"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    async def insert_audit_event(
        self,
        workspace_id: uuid.UUID,
        actor_id: uuid.UUID | None,
        entity_type: str,
        entity_id: uuid.UUID,
        action: str,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
    ) -> AuditEventRecord:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            INSERT INTO public.audit_events (
                workspace_id, actor_id, entity_type, entity_id, action, before, after
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, workspace_id, actor_id, entity_type, entity_id, action,
                      before, after, occurred_at
            """,
            workspace_id,
            actor_id,
            entity_type,
            entity_id,
            action,
            json.dumps(before) if before else None,
            json.dumps(after) if after else None,
        )
        return AuditEventRecord(
            id=row["id"],
            workspace_id=row["workspace_id"],
            actor_id=row["actor_id"],
            entity_type=row["entity_type"],
            entity_id=row["entity_id"],
            action=row["action"],
            before=row["before"],
            after=row["after"],
            occurred_at=row["occurred_at"],
        )

    async def get_activity_audit_events(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        pool = await self.get_pool()
        rows = await pool.fetch(
            """
            SELECT ae.id, ae.workspace_id, ae.actor_id, ae.entity_type, ae.entity_id,
                   ae.action, ae.before, ae.after, ae.occurred_at
            FROM public.audit_events ae
            WHERE ae.entity_id = $1
               OR ae.entity_id IN (
                   SELECT id FROM public.receipts WHERE activity_id = $1
               )
               OR ae.entity_id IN (
                   SELECT id FROM public.exceptions
                   WHERE activity_id = $1
                      OR receipt_id IN (
                          SELECT id FROM public.receipts WHERE activity_id = $1
                      )
               )
               OR ae.entity_id IN (
                   SELECT id FROM public.ledger_entries WHERE activity_id = $1
               )
            ORDER BY ae.occurred_at ASC
            """,
            activity_id,
        )

        return [
            {
                "id": r["id"],
                "workspace_id": r["workspace_id"],
                "actor_id": r["actor_id"],
                "entity_type": r["entity_type"],
                "entity_id": r["entity_id"],
                "action": r["action"],
                "before": (
                    json.loads(r["before"])
                    if isinstance(r["before"], str)
                    else r["before"]
                ),
                "after": (
                    json.loads(r["after"])
                    if isinstance(r["after"], str)
                    else r["after"]
                ),
                "occurred_at": r["occurred_at"],
            }
            for r in rows
        ]

    async def get_activity(self, activity_id: uuid.UUID) -> dict[str, Any] | None:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            SELECT id, workspace_id, title, start_date, end_date,
                   cash_advance_amount, status
            FROM public.activities
            WHERE id = $1

            """,
            activity_id,
        )
        return dict(row) if row else None

    async def get_budget_lines(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        pool = await self.get_pool()
        rows = await pool.fetch(
            """
            SELECT id, activity_id, category, approved_amount, notes
            FROM public.budget_lines
            WHERE activity_id = $1
            ORDER BY created_at ASC
            """,
            activity_id,
        )
        return [dict(r) for r in rows]

    async def get_activity_receipts(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        pool = await self.get_pool()
        rows = await pool.fetch(
            """
            SELECT id, workspace_id, activity_id, merchant_name, merchant_tin,
                   txn_date, total_amount, status
            FROM public.receipts
            WHERE activity_id = $1 AND status IN ('verified', 'approved', 'extracted')
            ORDER BY txn_date ASC
            """,
            activity_id,
        )
        return [dict(r) for r in rows]

    async def get_merchant_rules(
        self, workspace_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        pool = await self.get_pool()
        rows = await pool.fetch(
            """
            SELECT id, workspace_id, pattern, category
            FROM public.merchant_rules
            WHERE workspace_id = $1
            ORDER BY created_at ASC
            """,
            workspace_id,
        )
        return [dict(r) for r in rows]

    async def get_exception(self, exception_id: uuid.UUID) -> dict[str, Any] | None:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            SELECT id, receipt_id, activity_id, kind::text, severity::text,
                   question_text, suggested_values, status::text, resolved_by,
                   resolution_note, created_at, updated_at
            FROM public.exceptions
            WHERE id = $1
            """,
            exception_id,
        )
        return dict(row) if row else None

    async def get_activity_exceptions(
        self,
        activity_id: uuid.UUID,
        kind: str | None = None,
        severity: str | None = None,
        status: str | None = None,
    ) -> Sequence[dict[str, Any]]:
        pool = await self.get_pool()
        query = """
            SELECT e.id, e.receipt_id, e.activity_id, e.kind::text,
                   e.severity::text, e.question_text, e.suggested_values,
                   e.status::text, e.resolved_by, e.resolution_note,
                   e.created_at, e.updated_at
            FROM public.exceptions e
            LEFT JOIN public.receipts r ON e.receipt_id = r.id
            WHERE (e.activity_id = $1 OR r.activity_id = $1)
        """
        params: list[Any] = [activity_id]
        if kind:
            params.append(kind)
            query += f" AND e.kind = ${len(params)}"
        if severity:
            params.append(severity)
            query += f" AND e.severity = ${len(params)}"
        if status:
            params.append(status)
            query += f" AND e.status = ${len(params)}"

        query += " ORDER BY e.created_at ASC"
        rows = await pool.fetch(query, *params)
        return [dict(r) for r in rows]

    async def update_exception(
        self,
        exception_id: uuid.UUID,
        status: str,
        resolved_by: uuid.UUID,
        resolution_note: str,
    ) -> dict[str, Any]:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            UPDATE public.exceptions
            SET status = $2,
                resolved_by = $3,
                resolution_note = $4,
                updated_at = now()
            WHERE id = $1
            RETURNING id, receipt_id, activity_id, kind::text, severity::text,
                      question_text, suggested_values, status::text, resolved_by,
                      resolution_note, created_at, updated_at
            """,
            exception_id,
            status,
            resolved_by,
            resolution_note,
        )
        return dict(row) if row else {}

    async def get_receipt(self, receipt_id: uuid.UUID) -> dict[str, Any] | None:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            SELECT id, workspace_id, activity_id, uploaded_by, storage_path,
                   sha256, perceptual_hash, status::text, merchant_name,
                   merchant_tin, merchant_address, txn_date, txn_time,
                   or_number, subtotal, vat_amount, total_amount, category,
                   confidence, raw_extraction, model_version, created_at,
                   updated_at
            FROM public.receipts
            WHERE id = $1
            """,
            receipt_id,
        )
        return dict(row) if row else None

    async def update_receipt(
        self, receipt_id: uuid.UUID, **fields: Any
    ) -> dict[str, Any]:
        pool = await self.get_pool()
        if not fields:
            r = await self.get_receipt(receipt_id)
            return r or {}

        set_clauses = []
        values: list[Any] = [receipt_id]
        for k, v in fields.items():
            values.append(v)
            set_clauses.append(f"{k} = ${len(values)}")

        query = f"""
            UPDATE public.receipts
            SET {', '.join(set_clauses)}, updated_at = now()
            WHERE id = $1
            RETURNING id, workspace_id, activity_id, uploaded_by, storage_path,
                      sha256, perceptual_hash, status::text, merchant_name,
                      merchant_tin, txn_date, total_amount, category,
                      confidence, created_at, updated_at
        """
        row = await pool.fetchrow(query, *values)
        return dict(row) if row else {}

    async def insert_ledger_entry(
        self,
        activity_id: uuid.UUID,
        receipt_id: uuid.UUID,
        budget_line_id: uuid.UUID | None,
        amount: int,
        category: str,
        approved_by: uuid.UUID,
    ) -> dict[str, Any]:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            INSERT INTO public.ledger_entries (
                activity_id, receipt_id, budget_line_id, amount, category, approved_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, activity_id, receipt_id, budget_line_id, amount,
                      category, approved_by, approved_at, created_at, updated_at
            """,
            activity_id,
            receipt_id,
            budget_line_id,
            amount,
            category,
            approved_by,
        )
        return dict(row) if row else {}

    async def get_activity_ledger_entries(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        pool = await self.get_pool()
        rows = await pool.fetch(
            """
            SELECT l.id, l.activity_id, l.receipt_id, l.budget_line_id, l.amount,
                   l.category, l.approved_by, l.approved_at, l.created_at, l.updated_at,
                   r.merchant_name, r.merchant_tin, r.txn_date, r.or_number,
                   r.storage_path, r.confidence, r.sha256
            FROM public.ledger_entries l
            JOIN public.receipts r ON l.receipt_id = r.id
            WHERE l.activity_id = $1
            ORDER BY r.txn_date ASC, l.created_at ASC
            """,
            activity_id,
        )
        return [dict(r) for r in rows]

    async def update_activity_status(
        self, activity_id: uuid.UUID, status: str
    ) -> dict[str, Any]:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            UPDATE public.activities
            SET status = $2, updated_at = now()
            WHERE id = $1
            RETURNING id, workspace_id, title, start_date, end_date,
                      cash_advance_amount, status::text, created_at, updated_at
            """,
            activity_id,
            status,
        )
        return dict(row) if row else {}

    async def insert_export(
        self,
        activity_id: uuid.UUID,
        kind: str,
        file_path: str,
        content_sha256: str,
        generated_by: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            INSERT INTO public.exports (
                activity_id, kind, file_path, content_sha256, generated_by
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, activity_id, kind::text, file_path, content_sha256,
                      generated_by, generated_at, created_at, updated_at
            """,
            activity_id,
            kind,
            file_path,
            content_sha256,
            generated_by,
        )
        return dict(row) if row else {}

    async def get_exports(self, activity_id: uuid.UUID) -> Sequence[dict[str, Any]]:
        pool = await self.get_pool()
        rows = await pool.fetch(
            """
            SELECT id, activity_id, kind::text, file_path, content_sha256,
                   generated_by, generated_at, created_at, updated_at
            FROM public.exports
            WHERE activity_id = $1
            ORDER BY generated_at DESC
            """,
            activity_id,
        )
        return [dict(r) for r in rows]

    async def insert_passport(
        self,
        workspace_id: uuid.UUID,
        receipt_id: uuid.UUID,
        item_name: str,
        brand: str | None,
        model: str | None,
        serial_number: str | None,
        purchase_date: Any,
        warranty_months: int,
        coverage_notes: str | None,
    ) -> dict[str, Any]:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            INSERT INTO public.passports (
                workspace_id, receipt_id, item_name, brand, model,
                serial_number, purchase_date, warranty_months, coverage_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, workspace_id, receipt_id, item_name, brand, model,
                      serial_number, purchase_date, warranty_months,
                      warranty_expires_at, coverage_notes, status::text,
                      created_at, updated_at
            """,
            workspace_id,
            receipt_id,
            item_name,
            brand,
            model,
            serial_number,
            purchase_date,
            warranty_months,
            coverage_notes,
        )
        return dict(row) if row else {}

    async def get_passport(self, passport_id: uuid.UUID) -> dict[str, Any] | None:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            SELECT p.id, p.workspace_id, p.receipt_id, p.item_name, p.brand, p.model,
                   p.serial_number, p.purchase_date, p.warranty_months,
                   p.warranty_expires_at, p.coverage_notes, p.status::text,
                   p.created_at, p.updated_at,
                   r.merchant_name, r.storage_path, r.or_number, r.total_amount
            FROM public.passports p
            JOIN public.receipts r ON p.receipt_id = r.id
            WHERE p.id = $1
            """,
            passport_id,
        )
        return dict(row) if row else None

    async def get_workspace_passports(
        self, workspace_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        pool = await self.get_pool()
        rows = await pool.fetch(
            """
            SELECT p.id, p.workspace_id, p.receipt_id, p.item_name, p.brand, p.model,
                   p.serial_number, p.purchase_date, p.warranty_months,
                   p.warranty_expires_at, p.coverage_notes, p.status::text,
                   p.created_at, p.updated_at,
                   r.merchant_name, r.storage_path, r.or_number, r.total_amount
            FROM public.passports p
            JOIN public.receipts r ON p.receipt_id = r.id
            WHERE p.workspace_id = $1
            ORDER BY p.warranty_expires_at ASC
            """,
            workspace_id,
        )
        return [dict(r) for r in rows]

    async def update_passport_status(
        self, passport_id: uuid.UUID, status: str
    ) -> dict[str, Any]:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            UPDATE public.passports
            SET status = $2, updated_at = now()
            WHERE id = $1
            RETURNING id, workspace_id, receipt_id, item_name, brand, model,
                      serial_number, purchase_date, warranty_months,
                      warranty_expires_at, coverage_notes, status::text,
                      created_at, updated_at
            """,
            passport_id,
            status,
        )
        return dict(row) if row else {}

    async def insert_claim(
        self,
        passport_id: uuid.UUID,
        fault_description: str,
        packet_path: str | None = None,
    ) -> dict[str, Any]:
        pool = await self.get_pool()
        row = await pool.fetchrow(
            """
            INSERT INTO public.claims (
                passport_id, fault_description, packet_path
            ) VALUES ($1, $2, $3)
            RETURNING id, passport_id, fault_description, opened_at,
                      status::text, packet_path, created_at, updated_at
            """,
            passport_id,
            fault_description,
            packet_path,
        )
        return dict(row) if row else {}

    async def get_passport_claims(
        self, passport_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        pool = await self.get_pool()
        rows = await pool.fetch(
            """
            SELECT id, passport_id, fault_description, opened_at,
                   status::text, packet_path, created_at, updated_at
            FROM public.claims
            WHERE passport_id = $1
            ORDER BY opened_at DESC
            """,
            passport_id,
        )
        return [dict(r) for r in rows]


class InMemoryRepository:
    """In-memory repository used for fast, self-contained unit tests."""

    def __init__(self) -> None:
        self.receipts: list[ReceiptRecord] = []
        self.exceptions: list[ExceptionRecord] = []
        self.jobs: list[JobRecord] = []
        self.audit_events: list[AuditEventRecord] = []
        self.activities: list[dict[str, Any]] = []
        self.budget_lines: list[dict[str, Any]] = []
        self.merchant_rules: list[dict[str, Any]] = []
        self.ledger_entries: list[dict[str, Any]] = []
        self.exports: list[dict[str, Any]] = []
        self.passports: list[dict[str, Any]] = []
        self.claims: list[dict[str, Any]] = []

    async def get_workspace_receipt_candidates(
        self, workspace_id: uuid.UUID
    ) -> Sequence[ExistingReceiptCandidate]:
        return [
            ExistingReceiptCandidate(
                id=r.id,
                sha256=r.sha256,
                perceptual_hash=r.perceptual_hash,
            )
            for r in self.receipts
            if r.workspace_id == workspace_id
        ]

    async def insert_receipt(
        self,
        receipt_id: uuid.UUID,
        workspace_id: uuid.UUID,
        uploaded_by: uuid.UUID,
        storage_path: str,
        sha256: str,
        perceptual_hash: str,
        status: str = "queued",
        activity_id: uuid.UUID | None = None,
    ) -> ReceiptRecord:
        now = datetime.now(UTC)
        record = ReceiptRecord(
            id=receipt_id,
            workspace_id=workspace_id,
            activity_id=activity_id,
            uploaded_by=uploaded_by,
            storage_path=storage_path,
            sha256=sha256,
            perceptual_hash=perceptual_hash,
            status=status,
            created_at=now,
            updated_at=now,
        )
        self.receipts.append(record)
        return record

    async def insert_duplicate_exception(
        self,
        receipt_id: uuid.UUID,
        activity_id: uuid.UUID | None,
        question_text: str,
        suggested_values: dict[str, Any],
        severity: str = "blocking",
    ) -> ExceptionRecord:
        now = datetime.now(UTC)
        record = ExceptionRecord(
            id=uuid.uuid4(),
            receipt_id=receipt_id,
            activity_id=activity_id,
            kind="duplicate",
            severity=severity,
            question_text=question_text,
            suggested_values=suggested_values,
            status="open",
            created_at=now,
            updated_at=now,
        )
        self.exceptions.append(record)
        return record

    async def enqueue_extract_receipt_job(
        self,
        receipt_id: uuid.UUID,
        workspace_id: uuid.UUID,
        storage_path: str,
    ) -> JobRecord:
        now = datetime.now(UTC)
        payload = {
            "receipt_id": str(receipt_id),
            "workspace_id": str(workspace_id),
            "storage_path": storage_path,
        }
        record = JobRecord(
            id=uuid.uuid4(),
            kind="extract_receipt",
            payload=payload,
            status="pending",
            attempts=0,
            created_at=now,
            updated_at=now,
        )
        self.jobs.append(record)
        return record

    async def insert_audit_event(
        self,
        workspace_id: uuid.UUID,
        actor_id: uuid.UUID | None,
        entity_type: str,
        entity_id: uuid.UUID,
        action: str,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
    ) -> AuditEventRecord:
        now = datetime.now(UTC)
        record = AuditEventRecord(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            actor_id=actor_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            before=before,
            after=after,
            occurred_at=now,
        )
        self.audit_events.append(record)
        return record

    async def get_activity_audit_events(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        receipt_ids = {
            r.id
            for r in self.receipts
            if getattr(r, "activity_id", None) == activity_id
        }
        exception_ids = {
            exc.id
            for exc in self.exceptions
            if getattr(exc, "activity_id", None) == activity_id
            or getattr(exc, "receipt_id", None) in receipt_ids
        }
        ledger_ids = {
            entry["id"]
            for entry in self.ledger_entries
            if entry.get("activity_id") == activity_id
        }

        matching = []
        for ev in self.audit_events:
            if (
                ev.entity_id == activity_id
                or ev.entity_id in receipt_ids
                or ev.entity_id in exception_ids
                or ev.entity_id in ledger_ids
            ):
                matching.append(
                    {
                        "id": ev.id,
                        "workspace_id": ev.workspace_id,
                        "actor_id": ev.actor_id,
                        "entity_type": ev.entity_type,
                        "entity_id": ev.entity_id,
                        "action": ev.action,
                        "before": ev.before,
                        "after": ev.after,
                        "occurred_at": ev.occurred_at,
                    }
                )
        return sorted(matching, key=lambda x: x["occurred_at"])

    async def get_activity(self, activity_id: uuid.UUID) -> dict[str, Any] | None:
        for a in self.activities:
            if a["id"] == activity_id:
                return a
        return None

    async def get_budget_lines(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        return [bl for bl in self.budget_lines if bl["activity_id"] == activity_id]

    async def get_activity_receipts(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        return [
            {
                "id": r.id,
                "workspace_id": r.workspace_id,
                "activity_id": r.activity_id,
                "storage_path": r.storage_path,
                "status": r.status,
                "merchant_name": getattr(r, "merchant_name", None),
                "total_amount": getattr(r, "total_amount", 0),
                "category": getattr(r, "category", None),
                "txn_date": getattr(r, "txn_date", None),
            }
            for r in self.receipts
            if r.activity_id == activity_id
        ]

    async def get_merchant_rules(
        self, workspace_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        return [mr for mr in self.merchant_rules if mr["workspace_id"] == workspace_id]

    async def get_exception(self, exception_id: uuid.UUID) -> dict[str, Any] | None:
        for exc in self.exceptions:
            if exc.id == exception_id:
                return {
                    "id": exc.id,
                    "receipt_id": exc.receipt_id,
                    "activity_id": exc.activity_id,
                    "kind": exc.kind,
                    "severity": exc.severity,
                    "question_text": exc.question_text,
                    "suggested_values": exc.suggested_values,
                    "status": exc.status,
                    "resolved_by": getattr(exc, "resolved_by", None),
                    "resolution_note": getattr(exc, "resolution_note", None),
                    "created_at": exc.created_at,
                    "updated_at": exc.updated_at,
                }
        return None

    async def get_activity_exceptions(
        self,
        activity_id: uuid.UUID,
        kind: str | None = None,
        severity: str | None = None,
        status: str | None = None,
    ) -> Sequence[dict[str, Any]]:
        results = []
        # Find receipts for activity
        activity_receipt_ids = {
            r.id for r in self.receipts if r.activity_id == activity_id
        }

        for exc in self.exceptions:
            matches_activity = (
                exc.activity_id == activity_id or exc.receipt_id in activity_receipt_ids
            )
            if not matches_activity:
                continue
            if kind and exc.kind != kind:
                continue
            if severity and exc.severity != severity:
                continue
            if status and exc.status != status:
                continue

            results.append(
                {
                    "id": exc.id,
                    "receipt_id": exc.receipt_id,
                    "activity_id": exc.activity_id,
                    "kind": exc.kind,
                    "severity": exc.severity,
                    "question_text": exc.question_text,
                    "suggested_values": exc.suggested_values,
                    "status": exc.status,
                    "resolved_by": getattr(exc, "resolved_by", None),
                    "resolution_note": getattr(exc, "resolution_note", None),
                    "created_at": exc.created_at,
                    "updated_at": exc.updated_at,
                }
            )
        return results

    async def update_exception(
        self,
        exception_id: uuid.UUID,
        status: str,
        resolved_by: uuid.UUID,
        resolution_note: str,
    ) -> dict[str, Any]:
        for exc in self.exceptions:
            if exc.id == exception_id:
                exc.status = status
                exc.resolved_by = resolved_by
                exc.resolution_note = resolution_note
                exc.updated_at = datetime.now(UTC)
                return {
                    "id": exc.id,
                    "receipt_id": exc.receipt_id,
                    "activity_id": exc.activity_id,
                    "kind": exc.kind,
                    "severity": exc.severity,
                    "question_text": exc.question_text,
                    "suggested_values": exc.suggested_values,
                    "status": exc.status,
                    "resolved_by": exc.resolved_by,
                    "resolution_note": exc.resolution_note,
                    "created_at": exc.created_at,
                    "updated_at": exc.updated_at,
                }
        return {}

    async def get_receipt(self, receipt_id: uuid.UUID) -> dict[str, Any] | None:
        for r in self.receipts:
            if r.id == receipt_id:
                return {
                    "id": r.id,
                    "workspace_id": r.workspace_id,
                    "activity_id": getattr(r, "activity_id", None),
                    "uploaded_by": getattr(r, "uploaded_by", None),
                    "storage_path": getattr(r, "storage_path", None),
                    "sha256": getattr(r, "sha256", None),
                    "perceptual_hash": getattr(r, "perceptual_hash", None),
                    "status": getattr(r, "status", "verified"),
                    "merchant_name": getattr(r, "merchant_name", None),
                    "merchant_tin": getattr(r, "merchant_tin", None),
                    "txn_date": getattr(r, "txn_date", None),
                    "or_number": getattr(r, "or_number", None),
                    "total_amount": getattr(r, "total_amount", None),
                    "subtotal": getattr(r, "subtotal", None),
                    "vat_amount": getattr(r, "vat_amount", None),
                    "category": getattr(r, "category", None),
                    "confidence": getattr(r, "confidence", 1.0),
                    "created_at": getattr(r, "created_at", None),
                    "updated_at": getattr(r, "updated_at", None),
                }
        return None

    async def update_receipt(
        self, receipt_id: uuid.UUID, **fields: Any
    ) -> dict[str, Any]:
        for r in self.receipts:
            if r.id == receipt_id:
                for k, v in fields.items():
                    setattr(r, k, v)
                r.updated_at = datetime.now(UTC)
                return await self.get_receipt(receipt_id) or {}
        return {}

    async def insert_ledger_entry(
        self,
        activity_id: uuid.UUID,
        receipt_id: uuid.UUID,
        budget_line_id: uuid.UUID | None,
        amount: int,
        category: str,
        approved_by: uuid.UUID,
    ) -> dict[str, Any]:
        entry = {
            "id": uuid.uuid4(),
            "activity_id": activity_id,
            "receipt_id": receipt_id,
            "budget_line_id": budget_line_id,
            "amount": amount,
            "category": category,
            "approved_by": approved_by,
            "approved_at": datetime.now(UTC),
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
        }
        self.ledger_entries.append(entry)
        return entry

    async def get_activity_ledger_entries(
        self, activity_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        receipt_map = {r.id: r for r in self.receipts}
        results = []
        for entry in self.ledger_entries:
            if entry["activity_id"] == activity_id:
                r = receipt_map.get(entry["receipt_id"])
                results.append(
                    {
                        "id": entry["id"],
                        "activity_id": entry["activity_id"],
                        "receipt_id": entry["receipt_id"],
                        "budget_line_id": entry.get("budget_line_id"),
                        "amount": entry["amount"],
                        "category": entry["category"],
                        "approved_by": entry["approved_by"],
                        "approved_at": entry["approved_at"],
                        "merchant_name": (
                            getattr(r, "merchant_name", None) if r else None
                        ),
                        "merchant_tin": getattr(r, "merchant_tin", None) if r else None,
                        "txn_date": getattr(r, "txn_date", None) if r else None,
                        "or_number": getattr(r, "or_number", None) if r else None,
                        "storage_path": getattr(r, "storage_path", "") if r else "",
                        "confidence": getattr(r, "confidence", 1.0) if r else 1.0,
                        "sha256": getattr(r, "sha256", "") if r else "",
                    }
                )
        return results

    async def update_activity_status(
        self, activity_id: uuid.UUID, status: str
    ) -> dict[str, Any]:
        for a in self.activities:
            if a["id"] == activity_id:
                a["status"] = status
                a["updated_at"] = datetime.now(UTC)
                return a
        return {}

    async def insert_export(
        self,
        activity_id: uuid.UUID,
        kind: str,
        file_path: str,
        content_sha256: str,
        generated_by: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        export_record = {
            "id": uuid.uuid4(),
            "activity_id": activity_id,
            "kind": kind,
            "file_path": file_path,
            "content_sha256": content_sha256,
            "generated_by": generated_by,
            "generated_at": now,
            "created_at": now,
            "updated_at": now,
        }
        self.exports.append(export_record)
        return export_record

    async def get_exports(self, activity_id: uuid.UUID) -> Sequence[dict[str, Any]]:
        return [e for e in self.exports if e["activity_id"] == activity_id]

    async def insert_passport(
        self,
        workspace_id: uuid.UUID,
        receipt_id: uuid.UUID,
        item_name: str,
        brand: str | None,
        model: str | None,
        serial_number: str | None,
        purchase_date: Any,
        warranty_months: int,
        coverage_notes: str | None,
    ) -> dict[str, Any]:
        import calendar
        from datetime import date

        if isinstance(purchase_date, str):
            p_date = date.fromisoformat(purchase_date)
        elif isinstance(purchase_date, datetime):
            p_date = purchase_date.date()
        else:
            p_date = purchase_date

        year = p_date.year + (p_date.month + warranty_months - 1) // 12
        month = (p_date.month + warranty_months - 1) % 12 + 1
        max_day = calendar.monthrange(year, month)[1]
        day = min(p_date.day, max_day)
        expires_at = date(year, month, day)

        now = datetime.now(UTC)
        passport_record = {
            "id": uuid.uuid4(),
            "workspace_id": workspace_id,
            "receipt_id": receipt_id,
            "item_name": item_name,
            "brand": brand,
            "model": model,
            "serial_number": serial_number,
            "purchase_date": p_date,
            "warranty_months": warranty_months,
            "warranty_expires_at": expires_at,
            "coverage_notes": coverage_notes,
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        self.passports.append(passport_record)
        return passport_record

    async def get_passport(self, passport_id: uuid.UUID) -> dict[str, Any] | None:
        for p in self.passports:
            if p["id"] == passport_id:
                # enrich with receipt details if available
                receipt = next(
                    (r for r in self.receipts if r.id == p["receipt_id"]), None
                )
                res = dict(p)
                if receipt:
                    res["merchant_name"] = receipt.merchant_name
                    res["storage_path"] = receipt.storage_path
                    res["or_number"] = receipt.or_number
                    res["total_amount"] = receipt.total_amount
                return res
        return None

    async def get_workspace_passports(
        self, workspace_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        result = []
        for p in self.passports:
            if p["workspace_id"] == workspace_id:
                receipt = next(
                    (r for r in self.receipts if r.id == p["receipt_id"]), None
                )
                res = dict(p)
                if receipt:
                    res["merchant_name"] = receipt.merchant_name
                    res["storage_path"] = receipt.storage_path
                    res["or_number"] = receipt.or_number
                    res["total_amount"] = receipt.total_amount
                result.append(res)
        result.sort(key=lambda x: str(x["warranty_expires_at"]))
        return result

    async def update_passport_status(
        self, passport_id: uuid.UUID, status: str
    ) -> dict[str, Any]:
        for p in self.passports:
            if p["id"] == passport_id:
                p["status"] = status
                p["updated_at"] = datetime.now(UTC)
                return p
        return {}

    async def insert_claim(
        self,
        passport_id: uuid.UUID,
        fault_description: str,
        packet_path: str | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        claim_record = {
            "id": uuid.uuid4(),
            "passport_id": passport_id,
            "fault_description": fault_description,
            "opened_at": now,
            "status": "open",
            "packet_path": packet_path,
            "created_at": now,
            "updated_at": now,
        }
        self.claims.append(claim_record)
        return claim_record

    async def get_passport_claims(
        self, passport_id: uuid.UUID
    ) -> Sequence[dict[str, Any]]:
        return [c for c in self.claims if c["passport_id"] == passport_id]


_db_repo: DatabaseRepository = InMemoryRepository()


def get_db_repository() -> DatabaseRepository:
    return _db_repo


def set_db_repository(repo: DatabaseRepository) -> None:
    global _db_repo
    _db_repo = repo
