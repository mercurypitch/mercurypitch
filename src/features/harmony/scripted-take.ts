// ============================================================
// Scripted takes: how the demo sings through the Harmony room
// ============================================================
//
// The "how it works" demo (demo/useHarmonyDemo.ts) plays its two takes
// through useHarmonyController instead of beside it: scripted frames take
// the microphone's place, and the same engine, lamps, trail and Merc answer
// them, so the demo can only show what the room really does. A scripted
// take never opens the mic, fires a haptic, says a line or keeps a result.
//
// The room reports each moment a tooltip may wait for, as it happens: the
// sequence engine's own events (`land:<i>`, `miss:<i>`, `phraseEnd`), and
// two of its own around them: Merc's call starting (`call`) and the line's
// outcome showing (`outcome`), its lamps lit or Merc singing the pair.
//
// `createScriptedRoom` is the demo's way in: the room lends it its steps,
// and it moves through them with the demo kit's script (enter, play, rest,
// leave), never opening the mic, on the room kit's terms for when each move
// may come (room-kit room-script.ts).

import type { Accessor } from 'solid-js'
import { batch } from 'solid-js'
import type { TakeClock } from '@/components/demo-kit/demo-plan'
import type { DemoScript } from '@/components/demo-kit/useExerciseDemo'
import { createRoomScript } from '@/components/room-kit/room-script'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { MercState } from '@/lib/merc/constants'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import type { HarmonyLine } from './harmony-line'
import type { HarmonyPhase } from './harmony-machine'
import type { HarmonyLevel } from './harmony-rules'

/** A moment of a take the demo's tooltips can wait for. */
export type HarmonyDemoMark =
  | 'call'
  | `land:${number}`
  | `miss:${number}`
  | 'phraseEnd'
  | 'outcome'

/**
 * One of the demo's takes, sung through the room instead of the mic: its
 * frames released on its own clock (the demo kit's TakeClock), and every
 * moment reported back as it happens.
 */
export interface ScriptedHarmonyTake extends TakeClock<HarmonyDemoMark> {
  /** The demo's one line. */
  readonly line: HarmonyLine
  /** Merc's call, his line timed on the take's clock (`at`, s). */
  readonly call: readonly PhraseNote[]
  /**
   * When the engine starts listening, take clock: the end of his call,
   * its tail through the speaker and the gate after it, as a run's.
   */
  readonly responseStart: number
  /**
   * After a miss, his note and the third from it on the take's clock; none
   * for a line sung in harmony.
   */
  readonly answer: readonly PhraseNote[]
  /** The rules it is sung under: the demo's level, not the singer's. */
  readonly rules: HarmonyLevel
}

/** The demo's way into the room (the demo kit's DemoScript). */
export interface HarmonyScript extends DemoScript<ScriptedHarmonyTake> {
  /** The voice that sings Merc in the room: the demo sings through it too. */
  readonly voice: RoundVoice
}

/**
 * What the room lends the demo's way in: its state, its Merc and its
 * timers, each a step a run takes too. The run's own internals (the engine,
 * the frame loop, the take on) stay the room's: `clear` and `load` reset
 * them.
 */
export interface ScriptHost {
  readonly voice: RoundVoice
  readonly active: Accessor<boolean>
  setActive: (on: boolean) => void
  setPlaying: (on: boolean) => void
  phase: () => HarmonyPhase
  audio: () => Promise<AudioContext | null>
  /** Merc's sampled voice loaded for the calls, where the screen says how. */
  ready?: () => Promise<unknown>
  note: () => number
  /** No take, no line, no lamp, no trail: the room at rest, Merc where he is. */
  clear: () => void
  /** The take in place of the mic: its line called, a fresh engine, its frames flowing. */
  load: (take: ScriptedHarmonyTake) => void
  /** The take on now, if any. */
  current: () => ScriptedHarmonyTake | null
  line: (text: string) => void
  /** His opening line in the bubble, unsaid: the demo has just said it all. */
  sayIntro: () => void
  merc: (state: MercState) => void
  later: (ms: number, fn: () => void) => void
  mark: (moment: HarmonyDemoMark) => void
}

/** The demo's way in, on the room's own steps. */
export function createScriptedRoom(host: ScriptHost): HarmonyScript {
  /** Bumped by every move the demo makes: older timers fall silent. */
  let turn = 0
  const clear = (): void => {
    turn += 1
    host.clear()
  }

  const script = createRoomScript<ScriptedHarmonyTake>({
    active: host.active,
    phase: host.phase,
    audio: host.audio,
    ready: host.ready,
    note: host.note,
    enter: (text) => {
      clear()
      batch(() => {
        host.setActive(true)
        host.line(text)
      })
      host.merc('idle')
    },
    play: (take) => {
      clear()
      host.line('')
      host.load(take)
      // The call's tooltip may show once its first note is heard.
      const mine = turn
      const first = take.startsAt + (take.call[0]?.at ?? 0) * 1000
      host.later(Math.max(0, first - performance.now()), () => {
        if (mine === turn && host.current() === take) host.mark('call')
      })
    },
    rest: () => {
      clear()
      host.merc('idle')
    },
    leave: () => {
      clear()
      batch(() => {
        host.setActive(false)
        host.setPlaying(false)
      })
      host.sayIntro()
      host.merc('idle')
    },
    playing: host.setPlaying,
  })
  return { ...script, voice: host.voice }
}
