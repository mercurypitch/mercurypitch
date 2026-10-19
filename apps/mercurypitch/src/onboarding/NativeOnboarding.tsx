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
//               later, and Keep comes a beat after. On a phone that already
//               keeps a range (saved-range.ts): See my voice, its reveal,
//               or Find my range again
//   range       beat 4 (useRange.ts): a slide down, a slide up, the range
//   reveal      beat 5 (useReveal.ts): the voiceprint card, the twin, Share
//   keep        beat 7 (KeepView.tsx): Keep, the account offer, the shell's
//               own sheet over this layer (account-offer.ts). After the
//               reveal it shows the voiceprint, its card flown in; after a
//               skipped range it is Save your progress, whose "Find your
//               range first" runs beat 4 here and comes back to Keep
//
// Keep comes only to a phone with no account yet (signed in, or signed out
// of one, the layer goes straight on), and only after a range measured or
// skipped: a refused mic never gets that far, so it gets no offer (S7b E5).
// Not now on the layer stands aside while Keep is up: Keep's own is the way
// out. Once Keep has closed, and the sign-in sheet or the voiceprint ask it
// handed over to has closed too, the layer goes on to the Sing room, live,
// until the sung line (part 4) takes that place. Opened on its own from
// Keep's "Find your range first" over anything else, the layer starts on
// the range and goes back to Keep.
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
import type { RangeResult } from '@/lib/mirror/metrics'
import { onboardingShown } from '../shell/run-shell-store'
import { noAccountYet, offerOpen, openKeep, openKeepFromReveal, } from '../shell/settings/account-offer'
import { signInOpen } from '../shell/settings/sign-in-state'
import { voiceprintAskAsking } from '../shell/settings/voiceprint-ask'
import { FirstNoteView, noteSays } from './FirstNoteView'
import { KeepView } from './KeepView'
import styles from './NativeOnboarding.module.css'
import { ONBOARDING_COPY } from './onboarding-copy'
import { leaveOnboarding, onboardingEntry, registerLayerRange, } from './onboarding-layer'
import { rangeSays, RangeView } from './RangeView'
import { RevealView } from './RevealView'
import { savedRange } from './saved-range'
import { ONBOARDING_AUDIO_OWNER, useFirstNote } from './useFirstNote'
import { useRange } from './useRange'
import { useReveal } from './useReveal'

/** Merc's word on a skipped range has its moment, then Keep comes, ms. */
export const SKIP_BEAT_MS = 1600

export type OnboardingBeat = 'first-note' | 'range' | 'reveal' | 'keep'

/** Keep, or what Keep handed over to: the sign-in sheet, the voiceprint ask. */
function keepUp(): boolean {
  return offerOpen() || signInOpen() || voiceprintAskAsking()
}

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
  /** The range the reveal shows: the one just measured, or the one kept. */
  const [revealed, setRevealed] = createSignal<RangeResult | null>(null)
  /**
   * A range this phone already keeps, measured from Keep before the first
   * Sing door: the first note ends on it rather than on a second measuring.
   * Only the onboarding opens on the first note; the range on its own
   * measures. Read once: the layer is mounted fresh for each opening.
   */
  const saved = savedRange()

  let skipTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(skipTimer))

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

  /** Find my range, or again: the range, its mic opened inside this tap. */
  const findRange = (): void => {
    setSkipped(false)
    setBeat('range')
    range.start()
  }

  /**
   * Beat 7: Keep over the layer, for a phone with no account yet. After the
   * reveal its card flies in; after a skipped range there is none. A phone
   * with an account goes straight on to the Sing room.
   */
  const toKeep = (after: 'reveal' | 'skip'): void => {
    // A layer on its way out brings no Keep: Merc's word on a skip still
    // ends while it fades.
    if (untrack(leaving)) return
    if (!noAccountYet()) {
      leaveOnboarding('finished')
      return
    }
    setBeat('keep')
    if (after === 'reveal') openKeepFromReveal()
    else openKeep()
  }

  /** Skip for now: Merc's word, then Keep. */
  const skip = (): void => {
    if (untrack(skipped)) return
    setSkipped(true)
    skipTimer = setTimeout(() => {
      skipTimer = undefined
      toKeep('skip')
    }, SKIP_BEAT_MS)
  }
  /** The range's own Skip for now: in the onboarding only. From Keep, Not
   *  now is the way back to it. A plain value, so a tap reads no getter. */
  const skipRange = entry === 'onboarding' ? skip : undefined

  const showReveal = (shown: RangeResult | null): void => {
    if (shown === null) return
    setRevealed(shown)
    setBeat('reveal')
    reveal.arrive()
  }
  const seeVoice = (): void => showReveal(untrack(range.state).range)
  /** See my voice on the first note: the range this phone already keeps. */
  const seeSaved = saved === null ? undefined : () => showReveal(saved)

  /** Continue on the reveal: Keep in the onboarding, back to Keep from it. */
  const continueOn = (): void => {
    if (entry === 'onboarding') toKeep('reveal')
    else leaveOnboarding('finished')
  }

  // Keep's "Find your range first", over this layer's beat 7: this layer's
  // own range, inside Keep's tap. Keep brings itself back after the reveal.
  if (entry === 'onboarding') onCleanup(registerLayerRange(findRange))

  // Keep has closed, and so has what it handed over to: on to the Sing room.
  // Checked once the tap that closed it is over, because Keep's ways close
  // it and open what comes next in the one tap (Use email, a sign-in and
  // its voiceprint ask, Find your range first).
  createEffect(
    on(
      [beat, keepUp],
      ([now, up]) => {
        if (now !== 'keep' || up) return
        queueMicrotask(() => {
          if (untrack(beat) === 'keep' && !untrack(keepUp)) {
            leaveOnboarding('finished')
          }
        })
      },
      { defer: true },
    ),
  )

  /** The beat on screen's controller: Merc's state and voice are its. */
  const active = () => {
    switch (beat()) {
      case 'range':
        return range
      case 'reveal':
      case 'keep':
        return reveal
      default:
        return note
    }
  }

  /** Merc's line on the beat on screen, for its bubble and the live region.
   *  None under Keep: the sheet says it. */
  const said = (): string | null => {
    if (beat() === 'keep') return null
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
      case 'keep':
        return revealed() === null
          ? ONBOARDING_COPY.title
          : ONBOARDING_COPY.revealTitle
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
      {/* Under Keep, its own Not now is the way out: this one stands aside,
          in place, so nothing moves when Keep has gone. */}
      <div
        class={styles.top}
        classList={{ [styles.away]: beat() === 'keep' }}
        inert={beat() === 'keep'}
      >
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
            onSeeSaved={seeSaved}
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
        <Match when={beat() === 'reveal' ? revealed() : null}>
          {(shown) => (
            <RevealView
              controller={reveal}
              range={shown()}
              onContinue={continueOn}
              merc={merc}
            />
          )}
        </Match>
        <Match when={beat() === 'keep'}>
          <KeepView merc={merc} />
        </Match>
      </Switch>
    </div>
  )
}
