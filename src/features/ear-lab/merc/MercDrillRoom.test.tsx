// The drill room around a drill: Close mid-run asks first and keeps
// nothing; the pinned row holds the replay back on a rated question and
// says why; the pads say "Your pick" and "The answer" in words; Android's
// back goes through the same question; the sound taken away pauses the
// run and Resume plays the question again.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Pads, StagePad } from '@/features/ear-lab/EarStage'
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
  room: StageRoom
  onBack: ReturnType<typeof vi.fn>
}

function mount(run: 'practice' | 'rated' = 'rated'): Harness {
  const [beat, setBeat] = createSignal<RoomBeat>('answer')
  const [tone, setTone] = createSignal<'neutral' | 'right' | 'wrong'>('neutral')
  const [held, setHeld] = createSignal(false)
  const onBack = vi.fn()
  const room: StageRoom = {
    run: () => run,
    beat,
    sounding: () => false,
    prompt: 'Two notes. Name the interval.',
    line: () => ({ kind: 'rounds', round: 3, total: 12, answered: 2 }),
    replay: { allowed: () => beat() === 'reveal', play: vi.fn() },
    parked: () => false,
    next: vi.fn(),
    pause: vi.fn(),
    hold: vi.fn(() => setHeld(true)),
    held,
    resume: vi.fn(() => setHeld(false)),
    abandon: vi.fn(),
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
      status="That was a perfect fifth. Listen again."
      tone={tone()}
      instrument={() => <span>arc</span>}
      console={pads}
      done={() => beat() === 'done'}
      onBack={onBack}
      room={room}
    />
  ))
  return { setBeat, setTone, room, onBack }
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
})
