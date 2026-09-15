-- ==========================================
-- META-DATA: QUY CÁCH ĐÓNG GÓI CHUẨN (PACKING SPEC)
-- Dữ liệu mẫu chuẩn trích từ Sample.xlsx (sheet "Quy cách", 136 dòng),
-- làm class module gốc phân phối cho toàn hệ thống tồn kho thành phẩm.
-- Logic phân phối liên kết triển khai ở task sau.
-- ==========================================

create table if not exists metadata_quy_cach (
  id uuid primary key default gen_random_uuid(),
  customer text not null default '',
  item_code text not null default '',
  pack_qty numeric not null default 0,
  weight_per_unit numeric not null default 0,
  carton_spec text not null default '',
  carton_type text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_metadata_quy_cach_customer on metadata_quy_cach (customer);
create index if not exists idx_metadata_quy_cach_item_code on metadata_quy_cach (item_code);
create index if not exists idx_metadata_quy_cach_carton_spec on metadata_quy_cach (carton_spec);

-- ==========================================
-- PHÂN QUYỀN (đồng bộ toàn hệ thống: tắt RLS cho hệ thống nội bộ)
-- ==========================================
alter table metadata_quy_cach disable row level security;

drop policy if exists "allow_all_metadata_quy_cach" on metadata_quy_cach;

create policy "allow_all_metadata_quy_cach" on metadata_quy_cach for all to public using (true) with check (true);

notify pgrst, 'reload schema';
