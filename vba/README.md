# FGRP API — Đẩy dữ liệu từ Excel/VBA lên hệ thống bằng 1 nút bấm

Kết nối **trực tiếp** từ VBA lên Supabase qua HTTPS (không cần server trung gian,
không cần tạo file xử lý rồi upload thủ công).

## 1. Cài đặt 1 lần

### Bước 1: Chạy SQL trên Supabase
Mở **Supabase → SQL Editor**, dán toàn bộ nội dung file `database/api_vba.sql` và bấm **Run**.

File này sẽ:
- Tạo API: `api_replace_inventory`, `api_import_shipping_forecast`, `api_healthcheck`.
- Gia cố `replace_inventory` chống bug nhân đôi dữ liệu (advisory lock + chặn file trùng Tag ID + Bin).
- Tạo token xác thực trong bảng `app_config` (khóa `import_token`).

> Đổi token bảo mật: `update public.app_config set value = '<token-mới>' where key = 'import_token';`
> rồi sửa hằng `FGRP_TOKEN` trong `vba/FGRP_API.bas` cho khớp.

### Bước 2: Import module VBA
1. Mở file Excel → `Alt + F11` (VBE).
2. `File → Import File...` → chọn `vba/FGRP_API.bas`.
3. Kiểm tra 3 hằng số CONFIG ở đầu module: `FGRP_URL`, `FGRP_ANON_KEY`, `FGRP_TOKEN`.

### Bước 3: Tạo nút bấm (one-click)
`Developer → Insert → Button` rồi gán một trong các macro:

| Macro | Chức năng |
|---|---|
| `FGRP_DayTonKho` | Đẩy **Tồn Kho Thành Phẩm** — **thay thế toàn bộ** dữ liệu cũ (giống nút NHẬP KHO IN) |
| `FGRP_DayTonKhoThuNghiem` | Chạy thử, **không ghi** dữ liệu (dry-run) |
| `FGRP_DayKeHoachXuatHang` | Đẩy **Kế Hoạch Xuất Hàng** — **cộng dồn**, không xóa dữ liệu cũ |
| `FGRP_DayKeHoachThuNghiem` | Chạy thử, **không ghi** dữ liệu (dry-run) |
| `FGRP_TestKetNoi` | Kiểm tra kết nối + xem số dòng hiện có trên DB |

## 2. Cấu trúc sheet dữ liệu

Module **tự nhận diện cột theo tiêu đề ở dòng 1** (không phân biệt hoa/thường, có/không dấu, dấu cách):

**Sheet Tồn Kho** (đổi tên sheet trong hằng `SHEET_TON_KHO`, mặc định `TON_KHO`):
- `Tag ID` (hoặc `Mã kiện`, `Batch`, `Barcode`, `Code`…)
- `Bin` (hoặc `Vị trí`, `Location`, `Kho`, `Ô kho`…) — không bắt buộc

**Sheet Kế Hoạch Xuất Hàng** (mặc định `KE_HOACH_XUAT_HANG`):
- `Item Code` (hoặc `Mã hàng`, `LP.No`, `Stock Code`…) — **bắt buộc**
- `PO`, `SO`, `Container`, `Loading date`, `Qty`, `Pkg` — không bắt buộc

Nếu không tìm thấy sheet theo tên, module dùng **sheet đang mở** và hiện cảnh báo.

## 3. Cơ chế an toàn đã kiểm chứng

- **Chống nhân đôi**: SQL advisory lock — đã test thật trên Postgres 16: hàm cũ chạy song song
  2.508 → 5.016 dòng, hàm mới luôn giữ đúng 2.508 dòng (xem `scripts/test-sql-api.sh`).
- **Chặn file trùng**: server báo lỗi nếu file có cùng `Tag ID + Bin` lặp lại; yêu cầu sửa file.
- **Token**: mọi lời gọi API VBA phải kèm `FGRP_TOKEN` đúng, nếu không bị từ chối.
- **Dry-run**: mặc định có macro chạy thử không ghi dữ liệu trước khi chạy thật.
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
| `HTTP 404` khi gọi API | Chưa chạy `database/api_vba.sql` trên Supabase |
| `Token không hợp lệ` | Token trong `.bas` khác trong bảng `app_config` |
| `Không tìm thấy cột...` | Tiêu đề cột ở sheet không khớp; đặt lại tên cột hoặc bổ sung alias trong `FindCol` |
| `File có N nhóm Tag ID + Bin bị trùng` | File Excel có dòng trùng — lọc bằng Data → Remove Duplicates cột Tag ID + Bin |
| Lỗi mạng/SSL | Kiểm tra máy có kết nối Internet; một số proxy công ty chặn WinHTTP |
