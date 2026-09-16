# SKILLS.md — 3 skill chuẩn cho 6 task FGRP

> Main agent đọc skill tương ứng trước mỗi bước. Skill chỉ làm đúng nghiệp vụ của mình.

## Skill 1 — `fgrp-coding` (dành cho main agent, Bước 1)

**Khi dùng:** mọi lượt code Task 1-6.
**Kỹ thuật chuẩn FGRP (Vue3 + TS + Supabase + PrimeVue):**
1. `Read` file target + test cũ trước, `Edit` biên nhỏ, giữ style Tailwind/glass-card hiện có.
2. DB: mọi bảng mới (`po_lines`) phải có file `database/*.sql` + `IF NOT EXISTS` + index + `disable RLS` + policy `allow_all` (copy mẫu `shipping_forecast.sql:68-88`), kèm `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` cho tương thích ngược.
3. Supabase pattern: copy `callSupabase` + `isMissingTableError/isRlsError` từ `usePurchaseOrders.ts:52-138`, fallback memory + cờ `needsMigration`, không throw thô.
4. Metadata là nguồn duy nhất: `import { getPackSpecByFeature } from '@/utils/packingSpec'`, không hard-code `220/200`. Feature qua `@/utils/feature`.
5. Draft PO: `sessionStorage` (không `localStorage`), key `po-draft`, debounce 300ms, `JSON.parse` bọc try/catch, nút xóa nháp.
6. Số học kiện: `Math.round(x*100)/100`, `Number(...)||0`, `toFixed(2)` chỉ ở hiển thị.
7. Tự chạy trước khi gọi QC: `npm run test -- <file test task>` + `npx vue-tsc -b --noEmit` (chụp log), sửa lỗi của mình trước.
8. Không chạm: `unique po_no` (giữ, lines nằm dưới PO), cột DB `item_code` (Task 5 chỉ đổi label), nút per-row `Lọc tồn` (Task 2 chỉ xóa header).

## Skill 2 — `fgrp-qc-testing` (dành cho subagent QC, Bước 2)

**Khi dùng:** sau mỗi lượt coding.
**Bài test chuẩn CI/CD (nghiêm 100%):**
1. **Unit (vitest):** `npm run test -- src/utils/forecast.test.ts src/utils/po.test.ts ...` theo ma trận `qc-gate.md §2`. Đọc số `passed/failed` từ log, không tin con số coding báo.
2. **Type:** `npx vue-tsc -b` → expect `0 error`. Dán 5 dòng cuối log.
3. **Build (khi cần):** `npm run build` → expect `built in ...`, check `dist/index.html` tồn tại.
4. **Grep chống sót:**
   - T3: `rg -n "substring\(1,5\)" src` → chỉ `feature.ts` được phép.
   - T4: `rg -n "pcs_per_pkg|max" src/utils/forecast.ts src/components/inventory/InventoryGrid.vue` → không còn công thức cũ.
   - T2: `rg -n "1 day|expireHours.*24|\|\| 24" src database` → phải 0 hit; `rg -n "3 days|72" src database` → có hit.
   - T1: `rg -n "localStorage" src/components/po/` → 0 hit; `rg -n "sessionStorage|po-draft" src` → có hit.
   - T2-UI: `rg -n "Lọc tồn kho" src/components/forecast/ShippingForecastView.vue` → 0 hit header (per-row `Lọc tồn` được giữ).
5. **Tính lại số:** lấy VD trong log/seed tự tính: `2200/2/220=5`, `71h59m vs 72h01m`, `19px*0.85≈16px`. Khớp mới pass.
6. **Verdict mẫu** theo `qc-gate.md §4`, kèm log nguyên văn. Không log = FAIL.

## Skill 3 — `fgrp-debug-tracing` (dành cho subagent Debug, Bước 3)

**Khi dùng:** khi QC = FAIL.
**Kỹ thuật truy vết logic FGRP:**
1. Đọc `learning.md` trước (tái dùng bài cũ), rồi đọc verdict QC + diff (`git diff --stat` + `git diff <file>`).
2. Khoanh vùng theo bảng tra nhanh:
   - Kiện sai → `calculateFeaturePkg` + `packingSpec.ts` + seed `metadataSeed.ts` (check `carton_type` đơn/đôi).
   - Feature sai → `feature.ts` + SQL views (`fix_views_actual_schema.sql`, `supabase.sql`) + `forecastExcel.ts`.
   - Retention sai → 3 lớp SQL/TS/UI (sót 1 lớp là lỗi kinh điển → check cả 3).
   - Draft sai → `sessionStorage` vs `localStorage`, key, restore path (tạo mới vs edit).
   - Gợi ý sai → regex `/^\d{4}$/` + `/^8/` trên `metadata item_code`.
3. Viết `ROOT-CAUSE` 1 câu + `FIX-ORDER` đánh số theo thứ tự DB → utils → composable → component → test, mỗi bước `file:line` + kỳ vọng đo được.
4. Đánh giá `REGRESSION-RISK`: sửa forecast có ảnh hưởng inventory không? Sửa label có vỡ import Excel không? Liệt kê file phải chạy lại test.
5. Không sửa code, chỉ ra lệnh. Sau coding sửa xong → trả về QC (không tự pass).
6. Mọi ca phải để lại 1 entry `learning.md` (kể cả ca đã biết → ghi `tái phạm`).
