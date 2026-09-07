-- Katibay migration 0003: row-level security.
--
-- Model: a user may only read or write rows belonging to a workspace they are
-- a member of. Writes are gated by workspace role:
--   * owner / treasurer — manage activities, budgets, ledger approvals,
--     exception resolution (Prompt 9 endpoints enforce the same roles)
--   * member            — may upload receipts (and consumer-domain records),
--     nothing financial
--   * auditor           — read-only, everywhere
--
-- audit_events is append-only: it gets a SELECT policy only, and UPDATE/DELETE
-- are revoked from the client roles outright. The API's service role writes
-- audit rows server-side (bypasses RLS, keeps INSERT privilege).

-- Membership helpers -----------------------------------------------------------
-- SECURITY DEFINER so policies on workspace_members / workspaces can consult
-- membership without recursive RLS evaluation.

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.workspace_members m
        where m.workspace_id = p_workspace_id
          and m.user_id = auth.uid()
    )
$$;

create or replace function public.workspace_role(p_workspace_id uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public
as $$
    select m.role
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
$$;

revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.workspace_role(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.workspace_role(uuid) to authenticated, service_role;

-- Enable RLS everywhere ---------------------------------------------------------

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.activities enable row level security;
alter table public.budget_lines enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_line_items enable row level security;
alter table public.exceptions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.passports enable row level security;
alter table public.claims enable row level security;
alter table public.audit_events enable row level security;
alter table public.exports enable row level security;
alter table public.jobs enable row level security;

-- users -------------------------------------------------------------------------

create policy users_select on public.users
    for select using (
        id = auth.uid()
        or exists (
            select 1
            from public.workspace_members me
            join public.workspace_members them on me.workspace_id = them.workspace_id
            where me.user_id = auth.uid()
              and them.user_id = id
        )
    );

create policy users_insert on public.users
    for insert with check (id = auth.uid());

create policy users_update on public.users
    for update using (id = auth.uid()) with check (id = auth.uid());

-- workspaces --------------------------------------------------------------------

create policy workspaces_select on public.workspaces
    for select using (
        public.is_workspace_member(id) or created_by = auth.uid()
    );

create policy workspaces_insert on public.workspaces
    for insert with check (created_by = auth.uid());

create policy workspaces_update on public.workspaces
    for update
    using (public.workspace_role(id) = 'owner')
    with check (public.workspace_role(id) = 'owner');

create policy workspaces_delete on public.workspaces
    for delete using (public.workspace_role(id) = 'owner');

-- workspace_members ---------------------------------------------------------------

create policy workspace_members_select on public.workspace_members
    for select using (public.is_workspace_member(workspace_id));

-- The creator bootstraps their own owner row (workspaces_select exposes rows
-- they created via created_by); owners and treasurers manage the roster.
create policy workspace_members_insert on public.workspace_members
    for insert with check (
        exists (
            select 1
            from public.workspaces w
            where w.id = workspace_id
              and (
                  w.created_by = auth.uid()
                  or public.workspace_role(w.id) in ('owner', 'treasurer')
              )
        )
    );

create policy workspace_members_update on public.workspace_members
    for update
    using (public.workspace_role(workspace_id) = 'owner')
    with check (public.workspace_role(workspace_id) = 'owner');

create policy workspace_members_delete on public.workspace_members
    for delete using (public.workspace_role(workspace_id) = 'owner');

-- activities ----------------------------------------------------------------------

create policy activities_select on public.activities
    for select using (public.is_workspace_member(workspace_id));

create policy activities_insert on public.activities
    for insert with check (
        public.is_workspace_member(workspace_id)
        and public.workspace_role(workspace_id) in ('owner', 'treasurer')
    );

create policy activities_update on public.activities
    for update
    using (
        public.is_workspace_member(workspace_id)
        and public.workspace_role(workspace_id) in ('owner', 'treasurer')
    )
    with check (
        public.is_workspace_member(workspace_id)
        and public.workspace_role(workspace_id) in ('owner', 'treasurer')
    );

create policy activities_delete on public.activities
    for delete using (public.workspace_role(workspace_id) = 'owner');

-- budget_lines ---------------------------------------------------------------------

create policy budget_lines_select on public.budget_lines
    for select using (
        exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
        )
    );

create policy budget_lines_insert on public.budget_lines
    for insert with check (
        exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
              and public.workspace_role(a.workspace_id) in ('owner', 'treasurer')
        )
    );

create policy budget_lines_update on public.budget_lines
    for update
    using (
        exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
              and public.workspace_role(a.workspace_id) in ('owner', 'treasurer')
        )
    )
    with check (
        exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
              and public.workspace_role(a.workspace_id) in ('owner', 'treasurer')
        )
    );

create policy budget_lines_delete on public.budget_lines
    for delete using (
        exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
              and public.workspace_role(a.workspace_id) in ('owner', 'treasurer')
        )
    );

-- receipts ---------------------------------------------------------------------------
-- Members may upload (insert) but never edit or delete; financial edits belong
-- to owner/treasurer; the pipeline itself writes via the service role.

create policy receipts_select on public.receipts
    for select using (public.is_workspace_member(workspace_id));

create policy receipts_insert on public.receipts
    for insert with check (
        public.is_workspace_member(workspace_id)
        and public.workspace_role(workspace_id) in ('owner', 'treasurer', 'member')
    );

