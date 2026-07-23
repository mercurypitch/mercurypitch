// ============================================================
// useSingingBacking — karaoke-style backing playback for the Singing
// page. The playback runtime plays only the scored melody (reference
// tone); this schedules the song's OTHER (heard) tracks as audio so the
// singer can practise over the band while still being scored on the
// vocal line — matching the Piano/Guitar play-along experience.
//
// It rides the runtime's per-frame `beat` event: as the playhead crosses
// each backing note it fires audioEngine.playNote (polyphonic, 24-voice
// capped). Seeks are detected as beat jumps (backward, or a big forward
// hop) — the runtime already flushes audio on a playing-seek, so we just
// re-mark which notes are "already past". Backing voices are tracked
// separately and cut on pause/stop/seek, leaving the reference tone alone.
// ============================================================

import { createEffect, createSignal, on, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'

export interface BackingNote {
  freq: number
  startBeat: number
  duration: number
}

interface Deps {
  playbackRuntime: PlaybackRuntime
  audioEngine: AudioEngine
  /** Live singing-playback signal (backing only fires while playing). */
  isPlaying: () => boolean
  bpm: () => number
}

export interface SingingBacking {
  /** Replace the backing set (empty for library melodies / no heard tracks). */
  setBacking: (notes: BackingNote[]) => void
}

// A beat delta beyond this (or any backward step) is treated as a seek, not
// normal playback advance.
const SEEK_JUMP_BEATS = 1.5
// Only voice a note that JUST crossed the playhead — notes marked "past"
// during a seek are consumed silently rather than fired in a burst.
const FRESH_WINDOW_BEATS = 1
// Per-voice gain for backing notes. The band regularly stacks 10+ voices
// (every heard track), so full-level voices both drown the scored reference
// tone and pile amplitude into the note-bus limiter; softer per-voice level
// keeps the backing behind the melody and the sum inside headroom.
const BACKING_VOICE_GAIN = 0.55

export function useSingingBacking(deps: Deps): SingingBacking {
  const [backing, setBacking] = createSignal<BackingNote[]>([])
  let played = new Set<number>()
  let lastBeat = Number.NEGATIVE_INFINITY
  // playNote ids for backing voices only, so pause/stop/seek can silence the
  // band without cutting the reference tone (which the runtime owns).
  const voiceIds = new Set<number>()
  // Invalidates playNote promises that have not resolved when playback is
  // paused, stopped, seeked, or replaced with a different backing set.
  let voiceGeneration = 0

  const stopVoices = (): void => {
    voiceGeneration += 1
    for (const id of voiceIds) deps.audioEngine.stopNote(id)
    voiceIds.clear()
  }

  const markPast = (beat: number): void => {
    const notes = backing()
    played = new Set()
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].startBeat < beat) played.add(i)
    }
  }

  const onBeat = (e: { beat: number }): void => {
    const beat = e.beat ?? 0
    const notes = backing()
    if (notes.length === 0) {
      lastBeat = beat
      return
    }

    // First beat after load/reset (lastBeat === -inf) is the baseline, NOT a
    // seek — otherwise markPast would silently eat a downbeat note at beat 0.
    // The FRESH_WINDOW guard below already stops a post-seek start (playhead
    // lands deep in the song) from bursting every earlier note.
    const fresh = lastBeat === Number.NEGATIVE_INFINITY
    const jumped =
      !fresh && (beat < lastBeat - 0.01 || beat - lastBeat > SEEK_JUMP_BEATS)
    if (jumped) {
      // Mid-play seek: drop sounding backing and re-arm/skip notes relative to
      // the new position (backward seek re-arms future notes; forward skips).
      stopVoices()
      markPast(beat)
    } else if (deps.isPlaying()) {
      const bps = deps.bpm() / 60
      for (let i = 0; i < notes.length; i++) {
        if (played.has(i)) continue
        const n = notes[i]
        if (n.startBeat <= beat) {
          played.add(i)
          if (beat - n.startBeat < FRESH_WINDOW_BEATS && bps > 0) {
            const generation = voiceGeneration
            void deps.audioEngine
              .playNoteWithGain(
                n.freq,
                Math.max(50, (n.duration / bps) * 1000),
                BACKING_VOICE_GAIN,
              )
              .then((id) => {
                if (id === undefined) return
                if (generation !== voiceGeneration) {
                  deps.audioEngine.stopNote(id)
                  return
                }
                voiceIds.add(id)
              })
          }
        }
      }
    }
    lastBeat = beat
  }
  // onBeat is a runtime event callback, not a tracked scope: it reads live
  // signal values (isPlaying/bpm/backing) each time the beat fires, which is
  // exactly what we want. The lint rule can't see `.on(...)` as a handler
  // registration, so silence it here.
  // eslint-disable-next-line solid/reactivity
  deps.playbackRuntime.on('beat', onBeat)
  onCleanup(() => {
    deps.playbackRuntime.off('beat', onBeat)
    stopVoices()
  })

  // Cut the band when playback leaves the playing state (pause OR stop).
  // We watch the controller's isPlaying signal rather than the runtime's
  // 'state' event: _emit passes the whole event object to handlers, so the
  // typed `(state) => …` overload would compare an object to a string. A
  // stop also rewinds the playhead to 0, which the 'beat'-jump branch above
  // catches to reset `played`/`lastBeat` — so this only needs to silence.
  createEffect(
    on(deps.isPlaying, (playing, prev) => {
      if (prev === true && !playing) stopVoices()
    }),
  )

  return {
    setBacking: (notes) => {
      stopVoices()
      played = new Set()
      lastBeat = Number.NEGATIVE_INFINITY
      setBacking(notes)
    },
  }
}
