// ============================================================
// The mic button: the state a room names, and a ring that follows the voice
// ============================================================
//
// Frames are flushed by hand on a clock the test moves, and the voice is
// the capture's own frames read as the rooms read them (newestLevel), so
// the ring is driven exactly as it is on the singer's turn.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerShellApi } from '@/stores/native-shell-store'
import type { MicState } from './mic-state'
import { RING_REST_OPACITY } from './mic-state'
import { MicBlocked, MicButton } from './RoomControls'
import styles from './RoomControls.module.css'
import { newestLevel } from './voice-level'

let queued: FrameRequestCallback[] = []
let clock = 0

/** One screen frame, `ms` after the last. */
function frame(ms = 16): void {
  clock += ms
  const due = queued
  queued = []
  for (const callback of due) callback(clock)
}

function frames(count: number): void {
  for (let i = 0; i < count; i++) frame()
}

/** The capture's frames: a voice at -10 dBFS, or the room at -60. */
const VOICE = { rms: 0.32 }
const ROOM = { rms: 0.001 }

function reduceMotion(on: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: on && query.includes('reduce'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }))
}

interface Mounted {
  setState: (state: MicState) => void
  heard: { rms: number }[]
  button: HTMLButtonElement
  ring: HTMLElement
}

function mount(state: MicState, opts: { still?: boolean } = {}): Mounted {
  const [current, setState] = createSignal<MicState>(state)
  const heard: { rms: number }[] = []
  render(() => (
    <MicButton
      state={current()}
      level={() => newestLevel(heard)}
      pulse={false}
      still={opts.still}
      disabled={false}
      label="Mic"
      onClick={() => undefined}
      testId="mic"
    />
  ))
  const button = screen.getByTestId('mic') as HTMLButtonElement
  const ring = button.querySelector(`.${styles.ring}`) as HTMLElement
  return { setState, heard, button, ring }
}

const scaleOf = (ring: HTMLElement): number =>
  Number(/scale\(([\d.]+)\)/u.exec(ring.style.transform)?.[1] ?? Number.NaN)

