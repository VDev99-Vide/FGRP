-- ==========================================
-- 1. BẢNG DỮ LIỆU THỰC TẾ (INVENTORY)
-- LƯU Ý: file này chỉ dùng BOOTSTRAP project trống. Trên DB thật chỉ chạy
-- database/fix_views_actual_schema.sql (file đó đã unify schema + fix views).
-- Khối UNIFY bên dưới giúp view trong file này không vỡ nếu ai đó chạy nhầm
-- trên DB dùng biến thể tên cột còn lại (stock_up_date / tag_id / lp_no).
-- ==========================================
create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  tag_id text not null,
  bin text,
  stock_in_date timestamptz not null default now(),
  source text default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index tối ưu tìm kiếm và đối chiếu
create index if not exists idx_inventory_tag_id on inventory (tag_id);
create index if not exists idx_inventory_bin on inventory (bin);

-- ==========================================
-- 2. BẢNG DỮ LIỆU NGUỒN HỆ THỐNG (MASTER_DATA)
-- ==========================================
create table if not exists master_data (
  id uuid primary key default gen_random_uuid(),
  batch text not null,
  stock_code text,
  qty numeric default 0,
  warehouse text,
  create_date text,
  uploaded_at timestamptz not null default now()
);

-- Index tối ưu đối chiếu và lọc theo warehouse
create index if not exists idx_master_data_batch on master_data (batch);
create index if not exists idx_master_data_warehouse on master_data (warehouse);

