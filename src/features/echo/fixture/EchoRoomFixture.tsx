// ============================================================
// EchoRoomFixture: the Echo room as a stop of the Warm-up, pinned
// ============================================================
//
// The room itself (EchoRoom.tsx) on a run that is only ever one frame, for
// the Warm-up's screenshots: `?echoFixture=warm-intro` (the stop's chip,
// Merc's cue, "Skip stop") and `?echoFixture=warm-result` (a three-phrase
// run, 8 of 9 notes on pitch, on the result's first, third and fifth
// places). `&warmUp=<n>` names the stop (room-kit routine-fixture.ts);
// without it the room is the last of four, where the Warm-up puts Echo.
// The art's own fixtures (EchoFixture.tsx) draw the storyboard's frames.
//
// Dev server only, as EchoFixture is. The capture waits for
//   [data-testid="echo-room-fixture"][data-fixture="<name>"][data-ready="true"]
// which is set two frames after the sky's plate has settled.

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { SILENT_VOICE } from '@/components/room-kit/room-constants'
import { FIXTURE_STOPS, fixtureStop, } from '@/components/room-kit/routine-fixture'
import type { RoutineStop } from '@/components/room-kit/routine-stop'
import type { MercState } from '@/lib/merc/constants'
import { echoWindow, planEchoRun } from '@/lib/sequence/phrase-fit'
import type { NoteOutcome } from '@/lib/sequence/sequence-engine'
import { ECHO_LEVELS } from '@/lib/sequence/sequence-engine'
import type { PhraseTake } from '@/lib/sequence/sequence-metrics'
import { sequenceMetrics } from '@/lib/sequence/sequence-metrics'
import type { EchoController, EchoSummary } from '../echo-controller-contract'
import { WARM_UP_PHRASES } from '../echo-controller-contract'
import type { EchoPhase } from '../echo-machine'
import { showResultOf } from '../echo-run'
import { EchoRoom } from '../EchoRoom'
import { SYNTH_CALL } from '../merc-call'
import { ECHO_LINES, fillFields } from '../merc-lines'
import type { SkyScene } from '../sky-scene'
import { EMPTY_SCENE } from '../sky-scene'

/** The room's frames in the Warm-up. */
export const ROOM_FIXTURES = ['warm-intro', 'warm-result'] as const
export type EchoRoomFixtureName = (typeof ROOM_FIXTURES)[number]

export function isRoomFixtureName(
  name: string | null,
): name is EchoRoomFixtureName {
  return ROOM_FIXTURES.some((each) => each === name)
}

/** The run's root: C4, an easy note for most voices. */
const ROOT = 60
/** The one note missed: the second phrase's last. */
const MISSED = { phrase: 1, note: 2 } as const

/** Three phrases at Learning, each sung back, one note missed. */
function threePhrases(): PhraseTake[] {
  const phrases = planEchoRun({
    level: 'learning',
    window: echoWindow({ voiceprints: [], settledMidi: ROOT }),
    seed: 7,
    count: WARM_UP_PHRASES,
  })
  return phrases.map((phrase, p) => ({
    phrase,
    outcomes: phrase.notes.map((note, index): NoteOutcome => {
      const onset = note.at + 0.05
      if (p === MISSED.phrase && index === MISSED.note) {
        return {
          index,
          landed: false,
          missedAt: onset + note.seconds,
          cause: 'deadline',
          voiced: true,
          closest: null,
        }
      }
      return {
        index,
        landed: true,
        cents: 0,
        onset,
        landedAt: onset + 0.2,
        timeToLandMs: 200,
      }
    }),
  }))
}

interface Frame {
  readonly phase: EchoPhase
  readonly scene: SkyScene
  readonly summary: EchoSummary | null
  readonly line: string
  readonly merc: MercState
}

function frameOf(name: EchoRoomFixtureName): Frame {
  if (name === 'warm-intro') {
    return {
      phase: 'intro',
      scene: EMPTY_SCENE,
      summary: null,
      line: ECHO_LINES.routine[0].text,
      merc: 'idle',
    }
  }
  const takes = threePhrases()
  const metrics = sequenceMetrics(takes, ECHO_LEVELS.learning.rhythmToleranceMs)
  const shown = showResultOf(takes, metrics, {
    level: 'learning',
    run: 1,
    improved: false,
    phrases: WARM_UP_PHRASES,
  })
  return {
    phase: 'result',
    scene: shown.scene,
    summary: shown.summary,
    line: fillFields(ECHO_LINES.result[0].text, {
      landed: metrics.landed,
      total: metrics.notes,
    }),
    merc: 'idle',
  }
}

/** A run that is only ever this one frame. */
export function roomFixtureController(frame: Frame): EchoController {
  const run = frame.phase === 'result' ? 1 : 0
  return {
    state: () => ({
      phase: frame.phase,
      phrase: frame.phase === 'result' ? WARM_UP_PHRASES - 1 : -1,
      phrases: WARM_UP_PHRASES,
      run,
      block: null,
    }),
    scene: () => frame.scene,
    line: () => frame.line,
    chip: () => null,
    summary: () => frame.summary,
    mercState: () => frame.merc,
    mercVoice: () => SILENT_VOICE,
    micLevel: () => 0,
    canReplay: () => false,
    start: () => undefined,
    stop: () => undefined,
    replay: () => undefined,
    drawVoice: () => undefined,
    // A fixture has no demo (EchoRoom: another's run has none).
    script: {
      active: () => false,
      audio: () => Promise.resolve(null),
      note: () => ROOT,
      enter: () => false,
      play: () => undefined,
      rest: () => undefined,
      leave: () => undefined,
      playing: () => undefined,
      callVoice: SYNTH_CALL,
    },
    settledNote: () => ROOT,
  }
}

export interface EchoRoomFixtureProps {
  name: EchoRoomFixtureName
  /** The stop the room is; the Warm-up's last by default. */
  stop?: RoutineStop
}

export function EchoRoomFixture(props: EchoRoomFixtureProps): JSX.Element {
  const [ready, setReady] = createSignal(false)
  // eslint-disable-next-line solid/reactivity -- a fixture is one frame
  const controller = roomFixtureController(frameOf(props.name))
  // eslint-disable-next-line solid/reactivity -- a fixture is one frame
  const stop = props.stop ?? fixtureStop(`?warmUp=${FIXTURE_STOPS}`)
  // Two frames for the compositor to settle the sky's blurred glow.
  const settled = (): void => {
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))
  }
  return (
    <div
      style={{
        position: 'fixed',
        inset: '0',
        '--pushed-top': 'calc(var(--safe-top, 0px) + 56px)',
        '--pushed-bottom': 'var(--safe-bottom, 0px)',
      }}
      data-testid="echo-room-fixture"
      data-fixture={props.name}
      data-ready={ready() ? 'true' : 'false'}
    >
      <EchoRoom
        onDone={() => undefined}
        controller={controller}
        still
        onSettled={settled}
        routine={stop}
      />
    </div>
  )
}
