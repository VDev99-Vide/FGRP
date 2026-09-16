# AGENT.md — Hiến pháp Loop Engineering (FGRP)

> Phạm vi: `docs/loop-system/` là nguồn sự thật duy nhất cho vòng lặp 3 bước.
> Main agent (coding) + 2 subagent (QC, Debug) BẮT BUỘC tuân thủ. Không tự ý bịa code, bịa test.

## 1. Vai trò

| Vai | Nhiệm vụ | Cấm |
|---|---|---|
| **Main agent (Coding)** | Đọc `plan.md` + `skills.md`, code đúng 1 task/lượt, tự chạy `vitest` file liên quan trước khi gọi QC | Cấm nhảy task, cấm sửa ngoài scope task, cấm báo pass khi chưa có evidence log |
| **Subagent QC** | Chạy test chuẩn + type-check + logic-plan conformance, chỉ trả `PASS`/`FAIL` theo `qc-gate.md` | Cấm sửa code, cấm hạ chuẩn, cấm dễ dãi với coding/debug |
| **Subagent Debug** | Truy vết root-cause logic, đối chiếu `plan.md`, ra lệnh sửa cụ thể (file:line + patch gợi ý) | Cấm sửa code trực tiếp vượt quá gợi ý, cấm đổ lỗi không bằng chứng |

Điều phối: main agent dùng Task tool đóng vai từng subagent, tối đa **3 vòng/task**. Quá 3 vòng → dừng, ghi `state.json: failed`, ghi `learning.md`, báo user.

## 2. PHẢI LÀM (MUST)

1. **Đọc trước khi code:** `plan.md` (checklist task hiện tại) + `skills.md` (skill tương ứng) + file liên quan trong repo (không đoán).
2. **Nhỏ + từng bước:** 1 task = 1 vòng loop `Code → QC → Debug (nếu FAIL)`. Xong task N mới sang N+1.
3. **Evidence thật:** mọi claim `pass` phải kèm log dán nguyên văn (`vitest run`, `vue-tsc -b`, `vite build`). Cấm bịa kết quả.
4. **Hiến pháp state.json:** sau MỖI task/vòng lặp cập nhật `/workspaces/FGRP/state.json` (`lastUpdated`, `phase`, `tasks.<id>`, `nextSteps`). Miss phiên vẫn vào lại được.
5. **Sổ bài học:** mỗi FAIL phải ghi 1 entry vào `learning.md` (lỗi → fix → phòng ngừa).
6. **Tôn trọng class module chính:** `metadata_quy_cach` là nguồn duy nhất cho `pack_qty`/`carton_type`. Mọi công thức kiện phải tra cứu qua `src/utils/packingSpec.ts` (Task 4), không hard-code số.
7. **Hard-code 1220 tập trung:** mọi tách feature đi qua `src/utils/feature.ts` (Task 3): `startsWith('1220') → '1220'` trước `substring(1,5)`. Cấm viết lại `MID` rải rác.
8. **Không phá tương thích:** PO cũ 1 dòng vẫn chạy sau khi thêm `po_lines`; label `Mã hàng → Feature` chỉ đổi UI, giữ cột DB `item_code`.

## 3. KHÔNG ĐƯỢC LÀM (MUST NOT)

1. Không bịa file, bịa hàm, bịa số kiện, bịa log test.
2. Không đổi `interval`/ngưỡng QC khi chưa được duyệt trong `plan.md`.
3. Không `edit` khi chưa `read` file đó trong phiên.
4. Không dùng `bash` cho đọc/ghi file (dùng Read/Edit/Write/Glob/Grep).
5. Không commit/push khi chưa được yêu cầu显式.
6. Không hỏi user giữa loop (đã chốt auto-loop). Chỉ dừng khi: hết 6 task, hoặc quá 3 vòng/task, hoặc thiếu migration key không tự quyết được.
7. Subagent không được vượt quyền (QC không sửa code, Debug không chấm pass thay QC).

## 4. Định nghĩa Done cho 1 task

- [ ] Code đúng checklist `plan.md`
- [ ] `vitest run <file liên quan>` PASS 100% (log thật)
- [ ] `npx vue-tsc -b` 0 error
- [ ] `npm run build` pass (ở Task cuối hoặc khi chạm UI lớn)
- [ ] QC verdict `PASS` theo `qc-gate.md`
- [ ] `state.json` + `learning.md` đã cập nhật

## 5. Thứ tự đọc bắt buộc mỗi lượt

1. `plan.md` → task hiện tại + checklist
2. `skills.md` → skill tương ứng (coding/qc/debug)
3. `qc-gate.md` (QC/Debug) hoặc code target (Coding)
4. `learning.md` → tránh lặp lỗi cũ
5. `loop.md` → biết mình đang ở bước nào, còn mấy retry
