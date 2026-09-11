// ============================================================
// Live input history — bounded display notes on the existing raw route clock.
// ============================================================
// This is presentation, never recording or scoring evidence. Audio ends are
// inferred from detector silence; only MIDI supplies measured voice releases.

import type { GuitarInputCapture, GuitarInputPitch, } from '@/lib/guitar/input-events'
import { PITCH_ATTACH_WINDOW_MS } from '@/lib/guitar/input-events'
import type { GuitarLiveInputObservation, GuitarLiveInputRoute, } from './guitar-live-input-observations'

export interface GuitarLiveHistoryNote {
  id: string
  midi: number
  startSeconds: number
  endSeconds: number
  clarity: number
  source: 'audio' | 'midi'
}

interface PendingNote extends Omit<GuitarLiveHistoryNote, 'midi'> {
  midi: number | null
  voiceId: string | null
  held: boolean
  attack: boolean
}

export interface GuitarLiveHistorySnapshot {
  generation: number | null
  active: boolean
  nowSeconds: number
  notes: readonly GuitarLiveHistoryNote[]
}

export interface GuitarLiveHistoryOptions {
  historySeconds?: number
  maxNotes?: number
  maxVoices?: number
}

function captureSeconds(capture: GuitarInputCapture): number {
  switch (capture.clock.kind) {
    case 'audio-worklet':
      return capture.clock.atFrame / capture.clock.sampleRate
    case 'web-midi':
      return capture.clock.mappedAudioTime
    case 'frame-loop':
      return capture.clock.windowStartAt
  }
}

function validPitch(pitch: GuitarInputPitch | null): pitch is GuitarInputPitch {
  return (
    pitch !== null &&
    Number.isInteger(pitch.midi) &&
    pitch.midi >= 0 &&
    pitch.midi <= 127 &&
    Number.isFinite(pitch.clarity)
  )
}

