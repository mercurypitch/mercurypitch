// Studio clip detail tests — submillisecond bounds, a MIDI clip's end trimmed past its audio, and source-anchored fade preservation; a MIDI clip's Export MIDI beside Edit notes, saying whether its file was asked for.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioFixture, studioMidiFixture, } from '@/lib/studio/model/model.test-fixtures'
import { StudioClipDetails } from './StudioClipDetails'

afterEach(cleanup)

describe('Studio clip details', () => {
  it('keeps exact valid bounds for a one-frame clip and accepts a one-frame tail extension', () => {
    const { clip, asset } = studioFixture()
    const command = vi.fn(() => true)
    render(() => (
      <StudioClipDetails
        clip={{ ...clip, startFrame: 0, sourceInFrame: 4, sourceOutFrame: 5 }}
        asset={asset}
        writable
        onCommand={command}
      />
    ))
    const head = screen.getByRole('spinbutton', {
      name: 'Trim start',
    }) as HTMLInputElement
    const tail = screen.getByRole('spinbutton', {
      name: 'Trim end',
    }) as HTMLInputElement
    expect(head.valueAsNumber).toBe(4 / 48000)
    expect(Number(head.min)).toBe(4 / 48000)
    expect(Number(head.max)).toBe(4 / 48000)
    expect(head.validity.valid).toBe(true)
    expect(tail.validity.valid).toBe(true)
    fireEvent.input(tail, { target: { value: String(6 / 48000) } })
    fireEvent.keyDown(tail, { key: 'Enter' })
    expect(command).toHaveBeenCalledExactlyOnceWith({
      type: 'trim-tail',
      clipId: clip.id,
      sourceOutFrame: 6,
    })
    fireEvent.input(head, { target: { value: String(3 / 48000) } })
    fireEvent.blur(head)
    expect(command).toHaveBeenCalledTimes(1)
  })

  it('does not rewrite a retained partial fade on Enter or blur, and anchors an explicit edit in source frames', () => {
    const { clip, asset } = studioFixture()
    const command = vi.fn(() => true)
    render(() => (
      <StudioClipDetails
        clip={{ ...clip, sourceInFrame: 100, sourceOutFrame: 900 }}
        asset={asset}
        writable
        onCommand={command}
      />
    ))
    const fade = screen.getByRole('spinbutton', { name: 'Fade in' })
    expect(fade).toHaveValue(100 / 48000)
    fireEvent.keyDown(fade, { key: 'Enter' })
    fireEvent.blur(fade)
    expect(command).not.toHaveBeenCalled()
    fireEvent.input(fade, { target: { value: String(50 / 48000) } })
    fireEvent.blur(fade)
    expect(command).toHaveBeenCalledExactlyOnceWith({
      type: 'set-fades',
      clipId: clip.id,
      fades: {
        ...clip.fades,
        in: { fromSourceFrame: 100, toSourceFrame: 150 },
      },
    })
  })

  it('trims a MIDI clip’s end past its audio, five minutes in at the most, naming a copy of its own sequence', () => {
    // Arrange: two seconds of audio.
    const { clip, assets } = studioMidiFixture()
    const command = vi.fn(() => true)
    render(() => (
      <StudioClipDetails
        clip={clip}
        asset={assets[1]}
        writable
        onCommand={command}
      />
    ))
    const tail = screen.getByRole('spinbutton', { name: 'Trim end' })

    // Act
    fireEvent.input(tail, { target: { value: '6' } })
    fireEvent.keyDown(tail, { key: 'Enter' })

    // Assert
    expect(tail).toHaveAttribute('max', '300')
    expect(command).toHaveBeenCalledExactlyOnceWith({
      type: 'trim-tail',
      clipId: clip.id,
      sourceOutFrame: 288_000,
      forkSequenceId: expect.any(String),
    })
  })

  it('rejects a fade that would cross the other retained source ramp', () => {
    const { clip, asset } = studioFixture()
    const command = vi.fn(() => true)
    render(() => (
      <StudioClipDetails
        clip={clip}
        asset={asset}
        writable
        onCommand={command}
      />
    ))
    const fade = screen.getByRole('spinbutton', { name: 'Fade in' })
    expect(fade).toHaveAttribute('max', String(800 / 48000))
    fireEvent.input(fade, { target: { value: String(801 / 48000) } })
    fireEvent.blur(fade)
    expect(command).not.toHaveBeenCalled()
    expect(fade).toHaveValue(200 / 48000)
    expect(fade).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('a MIDI clip in Clip details', () => {
  function mount(saves: boolean) {
    const { clip, assets } = studioMidiFixture()
    const exportMidi = vi.fn(() => saves)
    render(() => (
      <StudioClipDetails
        clip={clip}
        asset={assets[1]}
        writable
        onCommand={vi.fn(() => true)}
        onEditNotes={vi.fn()}
        onExportMidi={exportMidi}
      />
    ))
    return exportMidi
  }

  it('offers Export MIDI beside Edit notes, and says its download was asked for', async () => {
    // Arrange
    const exportMidi = mount(true)

    // Act
    await fireEvent.click(screen.getByRole('button', { name: 'Export MIDI' }))

    // Assert
    expect(exportMidi).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Edit notes' }).parentElement,
    ).toBe(screen.getByRole('button', { name: 'Export MIDI' }).parentElement)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Download requested. Your browser handles the file.',
    )
  })

  it('says when the clip’s file could not be made', async () => {
    // Arrange
    mount(false)

    // Act
    await fireEvent.click(screen.getByRole('button', { name: 'Export MIDI' }))

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The MIDI file could not be made. Try Export MIDI again.',
    )
  })

  it('offers no Export MIDI for an audio clip', () => {
    // Arrange
    const { clip, asset } = studioFixture()

    // Act
    render(() => (
      <StudioClipDetails
        clip={clip}
        asset={asset}
        writable
        onCommand={vi.fn(() => true)}
        onEditNotes={vi.fn()}
        onExportMidi={vi.fn(() => true)}
      />
    ))

    // Assert
    expect(screen.queryByRole('button', { name: 'Export MIDI' })).toBeNull()
  })
})
