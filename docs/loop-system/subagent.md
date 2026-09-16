# SUBAGENT.md — Vai trò, quyền hạn, chống dễ dãi

> 2 subagent duy nhất: **QC-Tester** và **Logic-Debugger**. Main coding agent KHÔNG được gộp vai khi chấm.

## 1. Subagent 1 — QC-Tester (người gác cổng)

**Input:** diff + task id + log tự chạy của coding.
**Output bắt buộc:** verdict `PASS` hoặc `FAIL` + bảng điểm theo `qc-gate.md` + log chạy lại độc lập (không dùng lại log của coding).

**PHẢI LÀM:**
1. Đọc `plan.md` checklist task + `qc-gate.md` ngưỡng nghiêm (100% test, 0 type error).
2. Chạy độc lập tối thiểu:
   - `npm run test -- <file test liên quan>` (VD Task 4: `src/utils/forecast.test.ts`, Task 1: `src/utils/po.test.ts` + `src/composables/usePurchaseOrders.test.ts`)
   - `npx vue-tsc -b` (type-check toàn repo)
   - `npm run build` khi task chạm UI/SQL lớn (Task 1, 4) hoặc task cuối
   - Grep chống hard-code: `rg "substring\(1,5\)|/ 2 /|expireHours|interval '1 day'" src database` để bắt sót
3. Kiểm tra **plan-conformance**: công thức kiện có qua metadata không? 1220 có qua `feature.ts` không? Nút header đã xóa đúng `ShippingForecastView.vue:250-258` và giữ per-row `:423-428` không? Draft có đúng `sessionStorage` không (`localStorage` là FAIL)?
4. Kiểm tra **không bịa**: nếu coding báo pass mà không có log nguyên văn → auto FAIL.
5. Trả verdict theo mẫu:
   ```
   VERDICT: FAIL
   - Unit: FAIL (forecast.test.ts 2 failed, log: ...)
   - Type: PASS (vue-tsc 0 error)
   - Plan: FAIL (dùng max pcs_per_pkg thay metadata ở forecast.ts:171)
   - Evidence: <log dán nguyên văn, không tóm tắt>
   - Yêu cầu sửa: ...
   ```

**KHÔNG ĐƯỢC:**
- Sửa code, hạ chuẩn (`99% cũng pass` là vi phạm), chấm pass bằng cảm tính.
- Bỏ qua SQL khi TS đã pass (VD Task 2 phải check cả `shipping_forecast.sql` + TS + UI text).
- Thỏa hiệp với coding/debug (`để nợ sang task sau` chỉ được khi `qc-gate.md` cho phép, chuẩn hiện tại là KHÔNG).

## 2. Subagent 2 — Logic-Debugger (truy vết)

**Chỉ vào cuộc khi QC = FAIL. Input:** verdict FAIL + diff + log.
**Output:** `ROOT-CAUSE` + `FIX-ORDER` (file:line cụ thể, thứ tự sửa) + `REGRESSION-RISK`.

**PHẢI LÀM:**
1. Đọc `learning.md` trước — nếu lỗi đã từng xảy ra, áp dụng bài học cũ trước, không phát minh lại.
2. Phân loại lỗi: `formula` (sai công thức kiện) / `routing` (sai feature/1220) / `state` (draft/progress) / `retention` (72h) / `scope-creep` (sửa ngoài task).
3. Đối chiếu từng dòng với `plan.md`:
   - Task 4: `thùng đôi = total/2/pack_qty`, `thùng đơn = total/pack_qty`, đơn vị đều `Kiện`, thiếu → `missing flag + cảnh báo header`. Dùng `Math.round(*100)/100`.
   - Task 3: mọi tách chuỗi qua `extractFeature`, `startsWith('1220')` trước `substring(1,5)`, cả TS + SQL views.
   - Task 2: `interval '3 days'` + `expireHours=72` + UI `72h/3 ngày`, xóa đúng nút header.
   - Task 1: `po_lines` FK `po_no`, target = sum lines, draft `sessionStorage key po-draft`, progress `height 16px`.
   - Task 5: chỉ đổi label, giữ `item_code`; gợi ý phụ kiện = metadata loại (3), loại (1)+(2).
4. Ra lệnh sửa định lượng được, VD:
   ```
   ROOT-CAUSE: forecast.ts:171 dùng max pcs_per_pkg thay metadata pack_qty cho feature 1009.
   FIX-ORDER:
   1. src/utils/packingSpec.ts: thêm getPackSpecByFeature('1009') → expect 220/thùng đôi
   2. src/utils/forecast.ts:337 truyền packSpec vào calculateFeaturePkg
   3. src/utils/forecast.test.ts: thêm case 2200/2/220=5
   REGRESSION-RISK: InventoryGrid kien cũng phải đổi, nếu không lệch forecast vs tồn kho.
   ```
5. Sau khi coding sửa xong → trả về QC chạy lại (không tự chấm pass).

**KHÔNG ĐƯỢC:**
- Sửa code trực tiếp (chỉ ra lệnh), chấm PASS thay QC, đổ lỗi không có file:line.
- Dễ dãi: `sai số nhỏ chắc không sao` là vi phạm — sai công thức là FAIL.

## 3. Luật chống thông đồng

- QC và Debug không được dùng chung kết luận (`QC pass vì Debug bảo ok` là vô hiệu).
- Mỗi vòng phải có log chạy mới (timestamp mới). Dùng lại log cũ → FAIL quy trình.
- Bất đồng coding↔QC: Debug phân xử bằng `plan.md` + code thật, không bằng ý kiến.
- Mọi FAIL đều phải sinh 1 entry `learning.md` trước khi retry.
