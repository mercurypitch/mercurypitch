import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExerciseEditor, getExerciseRecordingLimitMs, isExerciseEditorBusy, } from '@/features/admin/exercises/ExerciseEditor'
import { ExercisePreview } from '@/features/admin/exercises/ExercisePreview'
import { ExerciseTimelineEditor } from '@/features/admin/exercises/ExerciseTimelineEditor'
import type { ZenExampleAudio, ZenExerciseDefinition, } from '@/features/zen/types'
import { micManager } from '@/lib/mic-manager'

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

  it('allows audio selection before its transcript is ready', () => {
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
    const fileInput = screen.getByLabelText(/Choose audio file/)
    expect(fileInput).toBeEnabled()
    expect(fileInput).toHaveAttribute('accept', expect.stringContaining('.wav'))
    expect(
      screen.getByText(/or drop audio anywhere in this box/i),
    ).toBeVisible()
    expect(
      screen.getByText(/select any region up to 15 seconds/i),
    ).toBeVisible()
  })

  it('renders uploaded example metadata in the production preview', () => {
    const uploaded: ZenExampleAudio = {
      src: '/media/ng-example.mp3',
      durationMs: 4200,
      locale: 'en-GB',
      source: 'coach',
      transcript: 'NG',
    }
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

  it('offers five-second, ten-second, and custom recording windows', () => {
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
      screen.queryByText('Stops automatically at five seconds.'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Stops automatically at 5 seconds. Replay, trim, or record again before upload.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: '10 sec' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('keeps the active recording meter aligned with a custom duration', async () => {
    class MediaRecorderStub {
      static isTypeSupported(): boolean {
        return true
      }

      mimeType = 'audio/webm;codecs=opus'
      ondataavailable: ((event: BlobEvent) => void) | null = null
      onerror: (() => void) | null = null
      onstop: (() => void) | null = null
      state: RecordingState = 'inactive'

      start(): void {
        this.state = 'recording'
      }

      stop(): void {
        this.state = 'inactive'
      }
    }
    vi.stubGlobal('MediaRecorder', MediaRecorderStub)
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream
    vi.spyOn(micManager, 'acquire').mockResolvedValue(stream)
    vi.spyOn(micManager, 'release').mockImplementation(() => undefined)
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn() },
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

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    fireEvent.input(screen.getByLabelText(/Custom seconds/), {
      target: { value: '12' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Record 12-second example' }),
    )

    await screen.findByText('Recording live')
    await waitFor(() =>
      expect(
        screen.getByRole('progressbar', {
          name: 'Example recording duration',
        }),
      ).toHaveAttribute('aria-valuemax', '12000'),
    )
  })

  it('normalizes preset and custom recording windows', () => {
    expect(getExerciseRecordingLimitMs(5)).toBe(5000)
    expect(getExerciseRecordingLimitMs(10)).toBe(10000)
    expect(getExerciseRecordingLimitMs('custom', 12)).toBe(12000)
    expect(getExerciseRecordingLimitMs('custom', 0)).toBe(1000)
    expect(getExerciseRecordingLimitMs('custom', 30)).toBe(15000)
  })

  it('treats an active recording as a blocking editor action', () => {
    expect(isExerciseEditorBusy(false, false, true)).toBeTruthy()
    expect(isExerciseEditorBusy(false, false, false)).toBeFalsy()
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
  it('adds a note at the clicked empty-grid beat and pitch', () => {
    const source = exercise()
    const onChange = vi.fn()
    const onSelectedTargetIdChange = vi.fn()
    render(() => (
      <ExerciseTimelineEditor
        value={source}
        selectedTargetId={null}
        onSelectedTargetIdChange={onSelectedTargetIdChange}
        onChange={onChange}
      />
    ))

    const timeline = screen.getByTestId('exercise-authoring-timeline')
    const canvas = timeline.querySelector('canvas')
    expect(canvas).not.toBeNull()
    if (canvas === null) return
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 350,
      width: 800,
      height: 350,
      toJSON: () => ({}),
    })
    Object.defineProperties(canvas, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    })

    const dispatchPointer = (type: 'pointerdown' | 'pointerup'): void => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperties(event, {
        pointerId: { value: 7 },
        clientX: { value: 515 },
        clientY: { value: 117 },
      })
      fireEvent(canvas, event)
    }
    dispatchPointer('pointerdown')
    dispatchPointer('pointerup')

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [
          source.targets[0],
          expect.objectContaining({
            id: 'note-2',
            startBeat: 5,
            semitone: 5,
          }),
        ],
      }),
    )
    expect(onSelectedTargetIdChange).toHaveBeenLastCalledWith('note-2')
  })

  it('keeps pitch metadata in the field heading so inputs share one baseline', () => {
    render(() => (
      <ExerciseTimelineEditor
        value={exercise()}
        selectedTargetId="note-1"
        onSelectedTargetIdChange={vi.fn()}
        onChange={vi.fn()}
      />
    ))

    const input = screen.getByLabelText('Start semitone for note-1')
    const heading = input.previousElementSibling
    expect(heading).toHaveTextContent('Start pitch')
    expect(heading).toHaveTextContent('0 · A3')
    expect(input.nextElementSibling).toBeNull()
  })

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
