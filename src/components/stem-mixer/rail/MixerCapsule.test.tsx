// The capsule: every control named and in tab order, Loop and Hear my voice
// that wait for what they need and say so in words, the mic's state in one
// fixed-size button, Speed folding into More, and More itself.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'
import type { OverflowMenuItem } from '@/components/OverflowMenu'
import { LOOP_NEEDS_B, LOOP_NEEDS_MARKS, MIC_BLOCKED, MixerCapsule, MONITOR_NEEDS_MIC, } from './MixerCapsule'
import { REASON_PRESS_MS } from './ReasonHold'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const keyBinding = (): KeyShiftBinding => ({
  value: () => 0,
  heard: () => 0,
  onChange: () => {},
  keyLabel: () => undefined,
  suggestion: () => null,
  onFindKey: () => {},
  disabledReason: () => undefined,
})

interface Extra {
  moreItems?: OverflowMenuItem[]
  speedFolded?: boolean
  speed?: number
}

function mount(extra: Extra = {}) {
  const [playing, setPlaying] = createSignal(false)
  const [loopStart, setLoopStart] = createSignal<number | null>(null)
  const [loopEnd, setLoopEnd] = createSignal<number | null>(null)
  const [loopEnabled, setLoopEnabled] = createSignal(false)
  const [micActive, setMicActive] = createSignal(false)
  const [micError, setMicError] = createSignal('')
  const [monitor, setMonitor] = createSignal(false)
  const [speed, setSpeed] = createSignal(extra.speed ?? 1)
  const [speedFolded, setSpeedFolded] = createSignal(extra.speedFolded ?? false)
  const calls = {
    play: vi.fn(() => setPlaying(true)),
    pause: vi.fn(() => setPlaying(false)),
    stop: vi.fn(),
    restart: vi.fn(),
    setA: vi.fn(() => setLoopStart(5)),
    setB: vi.fn(() => {
      setLoopEnd(9)
      setLoopEnabled(true)
    }),
    toggleLoop: vi.fn(() => setLoopEnabled((on) => !on)),
    clearLoop: vi.fn(() => {
      setLoopStart(null)
      setLoopEnd(null)
      setLoopEnabled(false)
    }),
    toggleMic: vi.fn(() => setMicActive((on) => !on)),
    toggleMonitor: vi.fn(() => setMonitor((on) => !on)),
    speed: vi.fn(setSpeed),
  }
  render(() => (
    <MixerCapsule
      playing={playing()}
      onPlay={calls.play}
      onPause={calls.pause}
      onStop={calls.stop}
      onRestart={calls.restart}
      loopStart={loopStart()}
      loopEnd={loopEnd()}
      loopEnabled={loopEnabled()}
      onSetLoopA={calls.setA}
      onSetLoopB={calls.setB}
      onToggleLoop={calls.toggleLoop}
      onClearLoop={calls.clearLoop}
      speed={speed()}
      onSpeedChange={calls.speed}
      speedFolded={speedFolded()}
      keyControl={keyBinding()}
      micActive={micActive()}
      micError={micError()}
      onToggleMic={calls.toggleMic}
      micMonitorEnabled={monitor()}
      onToggleMicMonitor={calls.toggleMonitor}
      moreItems={extra.moreItems}
    />
  ))
  return {
    calls,
    setLoopStart,
    setLoopEnd,
    setLoopEnabled,
    setMicError,
    setMicActive,
    setSpeed,
    setSpeedFolded,
  }
}

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const loopToggle = () => button('Loop')
const monitorToggle = () => button('Hear my voice')
const mic = () => button('Microphone')
const more = () => screen.getByTestId('mixer-more')
const openMore = () => fireEvent.click(more())
/** The hold around a control: it says whether the reason is showing. */
const hold = (control: HTMLElement) => control.parentElement as HTMLElement

