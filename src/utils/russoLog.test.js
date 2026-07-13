import { afterEach, describe, expect, it, vi } from 'vitest'
import { russoBoot, russoLog, russoState } from './russoLog'

describe('russo diagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('boots without throwing', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})

    expect(() => russoBoot()).not.toThrow()
    expect(russoState.lastEvent).toBe('boot')
  })

  it('writes a scoped log line', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    russoLog('info', 'test', 'ok')

    expect(log).toHaveBeenCalledWith(expect.stringContaining('РУССО:test'))
  })
})
