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
const loopToggle = () => screen.getByRole('button', { name: 'Loop' })
const shown = () => notifications().map((note) => note.message)

/** Move the timeline to `seconds` of the 12 s song, as a paused singer does. */
function seekTo(seconds: number): void {
  const slider = screen.getByRole<HTMLInputElement>('slider', {
    name: 'Song position',
  })
  slider.value = String(seconds)
  fireEvent.input(slider)
}

describe('loop points on the mixer rail', () => {
  it('lights an A set at 0:00', async () => {
    await mountLoadedMixer()

    fireEvent.click(buttonA())

    expect(buttonA()).toHaveAttribute('data-set', 'true')
  })

  it('refuses a B on the same instant as A, and says why', async () => {
    await mountLoadedMixer()
    seekTo(5)
    fireEvent.click(buttonA())

    fireEvent.click(buttonB())

    expect(buttonB()).toHaveAttribute('data-set', 'false')
    expect(loopToggle()).toBeDisabled()
    expect(shown()).toContain(B_TOO_SOON)
  })

  it('takes A and B from the keyboard by the same rule', async () => {
    await mountLoadedMixer()
    seekTo(5)

    fireEvent.keyDown(document.body, { key: 'a', code: 'KeyA' })
    fireEvent.keyDown(document.body, { key: 'b', code: 'KeyB' })

    expect(buttonA()).toHaveAttribute('data-set', 'true')
    expect(buttonB()).toHaveAttribute('data-set', 'false')
    expect(shown()).toContain(B_TOO_SOON)
  })
})
