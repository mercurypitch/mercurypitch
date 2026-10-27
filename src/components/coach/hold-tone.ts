// ============================================================
// The hold tone: the note a step offers, and the signs that it plays
// ============================================================
//
// A "hold-tone" step (coach-types.ts) offers "Play the note", which plays A3
// on an audio context of its own, made on the singer's tap. A muted speaker
// says nothing, so the layer shows the note playing for as long as it lasts
// (CoachLayer.tsx): the button names it and looks lit, a mark runs across it,
// Merc sings, and a polite line says so; once it has played, a line stays
// that says how to hear it if nothing came out. A second tap plays it again
// from the start. Leaving the step, Skip and End tour stop it.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { DemoSound } from '@/lib/demo-audio'
import { playHoldTone } from '@/lib/demo-audio'

/** The note a "hold-tone" step plays: A3, in reach of most voices or an octave of them. */
export const HOLD_TONE_HZ = 220
/** Its name, as the button and the line say it. */
export const HOLD_TONE_NAME = 'A3'
/** How long it plays, in seconds. */
export const HOLD_TONE_SEC = 1.6

/** What the step's line says while the note plays. Drafts for the copy pass. */
export const TONE_PLAYING_LINE = `Playing ${HOLD_TONE_NAME} now.`
/** What it says once the note has played, for a singer who heard nothing. */
export const TONE_HEAR_LINE =
  "Heard nothing? Turn the volume up, and check your device isn't on mute."

export interface HoldTone {
  /** The play sounding now, a new number for each tap; null while silent. */
  playing: Accessor<number | null>
  /** The note has played on this step (or could not): say how to hear it. */
  played: Accessor<boolean>
  /** Plays the note, from the start if it is already playing. */
  play: () => void
  /** Stops it, and forgets it played: the step has gone. */
  reset: () => void
  /** Stops it and closes the context: the layer has gone. */
  close: () => void
}

/** The note's player and its state, for one coach layer. */
export function createHoldTone(): HoldTone {
  const [playing, setPlaying] = createSignal<number | null>(null)
  const [played, setPlayed] = createSignal(false)
  let audio: AudioContext | null = null
  let tone: DemoSound | null = null
  let ends: ReturnType<typeof setTimeout> | undefined
  let plays = 0

  const stop = (): void => {
    clearTimeout(ends)
    ends = undefined
    tone?.stop()
    tone = null
    setPlaying(null)
  }

  const play = (): void => {
    stop()
    try {
      audio ??= new AudioContext()
      void audio.resume().catch(() => undefined)
      tone = playHoldTone(audio, HOLD_TONE_HZ, HOLD_TONE_SEC)
    } catch {
      // No audio here: say how to hear it. The step still waits for the
      // singer, and Skip is there.
      setPlayed(true)
      return
    }
    plays += 1
    setPlaying(plays)
    ends = setTimeout(() => {
      ends = undefined
      tone = null
      setPlaying(null)
      setPlayed(true)
    }, HOLD_TONE_SEC * 1000)
  }

  return {
    playing,
    played,
    play,
    reset: () => {
      stop()
      setPlayed(false)
    },
    close: () => {
      stop()
      void audio?.close().catch(() => undefined)
      audio = null
    },
  }
}
