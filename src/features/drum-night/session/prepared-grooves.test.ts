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

function hitIdentity(groove: ReturnType<typeof createFirstPocketGroove>) {
  return groove.document.percussionTracks[0]?.percussionHits
    .map((hit) => ({
      id: hit.id,
      gmKey: hit.gmKey,
      velocity: hit.velocity,
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
}

describe('prepared Drum Night grooves', () => {
  it('publishes four deterministic variants with Source as the default', () => {
    expect(FIRST_POCKET_DEFAULT_VARIANT).toBe('source')
    expect(FIRST_POCKET_VARIANTS.map((variant) => variant.id)).toEqual([
      'source',
      'tight',
      'loose',
      'half-time',
    ])
    expect(FIRST_POCKET_VARIANTS.map((variant) => variant.label)).toEqual([
      'Source',
      'Tight',
      'Loose',
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
        expect([36, 38, 42, 46]).toContain(hit.gmKey)
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

  it('materially reauthors timing while retaining Source identities in Tight and Loose', () => {
    const source = createFirstPocketGroove('source')
    const tight = createFirstPocketGroove('tight')
    const loose = createFirstPocketGroove('loose')
    const halfTime = createFirstPocketGroove('half-time')

    expect(hitIdentity(tight)).toEqual(hitIdentity(source))
    expect(hitIdentity(loose)).toEqual(hitIdentity(source))
    expect(tight.pocket.offGridHitCount).toBe(0)
    expect(source.pocket.offGridHitCount).toBeGreaterThan(0)
    expect(loose.pocket.offGridHitCount).toBeGreaterThan(
      source.pocket.offGridHitCount,
    )

    const timingSignature = (
      groove: ReturnType<typeof createFirstPocketGroove>,
    ) => groove.pocket.hits.map((hit) => `${hit.id}@${hit.beat}`).join('|')
    expect(
      new Set(
        [source, tight, loose, halfTime].map((groove) =>
          timingSignature(groove),
        ),
      ).size,
    ).toBe(4)

    const halfTimeSnares = halfTime.pocket.hits
      .filter((hit) => hit.gmKey === 38 && hit.velocity >= 100)
      .map((hit) => hit.beat)
    expect(halfTimeSnares).toEqual([3, 7])
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
