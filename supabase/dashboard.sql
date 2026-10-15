-- At Yarışı istatistik paneli için özet fonksiyonu.
-- Supabase SQL Editor'de bir kez çalıştır. Yalnızca sunucudaki gizli anahtar (service_role)
-- çağırabilir; sitedeki herkese açık anahtarla çağrılamaz.

create or replace function public.stats_dashboard(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select *, (created_at at time zone 'Europe/Istanbul')::date as gun
    from events
    where p_days <= 0 or created_at > now() - make_interval(days => p_days)
  ),
  gunler as (
    select generate_series(
      coalesce((select min(gun) from ev), (now() at time zone 'Europe/Istanbul')::date),
      (now() at time zone 'Europe/Istanbul')::date,
      interval '1 day'
    )::date as gun
  ),
  started as (select * from ev where type = 'race_started'),
  finished as (select * from ev where type = 'race_finished')
  select jsonb_build_object(
    'kpi', jsonb_build_object(
      'visitors',       (select count(distinct device_id) from ev where type = 'visit'),
      'players',        (select count(distinct device_id) from ev where type = 'race_played'),
      'rooms',          (select count(*) from ev where type = 'room_created'),
      'joins',          (select count(*) from ev where type = 'room_joined'),
      'races_started',  (select count(*) from started),
      'races_finished', (select count(*) from finished),
      'avg_duration_s', (select round(avg((data->>'duration_s')::numeric)) from finished),
      'avg_throws',     (select round(avg((data->>'throws')::numeric)) from finished),
      'bot_win_pct',    (select round(100.0 * avg(((data->>'winner_bot')::boolean)::int), 1) from finished)
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', g.gun,
        'visitors', (select count(distinct device_id) from ev where ev.gun = g.gun and type = 'visit'),
        'players',  (select count(distinct device_id) from ev where ev.gun = g.gun and type = 'race_played'),
        'races',    (select count(*) from started s where s.gun = g.gun)
      ) order by g.gun), '[]'::jsonb)
      from gunler g
    ),
    'race_types', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select case
                 when (data->>'humans')::int <= 1 then 'Tek kişi + bot'
                 when (data->>'bots')::int = 0 then 'Sadece canlı oyuncular'
                 else 'Canlı oyuncular + bot'
               end as label,
               count(*) as n
        from started group by 1
      ) x
    ),
    'humans', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label || ' kişi', 'n', n) order by label), '[]'::jsonb)
      from (select data->>'humans' as label, count(*) as n from started group by 1) x
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select coalesce(data->>'device', 'bilinmiyor') as label, count(distinct device_id) as n
        from ev where type = 'visit' group by 1
      ) x
    ),
    'os', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select coalesce(data->>'os', 'bilinmiyor') as label, count(distinct device_id) as n
        from ev where type = 'visit' group by 1
      ) x
    ),
    'steps', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label || ' adım', 'n', n) order by label::int), '[]'::jsonb)
      from (select data->>'steps' as label, count(*) as n from started group by 1) x
    ),
    'rooms_online', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select case when (data->>'online')::boolean then 'Online oda' else 'Çevrimdışı (botlarla)' end as label,
               count(*) as n
        from ev where type = 'room_created' group by 1
      ) x
    )
  );
$$;

revoke all on function public.stats_dashboard(int) from public, anon, authenticated;
grant execute on function public.stats_dashboard(int) to service_role;
