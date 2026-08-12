// ============================================================
// Piano performance scheduler — bounded score notes on the transport audio clock
// ============================================================
//
// The interval only fills a short Web Audio lookahead. Beat position always
// comes from the injected transport, and every discontinuity clears the score
// voices before a new generation is allowed to schedule.

import type { Accessor } from 'solid-js'
import type { PianoInstrumentVoicePort } from '../instrument/piano-instrument-port'
import type { PianoAudioClockTransport } from './piano-audio-clock-transport'
import type { PianoProjectStageNote } from './piano-project-stage'

export interface PianoPerformanceScheduler {
  start(): boolean
  refresh(): boolean
  stop(): void
  dispose(): void
}

export interface PianoPerformanceSchedulerOptions {
  transport: PianoAudioClockTransport
  notes: Accessor<readonly PianoProjectStageNote[]>
  synth: PianoInstrumentVoicePort
  scheduleAheadSeconds?: number
  schedulerIntervalMs?: number
  setInterval?: (callback: () => void, delayMs: number) => number
  clearInterval?: (id: number) => void
}

const DEFAULT_LOOKAHEAD_SECONDS = 0.16
const DEFAULT_INTERVAL_MS = 25

interface ActiveNoteIndex {
  leafCount: number
  maxEndBeats: Float64Array
}

interface ScheduledRelease {
  id: string
  atContextTime: number
}

function endBeat(note: PianoProjectStageNote): number {
  return note.startBeat + note.duration
}

function compareNotes(
  left: PianoProjectStageNote,
  right: PianoProjectStageNote,
): number {
  return (
    left.startBeat - right.startBeat ||
    left.midi - right.midi ||
    String(left.id).localeCompare(String(right.id))
  )
}

function firstNoteAfter(startBeats: ArrayLike<number>, beat: number): number {
  let low = 0
  let high = startBeats.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (startBeats[middle] <= beat) low = middle + 1
    else high = middle
  }
  return low
}

function createActiveNoteIndex(
  notes: readonly PianoProjectStageNote[],
): ActiveNoteIndex {
  let leafCount = 1
  while (leafCount < notes.length) leafCount *= 2

  const maxEndBeats = new Float64Array(leafCount * 2)
  maxEndBeats.fill(Number.NEGATIVE_INFINITY)
  for (let index = 0; index < notes.length; index += 1) {
    maxEndBeats[leafCount + index] = endBeat(notes[index])
  }
  for (let index = leafCount - 1; index > 0; index -= 1) {
    maxEndBeats[index] = Math.max(
      maxEndBeats[index * 2],
      maxEndBeats[index * 2 + 1],
    )
  }
  return { leafCount, maxEndBeats }
}

function visitActiveNotes(
  activeNoteIndex: ActiveNoteIndex,
  beforeIndex: number,
  beat: number,
  visit: (noteIndex: number) => void,
): void {
  const visitNode = (node: number, firstIndex: number, lastIndex: number) => {
    if (
      firstIndex >= beforeIndex ||
      activeNoteIndex.maxEndBeats[node] <= beat
    ) {
      return
    }
    if (lastIndex - firstIndex === 1) {
      visit(firstIndex)
      return
    }
    const middleIndex = firstIndex + Math.floor((lastIndex - firstIndex) / 2)
    visitNode(node * 2, firstIndex, middleIndex)
    visitNode(node * 2 + 1, middleIndex, lastIndex)
  }

  visitNode(1, 0, activeNoteIndex.leafCount)
}

function enqueueRelease(
  queue: ScheduledRelease[],
  release: ScheduledRelease,
): void {
  queue.push(release)
  let child = queue.length - 1
  while (child > 0) {
    const parent = Math.floor((child - 1) / 2)
    if (queue[parent].atContextTime <= release.atContextTime) break
    queue[child] = queue[parent]
    child = parent
  }
  queue[child] = release
}

function dequeueRelease(
  queue: ScheduledRelease[],
): ScheduledRelease | undefined {
  const first = queue[0]
  const last = queue.pop()
  if (first === undefined || last === undefined || queue.length === 0) {
    return first
  }

  let parent = 0
  while (true) {
    const left = parent * 2 + 1
    if (left >= queue.length) break
    const right = left + 1
    const child =
      right < queue.length &&
      queue[right].atContextTime < queue[left].atContextTime
        ? right
        : left
    if (queue[child].atContextTime >= last.atContextTime) break
    queue[parent] = queue[child]
    parent = child
  }
  queue[parent] = last
  return first
}

