// Automatic voice engagement regressions — one prompt per physical circle entry.

import { describe, expect, it, vi } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { AUTOMATIC_SINGING_CONTACT_RADIUS } from '../core/exhibit-interaction'
import { BREAKABLE_INTERACTION_RADIUS } from '../core/game'
import { AUTOMATIC_SINGING_PREFERENCE, createAutomaticVoiceEngagement, createAutomaticVoicePreparationOwner, parseAutomaticSingingPreference, serializeAutomaticSingingPreference, } from './automatic-voice-engagement'

const first = GLASSWORKS.breakables[0]!
const inside = { ...first.anchor }
const outside = {
  x: first.anchor.x + BREAKABLE_INTERACTION_RADIUS + 0.01,
  y: first.anchor.y,
  z: first.anchor.z,
}
const outsideAutomaticContact = {
  x: first.anchor.x + AUTOMATIC_SINGING_CONTACT_RADIUS + 0.01,
  y: first.anchor.y,
  z: first.anchor.z,
}

function eligible(
  engagement: ReturnType<typeof createAutomaticVoiceEngagement>,
  playerPosition = inside,
) {
  return engagement.observe({
    enabled: true,
    eligible: true,
    nearbyEncounterId: first.id,
    playerPosition,
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('automatic voice engagement', () => {
  it('defaults missing and invalid preferences on while preserving an explicit off', () => {
    expect(parseAutomaticSingingPreference(null)).toBe(true)
    expect(parseAutomaticSingingPreference('on')).toBe(true)
    expect(parseAutomaticSingingPreference('unexpected')).toBe(true)
    expect(parseAutomaticSingingPreference('off')).toBe(false)
    expect(serializeAutomaticSingingPreference(true)).toBe('on')
    expect(serializeAutomaticSingingPreference(false)).toBe('off')
    expect(AUTOMATIC_SINGING_PREFERENCE).toBe('automatic-singing')
  })

  it('waits for a gameplay gesture and consumes before returning an encounter', () => {
    const engagement = createAutomaticVoiceEngagement(GLASSWORKS)
    expect(eligible(engagement)).toBeNull()

    engagement.arm()
    expect(eligible(engagement)).toBe(first.id)
    expect(engagement.snapshot()).toEqual({
      armed: true,
      blockedEncounterId: first.id,
    })
  })

  it('waits for Merc to touch the visible ring inside the larger manual range', () => {
    const engagement = createAutomaticVoiceEngagement(GLASSWORKS)
    engagement.arm()

    expect(
      eligible(engagement, {
        x: first.anchor.x + AUTOMATIC_SINGING_CONTACT_RADIUS + 0.001,
        y: first.anchor.y,
        z: first.anchor.z,
      }),
    ).toBeNull()
    expect(
      eligible(engagement, {
        x: first.anchor.x + AUTOMATIC_SINGING_CONTACT_RADIUS,
        y: first.anchor.y,
        z: first.anchor.z,
      }),
    ).toBe(first.id)
  })

  it('requires a fresh gesture after pause without forgetting the consumed circle', () => {
    const engagement = createAutomaticVoiceEngagement(GLASSWORKS)
    engagement.arm()
    expect(eligible(engagement)).toBe(first.id)

    engagement.disarm()
    expect(engagement.snapshot()).toEqual({
      armed: false,
      blockedEncounterId: first.id,
    })
    expect(
      engagement.observe({
        enabled: true,
        eligible: true,
        nearbyEncounterId: first.id,
        playerPosition: outside,
      }),
    ).toBeNull()
    engagement.arm()
    expect(eligible(engagement)).toBe(first.id)
  })

  it('does not re-enter after cancellation or a transient ineligible frame', () => {
    const engagement = createAutomaticVoiceEngagement(GLASSWORKS)
    engagement.arm()
    expect(eligible(engagement)).toBe(first.id)
    expect(
      engagement.observe({
        enabled: true,
        eligible: false,
        nearbyEncounterId: null,
        playerPosition: inside,
      }),
    ).toBeNull()
    expect(eligible(engagement)).toBeNull()
  })

  it('does not rearm from an elevation change without stepping away', () => {
    const engagement = createAutomaticVoiceEngagement(GLASSWORKS)
    engagement.arm()
    expect(eligible(engagement)).toBe(first.id)

    expect(
      eligible(engagement, {
        ...inside,
        y: first.anchor.y + 0.06,
      }),
    ).toBeNull()
    expect(engagement.snapshot().blockedEncounterId).toBe(first.id)
    expect(eligible(engagement)).toBeNull()
  })

  it('rearms after leaving visible contact while still inside manual range', () => {
    const engagement = createAutomaticVoiceEngagement(GLASSWORKS)
    engagement.arm()
    expect(eligible(engagement)).toBe(first.id)

    expect(
      engagement.observe({
        enabled: true,
        eligible: true,
        nearbyEncounterId: first.id,
        playerPosition: outsideAutomaticContact,
      }),
    ).toBeNull()
    expect(outsideAutomaticContact.x - first.anchor.x).toBeLessThan(
      BREAKABLE_INTERACTION_RADIUS,
    )
    expect(engagement.snapshot().blockedEncounterId).toBeNull()
    expect(eligible(engagement)).toBe(first.id)
  })

  it('lets a manual start consume the circle even when automatic singing is off', () => {
    const engagement = createAutomaticVoiceEngagement(GLASSWORKS)
    engagement.arm()
    engagement.consume(first.id)
    expect(
      engagement.observe({
        enabled: false,
        eligible: true,
        nearbyEncounterId: first.id,
        playerPosition: inside,
      }),
    ).toBeNull()
    expect(engagement.snapshot().blockedEncounterId).toBe(first.id)
  })

  it('never lets a delayed old start release a newer gesture preparation', async () => {
    const firstReady = deferred<boolean>()
    const firstRelease = vi.fn()
    const secondRelease = vi.fn()
    const firstPreparation = {
      ready: firstReady.promise,
      release: firstRelease,
    }
    const secondPreparation = {
      ready: Promise.resolve(true),
      release: secondRelease,
    }
    const unavailable = vi.fn()
    const host = {
      prepareVoiceGesture: vi
        .fn()
        .mockReturnValueOnce(firstPreparation)
        .mockReturnValueOnce(secondPreparation),
    }
    const owner = createAutomaticVoicePreparationOwner(host, unavailable)

    const capturedByOldStart = owner.prepare()
    owner.release()
    expect(firstRelease).toHaveBeenCalledOnce()
    expect(owner.prepare()).toBe(secondPreparation)

    owner.release(capturedByOldStart)
    firstReady.resolve(false)
    await firstReady.promise
    await Promise.resolve()

    expect(firstRelease).toHaveBeenCalledOnce()
    expect(secondRelease).not.toHaveBeenCalled()
    expect(owner.current()).toBe(secondPreparation)
    expect(unavailable).not.toHaveBeenCalled()

    owner.release()
    expect(secondRelease).toHaveBeenCalledOnce()
  })
})
