<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/85 backdrop-blur-xl animate-fade-in">
    <!-- Background glowing ambient effects -->
    <div class="absolute w-[350px] h-[350px] bg-[#CB3CFF]/20 rounded-full blur-[100px] pointer-events-none -top-10 -left-10"></div>
    <div class="absolute w-[350px] h-[350px] bg-[#00C2FF]/15 rounded-full blur-[100px] pointer-events-none -bottom-10 -right-10"></div>

    <div class="relative w-full max-w-md glass-card-dark border border-white/15 p-7 sm:p-8 rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden">
      <!-- Top Neon Header Accent Line -->
      <div class="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#00C2FF] via-[#CB3CFF] to-[#7e14ff]"></div>

      <!-- Header Unit -->
      <div class="flex flex-col items-center text-center mb-7">
        <!-- Logo -->
        <div class="w-14 h-14 rounded-[16px] bg-gradient-to-tr from-[#00C2FF] via-[#CB3CFF] to-[#7e14ff] p-[2px] shadow-[0_0_24px_rgba(203,60,255,0.45)] mb-3.5 flex items-center justify-center">
          <div class="w-full h-full bg-[#18202D] rounded-[14px] flex items-center justify-center">
            <svg viewBox="0 0 32 32" fill="none" class="w-8 h-8 drop-shadow-[0_0_8px_rgba(203,60,255,0.4)]">
              <path d="M6 10C6 7.79086 7.79086 6 10 6H16V16H6V10Z" fill="#00C2FF"/>
              <path d="M16 16H26V22C26 24.2091 24.2091 26 22 26H16V16Z" fill="#00C2FF"/>
              <path d="M16 6H22C24.2091 6 26 7.79086 26 10V16H16V6Z" fill="#CB3CFF"/>
              <path d="M6 16H16V26H10C7.79086 26 6 24.2091 6 22V16Z" fill="#CB3CFF"/>
            </svg>
          </div>
        </div>

        <h2 class="text-xl font-bold text-white tracking-tight">ĐĂNG NHẬP HỆ THỐNG</h2>
      </div>

      <!-- Error Notification (Floating Alert) -->
      <div v-if="authError" class="mb-4 p-3 rounded-[10px] bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5 animate-shake">
        <AlertCircle class="w-4 h-4 shrink-0 text-red-400" />
        <span class="leading-tight">{{ authError }}</span>
      </div>

      <!-- Form Inputs -->
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Email Input -->
        <div>
          <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Email người dùng</label>
          <div class="relative">
            <input 
              type="email"
              v-model="formEmail"
              required
              placeholder="Nhập email của bạn..."
              class="w-full h-[42px] px-3.5 pl-10 bg-[#18202D]/90 border border-white/15 rounded-[10px] text-xs text-white placeholder-[#AEB9E1]/40 outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-medium"
            />
            <Mail class="w-4 h-4 text-[#AEB9E1] absolute left-3 top-3" />
          </div>
        </div>

        <!-- Password Input -->
        <div>
          <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">
            <span>Mật khẩu</span>
          </label>
          <div class="relative">
            <input 
              :type="showPassword ? 'text' : 'password'"
              v-model="formPassword"
              required
              placeholder="Nhập mật khẩu của bạn..."
              autocomplete="current-password"
              class="w-full h-[42px] px-3.5 pl-10 pr-10 bg-[#18202D]/90 border border-white/15 rounded-[10px] text-xs text-white placeholder-[#AEB9E1]/40 outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-medium"
            />
            <Lock class="w-4 h-4 text-[#AEB9E1] absolute left-3 top-3" />
            <button 
              type="button" 
              @click="showPassword = !showPassword"
              class="absolute right-3 top-3 text-[#AEB9E1] hover:text-white transition cursor-pointer"
            >
              <EyeOff v-if="showPassword" class="w-4 h-4" />
              <Eye v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Remember Device Option -->
        <div class="flex items-center gap-2 pt-1">
          <input 
            type="checkbox" 
            id="rememberDevice" 
            v-model="rememberDevice" 
            class="w-4 h-4 rounded bg-[#18202D] border-white/20 text-[#CB3CFF] focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
          <label for="rememberDevice" class="text-xs text-[#AEB9E1] cursor-pointer select-none">
            Ghi nhớ đăng nhập trên thiết bị này lần đầu
          </label>
        </div>

        <!-- Submit Button -->
        <button 
          type="submit"
          :disabled="authLoading"
          class="w-full h-[44px] mt-2 btn-neon-purple rounded-[10px] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(203,60,255,0.35)] disabled:opacity-50 active:scale-98"
        >
          <Loader2 v-if="authLoading" class="w-4 h-4 animate-spin text-white" />
          <LogIn v-else class="w-4 h-4 text-white" />
          <span>{{ authLoading ? 'ĐANG XÁC THỰC...' : 'ĐĂNG NHẬP HỆ THỐNG' }}</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  Loader2, 
  AlertCircle 
} from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'

const emit = defineEmits<{
  (e: 'login-success'): void
}>()

const { login, authLoading, authError } = useAuth()

const formEmail = ref('')
const formPassword = ref('')
const showPassword = ref(false)
const rememberDevice = ref(true)

const handleSubmit = async () => {
  try {
    await login(formEmail.value, formPassword.value)
    emit('login-success')
  } catch (e) {
    // Error is handled in composable and reflected in authError
  }
}
</script>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}

.animate-shake {
  animation: shake 0.4s ease-in-out;
}
</style>
