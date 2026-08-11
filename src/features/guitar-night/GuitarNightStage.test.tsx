// Guitar Night stage tests protect its shared, persisted visual presentations.
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { CameraState } from '@/features/guitar-tab-3d/renderer/camera'
import type { DisplaySettings, TabPresentation, } from '@/features/guitar-tab-3d/renderer/TabRenderer'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { GUITAR_NIGHT_CAMERA_PRESET_KEY, GUITAR_NIGHT_EFFECTS_KEY, GUITAR_NIGHT_FLOW_PRESENTATION_KEY, GUITAR_NIGHT_HANDEDNESS_KEY, GuitarNightStage, } from './GuitarNightStage'

vi.mock('@/features/guitar/ui/Guitar3DStage', () => ({
  Guitar3DStage: (props: {
    presentation?: Accessor<TabPresentation>
    display?: Accessor<DisplaySettings>
    cameraPreset?: Accessor<CameraState>
    cameraAutoFollow?: Accessor<boolean>
    ariaLabel?: Accessor<string>
  }) => (
    <div
      role="img"
      aria-label={props.ariaLabel?.()}
      data-testid="shared-3d-stage"
      data-presentation={props.presentation?.() ?? 'fret-axis'}
      data-left-handed={props.display?.().leftHanded ?? false}
      data-effects={props.display?.().effects ?? 'full'}
      data-camera-target-x={props.cameraPreset?.().target[0] ?? 0}
      data-camera-following={props.cameraAutoFollow?.() ?? false}
    />
  ),
}))

const SOURCE: GuitarPerformanceStageSource = {
  title: () => 'Quiet room',
  notes: () => [],
  timeline: {
    positionSeconds: () => 0,
    durationSeconds: () => 60,
    playheadBeat: () => null,
    tempoBpm: () => 90,
  },
}

