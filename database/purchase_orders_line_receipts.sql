-- ==========================================
-- PO RECEIPT THEO TỪNG MÃ (Task T2)
-- 1 PO nhiều mã -> mỗi lần nhập hàng gắn vào 1 mã cụ thể.
-- Log cũ (po_line_id NULL) giữ nguyên: tính vào tổng PO, không gán mã.
-- PO chỉ tự đóng khi TẤT CẢ mã đều đạt target (logic ở tầng app).
-- ==========================================

alter table po_receipt_logs
  add column if not exists po_line_id uuid default null,
  add column if not exists item_code text not null default '';

create index if not exists idx_po_receipt_logs_po_line_id on po_receipt_logs (po_line_id);
create index if not exists idx_po_receipt_logs_item_code on po_receipt_logs (item_code);

-- po_line_id để NULL tự do (log gộp cũ) nên không đặt FK cứng;
-- app tự join với po_lines khi hiển thị. Nếu muốn ràng buộc, bật thủ công:
-- alter table po_receipt_logs
--   add constraint fk_po_receipt_logs_line foreign key (po_line_id)
--   references po_lines (id) on delete set null;

alter table po_receipt_logs disable row level security;

drop policy if exists "allow_all_po_receipt_logs" on po_receipt_logs;
create policy "allow_all_po_receipt_logs" on po_receipt_logs for all to public using (true) with check (true);

notify pgrst, 'reload schema';
