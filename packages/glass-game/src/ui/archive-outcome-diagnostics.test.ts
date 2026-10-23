// Archive diagnostic boundary — authored IDs are bounded and ordinary builds stay silent.
import { afterEach, expect, it, vi } from 'vitest'
import { reportArchiveOutcome } from './archive-outcome-diagnostics'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it.each(['awaken', 'protection'] as const)(
  'records %s without retaining an input object',
  (outcome) => {
    vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      hasFocus: () => false,
    })
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    reportArchiveOutcome('a'.repeat(150), 'b'.repeat(150), outcome)
    expect(info).toHaveBeenCalledExactlyOnceWith(
      '[Glassworks Archive outcome]',
      {
        levelId: 'a'.repeat(100),
        itemId: 'b'.repeat(100),
        outcome,
        at: expect.any(Number),
        elapsedMs: expect.any(Number),
        visibility: 'visible',
        focused: false,
      },
    )
  },
)

it('does not touch browser globals or log outside portable builds', () => {
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'false')
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  reportArchiveOutcome('archive', 'note', 'awaken')
  expect(info).not.toHaveBeenCalled()
})
