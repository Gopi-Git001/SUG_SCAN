-- QuickGOB accounts: one profile per user, and the user's scan history.
-- Photos are never stored. Clients can only read their own rows; scans are written by Edge Functions.

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  strict_mode boolean not null default true, -- on = today's rules: stevia and monk fruit count as OKAY at best
  gentle_mode boolean not null default false,
  haptics boolean not null default true,
  -- Set once by the import-scans function when on-device history has been uploaded.
  scans_imported_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Only these columns can be changed by the user.
grant update (display_name, strict_mode, gentle_mode, haptics) on public.profiles to authenticated;

create policy "Users read their own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- A profile row for every new user. Lives in a schema the Data API doesn't expose.
create schema if not exists private;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

-- Users who signed up before this migration.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- ---------- scans ----------
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  product_name text,
  verdict text not null check (verdict in ('clean', 'okay', 'bad')),
  natural_sugars text[] not null default '{}',
  added_sugars text[] not null default '{}',
  sweeteners text[] not null default '{}',
  barcode text,
  rules_version text
);

create index scans_user_id_created_at_idx on public.scans (user_id, created_at desc);

alter table public.scans enable row level security;

-- No insert or update for clients: only Edge Functions (service role) write scans.
revoke all on public.scans from anon, authenticated;
grant select, delete on public.scans to authenticated;

create policy "Users read their own scans" on public.scans
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users delete their own scans" on public.scans
  for delete to authenticated
  using ((select auth.uid()) = user_id);
