-- ==========================================
-- META-DATA: QUY CÁCH ĐÓNG GÓI CHUẨN (PACKING SPEC)
-- Chuẩn Sample.xlsx mới (sheet "Quy cách", 192 dòng, 7 cột):
-- Khách Hàng | Mã hàng (full VD 8101010104) | Feature (VD 1010) |
-- Số lượng đóng gói | Trọng lượng/Cái | Quy cách thùng | Loại thùng
-- (thùng đơn / thùng đôi / phụ kiện — đã chuẩn hóa).
-- Làm class module gốc phân phối cho:
-- Danh Sách Xuất Hàng Dự Kiến + Bảng Chi Tiết Tồn Kho Thành Phẩm + Quản Lý Phụ Kiện.
-- ==========================================

create table if not exists metadata_quy_cach (
  id uuid primary key default gen_random_uuid(),
  customer text not null default '',
  -- Chuẩn mới:
  ma_hang text not null default '',
  feature text not null default '',
  -- Legacy giữ lại để tương thích lookup cũ (= feature):
  item_code text not null default '',
  pack_qty numeric not null default 0,
  weight_per_unit numeric not null default 0,
  carton_spec text not null default '',
  carton_type text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration idempotent cho DB đã có bảng cũ (6 cột):
alter table metadata_quy_cach add column if not exists ma_hang text not null default '';
alter table metadata_quy_cach add column if not exists feature text not null default '';
alter table metadata_quy_cach add column if not exists item_code text not null default '';

-- Backfill cho dữ liệu cũ (item_code cũ = feature): ma_hang/feature trống -> lấy item_code
update metadata_quy_cach set ma_hang = item_code where (ma_hang is null or ma_hang = '') and item_code <> '';
update metadata_quy_cach set feature = item_code where (feature is null or feature = '') and item_code <> '';
update metadata_quy_cach set item_code = feature where (item_code is null or item_code = '') and feature <> '';

-- Chuẩn hóa Loại thùng về 3 loại (idempotent, đồng bộ logic frontend normalizeCartonType):
-- Ưu tiên đơn/đôi trước, chỉ map carton/plywood/box -> phụ kiện khi KHÔNG chứa đơn/đôi.
update metadata_quy_cach set carton_type = trim(carton_type) where carton_type <> trim(carton_type);
update metadata_quy_cach set carton_type = 'phụ kiện'
where (
  lower(trim(carton_type)) = 'phụ kiện'
  or lower(trim(carton_type)) in ('carton box', 'plywood box')
  or (lower(trim(carton_type)) like '%carton%' and lower(trim(carton_type)) not like '%don%' and lower(trim(carton_type)) not like '%doi%' and lower(trim(carton_type)) not like '%đơn%' and lower(trim(carton_type)) not like '%đôi%')
  or (lower(trim(carton_type)) like '%plywood%' and lower(trim(carton_type)) not like '%don%' and lower(trim(carton_type)) not like '%doi%')
);

create index if not exists idx_metadata_quy_cach_customer on metadata_quy_cach (customer);
create index if not exists idx_metadata_quy_cach_item_code on metadata_quy_cach (item_code);
create index if not exists idx_metadata_quy_cach_ma_hang on metadata_quy_cach (ma_hang);
create index if not exists idx_metadata_quy_cach_feature on metadata_quy_cach (feature);
create index if not exists idx_metadata_quy_cach_carton_spec on metadata_quy_cach (carton_spec);
create index if not exists idx_metadata_quy_cach_carton_type on metadata_quy_cach (carton_type);

-- ==========================================
-- PHÂN QUYỀN (đồng bộ toàn hệ thống: tắt RLS cho hệ thống nội bộ)
-- ==========================================
alter table metadata_quy_cach disable row level security;

drop policy if exists "allow_all_metadata_quy_cach" on metadata_quy_cach;

create policy "allow_all_metadata_quy_cach" on metadata_quy_cach for all to public using (true) with check (true);

notify pgrst, 'reload schema';
