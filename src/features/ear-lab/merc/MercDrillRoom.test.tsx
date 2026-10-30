// The drill room around a drill: Close mid-run asks first and keeps
// nothing; the pinned row holds the replay back on a rated question and
// says why; the pads say "Your pick" and "The answer" in words; a miss
// offers Compare beside Hear it again, named in the drill's words and
// held back while a sound plays; Android's back goes through the same
// question; the sound taken away pauses the run and Resume plays the
// question again. A slip on a rated plate offers a pair practice, which
// Merc names and the plate tallies.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BeatPendulums } from '@/features/ear-lab/BeatPendulums'
import { ConsoleStack, Pads, PlayPad, StagePad, } from '@/features/ear-lab/EarStage'
import { FieldBookPage } from '@/features/ear-lab/FieldBookPage'
import type { RoomBeat, StageRoom } from '@/features/ear-lab/stage-room'
import { askRoomBack } from '@/stores/native-shell-store'
import { MercDrillRoom } from './MercDrillRoom'

vi.mock('@/lib/haptics', () => ({
  haptics: {
    tapLight: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    seal: vi.fn(),
  },
}))

interface Harness {
  setBeat: (beat: RoomBeat) => void
  setTone: (tone: 'neutral' | 'right' | 'wrong') => void
  setSounding: (sounding: boolean) => void
  /** The drill's line of the moment: its question, then its verdict. */
  setStatus: (status: string) => void
  room: StageRoom
  onBack: ReturnType<typeof vi.fn>
}

function mount(
  run: 'practice' | 'rated' = 'rated',
  more: Partial<StageRoom> = {},
  instrument: () => JSX.Element = () => <span>arc</span>,
): Harness {
  const [beat, setBeat] = createSignal<RoomBeat>('answer')
  const [tone, setTone] = createSignal<'neutral' | 'right' | 'wrong'>('neutral')
  const [held, setHeld] = createSignal(false)
  const [sounding, setSounding] = createSignal(false)
  const [status, setStatus] = createSignal(
    'That was a perfect fifth. Listen again.',
  )
  const onBack = vi.fn()
  // Leap's Compare: offered on a miss, the fifth against the fourth.
  const missed = (): boolean => beat() === 'reveal' && tone() === 'wrong'
  const room: StageRoom = {
    run: () => run,
    beat,
    sounding,
    prompt: 'Two notes. Name the interval.',
    line: () => ({ kind: 'rounds', round: 3, total: 12, answered: 2 }),
    replay: { allowed: () => beat() === 'reveal', play: vi.fn() },
    compare: {
      offered: missed,
      allowed: () => missed() && !sounding(),
      play: vi.fn(),
      names: () => (missed() ? { answer: 'the fifth', pick: 'fourth' } : null),
      difference: () => (missed() ? 'Two semitones wider.' : null),
    },
    parked: () => false,
    next: vi.fn(),
    pause: vi.fn(),
    hold: vi.fn(() => setHeld(true)),
    held,
    resume: vi.fn(() => setHeld(false)),
    abandon: vi.fn(),
    ...more,
  }
  const pads = (): JSX.Element => (
    <Pads columns={2} label="Which one?">
      <StagePad
        label="P4"
        sub="Perfect 4th"
        state={tone() === 'wrong' ? 'wrong' : null}
        disabled={beat() !== 'answer'}
        onClick={() => undefined}
      />
      <StagePad
        label="P5"
        sub="Perfect 5th"
        state={tone() === 'neutral' ? null : 'right'}
        disabled={beat() !== 'answer'}
        onClick={() => undefined}
      />
    </Pads>
  )
  render(() => (
    <MercDrillRoom
      drillId="leap"
      name="Leap"
      mode="rating run"
      progress=""
      status={status()}
      tone={tone()}
      instrument={instrument}
      console={pads}
      done={() => beat() === 'done'}
      onBack={onBack}
      room={room}
    />
  ))
  return { setBeat, setTone, setSounding, setStatus, room, onBack }
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  cleanup()
})

