# Kế Hoạch Nâng Cấp Giao Diện Hệ Thống WMS — Dashdark V Dark Glassmorphism

Tài liệu kế hoạch và báo cáo chi tiết nâng cấp toàn diện giao diện hệ thống Quản lý Kho Thành Phẩm (WMS FG) sang phong cách **Dashdark V Analytics Dashboard (Dark Mode)** kết hợp **Hiệu ứng Kính Mờ (Frosted Glassmorphism)** chuẩn theo đặc tả `gemini-code-1786878124623.md`, hình ảnh thiết kế `image.png` và các tinh chỉnh theo yêu cầu người dùng.

---

## 🎯 Tổng Quan Các Hạng Mục Nâng Cấp & Tinh Chỉnh

### 1. Tinh Gọn Cấu Trúc Menu & Tab
- **Sidebar ([`src/components/layout/AppSidebar.vue`](file:///workspaces/FGRP/src/components/layout/AppSidebar.vue)):**
  - Giữ lại 3 menu nghiệp vụ cốt lõi:
    1. **Dashboard** (Bảng Điều Khiển)
    2. **Tồn Kho Thành Phẩm** (Features / Inventory)
    3. **Quản Lý Phụ Kiện** (Users / Accessories)
  - Đã gỡ bỏ: *Báo Cáo & Nguồn Dữ Liệu* và *Tích Hợp & Cài Đặt*.
  - Đã gỡ bỏ thẻ riêng *Trung Tâm Cảnh Báo Rủi Ro (Discrepancy Control)* ở cuối trang và chuyển trực tiếp toàn bộ dữ liệu cảnh báo vào các thẻ trực quan mới.

### 2. Áp Dữ Liệu Cảnh Báo Lên Thẻ "Users by country & World Dot Matrix Map" ([`src/components/dashboard/WorldDotMapCard.vue`](file:///workspaces/FGRP/src/components/dashboard/WorldDotMapCard.vue))
- **Chấm đỏ (`#FF5A65`):** Đại diện cho các **Tag ID lỗi ("No Data")** trên bản đồ ma trận chấm toàn cầu.
- **Chấm vàng (`#FDB52A`):** Đại diện cho các **Tag ID bị trùng** với **hiệu ứng nhấp nháy / chớp nháy (blinking animation)** liên tục để thu hút sự chú ý.
- **Callout Tag ID:** Hiển thị trực tiếp mã Tag ID thực tế từ hệ thống (ví dụ: `199900015028` hoặc tag lỗi).
- **Dãy hiển thị phần trăm & số lượng (Cột trái):**
  - **Tag ID Lỗi (No Data):** Số lượng Tag + Tỷ lệ % (Thanh Coral Red `#FF5A65`).
  - **Tag ID Trùng Lặp:** Số lượng Tag + Tỷ lệ % (Thanh Amber `#FDB52A`).
  - **Feature Tồn Thấp (< 2k):** Số lượng Feature (Thanh Neon Violet `#CB3CFF`).
  - **Feature Sắp Hết (3-5k):** Số lượng Feature (Thanh Neon Cyan `#00C2FF`).
  - **Tag Hợp Lệ & An Toàn:** Số lượng Tag + Tỷ lệ % (Thanh Emerald `#14CA74`).
  - **Chỉ số lớn ở đầu:** Tổng số Tag Rủi Ro + Tỷ lệ % chênh lệch rủi ro trên toàn kho.

### 3. Bảng Recent Orders Hiện Danh Sách Tag ID Lỗi & Trùng ([`src/components/dashboard/RecentOrdersTable.vue`](file:///workspaces/FGRP/src/components/dashboard/RecentOrdersTable.vue))
- Bảng sọc Zebra Dark Glass hiển thị chi tiết các dòng Tag ID lỗi và Tag ID trùng trong kho:
  - **Tag ID** kèm Checkbox tương tác.
  - **Vị Trí (Bin)** thực tế trong kho.
  - **Trạng Thái:** Badge `● No Data Lỗi` màu đỏ Coral hoặc `● Trùng Tag ID` màu vàng Amber nhấp nháy.
  - **Số lượng PCS & Warehouse:** Ví dụ `250 PCS (62)`.
  - Tự động hiển thị trạng thái *"Hệ thống an toàn"* khi không còn tag lỗi.

### 4. Tăng Kích Thước Biểu Đồ Website Visitors ([`src/components/dashboard/VisitorsRingChart.vue`](file:///workspaces/FGRP/src/components/dashboard/VisitorsRingChart.vue))
- Tăng bán kính vòng cung tròn (Outer Ring R: 105, Middle R: 86, Inner R: 67, nét vẽ 11px) và kích thước chữ trung tâm (`34px`) để biểu đồ vòng tròn hiển thị to, đầy đặn và cân đối hoàn hảo với card container.

### 5. Toàn Bộ Bảng & Modals Có Hiệu Ứng Kính Mờ (Frosted Glassmorphism)
- Bảng AG Grid ([`src/components/inventory/InventoryGrid.vue`](file:///workspaces/FGRP/src/components/inventory/InventoryGrid.vue)) và Bảng Phụ Kiện áp dụng hiệu ứng kính mờ `backdrop-filter: blur(24px) saturate(190%)`, nền sọc tối `#0A1330` / `#0B1739`.
- Toàn bộ 8 Modals (Nhập/Xuất kho, Quét nhanh, Sửa dòng, Nguồn CSV) có giao diện Dark Glass đồng bộ.

---

## 🛡️ Cam Kết Chất Lượng & Dữ Liệu
- **Logic dữ liệu & tính toán:** Giữ nguyên 100% logic tại `useInventory.ts`, `useAccessories.ts`, `mockData.ts`.
- **Tối ưu hiển thị:** Responsive trên PC, Laptop, Mobile không bị tràn dữ liệu.
- **Build Status:** `npm run build` thành công 100% không lỗi.
- **Localhost:** Đang chạy tại `http://localhost:5173/`.
