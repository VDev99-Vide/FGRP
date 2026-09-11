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
}

export interface ForecastContainerGroup {
  containerKey: string;
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
  totalPkg: number;
  featureGroups: ForecastFeatureGroup[];
  allItems: ForecastItem[];
}

