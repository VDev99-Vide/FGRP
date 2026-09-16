-- ==========================================
-- PO_LINES: 1 PO NHIỀU SẢN PHẨM (Task T1)
-- Giữ purchase_orders (backward-compat PO 1 dòng cũ),
-- thêm bảng chi tiết lines. target_qty PO = sum(lines.target_qty).
-- ==========================================

create table if not exists po_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid references purchase_orders (id) on delete cascade,
  po_no text not null default '',
  item_code text not null default '',
  description text not null default '',
  target_qty numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_po_lines_po_id on po_lines (po_id);
create index if not exists idx_po_lines_po_no on po_lines (po_no);
create index if not exists idx_po_lines_item_code on po_lines (item_code);

-- Tương thích ngược: PO cũ chỉ có purchase_orders.item_code/target_qty
-- vẫn hiển thị như 1 line duy nhất ở tầng app (không migrate dữ liệu).

alter table purchase_orders disable row level security;
alter table po_lines disable row level security;

drop policy if exists "allow_all_po_lines" on po_lines;
create policy "allow_all_po_lines" on po_lines for all to public using (true) with check (true);

notify pgrst, 'reload schema';
