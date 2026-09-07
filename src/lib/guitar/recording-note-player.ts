// ============================================================
// Recording note player — bounded, exact-time melody audition
// ============================================================
// This is not a practice transport. It auditions measured notes, including
// pitches without a guitar fingering, without quantizing their timing. Every
// clean electric voice feeds one optional shared processor and a final envelope.

import type { PreviewPlayerProcessing } from '@/lib/preview-player'
import { closeEnvelope, ENVELOPE_DEFAULTS, openEnvelope, } from '@/lib/preview-player'
import type { GuitarVoice } from './guitar-synth'
import { createGuitarVoice } from './guitar-synth'

export interface RecordingPlaybackNote {
  midi: number
  startSeconds: number
  endSeconds: number
}

export interface RecordingNotePlayerOptions {
  audioGraph: { context: AudioContext; destination: AudioNode }
  notes: readonly RecordingPlaybackNote[]
  durationSeconds: number
  createProcessing?: (context: AudioContext) => PreviewPlayerProcessing
  onEnded?: () => void
  onError?: (error: unknown) => void
}

export interface RecordingNotePlayer {
  play(): Promise<boolean>
  pause(): void
  stop(): void
  /** Absolute seconds; silent until Play, or resumes after a safe live seek. */
  seek(seconds: number): void
  dispose(): void
  readonly currentTime: number
  readonly duration: number
  readonly playing: boolean
}

const LOOKAHEAD_SECONDS = 0.12
const SCHEDULE_INTERVAL_MS = 24
const MAX_SCHEDULED_VOICES = 32
const VOICE_RELEASE_SECONDS = 0.06
const RELEASE_SLACK_MS = 60

interface ScheduledVoice {
  voice: GuitarVoice
  stopAt: number
}

interface PlaybackRun {
  origin: number
  nextNote: number
  output: GainNode
  input: AudioNode
  processing: PreviewPlayerProcessing | null
  voices: Set<ScheduledVoice>
  timer?: ReturnType<typeof setInterval>
}

