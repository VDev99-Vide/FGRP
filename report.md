# 📊 BÁO CÁO PHÂN TÍCH HỆ THỐNG FGRP (RPFG)

> **Mục tiêu**: Review toàn diện kiến trúc, dữ liệu, component, UX/UI, design system và chart để chuẩn bị bốc tách nâng cấp giao diện mới.  
> **Ngày phân tích**: 16/08/2026  
> **Framework**: Vue 3 + Vite + TypeScript + Supabase

---

## 1. 🏗️ KIẾN TRÚC HỆ THỐNG

### 1.1 Tech Stack
| Tầng | Công nghệ | Phiên bản |
|------|-----------|-----------|
| Frontend Framework | Vue 3 (Composition API) | ^3.5.34 |
| Build Tool | Vite | ^8.0.12 |
| Language | TypeScript | ~6.0.2 |
| CSS Framework | Tailwind CSS v4 | ^4.3.1 |
| Backend / Database | Supabase (PostgreSQL) | ^2.108.1 |
| UI Components | PrimeVue 4 | ^4.5.5 |
| Data Grid | AG Grid Community + Vue3 | ^35.3.1 |
| Charts | ECharts 6 + vue-echarts | ^6.1.0 / ^8.0.1 |
| Icons | Lucide Vue Next | ^1.0.0 |
| CSV Parser | PapaParse | ^5.5.3 |
| Excel Export | XLSX (SheetJS) | ^0.18.5 |
| Deploy | GitHub Pages (gh-pages) | ^6.3.0 |

### 1.2 Kiến trúc tổng thể
```
┌─────────────────────────────────────────────┐
│              App.vue (Single Page)           │
│  ┌──────────┐  ┌──────────────────────────┐ │
│  │ Sidebar   │  │  Main Content Area       │ │
│  │ (Nav)     │  │  ┌────────────────────┐  │ │
│  │           │  │  │ Tab: Dashboard     │  │ │
│  │ dashboard │  │  │ Tab: Inventory     │  │ │
│  │ inventory │  │  │ Tab: Accessories   │  │ │
│  │ accessories│ │  └────────────────────┘  │ │
│  │           │  │  ┌────────────────────┐  │ │
│  │           │  │  │ Modals Host (8)    │  │ │
│  │           │  │  └────────────────────┘  │ │
│  └──────────┘  └──────────────────────────┘ │
│              Footer Copyright                │
└─────────────────────────────────────────────┘
         ↕ Supabase Client (REST/RPC)
┌─────────────────────────────────────────────┐
│           Supabase PostgreSQL               │
│  Tables: inventory, master_data,             │
│          hang_phu_kien                       │
│  Views:  vw_kho_thanh_pham,                  │
│          vw_summary_analysis                 │
│  RPC:    replace_master_data()               │
│  RLS:    Anon full CRUD (nội bộ)             │
└─────────────────────────────────────────────┘
```

### 1.3 Pattern & Architecture Notes
- **Single-file App**: Toàn bộ logic nằm trong `App.vue` (~723 dòng), không có router. Chuyển tab bằng `v-if/v-else-if` với `currentTab` ref.
- **Composables Pattern**: Tách logic nghiệp vụ thành `useInventory()` và `useAccessories()` — đúng chuẩn Vue 3 Composition API.
- **Không có State Management Library**: Không dùng Pinia/Vuex. State quản lý cục bộ trong composables (reactive/ref).
- **Modal-driven UX**: 8 modal components được host tập trung tại App.vue, điều khiển qua boolean refs.
- **Toast Notification**: PrimeVue Toast cho tất cả feedback người dùng.
- **Không có Authentication**: RLS cho phép anon truy cập toàn bộ — phù hợp môi trường nội bộ.

---

## 2. 🔄 CẤU TRÚC VẬN HÀNH DỮ LIỆU

### 2.1 Mô hình dữ liệu (Database Schema)

#### Bảng `inventory` — Tồn kho thực tế (quét/tag)
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID (PK) | Định danh duy nhất |
| tag_id | TEXT | Mã tag RFID/barcode |
| bin | TEXT | Vị trí kho |
| stock_in_date | TIMESTAMPTZ | Thời gian nhập |
| source | TEXT | Nguồn nhập (mặc định 'manual') |

#### Bảng `master_data` — Dữ liệu nguồn iScala
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID (PK) | Định danh |
| batch | TEXT | Mã lô = tag_id đối chiếu |
| stock_code | TEXT | Mã sản phẩm ERP |
| qty | NUMERIC | Số lượng theo ERP |
| warehouse | TEXT | Mã kho (60, 01, 62, 50...) |
| create_date | TEXT | Ngày tạo từ ERP |

#### Bảng `hang_phu_kien` — Quản lý phụ kiện riêng biệt
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID (PK) | Định danh |
| code | TEXT | Mã phụ kiện |
| qty | NUMERIC | Số lượng tồn |
| bin | TEXT | Vị trí |

