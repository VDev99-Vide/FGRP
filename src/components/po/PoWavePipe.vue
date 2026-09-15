<template>
  <div class="flex items-center gap-2">
    <div class="po-wave-track">
      <div class="po-water-stream" :style="streamStyle">
        <div class="po-water-current"></div>
        <span class="po-bubble po-b1"></span>
        <span class="po-bubble po-b2"></span>
        <span class="po-bubble po-b3"></span>
        <span class="po-bubble po-b5"></span>
      </div>
    </div>
    <span class="po-wave-label" :style="{ color: flowColor, textShadow: `0 0 8px ${flowGlow}` }">
      {{ label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { interpolatePoColor, shadeHex, hexWithAlpha } from '@/utils/po'

const props = defineProps<{
  /** % đổ đầy ống (0-100, đã kẹp). */
  fill: number
  /** Nhãn % hiển thị (có thể > 100 khi nhập vượt). */
  label: string
}>()

/** Màu dòng nước theo %: xanh biển nhạt -> xanh lá (đồng bộ toàn module PO). */
const flowColor = computed(() => interpolatePoColor(props.fill))
const flowGlow = computed(() => hexWithAlpha(flowColor.value, 0.45))

const streamStyle = computed(() => {
  const base = flowColor.value
  return {
    width: `${Math.min(100, Math.max(0, Number(props.fill) || 0))}%`,
    background: `linear-gradient(90deg, ${shadeHex(base, -55)} 0%, ${base} 50%, ${shadeHex(base, 25)} 100%)`,
    boxShadow: `0 0 14px ${flowGlow.value}`,
  }
})
</script>

<style scoped>
.po-wave-track {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 24px;
  /* Kính mờ: chỉ thấy hiệu ứng nước chảy bên trong */
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.35),
    inset 0 -1px 2px rgba(255, 255, 255, 0.08),
    0 8px 24px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  /* Mờ dần ở 2 điểm cuối tạo độ tinh tế */
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
}

.po-wave-track::after {
  content: "";
  position: absolute;
  top: 1.5px;
  left: 12px;
  right: 12px;
  height: 3px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0));
  border-radius: 999px;
  z-index: 10;
  pointer-events: none;
}

/* Khối dòng chất lỏng */
.po-water-stream {
  position: relative;
  height: 100%;
  border-radius: 999px;
  overflow: hidden;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Lớp vân gợn nước cuộn trôi theo dòng */
.po-water-current {
  position: absolute;
  top: 0;
  left: 0;
  width: 200%;
  height: 100%;
  background: repeating-linear-gradient(
    -55deg,
    rgba(255, 255, 255, 0) 0px,
    rgba(255, 255, 255, 0) 14px,
    rgba(255, 255, 255, 0.12) 15px,
    rgba(255, 255, 255, 0) 24px
  );
  animation: po-water-push 1.4s linear infinite;
}

/* Bong bóng khí */
.po-bubble {
  position: absolute;
  background: radial-gradient(circle at 30% 30%, #ffffff, rgba(255, 255, 255, 0.2) 70%);
  border: 0.5px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  animation: po-bubble-swim infinite ease-in;
}

.po-b1 { width: 4.5px; height: 4.5px; top: 4px; animation-duration: 1.6s; animation-delay: 0.1s; }
.po-b2 { width: 3px; height: 3px; top: 12px; animation-duration: 1.2s; animation-delay: 0.5s; }
.po-b3 { width: 5.5px; height: 5.5px; top: 7px; animation-duration: 1.9s; animation-delay: 0.9s; }
.po-b5 { width: 4px; height: 4px; top: 5px; animation-duration: 1.4s; animation-delay: 0.3s; }

@keyframes po-bubble-swim {
  0% { left: -10px; opacity: 0; transform: translateY(0); }
  20% { opacity: 0.95; }
  80% { opacity: 0.95; transform: translateY(-2px); }
  100% { left: 100%; opacity: 0; transform: translateY(1px); }
}

@keyframes po-water-push {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.po-wave-label {
  font-weight: 800;
  font-size: 12px;
  min-width: 48px;
  text-align: right;
  font-family: ui-monospace, monospace;
}

@media (prefers-reduced-motion: reduce) {
  .po-water-current,
  .po-bubble { animation: none; }
  .po-water-stream { transition: none; }
}
</style>
