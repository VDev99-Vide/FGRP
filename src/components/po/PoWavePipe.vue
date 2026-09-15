<template>
  <div class="flex items-center gap-2.5">
    <div ref="trackRef" class="po-wave-track">
      <canvas ref="canvasRef"></canvas>
    </div>
    <span class="po-wave-label" :style="{ color: flowColor, textShadow: `0 0 10px ${flowGlow}` }">
      {{ label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { interpolatePoColor, shadeHex, hexWithAlpha } from '@/utils/po'

interface Bubble {
  x: number
  y: number
  r: number
  speedX: number
  swingSpeed: number
  swingAmp: number
  phase: number
  opacity: number
}

/** Ống sóng nước canvas: màu chảy từ xanh biển nhạt sang xanh lá theo % (kế thừa mẫu WaterPipe). */
class WaterPipe {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private colorFor: (fillWidth: number) => { base: string; wave1: string; wave2: string }
  private width = 0
  private height = 0
  private step = 0
  private bubbles: Bubble[] = []
  private rafId = 0
  private running = false
  percent = 0

  constructor(
    canvas: HTMLCanvasElement,
    percent: number,
    colorFor: (fillWidth: number) => { base: string; wave1: string; wave2: string },
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D không khả dụng')
    this.canvas = canvas
    this.ctx = ctx
    this.colorFor = colorFor
    this.percent = percent
  }

  resize() {
    const parent = this.canvas.parentElement
    if (!parent) return
    const dpr = window.devicePixelRatio || 1
    this.width = parent.clientWidth
    this.height = parent.clientHeight
    if (this.width <= 0 || this.height <= 0) return
    this.canvas.width = Math.round(this.width * dpr)
    this.canvas.height = Math.round(this.height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (this.bubbles.length === 0) {
      for (let i = 0; i < 10; i++) this.bubbles.push(this.createBubble(true))
    }
  }

  private createBubble(randomX = false): Bubble {
    const fillWidth = (this.width * this.percent) / 100
    return {
      x: randomX ? Math.random() * Math.max(fillWidth, 1) : -5 - Math.random() * 10,
      y: 4 + Math.random() * Math.max(this.height - 8, 1),
      r: 1.1 + Math.random() * 1.8,
      speedX: (1.2 + Math.random() * 1.6) * 0.95,
      swingSpeed: (0.04 + Math.random() * 0.06) * 0.95,
      swingAmp: 0.4 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.3 + Math.random() * 0.6,
    }
  }

  private drawWave(offsetY: number, amplitude: number, frequency: number, speed: number, color: string | CanvasGradient) {
    const fillWidth = (this.width * this.percent) / 100
    if (fillWidth <= 0) return
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.moveTo(0, this.height)
    for (let x = 0; x <= fillWidth; x += 2) {
      const y = offsetY + Math.sin(x * frequency + this.step * speed) * amplitude
      this.ctx.lineTo(x, y)
    }
    // Bo tròn màng nước đầu dòng chảy
    this.ctx.arcTo(fillWidth + 4, this.height / 2, fillWidth, this.height, 4)
    this.ctx.lineTo(fillWidth, this.height)
    this.ctx.closePath()
    this.ctx.fillStyle = color
    this.ctx.fill()
    this.ctx.restore()
  }

  private frame = () => {
    if (!this.running) return
    this.ctx.clearRect(0, 0, this.width, this.height)
    this.step += 0.95
    const fillWidth = (this.width * this.percent) / 100
    const { base, wave1, wave2 } = this.colorFor(fillWidth)

    const grad = this.ctx.createLinearGradient(0, 0, Math.max(fillWidth, 1), 0)
    grad.addColorStop(0, shadeHex(base, -55))
    grad.addColorStop(0.5, shadeHex(base, -20))
    grad.addColorStop(1, base)

    this.drawWave(6, 2.5, 0.04, 0.05, grad)
    this.drawWave(7, 3, 0.06, -0.07, wave1)
    this.drawWave(5, 1.8, 0.08, 0.09, wave2)

    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i]
      b.x += b.speedX
      b.y += Math.sin(this.step * b.swingSpeed + b.phase) * b.swingAmp * 0.4
      if (b.x > fillWidth - 4) {
        this.bubbles[i] = this.createBubble(false)
        continue
      }
      this.ctx.save()
      this.ctx.beginPath()
      this.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      this.ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity})`
      this.ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
      this.ctx.shadowBlur = 3
      this.ctx.fill()
      this.ctx.beginPath()
      this.ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2)
      this.ctx.fillStyle = '#ffffff'
      this.ctx.fill()
      this.ctx.restore()
    }
    this.rafId = requestAnimationFrame(this.frame)
  }

  /** Vẽ 1 khung tĩnh (chế độ giảm chuyển động). */
  renderOnce() {
    this.step += 1
    const fillWidth = (this.width * this.percent) / 100
    const { base } = this.colorFor(fillWidth)
    this.ctx.clearRect(0, 0, this.width, this.height)
    const grad = this.ctx.createLinearGradient(0, 0, Math.max(fillWidth, 1), 0)
    grad.addColorStop(0, shadeHex(base, -55))
    grad.addColorStop(1, base)
    this.drawWave(6, 2, 0.04, 0, grad)
  }

  start() {
    if (this.running) return
    this.running = true
    this.rafId = requestAnimationFrame(this.frame)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }
}

const props = defineProps<{
  /** % đổ đầy ống (0-100, đã kẹp). */
  fill: number
  /** Nhãn % hiển thị (có thể > 100 khi nhập vượt). */
  label: string
}>()

const trackRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let pipe: WaterPipe | null = null
let observer: ResizeObserver | null = null

const flowColor = computed(() => interpolatePoColor(props.fill))
const flowGlow = computed(() => hexWithAlpha(flowColor.value, 0.5))

const colorFor = () => {
  const base = flowColor.value
  return { base, wave1: hexWithAlpha(base, 0.45), wave2: 'rgba(255, 255, 255, 0.2)' }
}

watch(
  () => props.fill,
  (v) => {
    if (pipe) {
      pipe.percent = Math.min(100, Math.max(0, Number(v) || 0))
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) pipe.renderOnce()
    }
  },
)

onMounted(() => {
  if (!canvasRef.value) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  pipe = new WaterPipe(canvasRef.value, Math.min(100, Math.max(0, Number(props.fill) || 0)), colorFor)
  pipe.resize()
  if (reduceMotion) {
    pipe.renderOnce()
  } else {
    pipe.start()
  }
  if (trackRef.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      pipe?.resize()
      if (reduceMotion) pipe?.renderOnce()
    })
    observer.observe(trackRef.value)
  }
})

onBeforeUnmount(() => {
  pipe?.stop()
  pipe = null
  observer?.disconnect()
  observer = null
})
</script>

<style scoped>
.po-wave-track {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 30px;
  background: rgba(10, 15, 26, 0.85);
  border-radius: 20px;
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.9),
    inset 0 -1px 3px rgba(255, 255, 255, 0.1),
    0 4px 12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.po-wave-track::after {
  content: "";
  position: absolute;
  top: 1.5px;
  left: 10px;
  right: 10px;
  height: 4px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0));
  border-radius: 10px;
  z-index: 10;
  pointer-events: none;
}

.po-wave-track canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.po-wave-label {
  font-weight: 800;
  font-size: 14px;
  min-width: 56px;
  text-align: right;
  font-family: ui-monospace, monospace;
}
</style>
