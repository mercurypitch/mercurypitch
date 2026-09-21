// Conservatory course tests — authored connectivity, capture lessons and optional-free traversal.

import { describe, expect, it } from 'vitest'
import { composeLevel } from '../authoring/compose-level'
import { LevelAuthoringError } from '../authoring/contracts'
import type { GlassGame } from '../contracts'
import { createGlassGame } from '../core/game'
import { CONSERVATORY_AUTHORING_CATALOG } from './conservatory-kit'
import { CONSERVATORY_ROUTE, CONSERVATORY_SOURCE, RESONANCE_CONSERVATORY, } from './resonance-conservatory'

const idle = { moveX: 0, moveZ: 0, jumpDown: false }
const prefix = 'glassworks-resonance-conservatory/resonance-conservatory'
const encounter = (room: string, id: string) =>
  `${prefix}/${room}/encounter/${id}`

function rest(game: GlassGame) {
  for (let i = 0; i < 100; i++) game.step(idle, 1 / 60)
}

function walk(game: GlassGame, axis: 'x' | 'z', destination: number) {
  const direction = Math.sign(
    destination - game.snapshot().player.position[axis],
  )
  for (
    let i = 0;
    i < 6000 &&
    direction * (destination - game.snapshot().player.position[axis]) > 0;
    i++
  ) {
    const events = game.step(
      {
        ...idle,
        moveX: axis === 'x' ? direction : 0,
        moveZ: axis === 'z' ? direction : 0,
      },
      1 / 60,
    )
    expect(events.some((event) => event.type === 'respawn')).toBe(false)
    if (game.snapshot().complete) break
  }
  if (!game.snapshot().complete)
    expect(
      direction * (destination - game.snapshot().player.position[axis]),
    ).toBeLessThanOrEqual(0)
  rest(game)
}

function beginnerWaveCents(seconds: number): number {
  const anchors = [
    [0, 0],
    [0.35, 200],
    [0.7, 0],
    [1.05, -200],
    [1.4, 0],
    [1.75, 200],
    [2.1, 0],
    [2.45, -200],
    [2.8, 0],
  ] as const
  const after = anchors.findIndex(([at]) => at >= seconds)
  if (after <= 0) return anchors[Math.max(0, after)]?.[1] ?? 0
  const [fromTime, fromCents] = anchors[after - 1]
  const [toTime, toCents] = anchors[after]
  const mix = (seconds - fromTime) / (toTime - fromTime)
  return fromCents + (toCents - fromCents) * mix
}

function sing(game: GlassGame, room: string, localId: string) {
  const id = encounter(room, localId)
  const exhibit = RESONANCE_CONSERVATORY.breakables.find(
    (item) => item.id === id,
  )!
  expect(game.snapshot().nearbyBreakableId).toBe(id)
  expect(game.beginEncounter(id, 57)).toBe(true)
  let completed = false
  const holdEnd = exhibit.challenge.kind === 'settle-wave' ? 0.9 : 1.3
  for (let i = 0; i < 200; i++) {
    const t = i * 0.025
    const waveSample = Math.round((t - holdEnd) / 0.025)
    const midi =
      t <= holdEnd
        ? 57
        : waveSample === 52 || waveSample === 53
          ? null
          : 57 + beginnerWaveCents(t - holdEnd) / 100
    const events = game.feedPitch(
      {
        sequence: i,
        captureSeconds: t,
        capturedAtMs: t * 1000,
        midi,
        confidence: midi === null ? 0 : 0.9,
      },
      t * 1000,
    )
    if (events.some((event) => event.type === 'break')) {
      completed = true
      break
    }
  }
  expect(completed).toBe(true)
  rest(game)
}

describe('Resonance Conservatory', () => {
  it('has independent identity, four required teaching encounters and three optional finds', () => {
    expect(RESONANCE_CONSERVATORY.id).toBe(prefix)
    expect(RESONANCE_CONSERVATORY.authored?.contentRevision).toBe(2)
    expect(
      RESONANCE_CONSERVATORY.breakables
        .filter((item) => !item.optional)
        .map((item) => item.challenge.kind),
    ).toEqual(['hold', 'settle-wave', 'settle-wave', 'settle-wave'])
    expect(
      RESONANCE_CONSERVATORY.breakables.filter((item) => item.optional),
    ).toHaveLength(3)
    expect(RESONANCE_CONSERVATORY.presentation?.rooms).toHaveLength(18)
  })
  it('rejects an undefined wave parameter instead of silently accepting unfinishable content', () => {
    const source = structuredClone(CONSERVATORY_SOURCE)
    const firstWave = source.exhibits.find(
      (item) => item.challenge.kind === 'settle-wave',
    )!
    if (firstWave.challenge.kind !== 'settle-wave')
      throw new Error('Missing wave fixture')
    firstWave.challenge.wave.smoothingSeconds = undefined as unknown as number
    expect(() => composeLevel(source, CONSERVATORY_AUTHORING_CATALOG)).toThrow(
      LevelAuthoringError,
    )
  })
  it('walks the complete garden route without jumping or completing optional exhibits', () => {
    const game = createGlassGame(RESONANCE_CONSERVATORY)
    rest(game)
    walk(game, 'z', -0.05)
    sing(game, 'foyer', 'entrance-goblet')
    // Pass beside the centre plinth before returning to the corridor centre.
    walk(game, 'x', 0.9)
    walk(game, 'z', 2.4)
    walk(game, 'x', 0)
    walk(game, 'z', CONSERVATORY_ROUTE.fern.z - 0.05)
    sing(game, 'fern-house', 'fern-wave')
    walk(game, 'x', 0.9)
    walk(game, 'z', CONSERVATORY_ROUTE.fern.z + 2.4)
    walk(game, 'x', 0)
    walk(game, 'z', CONSERVATORY_ROUTE.court.z)
    walk(game, 'x', CONSERVATORY_ROUTE.orchid.x)
    walk(game, 'z', CONSERVATORY_ROUTE.orchid.z - 0.05)
    sing(game, 'orchid-house', 'orchid-wave')
    walk(game, 'x', CONSERVATORY_ROUTE.orchid.x + 0.9)
    walk(game, 'z', CONSERVATORY_ROUTE.orchid.z + 2.4)
    walk(game, 'x', CONSERVATORY_ROUTE.orchid.x)
    walk(game, 'z', CONSERVATORY_ROUTE.salon.z)
    walk(game, 'x', CONSERVATORY_ROUTE.salon.x + 0.05)
    sing(game, 'wave-salon', 'keeper-finale')
    walk(game, 'z', CONSERVATORY_ROUTE.salon.z + 0.9)
    walk(game, 'x', CONSERVATORY_ROUTE.salon.x - 2.4)
    walk(game, 'z', CONSERVATORY_ROUTE.salon.z)
    walk(game, 'x', CONSERVATORY_ROUTE.panorama.x)
    const exit = RESONANCE_CONSERVATORY.exit
    walk(game, 'x', exit.minX - 0.25)
    expect(game.snapshot().complete).toBe(true)
    expect(game.snapshot().completedBreakableIds).toHaveLength(4)
    const restored = createGlassGame(
      RESONANCE_CONSERVATORY,
      game.saveProgress(),
    )
    expect(restored.snapshot().completedBreakableIds).toHaveLength(4)
    expect(restored.saveProgress().finished).toBe(true)
  })
})
