begin;

create temp table molit_target_region_map (
  prefix text primary key,
  target_region_id text not null
) on commit drop;

insert into molit_target_region_map (prefix, target_region_id) values
  ('11', 'seoul'),
  ('26', 'busan'),
  ('27', 'daegu'),
  ('28', 'incheon'),
  ('29', 'gwangju'),
  ('30', 'daejeon'),
  ('31', 'ulsan'),
  ('36', 'sejong'),
  ('41', 'gyeonggi'),
  ('43', 'chungbuk'),
  ('44', 'chungnam'),
  ('46', 'jeonnam'),
  ('47', 'gyeongbuk'),
  ('48', 'gyeongnam'),
  ('50', 'jeju'),
  ('51', 'gangwon'),
  ('52', 'jeonbuk');

create temp table molit_fetch_region_migration as
select
  f.id,
  f.target_region_id as old_target_region_id,
  coalesce(m.target_region_id, f.target_region_id) as new_target_region_id,
  row_number() over (
    partition by coalesce(m.target_region_id, f.target_region_id), f.lawd_cd, f.year_month
    order by
      case f.status
        when 'completed' then 0
        when 'running' then 1
        when 'failed' then 2
        else 3
      end,
      f.updated_at desc,
      f.id desc
  ) as keep_rank
from molit_trade_fetches f
left join molit_target_region_map m
  on m.prefix = left(f.lawd_cd, 2);

delete from molit_trade_fetches f
using molit_fetch_region_migration mig
where f.id = mig.id
  and mig.keep_rank > 1;

update molit_trade_fetches f
set target_region_id = mig.new_target_region_id,
    updated_at = now()
from molit_fetch_region_migration mig
where f.id = mig.id
  and mig.keep_rank = 1
  and f.target_region_id <> mig.new_target_region_id;

update molit_trade_deals d
set target_region_id = m.target_region_id,
    updated_at = now()
from molit_target_region_map m
where m.prefix = left(d.lawd_cd, 2)
  and d.target_region_id <> m.target_region_id;

create index if not exists molit_trade_fetches_lawd_month_status_idx
  on molit_trade_fetches (lawd_cd, year_month, status);

commit;
