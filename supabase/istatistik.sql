-- At Yarışı istatistikleri. Supabase panelinde SQL Editor'de çalıştır.
-- (Sorguları "Save" ile kaydedersen her seferinde tek tıkla açabilirsin.)

-- 1) Genel özet
select
  (select count(distinct device_id) from events where type = 'visit')        as ziyaret_eden_cihaz,
  (select count(distinct device_id) from events where type = 'race_played')  as en_az_bir_yaris_oynayan_cihaz,
  (select count(*) from events where type = 'room_created')                  as kurulan_oda,
  (select count(*) from events where type = 'room_joined')                   as odaya_katilma,
  (select count(*) from events where type = 'race_started')                  as baslayan_yaris,
  (select count(*) from events where type = 'race_finished')                 as biten_yaris;

-- 2) Yarış türleri: botlu mu, sadece canlı oyuncular mı?
select
  case
    when (data->>'humans')::int = 1 then 'Tek kişi + bot'
    when (data->>'bots')::int  = 0 then 'Sadece canlı oyuncular'
    else 'Canlı oyuncular + bot'
  end                                       as yaris_turu,
  count(*)                                  as yaris_sayisi,
  round(avg((data->>'humans')::int), 1)     as ort_canli_oyuncu
from events
where type = 'race_started'
group by 1
order by 2 desc;

-- 3) Günlük tablo (son 30 gün)
select
  date_trunc('day', created_at at time zone 'Europe/Istanbul')::date          as gun,
  count(distinct device_id) filter (where type = 'visit')                     as ziyaretci,
  count(distinct device_id) filter (where type = 'race_played')               as oynayan,
  count(*) filter (where type = 'race_started')                               as yaris,
  count(*) filter (where type = 'race_started' and (data->>'bots')::int > 0)  as botlu_yaris,
  count(*) filter (where type = 'race_started' and (data->>'bots')::int = 0)  as canli_yaris
from events
where created_at > now() - interval '30 days'
group by 1
order by 1 desc;

-- 4) Yarış ayrıntıları: ortalama süre, atış sayısı, botların kazanma oranı
select
  data->>'steps'                                                   as pist_uzunlugu,
  count(*)                                                         as biten_yaris,
  round(avg((data->>'duration_s')::int))                           as ort_sure_sn,
  round(avg((data->>'throws')::int))                               as ort_toplam_atis,
  round(100.0 * avg(((data->>'winner_bot')::boolean)::int), 1)     as bot_kazanma_yuzdesi
from events
where type = 'race_finished'
group by 1
order by 1;

-- 5) Cihaz türü ve işletim sistemi: kaç farklı cihaz ziyaret etti, kaçı oynadı?
select
  data->>'device'                                                    as cihaz,
  data->>'os'                                                        as isletim_sistemi,
  count(distinct device_id) filter (where type = 'visit')            as ziyaret_eden,
  count(distinct device_id) filter (where type = 'race_played')      as oynayan
from events
where data ? 'device'
group by 1, 2
order by 3 desc;
