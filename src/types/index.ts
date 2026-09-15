export interface InventoryRow {
  lp_no: string;
  feature: string;
  qty: number;
  warehouse: string;
  create_date: string;
  stock_in_date: string;
  tag_id: string;
  bin: string;
  inventory_id: string;
}

export interface SummaryAnalysisRow {
  feature: string;
  actual: number;
  iscala: number;
  diff: number;
  diff_percent: number;
}

export interface HangPhuKienRow {
  id: string;
  code: string;
  qty: number;
  bin: string;
  created_at?: string;
  updated_at?: string;
}

export interface KpiState {
  totalActual: number;
  diff: number;
  diffPercent: string;
  noData: number;
  move: number;
  duplicates: number;
}

export interface AnalysisState {
  noData: string[];
  lowStock: { feat: string; kien: string }[];
  duplicates: string[];
  midStock: { feat: string; kien: string }[];
}

export interface ForecastItem {
  id: string;
  po: string;
  so: string;
  container_no?: string;
  item_code: string;
  feature: string;
  loading_date: string;
  qty: number;
  pcs_per_pkg: number;
  pkg: number;
  is_accessory?: boolean;
  is_special?: boolean;
  is_box?: boolean;
  unit_type?: 'kien' | 'thung';
  status: 'pending' | 'ready';
  status_changed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ForecastFeatureGroup {
  feature: string;
  items: ForecastItem[];
  totalQty: number;
  pcs_per_pkg: number;
  pkgCount: number;
  is_accessory: boolean;
  is_special: boolean;
  is_box?: boolean;
  unit_type: 'kien' | 'thung';
}

export interface ForecastContainerGroup {  containerKey: string;
  po: string;
  so: string;
  container_no: string;
  loading_date: string;
  loadingDateObj: Date | null;
  status: 'pending' | 'ready';
  status_changed_at?: string | null;
  isExpired: boolean;
  remainingHours?: number;
  totalQty: number;
  totalPkg: number; // Tổng số kiện hàng thành phẩm
  totalBoxes: number; // Tổng số thùng phụ kiện
  summaryPkgLabel: string; // "X Kiện + Y Thùng" hoặc "X Kiện"
  hasAccessories: boolean;
  featureGroups: ForecastFeatureGroup[];
  allItems: ForecastItem[];
}

// ================= QUẢN LÝ ĐƠN ĐẶT HÀNG (PURCHASING - PO) =================

export type PurchaseOrderStatus = 'open' | 'completed';

export interface PurchaseOrder {
  id: string;
  po_no: string;
  supplier: string;
  item_code: string;
  description?: string; // mô tả sản phẩm (tùy chọn)
  note?: string; // ghi chú PO (tùy chọn)
  target_qty: number;
  created_date: string; // yyyy-mm-dd (ngày tạo PO, mặc định hôm nay nhưng sửa được)
  status: PurchaseOrderStatus;
  closed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PoReceiptLog {
  id: string;
  po_id: string;
  receipt_date: string; // yyyy-mm-dd (mặc định hôm nay nhưng sửa được)
  qty: number;
  note?: string;
  created_at?: string;
}

export type PoProgressLevel = 'danger' | 'warning' | 'success';

export interface PurchaseOrderWithProgress extends PurchaseOrder {
  received_qty: number;
  remaining_qty: number;
  progress: number; // % thực tế (có thể > 100 khi nhập vượt)
  progressCapped: number; // % hiển thị trên ống (giới hạn 0-100)
  level: PoProgressLevel; // danger <50%, warning 50-<100%, success >=100%
  receipt_count: number;
}

export interface PoStats {
  totalOrders: number;
  openCount: number;
  completedCount: number;
  totalTarget: number;
  totalReceived: number;
  overallPercent: number;
}

// ================= META-DATA: QUY CÁCH ĐÓNG GÓI CHUẨN =================
// Class module gốc (trích từ Sample.xlsx), phân phối cho toàn hệ thống ở task sau.

export interface MetadataPacking {
  id: string;
  customer: string;
  item_code: string;
  pack_qty: number;
  weight_per_unit: number;
  carton_spec: string;
  carton_type: string;
  created_at?: string;
  updated_at?: string;
}


