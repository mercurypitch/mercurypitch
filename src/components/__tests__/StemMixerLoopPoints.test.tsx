// ============================================================
// StemMixer — setting A and B from the rail and the keyboard
// ============================================================
//
// Two defects, both in how the mixer decided a point was "set":
//
//   - an A at exactly 0:00 never lit, because set meant `loopStart() > 0`;
//   - B on the same instant as A was taken, and the loop it made held the
//     playhead on A for good (see useStemMixerAudioController.loop.test.ts).
//
// The rail buttons and the A/B keys go through one rule, so this mounts the
// mixer whole and presses both.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notifications, resetNotifications } from '@/stores/notifications-store'

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia

import { StemMixer } from '@/components/StemMixer'

const B_TOO_SOON =
  'The loop end (B) has to be at least 0.1 s after its start (A).'

beforeEach(() => {
  resetNotifications()
  localStorage.clear()
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  ;(
    AudioContext.prototype as unknown as Record<string, unknown>
  ).decodeAudioData = async () =>
    ({
      duration: 12,
      length: 512,
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(512),
    }) as unknown as AudioBuffer
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    status: 200,
    body: null,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(64),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

async function mountLoadedMixer(): Promise<void> {
  render(() => (
    <StemMixer
      stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
      sessionId="loop-points"
      songTitle="Consent"
    />
  ))
  await screen.findByRole('button', { name: 'Set loop start (A)' })
}

const buttonA = () => screen.getByRole('button', { name: 'Set loop start (A)' })
const buttonB = () => screen.getByRole('button', { name: 'Set loop end (B)' })
const loopToggle = () =>
  screen.queryByRole('button', { name: /^(Enable|Disable) loop$/ })
const shown = () => notifications().map((note) => note.message)

/** Click the timeline at `seconds` of the 12 s song, as a paused singer does. */
function seekTo(seconds: number): void {
  const bar = document.querySelector<HTMLElement>('.sm-progress-bar')
  if (bar === null) throw new Error('no timeline')
  bar.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 120,
      height: 6,
      right: 120,
      bottom: 6,
    }) as DOMRect
  fireEvent.click(bar, { clientX: (seconds / 12) * 120 })
}

describe('loop points on the mixer rail', () => {
  it('lights an A set at 0:00', async () => {
    await mountLoadedMixer()

    fireEvent.click(buttonA())

    expect(buttonA()).toHaveClass('sm-loop-btn--a-set')
  })

  it('refuses a B on the same instant as A, and says why', async () => {
    await mountLoadedMixer()
    seekTo(5)
    fireEvent.click(buttonA())

    fireEvent.click(buttonB())

    expect(buttonB()).not.toHaveClass('sm-loop-btn--b-set')
    expect(loopToggle()).toBeNull()
    expect(shown()).toContain(B_TOO_SOON)
  })

  it('takes A and B from the keyboard by the same rule', async () => {
    await mountLoadedMixer()
    seekTo(5)

    fireEvent.keyDown(document.body, { key: 'a', code: 'KeyA' })
    fireEvent.keyDown(document.body, { key: 'b', code: 'KeyB' })

    expect(buttonA()).toHaveClass('sm-loop-btn--a-set')
    expect(buttonB()).not.toHaveClass('sm-loop-btn--b-set')
    expect(shown()).toContain(B_TOO_SOON)
  })
})
