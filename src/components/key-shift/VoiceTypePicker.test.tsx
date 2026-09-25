// "Find my key" with no known range asks for a voice type, or a measurement.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VoiceTypePicker } from './VoiceTypePicker'

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

  it('cancels from the button and from Escape', () => {
    const { onPick, onCancel } = open()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onPick).not.toHaveBeenCalled()
  })

  it('renders nothing while closed', () => {
    render(() => (
      <VoiceTypePicker open={false} onPick={vi.fn()} onCancel={vi.fn()} />
    ))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
