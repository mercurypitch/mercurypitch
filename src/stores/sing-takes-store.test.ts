import { beforeEach, describe, expect, it } from 'vitest'
import type { SingTake } from './sing-takes-store'
import { clearSingTakes, keepSingTake, lastSingTake, SING_TAKES_KEPT, singTakes, } from './sing-takes-store'

function take(overrides: Partial<SingTake> = {}): SingTake {
  return {
    id: 'take-1',
    startedAt: 1_756_000_000_000,
    endedAt: 1_756_000_180_000,
    durationMs: 180_000,
    takeNumber: 1,
    lowNote: 'D3',
    highNote: 'A4',
    heldWithinCents: 12,
    ...overrides,
  }
}

describe('sing takes', () => {
  beforeEach(() => {
    clearSingTakes()
  })

  it('has nothing to compare against before a first keep', () => {
    expect(lastSingTake()).toBeNull()
    expect(singTakes()).toEqual([])
  })

  it('keeps a summary and hands the newest one back', () => {
    keepSingTake(take())
    keepSingTake(take({ id: 'take-2', takeNumber: 2, heldWithinCents: 9 }))
    expect(singTakes()).toHaveLength(2)
    expect(lastSingTake()?.id).toBe('take-2')
    expect(lastSingTake()?.heldWithinCents).toBe(9)
  })

  it('stores nothing but the summary — no audio, no frames', () => {
    keepSingTake(take())
    expect(Object.keys(lastSingTake()!).sort()).toEqual([
      'durationMs',
      'endedAt',
      'heldWithinCents',
      'highNote',
      'id',
      'lowNote',
      'startedAt',
      'takeNumber',
    ])
  })

  it('survives a take with no range rather than refusing it', () => {
    keepSingTake(take({ lowNote: null, highNote: null }))
    expect(lastSingTake()?.lowNote).toBeNull()
  })

  it('drops the oldest once the cap is reached', () => {
    for (let i = 0; i < SING_TAKES_KEPT + 5; i++) {
      keepSingTake(take({ id: `take-${i}`, takeNumber: i }))
    }
    expect(singTakes()).toHaveLength(SING_TAKES_KEPT)
    expect(singTakes()[0].id).toBe('take-5')
    expect(lastSingTake()?.id).toBe(`take-${SING_TAKES_KEPT + 4}`)
  })

  it('writes through to storage, so the next launch still compares', () => {
    keepSingTake(take())
    const raw = localStorage.getItem('pitchperfect_sing_takes')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toHaveLength(1)
  })
})
