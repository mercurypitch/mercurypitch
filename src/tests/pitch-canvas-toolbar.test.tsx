import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { PitchCanvasToolbar } from '@/components/PitchCanvasToolbar'
import { PITCH_VISUAL_COLORS } from '@/features/stem-mixer/pitch-canvas-visuals'

describe('PitchCanvasToolbar singer layers', () => {
  it('exposes violet mic pitch and sung-note controls', () => {
    const setShowMicLine = vi.fn()
    const setShowUserNoteLabels = vi.fn()
    const { container } = render(() => (
      <PitchCanvasToolbar
        showNoteLabels={() => false}
        setShowNoteLabels={vi.fn()}
        showLyricLabels={() => false}
        setShowLyricLabels={vi.fn()}
        showMicLine={() => false}
        setShowMicLine={setShowMicLine}
        showUserNoteLabels={() => false}
        setShowUserNoteLabels={setShowUserNoteLabels}
      />
    ))

    const pitchButton = screen.getByRole('button', { name: 'My Pitch' })
    const notesButton = screen.getByRole('button', { name: 'My Notes' })
    expect(pitchButton).toHaveAttribute(
      'title',
      'Show your mic pitch line (violet)',
    )
    expect(
      container.querySelector(`svg[stroke="${PITCH_VISUAL_COLORS.singer}"]`),
    ).toBeInTheDocument()
    expect(
      container.querySelector(`svg[fill="${PITCH_VISUAL_COLORS.singer}"]`),
    ).toBeInTheDocument()

    fireEvent.click(pitchButton)
    fireEvent.click(notesButton)

    expect(setShowMicLine).toHaveBeenCalledTimes(1)
    expect(setShowUserNoteLabels).toHaveBeenCalledTimes(1)
  })
})
