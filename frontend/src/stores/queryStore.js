import { create } from 'zustand'

export const useQueryStore = create((set, get) => ({
  // DB connection
  connected: false,
  dbType: null,
  schemaText: '',
  schemaTree: {},
  schemaProfile: null,
  suggestedQuestions: [],

  // Chat conversation
  messages: [],    // { role: 'user'|'assistant', content, sql, rows, columns, explanation, insights, meta }

  // UI state
  loading: false,
  activeTab: 'chat',  // 'chat' | 'history' | 'analytics' | 'schema'

  setConnected: (dbType, schemaText, schemaTree, schemaProfile = null, suggestedQuestions = []) =>
    set({ connected: true, dbType, schemaText, schemaTree, schemaProfile, suggestedQuestions }),

  disconnect: () =>
    set({
      connected: false,
      dbType: null,
      schemaText: '',
      schemaTree: {},
      schemaProfile: null,
      suggestedQuestions: [],
      messages: [],
    }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  setLoading: (v) => set({ loading: v }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  clearChat: () => set({ messages: [] }),
}))