-- ==========================================
-- 3. BẢNG QUẢN LÝ PHỤ KIỆN (HANG_PHU_KIEN)
-- ==========================================
create table if not exists hang_phu_kien (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  qty numeric default 0,
  bin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index tối ưu tìm kiếm phụ kiện
create index if not exists idx_hang_phu_kien_code on hang_phu_kien (code);

-- ==========================================
-- 3b. UNIFY SCHEMA (an toàn, idempotent): DB thật có thể dùng biến thể
-- tên cột còn lại (inventory.stock_up_date; master_data.tag_id/lp_no/
-- wh_location). Thêm cột thiếu + backfill 2 chiều để view/RPC dưới đây
-- chạy được trên mọi biến thể.
-- ==========================================
alter table inventory add column if not exists stock_up_date timestamptz;
update inventory set stock_in_date = stock_up_date where stock_in_date is null and stock_up_date is not null;
update inventory set stock_up_date = stock_in_date where stock_up_date is null and stock_in_date is not null;

alter table master_data add column if not exists tag_id text;
alter table master_data add column if not exists lp_no text;
alter table master_data add column if not exists wh_location text;
update master_data set tag_id = batch where (tag_id is null or tag_id = '') and batch is not null and batch <> '';
update master_data set batch = tag_id where (batch is null or batch = '') and tag_id is not null and tag_id <> '';
update master_data set lp_no = stock_code where (lp_no is null or lp_no = '') and stock_code is not null and stock_code <> '';
update master_data set stock_code = lp_no where (stock_code is null or stock_code = '') and lp_no is not null and lp_no <> '';
update master_data set wh_location = warehouse where (wh_location is null or wh_location = '') and warehouse is not null and warehouse <> '';
update master_data set warehouse = wh_location where (warehouse is null or warehouse = '') and wh_location is not null and wh_location <> '';

-- ==========================================
-- 4. RPC THAY THẾ DỮ LIỆU NGUỒN AN TOÀN
-- ==========================================
create or replace function replace_master_data(payload jsonb)
returns void
language plpgsql
security definer
as $$
begin
  -- Xóa dữ liệu cũ
  delete from master_data;

  -- Chèn dữ liệu mới từ payload, ghi CẢ 2 bộ tên cột để tương thích
-- với DB biến thể (tag_id/lp_no/wh_location). Cột thiếu được tạo ở khối UNIFY.
insert into master_data (batch, tag_id, stock_code, lp_no, qty, warehouse, wh_location, create_date)
  with vals as (
    select
      item->>'batch' as b,
      item->>'stock_code' as c,
      nullif(item->>'qty', '')::numeric as q,
      item->>'warehouse' as w,
      item->>'create_date' as d
    from jsonb_array_elements(payload) as item
  )
  select b, b, c, c, q, w, w, d from vals;
end;
$$;

-- ==========================================
-- 5. VIEW HIỂN THỊ TỒN KHO THÀNH PHẨM (VW_KHO_THANH_PHAM)
-- ==========================================
create or replace view vw_kho_thanh_pham as
select
  coalesce(m.stock_code, 'No data') as lp_no,
  case
    when m.stock_code is not null and trim(m.stock_code) like '1220%'
      then '1220'
    when m.stock_code is not null and length(m.stock_code) >= 5
      then substring(m.stock_code from 2 for 4)
    else 'No data'
  end as feature,
  coalesce(m.qty, 0) as qty,
  coalesce(m.warehouse, 'No data') as warehouse,
  coalesce(m.create_date, 'No data') as create_date,
  coalesce(i.stock_up_date, i.stock_in_date) as stock_in_date,
  i.tag_id as tag_id,
  i.bin as bin,
  i.id as inventory_id
from inventory i
left join master_data m
  on trim(lower(i.tag_id)) = trim(lower(m.batch));

-- ==========================================
-- 6. VIEW PHÂN TÍCH TỔNG HỢP KPI (VW_SUMMARY_ANALYSIS)
-- ==========================================
create or replace view vw_summary_analysis as
with actual_by_feature as (
  select
    feature,
    sum(qty)::numeric as actual
  from vw_kho_thanh_pham
  where feature is not null
  group by feature
),
iscala_by_feature as (
  select
    -- T3: hard-code 1220 TRƯỚC MID, đồng bộ feature.ts
    case when trim(stock_code) like '1220%' then '1220' else substring(stock_code from 2 for 4) end as feature,
    sum(qty)::numeric as iscala
  from master_data
  where warehouse in ('60', '01')
    and stock_code is not null
  group by case when trim(stock_code) like '1220%' then '1220' else substring(stock_code from 2 for 4) end
)
select
  coalesce(a.feature, i.feature) as feature,
  coalesce(a.actual, 0) as actual,
  coalesce(i.iscala, 0) as iscala,
  coalesce(a.actual, 0) - coalesce(i.iscala, 0) as diff,
  case
    when coalesce(i.iscala, 0) = 0 then
      case when coalesce(a.actual, 0) > 0 then 100 else 0 end
    else round(((coalesce(a.actual, 0) - coalesce(i.iscala, 0)) / i.iscala) * 100, 2)
  end as diff_percent
from actual_by_feature a
full outer join iscala_by_feature i
  on a.feature = i.feature
order by coalesce(a.feature, i.feature);

-- ==========================================
-- 7. CHÍNH SÁCH BẢO MẬT ROW LEVEL SECURITY (RLS)
-- ==========================================
-- Kích hoạt RLS
alter table inventory enable row level security;
alter table master_data enable row level security;
alter table hang_phu_kien enable row level security;

-- Do hệ thống chạy nội bộ không login, cho phép anon (public) toàn quyền CRUD
-- Cảnh báo: RLS cho anon chỉ nên sử dụng trong môi trường mạng nội bộ hoặc app riêng tư.

-- Inventory Policies
create policy "allow_anon_select_inventory" on inventory for select to anon using (true);
create policy "allow_anon_insert_inventory" on inventory for insert to anon with check (true);
create policy "allow_anon_update_inventory" on inventory for update to anon using (true) with check (true);
create policy "allow_anon_delete_inventory" on inventory for delete to anon using (true);

-- Master Data Policies
create policy "allow_anon_select_master_data" on master_data for select to anon using (true);
create policy "allow_anon_insert_master_data" on master_data for insert to anon with check (true);
create policy "allow_anon_update_master_data" on master_data for update to anon using (true) with check (true);
create policy "allow_anon_delete_master_data" on master_data for delete to anon using (true);

-- Hang Phu Kien Policies
create policy "allow_anon_select_hang_phu_kien" on hang_phu_kien for select to anon using (true);
create policy "allow_anon_insert_hang_phu_kien" on hang_phu_kien for insert to anon with check (true);
create policy "allow_anon_update_hang_phu_kien" on hang_phu_kien for update to anon using (true) with check (true);
create policy "allow_anon_delete_hang_phu_kien" on hang_phu_kien for delete to anon using (true);

-- ==========================================
-- 8. BẢNG DANH SÁCH XUẤT HÀNG DỰ KIẾN (SHIPPING_FORECAST)
-- ==========================================
create table if not exists shipping_forecast (
  id uuid primary key default gen_random_uuid(),
  po text not null,
  so text not null,
  container_no text default '',
  item_code text not null,
  feature text not null,
  loading_date text not null,
  qty numeric not null default 0,
  pcs_per_pkg numeric not null default 0,
  pkg numeric not null default 0,
  is_accessory boolean not null default false,
  is_special boolean not null default false,
  unit_type text not null default 'kien',
  status text not null default 'pending',
  status_changed_at timestamptz default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table shipping_forecast 
  add column if not exists is_accessory boolean not null default false,
  add column if not exists is_special boolean not null default false,
  add column if not exists unit_type text not null default 'kien';

create index if not exists idx_shipping_forecast_po_so on shipping_forecast (po, so);
create index if not exists idx_shipping_forecast_item_code on shipping_forecast (item_code);
create index if not exists idx_shipping_forecast_feature on shipping_forecast (feature);
create index if not exists idx_shipping_forecast_accessory on shipping_forecast (is_accessory);
create index if not exists idx_shipping_forecast_special on shipping_forecast (is_special);
create index if not exists idx_shipping_forecast_loading_date on shipping_forecast (loading_date);
create index if not exists idx_shipping_forecast_status on shipping_forecast (status);
create index if not exists idx_shipping_forecast_status_changed_at on shipping_forecast (status_changed_at);

alter table shipping_forecast disable row level security;
drop policy if exists "allow_all_shipping_forecast" on shipping_forecast;
drop policy if exists "allow_anon_select_shipping_forecast" on shipping_forecast;
drop policy if exists "allow_anon_insert_shipping_forecast" on shipping_forecast;
drop policy if exists "allow_anon_update_shipping_forecast" on shipping_forecast;
drop policy if exists "allow_anon_delete_shipping_forecast" on shipping_forecast;
create policy "allow_all_shipping_forecast" on shipping_forecast for all to public using (true) with check (true);

notify pgrst, 'reload schema';
