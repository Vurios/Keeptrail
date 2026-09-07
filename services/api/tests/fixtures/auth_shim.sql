-- Test-only stand-in for Supabase's auth schema and client roles.
-- Loaded by services/api/tests/test_database.py BEFORE the migrations run.
-- NEVER apply this to a hosted Supabase project — the real objects exist there.

create schema if not exists auth;

create table if not exists auth.users (
    id uuid primary key,
    email text unique,
    encrypted_password text not null default '',
    email_confirmed_at timestamptz,
    raw_app_meta_data jsonb not null default '{}'::jsonb,
    raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Mirrors Supabase's auth.uid(): resolves the JWT subject from the GUCs that
-- PostgREST sets. Tests set request.jwt.claim.sub directly.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
    )::uuid
$$;

-- Supabase's client roles.
do $$
begin
    if not exists (select from pg_roles where rolname = 'anon') then
        create role anon nologin noinherit;
    end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin noinherit;
    end if;
    if not exists (select from pg_roles where rolname = 'service_role') then
        create role service_role nologin noinherit bypassrls;
    end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
    grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
    grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
    grant all on functions to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
