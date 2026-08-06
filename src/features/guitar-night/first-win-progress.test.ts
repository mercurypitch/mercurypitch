// Guitar first-win progress tests protect local migration and best-attempt history.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_GUITAR_FIRST_WIN_CONFIG } from './first-win-config'
import { completeGuitarFirstWinProgress, GUITAR_FIRST_WIN_PROGRESS_KEY, readGuitarFirstWinProgress, recordGuitarFirstWinAttempt, skipGuitarFirstWinProgress, writeGuitarFirstWinProgress, } from './first-win-progress'

describe('Guitar first-win progress', () => {
  beforeEach(() => localStorage.clear())

  it('starts locally without requiring storage to exist', () => {
    const progress = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)

    expect(progress.status).toBe('not-started')
    expect(progress.currentStepId).toBe('open-low-e')
    expect(progress.tuningMidiHighToLow).toEqual([64, 59, 55, 50, 45, 40])
  })

  it('keeps attempt count and the closest timed hit', () => {
    const initial = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)
    const first = recordGuitarFirstWinAttempt(
      initial,
      'open-low-e',
      'touch',
      72,
    )
    const second = recordGuitarFirstWinAttempt(
      first,
      'open-low-e',
      'keyboard',
      31,
    )

    expect(second.status).toBe('in-progress')
    expect(second.attemptsByStep['open-low-e']).toBe(2)
    expect(second.bestAbsoluteTimingMsByStep['open-low-e']).toBe(31)
    expect(second.lastInputKind).toBe('keyboard')
  })

  it('restores valid progress and migrates removed steps to the first step', () => {
    const initial = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)
    writeGuitarFirstWinProgress({
      ...initial,
      configVersion: 'old-config',
      currentStepId: 'removed-step',
      status: 'in-progress',
    })

    const restored = readGuitarFirstWinProgress({
      ...DEFAULT_GUITAR_FIRST_WIN_CONFIG,
      configVersion: 'new-config',
    })

    expect(restored.configVersion).toBe('new-config')
    expect(restored.currentStepId).toBe('open-low-e')
    expect(restored.status).toBe('in-progress')
  })

  it('records completion and skip as explicit outcomes', () => {
    const initial = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)

    expect(completeGuitarFirstWinProgress(initial)).toMatchObject({
      status: 'completed',
      skippedAt: null,
    })
    expect(skipGuitarFirstWinProgress(initial)).toMatchObject({
      status: 'skipped',
    })
  })

  it('falls back safely when stored progress is malformed', () => {
    localStorage.setItem(GUITAR_FIRST_WIN_PROGRESS_KEY, '{bad json')

    expect(
      readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG).status,
    ).toBe('not-started')
  })
})
