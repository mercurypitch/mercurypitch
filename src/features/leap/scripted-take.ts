// ============================================================
// Scripted takes: how the demo sings through the Leap room
// ============================================================
//
// The "how it works" demo (demo/useLeapDemo.ts) plays Merc's two takes
// through useLeapController instead of beside it: scripted frames take the
// microphone's place, and the same engine, cliffs, trail, lantern, lamp and
// Merc answer them, so the demo can only show what the room really does. A
// scripted take never opens the mic, fires a haptic, says a line or keeps
// a result.
//
// The room reports each moment a tooltip may wait for, as it happens: the
// sequence engine's own events (`land:<i>`, `miss:<i>`, `phraseEnd`), and
// two of its own around them: Merc's call starting (`call`) and the leap's
// outcome showing (`outcome`), the lantern lit or Merc singing both notes.
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
import type { LeapPhase } from './leap-machine'
import type { LeapRound } from './leap-round'
import type { LeapLevel } from './leap-rules'

/** A moment of a take the demo's tooltips can wait for. */
export type LeapDemoMark =
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
export interface ScriptedLeapTake extends TakeClock<LeapDemoMark> {
  /** The demo's one leap. */
  readonly round: LeapRound
  /** Merc's call, his notes timed on the take's clock (`at`, s). */
  readonly call: readonly PhraseNote[]
  /**
   * When the engine starts listening, take clock: the end of his call,
   * its tail through the speaker and the gate after it, as a run's.
   */
  readonly responseStart: number
  /** After a miss, Merc's both notes on the take's clock; none for a landing. */
  readonly answer: readonly PhraseNote[]
  /** The rules it is sung under: the demo's level, not the singer's. */
  readonly rules: LeapLevel
}

/** The demo's way into the room (the demo kit's DemoScript). */
export interface LeapScript extends DemoScript<ScriptedLeapTake> {
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
  phase: () => LeapPhase
  audio: () => Promise<AudioContext | null>
  /** Merc's sampled voice loaded for the calls, where the screen says how. */
  ready?: () => Promise<unknown>
  note: () => number
  /** No take, no leap, no lamp, no trail: the room at rest, Merc where he is. */
  clear: () => void
  /** The take in place of the mic: its leap called, a fresh engine, its frames flowing. */
  load: (take: ScriptedLeapTake) => void
  /** The take on now, if any. */
  current: () => ScriptedLeapTake | null
  line: (text: string) => void
  /** His opening line in the bubble, unsaid: the demo has just said it all. */
  sayIntro: () => void
  merc: (state: MercState) => void
  later: (ms: number, fn: () => void) => void
  mark: (moment: LeapDemoMark) => void
}

/** The demo's way in, on the room's own steps. */
export function createScriptedRoom(host: ScriptHost): LeapScript {
  /** Bumped by every move the demo makes: older timers fall silent. */
  let turn = 0
  const clear = (): void => {
    turn += 1
    host.clear()
  }

  const script = createRoomScript<ScriptedLeapTake>({
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
