-- Katibay migration 0001: enum types.
-- Every status column in the schema is backed by an enum (blueprint §5).

create type public.user_locale as enum ('en', 'fil');

create type public.workspace_type as enum ('personal', 'organization');

create type public.workspace_role as enum ('owner', 'treasurer', 'member', 'auditor');

create type public.activity_status as enum ('draft', 'collecting', 'review', 'closed');

create type public.receipt_status as enum (
    'queued',
    'extracted',
    'verified',
    'exception',
    'approved',
    'rejected'
);

create type public.exception_kind as enum (
    'arith_mismatch',
    'duplicate',
    'out_of_period',
    'over_budget',
    'low_confidence',
    'missing_doc'
);

create type public.exception_severity as enum ('info', 'warning', 'blocking');

create type public.exception_status as enum ('open', 'resolved', 'waived');

create type public.export_kind as enum (
    'liquidation_report',
    'expense_summary',
    'variance_report',
    'evidence_zip',
    'claim_packet'
);

create type public.passport_status as enum ('active', 'expiring', 'expired', 'claimed');

create type public.claim_status as enum ('open', 'submitted', 'resolved');

create type public.job_status as enum ('pending', 'claimed', 'completed', 'failed', 'dead');