export function createGuitarLiveHistory(
  options: GuitarLiveHistoryOptions = {},
) {
  const historySeconds = Number.isFinite(options.historySeconds)
    ? Math.max(0.1, Math.min(6, options.historySeconds!))
    : 6
  const maxNotes = Math.max(
    1,
    Math.min(
      256,
      Math.floor(Number.isFinite(options.maxNotes) ? options.maxNotes! : 256),
    ),
  )
  const maxVoices = Math.max(
    1,
    Math.min(
      32,
      Math.floor(Number.isFinite(options.maxVoices) ? options.maxVoices! : 32),
    ),
  )
  let route: GuitarLiveInputRoute | null = null
  let active = false
  let notes: PendingNote[] = []
  let nowSeconds = 0
  let floorSeconds = 0
  let sequence = 0
  let missingSince: number | null = null
  let lastPitchSeconds = -Infinity

  const close = (note: PendingNote, at: number) => {
    note.endSeconds = Math.max(
      note.startSeconds,
      note.source === 'midi' ? at : Math.min(note.endSeconds, at),
    )
    note.held = false
  }
  const relative = (at: number) =>
    Math.max(0, at - (route?.startedAtSeconds ?? 0))
  const audioNote = () =>
    notes.findLast((note) => note.source === 'audio' && note.held)
  const prune = () => {
    const from = nowSeconds - historySeconds
    notes = notes.filter(
      (note) =>
        (note.source === 'midi' && note.held) || note.endSeconds >= from,
    )
    if (notes.length > maxNotes) notes.splice(0, notes.length - maxNotes)
    const held = notes.filter((note) => note.held)
    for (const note of held.slice(0, Math.max(0, held.length - maxVoices)))
      close(note, nowSeconds)
  }
  const advance = (at: number) => {
    if (Number.isFinite(at)) nowSeconds = Math.max(nowSeconds, relative(at))
    prune()
  }
  const append = (
    id: string,
    at: number,
    pitch: GuitarInputPitch | null,
    source: 'audio' | 'midi',
    voiceId: string | null,
    attack: boolean,
  ) => {
    const note: PendingNote = {
      id,
      startSeconds: at,
      endSeconds: at,
      midi: validPitch(pitch) ? pitch.midi : null,
      clarity: validPitch(pitch) ? pitch.clarity : 0,
      source,
      voiceId,
      held: true,
      attack,
    }
    notes.push(note)
    prune()
    return note
  }

  const observeCapture = (
    observation: Extract<GuitarLiveInputObservation, { type: 'capture' }>,
  ) => {
    const capture = observation.capture
    const absolute = captureSeconds(capture)
    if (!Number.isFinite(absolute) || absolute < floorSeconds) return
    advance(absolute)
    const at = relative(absolute)
    const source = capture.source === 'midi' ? 'midi' : 'audio'
    const previous =
      source === 'midi'
        ? notes.findLast(
            (note) =>
              note.source === 'midi' &&
              note.held &&
              note.voiceId === capture.voiceId,
          )
        : audioNote()
    if (capture.kind === 'release') {
      if (previous !== undefined) {
        previous.endSeconds = Math.max(previous.startSeconds, at)
        previous.held = false
      }
      return
    }
    const existing = notes.find((note) => note.id === observation.id)
    if (existing !== undefined) {
      if (validPitch(capture.pitch)) {
        existing.midi = capture.pitch.midi
        existing.clarity = capture.pitch.clarity
      }
      return
    }
    // A score take may currently exclude the attack while the route display
    // has seen it. Its following pitch-change still names that pending strike.
    if (
      source === 'audio' &&
      capture.kind === 'pitch-change' &&
      previous?.attack === true &&
      previous.midi === null &&
      validPitch(capture.pitch) &&
      Math.abs(previous.startSeconds - at) <= PITCH_ATTACH_WINDOW_MS / 1000
    ) {
      previous.midi = capture.pitch.midi
      previous.clarity = capture.pitch.clarity
      previous.endSeconds = Math.max(previous.startSeconds, at)
      return
    }
    // A render-thread attack message can reach the observer after the main
    // thread has already named that same note. Adopt its exact start and ID.
    if (
      source === 'audio' &&
      capture.kind === 'attack' &&
      previous !== undefined &&
      !previous.attack &&
      previous.startSeconds >= at &&
      previous.startSeconds - at <= PITCH_ATTACH_WINDOW_MS / 1000
    ) {
      previous.id = observation.id
      previous.startSeconds = at
      previous.attack = true
      if (validPitch(capture.pitch)) {
        previous.midi = capture.pitch.midi
        previous.clarity = capture.pitch.clarity
      }
      return
    }
    // The same detector tick may publish its pitch before its legato capture.
    // Preserve one visual note rather than a zero-length duplicate.
    if (
      source === 'audio' &&
      capture.kind === 'pitch-change' &&
      previous !== undefined &&
      validPitch(capture.pitch) &&
      previous.midi === capture.pitch.midi &&
      Math.abs(previous.startSeconds - at) < 0.001
    ) {
      previous.id = observation.id
      return
    }
    if (previous !== undefined) {
      previous.endSeconds = Math.max(previous.startSeconds, at)
      previous.held = false
    }
    append(
      observation.id,
      at,
      capture.pitch,
      source,
      capture.voiceId,
      capture.kind === 'attack',
    )
    missingSince = null
  }

  const observePitch = (
    observation: Extract<GuitarLiveInputObservation, { type: 'pitch' }>,
  ) => {
    const absolute = observation.windowStartAtSeconds
    if (
      !Number.isFinite(absolute) ||
      absolute < floorSeconds ||
      !Number.isFinite(observation.observedAtSeconds) ||
      observation.observedAtSeconds < absolute ||
      observation.observedAtSeconds < lastPitchSeconds
    )
      return
    lastPitchSeconds = observation.observedAtSeconds
    advance(observation.observedAtSeconds)
    const at = relative(absolute)
    let current = audioNote()
    if (!validPitch(observation.pitch)) {
      missingSince ??= observation.observedAtSeconds
      // Bridge tiny detector dropouts without delaying the first recognized
      // note. The end remains the last positive evidence, not this timeout.
      if (
        current !== undefined &&
        observation.observedAtSeconds - missingSince >= 0.06
      ) {
        close(current, at)
      }
      return
    }
    const pitch = observation.pitch
    missingSince = null
    const recentAttack =
      current?.attack === true &&
      Math.abs(current.startSeconds - at) <= PITCH_ATTACH_WINDOW_MS / 1000
    if (
      current === undefined ||
      (!recentAttack && current.midi !== pitch.midi)
    ) {
      if (current !== undefined) close(current, at)
      current = append(
        `live-history-${route?.generation}-${++sequence}`,
        at,
        pitch,
        'audio',
        null,
        false,
      )
    }
    current.midi = pitch.midi
    current.clarity = pitch.clarity
    current.endSeconds = Math.max(
      current.startSeconds,
      current.endSeconds,
      relative(observation.observedAtSeconds),
    )
  }

  const observe = (observation: GuitarLiveInputObservation): void => {
    if (observation.type === 'route-start') {
      if (route !== null && observation.route.generation <= route.generation)
        return
      route = observation.route
      active = true
      notes = []
      sequence = 0
      nowSeconds = 0
      floorSeconds = route.startedAtSeconds
      missingSince = null
      lastPitchSeconds = -Infinity
      return
    }
    if (
      !active ||
      route === null ||
      observation.generation !== route.generation
    )
      return
    if (observation.type === 'route-end' || observation.type === 'reset') {
      advance(observation.atSeconds)
      if (observation.type === 'reset') {
        notes = []
        floorSeconds = Math.max(floorSeconds, observation.atSeconds)
        lastPitchSeconds = observation.atSeconds
      } else {
        for (const note of notes) {
          if (note.source === 'midi' && note.held) note.endSeconds = nowSeconds
          note.held = false
        }
        active = false
      }
      missingSince = null
    } else if (observation.type === 'capture') observeCapture(observation)
    else if (observation.type === 'pitch' && route.source !== 'midi')
      observePitch(observation)
    prune()
  }

  return {
    observe,
    snapshot(atSeconds?: number): GuitarLiveHistorySnapshot {
      if (active && atSeconds !== undefined) advance(atSeconds)
      return {
        generation: route?.generation ?? null,
        active,
        nowSeconds,
        notes: notes.flatMap((note) =>
          note.midi === null
            ? []
            : [
                {
                  id: note.id,
                  midi: note.midi,
                  startSeconds: note.startSeconds,
                  endSeconds:
                    note.source === 'midi' && note.held
                      ? nowSeconds
                      : note.endSeconds,
                  clarity: note.clarity,
                  source: note.source,
                },
              ],
        ),
      }
    },
  }
}
