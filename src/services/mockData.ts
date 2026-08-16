import { InventoryRow, SummaryAnalysisRow, HangPhuKienRow } from '@/types'

const STORAGE_KEY_INVENTORY = 'wms_mock_inventory_v1'
const STORAGE_KEY_ACCESSORIES = 'wms_mock_accessories_v1'

// Default mock inventory rows based on real factory FG items
const DEFAULT_INVENTORY_DATA: InventoryRow[] = [
  // Feature 1009
  {
    lp_no: '8100910004',
    feature: '1009',
    qty: 240,
    warehouse: '62',
    create_date: '11/06/2026',
    stock_in_date: '2026-06-11T08:30:00Z',
    tag_id: '199900015011',
    bin: 'A1-01',
    inventory_id: 'mock-inv-01'
  },
  {
    lp_no: '8100910004',
    feature: '1009',
    qty: 240,
    warehouse: '62',
    create_date: '11/06/2026',
    stock_in_date: '2026-06-11T09:15:00Z',
    tag_id: '199900015010',
    bin: 'A1-02',
    inventory_id: 'mock-inv-02'
  },
  {
    lp_no: '8100920004',
    feature: '1009',
    qty: 240,
    warehouse: '62',
    create_date: '11/06/2026',
    stock_in_date: '2026-06-11T10:00:00Z',
    tag_id: '199900015009',
    bin: 'A1-03',
    inventory_id: 'mock-inv-03'
  },
  // Feature 1010
  {
    lp_no: '8101010104',
    feature: '1010',
    qty: 250,
    warehouse: '62',
    create_date: '12/06/2026',
    stock_in_date: '2026-06-12T07:45:00Z',
    tag_id: '199900015028',
    bin: 'B2-01',
    inventory_id: 'mock-inv-04'
  },
  {
    lp_no: '8101010104',
    feature: '1010',
    qty: 250,
    warehouse: '62',
    create_date: '12/06/2026',
    stock_in_date: '2026-06-12T08:20:00Z',
    tag_id: '199900015029',
    bin: 'B2-02',
    inventory_id: 'mock-inv-05'
  },
  {
    lp_no: '8101010104',
    feature: '1010',
    qty: 250,
    warehouse: '62',
    create_date: '12/06/2026',
    stock_in_date: '2026-06-12T09:10:00Z',
    tag_id: '199900015030',
    bin: 'B2-03',
    inventory_id: 'mock-inv-06'
  },
  {
    lp_no: '8101010104',
    feature: '1010',
    qty: 250,
    warehouse: '62',
    create_date: '31/05/2026',
    stock_in_date: '2026-05-31T14:00:00Z',
    tag_id: '199900014346',
    bin: 'B2-04',
    inventory_id: 'mock-inv-07'
  },
  {
    lp_no: '8101020104',
    feature: '1010',
    qty: 250,
    warehouse: '62',
    create_date: '11/06/2026',
    stock_in_date: '2026-06-11T13:30:00Z',
    tag_id: '199900015015',
    bin: 'B2-05',
    inventory_id: 'mock-inv-08'
  },
  // Feature 1011
  {
    lp_no: '8101110104',
    feature: '1011',
    qty: 200,
    warehouse: '60',
    create_date: '15/06/2026',
    stock_in_date: '2026-06-15T11:00:00Z',
    tag_id: '199900015050',
    bin: 'C1-01',
    inventory_id: 'mock-inv-09'
  },
  {
    lp_no: '8101110104',
    feature: '1011',
    qty: 200,
    warehouse: '60',
    create_date: '15/06/2026',
    stock_in_date: '2026-06-15T11:45:00Z',
    tag_id: '199900015051',
    bin: 'C1-02',
    inventory_id: 'mock-inv-10'
  },
  // Feature 1012
  {
    lp_no: '8101210104',
    feature: '1012',
    qty: 180,
    warehouse: '01',
    create_date: '16/06/2026',
    stock_in_date: '2026-06-16T14:10:00Z',
    tag_id: '199900015060',
    bin: 'D3-01',
    inventory_id: 'mock-inv-11'
  },
  {
    lp_no: '8101210104',
    feature: '1012',
    qty: 180,
    warehouse: '01',
    create_date: '16/06/2026',
    stock_in_date: '2026-06-16T14:50:00Z',
    tag_id: '199900015061',
    bin: 'D3-02',
    inventory_id: 'mock-inv-12'
  },
  // Feature 1014
  {
    lp_no: '8101410104',
    feature: '1014',
    qty: 300,
    warehouse: '50',
    create_date: '18/06/2026',
    stock_in_date: '2026-06-18T08:00:00Z',
    tag_id: '199900015070',
    bin: 'E1-01',
    inventory_id: 'mock-inv-13'
  },
  {
    lp_no: '8101410104',
    feature: '1014',
    qty: 300,
    warehouse: '50',
    create_date: '18/06/2026',
    stock_in_date: '2026-06-18T08:30:00Z',
    tag_id: '199900015071',
    bin: 'E1-02',
    inventory_id: 'mock-inv-14'
  },
  // Feature 1015
  {
    lp_no: '8101510104',
    feature: '1015',
    qty: 150,
    warehouse: '62',
    create_date: '19/06/2026',
    stock_in_date: '2026-06-19T09:20:00Z',
    tag_id: '199900015080',
    bin: 'F2-01',
    inventory_id: 'mock-inv-15'
  },
  // Feature 1020
  {
    lp_no: '8102010104',
    feature: '1020',
    qty: 220,
    warehouse: '62',
    create_date: '20/06/2026',
    stock_in_date: '2026-06-20T10:15:00Z',
    tag_id: '199900015090',
    bin: 'G1-01',
    inventory_id: 'mock-inv-16'
  },
  // Low stock sample feature 1099 (< 2 kien)
  {
    lp_no: '8109910104',
    feature: '1099',
    qty: 50,
    warehouse: '62',
    create_date: '21/06/2026',
    stock_in_date: '2026-06-21T11:00:00Z',
    tag_id: '199900015099',
    bin: 'H1-01',
    inventory_id: 'mock-inv-17'
  },
  // Mid stock sample feature 1088 (3-5 kien)
  {
    lp_no: '8108810104',
    feature: '1088',
    qty: 120,
    warehouse: '62',
    create_date: '22/06/2026',
    stock_in_date: '2026-06-22T13:00:00Z',
    tag_id: '199900015088',
    bin: 'H2-01',
    inventory_id: 'mock-inv-18'
  },
  {
    lp_no: '8108810104',
    feature: '1088',
    qty: 120,
    warehouse: '62',
    create_date: '22/06/2026',
    stock_in_date: '2026-06-22T13:30:00Z',
    tag_id: '199900015089',
    bin: 'H2-02',
    inventory_id: 'mock-inv-19'
  },
  {
    lp_no: '8108810104',
    feature: '1088',
    qty: 120,
    warehouse: '62',
    create_date: '22/06/2026',
    stock_in_date: '2026-06-22T14:00:00Z',
    tag_id: '199900015091',
    bin: 'H2-03',
    inventory_id: 'mock-inv-20'
  },
  {
    lp_no: '8108810104',
    feature: '1088',
    qty: 120,
    warehouse: '62',
    create_date: '22/06/2026',
    stock_in_date: '2026-06-22T14:30:00Z',
    tag_id: '199900015092',
    bin: 'H2-04',
    inventory_id: 'mock-inv-21'
  },
  // Sample "No Data" row for Risk Alert Testing
  {
    lp_no: 'No data',
    feature: 'No data',
    qty: 0,
    warehouse: 'No data',
    create_date: 'No data',
    stock_in_date: '2026-06-23T15:00:00Z',
    tag_id: 'TAG-ERR-999901',
    bin: 'ERR-ZONE-01',
    inventory_id: 'mock-inv-22'
  },
  {
    lp_no: 'No data',
    feature: 'No data',
    qty: 0,
    warehouse: 'No data',
    create_date: 'No data',
    stock_in_date: '2026-06-23T15:30:00Z',
    tag_id: 'TAG-ERR-999902',
    bin: 'ERR-ZONE-02',
    inventory_id: 'mock-inv-23'
  },
  // Duplicate Tag sample for Risk Alert Testing
  {
    lp_no: '8101010104',
    feature: '1010',
    qty: 250,
    warehouse: '62',
    create_date: '12/06/2026',
    stock_in_date: '2026-06-24T16:00:00Z',
    tag_id: '199900015028', // Duplicate tag in another bin
    bin: 'B2-TEMP-DUP',
    inventory_id: 'mock-inv-24'
  }
]

