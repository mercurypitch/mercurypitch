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
// except in a typing surface (the speed select included) or a dialog, menu
// or listbox. A, B, S, L and M stay out of the same places, and out of
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
const speedSelect = () =>
  screen.getByRole('combobox', { name: 'Playback speed' })

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
    expect(buttonA()).not.toHaveClass('sm-loop-btn--a-set')
  })

  it('leaves Space to the speed select, which opens on it', async () => {
    await mountLoadedMixer()
    speedSelect().focus()

    const kept = space(speedSelect())

    expect(kept).toBe(true)
    expect(isPlaying()).toBe(false)
  })

  it('leaves letters to the speed select, which jumps between speeds on them', async () => {
    await mountLoadedMixer()
    speedSelect().focus()

    press(speedSelect(), 'a')
    press(speedSelect(), 'l')

    expect(buttonA()).not.toHaveClass('sm-loop-btn--a-set')
    expect(
      screen.queryByRole('button', { name: /^(Enable|Disable) loop$/ }),
    ).toBeNull()
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
    expect(buttonA()).not.toHaveClass('sm-loop-btn--a-set')
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
    expect(buttonA()).not.toHaveClass('sm-loop-btn--a-set')
  })

  it('leaves modifier chords to the browser', async () => {
    await mountLoadedMixer()

    press(document.body, 'a', { ctrlKey: true })
    press(document.body, 'a', { metaKey: true })

    expect(buttonA()).not.toHaveClass('sm-loop-btn--a-set')
  })

  it('still sets A from the page', async () => {
    await mountLoadedMixer()

    press(document.body, 'a')

    expect(buttonA()).toHaveClass('sm-loop-btn--a-set')
  })
})
