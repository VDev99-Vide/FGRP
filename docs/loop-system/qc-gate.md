# QC-GATE.md — Tiêu chuẩn chấm điểm (chuẩn NGHIÊM 100%)

> Đã chốt với user: **nghiêm 100% test + type**. Không có `pass với warning nợ`. Chỉ PASS khi đủ 5 cửa.

## 1. 5 cửa (tất cả phải PASS)

| # | Cửa | Lệnh chuẩn | Ngưỡng PASS |
|---|---|---|---|
| G1 | **Unit test** | `npm run test -- <file>` (vitest run) | 100% file liên quan pass, 0 failed/skipped bất thường. Log nguyên văn bắt buộc |
| G2 | **Type-check** | `npx vue-tsc -b` | 0 error. 1 error = FAIL |
| G3 | **Build** (khi chạm UI/SQL hoặc task cuối) | `npm run build` | PASS, dist sinh ra. Dùng để bắt lỗi import/view SQL sai |
| G4 | **Plan-conformance** | Đọc `plan.md` + grep code | Mọi checklist task phải khớp file:line thật. Sai 1 ý = FAIL |
| G5 | **No-fabrication** | Đối chiếu log | Mọi số (kiện, giờ, px) phải tính lại được từ code + metadata. Bịa = FAIL nặng, ghi learning.md |

## 2. Ma trận G1 theo task (file test tối thiểu)

- **Task 1 (PO multi + draft + progress):** `src/utils/po.test.ts`, `src/composables/usePurchaseOrders.test.ts`, `src/services/poExcel.test.ts` + case mới: N-dòng/PO, target=sum(lines), draft save/restore/clear, progress height 16px tồn tại trong `PoWavePipe.vue`.
- **Task 2 (72h + bỏ nút):** `src/utils/forecast.test.ts` (expire 72h: 71h59m chưa xóa, 72h01m xóa), `src/composables/useShippingForecast.test.ts`, grep `interval '3 days'` trong `shipping_forecast.sql`, UI chứa `72h`/`3 ngày`, `Lọc tồn kho` header biến mất nhưng `Lọc tồn` per-row còn.
- **Task 3 (1220 centralize):** `src/utils/forecast.test.ts` (`1220190004→1220`, `810090203→1009`), grep toàn repo chỉ còn `substring(1,5)` trong `src/utils/feature.ts`, mọi SQL view có `CASE WHEN ... like '1220%'`.
- **Task 4 (kiện metadata):** `src/utils/forecast.test.ts` case `1009: 2200/2/220=5 Kiện (thùng đôi)`, `1220: total/200 (thùng đơn, không /2)`, thiếu metadata → `missing=true + cảnh báo`, `Math.round(*100)/100`. Inventory test tương ứng.
- **Task 5 (label + gợi ý):** `src/utils/metadata.test.ts`, `src/services/metadataExcel.test.ts`, UI label `Feature`, suggestions loại trừ `1009` + `8101010104`, giữ `7157150001` (mã phụ kiện).
- **Task 6 (tổng):** full `npm run test` + `vue-tsc -b` + `npm run build` toàn repo.

## 3. Thang điểm (để Debug ưu tiên)

- G1 fail = 40đ trừ (blocker), G2 fail = 25đ, G4 fail = 25đ, G3 fail = 10đ, G5 fail = auto 0đ toàn task.
- PASS = 100đ (5/5 cửa). 99đ cũng là FAIL.

## 4. Mẫu verdict QC (bắt buộc)

```
TASK: T4-vòng2 | VERDICT: FAIL (75/100)
G1 PASS (forecast.test.ts 18/18, log: ...)
G2 PASS (vue-tsc 0 error, log: ...)
G3 SKIP (không chạm UI lớn vòng này — ghi rõ lý do)
G4 FAIL (-25: InventoryGrid.vue:413 vẫn (sum/2)/max, chưa dùng metadata)
G5 PASS (số 5 Kiện tính lại khớp 2200/2/220)
FIX-REQUIRED: InventoryGrid.vue:413 + useInventory.ts:212 chuyển sang getPackSpecByFeature
```

## 5. Danh sách FAIL tự động (không cần tranh luận)

- Dùng `localStorage` cho draft PO (phải `sessionStorage`).
- Giữ `interval '1 day'` / `expireHours 24` / text `24h` ở bất kỳ lớp nào (Task 2).
- Tính kiện bằng `max pcs_per_pkg` / `max qty` thay metadata (Task 4).
- Còn `substring(1,5)` ngoài `feature.ts` (Task 3).
- Đổi cột DB `item_code → feature` (Task 5 chỉ đổi label).
- Xóa nhầm nút `Lọc tồn` per-row hoặc giữ nút header (Task 2).
- Báo pass không kèm log nguyên văn.
