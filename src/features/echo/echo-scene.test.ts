// ============================================================
// Echo's scene: the picture agrees with the numbers
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LandedNote, MissedNote, NoteOutcome, Phrase, } from '@/lib/sequence/sequence-engine'
import { STAR_WIDTH_W } from './echo-geometry'
import type { DonePhrase, LivePhrase } from './echo-scene'
import { echoScene, keepSame, RING_W } from './echo-scene'
import { FINISHED_SLOTS, phrasePlaces, phraseStarW, RESULT_BOXES, } from './sky-layout'

const phrase = (...midis: number[]): Phrase => ({
  notes: midis.map((midi, i) => ({ midi, at: i * 0.9, seconds: 0.9 })),
})

const landed = (index: number): LandedNote => ({
  index,
  landed: true,
  cents: 0,
  onset: index,
  landedAt: index + 0.3,
  timeToLandMs: 300,
})

const missed = (index: number): MissedNote => ({
  index,
  landed: false,
  missedAt: index + 4,
  cause: 'deadline',
  voiced: false,
  closest: null,
})

const C_E_G = phrase(60, 64, 67)

const live = (over: Partial<LivePhrase>): LivePhrase => ({
  index: 0,
  phrase: C_E_G,
  stage: 'response',
  outcomes: [],
  listening: 0,
  ...over,
})

const sceneOf = (
  liveOver: Partial<LivePhrase> | null,
  done: readonly DonePhrase[] = [],
  result = false,
) =>
  echoScene({
    run: 1,
    live: liveOver === null ? null : live(liveOver),
    done,
    result,
    celebration: true,
  })

describe('the phrase being sung', () => {
  it('shows a waiting ring at each note in the call, fading in on its onset', () => {
    const scene = sceneOf({
      stage: 'call',
      listening: null,
      appearMs: [350, 1250, 2150],
    })
    const places = phrasePlaces([60, 64, 67])

    expect(scene.rings.map((r) => [r.u, r.v, r.style, r.appearMs])).toEqual(
      places.map((p, i) => [p.u, p.v, 'waiting', [350, 1250, 2150][i]]),
    )
    expect(scene.rings.every((r) => r.rW === RING_W.waiting)).toBe(true)
    expect(scene.stars).toEqual([])
  })

  it('draws the note listened for larger, and nothing fades in once the call is over', () => {
    const scene = sceneOf({ outcomes: [landed(0)], listening: 1 })

    expect(scene.rings.map((r) => [r.style, r.rW])).toEqual([
      ['active', RING_W.active],
      ['waiting', RING_W.waiting],
    ])
    expect(scene.rings.some((r) => r.appearMs !== undefined)).toBe(false)
  })

  it('lights a star for each landed note and joins only neighbours that both landed', () => {
    const scene = sceneOf({
      phrase: phrase(60, 62, 64, 65),
      outcomes: [landed(0), landed(1), missed(2), landed(3)],
      stage: 'done',
      listening: null,
    })
    const places = phrasePlaces([60, 62, 64, 65])

    expect(scene.stars.map((s) => [s.u, s.v])).toEqual(
      [0, 1, 3].map((i) => [places[i].u, places[i].v]),
    )
    expect(scene.stars.every((s) => s.size === 'phrase')).toBe(true)
    expect(scene.stars[0].widthW).toBe(phraseStarW(4, STAR_WIDTH_W.phrase))
    // The miss breaks the chain: 0 to 1 only.
    expect(scene.lines.map((l) => [l.a, l.b])).toEqual([
      [
        [places[0].u, places[0].v],
        [places[1].u, places[1].v],
      ],
    ])
  })

  it('keeps a missed ring as it is during the response, and dims it when the phrase is over', () => {
    const during = sceneOf({ outcomes: [missed(0)], listening: 1 })
    expect(during.rings[0].style).toBe('waiting')

    const after = sceneOf({
      outcomes: [missed(0), landed(1), landed(2)],
      stage: 'done',
      listening: null,
    })
    expect(after.rings.map((r) => r.style)).toEqual(['missed'])
  })
})

