export interface DocumentHistoryEntry {
  id: string
  toolId: string
  toolName: string
  fileName: string
  outputName: string
  timestamp: number
  inputBytes: number
  outputBytes: number
  pageCount?: number
  mimeType: string
}

const HISTORY_KEY = 'ktf_document_history'
const MAX_HISTORY_ITEMS = 100

export const historyService = {
  getEntries: (): DocumentHistoryEntry[] => {
    try {
      if (typeof localStorage === 'undefined') return []
      const raw = localStorage.getItem(HISTORY_KEY)
      if (!raw) return []
      return JSON.parse(raw) as DocumentHistoryEntry[]
    } catch {
      return []
    }
  },

  addEntry: (entry: Omit<DocumentHistoryEntry, 'id' | 'timestamp'>): DocumentHistoryEntry => {
    const fullEntry: DocumentHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    }
    try {
      const existing = historyService.getEntries()
      const updated = [fullEntry, ...existing].slice(0, MAX_HISTORY_ITEMS)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn('Could not save document history entry:', e)
    }
    return fullEntry
  },

  clearHistory: (): void => {
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch (e) {
      console.warn('Could not clear history:', e)
    }
  },

  deleteEntry: (id: string): void => {
    try {
      const existing = historyService.getEntries()
      const updated = existing.filter((item) => item.id !== id)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn('Could not delete history entry:', e)
    }
  },
}
