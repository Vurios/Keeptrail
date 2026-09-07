-- Katibay migration 0002: tables, constraints, indexes, updated_at triggers.
-- Rules encoded here (CLAUDE.md):
--   * All money columns are bigint centavos — never floats, never numeric.
--   * Uncertainty lives in *_confidence columns; extraction never mutates money.
--   * audit_events is append-only (privileges revoked in 0003_rls.sql).

-- updated_at maintenance ------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Identity & tenancy ----------------------------------------------------------

create table public.users (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null unique,
    full_name text not null,
    locale public.user_locale not null default 'en',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.workspaces (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    type public.workspace_type not null default 'organization',
    institution text,
    created_by uuid not null references public.users (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Composite unique keys let child tables pin (row, workspace) pairs so a
-- receipt can never be attached to an activity in another workspace.

create table public.workspace_members (
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    user_id uuid not null references public.users (id) on delete cascade,
    role public.workspace_role not null default 'member',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (workspace_id, user_id)
);

-- The liquidation domain ------------------------------------------------------

create table public.activities (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    title text not null,
    start_date date not null,
    end_date date not null,
    cash_advance_amount bigint not null default 0 check (cash_advance_amount >= 0),
    status public.activity_status not null default 'draft',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (end_date >= start_date)
);

create unique index activities_id_workspace_id_key on public.activities (id, workspace_id);

create table public.budget_lines (
    id uuid primary key default gen_random_uuid(),
    activity_id uuid not null references public.activities (id) on delete cascade,
    category text not null,
    approved_amount bigint not null check (approved_amount >= 0),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (activity_id, category)
);

create unique index budget_lines_id_activity_id_key on public.budget_lines (id, activity_id);

-- The canonical object: Verified Receipt Record -------------------------------

create table public.receipts (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    activity_id uuid references public.activities (id) on delete set null,
    uploaded_by uuid not null references public.users (id),
    storage_path text not null,
    perceptual_hash text,
    sha256 text not null check (char_length(sha256) = 64),
    status public.receipt_status not null default 'queued',
    merchant_name text,
    merchant_tin text,
    txn_date date,
    or_number text,
    subtotal bigint check (subtotal >= 0),
    vat_amount bigint check (vat_amount >= 0),
    total_amount bigint check (total_amount >= 0),
    payment_method text,
    extraction_confidence numeric(4, 3) check (extraction_confidence between 0 and 1),
    model_version text,
    raw_extraction jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- (activity_id, workspace_id) must match the activity's own pair, so a
-- receipt can never point at another workspace's activity.
alter table public.receipts
    add constraint receipts_activity_workspace_fkey
    foreign key (activity_id, workspace_id)
    references public.activities (id, workspace_id)
    on delete set null;

-- (id, activity_id) backs the ledger_entries composite FK. activity_id is
-- nullable here, but the ledger FK requires a non-null match, which is the
-- intended gate: only activity-bound receipts can be approved into a ledger.
create unique index receipts_id_activity_id_key on public.receipts (id, activity_id);

create table public.receipt_line_items (
    id uuid primary key default gen_random_uuid(),
    receipt_id uuid not null references public.receipts (id) on delete cascade,
    description text not null,
    qty numeric(12, 3) not null check (qty > 0),
    unit_price bigint not null check (unit_price >= 0),
    line_total bigint not null check (line_total >= 0),
    confidence numeric(4, 3) check (confidence between 0 and 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Verification & reconciliation ------------------------------------------------

create table public.exceptions (
    id uuid primary key default gen_random_uuid(),
    receipt_id uuid references public.receipts (id) on delete cascade,
    activity_id uuid references public.activities (id) on delete cascade,
    kind public.exception_kind not null,
    severity public.exception_severity not null default 'blocking',
    question_text text not null,
    suggested_values jsonb,
    status public.exception_status not null default 'open',
    resolved_by uuid references public.users (id),
    resolution_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- RLS derives the workspace from one of these parents.
    check (receipt_id is not null or activity_id is not null),
    -- Rule 3: resolving or waiving always names who and why (Prompt 9).
    check (
        status = 'open'
        or (resolved_by is not null and resolution_note is not null)
    )
);

-- Ledger entries must reference a receipt that is bound to the same activity
-- (composite FK against receipts(id, activity_id) below).

create table public.ledger_entries (
    id uuid primary key default gen_random_uuid(),
    activity_id uuid not null references public.activities (id) on delete cascade,
    receipt_id uuid not null,
    budget_line_id uuid references public.budget_lines (id) on delete set null,
    amount bigint not null check (amount >= 0),
    category text not null,
    approved_by uuid not null references public.users (id),
    approved_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- A ledger entry's budget line must belong to the entry's own activity.
alter table public.ledger_entries
    add constraint ledger_entries_budget_line_activity_fkey
    foreign key (budget_line_id, activity_id)
    references public.budget_lines (id, activity_id)
    on delete set null;

-- The receipt must carry this same activity_id (null-activity receipts cannot
-- be approved into the ledger yet).
alter table public.ledger_entries
    add constraint ledger_entries_receipt_activity_fkey
    foreign key (receipt_id, activity_id)
    references public.receipts (id, activity_id)
    on delete cascade;

-- The consumer domain -----------------------------------------------------------

create table public.passports (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    receipt_id uuid not null references public.receipts (id) on delete cascade,
    item_name text not null,
    brand text,
    model text,
    serial_number text,
    purchase_date date not null,
    warranty_months integer not null check (warranty_months > 0),
    warranty_expires_at date generated always as
        ((purchase_date + make_interval(months => warranty_months))::date) stored,
    coverage_notes text,
    status public.passport_status not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (receipt_id)
);

create table public.claims (
    id uuid primary key default gen_random_uuid(),
    passport_id uuid not null references public.passports (id) on delete cascade,
    fault_description text not null,
    opened_at timestamptz not null default now(),
    status public.claim_status not null default 'open',
    packet_path text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Trust ------------------------------------------------------------------------

create table public.audit_events (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    actor_id uuid references public.users (id),
    entity_type text not null,
    entity_id uuid not null,
    action text not null,
    before jsonb,
    after jsonb,
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.exports (
    id uuid primary key default gen_random_uuid(),
    activity_id uuid not null references public.activities (id) on delete cascade,
    kind public.export_kind not null,
    file_path text not null,
    content_sha256 text not null check (char_length(content_sha256) = 64),
    generated_by uuid references public.users (id),
    generated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Pipeline jobs (Prompt 4). `run_after` schedules retry backoff; `locked_by`
-- supports the visibility timeout on claim.
create table public.jobs (
    id uuid primary key default gen_random_uuid(),
    kind text not null,
    payload jsonb not null default '{}'::jsonb,
    status public.job_status not null default 'pending',
    attempts integer not null default 0,
    locked_at timestamptz,
    locked_by text,
    run_after timestamptz not null default now(),
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Indexes -----------------------------------------------------------------------
-- One index per foreign key (a composite index whose leading column is the FK
-- column satisfies the requirement — noted per index below).

create index idx_workspaces_created_by on public.workspaces (created_by);

create index idx_workspace_members_user_id on public.workspace_members (user_id);

create index idx_activities_workspace_id on public.activities (workspace_id);

create index idx_budget_lines_activity_id on public.budget_lines (activity_id);

create index idx_receipts_workspace_id on public.receipts (workspace_id);
-- uploaded_by FK:
create index idx_receipts_uploaded_by on public.receipts (uploaded_by);
-- Required by blueprint: exact-file dedupe:
create index idx_receipts_sha256 on public.receipts (sha256);
-- Required by blueprint: re-photograph dedupe:
create index idx_receipts_perceptual_hash on public.receipts (perceptual_hash);
-- Covers the activity_id FK plus the per-activity status scans the pipeline uses:
create index idx_receipts_activity_status on public.receipts (activity_id, status);

create index idx_receipt_line_items_receipt_id on public.receipt_line_items (receipt_id);

create index idx_exceptions_receipt_id on public.exceptions (receipt_id);
create index idx_exceptions_activity_id on public.exceptions (activity_id);
-- resolved_by FK:
create index idx_exceptions_resolved_by on public.exceptions (resolved_by);

create index idx_ledger_entries_activity_id on public.ledger_entries (activity_id);
create index idx_ledger_entries_receipt_id on public.ledger_entries (receipt_id);
create index idx_ledger_entries_budget_line_id on public.ledger_entries (budget_line_id);
-- approved_by FK:
create index idx_ledger_entries_approved_by on public.ledger_entries (approved_by);

create index idx_passports_workspace_id on public.passports (workspace_id);
-- passports.receipt_id FK is covered by the unique (receipt_id) constraint.

create index idx_claims_passport_id on public.claims (passport_id);

create index idx_audit_events_workspace_id on public.audit_events (workspace_id);
-- actor_id FK:
create index idx_audit_events_actor_id on public.audit_events (actor_id);
-- Entity history lookups (Prompt 15 audit viewer):
create index idx_audit_events_entity on public.audit_events (entity_type, entity_id);

create index idx_exports_activity_id on public.exports (activity_id);
-- generated_by FK:
create index idx_exports_generated_by on public.exports (generated_by);

-- Queue polling (Prompt 4):
create index idx_jobs_status_run_after on public.jobs (status, run_after);

-- updated_at triggers on every table -------------------------------------------

do $$
declare
    t text;
begin
    for t in
        select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
    loop
        execute format(
            'create trigger trg_%s_updated_at
             before update on public.%I
             for each row execute function public.set_updated_at()',
            t, t
        );
    end loop;
end;
$$;
