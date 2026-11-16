// Studio phone clip note tests — a phone has no Clip details, so a MIDI clip's note offers its Notes, its MIDI file and its Range, together at the bar's end; an audio clip's says to edit it elsewhere and offers neither of the first two.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioFixture, studioMidiFixture, } from '@/lib/studio/model/model.test-fixtures'
import { StudioPhoneClipNote } from './StudioPhoneClipNote'

afterEach(cleanup)

describe('a phone’s clip note', () => {
  it('offers a MIDI clip’s notes, its MIDI file and its range, saving that clip’s file', async () => {
    // Arrange
    const { clip } = studioMidiFixture()
    const exportMidi = vi.fn()
    render(() => (
      <StudioPhoneClipNote
        name="Keys"
        clip={clip}
        onRange={vi.fn()}
        onEditNotes={vi.fn()}
        onExportMidi={exportMidi}
      />
    ))

    // Act
    await fireEvent.click(screen.getByRole('button', { name: 'Export MIDI' }))

    // Assert
    expect(exportMidi).toHaveBeenCalledExactlyOnceWith('clip-midi')
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Notes', 'MIDI', 'Range'])
  })

  it('offers an audio clip no notes and no MIDI file', () => {
    // Act
    render(() => (
      <StudioPhoneClipNote
        name="Guitar"
        clip={studioFixture().clip}
        onRange={vi.fn()}
        onEditNotes={vi.fn()}
        onExportMidi={vi.fn()}
      />
    ))

    // Assert
    expect(
      screen.getByText('Edit clips on a tablet or computer.'),
    ).toBeVisible()
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Range'])
  })
})
