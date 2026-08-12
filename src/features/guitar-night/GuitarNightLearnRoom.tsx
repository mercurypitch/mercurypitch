// Guitar Night Learn Room hosts every focused activity behind one reusable stage boundary.
// ============================================================

import type { Accessor } from 'solid-js'
import { createSignal, lazy, Match, Suspense, Switch, untrack } from 'solid-js'
import type { NoteHuntState } from '@/features/guitar/activities/note-hunt'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import styles from './GuitarNightApp.module.css'
import type { GuitarNightLearnActivityId } from './GuitarNightLearnActivity'
import { loadNoteHuntProgress, saveNoteHuntProgress, } from './note-hunt-progress'

export type GuitarNightFocusedLearnActivityId = Exclude<
  GuitarNightLearnActivityId,
  'first-steps'
>

interface GuitarNightLearnRoomProps {
  activity: GuitarNightFocusedLearnActivityId
  tuning: Accessor<InstrumentTuning>
  active: Accessor<boolean>
  onBack(activity: GuitarNightFocusedLearnActivityId): void
}

const GuitarNightNoteHunt = lazy(async () => {
  const module = await import('./GuitarNightNoteHunt')
  return { default: module.GuitarNightNoteHunt }
})

const GuitarNightHearAndFind = lazy(async () => {
  const module = await import('./GuitarNightHearAndFind')
  return { default: module.GuitarNightHearAndFind }
})

const GuitarNightEchoPhrase = lazy(async () => {
  const module = await import('./GuitarNightEchoPhrase')
  return { default: module.GuitarNightEchoPhrase }
})

const GuitarNightShapeWalk = lazy(async () => {
  const module = await import('./GuitarNightShapeWalk')
  return { default: module.GuitarNightShapeWalk }
})

const FALLBACK_COPY: Record<GuitarNightFocusedLearnActivityId, string> = {
  'note-hunt': 'Setting the fretboard…',
  'hear-find': 'Setting the listening room…',
  'echo-phrase': 'Setting the phrase…',
  'shape-walk': 'Setting the shape…',
}

export function GuitarNightLearnRoom(props: GuitarNightLearnRoomProps) {
  const restored = untrack(() =>
    props.activity === 'note-hunt'
      ? loadNoteHuntProgress(props.tuning())
      : null,
  )
  const [noteHuntState, setNoteHuntState] = createSignal<NoteHuntState | null>(
    restored?.state ?? null,
  )
  const [noteHuntCompletedRounds, setNoteHuntCompletedRounds] = createSignal(
    restored?.completedRoundCount ?? 0,
  )

  const saveNoteHuntState = (
    state: NoteHuntState,
    completedRoundCount: number,
  ): void => {
    setNoteHuntState(state)
    setNoteHuntCompletedRounds(completedRoundCount)
    saveNoteHuntProgress(state, props.tuning(), completedRoundCount)
  }

  const leave = (): void => props.onBack(props.activity)

  return (
    <Suspense
      fallback={
        <p class={styles.songMessage} role="status" aria-live="polite">
          {FALLBACK_COPY[props.activity]}
        </p>
      }
    >
      <Switch>
        <Match when={props.activity === 'note-hunt'}>
          <GuitarNightNoteHunt
            tuning={props.tuning}
            active={props.active}
            initialState={noteHuntState()}
            initialCompletedRoundCount={noteHuntCompletedRounds()}
            onState={saveNoteHuntState}
            onBack={leave}
          />
        </Match>
        <Match when={props.activity === 'hear-find'}>
          <GuitarNightHearAndFind
            tuning={props.tuning}
            active={props.active}
            onBack={leave}
          />
        </Match>
        <Match when={props.activity === 'echo-phrase'}>
          <GuitarNightEchoPhrase
            tuning={props.tuning}
            active={props.active}
            onBack={leave}
          />
        </Match>
        <Match when={props.activity === 'shape-walk'}>
          <GuitarNightShapeWalk
            tuning={props.tuning}
            active={props.active}
            onBack={leave}
          />
        </Match>
      </Switch>
    </Suspense>
  )
}
