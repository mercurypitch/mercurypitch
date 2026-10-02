// "Find my key" with no known range asks for a voice type, or a measurement.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VoiceTypePicker } from './VoiceTypePicker'

const build = vi.hoisted(() => ({ native: false }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return build.native
  },
}))

afterEach(() => {
  build.native = false
})

function open() {
  const onPick = vi.fn<(preset: VocalRangePreset) => void>()
  const onCancel = vi.fn<() => void>()
  render(() => <VoiceTypePicker open onPick={onPick} onCancel={onCancel} />)
  return { onPick, onCancel }
}

describe('VoiceTypePicker', () => {
  it('offers every voice type with its range, highest first', () => {
    open()

    const dialog = screen.getByRole('dialog', { name: /your voice/i })
    const voices = [...dialog.querySelectorAll('[data-voice]')].map(
      (button) => button.textContent,
    )
    expect(voices).toEqual([
      'SopranoC4–C6',
      'Mezzo-SopranoA3–A5',
      'AltoF3–F5',
      'TenorC3–C5',
      'BaritoneG2–G4',
      'BassE2–E4',
    ])
  })

  it('hands back the voice type picked', () => {
    const { onPick, onCancel } = open()

    fireEvent.click(screen.getByRole('button', { name: /baritone/i }))

    expect(onPick.mock.calls).toEqual([['baritone']])
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('links to Voice Mirror in a new tab, so the song is not lost', () => {
    open()

    const link = screen.getByRole('link', { name: /measure my range/i })
    expect(link.getAttribute('href')).toBe('/mirror')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('offers no Voice Mirror in the native app, which has none', () => {
    // The app has no /mirror (apps/mercurypitch SettingsScreen); the link
    // opened a tab the app cannot show.
    build.native = true
    open()

    const dialog = screen.getByRole('dialog', { name: /your voice/i })
    expect({
      links: screen.queryAllByRole('link').map((link) => link.textContent),
      body: dialog.querySelector('p')?.textContent,
    }).toEqual({
      links: [],
      body: 'Find my key moves the song into your range. Pick the voice closest to yours.',
    })
  })

  it('cancels from the button and from Escape', () => {
    const { onPick, onCancel } = open()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onPick).not.toHaveBeenCalled()
  })

  it('keeps its keys from the page behind it', () => {
    const { onCancel } = open()
    const page = vi.fn()
    window.addEventListener('keydown', page)
    try {
      const voice = screen.getByRole('button', { name: /baritone/i })
      fireEvent.keyDown(voice, { key: 'a', code: 'KeyA' })
      fireEvent.keyDown(voice, { key: ' ', code: 'Space' })
      fireEvent.keyDown(voice, { key: 'Escape', code: 'Escape' })
    } finally {
      window.removeEventListener('keydown', page)
    }

    expect(page).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders nothing while closed', () => {
    render(() => (
      <VoiceTypePicker open={false} onPick={vi.fn()} onCancel={vi.fn()} />
    ))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
