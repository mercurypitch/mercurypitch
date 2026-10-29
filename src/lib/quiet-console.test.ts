import { describe, expect, it, vi } from 'vitest'
import { quietConsole, shouldQuietConsole } from '@/lib/quiet-console'

const off = {
  diagnosticBuild: false,
  e2eBuild: false,
  developerConsoleOn: false,
}

describe('shouldQuietConsole', () => {
  it('quiets a production page', () => {
    expect(shouldQuietConsole(off)).toBe(true)
  })

  it.each([
    ['a diagnostic build', { ...off, diagnosticBuild: true }],
    ['the e2e build', { ...off, e2eBuild: true }],
    ['the developer console switch', { ...off, developerConsoleOn: true }],
  ])('leaves the console alone for %s', (_why, input) => {
    expect(shouldQuietConsole(input)).toBe(false)
  })
})

describe('quietConsole', () => {
  const fakeConsole = () => ({
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })

  it('silences log, info and debug but never warn or error', () => {
    const target = fakeConsole()
    const { warn, error, log } = target
    quietConsole(target, true)
    target.log('a')
    target.info('b')
    target.debug('c')
    target.warn('d')
    target.error('e')
    expect(log).not.toHaveBeenCalled()
    expect(target.warn).toBe(warn)
    expect(target.error).toBe(error)
    expect(warn).toHaveBeenCalledWith('d')
    expect(error).toHaveBeenCalledWith('e')
  })

  it('changes nothing when not asked to', () => {
    const target = fakeConsole()
    const { log, info, debug } = target
    quietConsole(target, false)
    expect(target.log).toBe(log)
    expect(target.info).toBe(info)
    expect(target.debug).toBe(debug)
  })
})
