// ============================================================
// StemMixer — which layer a key belongs to
// ============================================================
//
// Escape closes the top layer only. With the mixer in focus mode, a menu or
// a dialog over it takes Escape first, and the next press leaves focus mode.
// Before, one press did both: the voice picker closed and focus mode went
// with it.

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
  setKaraokeFocus(false)
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

/** The mixer, loaded, in focus mode, with `beside` drawn over it. */
async function mountInFocusMode(beside?: () => JSX.Element): Promise<void> {
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
  setKaraokeFocus(true)
}

const escape = (target: Element): void => {
  fireEvent.keyDown(target, { key: 'Escape', code: 'Escape' })
}

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
