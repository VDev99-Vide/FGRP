-- ==========================================
-- QUẢN LÝ ĐƠN ĐẶT HÀNG (PURCHASING - PO)
-- Luồng: tạo PO (Số PO + NCC + Mã hàng + Target + Ngày tạo)
--        -> nhập hàng nhiều lần cộng dồn theo ngày
--        -> đạt 100% target tự đóng PO
-- ==========================================

-- 1. Bảng đơn đặt hàng
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_no text not null,
  supplier text not null default '',
  item_code text not null default '',
  description text not null default '',
  note text not null default '',
  target_qty numeric not null default 0,
  created_date date not null default current_date,
  status text not null default 'open', -- 'open' (chưa hoàn thành) | 'completed' (đã giao đủ)
  closed_at timestamptz default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chống trùng số PO (không phân biệt hoa thường / khoảng trắng ở tầng app)
create unique index if not exists uq_purchase_orders_po_no on purchase_orders (po_no);

create index if not exists idx_purchase_orders_status on purchase_orders (status);
create index if not exists idx_purchase_orders_supplier on purchase_orders (supplier);
create index if not exists idx_purchase_orders_item_code on purchase_orders (item_code);
create index if not exists idx_purchase_orders_created_date on purchase_orders (created_date);

-- 2. Bảng log từng lần nhập hàng vào PO (cộng dồn cho đến khi đạt target)
create table if not exists po_receipt_logs (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders (id) on delete cascade,
  receipt_date date not null default current_date,
  qty numeric not null default 0,
  note text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_po_receipt_logs_po_id on po_receipt_logs (po_id);
create index if not exists idx_po_receipt_logs_receipt_date on po_receipt_logs (receipt_date);

-- Bổ sung cột mới nếu bảng đã tồn tại từ trước (mô tả sản phẩm + ghi chú)
alter table purchase_orders
  add column if not exists description text not null default '',
  add column if not exists note text not null default '';

-- T2: nhập hàng theo từng mã (log mới gắn po_line_id, log cũ NULL giữ nguyên tính tổng PO).
-- Nếu dùng PO nhiều mã (po_lines) thì chạy thêm:
--   database/purchase_orders_lines.sql
--   database/purchase_orders_line_receipts.sql
alter table po_receipt_logs
  add column if not exists po_line_id uuid default null,
  add column if not exists item_code text not null default '';

create index if not exists idx_po_receipt_logs_po_line_id on po_receipt_logs (po_line_id);
create index if not exists idx_po_receipt_logs_item_code on po_receipt_logs (item_code);

-- ==========================================
-- PHÂN QUYỀN (đồng bộ với shipping_forecast: tắt RLS cho hệ thống nội bộ)
-- ==========================================
alter table purchase_orders disable row level security;
alter table po_receipt_logs disable row level security;

drop policy if exists "allow_all_purchase_orders" on purchase_orders;
drop policy if exists "allow_all_po_receipt_logs" on po_receipt_logs;

create policy "allow_all_purchase_orders" on purchase_orders for all to public using (true) with check (true);
create policy "allow_all_po_receipt_logs" on po_receipt_logs for all to public using (true) with check (true);

notify pgrst, 'reload schema';
