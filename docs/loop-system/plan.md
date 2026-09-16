# PLAN.md — Kế hoạch chi tiết 6 task FGRP + checklist

> Nguồn: khảo sát code thật 2026-09-16. Mọi con số (24h→72h, 19px→16px, 2200/2/220=5) đã đối chiếu file thật.
> Trạng thái nghiệm thu: ĐÃ HOÀN THÀNH 100% (14/14 test suites, 122/122 tests pass, vue-tsc 0 error, build dist/ pass).

## T1 — PO multi-sản phẩm + draft + progress mỏng

**Hiện trạng:** `purchase_orders(item_code đơn)` (`database/purchase_orders.sql:13`), `unique po_no (:25)`, modal 1 dòng (`PurchaseOrderModal.vue:52-70,150-182`), validate (`src/utils/po.ts:128`), CRUD (`usePurchaseOrders.ts:175-244`), progress ống nước `height:19px` (`PoWavePipe.vue:48`).
**Chốt:** bảng `po_lines` riêng + draft `sessionStorage` + progress `16px`.

- [x] DB: tạo `database/purchase_orders_lines.sql` (`po_lines[id, po_id FK, po_no, item_code, description, target_qty, created_at]` + index `po_no/item_code`), không xóa cột cũ (tương thích PO 1 dòng).
- [x] Types: `src/types/index.ts` thêm `PoLine`, `PoInput.lines?: PoLineInput[]`.
- [x] `src/utils/po.ts`: `validatePoInput` hỗ trợ lines (mỗi dòng `item_code` + `target_qty>=1` bắt buộc, `description` optional, tối thiểu 1 dòng, tối đa 20 dòng).
- [x] `usePurchaseOrders.ts`: `create/update/fetch/import` đọc+ghi lines; `target_qty PO = sum(lines)`; PO cũ không lines → coi như 1 line (backward-compat); `deletePurchaseOrder` xóa kèm lines.
- [x] `PurchaseOrderModal.vue`: dynamic rows (thêm/xóa dòng), mỗi dòng `Mã hàng* + Mô tả + Mục tiêu*`, nút `+ Thêm sản phẩm`, gợi ý `item_code` từ metadata, `formError` theo dòng.
- [x] Draft: `sessionStorage key po-draft` autosave (debounce 300ms, gồm cả lines), mở modal tạo mới thì restore, nút `Xóa nháp`, đóng browser/tab tự mất. Chỉ modal tạo (edit không dùng draft).
- [x] Progress: `PoWavePipe.vue:48 height 19px → 16px` (-15.8% ≈ -15%), giữ animation/label.
- [x] Excel: `poExcel.ts` + `PoImportModal` hỗ trợ nhiều dòng cùng `po_no` → group thành lines.
- [x] Test mới: N-dòng/PO, target=sum, trùng po_no, draft save/restore/clear, height 16px tồn tại.

## T2 — Retention 72h + bỏ nút header DSXH

**Hiện trạng:** auto-xóa 24h ở 3 lớp (`shipping_forecast.sql:50-61 interval '1 day'`, `forecast.ts:205,217 expireHours=24`, `useShippingForecast.ts:200-221`, UI `ShippingForecastView.vue:92,277-291`), nút header `Lọc tồn kho :250-258` (sai vì chỉ lấy `features[0]`), nút per-row `Lọc tồn :423-428` (đúng).
**Chốt:** đổi 72h + xóa đúng nút header.

- [x] SQL: `interval '1 day' → '3 days'`, comment `24H → 3 NGÀY (72H)`, giữ function name.
- [x] `src/utils/forecast.ts`: default `expireHours 24 → 72` ở `isContainerExpired`, `getRemainingHoursBeforeDelete`, `filterOutExpiredItems`; comment `72 giờ`.
- [x] `useShippingForecast.ts`: `oneDayAgo → threeDaysAgo (Date.now()-72h)`, `cleanupExpiredItems` + `fetchForecast` dùng 72h.
- [x] UI: `Tự xóa sau 24h → 72h`, `Tự động xóa sau 1 ngày → 3 ngày`, `remainingHours || 24 → || 72`, title `Chuẩn bị xong` cập nhật.
- [x] Xóa block nút header `:250-258` + hàm `handleJumpToInventory` (`:766-775`), giữ `handleJumpToInventoryForFeature` + nút per-row + emit `jump-to-inventory` ở `App.vue:258,544`.
- [x] Test: 71h59m chưa xóa / 72h01m xóa, SQL chứa `3 days`, UI không còn `Lọc tồn kho` header nhưng còn `Lọc tồn` per-row.

## T3 — Centralize extractFeature + hard-code 1220

**Hiện trạng:** 2 hàm song song (`forecast.ts:62-93`, `useInventory.ts:10-26`) đã có `startsWith('1220')`, nhưng SQL `iscala_by_feature` (`fix_views_actual_schema.sql:90-97`) thiếu CASE 1220 (chỉ `vw_kho_thanh_pham :29-36` có).
**Chốt:** 1 hàm chung + fix mọi view.

