-- ==========================================
-- 1. BẢNG DỮ LIỆU THỰC TẾ (INVENTORY)
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

  -- Chèn dữ liệu mới từ payload
  insert into master_data (batch, stock_code, qty, warehouse, create_date)
  select
    item->>'batch',
    item->>'stock_code',
    nullif(item->>'qty', '')::numeric,
    item->>'warehouse',
    item->>'create_date'
  from jsonb_array_elements(payload) as item;
end;
$$;

-- ==========================================
-- 5. VIEW HIỂN THỊ TỒN KHO THÀNH PHẨM (VW_KHO_THANH_PHAM)
-- ==========================================
create or replace view vw_kho_thanh_pham as
select
  coalesce(m.stock_code, 'No data') as lp_no,
  case
    when m.stock_code is not null and length(m.stock_code) >= 5
      then substring(m.stock_code from 2 for 4)
    else 'No data'
  end as feature,
  coalesce(m.qty, 0) as qty,
  coalesce(m.warehouse, 'No data') as warehouse,
  coalesce(m.create_date, 'No data') as create_date,
  i.stock_in_date as stock_in_date,
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
    substring(stock_code from 2 for 4) as feature,
    sum(qty)::numeric as iscala
  from master_data
  where warehouse in ('60', '01')
    and stock_code is not null
  group by substring(stock_code from 2 for 4)
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
