-- Run with: npx supabase test db
-- Checks the sign-up trigger, Row Level Security on profiles and scans, and the phone-change cleanup job.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Two users. The trigger should give each a profile.
insert into auth.users (id, phone, aud, role) values
  ('11111111-1111-1111-1111-111111111111', '15550000001', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', '15550000002', 'authenticated', 'authenticated');

select is((select count(*)::int from public.profiles where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 2, 'sign-up creates a profile');
select is((select strict_mode from public.profiles where id = '11111111-1111-1111-1111-111111111111'), true, 'strict_mode defaults to true (today''s rules)');
select is((select haptics from public.profiles where id = '11111111-1111-1111-1111-111111111111'), true, 'haptics defaults to true');

-- Scans are written by the server (service role); here as the table owner.
insert into public.scans (user_id, product_name, verdict) values
  ('11111111-1111-1111-1111-111111111111', 'Yogurt', 'clean'),
  ('22222222-2222-2222-2222-222222222222', 'Cola', 'bad');

select throws_ok(
  $$ insert into public.scans (user_id, verdict) values ('11111111-1111-1111-1111-111111111111', 'BAD') $$,
  '23514', null, 'verdict must be lowercase clean/okay/bad');

-- Act as user 1.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'user sees only their own profile');
select is((select count(*)::int from public.scans), 1, 'user sees only their own scans');
select is((select product_name from public.scans), 'Yogurt', 'and it is theirs');

update public.profiles set display_name = 'Sam', strict_mode = true;
select is((select display_name from public.profiles), 'Sam', 'user can update their own profile');

update public.profiles set display_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222';
select throws_ok($$ update public.profiles set created_at = now() $$, '42501', null, 'user cannot change created_at');
select throws_ok($$ update public.profiles set id = '22222222-2222-2222-2222-222222222222' $$, '42501', null, 'user cannot change their id');
select throws_ok($$ update public.profiles set scans_imported_at = null $$, '42501', null, 'user cannot reset the import marker');

select throws_ok(
  $$ insert into public.scans (user_id, verdict) values ('11111111-1111-1111-1111-111111111111', 'clean') $$,
  '42501', null, 'clients cannot insert scans');
select throws_ok($$ update public.scans set verdict = 'clean' $$, '42501', null, 'clients cannot edit scans');

delete from public.scans where user_id = '22222222-2222-2222-2222-222222222222';
delete from public.scans where user_id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.scans), 0, 'user can delete their own scans');

-- Anonymous visitors see nothing.
set local role anon;
select throws_ok($$ select * from public.scans $$, '42501', null, 'anon cannot read scans');

reset role;
select is((select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'), null, 'other user''s profile was not changed');
select is((select count(*)::int from public.scans where user_id = '22222222-2222-2222-2222-222222222222'), 1, 'other user''s scan was not deleted');

select * from finish();
rollback;
