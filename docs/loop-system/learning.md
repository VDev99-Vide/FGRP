# LEARNING.md — Sổ bài học lỗi (ghi mỗi FAIL, đọc mỗi vòng)

> Quy tắc: subagent Debug ghi `LỖI`, coding agent ghi `SỬA + PHÒNG NGỪA` sau khi fix xong. Không xóa entry cũ. Entry mới nhất lên đầu.

## Mẫu entry (copy)

```
### [YYYY-MM-DD] T<x>-vòng<y> — <tên ngắn> (FAIL/PASS-sau-fix)
- LỖI: <1 câu + file:line>
- NGUYÊN NHÂN: <formula/routing/state/retention/scope-creep>
- SỬA: <file:line đã đổi + kết quả test/log>
- PHÒNG NGỪA: <grep/lệnh check để lần sau bắt sớm>
```

## Bài học mồi (từ khảo sát, chưa phải FAIL — để tránh trước)

### [2026-09-16] SEED-01 — Nhầm 24h với 3 ngày (phòng ngừa)
- LỖI TIỀM ẨN: tưởng DSXH đang 3 ngày, thực tế code là 24h (`shipping_forecast.sql:61`, `forecast.ts:205`).
- PHÒNG NGỪA: Task 2 phải grep cả 3 lớp SQL+TS+UI, không sửa 1 lớp.

### [2026-09-16] SEED-02 — Hai công thức kiện lệch nhau (phòng ngừa)
- LỖI TIỀM ẨN: forecast dùng `max pcs_per_pkg` (`forecast.ts:171`), tồn kho dùng `max qty` (`InventoryGrid.vue:413`). Cả hai đều sai so với metadata.
- PHÒNG NGỪA: Task 4 sửa cả hai cùng lúc qua `packingSpec.ts`, test cả hai.

### [2026-09-16] SEED-03 — SQL thiếu CASE 1220 (phòng ngừa)
- LỖI TIỀM ẨN: TS đã có `startsWith('1220')` nhưng view `iscala_by_feature` chưa có.
- PHÒNG NGỪA: Task 3 grep `substring` trong `database/` sau khi sửa.

### [2026-09-16] SEED-04 — Xóa nhầm nút per-row (phòng ngừa)
- LỖI TIỀM ẨN: xóa cả `Lọc tồn` per-row (`:423-428`) thay vì chỉ header (`:250-258`).
- PHÒNG NGỪA: Task 2 diff phải show per-row còn nguyên.

### [2026-09-16] SEED-05 — Dùng localStorage cho draft (phòng ngừa)
- LỖI TIỀM ẨN: `localStorage` không tự xóa khi đóng browser, sai yêu cầu.
- PHÒNG NGỪA: QC grep `localStorage` trong `src/components/po/` phải 0 hit.

---
<!-- Entries FAIL thật ghi tiếp bên dưới dòng này, mới nhất lên trên cùng -->

### [2026-09-16] HOTFIX-SQL-01 — Schema drift inventory/master_data làm vỡ 2 view (FAIL ngoài Supabase → PASS sau vá)
- LỖI 1: `supabase.sql:90 i.stock_in_date does not exist` — DB thật dùng `inventory.stock_up_date`, file bootstrap cũ vẫn ref `stock_in_date`.
- LỖI 2: `fix_views:65 tag_id does not exist + must mark LATERAL` — DB thật `master_data` dùng `(batch, stock_code, warehouse)`, subquery `distinct on (trim(lower(tag_id)))` không qualify nên Postgres trỏ nhầm sang outer `inventory i`.
- BẰNG CHỨNG: `csvNormalizer.ts:32-58` + `UploadMasterModal` payload dùng batch/stock_code; `useInventory.ts:430` fallback `.neq('batch')` → master_data có cột `batch`, không có `tag_id`.
- SỬA: BƯỚC 0 unify cả 2 biến thể (ADD COLUMN IF NOT EXISTS + backfill 2 chiều chỉ lấp chỗ trống) ở cả 2 file; view dùng `coalesce(i.stock_up_date, i.stock_in_date)`; qualify `master_data.*` trong subquery; RPC ghi cả 2 bộ tên cột; `supabase.sql` gắn nhãn bootstrap-only.
- PHÒNG NGỪA: trên DB thật CHỈ chạy `fix_views_actual_schema.sql`; mọi cột trong subquery FROM phải qualify alias; thêm cột mới luôn kèm backfill 2 chiều.


### [2026-09-16] T6-vòng1 — Ghi `lines` memory lên Supabase gây PGRST204 (FAIL → PASS sau fix)
- LỖI: `{ ...po, lines: undefined }` vẫn gửi key `lines` lên `purchase_orders` → `Could not find the 'lines' column in the schema cache`, 6 test `usePurchaseOrders` fail.
- NGUYÊN NHÂN: scope-creep memory-field lọt vào payload Supabase; tương tự `markPoCompleted` spread nguyên `purchaseOrders[idx]` (có lines).
- SỬA: thêm `stripPoLines()` (destructure bỏ key, không gán undefined) cho mọi insert/update PO + import + markPoCompleted; import Excel hàng trống Số PO vẫn tính `skipped` để giữ test cũ.
- PHÒNG NGỪA: mọi field chỉ-memory (lines, computed) phải strip trước Supabase; test lại bằng `npm run test -- usePurchaseOrders` khi chạm composable PO.