### 2.2 Luồng dữ liệu chính

```
[CSV Upload] → replace_master_data(RPC) → master_data
                                              ↓
[Tag Quét/Nhập tay] → inventory ──LEFT JOIN──→ vw_kho_thanh_pham
                                              ↓
                                    vw_summary_analysis
                                              ↓
                              useInventory().fetchInventory()
                                              ↓
                              App.vue (KPI + Charts + Grid)
```

### 2.3 Logic đối chiếu Actual vs iScala
- **View `vw_kho_thanh_pham`**: LEFT JOIN `inventory` với `master_data` qua `trim(lower(tag_id)) = trim(lower(batch))`. Nếu không khớp → hiển thị "No data".
- **View `vw_summary_analysis`**: FULL OUTER JOIN giữa actual (từ view trên) và iscala (từ master_data, chỉ warehouse 60/01). Tính diff và diff_percent theo feature (4 ký tự từ vị trí 2 của stock_code).
- **Feature extraction**: `substring(stock_code from 2 for 4)` — ví dụ stock_code "A1234B" → feature "1234".

### 2.4 Nhập/Xuất dữ liệu
| Thao tác | Phương thức | Ghi chú |
|----------|-------------|---------|
| Nhập kho thủ công | INSERT vào inventory | Hỗ trợ update nếu tag_id trùng |
| Nhập CSV batch | INSERT chunk 200 dòng/lần | Tránh timeout Supabase |
| Xuất kho | DELETE theo id | Xóa vĩnh viễn, không soft-delete |
| Sửa dòng kho | UPDATE tag_id + bin theo id | |
| Thay thế master | RPC `replace_master_data` hoặc fallback delete+insert | Transaction an toàn |
| Nhập phụ kiện | UPSERT (tìm exist → update qty hoặc insert mới) | Cùng code + bin = cộng dồn |
| Xuất phụ kiện | DELETE hoặc UPDATE giảm qty | Xuất hết = xóa dòng |
| Export Excel | Client-side via SheetJS | Từ dữ liệu đã fetch |

---

## 3. 🧩 CÁC COMPONENT

### 3.1 Component Tree (từ import trong App.vue)

```
App.vue
├── Layout
│   └── AppSidebar.vue              ← Navigation sidebar
├── KPI
│   └── KpiCards.vue                ← Thẻ KPI tổng quan
├── Charts
│   ├── ComparisonChart.vue         ← Biểu đồ Actual vs iScala
│   └── RiskNestedPieChart.vue      ← Biểu đồ phân tích rủi ro
├── Inventory
│   ├── InventoryGrid.vue           ← AG Grid bảng tồn kho
│   ├── InboundModal.vue            ← Modal nhập kho
│   ├── OutboundModal.vue           ← Modal xuất kho
│   ├── QuickOutboundModal.vue      ← Modal xuất nhanh từ grid
│   ├── EditInventoryModal.vue      ← Modal sửa dòng kho
│   └── UploadMasterModal.vue       ← Modal upload CSV master
└── Accessories
    ├── AccessoryInboundModal.vue   ← Modal nhập phụ kiện
    ├── AccessoryEditModal.vue      ← Modal sửa phụ kiện
    └── AccessoryOutboundModal.vue  ← Modal xuất phụ kiện
```

### 3.2 Thư mục component trống (chưa implement)
- `src/components/accessories/` — Có file modal nhưng chưa rõ cấu trúc con
- `src/components/charts/` — Có 2 chart component
- `src/components/inventory/` — Có grid + 5 modal
- `src/components/kpi/` — Có KpiCards
- `src/components/layout/` — Có AppSidebar

> ⚠️ **Lưu ý**: Tree ban đầu hiện `[0]` cho các thư mục này vì chúng chứa `.vue` files mà tree tool không đếm LOC. Thực tế các component đã tồn tại và được import.

### 3.3 Composables
| File | Chức năng chính |
|------|-----------------|
| `useInventory.ts` (270 LOC) | Fetch inventory + summary, tính KPI/analysis client-side, CRUD inventory, import CSV, replace master |
| `useAccessories.ts` (161 LOC) | Fetch phụ kiện, filter/search, CRUD phụ kiện, xuất một phần |

### 3.4 Services
| File | Chức năng |
|------|-----------|
| `supabase.ts` (11 LOC) | Khởi tạo Supabase client |
| `csvNormalizer.ts` (128 LOC) | Parse & chuẩn hóa CSV trước khi upload |
| `excelExport.ts` (110 LOC) | Export dữ liệu ra file Excel (.xlsx) |

### 3.5 Utils
| File | Chức năng |
|------|-----------|
| `format.ts` (35 LOC) | `formatNumber()` — định dạng số hiển thị |