/** Construction is inert; the context is borrowed and never closed. */
export function createRecordingNotePlayer(
  options: RecordingNotePlayerOptions,
): RecordingNotePlayer {
  const context = options.audioGraph.context
  const duration = Number.isFinite(options.durationSeconds)
    ? Math.max(0, options.durationSeconds)
    : 0
  const notes = options.notes
    .filter(
      (note) =>
        Number.isInteger(note.midi) &&
        note.midi >= 0 &&
        note.midi <= 127 &&
        Number.isFinite(note.startSeconds) &&
        Number.isFinite(note.endSeconds) &&
        note.startSeconds >= 0 &&
        note.startSeconds < duration &&
        note.endSeconds > note.startSeconds,
    )
    .map((note) => ({
      midi: note.midi,
      startSeconds: note.startSeconds,
      endSeconds: Math.min(duration, note.endSeconds),
    }))
    .sort((left, right) => left.startSeconds - right.startSeconds)

  let run: PlaybackRun | null = null
  let release: Promise<void> | null = null
  let offset = 0
  let generation = 0
  let disposed = false
  let wantPlaying = false

  const position = (): number =>
    run === null
      ? offset
      : Math.min(duration, Math.max(offset, context.currentTime - run.origin))

  const removeVoice = (owner: PlaybackRun, scheduled: ScheduledVoice): void => {
    if (!owner.voices.delete(scheduled)) return
    for (const source of scheduled.voice.oscillators) source.onended = null
    scheduled.voice.dispose()
  }

  const disposeRun = (owner: PlaybackRun): void => {
    for (const scheduled of owner.voices) removeVoice(owner, scheduled)
    owner.processing?.dispose()
    owner.output.disconnect()
  }

  const retireRun = (): void => {
    const owner = run
    if (owner === null) return
    run = null
    clearInterval(owner.timer)
    if (context.state !== 'running') {
      disposeRun(owner)
      return
    }
    // Envelope comes AFTER delay/reverb/cab, so its tail cannot bypass Stop.
    closeEnvelope(owner.output, context, ENVELOPE_DEFAULTS.releaseMs / 1000)
    const pending = new Promise<void>((resolve) => {
      setTimeout(() => {
        disposeRun(owner)
        if (release === pending) release = null
        resolve()
      }, ENVELOPE_DEFAULTS.releaseMs + RELEASE_SLACK_MS)
    })
    release = pending
  }

  const fail = (error: unknown): void => {
    offset = position()
    wantPlaying = false
    generation += 1
    retireRun()
    options.onError?.(error)
  }

  const scheduleNote = (
    owner: PlaybackRun,
    note: RecordingPlaybackNote,
    nowPosition: number,
  ): void => {
    if (owner.voices.size >= MAX_SCHEDULED_VOICES) {
      throw new Error('Too many simultaneous notes to preview safely.')
    }
    const startAt = owner.origin + Math.max(nowPosition, note.startSeconds)
    const endAt = owner.origin + note.endSeconds
    const voice = createGuitarVoice(
      context,
      440 * 2 ** ((note.midi - 69) / 12),
      (endAt - startAt) * 1000,
      'electric',
      startAt,
      'shared',
    )
    // Uncached pluck synthesis is synchronous, but the render clock advances
    // independently. Start this envelope from the post-construction clock;
    // a later floor must never override an attack scheduled in the past.
    const envelopeNow = context.currentTime
    const attackAt = Math.max(startAt, envelopeNow)
    if (attackAt >= endAt) {
      voice.dispose()
      return
    }
    const stopAt = endAt + VOICE_RELEASE_SECONDS + RELEASE_SLACK_MS / 1000
    const scheduled = { voice, stopAt }
    owner.voices.add(scheduled)
    voice.gain.gain.cancelScheduledValues(envelopeNow)
    voice.gain.gain.setValueAtTime(0.0001, envelopeNow)
    voice.gain.gain.setValueAtTime(0.0001, attackAt)
    voice.gain.gain.exponentialRampToValueAtTime(
      1,
      attackAt + Math.min(0.005, (endAt - attackAt) / 2),
    )
    voice.gain.gain.setTargetAtTime(0, endAt, VOICE_RELEASE_SECONDS / 5)
    voice.gain.connect(owner.input)
    let remainingSources = voice.oscillators.length
    for (const source of voice.oscillators) {
      source.onended = () => {
        remainingSources -= 1
        if (remainingSources === 0) removeVoice(owner, scheduled)
      }
      source.stop(stopAt)
    }
  }

  const schedule = (owner: PlaybackRun): void => {
    if (run !== owner) return
    try {
      if (context.state === 'closed') throw new Error('Audio playback closed.')
      const nowPosition = position()
      if (nowPosition >= duration) {
        offset = duration
        wantPlaying = false
        retireRun()
        options.onEnded?.()
        return
      }
      for (const voice of owner.voices) {
        if (voice.stopAt <= context.currentTime) removeVoice(owner, voice)
      }
      const horizon = Math.min(duration, nowPosition + LOOKAHEAD_SECONDS)
      while (owner.nextNote < notes.length) {
        const note = notes[owner.nextNote]
        if (note.startSeconds > horizon) break
        owner.nextNote += 1
        // Resume held notes, but never replay attacks that ended during a
        // delayed scheduler tick or before the paused position.
        if (note.endSeconds > nowPosition) {
          scheduleNote(owner, note, nowPosition)
        }
      }
    } catch (error) {
      fail(error)
    }
  }

  const createRun = (): PlaybackRun => {
    const output = context.createGain()
    output.gain.value = 0
    let processing: PreviewPlayerProcessing | null = null
    try {
      processing = options.createProcessing?.(context) ?? null
      processing?.output.connect(output)
      output.connect(options.audioGraph.destination)
      return {
        origin: context.currentTime - offset,
        nextNote: 0,
        output,
        input: processing?.input ?? output,
        processing,
        voices: new Set(),
      }
    } catch (error) {
      processing?.dispose()
      output.disconnect()
      throw error
    }
  }

  const play = async (): Promise<boolean> => {
    if (disposed || notes.length === 0 || duration <= 0) return false
    if (run !== null) return true
    wantPlaying = true
    const attempt = ++generation
    try {
      // A rapid restart cannot stack still-audible effects/voices. The old
      // graph finishes its bounded release before the next graph is allocated.
      if (release !== null) await release
      if (disposed || attempt !== generation) return false
      if (context.state === 'closed') throw new Error('Audio playback closed.')
      if (context.state === 'suspended') await context.resume()
      if (disposed || attempt !== generation) return false
      if (offset >= duration) offset = 0
      const owner = createRun()
      run = owner
      schedule(owner)
      if (run !== owner) return false
      openEnvelope(owner.output, context, ENVELOPE_DEFAULTS.attackMs / 1000)
      owner.timer = setInterval(() => schedule(owner), SCHEDULE_INTERVAL_MS)
      return true
    } catch (error) {
      if (!disposed && attempt === generation) fail(error)
      return false
    }
  }

  return {
    play,
    pause() {
      generation += 1
      wantPlaying = false
      offset = position()
      retireRun()
    },
    stop() {
      generation += 1
      wantPlaying = false
      offset = 0
      retireRun()
    },
    seek(seconds) {
      if (disposed || !Number.isFinite(seconds)) return
      const resume = wantPlaying
      generation += 1
      offset = Math.min(duration, Math.max(0, seconds))
      retireRun()
      if (offset >= duration) {
        wantPlaying = false
        if (resume) options.onEnded?.()
      } else if (resume) {
        // The existing retirement promise coalesces rapid scrubs: only the
        // last intent can allocate a replacement voice/effect graph.
        void play()
      }
    },
    dispose() {
      disposed = true
      generation += 1
      wantPlaying = false
      offset = 0
      retireRun()
    },
    get currentTime() {
      return position()
    },
    get duration() {
      return duration
    },
    get playing() {
      return wantPlaying
    },
  }
}