describe('MixerCapsule', () => {
  it('names every control, in the order Tab reaches them', () => {
    mount()

    const names = screen
      .getAllByRole('button')
      .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim())
    expect(names).toEqual([
      'Play',
      'Stop',
      'Play from the start',
      'Set loop start (A)',
      'Set loop end (B)',
      'Loop',
      'Microphone',
      'Hear my voice',
      'Playback speed 1x',
      'Key',
      'More playback options',
    ])
    // The key chip has no aria-label: its name is what it says.
    expect(screen.getByTestId('key-chip')).toHaveAccessibleName('Key')
  })

  it('draws its two ends for the rail to place either side of the timeline', () => {
    mount()

    const left = screen.getByTestId('mixer-capsule')
    const right = screen.getByTestId('mixer-capsule-end')
    expect(left).toContainElement(button('Play'))
    expect(left).toContainElement(button('Playback speed 1x'))
    expect(right).toContainElement(screen.getByTestId('key-chip'))
    expect(right).toContainElement(more())
  })

  it('plays, then offers Pause in the same place', () => {
    const { calls } = mount()

    fireEvent.click(button('Play'))
    fireEvent.click(button('Pause'))

    expect(calls.play).toHaveBeenCalledTimes(1)
    expect(calls.pause).toHaveBeenCalledTimes(1)
    fireEvent.click(button('Play from the start'))
    fireEvent.click(button('Stop'))
    expect(calls.restart).toHaveBeenCalledTimes(1)
    expect(calls.stop).toHaveBeenCalledTimes(1)
  })

  it('holds the loop toggle until A and B make a loop, and says what is missing', () => {
    const { calls } = mount()
    expect(loopToggle()).toHaveAttribute('aria-disabled', 'true')
    expect(loopToggle()).not.toBeDisabled()
    expect(loopToggle()).toHaveAccessibleDescription(LOOP_NEEDS_MARKS)

    fireEvent.click(button('Set loop start (A)'))
    expect(button('Set loop start (A)')).toHaveAttribute('data-set', 'true')
    expect(button('Set loop end (B)')).toHaveAttribute('data-set', 'false')
    expect(loopToggle()).toHaveAttribute('aria-disabled', 'true')
    expect(loopToggle()).toHaveAccessibleDescription(LOOP_NEEDS_B)

    fireEvent.click(button('Set loop end (B)'))
    expect(button('Set loop end (B)')).toHaveAttribute('data-set', 'true')
    expect(loopToggle()).not.toHaveAttribute('aria-disabled')
    expect(loopToggle()).not.toHaveAttribute('aria-describedby')
    expect(loopToggle()).toHaveAccessibleDescription('Stop looping')
    expect(loopToggle()).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(loopToggle())
    expect(calls.toggleLoop).toHaveBeenCalledTimes(1)
    expect(loopToggle()).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the reason on a press for a few seconds, and runs nothing', () => {
    vi.useFakeTimers()
    const { calls } = mount()
    expect(hold(loopToggle())).toHaveAttribute('data-hint', 'off')

    fireEvent.click(loopToggle())

    expect(calls.toggleLoop).not.toHaveBeenCalled()
    expect(hold(loopToggle())).toHaveAttribute('data-hint', 'on')
    expect(
      within(hold(loopToggle())).getByTestId('rail-reason'),
    ).toHaveTextContent(LOOP_NEEDS_MARKS)
    vi.advanceTimersByTime(REASON_PRESS_MS)
    expect(hold(loopToggle())).toHaveAttribute('data-hint', 'off')
  })

  it('shows the reason while the pointer is over the control, or it has focus', () => {
    mount()

    fireEvent.pointerEnter(loopToggle())
    expect(hold(loopToggle())).toHaveAttribute('data-hint', 'on')
    fireEvent.pointerLeave(loopToggle())
    expect(hold(loopToggle())).toHaveAttribute('data-hint', 'off')

    fireEvent.focus(loopToggle())
    expect(hold(loopToggle())).toHaveAttribute('data-hint', 'on')
    fireEvent.blur(loopToggle())
    expect(hold(loopToggle())).toHaveAttribute('data-hint', 'off')
  })

  it('holds the loop toggle for a span too short to play, as the clock would', () => {
    const { setLoopStart, setLoopEnd } = mount()
    setLoopStart(5)

    setLoopEnd(5.05)
    expect(loopToggle()).toHaveAttribute('aria-disabled', 'true')

    setLoopEnd(5.2)
    expect(loopToggle()).not.toHaveAttribute('aria-disabled')
  })

  it('keeps a loop that is on reachable, so it can be turned off', () => {
    const { setLoopStart, setLoopEnabled } = mount()
    // On with A alone, which loops from A to the end: however it got there.
    setLoopStart(5)
    setLoopEnabled(true)

    expect(loopToggle()).not.toHaveAttribute('aria-disabled')
    expect(loopToggle()).toHaveAttribute('aria-pressed', 'true')
  })

  it('holds Hear my voice until the mic is on, and says so', () => {
    const { calls } = mount()
    expect(monitorToggle()).toHaveAttribute('aria-disabled', 'true')
    expect(monitorToggle()).toHaveAccessibleDescription(MONITOR_NEEDS_MIC)
    fireEvent.click(monitorToggle())
    expect(calls.toggleMonitor).not.toHaveBeenCalled()

    fireEvent.click(mic())

    expect(calls.toggleMic).toHaveBeenCalledTimes(1)
    expect(mic()).toHaveAttribute('aria-pressed', 'true')
    expect(mic()).toHaveAttribute('data-state', 'on')
    expect(monitorToggle()).not.toHaveAttribute('aria-disabled')
    fireEvent.click(monitorToggle())
    expect(calls.toggleMonitor).toHaveBeenCalledTimes(1)
    expect(monitorToggle()).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps one mic button whatever its state: off, on, failed', () => {
    const { setMicActive, setMicError } = mount()
    expect(mic()).toHaveAttribute('aria-pressed', 'false')
    expect(mic()).toHaveAttribute('data-state', 'off')

    setMicActive(true)
    expect(mic()).toHaveAttribute('data-state', 'on')

    setMicActive(false)
    setMicError('The microphone is in use by another app.')
    expect(mic()).toHaveAttribute('data-state', 'error')
    expect(screen.getAllByRole('button', { name: 'Microphone' })).toHaveLength(
      1,
    )
  })

  it('says how to unblock a refused mic, and still takes the press that retries', () => {
    const { calls, setMicError } = mount()
    setMicError('Microphone access was denied.')

    expect(mic()).toHaveAccessibleDescription(MIC_BLOCKED)
    expect(mic()).not.toHaveAttribute('aria-disabled')
    fireEvent.click(mic())
    expect(calls.toggleMic).toHaveBeenCalledTimes(1)
    expect(hold(mic())).toHaveAttribute('data-hint', 'on')
  })

  it('says any other mic failure in its own words, with the retry', () => {
    const { setMicError } = mount()
    setMicError('The microphone is in use by another app.')

    expect(mic()).toHaveAccessibleDescription(
      'The microphone is in use by another app. Press to try again.',
    )
  })

  it('clears the loop from More, and only when there is one', () => {
    const { calls } = mount()
    openMore()
    expect(screen.getByRole('menuitem', { name: 'Clear loop' })).toBeDisabled()
    fireEvent.keyDown(document.body, { key: 'Escape' })

    fireEvent.click(button('Set loop start (A)'))
    openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear loop' }))

    expect(calls.clearLoop).toHaveBeenCalledTimes(1)
    expect(button('Set loop start (A)')).toHaveAttribute('data-set', 'false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it("puts the host's rows in More, after Clear loop", () => {
    const onSelect = vi.fn()
    mount({
      moreItems: [
        {
          key: 'show-lyrics',
          label: 'Lyrics',
          checked: true,
          checkType: 'checkbox',
          onSelect,
        },
      ],
    })
    openMore()

    const rows = Array.from(
      screen.getByRole('menu').querySelectorAll('[role^="menuitem"]'),
    ).map((row) => row.textContent?.trim())
    expect(rows).toEqual(['Clear loop', 'Lyrics'])
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Lyrics' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

describe('Speed, folded into More', () => {
  it('moves from the chip to radio rows in More, never both', () => {
    const { setSpeedFolded } = mount()
    expect(screen.getByTestId('speed-chip')).toBeInTheDocument()

    setSpeedFolded(true)

    expect(screen.queryByTestId('speed-chip')).toBeNull()
    openMore()
    const speeds = screen
      .getAllByRole('menuitemradio')
      .map((row) => row.textContent?.trim())
    expect(speeds).toEqual([
      'Speed 0.5x',
      'Speed 0.75x',
      'Speed 0.85x',
      'Speed 1x',
      'Speed 1.2x',
      'Speed 1.5x',
      'Speed 1.75x',
      'Speed 2x',
    ])
    expect(
      screen.getByRole('menuitemradio', { name: 'Speed 1x' }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('sets the speed from More', () => {
    const { calls } = mount({ speedFolded: true })
    openMore()

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Speed 0.75x' }))

    expect(calls.speed).toHaveBeenCalledWith(0.75)
  })

  it('says a speed other than 1x on More: a dot, and in its name', () => {
    const { setSpeed } = mount({ speedFolded: true })
    const slot = () => more().parentElement as HTMLElement
    expect(more()).toHaveAccessibleName('More playback options')
    expect(slot()).toHaveAttribute('data-dot', 'false')

    setSpeed(0.75)

    expect(more()).toHaveAccessibleName('More playback options. Speed 0.75x')
    expect(slot()).toHaveAttribute('data-dot', 'true')
  })

  it('points the tour at More while Speed is in it', () => {
    const { setSpeedFolded } = mount()
    const speedStep = () =>
      Array.from(document.querySelectorAll('[data-tour="mixer.speed"]'))
    expect(speedStep()).toHaveLength(1)
    expect(speedStep()[0]).toContainElement(screen.getByTestId('speed-chip'))

    setSpeedFolded(true)

    expect(speedStep()).toHaveLength(1)
    expect(speedStep()[0]).toContainElement(more())
  })
})
