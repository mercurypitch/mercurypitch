// The capsule: every control named and in tab order, the loop toggle that
// waits for a real A-B, Monitor that waits for the mic, and More.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'
import type { OverflowMenuItem } from '@/components/OverflowMenu'
import { hasPlayableLoop, MixerCapsule } from './MixerCapsule'

afterEach(cleanup)

const keyBinding = (): KeyShiftBinding => ({
  value: () => 0,
  heard: () => 0,
  onChange: () => {},
  keyLabel: () => undefined,
  suggestion: () => null,
  onFindKey: () => {},
  disabledReason: () => undefined,
})

function mount(extra: { moreItems?: OverflowMenuItem[] } = {}) {
  const [playing, setPlaying] = createSignal(false)
  const [loopStart, setLoopStart] = createSignal<number | null>(null)
  const [loopEnd, setLoopEnd] = createSignal<number | null>(null)
  const [loopEnabled, setLoopEnabled] = createSignal(false)
  const [micActive, setMicActive] = createSignal(false)
  const [micError, setMicError] = createSignal('')
  const [monitor, setMonitor] = createSignal(false)
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
      speed={1}
      onSpeedChange={() => {}}
      keyControl={keyBinding()}
      micActive={micActive()}
      micError={micError()}
      onToggleMic={calls.toggleMic}
      micMonitorEnabled={monitor()}
      onToggleMicMonitor={calls.toggleMonitor}
      moreItems={extra.moreItems}
    />
  ))
  return { calls, setLoopStart, setLoopEnabled, setMicError, setMicActive }
}

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const loopToggle = () => button('Loop')
const openMore = () => fireEvent.click(button('More playback options'))

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
      'Playback speed 1x',
      'Key',
      'Enable microphone',
      'Hear my voice',
      'More playback options',
    ])
    // The key chip has no aria-label: its name is what it says.
    expect(screen.getByTestId('key-chip')).toHaveAccessibleName('Key')
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

  it('holds the loop toggle until A and B make a loop', () => {
    const { calls } = mount()
    expect(loopToggle()).toBeDisabled()

    fireEvent.click(button('Set loop start (A)'))
    expect(button('Set loop start (A)')).toHaveAttribute('data-set', 'true')
    expect(button('Set loop end (B)')).toHaveAttribute('data-set', 'false')
    expect(loopToggle()).toBeDisabled()

    fireEvent.click(button('Set loop end (B)'))
    expect(button('Set loop end (B)')).toHaveAttribute('data-set', 'true')
    expect(loopToggle()).toBeEnabled()
    expect(loopToggle()).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(loopToggle())
    expect(calls.toggleLoop).toHaveBeenCalledTimes(1)
    expect(loopToggle()).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps a loop that is on reachable, so it can be turned off', () => {
    const { setLoopStart, setLoopEnabled } = mount()
    // The L key turns a lone A on: it loops from A to the end.
    setLoopStart(5)
    setLoopEnabled(true)

    expect(loopToggle()).toBeEnabled()
    expect(loopToggle()).toHaveAttribute('aria-pressed', 'true')
  })

  it('holds Monitor until the mic is on', () => {
    const { calls } = mount()
    expect(button('Hear my voice')).toBeDisabled()

    fireEvent.click(button('Enable microphone'))

    expect(calls.toggleMic).toHaveBeenCalledTimes(1)
    expect(button('Disable microphone')).toHaveAttribute('aria-pressed', 'true')
    expect(button('Disable microphone')).toHaveAttribute('data-state', 'on')
    fireEvent.click(button('Hear my voice'))
    expect(calls.toggleMonitor).toHaveBeenCalledTimes(1)
    expect(button('Hear my voice')).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers a retry when the mic failed, and says why on hover', () => {
    const { setMicError } = mount()
    setMicError('The microphone is in use by another app.')

    const mic = button('Retry microphone')
    expect(mic).toHaveAttribute('data-state', 'error')
    expect(mic).toHaveAttribute(
      'title',
      'The microphone is in use by another app. Tap to try again.',
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

describe('hasPlayableLoop', () => {
  it('needs B after A; B alone loops from the start', () => {
    expect(hasPlayableLoop(null, null)).toBe(false)
    expect(hasPlayableLoop(5, null)).toBe(false)
    expect(hasPlayableLoop(5, 9)).toBe(true)
    expect(hasPlayableLoop(null, 9)).toBe(true)
    expect(hasPlayableLoop(9, 9)).toBe(false)
  })
})
