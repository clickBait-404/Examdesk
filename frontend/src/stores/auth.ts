import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        // CHANGED: localStorage -> sessionStorage, so tokens don't
        // survive a closed browser.
        sessionStorage.setItem('access_token', accessToken)
        sessionStorage.setItem('refresh_token', refreshToken)
        set({ user, accessToken, refreshToken, isAuthenticated: true })
      },

      setUser: (user) => set({ user }),

      logout: () => {
        // CHANGED: localStorage -> sessionStorage
        sessionStorage.removeItem('access_token')
        sessionStorage.removeItem('refresh_token')
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'examdesk-auth',
      // CHANGED: this persist middleware defaults to localStorage for
      // the whole store (user, tokens, isAuthenticated) — that's a
      // second, separate place tokens/session were surviving browser
      // close, independent of the two direct calls above. Point it at
      // sessionStorage too so the entire persisted state clears with
      // the browser session.
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