create policy receipts_update on public.receipts
    for update
    using (
        public.is_workspace_member(workspace_id)
        and public.workspace_role(workspace_id) in ('owner', 'treasurer')
    )
    with check (
        public.is_workspace_member(workspace_id)
        and public.workspace_role(workspace_id) in ('owner', 'treasurer')
    );

create policy receipts_delete on public.receipts
    for delete using (
        public.is_workspace_member(workspace_id)
        and public.workspace_role(workspace_id) in ('owner', 'treasurer')
    );

-- receipt_line_items -------------------------------------------------------------------
-- Written only by the extraction pipeline (service role). Clients may read.

create policy receipt_line_items_select on public.receipt_line_items
    for select using (
        exists (
            select 1
            from public.receipts r
            where r.id = receipt_id
              and public.is_workspace_member(r.workspace_id)
        )
    );

-- exceptions -----------------------------------------------------------------------------
-- The exception workspace is derived from its receipt or activity parent.

create policy exceptions_select on public.exceptions
    for select using (
        exists (
            select 1
            from public.receipts r
            where r.id = receipt_id
              and public.is_workspace_member(r.workspace_id)
        )
        or exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
        )
    );

-- Resolution is a treasurer/owner action (Prompt 9).
create policy exceptions_update on public.exceptions
    for update
    using (
        exists (
            select 1
            from public.receipts r
            where r.id = receipt_id
              and public.is_workspace_member(r.workspace_id)
              and public.workspace_role(r.workspace_id) in ('owner', 'treasurer')
        )
        or exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
              and public.workspace_role(a.workspace_id) in ('owner', 'treasurer')
        )
    )
    with check (
        exists (
            select 1
            from public.receipts r
            where r.id = receipt_id
              and public.is_workspace_member(r.workspace_id)
              and public.workspace_role(r.workspace_id) in ('owner', 'treasurer')
        )
        or exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
              and public.workspace_role(a.workspace_id) in ('owner', 'treasurer')
        )
    );

-- ledger_entries ---------------------------------------------------------------------------
-- Approving into the ledger is owner/treasurer only. Entries are immutable for
-- clients once written (no update/delete policies).

create policy ledger_entries_select on public.ledger_entries
    for select using (
        exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
        )
    );

create policy ledger_entries_insert on public.ledger_entries
    for insert with check (
        exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
              and public.workspace_role(a.workspace_id) in ('owner', 'treasurer')
        )
    );

-- passports ---------------------------------------------------------------------------------

create policy passports_select on public.passports
    for select using (public.is_workspace_member(workspace_id));

create policy passports_insert on public.passports
    for insert with check (
        public.is_workspace_member(workspace_id)
        and public.workspace_role(workspace_id) in ('owner', 'treasurer', 'member')
    );

create policy passports_update on public.passports
    for update
    using (
        public.is_workspace_member(workspace_id)
        and public.workspace_role(workspace_id) in ('owner', 'treasurer', 'member')
    )
    with check (
        public.is_workspace_member(workspace_id)
        and public.workspace_role(workspace_id) in ('owner', 'treasurer', 'member')
    );

create policy passports_delete on public.passports
    for delete using (
        public.is_workspace_member(workspace_id)
        and public.workspace_role(workspace_id) in ('owner', 'treasurer')
    );

-- claims --------------------------------------------------------------------------------------

create policy claims_select on public.claims
    for select using (
        exists (
            select 1
            from public.passports p
            where p.id = passport_id
              and public.is_workspace_member(p.workspace_id)
        )
    );

create policy claims_insert on public.claims
    for insert with check (
        exists (
            select 1
            from public.passports p
            where p.id = passport_id
              and public.is_workspace_member(p.workspace_id)
              and public.workspace_role(p.workspace_id) in ('owner', 'treasurer', 'member')
        )
    );

create policy claims_update on public.claims
    for update
    using (
        exists (
            select 1
            from public.passports p
            where p.id = passport_id
              and public.is_workspace_member(p.workspace_id)
              and public.workspace_role(p.workspace_id) in ('owner', 'treasurer', 'member')
        )
    )
    with check (
        exists (
            select 1
            from public.passports p
            where p.id = passport_id
              and public.is_workspace_member(p.workspace_id)
              and public.workspace_role(p.workspace_id) in ('owner', 'treasurer', 'member')
        )
    );

-- audit_events ----------------------------------------------------------------------------------
-- Append-only trust log. Clients may read rows for their workspaces; only the
-- service role writes (bypasses RLS). UPDATE/DELETE are revoked below, so even
-- a compromised client role cannot rewrite history.

create policy audit_events_select on public.audit_events
    for select using (public.is_workspace_member(workspace_id));

revoke update, delete on table public.audit_events from anon, authenticated, service_role;

-- exports -----------------------------------------------------------------------------------------

create policy exports_select on public.exports
    for select using (
        exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
        )
    );

create policy exports_insert on public.exports
    for insert with check (
        exists (
            select 1
            from public.activities a
            where a.id = activity_id
              and public.is_workspace_member(a.workspace_id)
              and public.workspace_role(a.workspace_id) in ('owner', 'treasurer')
        )
    );

-- jobs ----------------------------------------------------------------------------------------------
-- Server-only queue: RLS enabled with no policies denies every client role.
-- The worker connects with the service role (bypasses RLS).

-- (no policies for public.jobs)
