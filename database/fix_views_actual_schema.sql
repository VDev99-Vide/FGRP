-- ============================================================
-- FIX SCRIPT: Cập nhật Views theo cấu trúc DB thực tế
-- Chạy toàn bộ script này trong Supabase SQL Editor
-- CHỈ CHẠY FILE NÀY trên DB thật. KHÔNG chạy database/supabase.sql
-- sau đó (supabase.sql chỉ dùng bootstrap project trống).
--
-- DB thực có 2 biến thể tên cột (schema drift):
--   inventory   : stock_up_date (mới) vs stock_in_date (cũ)
--   master_data : (tag_id, lp_no, wh_location) vs (batch, stock_code, warehouse)
-- BƯỚC 0 dưới đây thống nhất cả 2 biến thể (thêm cột thiếu + backfill
-- 2 chiều) nên script chạy an toàn nhiều lần trên mọi biến thể.
-- ============================================================

-- ============================================================
-- BƯỚC 0: THỐNG NHẤT SCHEMA (idempotent, chạy lại không sao)
-- ============================================================
alter table inventory add column if not exists stock_up_date timestamptz;
alter table inventory add column if not exists stock_in_date timestamptz;
update inventory set stock_in_date = stock_up_date where stock_in_date is null and stock_up_date is not null;
update inventory set stock_up_date = stock_in_date where stock_up_date is null and stock_in_date is not null;

alter table master_data add column if not exists tag_id text;
alter table master_data add column if not exists lp_no text;
alter table master_data add column if not exists wh_location text;
alter table master_data add column if not exists batch text;
alter table master_data add column if not exists stock_code text;
alter table master_data add column if not exists warehouse text;
-- Backfill 2 chiều (chỉ lấp chỗ trống, không ghi đè dữ liệu đã có)
update master_data set tag_id = batch where (tag_id is null or tag_id = '') and batch is not null and batch <> '';
update master_data set batch = tag_id where (batch is null or batch = '') and tag_id is not null and tag_id <> '';
update master_data set lp_no = stock_code where (lp_no is null or lp_no = '') and stock_code is not null and stock_code <> '';
update master_data set stock_code = lp_no where (stock_code is null or stock_code = '') and lp_no is not null and lp_no <> '';
update master_data set wh_location = warehouse where (wh_location is null or wh_location = '') and warehouse is not null and warehouse <> '';
update master_data set warehouse = wh_location where (warehouse is null or warehouse = '') and wh_location is not null and wh_location <> '';

-- ============================================================
-- BƯỚC 1: XÓA VIEWS CŨ (nếu có) để tạo lại đúng
-- ============================================================
drop view if exists vw_summary_analysis;
drop view if exists vw_kho_thanh_pham;

-- ============================================================
-- BƯỚC 2: TẠO LẠI vw_kho_thanh_pham
-- Mapping đúng với cột thực tế:
--   master_data.tag_id     = BATCH (dùng để join với inventory.tag_id)
--   master_data.lp_no      = Stock Code
--   master_data.wh_location = Warehouse
--   inventory.stock_up_date = stock_in_date
-- ============================================================
create or replace view vw_kho_thanh_pham as
select
  -- LP.No / Stock Code
  coalesce(m.lp_no, 'No data')                              as lp_no,
  
  -- Feature: trích ký tự 2-5 từ lp_no (mã đặc biệt 1220 lấy 4 ký tự đầu, các mã khác =MID(text,2,4))
  case
    when m.lp_no is not null and trim(m.lp_no) like '1220%'
      then '1220'
    when m.lp_no is not null and length(trim(m.lp_no)) >= 5
      then substring(trim(m.lp_no) from 2 for 4)
    else 'No data'
  end                                                        as feature,
  
  -- Actual Qty từ master_data
  coalesce(m.qty, 0)                                        as qty,
  
  -- Warehouse (cột thực là wh_location)
  coalesce(m.wh_location, 'No data')                       as warehouse,
  
  -- CreateDate từ master_data
  coalesce(m.create_date, 'No data')                       as create_date,
  
  -- Stock In Date (DB có thể là stock_up_date hoặc stock_in_date — BƯỚC 0 đã unify)
  coalesce(i.stock_up_date, i.stock_in_date)                 as stock_in_date,
  
  -- Tag ID từ inventory
  i.tag_id                                                  as tag_id,
  
  -- Bin từ inventory
  i.bin                                                     as bin,
  
  -- ID ảo tuyệt đối để xuất kho chính xác
  i.id                                                      as inventory_id

