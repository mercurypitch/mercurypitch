// Audio admission tests cover prerequisites, complete quotes, saved reuse and unavailable methods.
import { describe, expect, it } from 'vitest'
import type { NightAudioFacts } from './night-audio-eligibility'
import { nightAudioEligibility } from './night-audio-eligibility'

const newSongFacts = (): NightAudioFacts => ({
  signedIn: true,
  balance: 10,
  prices: { roformer: 2, 'demucs-6s': 4 },
  duration: 180,
  bytes: 1024,
  existing: false,
  vocals: false,
  instrumental: false,
  band: false,
})

describe('night audio eligibility', () => {
  it('offers free local vocals without auth, pricing or a duration estimate', () => {
    expect(
      nightAudioEligibility(
        {
          ...newSongFacts(),
          signedIn: false,
          balance: null,
          prices: null,
          duration: null,
        },
        'local',
        'vocals',
      ),
    ).toMatchObject({ available: true, cost: 0 })
  })
  it('explains that local cannot isolate a full band', () => {
    expect(
      nightAudioEligibility(newSongFacts(), 'local', 'guitar'),
    ).toMatchObject({ available: false, recovery: 'cloud' })
  })
  it.each(['vocals', 'guitar', 'drums'] as const)(
    'requires an account before cloud %s processing',
    (target) => {
      expect(
        nightAudioEligibility(
          { ...newSongFacts(), signedIn: false },
          'server',
          target,
        ),
      ).toMatchObject({ available: false, recovery: 'account' })
    },
  )
  it('quotes both cloud stages before either can run', () => {
    expect(
      nightAudioEligibility(newSongFacts(), 'server', 'guitar'),
    ).toMatchObject({ available: true, cost: 6 })
    expect(
      nightAudioEligibility(
        { ...newSongFacts(), balance: 5 },
        'server',
        'guitar',
      ),
    ).toMatchObject({ available: false, cost: 6, recovery: 'credits' })
    expect(
      nightAudioEligibility(
        { ...newSongFacts(), balance: 2 },
        'server',
        'vocals',
      ),
    ).toMatchObject({ available: true, cost: 2 })
  })
  it('only charges the remaining band stage when the instrumental already exists', () => {
    expect(
      nightAudioEligibility(
        { ...newSongFacts(), existing: true, instrumental: true },
        'server',
        'guitar',
      ),
    ).toMatchObject({ available: true, cost: 4 })
  })
  it.each([720, 721, 1080, 1081])(
    'includes the long-song multiplier for %s seconds',
    (duration) => {
      const cost = duration <= 720 ? 6 : duration <= 1080 ? 12 : 18
      expect(
        nightAudioEligibility(
          { ...newSongFacts(), duration, balance: 30 },
          'server',
          'drums',
        ).cost,
      ).toBe(cost)
    },
  )
  it.each<Partial<NightAudioFacts>>([
    { balance: null },
    { prices: null },
    { prices: { roformer: 2 } },
    { prices: { roformer: 2, 'demucs-6s': Number.NaN } },
    { duration: null },
    { duration: Number.NaN },
    { duration: Number.POSITIVE_INFINITY },
  ])('does not promise cloud work with unknown facts: %j', (patch) => {
    expect(
      nightAudioEligibility(
        { ...newSongFacts(), ...patch },
        'server',
        'guitar',
      ),
    ).toMatchObject({ available: false, recovery: 'retry' })
  })
  it('enforces the cloud upload limit without blocking local processing', () => {
    const facts = { ...newSongFacts(), bytes: 51 * 1024 * 1024 }
    expect(nightAudioEligibility(facts, 'server', 'vocals').available).toBe(
      false,
    )
    expect(nightAudioEligibility(facts, 'local', 'vocals').available).toBe(true)
  })
  it.each(['local', 'server'] as const)(
    'reuses saved parts with %s selected even while signed out',
    (mode) => {
      const facts = {
        ...newSongFacts(),
        existing: true,
        vocals: true,
        instrumental: true,
        band: true,
        signedIn: false,
        balance: null,
        prices: null,
        duration: null,
      }
      expect(nightAudioEligibility(facts, mode, 'guitar')).toMatchObject({
        available: true,
        cost: 0,
      })
      expect(nightAudioEligibility(facts, mode, 'vocals')).toMatchObject({
        available: true,
        cost: 0,
      })
    },
  )
  it('does not treat missing durable stems as a ready song', () => {
    expect(
      nightAudioEligibility(
        { ...newSongFacts(), existing: true },
        'local',
        'vocals',
      ).available,
    ).toBe(false)
  })
})
