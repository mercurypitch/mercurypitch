// ============================================================
// Prepared Drum Night groove tests — canonical first-play material
// ============================================================

import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { DrumKitPlayerPort } from '../runtime/drum-runtime-types'
import type { DrumRuntimeClock } from '../runtime/drum-transport'
import { createDrumTransport } from '../runtime/drum-transport'
import type { DrumSessionImportSourceFormat, DrumSessionSourceFormat, } from './drum-session'
import { createDrumSessionScheduler } from './drum-session-scheduler'
import { createFirstPocketGroove, FIRST_POCKET_DEFAULT_VARIANT, FIRST_POCKET_VARIANTS, isFirstPocketVariantId, } from './prepared-grooves'

class FixedClock implements DrumRuntimeClock {
  nowMs = (): number => 0
  requestFrame = (): number => 1
  cancelFrame = (): void => undefined
}

describe('prepared Drum Night grooves', () => {
  it('publishes four deterministic variants with Classic as the default', () => {
    expect(FIRST_POCKET_DEFAULT_VARIANT).toBe('source')
    expect(FIRST_POCKET_VARIANTS.map((variant) => variant.id)).toEqual([
      'source',
      'tight',
      'loose',
      'half-time',
    ])
    expect(FIRST_POCKET_VARIANTS.map((variant) => variant.label)).toEqual([
      'Classic',
      'Funk',
      'Driving',
      'Half-time',
    ])
    expect(isFirstPocketVariantId('half-time')).toBe(true)
    expect(isFirstPocketVariantId('unknown')).toBe(false)

    const first = createFirstPocketGroove('source')
    const second = createFirstPocketGroove('source')
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second.document).not.toBe(first.document)
  })

  it('keeps prepared documents outside the file-import Worker protocol', () => {
    expectTypeOf<DrumSessionImportSourceFormat>().toEqualTypeOf<
      'midi' | 'guitar-pro'
    >()
    expectTypeOf<DrumSessionSourceFormat>().toEqualTypeOf<
      'midi' | 'guitar-pro' | 'prepared'
    >()
  })

  it.each(FIRST_POCKET_VARIANTS)(
    'builds the bounded two-bar $label document from honest GM hits',
    (variant) => {
      const groove = createFirstPocketGroove(variant.id)
      const document = groove.document
      const track = document.percussionTracks[0]
      const hits = track?.percussionHits ?? []

      expect(document).toMatchObject({
        sourceFormat: 'prepared',
        pitchedTrackCount: 0,
        droppedHitCount: 0,
        durationBeats: 8,
      })
      expect(document.canonicalSong.bpm).toBe(84)
      expect(document.canonicalSong.timeSignatures).toEqual([
        { beat: 0, numerator: 4, denominator: 4 },
      ])
      expect(document.percussionTracks).toHaveLength(1)
      expect(document.hitCount).toBe(hits.length)
      expect(hits.length).toBeGreaterThanOrEqual(20)
      expect(hits.length).toBeLessThanOrEqual(64)
      expect(new Set(hits.map((hit) => hit.id)).size).toBe(hits.length)
      expect(hits.map((hit) => hit.startBeat)).toEqual(
        [...hits.map((hit) => hit.startBeat)].sort((a, b) => a - b),
      )

      for (const hit of hits) {
        expect([36, 38, 42, 45, 46, 47, 48, 49, 51]).toContain(hit.gmKey)
        expect(hit.velocity).toBeGreaterThanOrEqual(1)
        expect(hit.velocity).toBeLessThanOrEqual(127)
        expect(hit.source).toBeUndefined()
      }

      expect(groove.pocket).toMatchObject({
        durationBeats: 8,
        subdivisionBeats: 0.25,
        stepCount: 32,
        hitCount: hits.length,
      })
      expect(groove.pocket.hits).toHaveLength(hits.length)
      expect(groove.pocket.hits.every((hit) => hit.phase >= 0)).toBe(true)
      expect(groove.pocket.hits.every((hit) => hit.phase < 1)).toBe(true)
    },
  )

  it('authors four musically distinct beginner grooves with an honest half-time backbeat', () => {
    const classic = createFirstPocketGroove('source')
    const funk = createFirstPocketGroove('tight')
    const driving = createFirstPocketGroove('loose')
    const halfTime = createFirstPocketGroove('half-time')

    // Authored data stays on the grid; the Feel toggle owns micro-timing.
    expect(funk.pocket.offGridHitCount).toBe(0)
    expect(classic.pocket.offGridHitCount).toBe(0)
    expect(driving.pocket.offGridHitCount).toBeGreaterThan(0)

    const voiceKeys = (groove: ReturnType<typeof createFirstPocketGroove>) =>
      new Set(groove.pocket.hits.map((hit) => hit.gmKey))
    expect(voiceKeys(classic)).toEqual(new Set([36, 38, 42, 46, 49]))
    expect(voiceKeys(funk)).toEqual(new Set([36, 38, 42, 46]))
    expect(voiceKeys(driving)).toEqual(new Set([36, 38, 45, 47, 48, 49, 51]))
    expect(voiceKeys(halfTime)).toEqual(new Set([36, 38, 42, 45, 46, 48, 49]))

    const grooveSignature = (
      groove: ReturnType<typeof createFirstPocketGroove>,
    ) =>
      groove.pocket.hits
        .map((hit) => `${hit.gmKey}@${hit.beat}:${hit.velocity}`)
        .join('|')
    expect(
      new Set(
        [classic, funk, driving, halfTime].map((groove) =>
          grooveSignature(groove),
        ),
      ).size,
    ).toBe(4)

    const classicBackbeats = classic.pocket.hits
      .filter((hit) => hit.gmKey === 38 && hit.velocity >= 100)
      .map((hit) => Math.round(hit.beat * 4) / 4)
    expect(classicBackbeats).toEqual([1, 3, 5, 7])

    const halfTimeSnares = halfTime.pocket.hits
      .filter((hit) => hit.gmKey === 38 && hit.velocity >= 100)
      .map((hit) => hit.beat)
    expect(halfTimeSnares).toEqual([2, 6])
  })

  it('feeds the existing scheduler without creating another clock', () => {
    const clock = new FixedClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = {
      activate: vi.fn<DrumKitPlayerPort['activate']>(() => true),
      trigger: vi.fn<DrumKitPlayerPort['trigger']>(() => 'synth-fallback'),
      panic: vi.fn<DrumKitPlayerPort['panic']>(),
      dispose: vi.fn<DrumKitPlayerPort['dispose']>(),
    } satisfies DrumKitPlayerPort
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: (timestampMs) => timestampMs / 1_000,
    })

    scheduler.setSession(createFirstPocketGroove('source').document)
    transport.start()

    expect(player.trigger).toHaveBeenCalled()
    expect(player.trigger.mock.calls.map(([hit]) => hit)).toContainEqual(
      expect.objectContaining({
        gmKey: 36,
        sourceId: 'authored:first-pocket:kick-01',
      }),
    )
    expect(scheduler.snapshot()).toMatchObject({
      status: 'playing',
      sourceDroppedHitCount: 0,
    })
  })
})
