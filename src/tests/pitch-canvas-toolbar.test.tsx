import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { PitchCanvasToolbar } from '@/components/PitchCanvasToolbar'
import { PITCH_VISUAL_COLORS } from '@/features/stem-mixer/pitch-canvas-visuals'
import { useStemMixerMelodyAuditionController } from '@/features/stem-mixer/useStemMixerMelodyAuditionController'

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

describe('PitchCanvasToolbar melody audition', () => {
  // The seam slice D introduced: the controller's accessor reaches the
  // button's class and its title, and the button's click reaches the
  // controller's toggle. Typecheck proves the props line up; this proves they
  // are the ones actually wired, which is what a mis-ordered extraction breaks.
  it('drives the real controller through the toolbar button', () => {
    const [playing] = createSignal(false)
    const [elapsed] = createSignal(0)
    const melodyAudition = useStemMixerMelodyAuditionController({
      audio: { playing, elapsed },
      pitchAnalysis: { offlineSegmentedNotes: () => [] },
    })

    render(() => (
      <PitchCanvasToolbar
        showNoteLabels={() => false}
        setShowNoteLabels={vi.fn()}
        showLyricLabels={() => false}
        setShowLyricLabels={vi.fn()}
        melodyAudio={melodyAudition.enabled}
        onToggleMelodyAudio={melodyAudition.toggle}
      />
    ))

    const button = screen.getByTitle(
      'Hear the detected melody as notes during playback',
    )
    expect(button).not.toHaveClass('active')

    fireEvent.click(button)

    expect(melodyAudition.enabled()).toBe(true)
    expect(button).toHaveClass('active')
    expect(button).toHaveAttribute('title', 'Mute the detected melody')

    fireEvent.click(button)

    expect(melodyAudition.enabled()).toBe(false)
    expect(button).not.toHaveClass('active')
  })

  it('omits the button when no toggle is supplied', () => {
    render(() => (
      <PitchCanvasToolbar
        showNoteLabels={() => false}
        setShowNoteLabels={vi.fn()}
        showLyricLabels={() => false}
        setShowLyricLabels={vi.fn()}
      />
    ))

    // `toBeNull` rather than `not.toBeInTheDocument`, and the count beside
    // it: an assertion that something is absent passes just as well when
    // nothing rendered at all, so the two unconditional controls are pinned
    // too. Everything else in this toolbar is behind a `<Show>`.
    expect(
      screen.queryByTitle('Hear the detected melody as notes during playback'),
    ).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
