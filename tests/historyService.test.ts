import { describe, it, expect, beforeEach } from 'vitest'
import { historyService } from '../src/services/historyService'

describe('historyService Audit Trail Suite', () => {
  beforeEach(() => {
    historyService.clearHistory()
  })

  it('starts with an empty history list', () => {
    expect(historyService.getEntries()).toEqual([])
  })

  it('adds and retrieves audit trail entries accurately', () => {
    const entry = historyService.addEntry({
      toolId: 'protect-pdf',
      toolName: 'Protect PDF',
      fileName: 'confidential.pdf',
      outputName: 'confidential-protected.pdf',
      inputBytes: 10240,
      outputBytes: 11050,
      pageCount: 3,
      mimeType: 'application/pdf',
    })

    expect(entry.id).toBeDefined()
    expect(entry.timestamp).toBeGreaterThan(0)
    expect(entry.fileName).toBe('confidential.pdf')

    const entries = historyService.getEntries()
    expect(entries.length).toBe(1)
    expect(entries[0].toolName).toBe('Protect PDF')
  })

  it('deletes individual entries by id', () => {
    const entry1 = historyService.addEntry({
      toolId: 'merge-pdf',
      toolName: 'Merge PDF',
      fileName: 'a.pdf',
      outputName: 'merged.pdf',
      inputBytes: 100,
      outputBytes: 200,
      mimeType: 'application/pdf',
    })
    const entry2 = historyService.addEntry({
      toolId: 'split-pdf',
      toolName: 'Split PDF',
      fileName: 'b.pdf',
      outputName: 'split.pdf',
      inputBytes: 100,
      outputBytes: 200,
      mimeType: 'application/pdf',
    })

    expect(historyService.getEntries().length).toBe(2)
    historyService.deleteEntry(entry1.id)
    const remaining = historyService.getEntries()
    expect(remaining.length).toBe(1)
    expect(remaining[0].id).toBe(entry2.id)
  })

  it('clears all history on clearHistory()', () => {
    historyService.addEntry({
      toolId: 'compress-pdf',
      toolName: 'Compress PDF',
      fileName: 'report.pdf',
      outputName: 'report-compressed.pdf',
      inputBytes: 50000,
      outputBytes: 32000,
      mimeType: 'application/pdf',
    })
    expect(historyService.getEntries().length).toBe(1)
    historyService.clearHistory()
    expect(historyService.getEntries().length).toBe(0)
  })
})
