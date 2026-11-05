// The free taste at a room card's tap (free-taste-gate.ts): the room while
// runs are left, the Cloud offer in its place once they are used, the room
// for a singer the server knows has the subscription, "You're subscribed"
// for one only the store knows of yet, and the Warm-up always, its taste
// being held on its own path. Each step counted for the room.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXERCISE_ECHO_STARS, EXERCISE_LEAP_CLIFFS, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'
import { noteTasteRun, resetFreeTasteForTests, tryFreeTaste, } from '@/stores/free-taste-store'
import { offerWarmUp, openRoomFromCard, resetFreeTasteGateForTests, } from './free-taste-gate'

const offer = vi.hoisted(() => ({
  facts: { songs: { subscribed: false }, storeHolds: false },
  askBeforeOffering: vi.fn(),
  openCloudOffer: vi.fn(),
  openRoomOffer: vi.fn(),
  trackEvent: vi.fn(),
}))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  PREMIUM_EXERCISES: true,
}))

vi.mock('@/features/karaoke-room/cloud-offer-store', () => ({
  askBeforeOffering: offer.askBeforeOffering,
  openCloudOffer: offer.openCloudOffer,
  openRoomOffer: offer.openRoomOffer,
}))

vi.mock('@/features/karaoke-room/karaoke-songs', () => ({
  karaokeSongs: () => ({ subscribed: false }),
  songsOnTheWay: () => false,
}))

vi.mock('@/lib/analytics', () => ({ trackEvent: offer.trackEvent }))

beforeEach(() => {
  localStorage.clear()
  resetFreeTasteForTests()
  resetFreeTasteGateForTests()
  offer.facts = { songs: { subscribed: false }, storeHolds: false }
  offer.askBeforeOffering.mockImplementation(async () => offer.facts)
  tryFreeTaste(true)
})

afterEach(() => {
  vi.clearAllMocks()
  resetFreeTasteForTests()
})

function tracked(): string[] {
  return offer.trackEvent.mock.calls.map(([name]) => name as string)
}

describe('a room card tapped', () => {
  it('opens the room while its free runs last', () => {
    const open = vi.fn()
    openRoomFromCard(EXERCISE_LEAP_CLIFFS, open)
    expect(open).toHaveBeenCalledWith(EXERCISE_LEAP_CLIFFS)
    expect(tracked()).toEqual(['room_tap_leap', 'room_open_leap'])
    expect(offer.askBeforeOffering).not.toHaveBeenCalled()
  })

  it('opens the offer in its place once they are used', async () => {
    noteTasteRun(EXERCISE_ECHO_STARS)
    const open = vi.fn()
    openRoomFromCard(EXERCISE_ECHO_STARS, open)
    await vi.waitFor(() => expect(offer.openRoomOffer).toHaveBeenCalled())
    expect(offer.openRoomOffer).toHaveBeenCalledWith(EXERCISE_ECHO_STARS)
    expect(open).not.toHaveBeenCalled()
    expect(tracked()).toEqual(['room_tap_echo'])
  })

  it('opens the room for a singer the server knows has the subscription', async () => {
    noteTasteRun(EXERCISE_ECHO_STARS)
    offer.facts = { songs: { subscribed: true }, storeHolds: false }
    const open = vi.fn()
    openRoomFromCard(EXERCISE_ECHO_STARS, open)
    await vi.waitFor(() => expect(open).toHaveBeenCalled())
    expect(offer.openRoomOffer).not.toHaveBeenCalled()
    expect(tracked()).toEqual(['room_tap_echo', 'room_open_echo'])
  })

  it('says "You\'re subscribed" when only the store knows of it yet', async () => {
    noteTasteRun(EXERCISE_ECHO_STARS)
    offer.facts = { songs: { subscribed: false }, storeHolds: true }
    openRoomFromCard(EXERCISE_ECHO_STARS, vi.fn())
    await vi.waitFor(() =>
      expect(offer.openCloudOffer).toHaveBeenCalledWith('room', 'subscribed'),
    )
    expect(offer.openRoomOffer).not.toHaveBeenCalled()
  })

  it('opens the offer when the asks fail', async () => {
    noteTasteRun(EXERCISE_ECHO_STARS)
    offer.askBeforeOffering.mockImplementation(async () => {
      throw new Error('offline')
    })
    openRoomFromCard(EXERCISE_ECHO_STARS, vi.fn())
    await vi.waitFor(() =>
      expect(offer.openRoomOffer).toHaveBeenCalledWith(EXERCISE_ECHO_STARS),
    )
  })

  it('always opens the Warm-up: its path holds its own taste', () => {
    noteTasteRun(EXERCISE_WARM_UP_PATH)
    const open = vi.fn()
    openRoomFromCard(EXERCISE_WARM_UP_PATH, open)
    expect(open).toHaveBeenCalledWith(EXERCISE_WARM_UP_PATH)
  })

  it('opens the offer for the Warm-up from its padlocked button', async () => {
    noteTasteRun(EXERCISE_WARM_UP_PATH)
    offerWarmUp()
    await vi.waitFor(() =>
      expect(offer.openRoomOffer).toHaveBeenCalledWith(EXERCISE_WARM_UP_PATH),
    )
  })
})
