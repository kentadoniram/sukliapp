-- Run this once in Supabase: SQL Editor, paste, Run.
create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  coll       text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at bigint      not null,
  synced_at  timestamptz not null default now(),
  primary key (user_id, coll, id)
);
create index if not exists records_user_synced on public.records (user_id, synced_at);

alter table public.records enable row level security;
drop policy if exists "own records" on public.records;
create policy "own records" on public.records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- stamps each write with server time, and ignores a write that is older than what is stored
create or replace function public.touch_synced_at() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_synced_at();
