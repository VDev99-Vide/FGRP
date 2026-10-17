# FGRP API — Đẩy dữ liệu từ Excel/VBA lên hệ thống bằng 1 nút bấm

Kết nối **trực tiếp** từ VBA lên Supabase qua HTTPS (không cần server trung gian).

## 1. Cài đặt 1 lần

### Bước 1: Chạy SQL trên Supabase
Mở **Supabase → SQL Editor**, dán toàn bộ nội dung file `database/api_vba.sql` và bấm **Run**
(idempotent — chạy lại nhiều lần không sao).

File này sẽ:
- Tạo API: `api_replace_inventory`, `api_replace_master_data`, `api_import_shipping_forecast`, `api_healthcheck`.
- Gia cố `replace_inventory` + `replace_master_data` chống chạy song song (advisory lock) và chặn file trùng Tag ID + Bin.
- Tạo token xác thực trong bảng `app_config` (khóa `import_token`).

> Đổi token: `update public.app_config set value = '<token-mới>' where key = 'import_token';`
> rồi sửa hằng `FGRP_TOKEN` trong `vba/FGRP_API.bas` cho khớp.

### Bước 2: Import module VBA
1. Mở file Excel (file công cụ) → `Alt + F11` (VBE).
2. `File → Import File...` → chọn `vba/FGRP_API.bas`.
3. Kiểm tra 3 hằng số CONFIG ở đầu module: `FGRP_URL`, `FGRP_ANON_KEY`, `FGRP_TOKEN`.

### Bước 3: Tạo nút bấm (one-click)

**Nhóm lấy dữ liệu từ file nguồn** (mở hộp thoại chọn file, lọc, ghi vào sheet):

| Macro | Chức năng |
|---|---|
| `FGRP_LayDuLieuNhapKho` | Chọn file nguồn → lọc kiểu **NHẬP KHO** → ghi sheet `TON_KHO` |
| `FGRP_LayDuLieuCapNhatNguon` | Chọn file nguồn → lọc kiểu **CẬP NHẬT NGUỒN** → ghi sheet `MASTER_DATA` |

**Nhóm đẩy lên database:**

| Macro | Chức năng |
|---|---|
| `FGRP_DayTonKho` | Đẩy **Tồn Kho** — **thay thế toàn bộ** dữ liệu cũ (giống nút NHẬP KHO IN) |
| `FGRP_DayTonKhoThuNghiem` | Chạy thử, **không ghi** dữ liệu (dry-run) |
| `FGRP_DayCapNhatNguon` | Đẩy **Cập Nhật Nguồn (Master Data)** — **thay thế toàn bộ** |
| `FGRP_DayCapNhatNguonThuNghiem` | Chạy thử, **không ghi** dữ liệu (dry-run) |
| `FGRP_DayKeHoachXuatHang` | Đẩy **Kế Hoạch Xuất Hàng** — **cộng dồn**, không xóa dữ liệu cũ |
| `FGRP_DayKeHoachThuNghiem` | Chạy thử, **không ghi** dữ liệu (dry-run) |
| `FGRP_TestKetNoi` | Kiểm tra kết nối + xem số dòng hiện có trên DB |

## 2. Lấy dữ liệu từ file nguồn (Stock Balance With Batch)

Bấm nút lấy dữ liệu → chọn file `.xlsx/.xls` → module đọc **sheet đầu tiên**
(dòng 1 là tiêu đề) và lọc theo đúng cột cố định:

| Cột | Ý nghĩa | Ghi chú |
|---|---|---|
| A | Stock Code | Chỉ lấy dòng bắt đầu bằng **"8"** hoặc **"1220"** |
| B | Warehouse | NHẬP KHO: chỉ lấy **"01"** hoặc **"60"** (ô dạng số 1 tự hiểu là "01") |
| C | CREATEDATE | Giữ định dạng dd/mm/yyyy |
| D | BATCH | → Tag ID |
| E | BIN | → Bin (chỉ dùng cho NHẬP KHO) |
| F | Qty | Số lượng |

- **NHẬP KHO** (`FGRP_LayDuLieuNhapKho`): lọc A(8/1220) **và** B(01/60) → ghi `D, E` vào sheet `TON_KHO`
  (cột `Tag ID`, `Bin`). Nếu phát hiện cặp Tag ID + Bin trùng, module cảnh báo ngay
  (server cũng sẽ từ chối nếu cố đẩy).
- **CẬP NHẬT NGUỒN** (`FGRP_LayDuLieuCapNhatNguon`): chỉ lọc A(8/1220) → ghi `A, B, C, D, F` vào sheet
  `MASTER_DATA` (bỏ qua cột E). Sheet chuẩn: `Stock Code | Warehouse | CREATEDATE | BATCH | Qty`.

Quy trình chuẩn: **Lấy dữ liệu → kiểm tra sheet → bấm nút ThuNghiem (dry-run) → bấm nút thật.**

## 3. Cơ chế an toàn đã kiểm chứng

- **Chống nhân đôi / chạy song song**: advisory lock — test thật trên Postgres 16:
  hàm cũ chạy song song 2.508 → 5.016 dòng, hàm mới luôn 2.508 dòng (xem `scripts/test-sql-api.sh`).
  Cả `master_data` cũng có lock riêng (đã test lời gọi thứ 2 phải chờ ~1.6-2.2s).
- **1 request duy nhất** cho Tồn Kho / Nguồn: vì là THAY THẾ toàn bộ, chia nhỏ request sẽ mất dữ liệu.
  Đã đo thật: 5.016 dòng (~188KB) đẩy 1 lần chỉ ~1 giây — 5.000-20.000 dòng không lo sập.
- **Chặn file trùng**: server báo lỗi nếu Tồn Kho có cùng `Tag ID + Bin` lặp lại; yêu cầu sửa file.
- **Token**: mọi lời gọi API phải kèm `FGRP_TOKEN` đúng.
- **Dry-run**: các nút ThuNghiem chỉ đếm số dòng, không ghi.
- **Chống bấm nhầm 2 lần** trên web: nút nạp bị khóa khi đang xử lý + single-flight guard.

## 4. Kiểm tra API trước khi dùng

Sau khi chạy SQL (Bước 1), chạy tại thư mục dự án:

```bash
node scripts/test-api-live.mjs
```

Script chỉ **đọc + dry-run**, không ghi dữ liệu thật. Kết quả PASS nghĩa là API sẵn sàng.

## 5. Xử lý sự cố

| Hiện tượng | Nguyên nhân / cách sửa |
|---|---|
| `HTTP 404` khi gọi API | Chưa chạy `database/api_vba.sql` (bản mới nhất) trên Supabase |
| `Token không hợp lệ` | Token trong `.bas` khác trong bảng `app_config` |
| `Không tìm thấy cột...` | Tiêu đề cột ở sheet không khớp; đặt lại tên cột hoặc bổ sung alias trong `FindCol` |
| `File có N nhóm Tag ID + Bin bị trùng` | File Excel có dòng trùng — lọc bằng Data → Remove Duplicates cột Tag ID + Bin |
| `File nguồn thiếu cột E/F` | File nguồn không đúng cấu trúc Stock Balance With Batch |
| Lỗi mạng/SSL | Kiểm tra kết nối Internet; một số proxy công ty chặn WinHTTP |
