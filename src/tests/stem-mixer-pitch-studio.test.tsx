import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StemMixerPitchStudio } from '@/components/StemMixerPitchStudio'

describe('StemMixerPitchStudio', () => {
  const defaultProps = {
    songTitle: 'Midnight City.mp3',
    elapsed: 18,
    duration: 222,
    playing: false,
    noteCount: 42,
    selectedNote: {
      id: 'base-1',
      startBeat: 12.5,
      endBeat: 13.75,
      midi: 60,
    },
    pitchView: 'edited' as const,
    setPitchView: vi.fn(),
    hasEdits: true,
    onDelete: vi.fn(),
    onSplit: vi.fn(),
    onMerge: vi.fn(),
    onUndo: vi.fn(),
    onReset: vi.fn(),
    onNudgePitch: vi.fn(),
    onPlayPause: vi.fn(),
    onSeekToStart: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onFit: vi.fn(),
    onDone: vi.fn(),
    formatTime: (seconds: number) => `0:${String(seconds).padStart(2, '0')}`,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('identifies both pitch layers and the selected note', () => {
    render(() => <StemMixerPitchStudio {...defaultProps} />)

    expect(
      screen.getByRole('region', { name: 'Pitch Studio note editor' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Midnight City' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Vocal reference')).toBeInTheDocument()
    expect(screen.getByText('Your voice')).toBeInTheDocument()
    expect(screen.getByText('42 notes')).toBeInTheDocument()
    expect(screen.getByText('C4')).toBeInTheDocument()
    expect(screen.getByText('1.25s')).toBeInTheDocument()
  })

  it('wires note, transport, zoom, and completion actions', () => {
    render(() => <StemMixerPitchStudio {...defaultProps} />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Lower selected note one semitone',
      }),
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Raise selected note one semitone',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Play track' }))
    fireEvent.click(screen.getByRole('button', { name: 'Return to start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fit song' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done editing' }))

    expect(defaultProps.onNudgePitch).toHaveBeenNthCalledWith(1, -1)
    expect(defaultProps.onNudgePitch).toHaveBeenNthCalledWith(2, 1)
    expect(defaultProps.onPlayPause).toHaveBeenCalledTimes(1)
    expect(defaultProps.onSeekToStart).toHaveBeenCalledTimes(1)
    expect(defaultProps.onZoomOut).toHaveBeenCalledTimes(1)
    expect(defaultProps.onFit).toHaveBeenCalledTimes(1)
    expect(defaultProps.onZoomIn).toHaveBeenCalledTimes(1)
    expect(defaultProps.onDone).toHaveBeenCalledTimes(1)
  })

  it('guides an empty selection and exits with Escape', () => {
    const onDone = vi.fn()
    render(() => (
      <StemMixerPitchStudio
        {...defaultProps}
        selectedNote={null}
        hasEdits={false}
        onDone={onDone}
      />
    ))

    expect(screen.getByText('Select a vocal note')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete note' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Undo edit' })).toBeDisabled()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