// Default mock accessories rows
const DEFAULT_ACCESSORIES_DATA: HangPhuKienRow[] = [
  { id: 'acc-1', code: 'PK-CABLE-USB-C', qty: 450, bin: 'BIN-PK-01', created_at: '2026-06-01T08:00:00Z' },
  { id: 'acc-2', code: 'PK-BULB-H7-12V', qty: 180, bin: 'BIN-PK-02', created_at: '2026-06-01T08:30:00Z' },
  { id: 'acc-3', code: 'PK-CONN-4PIN-WP', qty: 890, bin: 'BIN-PK-03', created_at: '2026-06-01T09:00:00Z' },
  { id: 'acc-4', code: 'PK-BOX-CARTON-A4', qty: 320, bin: 'BIN-PK-04', created_at: '2026-06-02T10:00:00Z' },
  { id: 'acc-5', code: 'PK-STRAP-VELCRO-20', qty: 1500, bin: 'BIN-PK-05', created_at: '2026-06-02T11:00:00Z' },
  { id: 'acc-6', code: 'PK-SEAL-SILICONE', qty: 75, bin: 'BIN-PK-06', created_at: '2026-06-03T14:00:00Z' },
  { id: 'acc-7', code: 'PK-FUSE-10A-MINI', qty: 600, bin: 'BIN-PK-07', created_at: '2026-06-03T15:00:00Z' },
  { id: 'acc-8', code: 'PK-RELAY-12V-40A', qty: 95, bin: 'BIN-PK-08', created_at: '2026-06-04T09:00:00Z' },
  { id: 'acc-9', code: 'PK-LED-CHIP-6500K', qty: 2100, bin: 'BIN-PK-09', created_at: '2026-06-04T10:00:00Z' },
  { id: 'acc-10', code: 'PK-SCREW-M4X12', qty: 5000, bin: 'BIN-PK-10', created_at: '2026-06-05T13:00:00Z' }
]

// Mock iScala reference quantities by feature
const ISCALA_TARGET_MAP: Record<string, number> = {
  '1009': 700,
  '1010': 1200,
  '1011': 400,
  '1012': 350,
  '1014': 580,
  '1015': 160,
  '1020': 200,
  '1099': 100,
  '1088': 500
}

/**
 * Generate Summary Analysis view based on actual inventory
 */
export function generateMockSummary(inventory: InventoryRow[]): SummaryAnalysisRow[] {
  const actualByFeature: Record<string, number> = {}

  inventory.forEach(row => {
    const feat = row.feature
    if (!feat || feat === 'No data') return
    const q = Number(row.qty) || 0
    actualByFeature[feat] = (actualByFeature[feat] || 0) + q
  })

  // Combine features from actual and iScala map
  const allFeatures = Array.from(new Set([
    ...Object.keys(actualByFeature),
    ...Object.keys(ISCALA_TARGET_MAP)
  ])).sort()

  return allFeatures.map(feat => {
    const actual = actualByFeature[feat] || 0
    const iscala = ISCALA_TARGET_MAP[feat] || Math.round(actual * 0.9)
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
