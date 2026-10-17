/**
 * Chống gọi trùng lặp (double-submit / double-emit) cho các thao tác nguy hiểm
 * như "xóa toàn bộ + nạp mới". Nếu một thao tác cùng loại đang chạy,
 * lần gọi sau sẽ bị từ chối ngay thay vì chạy song song gây nhân đôi dữ liệu.
 */
export interface SingleFlight {
  isRunning: () => boolean
  run: <T>(fn: () => Promise<T>) => Promise<T>
  reset: () => void
}

export function createSingleFlight(name: string): SingleFlight {
  let inFlight: Promise<unknown> | null = null

  return {
    isRunning: () => inFlight !== null,
    run<T>(fn: () => Promise<T>): Promise<T> {
      if (inFlight) {
        return Promise.reject(
          new Error(`Thao tác "${name}" đang chạy, vui lòng đợi hoàn tất rồi thử lại.`)
        )
      }
      const p = Promise.resolve()
        .then(fn)
        .finally(() => {
          if (inFlight === p) inFlight = null
        })
      inFlight = p
      return p
    },
    reset: () => {
      inFlight = null
    }
  }
}
