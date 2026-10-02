// ============================================================
// The phone stage's More: speed and the A/B loop, wired to the mixer
// ============================================================
//
// KaraokeMoreSheet.test.tsx proves the sheet keeps the rules when it is
// handed a binding. This mounts the mixer whole at phone width, the only
// place the sheet appears, and checks the binding StemMixer hands it: the
// points land where the song is, B on A is refused with the mixer's own
// reason, the switch waits for a loop, the bar draws it, and the speed
// chosen is the speed the mixer plays at.

import { fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@/lib/use-viewport', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isNarrow: () => true,
  isMobile: () => true,
}))

// The silent <audio> that unlocks playback on iOS is a browser concern, and
// jsdom cannot play it.
vi.mock('@/lib/audio-unlock', () => ({
  installAudioUnlock: () => () => undefined,
  unlockAudio: () => undefined,
}))

import { StemMixer } from '@/components/StemMixer'
import { resetNotifications } from '@/stores/notifications-store'

beforeEach(() => {
  resetNotifications()
  localStorage.clear()
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  ;(
    AudioContext.prototype as unknown as Record<string, unknown>
  ).decodeAudioData = async () =>
    ({
      duration: 30,
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

/** The mixer at phone width, its song loaded. */
async function mountPhone(): Promise<HTMLElement> {
  render(() => (
    <StemMixer
      stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
      sessionId="phone-more"
      songTitle="Consent"
    />
  ))
  const stage = await screen.findByTestId('karaoke-mobile-stage')
  await waitFor(() => {
    expect(stage.textContent).toContain('0:30')
  })
  return stage
}

const sheet = () => within(screen.getByTestId('karaoke-more-sheet'))
const openMore = (stage: HTMLElement): void => {
  fireEvent.click(within(stage).getByRole('button', { name: 'More' }))
}
const closeMore = (): void => {
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'More' }), {
    key: 'Escape',
  })
}

describe('the phone stage, More', () => {
  it('refuses B on A with the reason in the sheet, and waits for a loop before it can loop', async () => {
    const stage = await mountPhone()
    openMore(stage)

    fireEvent.click(sheet().getByRole('button', { name: 'Set A' }))
    fireEvent.click(sheet().getByRole('button', { name: 'Set B' }))
    const refused = {
      status: sheet().getByTestId('karaoke-more-loop-status').textContent,
      a: sheet().getByTestId('karaoke-more-point-a').textContent,
      b: sheet().getByTestId('karaoke-more-point-b').textContent,
      switchOff: sheet()
        .getByRole('switch', { name: 'Loop A to B' })
        .hasAttribute('disabled'),
    }

    expect(refused).toEqual({
      status: 'The loop end (B) has to be at least 0.1 s after its start (A).',
      a: '0:00.0',
      b: 'Not set',
      switchOff: true,
    })
  })

  it('sets B where the song is, loops, and draws the loop on the bar', async () => {
    const stage = await mountPhone()
    openMore(stage)
    fireEvent.click(sheet().getByRole('button', { name: 'Set A' }))
    closeMore()

    // Ten seconds on, by the bar's own keys.
    fireEvent.keyDown(
      within(stage).getByRole('slider', { name: 'Playback position' }),
      { key: 'PageUp' },
    )
    openMore(stage)
    fireEvent.click(sheet().getByRole('button', { name: 'Set B' }))
    const loopSwitch = sheet().getByRole('switch', { name: 'Loop A to B' })

    expect({
      b: sheet().getByTestId('karaoke-more-point-b').textContent,
      looping: loopSwitch.getAttribute('aria-checked'),
      switchOff: loopSwitch.hasAttribute('disabled'),
      bar: [
        within(stage).getByTestId('scrubber-loop-a').style.left,
        within(stage).getByTestId('scrubber-loop-b').style.left,
      ],
    }).toEqual({
      b: '0:10.0',
      looping: 'true',
      switchOff: false,
      bar: ['0%', `${(10 / 30) * 100}%`],
    })
  })

  it('plays at the speed chosen', async () => {
    const stage = await mountPhone()
    openMore(stage)

    fireEvent.click(sheet().getByRole('radio', { name: '0.75x' }))
    closeMore()
    openMore(stage)

    expect(
      sheet()
        .getAllByRole('radio')
        .filter((radio) => radio.getAttribute('aria-checked') === 'true')
        .map((radio) => radio.textContent?.trim()),
    ).toEqual(['0.75x'])
  })
})
