// Runner session — cancellable readiness, one continuous mic and capture-clock epochs around the pure course.
import type { PitchObservation } from '../contracts'
import type { GlassVoicePreparation, GlassVoiceSession } from '../host'
import type { CompiledRunnerCourse, RunnerEvent, RunnerInput, } from '../runner/contracts'
import { createSongRunnerGame } from '../runner/game'
import type { RunnerAudioSchedule, RunnerAudioTransport, RunnerPauseReason, RunnerSessionFrame, RunnerSessionState, SongRunnerHost, SongRunnerSession, } from '../runner/session-contracts'
import { clampRunnerAudioPreferences } from '../runner/session-contracts'
import { microphoneIssue, microphoneTakeoverTimedOut } from '../ui/mic-error'
import { readRunnerAudioPreferences, RUNNER_AUDIO_PREFERENCE, } from './runner-host'
import { createRunnerReadinessTracker } from './runner-readiness'

const READINESS_SECONDS = 0.7
const REFERENCE_IDLE = Object.freeze({ phase: 'idle', error: null } as const)
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
  const readiness = createRunnerReadinessTracker({
    targetMidi: comfortableMidi,
    judge: course.voice.judge,
    requiredAcceptedSeconds: READINESS_SECONDS,
  })
  const audioPreferences = readRunnerAudioPreferences(host)
  let state: RunnerSessionState = Object.freeze({
    phase: 'idle',
    game: game.snapshot(),
    microphone: 'closed',
    readiness: null,
    countIn: null,
    musicMuted: audioPreferences.musicMuted,
    audioPreferences,
    backing: null,
    referencePlayback: REFERENCE_IDLE,
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
  let referencePending: Promise<void> | null = null
  let quiet: Promise<void> = Promise.resolve()
  let takingOver = false
  let schedule: RunnerAudioSchedule | null = null
  let epoch: string | null = null
  let lastRequestedCourseSeconds = 0
  let intent: 'fresh' | 'resume' = 'fresh'
  let checkpointId = course.checkpoints[0]!.id
  let inputSequence = 0
  let lastVoiceReceipt = -Infinity
  let lastMixSequence = -1,
    lastMixCapture = -Infinity
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
    referencePending = null
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
      referencePlayback: REFERENCE_IDLE,
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
      referencePlayback: REFERENCE_IDLE,
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
        true,
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
        true,
      )
    } else {
      for (const event of events)
        if (event.type === 'target-hit')
          audio?.shatter?.(event.result.targetId, event.atCourseSeconds)
      publish({}, events, presentation)
    }
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
      !foreground
    )
      return
    const now = audio.currentAudioSeconds()
    if (now === null || !readiness.canStart(now)) return
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
      const currentReadiness = state.readiness!
      const nextReadiness = readiness.advance(now)
      if (nextReadiness !== currentReadiness)
        publish({ readiness: nextReadiness })
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
        lastVoiceReceipt = -Infinity
        lastMixSequence = -1
        lastMixCapture = -Infinity
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
      const nextReadiness = readiness.observe(value, now)
      if (nextReadiness === null) return
      publish({ readiness: nextReadiness })
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
    game.observe({
      epoch,
      sequence: value.sequence,
      captureCourseSeconds: capture,
      receivedCourseSeconds: received,
      midi: value.midi,
      confidence: value.confidence,
    })
    if (
      Number.isSafeInteger(value.sequence) &&
      value.sequence > lastMixSequence &&
      Number.isFinite(capture) &&
      capture > lastMixCapture &&
      capture >= schedule.courseStartSeconds &&
      capture <= received &&
      received - capture <= course.voice.judge.maximumDeliveryLatencySeconds &&
      Number.isFinite(value.confidence) &&
      value.confidence >= 0 &&
      value.confidence <= 1 &&
      (value.midi === null || Number.isFinite(value.midi))
    ) {
      lastMixSequence = value.sequence
      lastMixCapture = capture
      const voiced =
        value.midi !== null &&
        value.confidence >= course.voice.judge.minimumConfidence
      // Duck any credible voice, including a wrong note. Scoring silence is
      // already in PCM and scheduled guards; this is only an extra mix dip.
      audio.setVoiceActive(voiced)
      if (voiced) lastVoiceReceipt = now
    }
    // Delivery order matters: evidence at the settlement boundary arrives first.
    advance(now)
  }

  function prepareAudio(
    onInterruption = () => pause('audio-interrupted'),
  ): RunnerAudioTransport {
    const next = host.createRunnerAudio(course, comfortableMidi)
    audio = next
    next.setPreferences(state.audioPreferences)
    unsubscribeAudio = next.subscribeInterruption(onInterruption)
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
    referencePending = null
    closeResources()
    game.pause()
    const token = ++attempt
    intent = wanted
    const snapshot = game.snapshot()
    checkpointId =
      wanted === 'fresh'
        ? course.checkpoints[0]!.id
        : (snapshot.recoveryCheckpointId ?? snapshot.lastCheckpointId)
    const preparedCheckpoint = game.prepareCheckpoint(
      wanted === 'fresh' ? undefined : checkpointId,
    )
    if (!preparedCheckpoint.ok) {
      prepared?.release()
      fail({
        code: 'start-failed',
        message: 'The run could not restart. Start a new run.',
        canRetry: true,
      })
      return Promise.resolve()
    }
    checkpointId = preparedCheckpoint.checkpointId
    publish(
      {
        phase: 'preparing',
        microphone: 'opening',
        error: null,
        pauseReason: null,
        readiness: null,
        countIn: null,
        backing: null,
        referencePlayback: REFERENCE_IDLE,
      },
      [],
      true,
    )
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
        async ([gesture, available]) => {
          if (!gesture || !available || !current(token)) return false
          const backing = await localAudio.prepareBacking()
          if (!current(token)) return false
          publish({ backing })
          return true
        },
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
      unsubscribeVoice = localVoice.subscribe(
        (value) => observation(value, token),
        () => pause('microphone-interrupted'),
      )
      if (!current(token)) return
      publish({
        phase: 'readiness',
        microphone: 'ready',
        readiness: readiness.reset(now),
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
    invalidate()
    takingOver = true
    const token = attempt
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
    publish({
      phase: 'preparing',
      microphone: 'closed',
      referencePlayback: REFERENCE_IDLE,
    })
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

  function hearReference(): Promise<void> {
    if (referencePending) return referencePending
    if (
      disposed ||
      pending ||
      takingOver ||
      !foreground ||
      state.microphone !== 'closed' ||
      state.referencePlayback.phase !== 'idle' ||
      !['idle', 'paused', 'error'].includes(state.phase)
    )
      return Promise.resolve()
    invalidate()
    const token = attempt
    let next: RunnerAudioTransport | undefined
    let error: string | null = null
    publish({ referencePlayback: { phase: 'preparing', error: null } })
    if (!current(token)) return Promise.resolve()
    const work = (async () => {
      try {
        next = prepareAudio(() => {
          if (!current(token)) return
          error = 'Note playback was interrupted. Tap Hear note to try again.'
          closeResources()
        })
        // Unlock in the direct gesture, but keep any retired output tail out
        // of this example. Disposal also settles an unfinished unlock.
        const available = await Promise.race([
          Promise.all([next.unlock(), quiet]).then(([ready]) => ready),
          next.finished.then(() => false),
        ])
        if (!current(token)) return
        if (!available) throw new Error('Audio is unavailable.')
        publish({ referencePlayback: { phase: 'playing', error: null } })
        if (!current(token)) return
        await Promise.race([next.hearReference(comfortableMidi), next.finished])
      } catch {
        if (current(token))
          error ??= 'The note could not play. Tap Hear note to try again.'
      } finally {
        if (current(token)) closeResources()
        await next?.finished
        if (current(token))
          publish({ referencePlayback: { phase: 'idle', error } })
      }
    })()
    referencePending = work.finally(() => {
      if (current(token)) referencePending = null
    })
    return referencePending
  }

  const unsubscribeForeground = host.subscribeForeground((value) => {
    foreground = value
    if (!value && !disposed) pause('background')
  })

  function submitInput(
    command:
      | { action: Exclude<RunnerInput['action'], 'steer'> }
      | { action: 'steer'; axis: number },
  ): boolean {
    const now = audio?.currentAudioSeconds()
    if (disposed || state.phase !== 'running' || epoch === null || now == null)
      return false
    if (excessiveGap(now)) {
      advance(now)
      return false
    }
    const accepted = game.input({
      epoch,
      sequence: ++inputSequence,
      atCourseSeconds: courseTime(now),
      ...command,
    })
    advance(now)
    return accepted
  }

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
      publish({
        phase: 'paused',
        microphone: 'closed',
        error: null,
        referencePlayback: REFERENCE_IDLE,
      })
      return begin('fresh')
    },
    pause,
    hearReference,
    input: (action) => submitInput({ action }),
    steer(axis) {
      if (!Number.isFinite(axis) || axis < -1 || axis > 1) return false
      return submitInput({ action: 'steer', axis })
    },
    setMusicMuted(value) {
      session.setAudioPreferences({ musicMuted: value })
    },
    setAudioPreferences(patch) {
      if (disposed) return
      const preferences = clampRunnerAudioPreferences(
        patch,
        state.audioPreferences,
      )
      audio?.setPreferences(preferences)
      try {
        host.writePreference(
          RUNNER_AUDIO_PREFERENCE,
          JSON.stringify(preferences),
        )
      } catch {
        /* Current mix still works. */
      }
      publish({
        musicMuted: preferences.musicMuted,
        audioPreferences: preferences,
      })
    },
    setPresentationReady(value) {
      if (disposed || presentationReady === value) return
      presentationReady = value
      if (
        !value &&
        (state.referencePlayback.phase !== 'idle' ||
          ['preparing', 'readiness', 'count-in', 'running'].includes(
            state.phase,
          ))
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
        referencePlayback: REFERENCE_IDLE,
      })
      listeners.clear()
    },
  }
  if (host.takeOverMicrophone) session.takeOverMicrophone = takeOverMicrophone
  return session
}