export function createPianoPerformanceScheduler(
  options: PianoPerformanceSchedulerOptions,
): PianoPerformanceScheduler {
  const scheduleAheadSeconds = Math.max(
    0.04,
    options.scheduleAheadSeconds ?? DEFAULT_LOOKAHEAD_SECONDS,
  )
  const schedulerIntervalMs = Math.max(
    10,
    options.schedulerIntervalMs ?? DEFAULT_INTERVAL_MS,
  )
  const startInterval =
    options.setInterval ??
    ((callback, delayMs) => window.setInterval(callback, delayMs))
  const cancelInterval =
    options.clearInterval ?? ((id) => window.clearInterval(id))
  const scheduledReleases = new Map<string, number>()
  const releaseQueue: ScheduledRelease[] = []
  let indexedSource: readonly PianoProjectStageNote[] | null = null
  let orderedNotes: readonly PianoProjectStageNote[] = []
  let orderedStartBeats = new Float64Array()
  let activeNoteIndex = createActiveNoteIndex([])
  let noteCursor = 0
  let cursorNeedsReset = true
  let interval: number | null = null
  let generation = 0
  let generationHasScheduledNotes = false
  let disposed = false

  const voiceId = (note: PianoProjectStageNote): string =>
    `score:${generation}:${String(note.id)}`

  const pruneReleased = (contextTime: number): void => {
    while (releaseQueue[0]?.atContextTime <= contextTime) {
      const release = dequeueRelease(releaseQueue)
      if (
        release !== undefined &&
        scheduledReleases.get(release.id) === release.atContextTime
      ) {
        scheduledReleases.delete(release.id)
      }
    }
  }

  const clearScheduled = (): void => {
    const context = options.transport.getAudioContext()
    const at = context?.currentTime
    if (at !== undefined) pruneReleased(at)
    for (const id of scheduledReleases.keys()) {
      options.synth.noteOff({ id, atContextTime: at })
    }
    scheduledReleases.clear()
    releaseQueue.length = 0
    generationHasScheduledNotes = false
  }

  const cancelClock = (): void => {
    if (interval === null) return
    cancelInterval(interval)
    interval = null
  }

  const ensureNoteIndex = (): void => {
    const source = options.notes()
    if (indexedSource === source) return
    if (indexedSource !== null && generationHasScheduledNotes) {
      generation += 1
      clearScheduled()
    }
    indexedSource = source
    orderedNotes = [...source].sort(compareNotes)
    orderedStartBeats = Float64Array.from(
      orderedNotes,
      (note) => note.startBeat,
    )
    activeNoteIndex = createActiveNoteIndex(orderedNotes)
    cursorNeedsReset = true
  }

  const scheduleNote = (
    noteIndex: number,
    beat: number,
    context: AudioContext,
  ): void => {
    const note = orderedNotes[noteIndex]
    const id = voiceId(note)
    if (scheduledReleases.has(id)) return
    const noteEndBeat =
      activeNoteIndex.maxEndBeats[activeNoteIndex.leafCount + noteIndex]
    if (noteEndBeat <= beat) return

    const startBeat = Math.max(beat, orderedStartBeats[noteIndex])
    const mappedStart = options.transport.contextTimeAtBeat(startBeat)
    const mappedEnd = options.transport.contextTimeAtBeat(noteEndBeat)
    if (mappedStart === null || mappedEnd === null) return
    const startsAt = Math.max(context.currentTime, mappedStart)
    const endsAt = Math.max(startsAt + 0.02, mappedEnd)
    const started = options.synth.noteOn({
      id,
      midi: note.midi,
      velocity: note.velocity,
      atContextTime: startsAt,
    })
    if (!started) return
    options.synth.noteOff({
      id,
      releaseVelocity: note.releaseVelocity,
      atContextTime: endsAt,
    })
    scheduledReleases.set(id, endsAt)
    enqueueRelease(releaseQueue, { id, atContextTime: endsAt })
    generationHasScheduledNotes = true
  }

  const resetCursor = (beat: number, context: AudioContext): void => {
    const firstFutureNote = firstNoteAfter(orderedStartBeats, beat)
    visitActiveNotes(activeNoteIndex, firstFutureNote, beat, (noteIndex) => {
      scheduleNote(noteIndex, beat, context)
    })
    noteCursor = firstFutureNote
    cursorNeedsReset = false
  }

  const schedule = (): void => {
    if (disposed || options.transport.phase() !== 'playing') {
      cancelClock()
      return
    }
    const context = options.transport.getAudioContext()
    if (context === null || context.state === 'closed') {
      cancelClock()
      return
    }

    const beat = options.transport.timeline.playheadBeat()
    pruneReleased(context.currentTime)
    ensureNoteIndex()
    if (cursorNeedsReset) resetCursor(beat, context)

    const horizonBeat = options.transport.beatAtContextTime(
      context.currentTime + scheduleAheadSeconds,
    )
    while (noteCursor < orderedNotes.length) {
      if (orderedStartBeats[noteCursor] > horizonBeat) break
      const noteIndex = noteCursor
      noteCursor += 1
      scheduleNote(noteIndex, beat, context)
    }
  }

  const start = (): boolean => {
    if (disposed || options.transport.phase() !== 'playing') return false
    cancelClock()
    cursorNeedsReset = true
    schedule()
    interval = startInterval(schedule, schedulerIntervalMs)
    return true
  }

  const stop = (): void => {
    generation += 1
    cancelClock()
    clearScheduled()
    cursorNeedsReset = true
  }

  return {
    start,
    refresh() {
      stop()
      return start()
    },
    stop,
    dispose() {
      if (disposed) return
      stop()
      disposed = true
    },
  }
}
