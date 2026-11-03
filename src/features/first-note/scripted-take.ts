// ============================================================
// Scripted takes: how the demo sings through the First note room
// ============================================================
//
// The "how it works" demo (demo/useFirstNoteDemo.ts) plays Merc's two takes
// through useFirstNoteController instead of beside it: scripted frames take
// the microphone's place, and the same engine, entry, stage, countdown,
// line, trail and Merc answer them, so the demo can only show what the room
// really does. A scripted take never opens the mic, fires a haptic, says a
// line or keeps a result.
//
// The room reports each moment a tooltip may wait for, as it happens: the
// sequence engine's own events (`land:<i>`, `miss:<i>`, `phraseEnd`), and
// four of its own around them: the song's band starting (`band`), the
// singer's turn opening where the band stops (`turn`), the singer's entry
// heard (`entry`) and the round's outcome showing (`outcome`), the line
// landed or Merc singing the note.
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
import type { FirstNotePhase } from './first-note-machine'
import type { FirstNoteLevel } from './first-note-rules'
import type { FirstNoteRound } from './first-note-songs'

/** A moment of a take the demo's tooltips can wait for. */
export type FirstNoteDemoMark =
  | 'band'
  | 'turn'
  | 'entry'
  | `land:${number}`
  | `miss:${number}`
  | 'phraseEnd'
  | 'outcome'

/**
 * One of the demo's takes, sung through the room instead of the mic: its
 * frames released on its own clock (the demo kit's TakeClock), and every
 * moment reported back as it happens.
 */
export interface ScriptedFirstTake extends TakeClock<FirstNoteDemoMark> {
  /** The demo's one entry, in its song. */
  readonly round: FirstNoteRound
  /** The band's lead-in starts, on the take's clock, s. */
  readonly introAt: number
  /** The band stops where the singer comes in: their turn, take clock, s. */
  readonly turnAt: number
  /**
   * When the engine starts listening, take clock: the turn, and the gate
   * after it for the band's tail through the speaker, as a run's.
   */
  readonly responseStart: number
  /** After a miss, Merc singing the note on the take's clock; none for a landing. */
  readonly answer: readonly PhraseNote[]
  /** The rules it is sung under: the demo's level, not the singer's. */
  readonly rules: FirstNoteLevel
}

/** The demo's way into the room (the demo kit's DemoScript). */
export interface FirstNoteScript extends DemoScript<ScriptedFirstTake> {
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
  phase: () => FirstNotePhase
  audio: () => Promise<AudioContext | null>
  /** What the demo's sound needs loaded: the band's clip, and Merc's sampled voice where the screen says how. */
  ready?: () => Promise<unknown>
  note: () => number
  /** No take, no entry, no line, no trail: the room at rest, Merc where he is. */
  clear: () => void
  /** The take in place of the mic: its lead-in begun, a fresh engine, its frames flowing. */
  load: (take: ScriptedFirstTake) => void
  /** The take on now, if any. */
  current: () => ScriptedFirstTake | null
  line: (text: string) => void
  /** His opening line in the bubble, unsaid: the demo has just said it all. */
  sayIntro: () => void
  merc: (state: MercState) => void
  later: (ms: number, fn: () => void) => void
  mark: (moment: FirstNoteDemoMark) => void
}

/** The demo's way in, on the room's own steps. */
export function createScriptedRoom(host: ScriptHost): FirstNoteScript {
  /** Bumped by every move the demo makes: older timers fall silent. */
  let turn = 0
  const clear = (): void => {
    turn += 1
    host.clear()
  }

  const script = createRoomScript<ScriptedFirstTake>({
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
      // The band's tooltip may show once its lead-in is heard.
      const mine = turn
      const first = take.startsAt + take.introAt * 1000
      host.later(Math.max(0, first - performance.now()), () => {
        if (mine === turn && host.current() === take) host.mark('band')
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
