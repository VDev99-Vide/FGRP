<template>
  <div
    v-if="visible && po"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('update:visible', false)"
  >
    <div class="glass-card-dark w-full max-w-xl rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(0,194,255,0.25)] p-6 space-y-4 max-h-[90vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/40 flex items-center justify-center text-[#00C2FF] shadow-[0_0_12px_rgba(0,194,255,0.3)]">
            <History class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide">
              Lịch Sử Nhập Hàng · <span class="font-mono text-[#00C2FF]">{{ po.po_no }}</span>
            </h3>
            <p class="text-[11px] text-[#AEB9E1]">{{ po.supplier }} · {{ po.item_code }}</p>
          </div>
        </div>
        <button
          @click="$emit('update:visible', false)"
          class="p-1.5 text-[#AEB9E1] hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Summary -->
      <div class="grid grid-cols-3 gap-2.5 shrink-0">
        <div class="glass-panel-subtle p-3 text-center">
          <p class="text-[10px] text-[#AEB9E1] uppercase tracking-wider font-bold">Target</p>
          <p class="font-mono font-bold text-white text-sm mt-0.5">{{ po.target_qty.toLocaleString() }}</p>
        </div>
        <div class="glass-panel-subtle p-3 text-center">
          <p class="text-[10px] text-[#AEB9E1] uppercase tracking-wider font-bold">Đã nhập</p>
          <p class="font-mono font-bold text-[#14CA74] text-sm mt-0.5">{{ po.received_qty.toLocaleString() }}</p>
        </div>
        <div class="glass-panel-subtle p-3 text-center">
          <p class="text-[10px] text-[#AEB9E1] uppercase tracking-wider font-bold">Tiến độ</p>
          <p class="font-mono font-black text-sm mt-0.5" :style="{ color: levelColor }">{{ po.progress }}%</p>
        </div>
      </div>

      <!-- Log list -->
      <div class="flex-1 overflow-y-auto custom-scroll border border-white/10 rounded-xl min-h-0">
        <table class="w-full text-left text-xs whitespace-nowrap border-collapse">
          <thead class="glass-table-sticky-head">
            <tr>
              <th class="py-3 px-4 font-bold text-[11px] tracking-wider uppercase">Ngày nhập</th>
              <th class="py-3 px-4 font-bold text-[11px] tracking-wider uppercase text-right">Số lượng (PCS)</th>
              <th class="py-3 px-4 font-bold text-[11px] tracking-wider uppercase">Ghi chú</th>
              <th class="py-3 px-4 font-bold text-[11px] tracking-wider uppercase text-center">Xóa</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.06] font-medium">
            <tr v-for="(log, idx) in logs" :key="log.id" class="hover:bg-white/[0.06] transition-colors">
              <td class="py-2.5 px-4 font-mono text-[#AEB9E1]">Đợt {{ idx + 1 }} · {{ formatIsoDate(log.receipt_date) }}</td>
              <td class="py-2.5 px-4 text-right font-mono font-bold text-[#14CA74]">+{{ Number(log.qty).toLocaleString() }}</td>
              <td class="py-2.5 px-4 text-white/80 max-w-[220px] truncate" :title="log.note || ''">{{ log.note || '—' }}</td>
              <td class="py-2.5 px-4 text-center">
                <button
                  @click="$emit('delete-log', log.id)"
                  title="Xóa dòng log này (PO tự mở lại nếu rớt dưới target)"
                  class="p-1.5 bg-[#FF5A65]/15 hover:bg-[#FF5A65]/25 text-[#FF5A65] rounded-[6px] border border-[#FF5A65]/30 cursor-pointer transition active:scale-90"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
            <tr v-if="logs.length === 0">
              <td colspan="4" class="text-center py-10 text-[#AEB9E1] italic">PO này chưa có lần nhập hàng nào.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-end shrink-0">
        <button
          @click="$emit('update:visible', false)"
          class="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#AEB9E1] rounded-lg text-xs font-semibold transition cursor-pointer"
        >
          Đóng
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { History, X, Trash2 } from 'lucide-vue-next'
import type { PoReceiptLog, PurchaseOrderWithProgress } from '@/types'
import { PO_FLOW_COLORS, formatIsoDate } from '@/utils/po'

const props = defineProps<{
  visible: boolean
  po?: PurchaseOrderWithProgress | null
  logs: PoReceiptLog[]
}>()

defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'delete-log', logId: string): void
}>()

const levelColor = computed(() => PO_FLOW_COLORS[props.po?.level ?? 'danger'].solid)
</script>
