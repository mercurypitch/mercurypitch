// ============================================================
// Chip follower — the chip's words against the engine they follow
// ============================================================
//
// Takes go through the real hold engine at a level, frame by frame, and
// the follower is fed as the room feeds it: the frame's events, then the
// frame. Each case reads the lines the chip put up.

import { describe, expect, it } from 'vitest'
import type { HoldPreset, HoldState } from '@/lib/hold/hold-engine'
import { createHoldState, LANTERN_LEVELS, tickHold, } from '@/lib/hold/hold-engine'
import type { TakeShape } from '@/lib/hold/test-takes'
import { takeCents } from '@/lib/hold/test-takes'
import { createChipFollower, STEADY_WORDS } from './chip-follower'
import type { LongNoteMoment } from './merc-lines'
import { STEADY_CLAIMS } from './merc-lines'

const DT = 1 / 60

interface Said {
  readonly moment: LongNoteMoment
  readonly state: HoldState
}

/** A take through the engine at `preset`, and each line the chip put up. */
function follow(shape: TakeShape, preset: HoldPreset): Said[] {
  const chips = createChipFollower()
  let state = createHoldState()
  const said: Said[] = []
  for (const offCents of takeCents(shape)) {
    state = tickHold(state, { offCents, level: 0.6, dt: DT }, preset)
    for (const event of state.events) chips.event(event, false)
    const moment = chips.follow(state, true, DT)
    if (moment !== null) said.push({ moment, state })
  }
  return said
}

/** A natural vibrato: +-40 cents at 5.5 Hz, a steadiness of about 44. */
const NATURAL: TakeShape = {
  seconds: 30,
  vibratoHz: 5.5,
  vibratoCents: 40,
  jitterCents: 2,
  seed: 3,
}

/** A near-straight tone, a steadiness in the 90s. */
const STRAIGHT: TakeShape = {
  seconds: 30,
  wanderCents: 2,
  wanderSeconds: 0.4,
  jitterCents: 2,
  seed: 4,
}

describe('the chip follower', () => {
  it("never calls a voice steady under STEADY_WORDS, however low the level's bar", () => {
    // Act: a natural vibrato at Beginner, whose bar (35) it clears: the
    // top fills to the brim.
    const said = follow(NATURAL, LANTERN_LEVELS.beginner)

    // Assert: the light rose all the way, and the chip never called it
    // steady.
    const last = said[said.length - 1]
    expect(last.state.brimReached).toBe(true)
    expect(last.state.steady).toBe(true)
    expect(last.state.steadiness).toBeLessThan(STEADY_WORDS)
    expect(said.some(({ moment }) => STEADY_CLAIMS.has(moment))).toBe(false)
    expect(said.map(({ moment }) => moment)).toContain('topFilling')
    expect(said.map(({ moment }) => moment)).toContain('brim')
  })

  it('calls a steady voice steady at every level, before the goal and while the top fills', () => {
    for (const level of ['beginner', 'singer', 'pro'] as const) {
      const said = follow(STRAIGHT, LANTERN_LEVELS[level])
      const moments = said.map(({ moment }) => moment)
      expect(moments).toContain('steady')
      expect(moments).toContain('topSteady')
      for (const { moment, state } of said) {
        if (STEADY_CLAIMS.has(moment)) {
          expect(state.steadiness).toBeGreaterThanOrEqual(STEADY_WORDS)
        }
      }
    }
  })

  it('says the top is filling while it fills, and that it needs a steadier note once it stops', () => {
    // Act: the same natural vibrato at Singer, whose bar (70) it is under:
    // the top fills about a third of the way, then waits.
    const said = follow(NATURAL, LANTERN_LEVELS.singer)

    // Assert: filling first, then stopped, and the chip says each while
    // it is so.
    const top = said.filter(({ moment }) =>
      ['topFilling', 'topSteady', 'topStalled'].includes(moment),
    )
    expect(top.map(({ moment }) => moment)).toEqual([
      'topFilling',
      'topStalled',
    ])
    expect(top[0].state.reach).toBeGreaterThan(top[0].state.topCharge)
    // Stopped: no room left at this steadiness (it may have slipped under
    // the fill, which never drains), with part of the top filled.
    expect(top[1].state.reach).toBeLessThanOrEqual(
      top[1].state.topCharge + 1e-6,
    )
    expect(top[1].state.topCharge).toBeGreaterThan(0.2)
    expect(said[said.length - 1].state.brimReached).toBe(false)
  })
})