---

## 4. 🎨 UX/UI HIỆN TẠI

### 4.1 Layout
- **Desktop**: Sidebar cố định bên trái + Main content scrollable bên phải (`flex flex-col lg:flex-row h-screen`)
- **Mobile**: Sidebar xếp dọc phía trên, content phía dưới
- **Max-width**: Nội dung giới hạn `max-w-[1600px]` căn giữa
- **Header**: Chỉ hiện trên desktop (`hidden lg:flex`), glassmorphism card với tiêu đề + thời gian sync
- **Footer**: Copyright cố định cuối trang

### 4.2 Navigation
- **Sidebar component** (`AppSidebar`) nhận `v-model="currentTab"` 
- 3 tab: `dashboard`, `inventory`, `accessories`
- Nút refresh + hiển thị lastSync + loading state tích hợp trong sidebar

### 4.3 Tương tác người dùng
| Feature | UX Pattern |
|---------|------------|
| Chuyển tab | Fade transition (`tab-fade`) với mode out-in |
| Thông báo | PrimeVue Toast (success/error) + ConfirmDialog |
| Nhập/Xuất kho | Modal-based workflow |
| Tìm kiếm phụ kiện | Input filter real-time (client-side) |
| Grid tương tác | AG Grid với nút quick-out + edit trên mỗi hàng |
| Upload CSV | Modal dedicated với preview/validation |
| Loading state | Boolean ref truyền xuống child components |

### 4.4 Responsive Design
- Tailwind breakpoints: `sm`, `lg`
- Grid chuyển từ 1 cột → 2-3 cột tùy màn hình
- Modal controls stack dọc trên mobile, ngang trên desktop
- Font size điều chỉnh theo viewport

---

## 5. 🎨 KIT MÀU & DESIGN TOKENS

### 5.1 Custom Theme Tokens (Tailwind v4 @theme)
```css
--font-sans: 'Plus Jakarta Sans', sans-serif;
--color-indigo-primary: #6366f1;
--color-gold-luxury: #d4af37;
--color-deep-rose: #f43f5e;
```

### 5.2 CSS Variables (:root)
| Variable | Giá trị | Sử dụng |
|----------|---------|---------|
| `--primary-light` | `#6366f1` | Indigo primary |
| `--gold-luxury` | `#d4af37` | Accent vàng sang trọng |
| `--deep-rose` | `#f43f5e` | Cảnh báo/rủi ro |
| `--bg-light` | `#f8fafc` | Background slate-50 |

### 5.3 Palette màu sử dụng trong template (Tailwind classes)
| Mục đích | Màu | Classes |
|----------|-----|---------|
| Primary / Brand | Indigo | `indigo-500`, `indigo-600`, `indigo-700`, `indigo-800` |
| Success / Nhập kho | Emerald | `emerald-600`, `emerald-700` |
| Danger / Xuất kho / Rủi ro cao | Rose | `rose-50`, `rose-100`, `rose-200`, `rose-500`, `rose-600`, `rose-700` |
| Warning / Theo dõi | Amber | `amber-50`, `amber-100`, `amber-200`, `amber-500`, `amber-600` |
| Phụ kiện / Secondary | Violet | `violet-500`, `violet-600`, `violet-700` |
| Text chính | Slate | `slate-700`, `slate-800` |
| Text phụ | Slate | `slate-400`, `slate-500`, `slate-600` |
| Background | Slate | `slate-50`, `slate-100`, `slate-200` |
| Surface | White/Transparent | `white/60`, `white/70`, `white/80`, `white/82` |

### 5.4 Typography
- **Font family**: Plus Jakarta Sans (Google Fonts)
- **Heading style**: `font-black`, `uppercase`, `tracking-widest` / `tracking-tight`
- **Body**: `text-xs` (10-12px) chiếm ưu thế — UI mật độ cao
- **Gradient text**: `bg-gradient-to-r from-slate-800 to-indigo-800 bg-clip-text text-transparent`

### 5.5 Glassmorphism Design System
```css
.glass-card-light {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(24px) saturate(200%);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 8px 32px -4px rgba(0,0,0,0.06), 
              0 2px 8px -2px rgba(99,102,241,0.06);
}
/* Hover: translateY(-2px) + shadow tăng + border indigo nhẹ */
```

### 5.6 AG Grid Custom Theme
- Font: Plus Jakarta Sans, 12px
- Header: 10px uppercase bold, bg `#f8fafc`
- Row height: 44px, Header height: 42px
- Hover: `rgba(99,102,241,0.04)`
- Selected: `rgba(99,102,241,0.07)`
- Group rows: Gradient `#eef2ff → #f8fafc`, border indigo
- Border radius wrapper: 16px

