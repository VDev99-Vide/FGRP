import { InventoryRow, SummaryAnalysisRow, HangPhuKienRow } from '@/types'

const STORAGE_KEY_INVENTORY = 'wms_mock_inventory_v1'
const STORAGE_KEY_ACCESSORIES = 'wms_mock_accessories_v1'

// Dữ liệu demo đã xóa — 100% Supabase (trống khi DB rỗng). Giữ cấu trúc hằng để không vỡ import.
const DEFAULT_INVENTORY_DATA: InventoryRow[] = []

// Dữ liệu demo đã xóa — 100% Supabase (trống khi DB rỗng). Giữ cấu trúc hằng để không vỡ import.
const DEFAULT_ACCESSORIES_DATA: HangPhuKienRow[] = []

/**
 * Tổng hợp phân tích tồn kho dựa trên dữ liệu thực tế (100% Supabase).
 * Trống khi không có dữ liệu — không chèn mục tiêu mẫu.
 */
export function generateMockSummary(inventory: InventoryRow[]): SummaryAnalysisRow[] {
  const actualByFeature: Record<string, number> = {}

  inventory.forEach(row => {
    const feat = row.feature
    if (!feat || feat === 'No data') return
    const q = Number(row.qty) || 0
    actualByFeature[feat] = (actualByFeature[feat] || 0) + q
  })

  // Chỉ các feature có tồn thực tế — không merge mục tiêu mẫu
  const allFeatures = Object.keys(actualByFeature).sort()

  return allFeatures.map(feat => {
    const actual = actualByFeature[feat] || 0
    const iscala = Math.round(actual * 0.9)
    const diff = actual - iscala
    let diff_percent = 0
    if (iscala > 0) {
      diff_percent = parseFloat(((diff / iscala) * 100).toFixed(2))
    } else if (actual > 0) {
      diff_percent = 100
    }

    return {
      feature: feat,
      actual,
      iscala,
      diff,
      diff_percent
    }
  })
}

/**
 * Get Mock Inventory from localStorage or initialize
 */
export function getMockInventory(): InventoryRow[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_INVENTORY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('Cannot read mock inventory from localStorage', e)
  }
  saveMockInventory(DEFAULT_INVENTORY_DATA)
  return [...DEFAULT_INVENTORY_DATA]
}

/**
 * Save Mock Inventory to localStorage
 */
export function saveMockInventory(data: InventoryRow[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(data))
  } catch (e) {
    console.warn('Cannot save mock inventory to localStorage', e)
  }
}

/**
 * Get Mock Accessories from localStorage or initialize
 */
export function getMockAccessories(): HangPhuKienRow[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACCESSORIES)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('Cannot read mock accessories from localStorage', e)
  }
  saveMockAccessories(DEFAULT_ACCESSORIES_DATA)
  return [...DEFAULT_ACCESSORIES_DATA]
}

/**
 * Save Mock Accessories to localStorage
 */
export function saveMockAccessories(data: HangPhuKienRow[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACCESSORIES, JSON.stringify(data))
  } catch (e) {
    console.warn('Cannot save mock accessories to localStorage', e)
  }
}

/**
 * Reset mock data to factory defaults
 */
export function resetMockData(): { inventory: InventoryRow[]; accessories: HangPhuKienRow[] } {
  saveMockInventory(DEFAULT_INVENTORY_DATA)
  saveMockAccessories(DEFAULT_ACCESSORIES_DATA)
  return {
    inventory: [...DEFAULT_INVENTORY_DATA],
    accessories: [...DEFAULT_ACCESSORIES_DATA]
  }
}
