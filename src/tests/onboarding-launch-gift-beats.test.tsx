// ============================================================
// The launch gift on the Keep beat and the Map
// ============================================================
//
// Keep in its four states (a code on offer or none, a twin or none), and
// the Map's three gift lines. The beats take everything as props, so these
// render them alone; which variant a visitor gets is FirstLight's call, and
// onboarding-launch-gift-flow.test.tsx pins that.
//
// Launch offer plan, sections 4.1 to 4.4 and the copy deck in 4.7.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FeaturedPromo } from '@/db/services/billing-service'
import { BeatKeep } from '@/features/onboarding/beats/BeatKeep'
import type { MapGift } from '@/features/onboarding/beats/BeatMap'
import { BeatMap } from '@/features/onboarding/beats/BeatMap'
import { giftEndDay } from '@/features/onboarding/beats/KeepGiftCard'
import { keyboardSpan } from '@/features/onboarding/beats/KeepRange'
import type { MirrorResult } from '@/lib/mirror/metrics'

afterEach(cleanup)

const LAUNCH: FeaturedPromo = {
  code: 'LAUNCH',
  credits: 5,
  expiresAt: '2027-01-01T23:59:59.000Z',
}

const VOICEPRINT: MirrorResult = {
  range: {
    lowMidi: 40,
    highMidi: 67,
    lowNote: 'E2',
    highNote: 'G4',
    semitones: 27,
    qualifyingMidis: [40, 52, 67],
    voiceHint: 'baritone',
  },
  accuracy: null,
  steadiness: null,
}

function renderKeep(
  props: { gift?: FeaturedPromo | null; twin?: string | null } = {},
) {
  const onCreateAccount = vi.fn()
  const view = render(() => (
    <BeatKeep
      twin={props.twin ?? null}
      voiceprint={VOICEPRINT}
      gift={props.gift ?? null}
      onCreateAccount={onCreateAccount}
    />
  ))
  const beat = view.container.querySelector<HTMLElement>('[data-beat="keep"]')
  if (beat === null) throw new Error('no keep beat')
  return { beat, onCreateAccount }
}

const rowTexts = (beat: HTMLElement): string[] =>
  [...beat.querySelectorAll('li')].map((row) => row.textContent ?? '')

describe('Keep with the launch gift', () => {
  it('asks once, beside the gift, and says when the credits arrive', () => {
    const { beat, onCreateAccount } = renderKeep({ gift: LAUNCH })

    expect(beat.querySelector('h1')).toHaveTextContent('Keep your voiceprint')
    expect(beat).toHaveTextContent(
      'It lives in this browser for now. A free account keeps it on every device.',
    )
    expect(rowTexts(beat)).toEqual([
      'Your voiceprint and range, saved',
      'Your progress on every device',
    ])
    const gift = screen.getByTestId('keep-gift')
    expect(gift).toHaveTextContent('Launch gift')
    expect(gift).toHaveTextContent('5 free Karaoke Night credits')
    expect(gift).toHaveTextContent(
      'Take the voice out of up to 5 songs and sing with the band.',
    )
    // Each width shows one of these; the other is hidden by the stylesheet.
    expect(gift.querySelector('[data-copy="wide"]')).toHaveTextContent(
      'With a free account, until 1 January.',
    )
    expect(gift.querySelector('[data-copy="narrow"]')).toHaveTextContent(
      /^Until 1 January$/,
    )
    expect(beat).toHaveTextContent(
      'Credits arrive when your email is confirmed.',
    )

    // One button. Declining is the rail's "Not now", not a second button.
    const buttons = beat.querySelectorAll('button')
    expect([...buttons].map((b) => b.textContent)).toEqual([
      'Create my free account',
    ])
    fireEvent.click(buttons[0] as HTMLButtonElement)
    expect(onCreateAccount).toHaveBeenCalledOnce()
  })

  it('shows the voiceprint it is asking to keep: the voice type and range', () => {
    renderKeep({ gift: LAUNCH })
    const card = screen.getByTestId('keep-range')
    expect(card).toHaveTextContent('Baritone')
    expect(card).toHaveTextContent('E2 to G4')
  })

  it('puts the twin in the headline and the portrait in place of the card', () => {
    const { beat } = renderKeep({ gift: LAUNCH, twin: 'Johnny Cash' })

    expect(beat.querySelector('h1')).toHaveTextContent(
      'Johnny Cash is your twin',
    )
    expect(screen.queryByTestId('keep-range')).toBeNull()
    expect(screen.getByTestId('keep-gift')).toHaveTextContent(
      '5 free Karaoke Night credits',
    )
  })

  it('names the credits the code gives', () => {
    renderKeep({ gift: { code: 'WINTER', credits: 8, expiresAt: null } })
    const gift = screen.getByTestId('keep-gift')
    expect(gift).toHaveTextContent('8 free Karaoke Night credits')
    expect(gift).toHaveTextContent('up to 8 songs')
    expect(gift).toHaveTextContent('With a free account.')
  })
})

