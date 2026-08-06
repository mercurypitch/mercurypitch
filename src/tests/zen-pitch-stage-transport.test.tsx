import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PracticeFrame } from '@/features/practice/usePracticeController'
import type { ZenExerciseDefinition } from '@/features/zen/types'
import { ZenPitchStage } from '@/features/zen/ZenPitchStage'
import type { PitchResult } from '@/types'

// ============================================================
// The Zen stage's controls — REQ-ZENP-004, 009, 021..024
// ============================================================
//
// The state machine itself is covered in zen-pitch-session.test.tsx; this
// asserts the things the singer actually touches agree with it. Audio never
// sounds in jsdom, so nothing here waits on a tone — it drives the transport
// and reads the controls back. Spec:
// docs/specs/zen-exercise-playback.ears.md.

const EXERCISE: ZenExerciseDefinition = {
  id: 'test-scale',
  version: 1,
  title: 'Test Scale',
  category: 'scales',
  level: 'foundation',
  summary: 'A short line.',
  goal: 'Keep the steps even.',
  instructions: 'Sing “ah” on each note.',
  bpm: 60,
  countInBeats: 0,
  loopBeats: 4,
  defaultRootMidi: 60,
  targets: [
    { id: 'n1', startBeat: 0, durationBeats: 1, semitone: 0, cue: 'Ah' },
    { id: 'n2', startBeat: 1, durationBeats: 1, semitone: 2, cue: 'Ah' },
  ],
  defaultTargetVisibility: 'on',
  defaultProgressCue: 'playhead',
  scoring: {
    pitchWeight: 0.6,
    coverageWeight: 0.3,
    steadinessWeight: 0.1,
    toleranceCents: 60,
  },
}

const pitch = (midi: number): PitchResult => ({
  freq: 440 * 2 ** ((midi - 69) / 12),
  midi,
  note: 'C',
  noteName: 'C',
  targetMidi: midi,
  targetNote: 'C',
  cents: 0,
  frequency: 440 * 2 ** ((midi - 69) / 12),
  clarity: 0.95,
  octave: 4,
})

/** Already open — the stage inherits it rather than prompting. */
const startMic = (): Promise<boolean> => Promise.resolve(true)

function renderStage(): {
  feed: (atMs: number, midi: number) => void
} {
  let listener: ((frame: PracticeFrame) => void) | null = null
  render(() => (
    <ZenPitchStage
      initialExerciseDefinition={EXERCISE}
      subscribeFrames={(next) => {
        listener = next
        return () => {
          listener = null
        }
      }}
      micActive={() => true}
      startMic={startMic}
      stopMic={() => undefined}
      onClose={() => undefined}
    />
  ))
  return {
    feed: (atMs, midi) => {
      listener?.({ atMs, beat: 0, pitch: pitch(midi), micActive: true })
    },
  }
}

const transport = (): HTMLElement => screen.getByTestId('zen-transport')
const startPractice = async (): Promise<void> => {
  fireEvent.click(transport())
  await waitFor(() => {
    expect(transport()).toHaveTextContent('Pause')
  })
}

describe('Zen stage mute control', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // REQ-ZENP-021. This read inverted: the control announced "pressed" exactly
  // while guide notes were audible, i.e. while the mute was *off*.
  it('reports the mute, not the sound', () => {
    renderStage()
    const mute = screen.getByTestId('zen-mute-notes')

    expect(mute).toHaveAttribute('aria-pressed', 'false')
    expect(mute).toHaveAttribute('aria-label', 'Mute guide notes')

    fireEvent.click(mute)

    expect(mute).toHaveAttribute('aria-pressed', 'true')
    expect(mute).toHaveAttribute('aria-label', 'Unmute guide notes')
  })

  // REQ-ZENP-022. Its only cue used to be a 16px icon swap inside a control
  // that inherited the neighbouring On/Dim/Off segment styling — the mute
  // "was not changing" to look at.
  it('carries a visible engaged state, not only a swapped icon', () => {
    renderStage()
    const mute = screen.getByTestId('zen-mute-notes')
    const quiet = mute.className

    fireEvent.click(mute)

    expect(mute.className).not.toBe(quiet)
    expect(mute.className).toContain('muteEngaged')

    fireEvent.click(mute)
    expect(mute.className).toBe(quiet)
  })

  // REQ-ZENP-023.
  it('is disabled while the targets are not fully shown', () => {
    renderStage()
    const mute = screen.getByTestId('zen-mute-notes')
    expect(mute).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Dim' }))

    expect(mute).toBeDisabled()
    expect(mute).toHaveAttribute(
      'title',
      'Guide notes only sound while targets are fully shown',
    )
  })
})

describe('Zen stage transport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // REQ-ZENP-009, REQ-ZENP-004. Restart used to hide inside the guide's start
  // button, labelled "Restart exercise" only while paused — where the footer
  // simultaneously offered "Resume". Two controls, one state, opposite
  // outcomes.
  it('offers restart only while there is a pass to restart', async () => {
    renderStage()
    expect(screen.queryByTestId('zen-restart')).toBeNull()

    await startPractice()
    expect(screen.getByTestId('zen-restart')).toBeInTheDocument()

    fireEvent.click(transport())
    expect(transport()).toHaveTextContent('Resume')
    expect(screen.getByTestId('zen-restart')).toBeInTheDocument()
  })

  // REQ-ZENP-004. The guide's button is a start and nothing else, so it can
  // never disagree with the footer about what the current state means.
  it('keeps the guide start button out of the running and paused states', async () => {
    renderStage()
    const begin = screen.getByRole('button', { name: /Begin practice/ })
    expect(begin).toBeEnabled()

    await startPractice()
    expect(begin).toBeDisabled()

    fireEvent.click(transport())
    expect(transport()).toHaveTextContent('Resume')
    expect(begin).toBeDisabled()
  })

  // REQ-ZENP-024. Switching take mid-pass froze the canvas on the selected
  // take while capture ran on invisibly behind it — "the playhead
  // dissapears and things break".
  it('locks the take strip while running and frees it on pause', async () => {
    // The session stamps its lap origin from performance.now(); pin it so the
    // frame timestamps below are on the same clock.
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { feed } = renderStage()
    await startPractice()

    // A full lap, so there is a take worth trying to select.
    feed(100, 60)
    feed(200, 60.2)
    feed(300, 59.8)
    feed(4_100, 60)

    const previous = screen.getByRole('button', { name: 'Previous take' })
    const remove = screen.getByRole('button', {
      name: 'Delete this take (permanent)',
    })
    await waitFor(() => {
      expect(screen.getByText('1 saved here')).toBeInTheDocument()
    })

    expect(previous).toBeDisabled()
    expect(previous).toHaveAttribute('title', 'Pause to review your takes')
    expect(remove).toBeDisabled()

    fireEvent.click(transport())

    expect(transport()).toHaveTextContent('Resume')
    expect(previous).toBeEnabled()
    expect(previous).not.toHaveAttribute('title')
  })
})
