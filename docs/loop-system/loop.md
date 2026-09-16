# LOOP.md — Vòng lặp Loop Engineering 3 bước (auto, max 3 vòng/task)

> Đã chốt: chạy tự động hết 6 task, không hỏi user giữa chừng. Dừng sớm chỉ khi: hết task, hoặc task quá 3 vòng, hoặc thiếu quyết định ngoài `plan.md`.

## 1. Sơ đồ 1 task

```
[vào task N] → đọc plan.md + skills.md + learning.md
  → BƯỚC 1 CODING (main agent): code đúng checklist, tự chạy test file liên quan, cập nhật state.json `in_progress`
  → BƯỚC 2 QC (subagent QC): chạy độc lập G1-G5 theo qc-gate.md → verdict
      → PASS → ghi state.json `done`, ghi learning (nếu có bài học), sang task N+1
      → FAIL → BƯỚC 3 DEBUG (subagent Debug): root-cause + fix-order → quay về BƯỚC 1 (vòng+1)
  → vòng > 3 → DỪNG task, state.json `failed`, learning.md entry `UNRESOLVED`, báo user
```

## 2. Quy định nghiêm ngặt

1. **Một task một lúc:** cấm code gộp T1+T2. Mỗi vòng chỉ sửa file thuộc task hiện tại (ngoại lệ: file dùng chung `feature.ts`/`packingSpec.ts` phải khai báo trong plan).
2. **Retry đếm theo QC verdict:** mỗi `FAIL → sửa → QC lại` = +1 vòng. Tối đa 3 vòng/task (vòng 1 là code đầu + QC đầu).
3. **Log mới mỗi vòng:** QC phải chạy lại lệnh thật, timestamp mới. Dùng lại log cũ = vi phạm quy trình, tính FAIL.
4. **State.json mỗi bước:** `in_progress` khi bắt đầu task, `done/failed` khi kết thúc, `lastUpdated` ISO mới. Không dồn cuối 6 task mới ghi.
5. **Learning trước retry:** vòng FAIL nào cũng phải có entry learning.md trước khi code lại.
6. **Không hỏi user:** main agent tự quyết trong phạm vi `plan.md`. Ngoài phạm vi (VD thiếu Supabase key, mâu thuẫn yêu cầu) → dừng + ghi `blocked-need-user`.
7. **Bằng chứng > lời nói:** `PASS` không log = `FAIL`. `Đã sửa` không diff = chưa sửa.

## 3. Pseudocode điều phối (main agent thực hiện bằng Task tool)

```
for N in [T1..T6]:
  round = 1
  state.json(N, in_progress)
  while round <= 3:
    CODING(N, fix_order nếu có)
    verdict = QC(N)  # độc lập, log mới
    if verdict == PASS: state.json(N, done); break
    else:
      learning.append(FAIL N-round)
      if round == 3: state.json(N, failed-UNRESOLVED); STOP_ALL; báo user
      fix_order = DEBUG(verdict)
      round += 1
      continue
```

## 4. Điều kiện dừng toàn loop

- `ALL-DONE`: 6/6 `done` → chạy `npm run test` full + `vue-tsc -b` + `npm run build` lần cuối, cập nhật `state.json phase=loop-complete`, báo user nghiệm thu.
- `TASK-FAILED`: task quá 3 vòng → dừng cả loop (không nhảy sang task sau để tránh lỗi chồng lỗi).
- `BLOCKED`: thiếu migration/quyền DB ngoài khả năng tự quyết → dừng + ghi rõ cần gì.

## 5. Checklist vận hành mỗi vòng (main agent tự tick)

- [ ] Đã đọc plan checklist task N + skill tương ứng?
- [ ] Đã đọc learning.md để tránh lỗi cũ?
- [ ] Coding xong có tự chạy test file liên quan chưa (log đâu)?
- [ ] Đã gọi QC độc lập (không dùng lại log coding)?
- [ ] Nếu FAIL: đã ghi learning + gọi Debug ra fix-order file:line chưa?
- [ ] Đã cập nhật state.json vòng này chưa?
- [ ] Còn mấy retry (1/3, 2/3, 3/3)?
