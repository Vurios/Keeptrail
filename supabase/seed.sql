-- Katibay demo seed — one workspace, one activity with five budget lines,
-- three members. Idempotent (fixed UUIDs + on conflict do nothing).
--
-- Runs via `make migrate`'s sibling: psql -f supabase/seed.sql (as postgres).
-- On hosted Supabase this inserts minimal auth.users rows directly, which
-- requires the postgres role (fine for a demo); prefer the dashboard for
-- production users.

begin;

-- Demo identities ---------------------------------------------------------------

insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values
    ('d0000000-0000-4000-8000-000000000001', 'owner@demo.katibay.ph', '', now()),
    ('d0000000-0000-4000-8000-000000000002', 'treasurer@demo.katibay.ph', '', now()),
    ('d0000000-0000-4000-8000-000000000003', 'member@demo.katibay.ph', '', now())
on conflict (id) do nothing;

insert into public.users (id, email, full_name, locale)
values
    ('d0000000-0000-4000-8000-000000000001', 'owner@demo.katibay.ph', 'Maria Santos', 'en'),
    ('d0000000-0000-4000-8000-000000000002', 'treasurer@demo.katibay.ph', 'Juan Cruz', 'fil'),
    ('d0000000-0000-4000-8000-000000000003', 'member@demo.katibay.ph', 'Ana Reyes', 'en')
on conflict (id) do nothing;

-- Demo workspace ------------------------------------------------------------------

insert into public.workspaces (id, name, type, institution, created_by)
values (
    'd0000000-0000-4000-8000-000000000010',
    'UP Katibay Demo Council',
    'organization',
    'Demo University',
    'd0000000-0000-4000-8000-000000000001'
)
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
values
    ('d0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000001', 'owner'),
    ('d0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000002', 'treasurer'),
    ('d0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000003', 'member')
on conflict (workspace_id, user_id) do nothing;

-- Demo activity: ₱30,000 cash advance fully budgeted across five lines ----------

insert into public.activities (id, workspace_id, title, start_date, end_date, cash_advance_amount, status)
values (
    'd0000000-0000-4000-8000-000000000020',
    'd0000000-0000-4000-8000-000000000010',
    'Orientation Week 2026',
    '2026-08-01',
    '2026-09-30',
    3000000, -- ₱30,000.00 in centavos
    'collecting'
)
on conflict (id) do nothing;

insert into public.budget_lines (id, activity_id, category, approved_amount, notes)
values
    ('d0000000-0000-4000-8000-000000000031', 'd0000000-0000-4000-8000-000000000020', 'Food & Catering', 800000, 'Meals for volunteers and attendees'),
    ('d0000000-0000-4000-8000-000000000032', 'd0000000-0000-4000-8000-000000000020', 'Transportation', 500000, 'Jeepney and van rentals'),
    ('d0000000-0000-4000-8000-000000000033', 'd0000000-0000-4000-8000-000000000020', 'Materials', 900000, 'Props and event supplies'),
    ('d0000000-0000-4000-8000-000000000034', 'd0000000-0000-4000-8000-000000000020', 'Printing', 400000, 'Tarpaulins and flyers'),
    ('d0000000-0000-4000-8000-000000000035', 'd0000000-0000-4000-8000-000000000020', 'Prizes & Awards', 400000, 'Contest prizes')
on conflict (activity_id, category) do nothing;

commit;
