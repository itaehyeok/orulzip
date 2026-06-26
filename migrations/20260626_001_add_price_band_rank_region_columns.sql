do $$
begin
  if to_regclass('price_band_rank_items') is not null then
    execute '
      alter table price_band_rank_items
        add column if not exists sido_code text,
        add column if not exists sido_name text,
        add column if not exists sigungu_code text,
        add column if not exists sigungu_name text,
        add column if not exists dong_key text,
        add column if not exists dong_name text
    ';
  end if;
end $$;
