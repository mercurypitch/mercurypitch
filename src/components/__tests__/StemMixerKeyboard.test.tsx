// ============================================================
// StemMixer — which layer a key belongs to
// ============================================================
//
// Escape closes the top layer only. With the mixer in focus mode, a menu or
// a dialog over it takes Escape first, and the next press leaves focus mode.
// Before, one press did both: the voice picker closed and focus mode went
// with it.
//
// Space and the letter shortcuts follow the room-wide rule in
// space-playback.ts: Space plays and pauses from anywhere on the mixer,
// except in a typing surface or a dialog, menu or listbox. The speed chip
// is a button, not a typing surface. A, B, S, L and M stay out of the same places, and out of
// modifier chords.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
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

import { VoiceTypePicker } from '@/components/key-shift/VoiceTypePicker'
import { OverflowMenu } from '@/components/OverflowMenu'
import { StemMixer } from '@/components/StemMixer'
import { resetNotifications } from '@/stores/notifications-store'
import { karaokeFocus, setKaraokeFocus } from '@/stores/ui-store'

// The silent <audio> that unlocks playback on iOS is a browser concern, and
// jsdom cannot play it.
vi.mock('@/lib/audio-unlock', () => ({
  installAudioUnlock: () => () => undefined,
  unlockAudio: () => undefined,
  unlockForPlayback: (ensure: () => AudioContext | null) => ensure(),
}))

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
  // The shared mock context has no buffer sources, and Play needs them.
  ;(
    AudioContext.prototype as unknown as Record<string, unknown>
  ).createBufferSource = () => ({
    buffer: null,
    playbackRate: { value: 1 },
    onended: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    status: 200,
    body: null,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(64),
  }))
})

afterEach(() => {
  setKaraokeFocus(false)
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

/** The mixer, loaded, with `beside` drawn over it. */
async function mountLoadedMixer(beside?: () => JSX.Element): Promise<void> {
  render(() => (
    <>
      <StemMixer
        stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
        sessionId="keyboard-layers"
        songTitle="Consent"
      />
      {beside?.()}
    </>
  ))
  await screen.findByRole('button', { name: 'Set loop start (A)' })
}

async function mountInFocusMode(beside?: () => JSX.Element): Promise<void> {
  await mountLoadedMixer(beside)
  setKaraokeFocus(true)
}

const escape = (target: Element): void => {
  fireEvent.keyDown(target, { key: 'Escape', code: 'Escape' })
}

/** Press Space on `target`; true when nothing cancelled its default. */
const space = (target: Element): boolean =>
  fireEvent.keyDown(target, { key: ' ', code: 'Space' })

const press = (target: Element, key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, {
    key,
    code: `Key${key.toUpperCase()}`,
    ...init,
  })

const isPlaying = (): boolean =>
  screen.queryByRole('button', { name: 'Pause' }) !== null
const buttonA = () => screen.getByRole('button', { name: 'Set loop start (A)' })
const speedChip = () => screen.getByTestId('speed-chip')
const isSet = (button: HTMLElement): boolean =>
  button.getAttribute('data-set') === 'true'

describe('Escape in focus mode', () => {
  it('leaves focus mode when nothing is open over the mixer', async () => {
    await mountInFocusMode()

    escape(document.body)

    expect(karaokeFocus()).toBe(false)
  })

  it('lets an open menu take Escape first, and leaves on the next press', async () => {
    await mountInFocusMode(() => (
      <OverflowMenu
        label="Mixer options"
        items={[{ key: 'reset', label: 'Reset the mix', onSelect: () => {} }]}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Mixer options' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    escape(document.body)

    expect(screen.queryByRole('menu')).toBeNull()
    expect(karaokeFocus()).toBe(true)

    escape(document.body)

    expect(karaokeFocus()).toBe(false)
  })

  it('leaves Escape to the voice picker, which closes on its own', async () => {
    const onCancel = vi.fn()
    await mountInFocusMode(() => (
      <VoiceTypePicker open onPick={() => {}} onCancel={onCancel} />
    ))

    escape(screen.getByRole('button', { name: /baritone/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(karaokeFocus()).toBe(true)
  })

  it('leaves Escape to whatever dialog, menu or listbox holds the focus', async () => {
    await mountInFocusMode(() => (
      <>
        <div role="dialog" aria-label="Lyrics offset">
          <button type="button">Earlier</button>
        </div>
        <div role="menu" aria-label="Dock">
          <button type="button" role="menuitem">
            Top
          </button>
        </div>
        <div role="listbox" aria-label="Songs">
          <div role="option" tabindex="0" aria-selected="false">
            Consent
          </div>
        </div>
      </>
    ))

    escape(screen.getByRole('button', { name: 'Earlier' }))
    escape(screen.getByRole('menuitem', { name: 'Top' }))
    escape(screen.getByRole('option', { name: 'Consent' }))

    expect(karaokeFocus()).toBe(true)
  })
})

describe('Space and the letter shortcuts', () => {
  it('plays from a focused button without pressing it', async () => {
    await mountLoadedMixer()
    buttonA().focus()

    const kept = space(buttonA())

    expect(isPlaying()).toBe(true)
    expect(kept).toBe(false)
    expect(isSet(buttonA())).toBe(false)
  })

  // The speed is a chip now, not a native select: a button like the rest,
  // so Space plays and the letters stay shortcuts while it has focus.
  it('plays from the speed chip without opening its list', async () => {
    await mountLoadedMixer()
    speedChip().focus()

    const kept = space(speedChip())

    expect(isPlaying()).toBe(true)
    expect(kept).toBe(false)
    expect(speedChip()).toHaveAttribute('aria-expanded', 'false')
  })

  it('takes the letter shortcuts from the speed chip', async () => {
    await mountLoadedMixer()
    speedChip().focus()

    press(speedChip(), 'a')

    expect(isSet(buttonA())).toBe(true)
  })

  it('takes no keys from inside a dialog, menu or listbox', async () => {
    await mountLoadedMixer(() => (
      <div role="dialog" aria-label="Lyrics offset">
        <button type="button">Earlier</button>
      </div>
    ))
    const inDialog = screen.getByRole('button', { name: 'Earlier' })
    inDialog.focus()

    const kept = space(inDialog)
    press(inDialog, 'a')

    expect(kept).toBe(true)
    expect(isPlaying()).toBe(false)
    expect(isSet(buttonA())).toBe(false)
  })

  it('takes no keys while the voice picker is open', async () => {
    await mountLoadedMixer(() => (
      <VoiceTypePicker open onPick={() => {}} onCancel={() => {}} />
    ))
    const voice = screen.getByRole('button', { name: /baritone/i })
    voice.focus()

    space(voice)
    press(voice, 'a')

    expect(isPlaying()).toBe(false)
    expect(isSet(buttonA())).toBe(false)
  })

  it('leaves modifier chords to the browser', async () => {
    await mountLoadedMixer()

    press(document.body, 'a', { ctrlKey: true })
    press(document.body, 'a', { metaKey: true })

    expect(isSet(buttonA())).toBe(false)
  })

  it('still sets A from the page', async () => {
    await mountLoadedMixer()

    press(document.body, 'a')

    expect(isSet(buttonA())).toBe(true)
  })
})
