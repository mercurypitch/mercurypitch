// Guitar first-win progress tests protect local migration and step history.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_GUITAR_FIRST_WIN_CONFIG } from './first-win-config'
import { completeGuitarFirstWinStep, GUITAR_FIRST_WIN_PROGRESS_KEY, readGuitarFirstWinProgress, recordGuitarFirstWinAttempt, skipGuitarFirstWinProgress, writeGuitarFirstWinProgress, } from './first-win-progress'

describe('Guitar first-win progress', () => {
  beforeEach(() => localStorage.clear())

  it('starts locally without requiring storage to exist', () => {
    const progress = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)

    expect(progress.status).toBe('not-started')
    expect(progress.currentStepId).toBe('open-low-e')
    expect(progress.completedStepIds).toEqual([])
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

  it('advances through configured steps and completes only the final step', () => {
    const initial = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)
    const afterOpenString = completeGuitarFirstWinStep(
      initial,
      DEFAULT_GUITAR_FIRST_WIN_CONFIG,
      'open-low-e',
    )
    const afterTab = completeGuitarFirstWinStep(
      afterOpenString,
      DEFAULT_GUITAR_FIRST_WIN_CONFIG,
      'first-one-string-tab',
    )

    expect(afterOpenString).toMatchObject({
      status: 'in-progress',
      currentStepId: 'first-one-string-tab',
      completedStepIds: ['open-low-e'],
      completedAt: null,
    })
    expect(afterTab.status).toBe('completed')
    expect(afterTab.completedStepIds).toEqual([
      'open-low-e',
      'first-one-string-tab',
    ])
    expect(afterTab.completedAt).not.toBeNull()
  })

  it('migrates a legacy completed first bar into the new second step', () => {
    localStorage.setItem(
      GUITAR_FIRST_WIN_PROGRESS_KEY,
      JSON.stringify({
        schemaVersion: 1,
        flowVersion: 'first-win-v1',
        configVersion: '2026.08.1',
        status: 'completed',
        currentStepId: 'open-low-e',
        attemptsByStep: { 'open-low-e': 4 },
        bestAbsoluteTimingMsByStep: {},
        lastInputKind: 'touch',
        tuningMidiHighToLow: [64, 59, 55, 50, 45, 40],
        handedness: null,
        tabFamiliarity: null,
        completedAt: '2026-08-01T10:00:00.000Z',
        skippedAt: null,
      }),
    )

    const restored = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)

    expect(restored.status).toBe('in-progress')
    expect(restored.currentStepId).toBe('first-one-string-tab')
    expect(restored.completedStepIds).toEqual(['open-low-e'])
    expect(restored.completedAt).toBeNull()
  })

  it('restores valid progress and migrates removed steps to the first incomplete step', () => {
    const initial = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)
    writeGuitarFirstWinProgress({
      ...initial,
      configVersion: 'old-config',
      currentStepId: 'removed-step',
      completedStepIds: ['removed-step'],
      status: 'in-progress',
    })

    const restored = readGuitarFirstWinProgress({
      ...DEFAULT_GUITAR_FIRST_WIN_CONFIG,
      configVersion: 'new-config',
    })

    expect(restored.configVersion).toBe('new-config')
    expect(restored.currentStepId).toBe('open-low-e')
    expect(restored.completedStepIds).toEqual([])
    expect(restored.status).toBe('in-progress')
  })

  it('normalizes malformed persisted fields without trusting the raw record', () => {
    localStorage.setItem(
      GUITAR_FIRST_WIN_PROGRESS_KEY,
      JSON.stringify({
        schemaVersion: 1,
        flowVersion: 'first-win-v1',
        status: 'in-progress',
        currentStepId: 'open-low-e',
        completedStepIds: ['unknown'],
        attemptsByStep: { 'open-low-e': -2, bad: 'many' },
        bestAbsoluteTimingMsByStep: { 'open-low-e': Number.POSITIVE_INFINITY },
        lastInputKind: 'camera',
        tuningMidiHighToLow: [1, 2, 3],
        handedness: 'upside-down',
        tabFamiliarity: 'expert',
        completedAt: 'never',
        skippedAt: 4,
      }),
    )

    const restored = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)
    expect(restored.completedStepIds).toEqual([])
    expect(restored.attemptsByStep).toEqual({})
    expect(restored.bestAbsoluteTimingMsByStep).toEqual({})
    expect(restored.lastInputKind).toBeNull()
    expect(restored.tuningMidiHighToLow).toEqual([64, 59, 55, 50, 45, 40])
    expect(restored.handedness).toBeNull()
    expect(restored.tabFamiliarity).toBeNull()
    expect(restored.completedAt).toBeNull()
    expect(restored.skippedAt).toBeNull()
  })

  it('records skip as an explicit outcome', () => {
    const initial = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)

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
