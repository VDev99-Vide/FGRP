-- ==========================================
-- BẢNG DANH SÁCH XUẤT HÀNG DỰ KIẾN (SHIPPING_FORECAST)
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
  status text not null default 'pending', -- 'pending' (Chờ chuẩn bị), 'ready' (Chuẩn bị xong)
  status_changed_at timestamptz default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index tối ưu truy vấn, tìm kiếm và phân nhóm
create index if not exists idx_shipping_forecast_po_so on shipping_forecast (po, so);
create index if not exists idx_shipping_forecast_item_code on shipping_forecast (item_code);
create index if not exists idx_shipping_forecast_feature on shipping_forecast (feature);
create index if not exists idx_shipping_forecast_loading_date on shipping_forecast (loading_date);
create index if not exists idx_shipping_forecast_status on shipping_forecast (status);
create index if not exists idx_shipping_forecast_status_changed_at on shipping_forecast (status_changed_at);

-- ==========================================
-- HÀM DỌN DẸP TỰ ĐỘNG CÁC ĐƠN ĐÃ CHUẨN BỊ XONG QUÁ 1 NGÀY (24H)
-- ==========================================
create or replace function cleanup_expired_shipping_forecast()
returns int
language plpgsql
security definer
as $$
declare
  deleted_count int;
begin
  delete from shipping_forecast
  where status = 'ready'
    and status_changed_at is not null
    and status_changed_at < now() - interval '1 day';
  
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
