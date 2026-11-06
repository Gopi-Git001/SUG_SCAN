-- Daily cleanup of phone-number changes that were started but never verified.
-- A pending phone_change older than 1 hour is cleared, so a stale code can't attach a number to the wrong user.
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;

select cron.schedule(
  'clear-stale-phone-change',
  '15 3 * * *', -- every day at 03:15 UTC
  $$
    update auth.users
    set phone_change = '',
        phone_change_token = '',
        phone_change_sent_at = null
    where phone_change is not null
      and phone_change <> ''
      and (phone_change_sent_at is null or phone_change_sent_at < now() - interval '1 hour')
  $$
);
