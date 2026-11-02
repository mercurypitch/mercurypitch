// ============================================================
// A line heard again at the result: Merc's line and the harmony at once
// ============================================================
//
// Each of the result's rows plays its line in two voices from one start:
// Merc's line through his singer (his face following it) and the harmony
// through his voice beside it. One at a time: a new tap, a new run, the
// demo or leaving the room ends the one playing, and its moments fall
// silent with it.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { MercSinger } from '@/components/room-kit/merc-singer'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import { outputLatency } from '@/components/room-kit/round-voice'
import type { HarmonyLine } from './harmony-line'
import { harmonyLine, mercLine } from './harmony-phrase'
import type { HarmonyLevel } from './harmony-rules'
import { SOUND_LEAD_SECONDS } from './harmony-rules'

/** What a replay asks of the room. */
export interface ReplayHost {
  /** The audio clock, asked for inside the tap: iOS starts it only from a gesture. */
  readonly audio: () => Promise<AudioContext | null>
  readonly sing: MercSinger['sing']
  readonly voice: RoundVoice
  /** The rules the run was sung by: the line's pace. */
  readonly rules: () => HarmonyLevel
  /** The result shows: a line is heard again only there. */
  readonly atResult: () => boolean
  /** The line's own voices take over from Merc's words. */
  readonly hush: () => void
  /** The two voices now playing: the room stops them as it stops its own. */
  readonly play: (ctx: AudioContext, sound: { stop(): void }) => void
  readonly later: (ms: number, fn: () => void) => void
}

export interface LineReplay {
  /** The line heard again now, by its row; null for none. */
  readonly playing: Accessor<number | null>
  /** Row `index`'s line, in two voices. */
  readonly play: (index: number, line: HarmonyLine) => void
  /** The line playing goes quiet, its moments with it. */
  readonly end: () => void
}

export function createLineReplay(host: ReplayHost): LineReplay {
  const [playing, setPlaying] = createSignal<number | null>(null)
  /** Counts replays, so an old one's moments never fire. */
  let count = 0
  const end = (): void => {
    count += 1
    setPlaying(null)
  }
  const play = (index: number, line: HarmonyLine): void => {
    if (!host.atResult()) return
    end()
    host.hush()
    const mine = count
    const current = (): boolean => mine === count && host.atResult()
    void host.audio().then((ctx) => {
      if (ctx === null || !current()) return
      const rules = host.rules()
      const his = host.sing(ctx, mercLine(line, rules), current)
      const theirs = host.voice.sing(
        ctx,
        harmonyLine(line, rules),
        ctx.currentTime + SOUND_LEAD_SECONDS,
      )
      host.play(ctx, {
        stop: () => {
          his.stop()
          theirs.stop()
        },
      })
      setPlaying(index)
      const ms = (his.endAt - ctx.currentTime + outputLatency(ctx)) * 1000
      host.later(Math.max(0, ms), () => {
        if (current()) setPlaying(null)
      })
    })
  }
  return { playing, play, end }
}
