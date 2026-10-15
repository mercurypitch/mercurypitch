// ============================================================
// LongNoteFixture: a state of the room, pinned, for the art measure
// ============================================================
//
// ART-FIDELITY.md 3.6, as Lip roll's and Ng's fixtures: the room as one of
// its states draws it (fixture-scenes.ts), nothing moving. The room itself
// draws it, every component its own, with a pinned run in place of a live
// one: the lantern's fill, Merc's place and the voice's trace are handed
// in once, as a take would hand them in a frame.
//
// Reached only from the dev server: the native entry imports this behind
// `import.meta.env.DEV` (`?longNoteFixture=intro`), so no build carries it.
// The capture waits for
//   [data-testid="long-note-fixture"][data-fixture="<name>"][data-ready="true"]
// which is set once every picture is decoded and the trace is drawn.

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import type { HoldState } from '@/lib/hold/hold-engine'
import { createHoldState, LANTERN_LEVELS } from '@/lib/hold/hold-engine'
import type { MercVoice } from '@/lib/merc/sim'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { LongNoteController } from '../long-note-controller-types'
import { LongNoteRoom } from '../LongNoteRoom'
import { VoiceTraceBuffer } from '../voice-trace-buffer'
import type { FixtureVoice, LongNoteFixtureName, LongNoteFixtureScene, } from './fixture-scenes'
import { FIXTURE_NOTE, FIXTURE_SCENES } from './fixture-scenes'

export function isFixtureName(
  name: string | null,
): name is LongNoteFixtureName {
  return name !== null && Object.hasOwn(FIXTURE_SCENES, name)
}

function voiceOf(kind: FixtureVoice): MercVoice {
  if (kind === 'silent') {
    return { voiced: false, cents: 0, level: 0, steady: 0, midi: FIXTURE_NOTE }
  }
  const cents = kind === 'sharp' ? 45 : 0
  return {
    voiced: true,
    cents,
    level: 0.6,
    steady: kind === 'sharp' ? 0 : 1,
    midi: FIXTURE_NOTE + cents / 100,
  }
}

/** A run that is only ever this one frame. */
export function fixtureController(
  scene: LongNoteFixtureScene,
): LongNoteController {
  const trace = new VoiceTraceBuffer()
  for (const sample of scene.trace) {
    trace.push(sample.t, sample.cents, sample.filling)
  }
  const hold: HoldState = {
    ...createHoldState(),
    inBandSeconds: scene.inBandSeconds,
  }
  const voice = voiceOf(scene.voice)
  const open = scene.phase === 'listen' || scene.phase === 'hold'
  return {
    state: () => ({
      phase: scene.phase,
      targetMidi: FIXTURE_NOTE,
      run: 0,
      block: null,
    }),
    noteName: () => midiToNoteNameOctave(FIXTURE_NOTE),
    hold: () => hold,
    summary: () => scene.summary,
    line: () => scene.line,
    chip: () => scene.chip,
    mercState: () => scene.mercState,
    mercPlace: () => scene.mercPlace,
    mercVoice: () => voice,
    lanternLevel: () => scene.level,
    lanternGlow: () => scene.glow,
    shine: () => scene.shine,
    trace,
    now: () => scene.now,
    toleranceCents: () => LANTERN_LEVELS.singer.tolCents,
    start: () => undefined,
    cancel: () => undefined,
    stop: () => undefined,
    again: () => undefined,
    changeNote: () => undefined,
    nudge: () => undefined,
    canHear: () => !open,
    hearNote: () => undefined,
    // A fixture has no demo (LongNoteRoom: another's run has none).
    script: {
      active: () => false,
      audio: () => Promise.resolve(null),
      note: () => FIXTURE_NOTE,
      enter: () => false,
      play: () => undefined,
      rest: () => undefined,
      leave: () => undefined,
      playing: () => undefined,
      mood: () => undefined,
    },
  }
}

export interface LongNoteFixtureProps {
  name: LongNoteFixtureName
}

export function LongNoteFixture(props: LongNoteFixtureProps): JSX.Element {
  const [ready, setReady] = createSignal(false)
  // eslint-disable-next-line solid/reactivity -- a fixture is one frame
  const controller = fixtureController(FIXTURE_SCENES[props.name])
  // Two frames for the compositor to settle the trace's blurred glow.
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
      data-testid="long-note-fixture"
      data-fixture={props.name}
      data-ready={ready() ? 'true' : 'false'}
    >
      <LongNoteRoom
        onDone={() => undefined}
        controller={controller}
        still
        onSettled={settled}
      />
    </div>
  )
}