from inventory i
left join (
  -- Khử fan-out: nếu master_data có nhiều dòng cùng 1 tag_id (BATCH trùng),
  -- chỉ giữ 1 dòng (mới nhất theo create_date) để mỗi tag trong inventory
  -- sinh ra đúng 1 dòng view thay vì bị nhân bản.
  -- NOTE: cột phải qualify bằng master_data.* để Postgres không nhầm sang
  -- outer table inventory (lỗi "must mark this subquery with LATERAL").
  select distinct on (trim(lower(master_data.tag_id)))
    master_data.tag_id, master_data.lp_no, master_data.qty, master_data.wh_location, master_data.create_date
  from master_data
  where master_data.tag_id is not null
  order by trim(lower(master_data.tag_id)), master_data.create_date desc nulls last, master_data.lp_no
) m
  on trim(lower(i.tag_id)) = trim(lower(m.tag_id));

-- ============================================================
-- BƯỚC 3: TẠO LẠI vw_summary_analysis
-- Dùng vw_kho_thanh_pham đã được fix ở trên
-- iScala: chỉ tính dòng warehouse IN ('60', '01')
-- Diff %: diff / iscala * 100, tránh chia cho 0
-- ============================================================
create or replace view vw_summary_analysis as
with actual_by_feature as (
  select
    feature,
    sum(qty)::numeric as actual
  from vw_kho_thanh_pham
  where feature is not null
    and feature <> 'No data'
  group by feature
),
iscala_by_feature as (
  select
    -- T3: hard-code 1220 TRƯỚC MID(text,2,4), đồng bộ với src/utils/feature.ts
    case
      when trim(lp_no) like '1220%' then '1220'
      else substring(trim(lp_no) from 2 for 4)
    end as feature,
    sum(qty)::numeric                     as iscala
  from master_data
  where wh_location in ('60', '01')
    and lp_no is not null
    and length(trim(lp_no)) >= 5
  group by
    case
      when trim(lp_no) like '1220%' then '1220'
      else substring(trim(lp_no) from 2 for 4)
    end
)
select
  coalesce(a.feature, i.feature)                                 as feature,
  coalesce(a.actual, 0)                                          as actual,
  coalesce(i.iscala, 0)                                          as iscala,
  coalesce(a.actual, 0) - coalesce(i.iscala, 0)                 as diff,
  case
    when coalesce(i.iscala, 0) = 0 then
      case when coalesce(a.actual, 0) > 0 then 100::numeric else 0::numeric end
    else round(
      ((coalesce(a.actual, 0) - coalesce(i.iscala, 0)) / i.iscala) * 100,
      2
    )
  end                                                            as diff_percent
from actual_by_feature a
full outer join iscala_by_feature i
  on a.feature = i.feature
order by coalesce(a.feature, i.feature);