beforeEach(() => {
  queued = []
  clock = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queued.push(callback)
    return queued.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  reduceMotion(false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the state the room names', () => {
  it('puts the state on the button as the room moves it', () => {
    const mic = mount('ready')
    const seen = [mic.button.dataset.state]

    for (const state of ['wait', 'sing', 'done'] as const) {
      mic.setState(state)
      seen.push(mic.button.dataset.state)
    }

    expect(seen).toEqual(['ready', 'wait', 'sing', 'done'])
  })

  it('fills the mic only on the singer turn', () => {
    const filled = (button: HTMLElement): boolean =>
      button.querySelector('path[fill="currentColor"]') !== null
    const mic = mount('wait')
    const waiting = filled(mic.button)

    mic.setState('sing')

    expect(waiting).toBe(false)
    expect(filled(mic.button)).toBe(true)
  })
})

describe('the ring on the singer turn', () => {
  it('stays at rest through the room hum', () => {
    const mic = mount('sing')
    mic.heard.push(ROOM)

    frames(30)

    expect(mic.ring.style.transform).toBe('scale(1.000)')
    expect(Number(mic.ring.style.opacity)).toBe(RING_REST_OPACITY)
  })

  it('writes nothing while the level holds still', () => {
    const mic = mount('sing')
    mic.heard.push(ROOM)
    frames(5)
    // Anything the loop wrote would replace this.
    mic.ring.style.transform = 'scale(9)'

    frames(30)

    expect(mic.ring.style.transform).toBe('scale(9)')
  })

  it('grows with a voice within a tenth of a second and falls back in silence', () => {
    const mic = mount('sing')
    mic.heard.push(ROOM)
    frames(5)

    mic.heard.push(VOICE)
    frames(6)
    const sung = scaleOf(mic.ring)
    mic.heard.push(ROOM)
    frames(63)

    expect(sung).toBeGreaterThan(1.2)
    expect(Number(mic.ring.style.opacity)).toBeLessThan(0.5)
    expect(scaleOf(mic.ring)).toBeLessThan(1.02)
  })

  it('writes only its transform and opacity', () => {
    const mic = mount('sing')
    mic.heard.push(VOICE)

    frames(10)

    const written = mic.ring
      .getAttribute('style')
      ?.split(';')
      .map((rule) => rule.split(':')[0].trim())
      .filter((name) => name !== '')
    expect(written?.sort()).toEqual(['opacity', 'transform'])
  })

  it('lets go of the ring when the turn passes back to Merc', () => {
    const mic = mount('sing')
    mic.heard.push(VOICE)
    frames(10)

    mic.setState('wait')
    frames(3)

    expect(mic.ring.getAttribute('style') ?? '').toBe('')
    expect(queued).toHaveLength(0)
  })

  it('asks for no frames while the singer waits', () => {
    mount('wait')

    frames(3)

    expect(queued).toHaveLength(0)
  })
})

describe('reduced motion', () => {
  it('keeps the ring at its size and brightens it in steps with the voice', () => {
    reduceMotion(true)
    const mic = mount('sing')
    mic.heard.push(ROOM)
    frames(5)
    const resting = mic.ring.style.opacity

    mic.heard.push(VOICE)
    frames(10)

    expect(mic.ring.style.transform).toBe('')
    expect(Number(resting)).toBe(RING_REST_OPACITY)
    expect(Number(mic.ring.style.opacity)).toBe(1)
  })
})

describe('a room held still', () => {
  it('draws the ring once at the level it is given and starts no frame loop', () => {
    const mic = (() => {
      const [current] = createSignal<MicState>('sing')
      render(() => (
        <MicButton
          state={current()}
          level={() => 0.6}
          pulse={false}
          still
          disabled={false}
          label="Mic"
          onClick={() => undefined}
          testId="mic"
        />
      ))
      return screen.getByTestId('mic')
    })()
    const ring = mic.querySelector(`.${styles.ring}`) as HTMLElement

    frames(5)

    expect(queued).toHaveLength(0)
    expect(scaleOf(ring)).toBeGreaterThan(1.1)
    expect(mic.classList.contains(styles.still)).toBe(true)
  })

  it('marks the button still in every state, so nothing breathes or pops', () => {
    const mic = mount('ready', { still: true })
    const marked = [mic.button.classList.contains(styles.still)]

    for (const state of ['wait', 'sing', 'done'] as const) {
      mic.setState(state)
      marked.push(mic.button.classList.contains(styles.still))
    }

    expect(marked).toEqual([true, true, true, true])
  })
})

describe('a mic that would not open', () => {
  it('says why, and offers Try again, where the app cannot open its Settings', () => {
    render(() => (
      <MicBlocked
        block="denied"
        onRetry={() => undefined}
        retryTestId="retry"
      />
    ))

    expect(screen.getByRole('alert').textContent).toContain(
      'Merc needs the microphone',
    )
    expect(screen.queryByTestId('mic-open-settings')).toBeNull()
    expect(screen.getByTestId('retry').className).toBe(styles.done)
  })

  it('puts Open Settings first, as the big button, where a retry alone cannot help', () => {
    const unregister = registerShellApi({
      pushSettings: vi.fn(),
      openAppSettings: async () => Promise.resolve(true),
    })
    try {
      render(() => (
        <MicBlocked
          block="denied"
          onRetry={() => undefined}
          retryTestId="retry"
          saidBy="merc"
        />
      ))

      const settings = screen.getByTestId('mic-open-settings')
      expect(settings.className).toBe(styles.done)
      expect(screen.getByTestId('retry').className).toBe(styles.again)
      expect(
        settings.compareDocumentPosition(screen.getByTestId('retry')),
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
      // Merc says why: no second notice under him.
      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      unregister()
    }
  })
})
