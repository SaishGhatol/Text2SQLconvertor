import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useQueryStore = create(
  persist(
    (set, get) => ({
      // DB connection
      connected: false,
      dbType: null,
      activeProfileId: null,
      schemaText: '',
      schemaTree: {},
      schemaProfile: null,
      suggestedQuestions: [],

      // Chat conversation
      messages: [], // { role: 'user'|'assistant', content, sql, rows, columns, explanation, insights, meta }

      // Saved query workspace
      savedQueries: [],

      // UI state
      loading: false,
      activeTab: 'chat', // 'chat' | 'history' | 'analytics' | 'schema'

      setConnected: (dbType, schemaText, schemaTree, schemaProfile = null, suggestedQuestions = [], activeProfileId = null) =>
        set({ connected: true, dbType, activeProfileId, schemaText, schemaTree, schemaProfile, suggestedQuestions }),

      disconnect: () =>
        set({
          connected: false,
          dbType: null,
          activeProfileId: null,
          schemaText: '',
          schemaTree: {},
          schemaProfile: null,
          suggestedQuestions: [],
          messages: [],
        }),

      addMessage: (msg) =>
        set((s) => ({ messages: [...s.messages, msg] })),

      saveQuery: ({ name, question, sql }) =>
        set((state) => {
          const normalizedSql = (sql || '').trim()
          const normalizedQuestion = (question || '').trim()
          if (!normalizedSql) return state

          const existing = state.savedQueries.find((item) => item.sql.trim() === normalizedSql)
          if (existing) {
            return {
              savedQueries: state.savedQueries.map((item) =>
                item.id === existing.id
                  ? {
                      ...item,
                      name: (name || item.name || normalizedQuestion || 'Saved Query').trim(),
                      question: normalizedQuestion || item.question,
                      updatedAt: new Date().toISOString(),
                    }
                  : item
              ),
            }
          }

          const next = {
            id: crypto.randomUUID(),
            name: (name || normalizedQuestion || 'Saved Query').trim(),
            question: normalizedQuestion,
            sql: normalizedSql,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastRunAt: null,
          }

          return { savedQueries: [next, ...state.savedQueries].slice(0, 30) }
        }),

      removeSavedQuery: (id) =>
        set((state) => ({ savedQueries: state.savedQueries.filter((item) => item.id !== id) })),

      markSavedQueryRun: (id) =>
        set((state) => ({
          savedQueries: state.savedQueries.map((item) =>
            item.id === id ? { ...item, lastRunAt: new Date().toISOString() } : item
          ),
        })),

      setLoading: (v) => set({ loading: v }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      clearChat: () => set({ messages: [] }),
    }),
    {
      name: 'smartquery-workspace',
      partialize: (state) => ({ savedQueries: state.savedQueries }),
    }
  )
)
