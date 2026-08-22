import { useEffect, useRef } from 'react'

// Client-side idle timeout. Pairs with the server-side idle check on
// /auth/refresh — this gives an immediate, responsive logout in the UI;
// the backend enforces the same policy independently in case this is
// ever bypassed (dev tools, disabled JS, etc).
const IDLE_LIMIT_MS = 20 * 60 * 1000 // 20 minutes — keep in sync with backend REFRESH_IDLE_TIMEOUT_MINUTES
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']

export function useIdleLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const logout = () => {
      sessionStorage.clear()
      window.location.href = '/login'
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(logout, IDLE_LIMIT_MS)
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer))
    resetTimer()

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])
}