describe('the drill room', () => {
  it('asks before ending a run, and ending keeps nothing', () => {
    const h = mount()
    fireEvent.click(screen.getByTestId('merc-close'))
    expect(screen.getByTestId('merc-exit')).toHaveTextContent(
      'Nothing from this run is kept, and Today stays as it was.',
    )
    expect(screen.getByTestId('merc-exit')).toHaveTextContent(
      'You are two rounds in.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }))
    expect(screen.queryByTestId('merc-exit')).toBeNull()
    expect(h.room.abandon).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('merc-close'))
    fireEvent.click(
      within(screen.getByTestId('merc-exit')).getByRole('button', {
        name: 'End the run',
      }),
    )
    expect(h.room.abandon).toHaveBeenCalledTimes(1)
    expect(h.onBack).toHaveBeenCalledTimes(1)
  })

  it("answers Android's back with the same question", () => {
    const h = mount()
    expect(askRoomBack()).toBe(true)
    expect(screen.getByTestId('merc-exit')).toBeInTheDocument()
    // Back again is Keep going.
    expect(askRoomBack()).toBe(true)
    expect(screen.queryByTestId('merc-exit')).toBeNull()
    expect(h.room.abandon).not.toHaveBeenCalled()
  })

  it('holds the replay back on a rated question, and says why', () => {
    mount('rated')
    expect(screen.getByTestId('merc-replay')).toBeDisabled()
    expect(screen.getByTestId('merc-status')).toHaveTextContent(
      'Rated runs play once.Replays open after you answer.',
    )
  })

  it('names the pick and the answer in words on a miss', () => {
    const h = mount()
    h.setBeat('reveal')
    h.setTone('wrong')
    expect(
      screen.getByRole('button', {
        name: 'Perfect fourth. Your pick, not the answer',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Perfect fifth. The answer' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('merc-replay')).toBeEnabled()
  })

  it('offers Compare on a miss only, named in the drill own words', () => {
    const h = mount()
    expect(screen.queryByTestId('merc-compare')).toBeNull()
    h.setBeat('reveal')
    h.setTone('right')
    expect(screen.queryByTestId('merc-compare')).toBeNull()
    expect(screen.queryByTestId('merc-compare-hint')).toBeNull()

    h.setTone('wrong')
    const compare = screen.getByRole('button', {
      name: 'Compare: the fifth, then your fourth',
    })
    expect(compare).toHaveTextContent(/^Compare$/u)
    expect(compare).toBeEnabled()
    // In the pinned row, beside Hear it again.
    expect(screen.getByTestId('merc-pinned')).toContainElement(compare)
    expect(screen.getByTestId('merc-compare-hint')).toHaveTextContent(
      'Two semitones wider. Compare plays the two side by side.',
    )
    expect(screen.getByTestId('ear-stage-status')).toHaveTextContent(
      'That was a perfect fifth. Listen again. Two semitones wider. Compare plays the two side by side.',
    )

    fireEvent.click(compare)
    expect(h.room.compare?.play).toHaveBeenCalledTimes(1)
  })

  it('holds Compare back while a sound plays', () => {
    const h = mount()
    h.setBeat('reveal')
    h.setTone('wrong')
    h.setSounding(true)
    expect(screen.getByTestId('merc-compare')).toBeDisabled()
    h.setSounding(false)
    expect(screen.getByTestId('merc-compare')).toBeEnabled()
  })

  it('pauses when the sound is taken away, and Resume plays it again', () => {
    const h = mount()
    h.setBeat('listen')
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(h.room.hold).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('merc-sound-stopped')).toHaveTextContent(
      'Your answers so far are kept.',
    )
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(h.room.resume).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('merc-sound-stopped')).toBeNull()
  })

  it("draws a drill's instrument its own lit way, with the drill's props", () => {
    mount('practice', {}, () => <BeatPendulums sounding={1} reveal={null} />)
    // Beat Hunt's strings of light, not the web's pendulums.
    expect(document.querySelector('[data-instrument="beat-pendulums"]')).toBe(
      null,
    )
    const strings = document.querySelector('[data-instrument="beat-strings"]')
    expect(strings?.querySelector('[data-pair="1"][data-sounding]')).not.toBe(
      null,
    )
  })

  it('asks the question again whenever an answer is due', () => {
    const h = mount()
    // The first question: the task in full.
    expect(screen.getByTestId('merc-bubble')).toHaveTextContent(
      'Two notes. Name the interval.',
    )
    h.setStatus('That was a perfect fifth.')
    h.setBeat('reveal')
    h.setStatus('Listen…')
    h.setBeat('listen')
    // Nothing over the next question's sound.
    expect(screen.getByTestId('merc-bubble')).not.toHaveTextContent('Listen')
    // Its answer due, the drill's question for it: a sealed run's
    // fortieth pair asked nothing before (owner, 29 Oct).
    h.setStatus('Which interval was that?')
    h.setBeat('answer')
    expect(screen.getByTestId('merc-bubble')).toHaveTextContent(
      'Which interval was that?',
    )
  })
})

describe('a pair practice', () => {
  const PAIR = ['Minor 6th', 'Perfect 5th'] as const

  it('is offered on a slip between two items, and the tap starts it', () => {
    const practise = vi.fn()
    const h = mount('rated', {
      plate: () => ({
        kind: 'rating',
        rating: 1210,
        before: 1200,
        source: 'Leap rating',
        settling: null,
        rounds: 12,
        right: 9,
        outcomes: [],
        slips: [
          { expected: PAIR[0], answered: PAIR[1], count: 2, practise },
          // A direction is no item: nothing to practise.
          { expected: 'Up', answered: 'Level', count: 1 },
        ],
      }),
    })
    h.setBeat('done')

    const offers = screen.getAllByRole('button', { name: /^Practise/ })
    expect(offers).toHaveLength(1)
    expect(offers[0]).toHaveAccessibleName(
      'Practise Minor 6th against Perfect 5th',
    )
    // The rest of the plate reads as it did.
    expect(screen.getByRole('status', { name: 'Reading' })).toHaveTextContent(
      'Up 10 from 1200',
    )
    expect(screen.getByText('Where it slipped')).toBeInTheDocument()
    fireEvent.click(offers[0])
    expect(practise).toHaveBeenCalledTimes(1)
  })

  it('opens with Merc naming the two', () => {
    const h = mount('practice', { practising: () => PAIR })
    h.setBeat('listen')
    // His bubble is drawn for the eye; the live region speaks after the
    // sound, so the bubble is the place to read the first line.
    expect(screen.getByTestId('merc-bubble')).toHaveTextContent(
      'Only Minor 6th and Perfect 5th this time. Name each one.',
    )
    expect(screen.getByTestId('merc-mode')).toHaveTextContent('practice run')
  })

  it('ends on a tally that leaves the rating alone', () => {
    const h = mount('practice', {
      practising: () => PAIR,
      plate: () => ({
        kind: 'practice',
        against: PAIR,
        rating: 1210,
        source: 'Leap rating',
        rounds: 8,
        right: 6,
        outcomes: [],
        slips: [
          { expected: PAIR[0], answered: PAIR[1], count: 2, practise: vi.fn() },
        ],
        lines: ['1 skipped (unclear)'],
      }),
    })
    h.setBeat('done')

    const plate = screen.getByRole('status', { name: 'Practice' })
    expect(plate).toHaveTextContent('Nothing rated')
    expect(plate).toHaveTextContent('6of 8')
    expect(plate).toHaveTextContent('Minor 6th against Perfect 5th')
    expect(plate).toHaveTextContent('Nothing rated: Leap rating stays 1210')
    expect(plate).toHaveTextContent('8 rounds · 6 named · no replays')
    // Its lines about the run, as a rated plate draws them.
    expect(plate).toHaveTextContent('1 skipped (unclear)')
    expect(screen.getByTestId('ear-stage-status')).toHaveTextContent(
      '6 of 8. Minor 6th slipped to Perfect 5th twice.',
    )
  })
})

describe("the Field Book's page", () => {
  it('says the key on its chip, in the Wild, with the song as a timeline', () => {
    const [key, setKey] = createSignal<string | null>(null)
    render(() => (
      <MercDrillRoom
        drillId="field-book"
        name="09 Shadow Of The Gods"
        mode="the Field Book"
        progress={key() ?? 'reading'}
        chip={() => ({ label: 'Key', value: key() ?? 'reading' })}
        status="Reading the song: opening the vocal · 12%"
        instrument={() => (
          <FieldBookPage
            pct={key() === null ? 12 : null}
            keyName={key()}
            counts={key() === null ? null : { home: 0, echo: 0, bassline: 0 }}
            phase="opening the vocal"
            duration={252}
          />
        )}
        console={() => (
          <ConsoleStack>
            <PlayPad label="Home in the Wild" sub="once the song is read" />
            <PlayPad label="Echo in the Wild" sub="once the song is read" />
          </ConsoleStack>
        )}
        onBack={() => undefined}
      />
    ))
    expect(screen.getByTestId('merc-chip')).toHaveTextContent('Keyreading')
    expect(screen.getByTestId('ear-stage')).toHaveAttribute(
      'data-station',
      'wild',
    )
    // The room draws its own page: the song's timeline, not the web's.
    expect(
      document.querySelector('[data-instrument="song-timeline"]'),
    ).not.toBeNull()
    expect(document.querySelector('[data-instrument="field-book"]')).toBeNull()

    setKey('E minor')
    expect(screen.getByTestId('merc-chip')).toHaveTextContent('KeyE minor')
  })
})
