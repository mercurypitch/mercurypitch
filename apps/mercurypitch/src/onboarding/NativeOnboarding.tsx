// ============================================================
// NativeOnboarding: the native app's own onboarding, over the Sing room
// ============================================================
//
// One full-screen layer (onboarding-layer.ts says when it is up) on a dark
// stage, whatever the theme, like the premium rooms. Not now sits at its
// top right from the first frame to the last, and it is the only way out
// besides the beats' own last buttons (S7b E1, the web's settled choice).
//
// Its beats, in S7b's order, as each lands:
//
//   first-note  beats 2 and 3 (useFirstNote.ts): one note, named. Then Find
//               my range, or Skip for now: Merc says the range is there for
//               later, and the layer goes a beat after
//   range       beat 4 (useRange.ts): a slide down, a slide up, the range
//   reveal      beat 5 (useReveal.ts): the voiceprint card, the twin, Share
//
// Continue on the reveal, or a skipped range, lands in the Sing room, live,
// until Keep (beat 7) takes that place. Opened on its own from Keep's "Find
// your range first", the layer starts on the range and goes back to Keep.
//
// The beats share one capture, so the mic the first note opened is the one
// the range opens again, and one Merc, who moves from beat to beat with the
// singer instead of landing again on each. One live region reads Merc's
// lines across the beats, so a beat's first line is read as it arrives.
//
// NativeShell loads this file lazily, and only on a build with the
// onboarding (NATIVE_ONBOARDING), so the store build carries none of it.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, Match, on, onCleanup, onMount, Switch, untrack, } from 'solid-js'
import { MercView } from '@/components/room-kit/MercView'
import surface from '@/components/room-kit/RoomSurface.module.css'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { onboardingShown } from '../shell/run-shell-store'
import { FirstNoteView, noteSays } from './FirstNoteView'
import styles from './NativeOnboarding.module.css'
import { ONBOARDING_COPY } from './onboarding-copy'
import { leaveOnboarding, onboardingEntry } from './onboarding-layer'
import { rangeSays, RangeView } from './RangeView'
import { RevealView } from './RevealView'
import { ONBOARDING_AUDIO_OWNER, useFirstNote } from './useFirstNote'
import { useRange } from './useRange'
import { useReveal } from './useReveal'

/** Merc's word on a skipped range has its moment, then the layer goes, ms. */
export const SKIP_BEAT_MS = 1600

export type OnboardingBeat = 'first-note' | 'range' | 'reveal'

export function NativeOnboarding(): JSX.Element {
  const leaving = () => !onboardingShown()
  // Read once: the layer is mounted fresh for each opening.
  const entry = untrack(onboardingEntry)
  const capture = useExerciseCapture(ONBOARDING_AUDIO_OWNER, 'Onboarding')
  const note = useFirstNote({ capture })
  const range = useRange({
    capture,
    anchor: () => note.state().note?.midi ?? null,
  })
  const reveal = useReveal()

  const [beat, setBeat] = createSignal<OnboardingBeat>(
    entry === 'range' ? 'range' : 'first-note',
  )
  const [skipped, setSkipped] = createSignal(false)

  // Leaving shuts the mic at once; the layer only fades after.
  createEffect(
    on(
      leaving,
      (gone) => {
        if (!gone) return
        note.leave()
        range.leave()
      },
      { defer: true },
    ),
  )

  let skipTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(skipTimer))

  /** Find my range: the range, its mic opened inside this tap. */
  const findRange = (): void => {
    setBeat('range')
    range.start()
  }
  /** Skip for now: Merc's word, then on (the Sing room, until Keep). */
  const skip = (): void => {
    if (untrack(skipped)) return
    setSkipped(true)
    skipTimer = setTimeout(() => leaveOnboarding('finished'), SKIP_BEAT_MS)
  }
  /** The range's own Skip for now: in the onboarding only. From Keep, Not
   *  now is the way back to it. A plain value, so a tap reads no getter. */
  const skipRange = entry === 'onboarding' ? skip : undefined
  const seeVoice = (): void => {
    setBeat('reveal')
    reveal.arrive()
  }

  /** The beat on screen's controller: Merc's state and voice are its. */
  const active = () => {
    switch (beat()) {
      case 'range':
        return range
      case 'reveal':
        return reveal
      default:
        return note
    }
  }

  /** Merc's line on the beat on screen, for its bubble and the live region. */
  const said = (): string | null => {
    if (skipped()) return ONBOARDING_COPY.skipped
    switch (beat()) {
      case 'range':
        return rangeSays(range)
      case 'reveal':
        return ONBOARDING_COPY.voiceprint
      default:
        return noteSays(note)
    }
  }

  const title = (): string => {
    switch (beat()) {
      case 'range':
        return ONBOARDING_COPY.rangeTitle
      case 'reveal':
        return ONBOARDING_COPY.revealTitle
      default:
        return ONBOARDING_COPY.title
    }
  }

  // One Merc for every beat: made once here, and placed by each beat.
  const merc = (
    <MercView
      state={() => active().mercState()}
      voice={() => active().mercVoice()}
      still={() => active().still()}
      rings={false}
      class={styles.mercView}
      testId="onboarding-merc"
    />
  )

  let root: HTMLDivElement | undefined
  // Into the dialog, for a screen reader; nothing is drawn for it.
  onMount(() => root?.focus({ preventScroll: true }))

  return (
    <div
      ref={root}
      class={`${styles.layer} ${surface.surface} mp-dark-stage`}
      classList={{ [styles.leaving]: leaving() }}
      role="dialog"
      aria-modal="true"
      aria-label={title()}
      tabIndex={-1}
      inert={leaving()}
      data-testid="native-onboarding"
      data-beat={beat()}
      data-entry={entry}
      data-leaving={leaving() ? 'on' : 'off'}
    >
      <div class={styles.top}>
        <button
          type="button"
          class={styles.notNow}
          onClick={() => leaveOnboarding('not-now')}
          data-testid="onboarding-not-now"
        >
          {ONBOARDING_COPY.notNow}
        </button>
      </div>
      {/* Merc's lines, read once as they change, whichever beat says them. */}
      <span
        class={styles.said}
        aria-live="polite"
        data-testid="onboarding-said"
      >
        {said() ?? ''}
      </span>
      <Switch>
        <Match when={beat() === 'first-note'}>
          <FirstNoteView
            controller={note}
            line={said()}
            onRange={findRange}
            onSkip={skip}
            skipped={skipped()}
            merc={merc}
          />
        </Match>
        <Match when={beat() === 'range'}>
          <RangeView
            controller={range}
            line={said()}
            onSee={seeVoice}
            onSkip={skipRange}
            skipped={skipped()}
            merc={merc}
          />
        </Match>
        <Match when={beat() === 'reveal' ? range.state().range : null}>
          {(measured) => (
            <RevealView
              controller={reveal}
              range={measured()}
              onContinue={() => leaveOnboarding('finished')}
              merc={merc}
            />
          )}
        </Match>
      </Switch>
    </div>
  )
}
