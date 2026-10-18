// Archive Hush session — gesture-owned capture protects glass while manual movement remains available.
import type { PitchObservation } from '../contracts'
import { createArchiveHush } from '../core/archive-hush'
import type { GlassGameHost, GlassSound, GlassVoiceSession } from '../host'

type HushModel = ReturnType<typeof createArchiveHush>
export interface ArchiveHushRoom {
  id: string
  vesselIds: readonly string[]
  curtainVesselIds?: readonly string[]
  completed?: boolean
}
export interface ArchiveHushSessionSnapshot {
  roomId: string
  mode:
    | 'off'
    | 'permission'
    | 'finding'
    | 'listening'
    | 'reference'
    | 'paused'
    | 'complete'
    | 'retry'
    | 'error'
  target: number | null
  pitch: number | null
  message: string
  coverMoving: boolean
  room: ReturnType<HushModel['snapshot']>
}
interface Options {
  host: GlassGameHost
  vesselIds: readonly string[]
  roomId?: string
  curtainVesselIds?: readonly string[]
  completed?: boolean
  onComplete?(roomId: string): void
  canPlay(): boolean
  canReach(id: string): boolean
  beforeCapture(): Promise<void>
  onReleaseVoice(): void
  onChange(state: ArchiveHushSessionSnapshot): void
  now?: () => number
}
const validMidi = (value: number): boolean =>
  Number.isFinite(value) && value >= 36 && value <= 84
const LISTENING_COPY =
  'Move close to a glass, choose it, then hum its written note.'
const preparingCopy = (curtainCount: number): string =>
  curtainCount === 0
    ? 'Move close to hum two shields. Cover the third glass.'
    : `Move close to hum two shields. Cover one glass and close the curtain over ${curtainCount === 1 ? 'the remaining glass' : 'the remaining pair'}.`
const COMPLETE_COPY = 'Every glass is protected. The way ahead is open.'
const MAXIMUM_CAPTURE_AGE_MS = 150
const CALIBRATION_CONFIDENCE = 0.8
// Browser GlassSound.dispose retires its sources after 240 ms; also allow clock mapping slack.
const DISPOSED_REFERENCE_FENCE_MS = 250

