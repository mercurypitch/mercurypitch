// ============================================================
// The karaoke key on the phone stage
// ============================================================
//
// The phone shows only this stage, so the key has to be reachable from it.
// The bar has no room for a stepper beside the transport (the mic and the
// music level already fill the left slot), so the empty right slot carries
// one key button, and the stepper and "Find my key" live in a sheet it opens.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { KaraokeMobileStageProps } from '@/components/KaraokeMobileStage'
import { KaraokeMobileStage } from '@/components/KaraokeMobileStage'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(cleanup)

function makeProps(
  over: Partial<KaraokeMobileStageProps> = {},
): KaraokeMobileStageProps {
  return {
    songTitle: 'Test Song',
    playing: () => false,
    loading: () => false,
    loadError: () => '',
    elapsed: () => 0,
    duration: () => 200,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSeekToStart: vi.fn(),
    seekTo: vi.fn(),
    hasPrevItem: () => false,
    hasNextItem: () => false,
    onPrevItem: vi.fn(),
    onNextItem: vi.fn(),
    autoplayEnabled: () => false,
    onToggleAutoplay: vi.fn(),
    vocal: () => ({ muted: false, volume: 0.8 }),
    onToggleVocal: vi.fn(),
    onVocalVolume: vi.fn(),
    parsedLyrics: () => new Map(),
    currentLineIdx: () => -1,
    lyricsLoading: () => false,
    computeActiveWord: () => ({ activeUpTo: -1, charProgress: 0, fraction: 0 }),
    onLineClick: vi.fn(),
    playlistOverlayActive: () => false,
    onPlaylistStart: vi.fn(),
    onPlaylistSkip: vi.fn(),
    ...over,
  }
}

function mountWithKey(over: Partial<KeyShiftBinding> = {}) {
  const [value, setValue] = createSignal(2)
  const onFindKey = vi.fn<() => void>()
  const binding: KeyShiftBinding = {
    value,
    onChange: setValue,
    keyLabel: () => 'A major',
    suggestion: () => null,
    onFindKey,
    disabledReason: () => undefined,
    ...over,
  }
  render(() =>
    KaraokeMobileStage(
      makeProps({ onToggleMic: vi.fn(), keyControl: binding }),
    ),
  )
  return { value, onFindKey }
}

const keyButton = () => screen.getByTestId('mobile-key-shift')

describe('the key on the phone stage', () => {
  it('sits in the slot opposite the mic and reads the key', () => {
    mountWithKey()

    const mic = screen.getByLabelText('Toggle your microphone')
    const row = mic.parentElement?.parentElement
    expect(row?.lastElementChild?.contains(keyButton())).toBe(true)
    expect(row?.lastElementChild?.getAttribute('aria-hidden')).toBeNull()
    expect(keyButton().textContent).toContain('+2')
  })

  it('opens a sheet with the stepper and "Find my key"', () => {
    const { value, onFindKey } = mountWithKey()

    fireEvent.click(keyButton())
    const sheet = screen.getByRole('dialog', { name: 'Key' })
    expect(sheet.textContent).toContain('A major')

    fireEvent.click(screen.getByRole('button', { name: 'Raise the key' }))
    expect(value()).toBe(3)
    expect(keyButton().textContent).toContain('+3')

    fireEvent.click(screen.getByRole('button', { name: /find my key/i }))
    expect(onFindKey).toHaveBeenCalledTimes(1)
  })

  it('says why the key cannot change, from the sheet', () => {
    mountWithKey({
      disabledReason: () => 'Changing the key is not available right now',
    })

    fireEvent.click(keyButton())

    expect(
      screen.getByRole('button', { name: 'Raise the key' }),
    ).toHaveProperty('disabled', true)
    expect(screen.getByRole('dialog', { name: 'Key' }).textContent).toContain(
      'Changing the key is not available right now',
    )
  })

  it('leaves the slot empty for a host with no key', () => {
    render(() => KaraokeMobileStage(makeProps({ onToggleMic: vi.fn() })))

    expect(screen.queryByTestId('mobile-key-shift')).toBeNull()
  })
})
