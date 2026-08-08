// ============================================================
// Telling a seeded example from the visitor's own song
// ============================================================
//
// The regression this exists to prevent, which already happened once:
// examples are seeded as ordinary session rows, so `karaoke_song_staged`
// fired for them too. That event is Campaign E's bid target and is
// documented as "the visitor staged their OWN song" — so the campaign
// was one step from optimising toward visitors who tap a built-in track
// and never upload anything.
//
// The discriminator is `provider`, not group membership: a visitor can
// drag an example out of the Examples group and it is still not theirs.

import { describe, expect, it } from 'vitest'
import { AD_CONVERSIONS } from '@/lib/consent'
import { KARAOKE_FUNNEL_EVENTS } from '@/lib/funnel-event-catalog'
import { demoSessionId } from './demo-song'
import { EXAMPLE_PROVIDER, exampleSessionFrom, isExampleSession, } from './examples-library'

const manifest = {
  slug: 'example-song',
  title: 'Example',
  artist: 'Someone',
  durationSec: 120,
  stems: { vocal: 'vocal.mp3', instrumental: 'instrumental.mp3' },
}

describe('isExampleSession', () => {
  it('recognises a seeded example', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seeded = exampleSessionFrom(manifest as any, 0)

    expect(seeded.provider).toBe(EXAMPLE_PROVIDER)
    expect(isExampleSession(seeded)).toBe(true)
    expect(seeded.sessionId).toBe(demoSessionId(manifest.slug))
  })

  it('does not claim a visitor upload', () => {
    // Server and local separations both stamp a different provider, and an
    // older row may carry none at all.
    const uploadId = 'a2c4e6f8-1234-4abc-9def-000000000001'
    expect(isExampleSession({ provider: 'server', sessionId: uploadId })).toBe(
      false,
    )
    expect(isExampleSession({ provider: 'webgpu', sessionId: uploadId })).toBe(
      false,
    )
    expect(isExampleSession({ provider: undefined, sessionId: uploadId })).toBe(
      false,
    )
    expect(isExampleSession(undefined)).toBe(false)
  })

  it('is not fooled by a lookalike provider', () => {
    const uploadId = 'a2c4e6f8-1234-4abc-9def-000000000002'
    expect(
      isExampleSession({ provider: 'Examples', sessionId: uploadId }),
    ).toBe(false)
    expect(isExampleSession({ provider: 'example', sessionId: uploadId })).toBe(
      false,
    )
  })

  it('recognises a legacy example row by id when the provider stamp is missing', () => {
    // A device that seeded examples under an older build may hold rows
    // without provider='examples' in Dexie forever. Their id format cannot
    // lie: every example id comes from demoSessionId(), and no visitor
    // upload is ever given one.
    expect(
      isExampleSession({
        provider: undefined,
        sessionId: demoSessionId('some-old-example'),
      }),
    ).toBe(true)
    expect(
      isExampleSession({
        provider: undefined,
        sessionId: 'karaoke-night-demo',
      }),
    ).toBe(true)
  })
})

describe('the two staging events', () => {
  it('are both registered for ingest', () => {
    // An unregistered event is answered 400 and dropped in silence — the
    // failure mode funnel-events.test.ts exists to prevent.
    expect(KARAOKE_FUNNEL_EVENTS).toContain('karaoke_song_staged')
    expect(KARAOKE_FUNNEL_EVENTS).toContain('karaoke_example_staged')
  })

  it('bids on the own-song one only', () => {
    // Campaign E's goal. An ad conversion on example staging would teach
    // the campaign to buy visitors who never bring a song.
    expect(AD_CONVERSIONS.karaoke_song_staged).toBeTruthy()
    expect(
      (AD_CONVERSIONS as Record<string, string | undefined>)
        .karaoke_example_staged,
    ).toBeUndefined()
  })
})
