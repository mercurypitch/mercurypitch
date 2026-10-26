// ============================================================
// The launch gift on the Keep beat and the Map
// ============================================================
//
// Keep in its four states (a code on offer or none, a twin or none), with
// a range read that is not clean, and the Map's three gift lines. The beats
// take everything as props, so these render them alone; which variant a
// visitor gets is FirstLight's call, and onboarding-launch-gift-flow.test.tsx
// pins that.
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
  props: {
    gift?: FeaturedPromo | null
    twin?: string | null
    voiceprint?: MirrorResult
  } = {},
) {
  const onCreateAccount = vi.fn()
  const view = render(() => (
    <BeatKeep
      twin={props.twin ?? null}
      voiceprint={props.voiceprint ?? VOICEPRINT}
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
  it('asks once, beside the gift, and says when the gift arrives', () => {
    const { beat, onCreateAccount } = renderKeep({ gift: LAUNCH })

    expect(beat.querySelector('h1')).toHaveTextContent('Keep your voiceprint')
    expect(beat).toHaveTextContent(
      'It lives in this browser for now. A free account keeps it on every device.',
    )
    expect(rowTexts(beat)).toEqual([
      'Every weekly Check-up, kept',
      'Your progress on every device',
    ])
    const gift = screen.getByTestId('keep-gift')
    expect(gift).toHaveTextContent('Launch gift')
    // Named by what it buys, not by the coins it is paid in (owner
    // testing, 11 Oct 2026). "Up to": a long song or a full band costs more.
    expect(gift).toHaveTextContent('Up to 5 free song separations')
    expect(gift).toHaveTextContent(
      'Sing your favorite songs at Karaoke Night and see how you score.',
    )
    // Each width shows one of these; the other is hidden by the stylesheet.
    expect(gift.querySelector('[data-copy="wide"]')).toHaveTextContent(
      'With a free account, until 1 January.',
    )
    expect(gift.querySelector('[data-copy="narrow"]')).toHaveTextContent(
      /^Until 1 January$/,
    )
    expect(beat).toHaveTextContent(
      'Your gift arrives when your email is confirmed.',
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

  it('shows no range card for a read that is not clean', () => {
    // Arrange: a steady tone reads A3 to A3, 0 semitones, no voice type; the
    // twin beat has just said Merc could not read the range.
    const steadyTone: MirrorResult = {
      ...VOICEPRINT,
      range: {
        lowMidi: 57,
        highMidi: 57,
        lowNote: 'A3',
        highNote: 'A3',
        semitones: 0,
        qualifyingMidis: [57],
        voiceHint: null,
      },
    }

    // Act
    const { beat } = renderKeep({ gift: LAUNCH, voiceprint: steadyTone })

    // Assert
    expect(screen.queryByTestId('keep-range')).toBeNull()
    expect(beat).not.toHaveTextContent('A3 to A3')
    expect(beat.querySelector('h1')).toHaveTextContent('Keep your voiceprint')
  })

  it('puts the twin in the headline and the portrait in place of the card', () => {
    const { beat } = renderKeep({ gift: LAUNCH, twin: 'Johnny Cash' })

    expect(beat.querySelector('h1')).toHaveTextContent(
      'Johnny Cash is your twin',
    )
    expect(screen.queryByTestId('keep-range')).toBeNull()
    expect(screen.getByTestId('keep-gift')).toHaveTextContent(
      'Up to 5 free song separations',
    )
  })

  it('counts the separations the code gives', () => {
    renderKeep({ gift: { code: 'WINTER', credits: 8, expiresAt: null } })
    const gift = screen.getByTestId('keep-gift')
    expect(gift).toHaveTextContent('Up to 8 free song separations')
    expect(gift).not.toHaveTextContent('5')
    expect(gift).toHaveTextContent('With a free account.')
  })
})

describe('what using the gift earns, under it', () => {
  const TERMS = {
    goal: 5,
    deadline: '2026-10-28T23:59:59.999Z',
    bonusCredits: 30,
  }
  const LINE =
    'Use all 5 by 28 October and your next credit pack comes with 30 extra credits.'

  afterEach(() => {
    vi.useRealTimers()
  })

  function at(iso: string): void {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(iso))
  }

  it('says it on the Keep card, under the gift, while the offer is live', () => {
    at('2026-10-14T12:00:00.000Z')
    renderKeep({ gift: { ...LAUNCH, offer: TERMS } })

    const line = screen.getByTestId('gift-offer-line')
    expect(line).toHaveTextContent(LINE)
    // Beneath the gift's own words, inside its card.
    const card = screen.getByTestId('keep-gift')
    expect(card).toContainElement(line)
    expect(
      screen
        .getByText('Up to 5 free song separations')
        .compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('takes the count, the day and the bonus from the server', () => {
    at('2026-10-14T12:00:00.000Z')
    renderKeep({
      gift: {
        ...LAUNCH,
        credits: 3,
        offer: {
          goal: 3,
          deadline: '2026-11-02T23:59:59.999Z',
          bonusCredits: 12,
        },
      },
    })

    expect(screen.getByTestId('gift-offer-line')).toHaveTextContent(
      'Use all 3 by 2 November and your next credit pack comes with 12 extra credits.',
    )
  })

  it('leaves the Keep card without it when the server states no offer', () => {
    at('2026-10-14T12:00:00.000Z')
    renderKeep({ gift: { ...LAUNCH, offer: null } })
    expect(screen.getByTestId('keep-gift')).toBeInTheDocument()
    expect(screen.queryByTestId('gift-offer-line')).toBeNull()
  })

  it('leaves the Keep card without it once the deadline has passed', () => {
    at('2026-10-29T00:00:00.000Z')
    renderKeep({ gift: { ...LAUNCH, offer: TERMS } })
    expect(screen.getByTestId('keep-gift')).toBeInTheDocument()
    expect(screen.queryByTestId('gift-offer-line')).toBeNull()
  })
})

describe('Keep with no code on offer', () => {
  it('trades the gift for a third row and a plain fact', () => {
    const { beat } = renderKeep()

    expect(screen.queryByTestId('keep-gift')).toBeNull()
    expect(rowTexts(beat)).toEqual([
      'Every weekly Check-up, kept',
      'Your progress on every device',
      'Your place on the leaderboard',
    ])
    expect(beat).toHaveTextContent(
      'Without an account, it stays in this browser only.',
    )
    expect(beat).not.toHaveTextContent('gift arrives')
    expect(beat).not.toHaveTextContent('credits')
    expect(beat).not.toHaveTextContent('separations')
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
    expect(karaoke).toHaveTextContent('Launch gift')
    // Only the room the gift is for wears the tag.
    const tagged = [...map.querySelectorAll('[data-room]')].filter((card) =>
      card.textContent?.includes('Launch gift'),
    )
    expect(tagged.map((card) => card.getAttribute('data-room'))).toEqual([
      'karaoke',
    ])
    expect(map).toHaveTextContent(
      'Launch gift: up to 5 free song separations with a free account.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Get my gift' }))
    expect(onGift).toHaveBeenCalledOnce()
  })

  it('lets the way back to Keep carry the gift', () => {
    const onKeep = vi.fn()
    const { map, onGift } = renderMap({ kind: 'keep', credits: 5 }, onKeep)

    expect(map).toHaveTextContent(
      'Your voiceprint is saved in this browser only.',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save it and get the launch gift' }),
    )
    expect(onGift).toHaveBeenCalledOnce()
    expect(onKeep).not.toHaveBeenCalled()
    expect(map.querySelector('[data-room="karaoke"]')).not.toHaveTextContent(
      'Launch gift',
    )
  })

  it('offers an account that has not claimed it the one-tap claim', () => {
    const { map, onGift } = renderMap({ kind: 'waiting', credits: 5 })

    expect(map).toHaveTextContent(
      'Your launch gift is waiting: up to 5 free song separations.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Claim them' }))
    expect(onGift).toHaveBeenCalledOnce()
  })

  it.each(['join', 'waiting'] as const)(
    'says what using the gift earns under the %s line',
    (kind) => {
      const line =
        'Use all 5 by 28 October and your next credit pack comes with 30 extra credits.'
      const { map } = renderMap({ kind, credits: 5, offer: line })

      const shown = screen.getByTestId('gift-offer-line')
      expect(shown).toHaveTextContent(line)
      expect(map).toContainElement(shown)
    },
  )

  it('says nothing of the offer under the gift lines without one', () => {
    renderMap({ kind: 'join', credits: 5, offer: null })
    expect(screen.queryByTestId('gift-offer-line')).toBeNull()
  })

  it('keeps the offer off the way back to Keep, which names no count', () => {
    renderMap(
      { kind: 'keep', credits: 5, offer: 'Use all 5 by 28 October' },
      vi.fn(),
    )
    expect(screen.queryByTestId('gift-offer-line')).toBeNull()
  })

  it('keeps the plain way back when there is no gift', () => {
    const onKeep = vi.fn()
    const { map } = renderMap(null, onKeep)

    expect(map).not.toHaveTextContent('Launch gift')
    expect(map).not.toHaveTextContent('free credits')
    expect(map).not.toHaveTextContent('separations')
    fireEvent.click(
      screen.getByRole('button', { name: 'Save it to a free account' }),
    )
    expect(onKeep).toHaveBeenCalledOnce()
  })
})
