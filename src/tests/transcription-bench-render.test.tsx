// The roll's geometry and the scoring arithmetic have their own tests. This
// covers what neither can see: that the component mounts at all, that its
// canvas draw effect survives a first paint with nothing loaded, and that the
// controls it promises are actually reachable.
//
// A bench that throws on mount is the failure mode worth catching here — every
// other bug in it is visible the moment a stem is loaded, and this one hides
// behind an empty panel.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transcribeStem: vi.fn(),
}))

vi.mock('@/lib/transcription/stem-transcription-client', () => ({
  transcribeStem: mocks.transcribeStem,
}))

import { TranscriptionBench } from '@/features/lab/TranscriptionBench'

function midiTrack(channel: number, note: number): number[] {
  const body = [
    0,
    0x90 | channel,
    note,
    100,
    0x83,
    0x60,
    0x80 | channel,
    note,
    0,
    0,
    0xff,
    0x2f,
    0,
  ]
  return [0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, body.length, ...body]
}

function drumsFirstMidi(): Uint8Array {
  return new Uint8Array([
    0x4d,
    0x54,
    0x68,
    0x64,
    0,
    0,
    0,
    6,
    0,
    1,
    0,
    2,
    1,
    0xe0,
    ...midiTrack(9, 36),
    ...midiTrack(0, 60),
  ])
}

describe('TranscriptionBench', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    mocks.transcribeStem.mockReset()
  })

  it('mounts with a focused empty state and no premature roll', () => {
    const { container } = render(() => <TranscriptionBench />)
    expect(screen.getByText('Notes will appear here')).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('ignores a resize that arrives after the bench unmounts', () => {
    const { unmount } = render(() => <TranscriptionBench />)
    unmount()

    expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow()
  })

  it('will not transcribe until a stem is chosen', () => {
    render(() => <TranscriptionBench />)
    const run = screen.getByRole('button', { name: 'Transcribe' })
    expect(run).toHaveProperty('disabled', true)
  })

  it('offers both pitch sources', () => {
    render(() => <TranscriptionBench />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect([...select.options].map((option) => option.value)).toEqual([
      'yin',
      'swift',
    ])
  })

  it('never offers a drums-first track as pitched reference truth', async () => {
    const { container } = render(() => <TranscriptionBench />)
    const referenceInput = container.querySelector<HTMLInputElement>(
      'input[accept=".mid,.midi,.gp,.gp3,.gp4,.gp5,.gpx"]',
    )
    expect(referenceInput).not.toBeNull()
    const midi = drumsFirstMidi()

    fireEvent.change(referenceInput!, {
      target: {
        files: [
          {
            name: 'mixed.mid',
            arrayBuffer: async () => midi.buffer,
          } as File,
        ],
      },
    })

    const pitched = await screen.findByRole('option', { name: 'Track 2 (1)' })
    const select = pitched.closest('select')
    expect(select).not.toBeNull()
    expect([...select!.options].map((option) => option.textContent)).toEqual([
      'Track 2 (1)',
    ])
    expect(select).toHaveValue('t1c0')
  })

  it('shows each source its own confidence floor', () => {
    render(() => <TranscriptionBench />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    // YIN's tuned floor and SwiftF0's differ by a lot, and the difference is
    // the point: the two numbers do not mean the same thing.
    expect(screen.getByText(/Confidence floor 0\.50/)).toBeTruthy()
    fireEvent.change(select, { target: { value: 'swift' } })
    expect(screen.getByText(/Confidence floor 0\.20/)).toBeTruthy()
  })

  it('keeps the export and edit tools out of reach until there is a result', () => {
    render(() => <TranscriptionBench />)
    for (const name of ['Export MIDI', 'Export JSON', 'Fit']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('mounts and resizes the editable roll after a successful transcription', async () => {
    mocks.transcribeStem.mockResolvedValue({
      notes: [
        {
          midi: 69,
          startSeconds: 0.1,
          durationSeconds: 0.5,
          confidence: 0.92,
        },
      ],
      coverage: 0.8,
      analysedSeconds: 1,
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      (() => null) as typeof HTMLCanvasElement.prototype.getContext,
    )

    const { container } = render(() => <TranscriptionBench />)
    const fileInput = container.querySelector<HTMLInputElement>(
      'input[type="file"][accept="audio/*"]',
    )
    expect(fileInput).not.toBeNull()

    fireEvent.change(fileInput!, {
      target: {
        files: [new File(['stem'], 'bass.wav', { type: 'audio/wav' })],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Transcribe' }))

    const roll = await screen.findByLabelText('Transcribed notes')
    expect(roll).toBeInstanceOf(HTMLCanvasElement)
    expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow()

    fireEvent.click(screen.getByRole('button', { name: 'Edit mode' }))
    expect(screen.getByRole('button', { name: 'Editing' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Fit' })),
    ).not.toThrow()
  })
})
