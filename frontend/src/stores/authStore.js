import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: async (username, password) => {
        const form = new URLSearchParams()
        form.append('username', username)
        form.append('password', password)
        const { data } = await api.post('/auth/token', form, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        set({ token: data.access_token, user: { username: data.username, role: data.role }, isAuthenticated: true })
      },

      signup: async (username, password, email) => {
        await api.post('/auth/signup', { username, password, email })
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false })
      },
    }),
    { name: 'smartquery-auth', partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
)
