// ============================================================
// guitar-chords — strums on the audio clock, for Cadence and
// Bassline.
//
// The guitar room's Karplus-Strong voices, struck at scheduled
// times: a chord is its notes a few milliseconds apart, low string
// first, the bass note on the bass voice. Everything goes through
// one master gain at the stage's level so the room's volume applies
// and Stop can pull the whole strum down at once — a voice already
// handed to the audio clock cannot be unscheduled, only silenced.
// ============================================================

import type { GuitarVoice } from '@/lib/guitar/guitar-synth'
import { createBassVoice, createGuitarVoice } from '@/lib/guitar/guitar-synth'
import { midiToFreq } from '@/lib/scale-data'

export interface Strummer {
  /** Strike a chord (or a single note) at `at`, sounding `lenS`; the
   *  lowest `bassNotes` of it (one unless told) go to the bass voice. */
  strum: (
    midis: readonly number[],
    at: number,
    lenS: number,
    bassNotes?: number,
  ) => void
  /** Silence everything on the clock and tear the graph down. */
  cancel: () => void
}

const STAGGER_S = 0.018
const RELEASE_S = 0.09

export function createStrummer(
  ctx: BaseAudioContext,
  gainLevel: number,
): Strummer {
  const master = ctx.createGain()
  master.gain.setValueAtTime(
    Math.max(0, Math.min(1, gainLevel)),
    ctx.currentTime,
  )
  master.connect(ctx.destination)
  let voices: GuitarVoice[] = []
  let timers: Array<ReturnType<typeof setTimeout>> = []
  let cancelled = false

  return {
    strum: (midis, at, lenS, bassNotes = 1) => {
      if (cancelled) return
      midis.forEach((midi, i) => {
        const strikeAt = at + i * STAGGER_S
        const freq = midiToFreq(midi)
        const voice =
          i < bassNotes
            ? createBassVoice(ctx, freq, lenS * 1000, strikeAt)
            : createGuitarVoice(ctx, freq, lenS * 1000, 'acoustic', strikeAt)
        const releaseAt = strikeAt + lenS
        voice.gain.gain.setValueAtTime(1, releaseAt)
        voice.gain.gain.linearRampToValueAtTime(0.0001, releaseAt + RELEASE_S)
        voice.gain.connect(master)
        voices.push(voice)
        timers.push(
          setTimeout(
            () => {
              voice.dispose()
              voices = voices.filter((v) => v !== voice)
            },
            Math.max(0, (releaseAt + RELEASE_S - ctx.currentTime) * 1000) + 60,
          ),
        )
      })
    },
    cancel: () => {
      if (cancelled) return
      cancelled = true
      for (const timer of timers) clearTimeout(timer)
      timers = []
      try {
        master.gain.cancelScheduledValues(ctx.currentTime)
        master.gain.setValueAtTime(0, ctx.currentTime)
      } catch {
        // A context already closed has nothing left to silence.
      }
      for (const voice of voices) voice.dispose()
      voices = []
      master.disconnect()
    },
  }
}
