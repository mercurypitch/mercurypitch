// ============================================================
// A key heard again at the result: its intro, then Merc singing home
// ============================================================
//
// Each of the result's key lamps plays its key again: the intro as the
// run played it, then Merc singing home over home's chord, his face with
// his note. One at a time: a new tap, a new run, the demo or leaving the
// room ends the one playing, and its moments fall silent with it.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import { outputLatency } from '@/components/room-kit/round-voice'
import type { BandSound } from './home-note-band'
import { playKeyAgain } from './home-note-band'
import type { HomeRound } from './home-note-round'
import type { HomeNoteLevel } from './home-note-rules'
import { MERC_HOME_SECONDS } from './home-note-rules'

/** What a replay asks of the room. */
export interface ReplayHost {
  /** The audio clock, asked for inside the tap: iOS starts it only from a gesture. */
  readonly audio: () => Promise<AudioContext | null>
  readonly voice: RoundVoice
  /** The rules the run was played by: the intro's chords. */
  readonly rules: () => HomeNoteLevel
  /** The result shows: a key is heard again only there. */
  readonly atResult: () => boolean
  /** The key's own sound takes over from Merc's words. */
  readonly hush: () => void
  /** The key's sound now playing: the room stops it as it stops its own. */
  readonly play: (ctx: AudioContext, sound: BandSound) => void
  /** Merc sings home now, his face on it; null when he stops. */
  readonly sings: (home: number | null) => void
  readonly later: (ms: number, fn: () => void) => void
}

export interface KeyReplay {
  /** The key heard again now, by its index; null for none. */
  readonly playing: Accessor<number | null>
  /** Key `index` again. */
  readonly play: (index: number, round: HomeRound) => void
  /** The key playing goes quiet, its moments with it. */
  readonly end: () => void
}

export function createKeyReplay(host: ReplayHost): KeyReplay {
  const [playing, setPlaying] = createSignal<number | null>(null)
  /** Counts replays, so an old one's moments never fire. */
  let count = 0
  const end = (): void => {
    count += 1
    setPlaying(null)
  }
  const play = (index: number, round: HomeRound): void => {
    if (!host.atResult()) return
    end()
    host.hush()
    const mine = count
    const current = (): boolean => mine === count && host.atResult()
    void host.audio().then((ctx) => {
      if (ctx === null || !current()) return
      const played = playKeyAgain(ctx, round, host.rules(), host.voice)
      host.play(ctx, played)
      setPlaying(index)
      const latency = outputLatency(ctx)
      const at = (t: number, then: () => void): void => {
        host.later(Math.max(0, (t - ctx.currentTime + latency) * 1000), () => {
          if (current()) then()
        })
      }
      at(played.mercAt, () => host.sings(round.home))
      at(played.mercAt + MERC_HOME_SECONDS + 0.15, () => host.sings(null))
      at(played.endAt, () => setPlaying(null))
    })
  }
  return { playing, play, end }
}