### 5.7 Animations
| Animation | CSS | Sử dụng |
|-----------|-----|---------|
| Tab fade | opacity + translateY 0.2s | Chuyển tab |
| Button hover | scale(1.02) + brightness(1.08) + shadow | Tất cả nút premium |
| Ping pulse | Tailwind `animate-ping` | Dot cảnh báo rủi ro |
| Pulse | Tailwind `animate-pulse` | Dot theo dõi gần |
| Sway | rotate ±4deg 4s infinite | Logo animation |

### 5.8 Background
- Wallpaper 4K (`/wallpaper4k.png`) với overlay gradient slate 88% opacity
- Fixed attachment (parallax-like)

---

## 6. 📈 CHART & VISUALIZATION

### 6.1 Thư viện
- **ECharts 6** (`echarts: ^6.1.0`)
- **vue-echarts 8** (`vue-echarts: ^8.0.1`) — Vue wrapper

### 6.2 Chart Components

#### ComparisonChart (`components/charts/ComparisonChart.vue`)
- **Loại**: Bar chart so sánh
- **Dữ liệu**: `summaryData` (từ `vw_summary_analysis`)
- **Nội dung**: Actual vs iScala theo Feature + tỷ lệ chênh lệch
- **Vị trí**: Dashboard, chiếm 2/3 chiều rộng (col-span-2)

#### RiskNestedPieChart (`components/charts/RiskNestedPieChart.vue`)
- **Loại**: Nested Pie / Donut chart
- **Dữ liệu**: `summaryData`
- **Nội dung**: Phân bổ rủi ro lệch kho theo mức độ
- **Vị trí**: Dashboard, 1/3 chiều rộng

### 6.3 KPI Cards (`components/kpi/KpiCards.vue`)
- Hiển thị 6 metrics: totalActual, diff, diffPercent, noData, move, duplicates
- Nhận prop `:kpi` từ composable

---

## 7. ⚠️ ĐIỂM CẦN LƯU Ý KHI NÂNG CẤP

### 7.1 Rủi ro kiến trúc
1. **App.vue quá lớn** (723 dòng): Nên tách tab content thành separate route/view components
2. **Không có Router**: Khó mở rộng thêm tab/page mới
3. **State cục bộ**: Refresh trang = mất trạng thái, cần reload toàn bộ
4. **Client-side KPI calculation**: Logic `updateMetrics()` nên chuyển sang DB view hoặc server-side để đảm bảo consistency
5. **RLS Anon Full Access**: Chỉ an toàn trong mạng nội bộ, cần auth nếu expose ra ngoài

### 7.2 Cơ hội cải thiện UX
1. **Thêm loading skeleton** thay vì chỉ boolean loading
2. **Pagination/Infinite scroll** cho grid khi dữ liệu lớn
3. **Search/filter toàn cục** cho inventory tab (hiện chỉ có ở accessories)
4. **Dark mode**: `style.css` đã có dark theme variables nhưng chưa được kích hoạt/toggle
5. **Accessibility**: Thiếu ARIA labels, keyboard navigation cho modals
6. **Error boundary**: Chưa có global error handling component

### 7.3 Design System cần chuẩn hóa
1. **Màu sắc**: Đang dùng trực tiếp Tailwind classes rải rác → Cần extract thành semantic tokens
2. **Glassmorphism**: Hardcoded CSS → Nên thành reusable utility/component
3. **Typography scale**: Chưa có hệ thống heading/body rõ ràng, nhiều inline text sizes
4. **Spacing**: Hỗn hợp p-4/p-5/p-6/gap-2.5/gap-3 → Cần spacing scale nhất quán
5. **Component library**: PrimeVue + custom glass cards + AG Grid custom theme → Cần unified design language

---

## 8. 📋 TÓM TẮT ĐỂ BỐC TÁCH NÂNG CẤP

| Module | Mức độ phức tạp | Ưu tiên | Ghi chú |
|--------|-----------------|---------|---------|
| Layout + Sidebar | Trung bình | Cao | Tách thành shell/layout component |
| Dashboard (KPI + Charts) | Cao | Cao | Giữ nguyên logic, redesign UI |
| Inventory Grid | Cao | Cao | AG Grid config phức tạp, cân nhắc giữ nguyên |
| Modals (8 cái) | Trung bình | Trung bình | Chuẩn hóa thành shared modal component |
| Accessories Tab | Thấp | Trung bình | Đơn giản, dễ migrate |
| Composables | Trung bình | Thấp | Logic tốt, giữ nguyên interface |
| Services | Thấp | Thấp | Ổn định, ít thay đổi |
| Styles/Theme | Cao | Cao | Cần rebuild design system từ đầu |
| Database Views | Trung bình | Thấp | Giữ nguyên, chỉ optimize nếu cần |

---

*Báo cáo được tạo tự động bởi goose agent. Sẵn sàng cho giai đoạn bốc tách từng module để nâng cấp giao diện mới.* 🚀
