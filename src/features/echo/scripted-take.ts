// ============================================================
// Scripted takes: how the demo sings through the Echo room
// ============================================================
//
// The "how it works" demo (demo/useEchoDemo.ts) plays Merc's two takes
// through useEchoController instead of beside it: scripted frames take the
// microphone's place, and the same engine, sky, ribbon, Merc and result
// answer them, so the demo can only show what the room really does. A
// scripted take never opens the mic, fires a haptic, says a line or keeps
// a result.
//
// The room reports each moment a tooltip may wait for, as it happens:
// the sequence engine's own events (`land:<i>`, `miss:<i>`, `phraseEnd`),
// and three of its own around them: the call starting (`call`), the voice
// coming in over it (`early`, the room's own rule, early-singing.ts) and
// the result showing (`result`).
//
// `createScriptedRoom` is the demo's way in: the room (useEchoController)
// lends it its steps, and it moves through them with the demo kit's
// script (enter, play, rest, leave), never opening the mic, on the room
// kit's terms for when each move may come (room-kit room-script.ts).

import type { Accessor } from 'solid-js'
import { batch } from 'solid-js'
import type { TakeClock } from '@/components/demo-kit/demo-plan'
import type { DemoScript } from '@/components/demo-kit/useExerciseDemo'
import { createRoomScript } from '@/components/room-kit/room-script'
import type { MercState } from '@/lib/merc/constants'
import type { EchoPhrase } from '@/lib/sequence/phrase-bank'
import type { EchoLevelId } from '@/lib/sequence/sequence-engine'
import { ECHO_LEVELS } from '@/lib/sequence/sequence-engine'
import type { PhraseTake } from '@/lib/sequence/sequence-metrics'
import { sequenceMetrics } from '@/lib/sequence/sequence-metrics'
import type { CallNote } from './early-singing'
import type { EchoDemoPhase, EchoPhase, EchoState } from './echo-machine'
import type { EchoSummary } from './echo-run'
import { showResultOf } from './echo-run'
import type { CallSchedule, CallVoice } from './merc-call'
import type { SkyScene } from './sky-scene'

/** A moment of a take the demo's tooltips can wait for. */
export type EchoDemoMark =
  | 'call'
  | 'early'
  | `land:${number}`
  | `miss:${number}`
  | 'phraseEnd'
  | 'result'

/**
 * One of the demo's takes, sung through the room instead of the mic: its
 * frames released on its own clock (the demo kit's TakeClock), and every
 * moment reported back as it happens.
 */
export interface ScriptedEchoTake extends TakeClock<EchoDemoMark> {
  /** The phrase, its notes timed from the start of Merc's call. */
  readonly phrase: EchoPhrase
  /** Merc's notes on the take's clock. */
  readonly call: readonly CallNote[]
  /** The end of Merc's last note, take clock: the response opens after it. */
  readonly callEnd: number
  /** The level it is sung under: the demo's own, not the singer's. */
  readonly level: EchoLevelId
  /** Take 2 ends on the result; take 1 only shows the phrase ending. */
  readonly toResult: boolean
  /** Reduced motion: Merc moves without hopping. */
  readonly still: boolean
}

/** A call the demo's sound sings: the room has nothing of it to stop. */
export const SCRIPTED_CALL: CallSchedule = {
  onsets: [],
  endAt: 0,
  stop: () => undefined,
}

/** The demo's way into the room (the demo kit's DemoScript). */
export interface EchoScript extends DemoScript<ScriptedEchoTake> {
  /** The voice that sings the room's calls: the demo sings through it too. */
  readonly callVoice: CallVoice
}

/**
 * What the room lends the demo's way in: its state, its sky and its Merc,
 * each a step the singer's run takes too. The run's own internals (the
 * engine, the capture loop, the take on) stay the room's: `clear` and
 * `load` reset them.
 */
