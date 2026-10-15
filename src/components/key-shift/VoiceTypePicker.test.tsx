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

  it('asks a first time without any key that fits yet', () => {
    open()

    const dialog = screen.getByRole('dialog', { name: /your voice/i })
    expect(dialog).toHaveTextContent(
      'Find my key moves the song into your range.',
    )
    expect(dialog.querySelector('[aria-current]')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Back to original key' }),
    ).toBeNull()
  })

  it('says the key already fits, and marks the voice picked before', () => {
    render(() => (
      <VoiceTypePicker
        open
        fits={-2}
        current="bass"
        onPick={vi.fn()}
        onCancel={vi.fn()}
      />
    ))

    const dialog = screen.getByRole('dialog', { name: /your voice/i })
    expect(dialog).toHaveAccessibleDescription(
      'Key −2 already fits your voice. Pick another voice to try a different key.',
    )
    const marked = [...dialog.querySelectorAll('[aria-current="true"]')]
    expect(marked.map((voice) => voice.getAttribute('data-voice'))).toEqual([
      'bass',
    ])
  })

  it('says when the song’s own key already fits', () => {
    render(() => (
      <VoiceTypePicker open fits={0} onPick={vi.fn()} onCancel={vi.fn()} />
    ))

    expect(
      screen.getByRole('dialog', { name: /your voice/i }),
    ).toHaveAccessibleDescription(
      "The song's own key already fits your voice. Pick another voice to try a different key.",
    )
  })

  it('takes the song back to its own key, when it is in another', () => {
    const onOriginalKey = vi.fn<() => void>()
    render(() => (
      <VoiceTypePicker
        open
        fits={-2}
        onPick={vi.fn()}
        onCancel={vi.fn()}
        onOriginalKey={onOriginalKey}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to original key' }),
    )

    expect(onOriginalKey).toHaveBeenCalledTimes(1)
  })

  // A press on the picker's words gives the focus to the nearest focusable
  // element around them. That was the page behind the dialog, where Escape
  // and Space reached the mixer; the dialog itself takes it now. jsdom moves
  // no focus on a press, so the test gives it as a browser would: the voice
  // the dialog opened on lets go, and the dialog is offered the focus.
  it('takes the focus itself, so Escape after a press on its words still closes it', async () => {
    const { onCancel } = open()
    const dialog = screen.getByRole('dialog', { name: /your voice/i })
    await Promise.resolve()
    ;(document.activeElement as HTMLElement).blur()

    dialog.focus()
    const focused = document.activeElement === dialog
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    })

    expect([focused, onCancel.mock.calls.length]).toEqual([true, 1])
  })

  it('renders nothing while closed', () => {
    render(() => (
      <VoiceTypePicker open={false} onPick={vi.fn()} onCancel={vi.fn()} />
    ))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
