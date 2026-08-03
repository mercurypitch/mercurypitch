import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExerciseEditor } from '@/features/admin/exercises/ExerciseEditor'
import { ExercisePreview } from '@/features/admin/exercises/ExercisePreview'
import { ExerciseTimelineEditor } from '@/features/admin/exercises/ExerciseTimelineEditor'
import type { ZenExampleAudio, ZenExerciseDefinition, } from '@/features/zen/types'

const exercise = (): ZenExerciseDefinition => ({
  id: 'ng-five-tone',
  version: 1,
  title: 'NG Five-Tone',
  category: 'tone',
  level: 'foundation',
  summary: 'A connected five-tone hum.',
  goal: 'Carry one even resonance through the phrase.',
  instructions: 'Use the final sound of sing and keep the jaw loose.',
  pronunciationHint: 'NG is the final sound in sing.',
  bpm: 72,
  countInBeats: 2,
  loopBeats: 8,
  defaultRootMidi: 57,
  targets: [
    {
      id: 'note-1',
      startBeat: 1,
      durationBeats: 1,
      semitone: 0,
      cue: 'NG',
      showCue: true,
    },
  ],
  defaultTargetVisibility: 'on',
  defaultProgressCue: 'playhead',
  scoring: {
    pitchWeight: 0.55,
    coverageWeight: 0.25,
    steadinessWeight: 0.2,
    toleranceCents: 100,
  },
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(globalThis, 'MediaRecorder')
})

