import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import type { MetadataPacking } from '@/types'
import {
  filterPackingSpecs,
  normalizePackingSpec,
  packingSpecKey,
  validatePackingSpec,
  type PackingSpecInput,
} from '@/utils/metadata'
import { PACKING_SPEC_SEED } from '@/services/metadataSeed'
import type { MetadataExcelRow } from '@/services/metadataExcel'

const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `meta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const rows = ref<MetadataPacking[]>([])
const loading = ref(false)
const searchText = ref('')
const lastSync = ref('--:--')
const backendAvailable = ref(true)

const isMissingTableError = (e: unknown): boolean => {
  const code = (e as { code?: string })?.code
  const message = (e as { message?: string })?.message || String(e || '')
  return code === 'PGRST205' || message.includes('Could not find the table')
}

const isRlsError = (e: unknown): boolean => {
  const message = (e as { message?: string })?.message || String(e || '')
  return message.includes('row-level security') || message.includes('violates row-level security')
}

export function useMetadataPacking() {
  const needsMigration = computed(() => isSupabaseConfigured && !backendAvailable.value)
  const filteredRows = computed(() => filterPackingSpecs(rows.value, searchText.value))

  /** Nạp toàn bộ bảng quy cách từ Supabase (trống 100% nếu DB chưa có gì). */
  const fetchPackingSpecs = async () => {
    loading.value = true
    try {
      if (!isSupabaseConfigured || !backendAvailable.value) {
        lastSync.value = new Date().toLocaleTimeString('vi-VN')
        return
      }
      const { data, error } = await supabase
        .from('metadata_quy_cach')
        .select('*')
        .order('customer', { ascending: true })
      if (error) {
        if (isMissingTableError(error)) {
          backendAvailable.value = false
          console.warn('[Meta-data] Chưa có bảng metadata_quy_cach. Hãy chạy database/metadata.sql.')
          lastSync.value = new Date().toLocaleTimeString('vi-VN')
          return
        }
        throw error
      }
      rows.value = ((data || []) as MetadataPacking[]).map((r) => ({
        ...r,
        pack_qty: Number(r.pack_qty) || 0,
        weight_per_unit: Number(r.weight_per_unit) || 0,
      }))
      lastSync.value = new Date().toLocaleTimeString('vi-VN')
    } finally {
      loading.value = false
    }
  }

  /** Thêm 1 dòng quy cách mới. */
  const createPackingSpec = async (input: PackingSpecInput): Promise<MetadataPacking> => {
    const err = validatePackingSpec(input)
    if (err) throw new Error(err)
    const now = new Date().toISOString()
    const row: MetadataPacking = { id: genId(), ...normalizePackingSpec(input), created_at: now, updated_at: now }
    if (isSupabaseConfigured && backendAvailable.value) {
      const { error } = await supabase.from('metadata_quy_cach').insert(row)
      if (error) {
        if (isMissingTableError(error)) {
          backendAvailable.value = false
        } else if (isRlsError(error)) {
          throw new Error('Supabase chặn quyền ghi (RLS). Hãy chạy file database/metadata.sql trong Supabase SQL Editor.')
        } else {
          throw error
        }
      }
    }
    rows.value = [...rows.value, row]
    return row
  }

  /** Sửa 1 dòng quy cách. */
  const updatePackingSpec = async (id: string, input: PackingSpecInput): Promise<MetadataPacking> => {
    const err = validatePackingSpec(input)
    if (err) throw new Error(err)
    const idx = rows.value.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error('Không tìm thấy dòng quy cách cần sửa!')
    const updated: MetadataPacking = {
      ...rows.value[idx],
      ...normalizePackingSpec(input),
      updated_at: new Date().toISOString(),
    }
    if (isSupabaseConfigured && backendAvailable.value && !id.startsWith('meta-seed-')) {
      const { error } = await supabase.from('metadata_quy_cach').update(updated).eq('id', id)
      if (error) {
        if (isMissingTableError(error)) backendAvailable.value = false
        else throw error
      }
    }
    rows.value = rows.value.map((r) => (r.id === id ? updated : r))
    return updated
  }

  /** Xóa 1 dòng quy cách. */
  const deletePackingSpec = async (id: string) => {
    if (isSupabaseConfigured && backendAvailable.value && !id.startsWith('meta-seed-')) {
      const { error } = await supabase.from('metadata_quy_cach').delete().eq('id', id)
      if (error) {
        if (isMissingTableError(error)) backendAvailable.value = false
        else throw error
      }
    }
    rows.value = rows.value.filter((r) => r.id !== id)
  }

  /**
   * Nạp dữ liệu mẫu chuẩn (136 dòng Sample.xlsx) vào hệ thống.
   * Dòng trùng khóa tự nhiên (KH + Mã hàng + Quy cách) thì bỏ qua.
   */
  const seedSampleData = async (): Promise<{ imported: number; skipped: number }> => {
    const now = new Date().toISOString()
    const existingKeys = new Set(rows.value.map(packingSpecKey))
    const fresh = PACKING_SPEC_SEED.filter((s) => {
      const k = packingSpecKey(s)
      if (existingKeys.has(k)) return false
      existingKeys.add(k)
      return true
    }).map((s) => ({
      id: genId(),
      ...s,
      created_at: now,
      updated_at: now,
    }))

    if (fresh.length > 0 && isSupabaseConfigured && backendAvailable.value) {
      const chunkSize = 100
      for (let i = 0; i < fresh.length; i += chunkSize) {
        const { error } = await supabase.from('metadata_quy_cach').insert(fresh.slice(i, i + chunkSize))
        if (error) {
          if (isMissingTableError(error)) {
            backendAvailable.value = false
            break
          }
          if (isRlsError(error)) {
            throw new Error('Supabase chặn quyền ghi (RLS). Hãy chạy file database/metadata.sql trong Supabase SQL Editor.')
          }
          throw error
        }
      }
      if (backendAvailable.value) await fetchPackingSpecs()
    }
    if (!backendAvailable.value || !isSupabaseConfigured) {
      rows.value = [...rows.value, ...fresh]
    }
    return { imported: fresh.length, skipped: PACKING_SPEC_SEED.length - fresh.length }
  }

  /**
   * Import hàng loạt từ Excel: validate từng dòng, trùng khóa tự nhiên thì bỏ qua.
   */
  const importPackingSpecs = async (inputRows: MetadataExcelRow[]): Promise<{ imported: number; skipped: string[] }> => {
    const now = new Date().toISOString()
    const prepared: MetadataPacking[] = []
    const skipped: string[] = []
    const existingKeys = new Set(rows.value.map(packingSpecKey))

    inputRows.forEach((r) => {
      const err = validatePackingSpec(r)
      if (err) {
        skipped.push(`${r.customer || '?'} - ${r.item_code || '?'}: ${err}`)
        return
      }
      const normalized = normalizePackingSpec(r)
      const key = packingSpecKey(normalized)
      if (existingKeys.has(key)) {
        skipped.push(`${normalized.customer} - ${normalized.item_code}: trùng dòng đã có`)
        return
      }
      existingKeys.add(key)
      prepared.push({ id: genId(), ...normalized, created_at: now, updated_at: now })
    })

    if (prepared.length > 0) {
      if (isSupabaseConfigured && backendAvailable.value) {
        const chunkSize = 100
        for (let i = 0; i < prepared.length; i += chunkSize) {
          const { error } = await supabase.from('metadata_quy_cach').insert(prepared.slice(i, i + chunkSize))
          if (error) {
            if (isMissingTableError(error)) {
              backendAvailable.value = false
              break
            }
            if (isRlsError(error)) {
              throw new Error('Supabase chặn quyền ghi (RLS). Hãy chạy file database/metadata.sql trong Supabase SQL Editor.')
            }
            throw error
          }
        }
        if (backendAvailable.value) await fetchPackingSpecs()
        else rows.value = [...rows.value, ...prepared]
      } else {
        rows.value = [...rows.value, ...prepared]
      }
    }
    return { imported: prepared.length, skipped }
  }

  const clearMemory = () => {
    rows.value = []
  }

  return {
    rows,
    loading,
    searchText,
    lastSync,
    backendAvailable,
    needsMigration,
    filteredRows,
    fetchPackingSpecs,
    createPackingSpec,
    updatePackingSpec,
    deletePackingSpec,
    importPackingSpecs,
    seedSampleData,
    clearMemory,
  }
}
