-- Katibay migration 0004: merchant_rules table for automated category classification.

create table public.merchant_rules (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    pattern text not null,
    category text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_merchant_rules_workspace_id on public.merchant_rules (workspace_id);

create trigger tr_merchant_rules_updated_at
    before update on public.merchant_rules
    for each row execute function public.set_updated_at();

alter table public.merchant_rules enable row level security;

create policy merchant_rules_select on public.merchant_rules
    for select using (public.is_workspace_member(workspace_id));

create policy merchant_rules_write on public.merchant_rules
    for all using (public.is_workspace_role(workspace_id, array['owner', 'treasurer']::public.workspace_role[]));
