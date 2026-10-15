-- At Yarışı: anonim kullanım olayları.
-- Supabase panelinde SQL Editor'e yapıştırıp bir kez çalıştır.

create table if not exists public.events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type       text not null check (type in (
               'visit', 'room_created', 'room_joined',
               'race_played', 'race_started', 'race_finished')),
  device_id  text check (char_length(device_id) <= 64),
  room_code  text check (char_length(room_code) <= 8),
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) < 2048)
);

create index if not exists events_type_created_idx on public.events (type, created_at);

-- Sitedeki herkes yalnızca olay EKLEYEBİLİR; okuma, silme, güncelleme kapalı.
alter table public.events enable row level security;

drop policy if exists "herkes olay ekleyebilir" on public.events;
create policy "herkes olay ekleyebilir"
  on public.events for insert
  to anon
  with check (true);

revoke select, update, delete on public.events from anon, authenticated;
grant insert on public.events to anon;