-- ============================================================
-- BƯỚC 4: RPC REPLACE_MASTER_DATA
-- Cập nhật theo tên cột thực tế (lp_no, wh_location, tag_id)
-- ============================================================
create or replace function replace_master_data(payload jsonb)
returns void
language plpgsql
security definer
as $$
begin
  -- Xóa dữ liệu cũ an toàn
  delete from master_data;

  -- Chèn dữ liệu mới từ payload, ghi CẢ 2 bộ tên cột (BƯỚC 0 đã unify)
  -- để DB biến thể nào cũng đọc được ngay, không chờ backfill.
  -- Hỗ trợ cả 2 tên cột cũ/mới để tương thích CSV
  insert into master_data (tag_id, batch, lp_no, stock_code, qty, wh_location, warehouse, create_date)
  with vals as (
    select
      -- batch / tag_id / BATCH
      coalesce(
        nullif(trim(item->>'batch'), ''),
        nullif(trim(item->>'tag_id'), ''),
        nullif(trim(item->>'BATCH'), '')
      ) as b,
      -- stock_code / lp_no / LP.No
      coalesce(
        nullif(trim(item->>'stock_code'), ''),
        nullif(trim(item->>'lp_no'), ''),
        nullif(trim(item->>'LP.No'), '')
      ) as c,
      -- qty
      nullif(trim(item->>'qty'), '')::numeric as q,
      -- warehouse / wh_location
      coalesce(
        nullif(trim(item->>'warehouse'), ''),
        nullif(trim(item->>'wh_location'), '')
      ) as w,
      -- create_date / createdate / CREATEDATE
      coalesce(
        nullif(trim(item->>'create_date'), ''),
        nullif(trim(item->>'createdate'), ''),
        nullif(trim(item->>'CREATEDATE'), '')
      ) as d
    from jsonb_array_elements(payload) as item
  )
  select b, b, c, c, q, w, w, d from vals;
end;
$$;

-- ============================================================
-- BƯỚC 5: BẬT RLS VÀ TẠO POLICIES (bỏ qua nếu đã có)
-- ============================================================

-- Bật RLS
alter table inventory      enable row level security;
alter table master_data    enable row level security;
alter table hang_phu_kien  enable row level security;

-- Xóa policies cũ trước (tránh lỗi trùng tên)
drop policy if exists "allow_anon_select_inventory"        on inventory;
drop policy if exists "allow_anon_insert_inventory"        on inventory;
drop policy if exists "allow_anon_update_inventory"        on inventory;
drop policy if exists "allow_anon_delete_inventory"        on inventory;
drop policy if exists "allow_anon_select_master_data"      on master_data;
drop policy if exists "allow_anon_insert_master_data"      on master_data;
drop policy if exists "allow_anon_update_master_data"      on master_data;
drop policy if exists "allow_anon_delete_master_data"      on master_data;
drop policy if exists "allow_anon_select_hang_phu_kien"    on hang_phu_kien;
drop policy if exists "allow_anon_insert_hang_phu_kien"    on hang_phu_kien;
drop policy if exists "allow_anon_update_hang_phu_kien"    on hang_phu_kien;
drop policy if exists "allow_anon_delete_hang_phu_kien"    on hang_phu_kien;

-- Tạo lại Policies cho role anon (public, không cần login)
-- inventory
create policy "allow_anon_select_inventory"     on inventory for select     to anon using (true);
create policy "allow_anon_insert_inventory"     on inventory for insert     to anon with check (true);
create policy "allow_anon_update_inventory"     on inventory for update     to anon using (true) with check (true);
create policy "allow_anon_delete_inventory"     on inventory for delete     to anon using (true);

-- master_data
create policy "allow_anon_select_master_data"   on master_data for select   to anon using (true);
create policy "allow_anon_insert_master_data"   on master_data for insert   to anon with check (true);
create policy "allow_anon_update_master_data"   on master_data for update   to anon using (true) with check (true);
create policy "allow_anon_delete_master_data"   on master_data for delete   to anon using (true);

-- hang_phu_kien
create policy "allow_anon_select_hang_phu_kien" on hang_phu_kien for select to anon using (true);
create policy "allow_anon_insert_hang_phu_kien" on hang_phu_kien for insert to anon with check (true);
create policy "allow_anon_update_hang_phu_kien" on hang_phu_kien for update to anon using (true) with check (true);
create policy "allow_anon_delete_hang_phu_kien" on hang_phu_kien for delete to anon using (true);

-- ============================================================
-- BƯỚC 6: Kiểm tra kết quả
-- ============================================================

-- Xem thử 5 dòng view tồn kho
-- select * from vw_kho_thanh_pham limit 5;

-- Xem thử summary
-- select * from vw_summary_analysis limit 10;

-- Kiểm tra master_data có BATCH trùng (nguyên nhân gốc gây fan-out nhân dòng)
-- select trim(lower(tag_id)) as batch, count(*) as so_dong
-- from master_data
-- group by trim(lower(tag_id))
-- having count(*) > 1
-- order by so_dong desc;