describe('Keep with no code on offer', () => {
  it('trades the gift for a third row and a plain fact', () => {
    const { beat } = renderKeep()

    expect(screen.queryByTestId('keep-gift')).toBeNull()
    expect(rowTexts(beat)).toEqual([
      'Your voiceprint and range, saved',
      'Your progress on every device',
      'Your place on the leaderboard',
    ])
    expect(beat).toHaveTextContent(
      'Without an account, it stays in this browser only.',
    )
    expect(beat).not.toHaveTextContent('Credits arrive')
    expect(beat).not.toHaveTextContent('credits')
  })

  it('keeps the twin headline without a gift', () => {
    const { beat } = renderKeep({ twin: 'Johnny Cash' })
    expect(beat.querySelector('h1')).toHaveTextContent(
      'Johnny Cash is your twin',
    )
    expect(rowTexts(beat)).toHaveLength(3)
  })
})

describe('the pieces of the gift card', () => {
  it('ends the offer on the day the server ends it, in UTC', () => {
    expect(giftEndDay('2027-01-01T23:59:59.000Z')).toBe('1 January')
    expect(giftEndDay(null)).toBeNull()
    expect(giftEndDay('not a date')).toBeNull()
  })

  it('draws C2 to B5, and widens to whole octaves for a range past it', () => {
    expect(keyboardSpan({ lowMidi: 40, highMidi: 67 })).toEqual({
      first: 36,
      last: 83,
    })
    expect(keyboardSpan({ lowMidi: 30, highMidi: 90 })).toEqual({
      first: 24,
      last: 95,
    })
  })
})

describe('the Map gift lines', () => {
  const noop = (): void => {}

  function renderMap(gift: MapGift | null, onKeep?: () => void) {
    const onGift = vi.fn()
    const view = render(() => (
      <BeatMap
        voiceprint={null}
        onEnter={noop}
        onTour={noop}
        onDone={noop}
        onKeep={onKeep}
        gift={gift}
        onGift={onGift}
      />
    ))
    const map = view.container.querySelector<HTMLElement>('[data-beat="map"]')
    if (map === null) throw new Error('no map beat')
    return { map, onGift }
  }

  it('tags the Karaoke card and offers the gift to a visitor with nothing to keep', () => {
    const { map, onGift } = renderMap({ kind: 'join', credits: 5 })

    const karaoke = map.querySelector('[data-room="karaoke"]')
    expect(karaoke).toHaveTextContent('5 free credits')
    // Only the room that uses the credits wears them.
    const tagged = [...map.querySelectorAll('[data-room]')].filter((card) =>
      card.textContent?.includes('free credits'),
    )
    expect(tagged.map((card) => card.getAttribute('data-room'))).toEqual([
      'karaoke',
    ])
    expect(map).toHaveTextContent(
      'Launch gift: 5 free Karaoke Night credits with a free account.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Get my 5 credits' }))
    expect(onGift).toHaveBeenCalledOnce()
  })

  it('lets the way back to Keep carry the gift', () => {
    const onKeep = vi.fn()
    const { map, onGift } = renderMap({ kind: 'keep', credits: 5 }, onKeep)

    expect(map).toHaveTextContent(
      'Your voiceprint is saved in this browser only.',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save it and get 5 free credits' }),
    )
    expect(onGift).toHaveBeenCalledOnce()
    expect(onKeep).not.toHaveBeenCalled()
    expect(map.querySelector('[data-room="karaoke"]')).not.toHaveTextContent(
      'free credits',
    )
  })

  it('offers an account that has not claimed it the one-tap claim', () => {
    const { map, onGift } = renderMap({ kind: 'waiting', credits: 5 })

    expect(map).toHaveTextContent(
      'Your launch gift is waiting: 5 Karaoke Night credits.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Claim them' }))
    expect(onGift).toHaveBeenCalledOnce()
  })

  it('keeps the plain way back when there is no gift', () => {
    const onKeep = vi.fn()
    const { map } = renderMap(null, onKeep)

    expect(map).not.toHaveTextContent('Launch gift')
    expect(map).not.toHaveTextContent('free credits')
    fireEvent.click(
      screen.getByRole('button', { name: 'Save it to a free account' }),
    )
    expect(onKeep).toHaveBeenCalledOnce()
  })
})