export interface ScriptHost {
  readonly callVoice: CallVoice
  readonly active: Accessor<boolean>
  setActive: (on: boolean) => void
  setPlaying: (on: boolean) => void
  phase: () => EchoPhase
  audio: () => Promise<AudioContext | null>
  /** Merc's voice loaded for the calls (merc-sampler.ts). */
  ready: () => Promise<unknown>
  note: () => number
  /** No take, no result, an empty sky; Merc where he is. */
  clear: () => void
  /** The take in place of the mic: its call, its engine, nothing heard yet. */
  load: (take: ScriptedEchoTake) => void
  /** The take's rings in as its notes are heard, and its frames flowing. */
  begin: (take: ScriptedEchoTake) => void
  /** The take on now, if any. */
  current: () => ScriptedEchoTake | null
  /** The run's places in the sky, for the result's scene. */
  run: () => EchoState['run']
  line: (text: string) => void
  sayIntro: () => void
  demo: (phase: EchoDemoPhase) => void
  /** The result's numbers under the sky, or none. */
  summary: (summary: EchoSummary | null) => void
  scene: (scene: SkyScene) => void
  merc: (state: MercState) => void
  cheer: () => void
  later: (ms: number, fn: () => void) => void
  mark: (moment: EchoDemoMark) => void
}

export interface ScriptedRoom {
  readonly script: EchoScript
  /** A take's phrase ended (endPhrase): take 2 goes on to its result. */
  phraseEnded: (take: ScriptedEchoTake, sung: PhraseTake) => void
}

/** The demo's way into the room, on the room's own steps. */
export function createScriptedRoom(
  host: ScriptHost,
  phraseShowMs: number,
): ScriptedRoom {
  /** Bumped by every move the demo makes: older timers fall silent. */
  let turn = 0
  const clear = (): void => {
    turn += 1
    host.clear()
  }

  /**
   * The demo's result: its one phrase, shown as a run's would be, at the
   * demo's level. Nothing is kept and nothing is felt or said: the demo's
   * own tooltip explains it.
   */
  const showResult = (take: ScriptedEchoTake, sung: PhraseTake): void => {
    const { rhythmToleranceMs } = ECHO_LEVELS[take.level]
    const metrics = sequenceMetrics([sung], rhythmToleranceMs)
    const at = { level: take.level, run: host.run(), improved: false }
    const shown = showResultOf([sung], metrics, at)
    // Shown as a run's is: its numbers and its sky, at once.
    batch(() => {
      host.summary(shown.summary)
      host.scene(shown.scene)
      host.demo('result')
    })
    if (shown.celebrate) host.cheer()
    else host.merc('idle')
    host.mark('result')
  }

  const script: EchoScript = {
    ...createRoomScript<ScriptedEchoTake>({
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
          host.demo('intro')
        })
        host.merc('idle')
      },
      play: (take) => {
        clear()
        host.load(take)
        batch(() => {
          host.line('')
          host.demo('call')
        })
        host.begin(take)
        // The call's tooltip may show once its first note is heard.
        const mine = turn
        const first = take.startsAt + (take.call[0]?.from ?? 0) * 1000
        host.later(Math.max(0, first - performance.now()), () => {
          if (mine === turn && host.current() === take) host.mark('call')
        })
      },
      rest: () => {
        clear()
        host.demo('between')
        host.merc('idle')
      },
      leave: () => {
        clear()
        batch(() => {
          host.setActive(false)
          host.setPlaying(false)
          host.demo('intro')
        })
        host.sayIntro()
        host.merc('idle')
      },
      playing: host.setPlaying,
    }),
    callVoice: host.callVoice,
  }

  return {
    script,
    // Take 1 shows its phrase ending until the demo moves on.
    phraseEnded: (take, sung) => {
      if (!take.toResult) return
      const mine = turn
      host.later(phraseShowMs, () => {
        if (mine === turn && host.current() === take) showResult(take, sung)
      })
    },
  }
}