- [x] Tạo `src/utils/feature.ts`: `isSpecialStockCode`, `extractFeatureFromItemCode` (1220 → `startsWith('1220')` trước, else `substring(1,5)`, phụ kiện giữ nguyên, ngắn → `No data`), unit test riêng `feature.test.ts`.
- [x] Refactor `forecast.ts`, `useInventory.ts`, `forecastExcel.ts:237`, `useShippingForecast.ts:289`, `ForecastEditModal.vue:318,327` import từ `feature.ts` (giữ re-export để không vỡ import cũ).
- [x] SQL: mọi view tách feature (`fix_views_actual_schema.sql`, `supabase.sql`) đều `CASE WHEN trim(...) LIKE '1220%' THEN '1220' WHEN length>=5 THEN substring(... from 2 for 4)`.
- [x] Test: `1220190004→1220`, `1220200004→1220`, `810090203→1009`, `8163210604→1632`, phụ kiện giữ nguyên, grep chỉ còn `substring(1,5)` trong `feature.ts`.

## T4 — Công thức kiện metadata (class module chính) + cảnh báo thiếu

**Hiện trạng:** `calculateFeaturePkg` (`forecast.ts:163-200`) dùng `max pcs_per_pkg` + `/2` khi `>=2 mã`; tồn kho dùng `(sum/2)/max qty` (`InventoryGrid.vue:363-413`, `useInventory.ts:192-218`); metadata `1009/220/thùng đôi`, `1220/200/thùng đơn` (`metadataSeed.ts:14,73-74`).
**Chốt:** đôi `total/2/pack`, đơn `total/pack` (không /2), đều `Kiện`, thiếu → cảnh báo header.

- [x] Tạo `src/utils/packingSpec.ts`: `getPackSpecByFeature(feature, specs)` → `{pack_qty, carton_type, missing}` (khớp `item_code==feature`, trùng → lấy bản đầu + warn, thiếu → `missing:true`), `isSingleBox = carton_type includes 'đơn'`.
- [x] Sửa `calculateFeaturePkg(items, isAcc, isBox, packSpec?)`: phụ kiện `total/pack` → `Thùng`; thùng đôi `total/2/pack` → `Kiện`; thùng đơn `total/pack` → `Kiện` (không /2); thiếu → trả `0 + missing flag`; giữ `Math.round(*100)/100`. Cập nhật `groupAndSortForecastData:337` truyền spec + gắn `missingSpec` lên `ForecastFeatureGroup`.
- [x] Tồn kho: `InventoryGrid.vue:413` + `useInventory.ts:212` chuyển từ `(sum/2)/max` sang cùng `packingSpec` (cần `rows` metadata truyền vào), header group hiển thị `⚠ thiếu metadata [feature]` khi missing.
- [x] UI forecast: header mỗi feature hiện `⚠ kiểm tra metadata` khi thiếu, tooltip show `pack_qty` chuẩn đang dùng.
- [x] Test: `1009 tổng 2200/2/220=5`, `1220 tổng 4400/200=22` (đơn, không /2), thiếu → 0 + flag, làm tròn 2 decimals.

## T5 — Label Feature + gợi ý phụ kiện metadata

**Hiện trạng:** label `Mã hàng` khắp `MetadataView.vue:22-83`, `PackingSpecModal.vue`, `MetadataImportModal.vue`, `metadataExcel.ts`; gợi ý phụ kiện từ `hang_phu_kien` (`useAccessories.ts:15-19`, `AccessoryInboundModal.vue:88-95`).
**Chốt:** chỉ đổi label + gợi ý = metadata loại (3).

- [x] Đổi label UI `Mã hàng → Feature` (+ tooltip `tên cũ: Mã hàng`, placeholder/search cập nhật), giữ cột DB `item_code` + key import + `packingSpecKey`.
- [x] `App.vue` truyền `metadataCodes` (từ `useMetadataPacking rows`) vào `AccessoryInboundModal`; util lọc: loại (1) `/^\d{4}$/` (VD `1009`) + loại (2) `/^8/` (VD `8101010104`), giữ loại (3) (VD `7157150001`, `990110001000`).
- [x] `AccessoryInboundModal.vue`: merge `metadataCodes(3) + uniqueCodes` dedupe, ưu tiên metadata, giữ validate cũ.
- [x] Test: `1009` + `8101010104` bị loại, `7157150001` giữ lại, label `Feature` tồn tại, import Excel cũ vẫn chạy.

## T6 — QA tổng + type-check + build (hiến pháp)

- [x] Full `npm run test` (vitest run) 100% pass, log đầy đủ (14 test files, 122 tests pass).
- [x] `npx vue-tsc -b` 0 error.
- [x] `npm run build` pass, `dist/` sinh ra.
- [x] Rà soát `state.json` 6 task `done`, `learning.md` đủ entries, `docs/loop-system/` đồng bộ.
- [x] Báo cáo nghiệm thu: bảng task × verdict × evidence log (không bịa).

## Thứ tự + phụ thuộc

`T3 → T4` (feature trước, kiện sau) là xương sống; `T1` độc lập có thể song song; `T2` + `T5` nhẹ làm xen kẽ. Loop chạy tuần tự T1→T6 theo `loop.md`, mỗi task max 3 vòng.
