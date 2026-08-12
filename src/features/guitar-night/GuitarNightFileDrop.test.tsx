import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { GuitarNightFileDrop } from './GuitarNightFileDrop'

function file(name: string, type = ''): File {
  return new File(['music'], name, { type })
}

function drop(files: File[]) {
  fireEvent.drop(screen.getByTestId('guitar-night-file-drop'), {
    dataTransfer: { files, types: ['Files'] },
  } as unknown as DragEvent)
}

describe('GuitarNightFileDrop', () => {
  it('keeps wrapped content and exposes a real file choice button', () => {
    const onChoose = vi.fn()
    render(() => (
      <GuitarNightFileDrop
        onChoose={onChoose}
        onFile={() => {}}
        onRejected={() => {}}
      >
        <strong>Current song</strong>
      </GuitarNightFileDrop>
    ))

    expect(screen.getByText('Current song')).toBeInTheDocument()
    expect(
      screen.getByText(/MP3 · WAV · FLAC · MIDI · Guitar Pro/),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Choose a file' }))
    expect(onChoose).toHaveBeenCalledOnce()
  })

  it('passes one dropped file through untouched', () => {
    const onFile = vi.fn()
    const onRejected = vi.fn()
    render(() => (
      <GuitarNightFileDrop
        onChoose={() => {}}
        onFile={onFile}
        onRejected={onRejected}
      >
        <span>Song</span>
      </GuitarNightFileDrop>
    ))
    const song = file('song.wav', 'audio/wav')

    drop([song])

    expect(onFile).toHaveBeenCalledWith(song)
    expect(onRejected).not.toHaveBeenCalled()
  })

  it('rejects a multiple-file drop without opening either file', () => {
    const onFile = vi.fn()
    const onRejected = vi.fn()
    const files = [file('song.wav'), file('score.gp')]
    render(() => (
      <GuitarNightFileDrop
        onChoose={() => {}}
        onFile={onFile}
        onRejected={onRejected}
      >
        <span>Song</span>
      </GuitarNightFileDrop>
    ))

    drop(files)

    expect(onRejected).toHaveBeenCalledWith(files)
    expect(onFile).not.toHaveBeenCalled()
  })

  it('shows a stable drag affordance while the pointer crosses children', () => {
    render(() => (
      <GuitarNightFileDrop
        onChoose={() => {}}
        onFile={() => {}}
        onRejected={() => {}}
      >
        <span>Song</span>
      </GuitarNightFileDrop>
    ))
    const zone = screen.getByTestId('guitar-night-file-drop')
    const dragData = { dataTransfer: { files: [], types: ['Files'] } }

    fireEvent.dragEnter(zone, dragData)
    fireEvent.dragEnter(zone, dragData)
    fireEvent.dragLeave(zone, dragData)
    expect(
      screen.getByText('Drop audio, MIDI, or Guitar Pro'),
    ).toBeInTheDocument()

    fireEvent.dragLeave(zone, dragData)
    expect(
      screen.queryByText('Drop audio, MIDI, or Guitar Pro'),
    ).not.toBeInTheDocument()
  })

  it('blocks choose and drop while disabled or opening', () => {
    const onChoose = vi.fn()
    const onFile = vi.fn()
    const { unmount } = render(() => (
      <GuitarNightFileDrop
        disabled
        onChoose={onChoose}
        onFile={onFile}
        onRejected={() => {}}
      >
        <span>Song</span>
      </GuitarNightFileDrop>
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Choose a file' }))
    drop([file('song.wav')])
    expect(onChoose).not.toHaveBeenCalled()
    expect(onFile).not.toHaveBeenCalled()

    unmount()
    render(() => (
      <GuitarNightFileDrop
        openingFileName="midnight.gpx"
        message="Reading the score"
        onChoose={onChoose}
        onFile={onFile}
        onRejected={() => {}}
      >
        <span>Song</span>
      </GuitarNightFileDrop>
    ))

    expect(screen.getByTestId('guitar-night-file-drop')).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(screen.getByText('Opening midnight.gpx…')).toBeInTheDocument()
    expect(screen.getByText('Reading the score')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose a file' })).toBeDisabled()
  })

  it('announces a recoverable file error assertively', () => {
    render(() => (
      <GuitarNightFileDrop
        message="Choose one supported file."
        onChoose={() => {}}
        onFile={() => {}}
        onRejected={() => {}}
      >
        <span>Song</span>
      </GuitarNightFileDrop>
    ))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose one supported file.',
    )
  })
})
