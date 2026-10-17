# Hệ Thống WMS FG PRO (Bản Nâng Cấp Vite + Vue 3 + TypeScript)

Hệ thống quản lý kho thành phẩm (WMS FG PRO) được nâng cấp từ phiên bản HTML đơn lẻ lên cấu trúc dự án chuẩn: **Vite + Vue 3 + TypeScript + TailwindCSS + PrimeVue + AG Grid Community + Apache ECharts + Supabase**.

## Các tính năng nổi bật bản nâng cấp
1. **Hiệu suất vượt trội**: Sử dụng **AG Grid Community** cho bảng dữ liệu tồn kho lớn, cuộn mượt mà không bị lag DOM trên PDA/Mobile.
2. **Giao diện Sidebar**: Thay đổi sang giao diện Sidebar chuyên nghiệp, dễ điều hướng giữa Dashboard, Tồn Kho và Phụ Kiện.
3. **Biểu đồ mượt mà**: Thay ApexCharts bằng **Apache ECharts** với tính năng `dataZoom` kéo vuốt mượt mà trên Mobile/PDA.
4. **Autocomplete cho Phụ Kiện**: Hỗ trợ tự động gợi ý các mã phụ kiện đã nhập trước đó.
5. **Xem trước (Preview) CSV**: Xem thống kê số dòng lỗi/hợp lệ và bảng xem trước trước khi tải dữ liệu lên hệ thống.
6. **Bảo mật & Tối ưu Supabase**: Bật RLS cho các bảng thật, tối ưu hóa database index cho tốc độ truy vấn vượt trội.

---

## 1. Cấu trúc dự án chính
- `/src/components/`: Chứa các component giao diện (Sidebar, KPI, Charts, Modals...).
- `/src/composables/`: Chứa logic nghiệp vụ tách biệt (State & CRUD API Supabase).
- `/src/services/`: Khởi tạo Supabase client, CSV Normalizer và Excel Exporter.
- `/database/`: Chứa file `supabase.sql` gồm toàn bộ cấu trúc bảng, views, RPC, index và RLS policies.

---

## 2. Hướng dẫn Setup & Chạy Local

### Bước 1: Cài đặt Dependencies
Chạy lệnh sau tại thư mục gốc:
```bash
npm install
```

### Bước 2: Thiết lập file môi trường (.env)
Tạo file `.env` từ file mẫu `.env.example`:
```bash
copy .env.example .env
```
Mở file `.env` và điền thông tin Supabase của bạn:
```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Bước 3: Chạy môi trường Development
```bash
npm run dev
```
Mở trình duyệt truy cập `http://localhost:5173`.

---

## 3. Hướng dẫn Deploy lên GitHub Pages

Ứng dụng được thiết kế không sử dụng Vue Router lịch sử (History mode) mà sử dụng State Vue (`currentTab`), do đó deploy lên GitHub Pages cực kỳ đơn giản và không bao giờ bị lỗi đường dẫn (404 Page Not Found).

### Cách 1: Deploy thủ công bằng thư viện `gh-pages`
1. Cài đặt thư viện `gh-pages`:
   ```bash
   npm install -D gh-pages
   ```
2. Thêm scripts vào `package.json`:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
3. Chạy lệnh deploy:
   ```bash
   npm run deploy
   ```

### Cách 2: Sử dụng GitHub Actions tự động
Tạo file `.github/workflows/deploy.yml` với nội dung được hướng dẫn trong technical brief để tự động build và deploy mỗi khi push lên nhánh `main`.

---

## 4. Thiết lập Supabase Database

Để hệ thống hoạt động chính xác với cấu trúc dữ liệu mới, hãy chạy script SQL trong file [database/supabase.sql](file:///c:/Users/Vinh/Documents/RPFG/database/supabase.sql) tại mục **SQL Editor** trong trang quản trị Supabase.

Script SQL này bao gồm:
- Tạo bảng `inventory`, `master_data`, `hang_phu_kien`.
- Tạo RPC `replace_master_data` để thay thế dữ liệu nguồn master data an toàn trong một transaction.
- Tạo view `vw_kho_thanh_pham` và `vw_summary_analysis` chứa logic nghiệp vụ và phân tích KPI.
- Bật RLS và các chính sách an toàn cho `anon` để ghi nhận dữ liệu mà không cần login.
- Tạo các indexes giúp tăng tốc độ tìm kiếm và đối chiếu.

---

## 5. API VBA — Đẩy dữ liệu 1 nút bấm (Tồn Kho + Kế Hoạch Xuất Hàng)

Chạy thêm **một lần** [database/api_vba.sql](database/api_vba.sql) trong Supabase SQL Editor để:
- Gia cố `replace_inventory`: advisory lock + chặn file trùng Tag ID + Bin (fix bug nhân đôi 2.508 → 5.016 dòng).
- Tạo API cho VBA: `api_replace_inventory`, `api_import_shipping_forecast`, `api_healthcheck` (xác thực token + hỗ trợ dry-run).
- Tạo khóa advisory cho `replace_master_data`.

Hướng dẫn cài đặt và dùng module VBA: xem [vba/README.md](vba/README.md).
Kiểm chứng API (read-only + dry-run): `node scripts/test-api-live.mjs`.
Test SQL trên Postgres local (bằng chứng bug + fix): `bash scripts/test-sql-api.sh`.