export function createArchiveHushSession(options: Options) {
  const now = options.now ?? (() => performance.now())
  const stored = Number(options.host.readPreference('comfortable-note') ?? '')
  let target: number | null = validMidi(stored) ? stored : null
  let comfortableTarget = target
  const copyRoom = (room: ArchiveHushRoom): Required<ArchiveHushRoom> => {
    if (room.id.length === 0) throw new Error('Archive Hush needs a room ID')
    return {
      id: room.id,
      vesselIds: [...room.vesselIds],
      curtainVesselIds: [...(room.curtainVesselIds ?? [])],
      completed: room.completed === true,
    }
  }
  let room = copyRoom({
    id: options.roomId ?? 'archive-hush',
    vesselIds: options.vesselIds,
    curtainVesselIds: options.curtainVesselIds,
    completed: options.completed,
  })
  const makeModel = (next: ArchiveHushRoom): HushModel =>
    createArchiveHush({
      vesselIds: next.vesselIds,
      curtainVesselIds: next.curtainVesselIds,
      targetMidi: target ?? comfortableTarget ?? 60,
    })
  let model = makeModel(room)
  const completedRooms = new Set<string>(room.completed ? [room.id] : [])
  let mode: ArchiveHushSessionSnapshot['mode'] = room.completed
    ? 'complete'
    : 'off'
  let pitch: number | null = null
  let message = room.completed
    ? COMPLETE_COPY
    : preparingCopy(room.curtainVesselIds.length)
  let voice: GlassVoiceSession | null = null
  let sound: GlassSound | null = null
  let unsubscribe: (() => void) | null = null
  let generation = 0
  let disposed = false
  let ownsCapture = false
  let lastCapture: PitchObservation | null = null
  let lastObservedAt = -Infinity
  let capturedAfter = -Infinity
  let startedAt = 0
  let audibleTailUntil = -Infinity
  let coverSettledAt = -Infinity
  let calibration: PitchObservation[] = []
  const snapshot = (): ArchiveHushSessionSnapshot => ({
    roomId: room.id,
    mode,
    target,
    pitch,
    message,
    coverMoving: now() < coverSettledAt,
    room: room.completed
      ? { ...model.snapshot(), phase: 'complete' }
      : model.snapshot(),
  })
  const emit = (): void => {
    if (!disposed) options.onChange(snapshot())
  }
  const resetCaptureEvidence = (at: number): void => {
    lastCapture = null
    lastObservedAt = -Infinity
    capturedAfter = Math.max(at, audibleTailUntil)
    startedAt = at
    pitch = null
    calibration = []
  }
  const retireSound = (): void => {
    const previous = sound
    sound = null
    if (previous === null) return
    previous.dispose()
    audibleTailUntil = Math.max(
      audibleTailUntil,
      now() + DISPOSED_REFERENCE_FENCE_MS,
    )
  }
  const closeCapture = (): number => {
    const token = ++generation
    unsubscribe?.()
    unsubscribe = null
    const previous = voice
    voice = null
    previous?.stop()
    retireSound()
    resetCaptureEvidence(now())
    if (ownsCapture) {
      ownsCapture = false
      options.onReleaseVoice()
    }
    return token
  }
  const pause = (
    reason = 'Paused. Tap Resume listening when you are ready.',
  ): void => {
    if (disposed) return
    if (mode === 'complete' || mode === 'retry') {
      retireSound()
      return
    }
    if (mode === 'off' || mode === 'paused') return
    const token = closeCapture()
    if (disposed || token !== generation) return
    model.pause()
    mode = 'paused'
    message = reason
    emit()
  }
  const playOutcomeChime = (): void => {
    if (target === null || disposed || !options.canPlay()) return
    const note = target + 12
    try {
      const chime = options.host.createSound()
      sound = chime
      const token = generation
      void (async () => {
        try {
          await chime.reference(note)
        } catch {
          /* The protected/retry result does not depend on output availability. */
        } finally {
          if (token === generation && sound === chime) retireSound()
        }
      })()
    } catch {
      /* Output creation may be unavailable after an interruption. */
    }
  }
  const freshCapture = (at: number): boolean => {
    if (lastCapture === null || !Number.isFinite(at)) return false
    const age = at - lastCapture.capturedAtMs
    return age >= -5 && age <= MAXIMUM_CAPTURE_AGE_MS
  }
  const calibrate = (frame: PitchObservation, at: number): void => {
    const previous = calibration.at(-1)
    if (pitch === null) {
      calibration = []
      return
    }
    if (
      previous &&
      (frame.captureSeconds - previous.captureSeconds > 0.1 + 1e-9 ||
        frame.capturedAtMs - previous.capturedAtMs > 100 + 1e-6 ||
        Math.abs(pitch - previous.midi!) > 0.8)
    )
      calibration = []
    calibration.push(frame)
    if (calibration.length > 64) calibration.shift()
    if (
      calibration.length < 12 ||
      frame.captureSeconds - calibration[0]!.captureSeconds < 0.5 ||
      frame.capturedAtMs - calibration[0]!.capturedAtMs < 500
    )
      return
    const values = calibration
      .map((sample) => sample.midi!)
      .sort((a, b) => a - b)
    if (values.at(-1)! - values[0]! > 0.8) {
      calibration = [frame]
      return
    }
    target = Math.round(values[Math.floor(values.length / 2)]!)
    comfortableTarget = target
    options.host.writePreference('comfortable-note', String(target))
    model.setTargetMidi(target)
    model.fenceAudio(at)
    mode = 'listening'
    message = LISTENING_COPY
    calibration = []
  }
  const observe = (frame: PitchObservation, at: number): void => {
    if (disposed || !['finding', 'listening'].includes(mode)) return
    if (!options.canPlay()) {
      pause()
      return
    }
    if (
      !Number.isFinite(at) ||
      at < lastObservedAt ||
      !Number.isSafeInteger(frame.sequence) ||
      frame.sequence < 0 ||
      !Number.isFinite(frame.captureSeconds) ||
      frame.captureSeconds < 0 ||
      !Number.isFinite(frame.capturedAtMs) ||
      frame.capturedAtMs <= capturedAfter
    )
      return
    const age = at - frame.capturedAtMs
    if (age < -5 || age > MAXIMUM_CAPTURE_AGE_MS) {
      calibration = []
      pitch = null
      model.fenceAudio(at)
      emit()
      return
    }
    if (
      lastCapture &&
      (frame.sequence <= lastCapture.sequence ||
        frame.captureSeconds <= lastCapture.captureSeconds ||
        frame.capturedAtMs <= lastCapture.capturedAtMs)
    )
      return
    lastCapture = frame
    lastObservedAt = at
    pitch =
      frame.midi !== null &&
      validMidi(frame.midi) &&
      Number.isFinite(frame.confidence) &&
      frame.confidence >= CALIBRATION_CONFIDENCE
        ? frame.midi
        : null
    if (mode === 'finding') calibrate(frame, at)
    else {
      const aimed = model.snapshot().aimedId
      if (aimed !== null && !options.canReach(aimed)) model.aim(null)
      model.observe(frame, at)
    }
    emit()
  }
  const start = async (): Promise<void> => {
    if (
      disposed ||
      !options.canPlay() ||
      !['off', 'paused', 'error'].includes(mode)
    )
      return
    const token = closeCapture()
    if (disposed || token !== generation) return
    mode = 'permission'
    message = 'Opening the microphone…'
    emit()
    if (disposed || token !== generation) return
    if (!options.canPlay()) {
      pause()
      return
    }
    try {
      // Both audio creation and start occur in the initiating gesture.
      const session = options.host.createVoice()
      voice = session
      ownsCapture = true
      const started = session.start(options.beforeCapture())
      await started
      if (disposed || token !== generation) {
        session.stop()
        return
      }
      if (!options.canPlay()) {
        pause()
        return
      }
      const at = now()
      model.resume(at)
      resetCaptureEvidence(at)
      mode = target === null ? 'finding' : 'listening'
      message =
        target === null
          ? 'Hum one comfortable note. Hold it steady for a moment.'
          : LISTENING_COPY
      const detach = session.subscribe(
        (frame, observedAt) => {
          if (token === generation && voice === session)
            observe(frame, observedAt)
        },
        () => {
          if (token === generation && voice === session)
            pause(
              'The microphone stopped. Your shields are safe. Tap Resume listening.',
            )
        },
      )
      // A host may report already-ended capture synchronously during subscribe.
      if (token !== generation || disposed) detach()
      else unsubscribe = detach
      emit()
    } catch {
      if (token !== generation || disposed) return
      const closed = closeCapture()
      if (disposed || closed !== generation) return
      model.pause()
      mode = 'error'
      message =
        'The microphone could not start. Check its permission, then try again.'
      emit()
    }
  }
  const tick = (at = now()): void => {
    if (disposed) return
    if (!options.canPlay()) {
      pause()
      return
    }
    if (!['permission', 'finding', 'listening', 'reference'].includes(mode))
      return
    if (
      mode === 'permission' ||
      mode === 'reference' ||
      !Number.isFinite(at) ||
      at < startedAt
    )
      return
    const age =
      lastCapture === null ? at - startedAt : at - lastCapture.capturedAtMs
    if (age > (lastCapture === null ? 2000 : MAXIMUM_CAPTURE_AGE_MS)) {
      pause('Listening was interrupted. Tap Resume listening to try again.')
      return
    }
    if (mode !== 'listening' || lastCapture === null) return
    model.tick(at, freshCapture(at))
    const phase = model.snapshot().phase
    if (phase === 'paused') {
      pause(
        'The display paused. Tap Resume listening; the chime will start again.',
      )
      return
    }
    if (phase === 'complete' || phase === 'retry') {
      const finishedModel = model
      const finishedRoomId = room.id
      const token = closeCapture()
      if (disposed || token !== generation) return
      mode = phase
      message =
        phase === 'complete'
          ? COMPLETE_COPY
          : 'A glass was left uncovered. Rearrange your protection and try again.'
      if (phase === 'complete' && !completedRooms.has(finishedRoomId)) {
        room.completed = true
        completedRooms.add(finishedRoomId)
        options.onComplete?.(finishedRoomId)
      }
      // Completion can synchronously enter another room; its output belongs there.
      if (disposed || token !== generation || model !== finishedModel) return
      playOutcomeChime()
    }
    emit()
  }
  return {
    snapshot,
    configureRoom(next: ArchiveHushRoom): void {
      if (disposed) return
      const nextRoom = copyRoom(next)
      nextRoom.completed = nextRoom.completed || completedRooms.has(nextRoom.id)
      const sameIds = (left: readonly string[], right: readonly string[]) =>
        left.length === right.length &&
        left.every((id, index) => id === right[index])
      if (
        nextRoom.id === room.id &&
        nextRoom.completed === room.completed &&
        sameIds(nextRoom.vesselIds, room.vesselIds) &&
        sameIds(nextRoom.curtainVesselIds, room.curtainVesselIds)
      )
        return
      // Invalid descriptors leave the current room/capture untouched.
      const nextModel = makeModel(nextRoom)
      const token = closeCapture()
      if (disposed || token !== generation) return
      room = nextRoom
      model = nextModel
      target ??= comfortableTarget
      coverSettledAt = -Infinity
      if (room.completed) completedRooms.add(room.id)
      mode = room.completed ? 'complete' : 'off'
      message = room.completed
        ? COMPLETE_COPY
        : preparingCopy(room.curtainVesselIds.length)
      emit()
    },
    start,
    tick,
    pause,
    aim(id: string): void {
      if (
        disposed ||
        room.completed ||
        !options.canPlay() ||
        !options.canReach(id) ||
        model.snapshot().phase !== 'preparing'
      )
        return
      model.aim(id)
      emit()
    },
    moveCover(id: string): void {
      if (
        disposed ||
        room.completed ||
        !options.canPlay() ||
        model.snapshot().phase !== 'preparing'
      )
        return
      const previous = model.snapshot().coveredId
      model.moveCover(id)
      if (model.snapshot().coveredId !== previous) coverSettledAt = now() + 500
      emit()
    },
    setCurtainClosed(closed: boolean): void {
      if (disposed || room.completed || !options.canPlay()) return
      model.setCurtainClosed(closed)
      emit()
    },
    ring(): void {
      const at = now()
      if (
        disposed ||
        mode !== 'listening' ||
        !options.canPlay() ||
        at < coverSettledAt ||
        !freshCapture(at)
      )
        return
      if (model.ring(at)) {
        message = 'The chime is coming. Watch your displays.'
        emit()
      }
    },
    async hear(): Promise<void> {
      if (
        disposed ||
        !options.canPlay() ||
        mode !== 'listening' ||
        target === null ||
        model.snapshot().phase !== 'preparing'
      )
        return
      const token = generation
      mode = 'reference'
      pitch = null
      model.pause()
      model.fenceAudio(now())
      emit()
      if (disposed || token !== generation) return
      try {
        retireSound()
        sound = options.host.createSound()
        // GlassSound.reference resolves only after its audio-clock quiet tail.
        await sound.reference(target)
        if (token !== generation || disposed) return
        if (!options.canPlay()) {
          pause()
          return
        }
        const afterTail = now()
        model.fenceAudio(afterTail)
        model.resume(afterTail)
        resetCaptureEvidence(afterTail)
        mode = 'listening'
        message = LISTENING_COPY
        emit()
      } catch {
        if (token === generation && !disposed)
          pause('The note could not play. Tap Resume listening to continue.')
      }
    },
    changeNote(): void {
      if (
        disposed ||
        !options.canPlay() ||
        mode !== 'listening' ||
        model.snapshot().phase !== 'preparing'
      )
        return
      resetCaptureEvidence(now())
      target = null
      mode = 'finding'
      model.fenceAudio(now())
      message =
        'Hum another comfortable note. Your earned shields stay in place.'
      emit()
    },
    reset(): void {
      if (disposed || room.completed) return
      const token = closeCapture()
      if (disposed || token !== generation) return
      model.reset(now())
      mode = 'off'
      coverSettledAt = -Infinity
      message = preparingCopy(room.curtainVesselIds.length)
      emit()
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      closeCapture()
    },
  }
}