describe('ExerciseEditor', () => {
  it('edits controlled metadata and adds precise target rows immutably', () => {
    const source = exercise()
    const onChange = vi.fn()
    render(() => (
      <ExerciseEditor
        value={source}
        lifecycle="draft"
        status="idle"
        validationIssues={[]}
        onChange={onChange}
      />
    ))
    fireEvent.input(screen.getByLabelText('Title'), {
      target: { value: 'NG Resonance' },
    })
    expect(onChange).toHaveBeenLastCalledWith({
      ...source,
      title: 'NG Resonance',
    })

    fireEvent.click(screen.getByRole('button', { name: /Add glide/ }))

    expect(source.title).toBe('NG Five-Tone')
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targets: [
          source.targets[0],
          expect.objectContaining({
            id: 'glide-1',
            cue: 'Noo',
            endSemitone: 5,
          }),
        ],
      }),
    )
  })

  it('uses supplied validation and async lifecycle actions', async () => {
    const onSave = vi.fn(async () => Promise.resolve())
    const onPublish = vi.fn(async () => Promise.resolve())

    render(() => (
      <ExerciseEditor
        value={exercise()}
        lifecycle="draft"
        status="idle"
        validationIssues={[
          { path: 'targets.0.cue', message: 'Visible cue is required.' },
        ]}
        onChange={vi.fn()}
        onSave={onSave}
        onPublish={onPublish}
      />
    ))

    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    expect(screen.getByText('Visible cue is required.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('locks authoring fields while an async save is pending', () => {
    const onChange = vi.fn()

    render(() => (
      <ExerciseEditor
        value={exercise()}
        lifecycle="draft"
        status="saving"
        validationIssues={[]}
        onChange={onChange}
        onSave={vi.fn(async () => Promise.resolve())}
      />
    ))

    expect(screen.getByLabelText('Title')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    fireEvent.input(screen.getByLabelText('Title'), {
      target: { value: 'A newer title' },
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('communicates that example audio is optional at publication', () => {
    render(() => (
      <ExerciseEditor
        value={exercise()}
        lifecycle="draft"
        status="idle"
        validationIssues={[]}
        onChange={vi.fn()}
      />
    ))

    expect(screen.queryByLabelText(/Choose recording/)).not.toBeInTheDocument()
    expect(
      screen.getByText('You can publish without audio.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Set up example audio' }),
    ).toBeInTheDocument()
  })

  it('requires audio metadata before file selection', () => {
    const incompleteAudio: ZenExampleAudio = {
      src: '',
      durationMs: 5000,
      locale: 'en-GB',
      source: 'coach',
      transcript: '',
    }
    const exerciseWithIncompleteAudio = {
      ...exercise(),
      exampleAudio: incompleteAudio,
    }
    render(() => (
      <ExerciseEditor
        value={exerciseWithIncompleteAudio}
        lifecycle="draft"
        status="idle"
        validationIssues={[]}
        onChange={vi.fn()}
        onExampleAudioFile={vi.fn()}
      />
    ))
    expect(screen.getByLabelText(/Choose recording/)).toBeDisabled()
  })

  it('uploads returned example metadata and renders the production preview', async () => {
    const readyAudio: ZenExampleAudio = {
      src: '',
      durationMs: 5000,
      locale: 'en-GB',
      source: 'coach',
      transcript: 'NG',
    }
    const uploaded: ZenExampleAudio = {
      ...readyAudio,
      src: '/media/ng-example.mp3',
      durationMs: 4200,
    }
    const exerciseWithReadyAudio = { ...exercise(), exampleAudio: readyAudio }
    const onExampleAudioFile = vi.fn(async () => uploaded)
    const onChange = vi.fn()
    render(() => (
      <ExerciseEditor
        value={exerciseWithReadyAudio}
        lifecycle="draft"
        status="idle"
        validationIssues={[]}
        onChange={onChange}
        onExampleAudioFile={onExampleAudioFile}
      />
    ))
    const fileInput = screen.getByLabelText(/Choose recording/)
    expect(fileInput).toBeEnabled()

    const file = new File(['audio'], 'ng.mp3', { type: 'audio/mpeg' })
    fireEvent.change(fileInput, {
      target: { files: [file] },
    })

    await waitFor(() =>
      expect(onExampleAudioFile).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          exampleAudio: readyAudio,
        }),
      ),
    )
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        ...exercise(),
        exampleAudio: uploaded,
      }),
    )
    cleanup()
    render(() => (
      <ExercisePreview value={{ ...exercise(), exampleAudio: uploaded }} />
    ))

    expect(
      screen.getByRole('img', {
        name: 'Live singing pitch moving from left to right',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Runtime canvas')).toBeInTheDocument()
  })

  it('offers a five-second microphone recording action for ready audio', () => {
    const mediaRecorderStub = vi.fn() as unknown as typeof MediaRecorder
    Object.defineProperty(mediaRecorderStub, 'isTypeSupported', {
      value: () => true,
    })
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: mediaRecorderStub,
    })
    const readyAudio: ZenExampleAudio = {
      src: '',
      durationMs: 5000,
      locale: 'en-GB',
      source: 'coach',
      transcript: 'NG',
    }

    render(() => (
      <ExerciseEditor
        value={{ ...exercise(), exampleAudio: readyAudio }}
        lifecycle="draft"
        status="idle"
        validationIssues={[]}
        onChange={vi.fn()}
        onExampleAudioFile={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('button', { name: 'Record 5-second example' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('progressbar', { name: 'Example recording duration' }),
    ).toHaveAttribute('aria-valuemax', '5000')
    expect(
      screen.getByText('Stops automatically at five seconds.'),
    ).toBeVisible()
  })

  it('keeps superseded versions read-only while retaining preview access', () => {
    const historical = { ...exercise(), version: 1, title: 'Version One' }
    render(() => (
      <ExerciseEditor
        value={historical}
        lifecycle="superseded"
        status="idle"
        validationIssues={[]}
        onChange={vi.fn()}
        onDuplicate={vi.fn()}
      />
    ))

    expect(screen.getByDisplayValue('Version One')).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create draft revision' }),
    ).not.toBeInTheDocument()

    cleanup()
    render(() => <ExercisePreview value={historical} />)
    expect(screen.getByText('Runtime canvas')).toBeInTheDocument()
  })
})

describe('ExerciseTimelineEditor keyboard access', () => {
  it('moves, retunes, resizes, and duplicates the selected target', () => {
    const source = exercise()
    const onChange = vi.fn()
    render(() => (
      <ExerciseTimelineEditor
        value={source}
        selectedTargetId="note-1"
        onSelectedTargetIdChange={vi.fn()}
        onChange={onChange}
      />
    ))
    const timeline = screen.getByTestId('exercise-authoring-timeline')
    timeline.focus()

    fireEvent.keyDown(timeline, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targets: [expect.objectContaining({ id: 'note-1', semitone: 1 })],
      }),
    )

    fireEvent.keyDown(timeline, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targets: [expect.objectContaining({ id: 'note-1', startBeat: 1.25 })],
      }),
    )

    fireEvent.keyDown(timeline, { key: 'ArrowRight', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targets: [
          expect.objectContaining({
            id: 'note-1',
            durationBeats: 1.25,
          }),
        ],
      }),
    )

    fireEvent.keyDown(timeline, { key: 'd', ctrlKey: true })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targets: [
          source.targets[0],
          expect.objectContaining({ id: 'note-2', cue: 'NG' }),
        ],
      }),
    )
  })
})