describe('the phrases done', () => {
  const done: DonePhrase[] = [
    { phrase: C_E_G, outcomes: [landed(0), landed(1), landed(2)] },
    { phrase: phrase(62, 65, 69), outcomes: [landed(0), missed(1), landed(2)] },
  ]

  it('shrinks each into its slot in the top band: lit stars and their lines, nothing for a miss', () => {
    const scene = sceneOf(null, done)
    const finished = scene.stars.filter((s) => s.size === 'finished')

    expect(finished).toHaveLength(5)
    expect(finished.every((s) => s.widthW === STAR_WIDTH_W.finished)).toBe(true)
    for (const [i, slot] of FINISHED_SLOTS.slice(0, 2).entries()) {
      const mine = finished.filter((s) => s.key.startsWith(`f${i}-`))
      for (const s of mine) {
        expect(s.u).toBeGreaterThanOrEqual(slot.u0 - 1e-9)
        expect(s.u).toBeLessThanOrEqual(slot.u1 + 1e-9)
      }
    }
    expect(scene.rings).toEqual([])
    expect(scene.lines.map((l) => l.style)).toEqual(['finished', 'finished'])
  })

  it("keeps each note's tint from the phrase to the top band", () => {
    const sung = sceneOf({
      outcomes: [landed(0), landed(1), landed(2)],
      stage: 'done',
      listening: null,
    })
    const moved = sceneOf(null, [done[0]])

    expect(moved.stars.map((s) => [s.tint, s.mix])).toEqual(
      sung.stars.map((s) => [s.tint, s.mix]),
    )
  })

  it('puts all of them at the result places at the result, with a small dark ring per miss', () => {
    const scene = sceneOf(null, done, true)

    expect(scene.result).toBe(true)
    expect(scene.celebration).toBe(true)
    expect(scene.stars.every((s) => s.size === 'result')).toBe(true)
    expect(scene.stars).toHaveLength(5)
    expect(scene.rings.map((r) => [r.style, r.rW])).toEqual([
      ['missed', RING_W.missed],
    ])
    const box = RESULT_BOXES[1]
    const ring = scene.rings[0]
    expect(ring.u).toBeGreaterThanOrEqual(box.u0 - 1e-9)
    expect(ring.u).toBeLessThanOrEqual(box.u1 + 1e-9)
    expect(scene.lines.map((l) => l.style)).toEqual(['result', 'result'])
  })

  it('draws no live phrase over the result, and no celebration outside it', () => {
    const atResult = sceneOf({ stage: 'done', listening: null }, done, true)
    expect(atResult.stars.some((s) => s.size === 'phrase')).toBe(false)

    expect(sceneOf(null, done).celebration).toBe(false)
  })
})

describe("the Warm-up's three phrases", () => {
  const three: DonePhrase[] = [
    { phrase: C_E_G, outcomes: [landed(0), landed(1), landed(2)] },
    { phrase: phrase(62, 65, 69), outcomes: [landed(0), landed(1), landed(2)] },
    { phrase: phrase(64, 67, 71), outcomes: [landed(0), landed(1), landed(2)] },
  ]
  const threeOf = (result: boolean) =>
    echoScene({
      run: 1,
      live: null,
      done: three,
      result,
      celebration: false,
      phrases: 3,
    })
  /** The place each of the first `count` phrases' stars sit in. */
  const slotsOf = (
    stars: readonly { key: string; u: number; v: number }[],
    slots: readonly { u0: number; u1: number; v0: number; v1: number }[],
    count: number,
  ): number[] =>
    Array.from({ length: count }, (_, i) => {
      const mine = stars.filter((s) => s.key.slice(1).startsWith(`${i}-`))
      return slots.findIndex((slot) =>
        mine.every(
          (s) =>
            s.u >= slot.u0 - 1e-9 &&
            s.u <= slot.u1 + 1e-9 &&
            s.v >= slot.v0 - 1e-9 &&
            s.v <= slot.v1 + 1e-9,
        ),
      )
    })

  it('spread over the first, third and fifth places at the result', () => {
    expect(slotsOf(threeOf(true).stars, RESULT_BOXES, 3)).toEqual([0, 2, 4])
  })

  it('wait in the top band where a full run waits: top left, then top right', () => {
    const band = echoScene({
      run: 1,
      live: null,
      done: three.slice(0, 2),
      result: false,
      celebration: false,
      phrases: 3,
    })
    expect(slotsOf(band.stars, FINISHED_SLOTS, 2)).toEqual([0, 1])
  })

  it('keeps a full run in its places, one after another', () => {
    const five = echoScene({
      run: 1,
      live: null,
      done: [...three, ...three.slice(0, 2)],
      result: true,
      celebration: false,
      phrases: 5,
    })
    const mine = (i: number) =>
      five.stars.filter((s) => s.key.startsWith(`r${i}-`))
    for (const [i, box] of RESULT_BOXES.entries()) {
      for (const s of mine(i)) {
        expect(s.u).toBeGreaterThanOrEqual(box.u0 - 1e-9)
        expect(s.u).toBeLessThanOrEqual(box.u1 + 1e-9)
      }
    }
  })
})

describe('keeping what did not change', () => {
  it('hands back the very objects of items that did not change', () => {
    const first = sceneOf({ outcomes: [landed(0)], listening: 1 })
    const next = keepSame(
      first,
      sceneOf({ outcomes: [landed(0), landed(1)], listening: 2 }),
    )

    expect(next.stars[0]).toBe(first.stars[0])
    expect(next.stars).toHaveLength(2)
    expect(next.stars[1]).not.toBe(first.stars[0])
    // The ring listened for moved on: both rings changed.
    expect(next.rings).toHaveLength(1)
    expect(next.rings[0]).not.toBe(first.rings[1])
  })

  it('keeps lines whose ends did not move', () => {
    const outcomes: NoteOutcome[] = [landed(0), landed(1)]
    const first = sceneOf({ outcomes, listening: 2 })
    const again = keepSame(first, sceneOf({ outcomes, listening: 2 }))

    expect(again.lines[0]).toBe(first.lines[0])
    expect(again.rings[0]).toBe(first.rings[0])
  })
})