describe('GuitarNightStage views', () => {
  const persistedKeys = [
    GUITAR_NIGHT_FLOW_PRESENTATION_KEY,
    GUITAR_NIGHT_CAMERA_PRESET_KEY,
    GUITAR_NIGHT_HANDEDNESS_KEY,
    GUITAR_NIGHT_EFFECTS_KEY,
  ] as const

  beforeEach(() => {
    for (const key of persistedKeys) localStorage.removeItem(key)
  })
  afterEach(() => {
    cleanup()
    for (const key of persistedKeys) localStorage.removeItem(key)
  })

  it('switches one mounted Flow stage between Highway and Grid and remembers it', async () => {
    const first = render(() => (
      <GuitarNightStage source={SOURCE} active={() => true} />
    ))
    const sharedStage = await screen.findByTestId('shared-3d-stage')

    expect(sharedStage).toHaveAttribute('data-presentation', 'string-highway')
    expect(screen.getByRole('button', { name: 'Highway' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Grid' }))

    expect(sharedStage).toHaveAttribute('data-presentation', 'fret-axis')
    expect(localStorage.getItem(GUITAR_NIGHT_FLOW_PRESENTATION_KEY)).toBe(
      'fret-axis',
    )
    first.unmount()

    render(() => <GuitarNightStage source={SOURCE} active={() => true} />)

    expect(await screen.findByTestId('shared-3d-stage')).toHaveAttribute(
      'data-presentation',
      'fret-axis',
    )
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('describes Tab as tablature instead of the last Flow projection', () => {
    render(() => <GuitarNightStage source={SOURCE} active={() => true} />)

    fireEvent.click(screen.getByRole('button', { name: 'Tab' }))

    expect(
      screen.getByRole('img', {
        name: /Empty 6-string tablature; no song tab is attached/,
      }),
    ).toBeVisible()
  })

  it('announces a heard note without live-reading changing clarity', () => {
    render(() => (
      <GuitarNightStage
        source={SOURCE}
        active={() => true}
        listening={() => true}
        heardNote={() => 'C3'}
        heardClarity={() => 0.51}
      />
    ))

    expect(screen.getByRole('status')).toHaveTextContent('Heard C3')
    expect(screen.getByRole('status')).not.toHaveTextContent('51')
  })

  it('keeps camera and visual preferences in one compact persisted View menu', async () => {
    render(() => <GuitarNightStage source={SOURCE} active={() => true} />)
    const sharedStage = await screen.findByTestId('shared-3d-stage')
    const stage = screen.getByTestId('guitar-night-stage')

    fireEvent.click(screen.getByLabelText('Camera, Runway'))
    fireEvent.click(screen.getByRole('button', { name: /Phrase follow/ }))

    expect(stage).toHaveAttribute('data-camera-preset', 'phrase-focus')
    expect(sharedStage).toHaveAttribute('data-camera-following', 'true')
    expect(localStorage.getItem(GUITAR_NIGHT_CAMERA_PRESET_KEY)).toBe(
      'phrase-focus',
    )

    fireEvent.click(screen.getByLabelText('Camera, Phrase follow'))
    fireEvent.click(screen.getByRole('button', { name: /Left-handed layout/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reduced effects/ }))

    expect(stage).toHaveAttribute('data-handedness', 'left')
    expect(stage).toHaveAttribute('data-effects', 'reduced')
    expect(sharedStage).toHaveAttribute('data-left-handed', 'true')
    expect(sharedStage).toHaveAttribute('data-effects', 'reduced')
    expect(localStorage.getItem(GUITAR_NIGHT_HANDEDNESS_KEY)).toBe('left')
    expect(localStorage.getItem(GUITAR_NIGHT_EFFECTS_KEY)).toBe('reduced')

    fireEvent.click(screen.getByRole('button', { name: 'Grid' }))
    expect(sharedStage).toHaveAttribute('data-presentation', 'fret-axis')
    expect(sharedStage).toHaveAttribute('data-left-handed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Neck' }))
    expect(
      screen.getByRole('img', { name: /13-fret 6-string guitar neck/ }),
    ).toHaveAttribute('data-handedness', 'left')
    expect(screen.getByLabelText('Display settings')).toBeVisible()
  })

  it('allows only one stage disclosure and returns focus on Escape', async () => {
    render(() => (
      <GuitarNightStage
        source={SOURCE}
        active={() => true}
        onInstrument={() => undefined}
        onStringCount={() => undefined}
      />
    ))

    const instrumentSummary = screen.getByText('6-string guitar')
    const instrumentDetails = instrumentSummary.closest('details')
    const viewSummary = screen.getByLabelText('Camera, Runway')
    const viewDetails = viewSummary.closest('details')

    fireEvent.click(instrumentSummary)
    expect(instrumentDetails).toHaveAttribute('open')
    fireEvent.click(viewSummary)
    await waitFor(() => expect(instrumentDetails).not.toHaveAttribute('open'))
    expect(viewDetails).toHaveAttribute('open')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(viewDetails).not.toHaveAttribute('open')
    expect(viewSummary).toHaveFocus()
  })

  it('keeps one Flow renderer mounted while the lightweight lanes are open', async () => {
    render(() => <GuitarNightStage source={SOURCE} active={() => true} />)
    const originalRenderer = await screen.findByTestId('shared-3d-stage')

    fireEvent.click(screen.getByRole('button', { name: 'Tab' }))
    expect(originalRenderer.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.getByLabelText('Display settings')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Highway' }))
    expect(screen.getByTestId('shared-3d-stage')).toBe(originalRenderer)
    expect(originalRenderer).toBeVisible()
  })

  it('names authored tuning and capo without changing the setup control contract', () => {
    const tuning: InstrumentTuning = {
      instrument: 'guitar',
      stringCount: 6,
      openMidi: [64, 59, 55, 50, 45, 38],
      labels: ['e', 'B', 'G', 'D', 'A', 'D'],
      name: 'Drop D',
      capo: 2,
    }
    render(() => (
      <GuitarNightStage
        source={SOURCE}
        active={() => true}
        tuning={() => tuning}
        onInstrument={() => undefined}
        onStringCount={() => undefined}
      />
    ))

    const setup = screen.getByText('6-string guitar')
    expect(setup).toHaveAttribute('aria-label', '6-string guitar setup')
    fireEvent.click(setup)
    expect(screen.getByText('Drop D · capo 2')).toBeVisible()
  })

  it('exposes the current chord, position, and technique in every visual lane', async () => {
    const authoredSource: GuitarPerformanceStageSource = {
      title: () => 'Technique study',
      notes: () => [
        {
          id: 'am-c',
          midi: 72,
          noteName: 'C5',
          stringIndex: 1,
          fret: 1,
          startBeat: 0,
          duration: 1,
          targetFreq: 523.25,
          notation: {
            chordLabel: 'Am',
            techniques: [
              { kind: 'bend', bendType: 'bend', semitones: 1 },
              { kind: 'slide', slideType: 'into-from-below', toFret: 1 },
            ],
          },
        },
        {
          id: 'am-e',
          midi: 76,
          noteName: 'E5',
          stringIndex: 0,
          fret: 0,
          startBeat: 0,
          duration: 1,
          targetFreq: 659.26,
          notation: { chordLabel: 'Am' },
        },
      ],
      timeline: {
        positionSeconds: () => 0,
        durationSeconds: () => 1,
        playheadBeat: () => 0,
        tempoBpm: () => 90,
      },
    }

    render(() => (
      <GuitarNightStage source={authoredSource} active={() => true} />
    ))

    const targetName =
      /Current target: Am chord:.*C5.*fret 1.*E5.*open.*bend 1 semitone.*slide in from below/i
    expect(await screen.findByRole('img', { name: targetName })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Tab' }))
    expect(screen.getByRole('img', { name: targetName })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Neck' }))
    expect(screen.getByRole('img', { name: targetName })).toBeVisible()
  })

  it('announces authored release and pre-bend motion distinctly', async () => {
    const authoredSource: GuitarPerformanceStageSource = {
      title: () => 'Bend study',
      notes: () => [
        {
          id: 'release',
          midi: 67,
          noteName: 'G4',
          stringIndex: 1,
          fret: 8,
          startBeat: 0,
          duration: 1,
          targetFreq: 392,
          notation: {
            techniques: [{ kind: 'bend', bendType: 'release', semitones: 2 }],
          },
        },
        {
          id: 'prebend-release',
          midi: 69,
          noteName: 'A4',
          stringIndex: 1,
          fret: 10,
          startBeat: 0,
          duration: 1,
          targetFreq: 440,
          notation: {
            techniques: [
              { kind: 'bend', bendType: 'prebend-release', semitones: 1 },
            ],
          },
        },
      ],
      timeline: {
        positionSeconds: () => 0,
        durationSeconds: () => 1,
        playheadBeat: () => 0,
        tempoBpm: () => 90,
      },
    }

    render(() => (
      <GuitarNightStage source={authoredSource} active={() => true} />
    ))

    expect(
      await screen.findByRole('img', {
        name: /bend release 2 semitones.*pre-bend 1 semitone, then release/i,
      }),
    ).toBeVisible()
  })

  it('announces linked technique destinations after the score is re-placed', async () => {
    const [notes, setNotes] = createSignal([
      {
        id: 'origin',
        midi: 64,
        noteName: 'E4',
        stringIndex: 1,
        fret: 5,
        startBeat: 0,
        duration: 1,
        targetFreq: 329.63,
        notation: {
          techniques: [
            {
              kind: 'hammer-on' as const,
              toFret: 7,
              toNoteId: 'target',
            },
          ],
        },
      },
      {
        id: 'target',
        midi: 66,
        noteName: 'F#4',
        stringIndex: 1,
        fret: 7,
        startBeat: 1,
        duration: 1,
        targetFreq: 369.99,
      },
    ])
    const authoredSource: GuitarPerformanceStageSource = {
      title: () => 'Linked study',
      notes,
      timeline: {
        positionSeconds: () => 0,
        durationSeconds: () => 2,
        playheadBeat: () => 0,
        tempoBpm: () => 90,
      },
    }

    render(() => (
      <GuitarNightStage source={authoredSource} active={() => true} />
    ))
    expect(
      await screen.findByRole('img', { name: /hammer-on to fret 7/i }),
    ).toBeVisible()

    setNotes((current) =>
      current.map((note) =>
        note.id === 'target' ? { ...note, fret: 9 } : note,
      ),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: /hammer-on to fret 9/i }),
      ).toBeVisible(),
    )
  })

  it('announces authored slide-out direction and pick slides distinctly', async () => {
    const authoredSource: GuitarPerformanceStageSource = {
      title: () => 'Slide study',
      notes: () => [
        {
          id: 'slide-up',
          midi: 64,
          noteName: 'E4',
          stringIndex: 1,
          fret: 5,
          startBeat: 0,
          duration: 1,
          targetFreq: 329.63,
          notation: {
            techniques: [
              { kind: 'slide', slideType: 'out-up' },
              { kind: 'slide', slideType: 'pick-slide-down' },
            ],
          },
        },
      ],
      timeline: {
        positionSeconds: () => 0,
        durationSeconds: () => 1,
        playheadBeat: () => 0,
        tempoBpm: () => 90,
      },
    }

    render(() => (
      <GuitarNightStage source={authoredSource} active={() => true} />
    ))

    expect(
      await screen.findByRole('img', {
        name: /slide out upward.*pick slide downward/i,
      }),
    ).toBeVisible()
  })
})
