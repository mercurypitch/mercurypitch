// Runner session — cancellable readiness, one continuous mic and capture-clock epochs around the pure course.
import type { PitchObservation } from '../contracts'
import type { GlassVoicePreparation, GlassVoiceSession } from '../host'
import type { CompiledRunnerCourse, RunnerEvent } from '../runner/contracts'
import { createSongRunnerGame } from '../runner/game'
import { runnerTargetMidiAt } from '../runner/pitch'
import type { RunnerAudioSchedule, RunnerAudioTransport, RunnerPauseReason, RunnerSessionFrame, RunnerSessionState, SongRunnerHost, SongRunnerSession, } from '../runner/session-contracts'
import { microphoneIssue, microphoneTakeoverTimedOut } from '../ui/mic-error'

const READINESS_SECONDS = 0.35
const MUSIC_PREFERENCE = 'runner-music-muted:v1'
let nextEpoch = 0

/** Only scheduling is injected; tests still exercise the real core and timestamp routing. */
export interface RunnerSessionRuntime {
  requestFrame(callback: () => void): number
  cancelFrame(id: number): void
  epoch(): string
}
const browserRuntime: RunnerSessionRuntime = {
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  epoch: () => `runner:${++nextEpoch}`,
}

export function createBrowserRunnerSession(
  options: {
    readonly course: CompiledRunnerCourse
    readonly comfortableMidi: number
    readonly host: SongRunnerHost
  },
  runtime: RunnerSessionRuntime = browserRuntime,
): SongRunnerSession {
  const { course, comfortableMidi, host } = options
  const game = createSongRunnerGame(course, {
    comfortableMidi,
    progress: host.loadRunnerProgress(course.id),
  })
  let muted = false
  try {
    muted = host.readPreference(MUSIC_PREFERENCE) === 'true'
  } catch {
    /* Optional preference. */
  }
  let state: RunnerSessionState = Object.freeze({
    phase: 'idle',
    game: game.snapshot(),
    microphone: 'closed',
    readiness: null,
    countIn: null,
    musicMuted: muted,
    pauseReason: null,
    error: null,
  })
  let attempt = 0,
    disposed = false,
    presentationReady = false,
    foreground = true
  let frame: number | null = null
  let voice: GlassVoiceSession | null = null
  let audio: RunnerAudioTransport | null = null
  let preparation: GlassVoicePreparation | null = null
  let unsubscribeVoice: (() => void) | undefined,
    unsubscribeAudio: (() => void) | undefined
  let pending: Promise<void> | null = null
  let quiet: Promise<void> = Promise.resolve()
  let takingOver = false
  let schedule: RunnerAudioSchedule | null = null
  let epoch: string | null = null
  let lastRequestedCourseSeconds = 0
  let intent: 'fresh' | 'resume' = 'fresh'
  let checkpointId = course.checkpoints[0]!.id
  let inputSequence = 0
  let readinessSince = 0,
    readinessAccepted = 0,
    lastSequence = -1,
    lastCapture = -Infinity,
    previousCompatible = false
  let lastVoiceReceipt = -Infinity
  let publishing = false
  const frames: RunnerSessionFrame[] = []
  const listeners = new Set<(frame: RunnerSessionFrame) => void>()

  function publish(
    patch: Partial<RunnerSessionState> = {},
    events: readonly RunnerEvent[] = [],
    presentation = false,
  ): void {
    state = Object.freeze({ ...state, ...patch, game: game.snapshot() })
    frames.push(Object.freeze({ state, events, presentation }))
    if (publishing) return
    publishing = true
    try {
      while (frames.length) {
        const next = frames.shift()!
        for (const listener of [...listeners]) {
          if (!listeners.has(listener)) continue
          try {
            listener(next)
          } catch {
            /* Presentation cannot interrupt clock or resource cleanup. */
          }
        }
      }
    } finally {
      publishing = false
    }
  }

  function persist(): void {
    try {
      host.saveRunnerProgress(game.saveProgress())
    } catch {
      /* Core progress remains available in this visit. */
    }
  }

  function cancelFrame(): void {
    if (frame !== null) runtime.cancelFrame(frame)
    frame = null
  }

  function closeResources(): void {
    cancelFrame()
    unsubscribeVoice?.()
    unsubscribeVoice = undefined
    unsubscribeAudio?.()
    unsubscribeAudio = undefined
    voice?.stop()
    voice = null
    if (audio) {
      const closing = audio
      quiet = Promise.all([quiet, closing.finished]).then(() => undefined)
      closing.dispose()
      audio = null
    }
    preparation?.release()
    preparation = null
    schedule = null
    epoch = null
  }

  function current(token: number): boolean {
    return !disposed && attempt === token
  }

  function invalidate(): void {
    attempt++
    pending = null
    closeResources()
  }

  function pause(reason: RunnerPauseReason = 'manual'): void {
    if (disposed) return
    invalidate()
    game.pause()
    persist()
    publish({
      phase: ['idle', 'finished'].includes(state.phase)
        ? state.phase
        : 'paused',
      microphone: 'closed',
      readiness: null,
      countIn: null,
      pauseReason: reason,
      error: null,
    })
  }

  function fail(error: NonNullable<RunnerSessionState['error']>): void {
    invalidate()
    game.pause()
    persist()
    publish({
      phase: 'error',
      microphone: 'closed',
      readiness: null,
      countIn: null,
      pauseReason: null,
      error,
    })
  }

  function handleEvents(presentation = false): void {
    const events = game.drainEvents()
    if (events.length) persist()
    if (events.some((event) => event.type === 'course-finished')) {
      invalidate()
      publish(
        {
          phase: 'finished',
          microphone: 'closed',
          countIn: null,
          readiness: null,
        },
        events,
        presentation,
      )
    } else if (events.some((event) => event.type === 'recovery-required')) {
      invalidate()
      publish(
        {
          phase: 'recovering',
          microphone: 'closed',
          countIn: null,
          readiness: null,
          pauseReason: null,
        },
        events,
        presentation,
      )
    } else publish({}, events, presentation)
  }

  function courseTime(now: number): number {
    return schedule!.courseStartSeconds + now - schedule!.audioStartSeconds
  }

  function excessiveGap(now: number): boolean {
    return (
      Math.min(course.lengthCourseSeconds, courseTime(now)) -
        lastRequestedCourseSeconds >
      course.movement.maxCatchUpSeconds + 1e-9
    )
  }

  function advance(now: number, presentation = false): void {
    if (epoch === null || state.phase !== 'running') return
    const requested = Math.min(
      course.lengthCourseSeconds,
      Math.max(schedule!.courseStartSeconds, courseTime(now)),
    )
    game.advanceTo(epoch, requested)
    // The fixed-step snapshot can trail this request by almost one step.
    lastRequestedCourseSeconds = requested
    handleEvents(presentation)
  }

  function maybeCountIn(): void {
    if (
      state.phase !== 'readiness' ||
      !audio ||
      !presentationReady ||
      !foreground ||
      readinessAccepted < READINESS_SECONDS
    )
      return
    const now = audio.currentAudioSeconds()
    if (
      now === null ||
      now - lastCapture > course.voice.judge.maximumDeliveryLatencySeconds
    )
      return
    const checkpoint = course.checkpoints.find(
      (item) => item.id === checkpointId,
    )!
    try {
      schedule = audio.schedule(checkpoint)
      publish({
        phase: 'count-in',
        readiness: null,
        countIn: { beatsRemaining: checkpoint.countInBeats, beatProgress: 0 },
      })
    } catch {
      fail({
        code: 'start-failed',
        message: 'The run could not start. Try again.',
        canRetry: true,
      })
    }
  }

  function tick(): void {
    frame = null
    if (disposed || !audio) return
    const now = audio.currentAudioSeconds()
    if (now === null) {
      pause('audio-interrupted')
      return
    }
    if (state.phase === 'readiness') {
      if (
        now - lastCapture > course.voice.judge.maximumEvidenceGapSeconds &&
        readinessAccepted > 0
      ) {
        readinessAccepted = 0
        previousCompatible = false
        publish({ readiness: { targetMidi: comfortableMidi, fillProgress: 0 } })
      }
      maybeCountIn()
      publish({}, [], true)
    } else if (state.phase === 'count-in' && schedule) {
      if (now >= schedule.audioStartSeconds) {
        const token = runtime.epoch()
        const result = game.beginEpoch(
          token,
          intent === 'resume' ? checkpointId : undefined,
        )
        if (!result.ok) {
          fail({
            code: 'start-failed',
            message: 'The run could not restart. Start a new run.',
            canRetry: true,
          })
          return
        }
        epoch = token
        lastRequestedCourseSeconds = result.startCourseSeconds
        inputSequence = 0
        publish({ phase: 'running', countIn: null })
        advance(now, true)
      } else {
        const beats = Math.max(
          0,
          (now - schedule.countInStartAudioSeconds) / schedule.secondsPerBeat,
        )
        publish(
          {
            countIn: {
              beatsRemaining: Math.max(
                0,
                schedule.countInBeats - Math.floor(beats),
              ),
              beatProgress: beats % 1,
            },
          },
          [],
          true,
        )
      }
    } else if (state.phase === 'running') {
      if (now - lastVoiceReceipt > 0.12) audio.setVoiceActive(false)
      advance(now, true)
    }
    ensureFrame()
  }

  function ensureFrame(): void {
    if (
      frame === null &&
      !disposed &&
      ['readiness', 'count-in', 'running'].includes(state.phase)
    )
      frame = runtime.requestFrame(tick)
  }

  function observation(value: PitchObservation, token: number): void {
    if (!current(token) || !audio) return
    const now = audio.currentAudioSeconds()
    if (now === null) {
      pause('audio-interrupted')
      return
    }
    if (state.phase === 'readiness') {
      const latency = now - value.captureSeconds
      if (
        !Number.isInteger(value.sequence) ||
        value.sequence <= lastSequence ||
        !Number.isFinite(value.captureSeconds) ||
        value.captureSeconds <= lastCapture ||
        value.captureSeconds < readinessSince ||
        latency < 0 ||
        latency > course.voice.judge.maximumDeliveryLatencySeconds
      )
        return
      const compatible =
        value.midi !== null &&
        Number.isFinite(value.midi) &&
        Number.isFinite(value.confidence) &&
        value.confidence >= course.voice.judge.minimumConfidence &&
        value.confidence <= 1 &&
        Math.abs(value.midi - comfortableMidi) * 100 <=
          course.voice.judge.centsTolerance
      const gap = value.captureSeconds - lastCapture
      if (
        compatible &&
        previousCompatible &&
        gap <= course.voice.judge.maximumEvidenceGapSeconds
      )
        readinessAccepted += gap
      else readinessAccepted = 0
      previousCompatible = compatible
      lastSequence = value.sequence
      lastCapture = value.captureSeconds
      publish({
        readiness: {
          targetMidi: comfortableMidi,
          fillProgress: Math.min(1, readinessAccepted / READINESS_SECONDS),
        },
      })
      maybeCountIn()
      ensureFrame()
      return
    }
    if (state.phase !== 'running' || epoch === null || !schedule) return
    if (excessiveGap(now)) {
      advance(now)
      return
    }
    const received = courseTime(now)
    const capture =
      schedule.courseStartSeconds +
      value.captureSeconds -
      schedule.audioStartSeconds
    const accepted = game.observe({
      epoch,
      sequence: value.sequence,
      captureCourseSeconds: capture,
      receivedCourseSeconds: received,
      midi: value.midi,
      confidence: value.confidence,
    })
    if (accepted) {
      const target = course.targets.find(
        (item) =>
          capture >= item.judgeOpenCourseSeconds &&
          capture <= item.judgeCloseCourseSeconds,
      )
      const compatible =
        target !== undefined &&
        value.midi !== null &&
        value.confidence >= course.voice.judge.minimumConfidence &&
        Math.abs(
          value.midi -
            runnerTargetMidiAt(
              target.notes,
              capture,
              comfortableMidi + course.voice.comfortableRootOffsetSemitones,
            ),
        ) *
          100 <=
          course.voice.judge.centsTolerance
      audio.setVoiceActive(compatible)
      if (compatible) lastVoiceReceipt = now
    }
    // Delivery order matters: evidence at the settlement boundary arrives first.
    advance(now)
  }

  function prepareAudio(): RunnerAudioTransport {
    const next = host.createRunnerAudio(course, comfortableMidi)
    audio = next
    next.setMuted(state.musicMuted)
    unsubscribeAudio = next.subscribeInterruption(() =>
      pause('audio-interrupted'),
    )
    return next
  }

  function begin(
    wanted: 'fresh' | 'resume',
    prepared?: GlassVoicePreparation,
  ): Promise<void> {
    if (disposed || !foreground) {
      prepared?.release()
      return Promise.resolve()
    }
    if (pending) {
      prepared?.release()
      return pending
    }
    if (takingOver && !prepared) return Promise.resolve()
    if (['running', 'count-in', 'readiness'].includes(state.phase)) {
      prepared?.release()
      return Promise.resolve()
    }
    closeResources()
    game.pause()
    const token = ++attempt
    intent = wanted
    const snapshot = game.snapshot()
    checkpointId =
      wanted === 'fresh'
        ? course.checkpoints[0]!.id
        : (snapshot.recoveryCheckpointId ?? snapshot.lastCheckpointId)
    publish({
      phase: 'preparing',
      microphone: 'opening',
      error: null,
      pauseReason: null,
      readiness: null,
      countIn: null,
    })
    if (!current(token)) {
      prepared?.release()
      return Promise.resolve()
    }
    let localVoice: GlassVoiceSession
    let localAudio: RunnerAudioTransport
    let ready: Promise<boolean>
    let capture: Promise<void>
    try {
      preparation = prepared ?? host.prepareVoiceGesture()
      localAudio = prepareAudio()
      // These calls all happen before the first await, preserving gesture scope.
      ready = Promise.all([preparation.ready, localAudio.unlock()]).then(
        ([gesture, available]) => gesture && available,
      )
      localVoice = host.createVoice()
      voice = localVoice
      capture = localVoice.start(
        Promise.all([ready, quiet]).then(([available]) => {
          if (!available) throw new Error('Audio is unavailable.')
        }),
      )
    } catch {
      prepared?.release()
      fail({
        code: 'start-failed',
        message: 'The run could not start. Try again.',
        canRetry: true,
      })
      return Promise.resolve()
    }
    const work = (async () => {
      const [audioResult, micResult] = await Promise.allSettled([
        ready,
        capture,
      ])
      if (!current(token)) return
      if (audioResult.status !== 'fulfilled' || !audioResult.value) {
        fail({
          code: 'audio-unavailable',
          message: 'Audio could not start. Tap Start to try again.',
          canRetry: true,
        })
        return
      }
      if (micResult.status === 'rejected') {
        const issue = microphoneIssue(micResult.reason)
        fail({
          code: 'microphone-unavailable',
          message: issue.message,
          canRetry: issue.action !== 'none',
          microphoneIssue: issue,
        })
        return
      }
      const now = localAudio.currentAudioSeconds()
      if (now === null) {
        pause('audio-interrupted')
        return
      }
      preparation?.release()
      preparation = null
      readinessSince = now
      readinessAccepted = 0
      lastSequence = -1
      lastCapture = -Infinity
      previousCompatible = false
      unsubscribeVoice = localVoice.subscribe(
        (value) => observation(value, token),
        () => pause('microphone-interrupted'),
      )
      if (!current(token)) return
      publish({
        phase: 'readiness',
        microphone: 'ready',
        readiness: { targetMidi: comfortableMidi, fillProgress: 0 },
      })
      ensureFrame()
    })()
    pending = work.finally(() => {
      if (current(token)) pending = null
    })
    return pending
  }

  async function releaseUnused(): Promise<void> {
    try {
      await host.releaseUnusedMicrophoneTakeover?.()
    } catch {
      /* Next acquisition rechecks the lock. */
    }
  }

  async function takeOverMicrophone(): Promise<void> {
    if (
      disposed ||
      !foreground ||
      pending ||
      takingOver ||
      state.phase !== 'error' ||
      state.error?.microphoneIssue?.action !== 'take-over' ||
      !host.takeOverMicrophone
    )
      return
    takingOver = true
    const token = ++attempt
    let prepared: GlassVoicePreparation
    try {
      prepared = host.prepareVoiceGesture()
    } catch {
      takingOver = false
      fail({
        code: 'audio-unavailable',
        message: 'Audio could not start. Tap Start to try again.',
        canRetry: true,
      })
      return
    }
    void prepared.ready.catch(() => undefined)
    preparation = prepared
    publish({ phase: 'preparing', microphone: 'closed' })
    if (!current(token)) {
      takingOver = false
      prepared.release()
      return
    }
    let moved = false
    try {
      moved = await host.takeOverMicrophone()
    } catch {
      /* Classified timeout below. */
    }
    takingOver = false
    if (!current(token)) {
      prepared.release()
      if (moved) await releaseUnused()
      return
    }
    preparation = null
    if (!moved) {
      prepared.release()
      const issue = microphoneTakeoverTimedOut()
      fail({
        code: 'microphone-unavailable',
        message: issue.message,
        canRetry: true,
        microphoneIssue: issue,
      })
      return
    }
    await begin(intent, prepared)
    if (!['readiness', 'count-in', 'running'].includes(state.phase))
      await releaseUnused()
  }
  const unsubscribeForeground = host.subscribeForeground((value) => {
    foreground = value
    if (!value && !disposed) pause('background')
  })
  const session: SongRunnerSession = {
    state: () => state,
    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      listener({ state, events: [] })
      return () => {
        listeners.delete(listener)
      }
    },
    start: () => begin(state.phase === 'error' ? intent : 'fresh'),
    resume: () => begin('resume'),
    restart() {
      if (disposed) return Promise.resolve()
      invalidate()
      game.pause()
      publish({ phase: 'paused', microphone: 'closed', error: null })
      return begin('fresh')
    },
    pause,
    async hearReference() {
      if (
        disposed ||
        pending ||
        !foreground ||
        state.microphone !== 'closed' ||
        !['idle', 'paused', 'error'].includes(state.phase)
      )
        return
      const previous = state.phase
      invalidate()
      const token = attempt
      let next: RunnerAudioTransport | undefined
      publish({ phase: 'preparing', error: null })
      if (!current(token)) return
      try {
        next = prepareAudio()
        if (!(await next.unlock())) throw new Error('Audio is unavailable.')
        if (!current(token)) return
        await next.hearReference(comfortableMidi)
      } catch {
        if (current(token))
          fail({
            code: 'audio-unavailable',
            message: 'Audio could not start. Tap Hear note to try again.',
            canRetry: true,
          })
      } finally {
        next?.dispose()
        if (current(token)) {
          closeResources()
          publish({
            phase: previous === 'idle' ? 'idle' : 'paused',
            microphone: 'closed',
          })
        }
      }
    },
    input(action) {
      const now = audio?.currentAudioSeconds()
      if (
        disposed ||
        state.phase !== 'running' ||
        epoch === null ||
        now == null
      )
        return false
      if (excessiveGap(now)) {
        advance(now)
        return false
      }
      const accepted = game.input({
        epoch,
        sequence: ++inputSequence,
        atCourseSeconds: courseTime(now),
        action,
      })
      advance(now)
      return accepted
    },
    setMusicMuted(value) {
      if (disposed) return
      audio?.setMuted(value)
      try {
        host.writePreference(MUSIC_PREFERENCE, String(value))
      } catch {
        /* Current mix still works. */
      }
      publish({ musicMuted: value })
    },
    setPresentationReady(value) {
      if (disposed || presentationReady === value) return
      presentationReady = value
      if (
        !value &&
        ['preparing', 'readiness', 'count-in', 'running'].includes(state.phase)
      )
        pause('renderer-unavailable')
      else if (value) maybeCountIn()
    },
    dispose() {
      if (disposed) return
      disposed = true
      invalidate()
      game.pause()
      persist()
      unsubscribeForeground()
      publish({
        phase: 'disposed',
        microphone: 'closed',
        readiness: null,
        countIn: null,
      })
      listeners.clear()
    },
  }
  if (host.takeOverMicrophone) session.takeOverMicrophone = takeOverMicrophone
  return session
}
