import { describe, it, expect } from 'vitest'
import { tools, findTool } from '../src/config/tools'

describe('Tools Registry Suite', () => {
  it('contains exactly 18 tools', () => {
    expect(tools.length).toBe(18)
  })

  it('every tool has a valid id, name, description, and category', () => {
    for (const tool of tools) {
      expect(tool.id).toBeTruthy()
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(['Organize', 'Create', 'Edit', 'Convert', 'Secure']).toContain(tool.category)
      expect(['browser', 'server']).toContain(tool.availability)
    }
  })

  it('findTool returns the correct tool definition', () => {
    const merge = findTool('merge-pdf')
    expect(merge?.name).toBe('Merge PDF')
    expect(merge?.category).toBe('Organize')

    const unknown = findTool('non-existent-tool')
    expect(unknown).toBeUndefined()
  })

  it('all 18 tools are available for client-side on-device execution', () => {
    for (const tool of tools) {
      expect(tool.availability).toBe('browser')
    }
  })
})
