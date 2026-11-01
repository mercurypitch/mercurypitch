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
//   line        beat 8 (useLine.ts, LineView.tsx): one line, sung by Merc
//               and then by the singer, in the key of the range the reveal
//               showed (from C4 after a skipped range), scored by the
//               Karaoke engine
//   offer       beat 9: the Cloud offer, the shell's own sheet over this
//               layer (CloudOffer.tsx), once an install, held out of one
//               install in ten, never to a subscriber, and only with the
//               store's price in hand (onboarding-offer.ts).
//               Merc goes with it, small by its art (cloudOfferGuest). The
//               layer's Not now brings it too, from any beat
//
// Keep comes only to a phone with no account yet (signed in, or signed out
// of one, the layer goes straight on to the line), and only after a range
// measured or skipped: a refused mic never gets that far, so it gets no
// offer of either kind (S7b E5). Not now on the layer stands aside while
// Keep or the Cloud offer is up: the sheet's own is the way out. Once Keep
// has closed, and the sign-in sheet or the voiceprint ask it handed over to
// has closed too, the layer goes on to the line. The line's Continue opens
// the Cloud offer when beat 9's rules allow it, and the onboarding lands on
// the Warm-up's path (beat 10, onboarding-landing.ts) once the offer and
// whatever it handed over to have closed; else it lands there straight
// away. A refused mic, or one that would not open, goes on in one tap
// (Continue without the mic, REQ-NFL-043) to the same landing, with no
// offer.
//
// Not now, at any beat (and Back, which is the same Not now), ends the
// onboarding for good, its mic shut in the tap (owner, 20 Oct 2026). The
// Cloud offer comes when it is due, by every rule of beat 9's and never
// after a refused mic (S7b E5), counted apart from the end's; the layer
// waits on the asks before it, its Not now busy and the beat out of reach,
// and a second Not now leaves at once. Not due, it leaves at once. Either
// way it lands on the alley, once the offer and whatever it handed over to
// have closed (onboarding-landing.ts). Keep's own Not now still goes on to
// the line, and the end's offer to the Warm-up's path.
//
// Opened on its own from Keep's "Find your range first" over anything
// else, the layer starts on the range and goes back to Keep.
//
// The beats share one capture, so the mic the first note opened is the one
// the range opens again, and one Merc, who moves from beat to beat with the
// singer instead of landing again on each. One live region reads Merc's
// lines across the beats, so a beat's first line is read as it arrives.
//
// A beat gives way to the next by a View Transition, or by a cross-fade
// where the WebView has none or a sheet comes up with the next beat, and
// Merc moves across from his old place to his new one (beat-swap.ts).
//
// Each beat is counted as it shows and as it is done (S7b §7,
// onboarding-measure.ts): the onboarding's own, not the range on its own.
//
// NativeShell loads this file lazily, and only on a build with the
// onboarding (NATIVE_ONBOARDING), so the store build carries none of it.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, Match, on, onCleanup, onMount, Switch, untrack, } from 'solid-js'
import './beat-swap.css'
import { MercView } from '@/components/room-kit/MercView'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import surface from '@/components/room-kit/RoomSurface.module.css'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { cloudOfferGuest, cloudOfferOpen, setCloudOfferGuest, } from '@/features/karaoke-room/cloud-offer-store'
import type { NativeOnboardingEvent } from '@/features/onboarding/funnel'
import { trackNativeOnboarding } from '@/features/onboarding/funnel'
import type { RangeResult } from '@/lib/mirror/metrics'
import { onboardingShown } from '../shell/run-shell-store'
import { noAccountYet, offerOpen, onKeepChoice, openKeep, openKeepFromReveal, } from '../shell/settings/account-offer'
import { keepableVoiceprint } from '../shell/settings/keep-voiceprint'
import { signInOpen } from '../shell/settings/sign-in-state'
import { voiceprintAskAsking } from '../shell/settings/voiceprint-ask'
import type { SwapDone } from './beat-swap'
import { createBeatSwap, GHOST_ATTR, MERC_CLASS } from './beat-swap'
import { FirstNoteView, noteSays } from './FirstNoteView'
import { KeepView } from './KeepView'
import { lineSaysText, LineView } from './LineView'
import styles from './NativeOnboarding.module.css'
import { ONBOARDING_COPY } from './onboarding-copy'
import { countFinished, leaveOnboarding, markFinished, markNotNow, onboardingEntry, registerLayerNotNow, registerLayerRange, } from './onboarding-layer'
import { KEEP_CHOICE_EVENT, lineBandEvent } from './onboarding-measure'
import type { OfferSkip } from './onboarding-offer'
import { offerSkipNow, onboardingOfferGroup, openOnboardingOffer, prepareOnboardingOffer, } from './onboarding-offer'
import { rangeSays, RangeView } from './RangeView'
import { RevealView } from './RevealView'
import { savedRange } from './saved-range'
import { lineTonic } from './sung-line'
import { ONBOARDING_AUDIO_OWNER, useFirstNote } from './useFirstNote'
import { useLine } from './useLine'
import { useRange } from './useRange'
import { useReveal } from './useReveal'

/** Merc's word on a skipped range has its moment, then Keep comes, ms. */
export const SKIP_BEAT_MS = 1600

export type OnboardingBeat =
  | 'first-note'
  | 'range'
  | 'reveal'
  | 'keep'
  | 'line'
  | 'offer'

/**
 * A sheet the layer waits under: Keep, the Cloud offer, or what either
 * handed over to (the sign-in sheet, the voiceprint ask, Keep from the
 * offer's free account).
 */
function sheetUp(): boolean {
  return (
    offerOpen() || signInOpen() || voiceprintAskAsking() || cloudOfferOpen()
  )
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
  /** How the last beat gave way, for the probe. */
  const [swapped, setSwapped] = createSignal<SwapDone | 'none'>('none')
  let root: HTMLDivElement | undefined
  /** Where the beats draw: no box of its own, so each lays out in the layer. */
  let beats: HTMLDivElement | undefined
  /** The beat on screen: the root its view draws in the layer. */
  const beatOnScreen = (): HTMLElement | undefined => {
    for (const child of beats?.children ?? []) {
      if (
        child instanceof HTMLElement &&
        child.classList.contains(styles.beat) &&
        !child.hasAttribute(GHOST_ATTR)
      ) {
        return child
      }
    }
    return undefined
  }
  /**
   * The beat asked for. A View Transition draws it a frame after it is
   * asked for, so whatever decides what comes next reads this, never the
   * beat drawn: Keep's "Find your range first" closes Keep and asks for
   * the range in one tap, and Keep's close, checked once that tap is over,
   * must see the range coming, not Keep still drawn.
   */
  let headed: OnboardingBeat = untrack(beat)
  /**
   * On to `next` (beat-swap.ts): by a cross-fade when a sheet comes up with
   * it, so the sheet answers from its first frame; else by a View
   * Transition, where the WebView has one. The last beat asked for wins: a
   * transition's late draw of a beat since left draws nothing.
   */
  const go = (next: OnboardingBeat): void => {
    if (headed === next) return
    headed = next
    swaps.swap(
      () => {
        if (headed === next) setBeat(next)
      },
      next === 'keep' || next === 'offer' ? 'fade' : 'view',
    )
  }

  /** Counted once a layer: the onboarding's steps, not the range's own. */
  const counted = new Set<NativeOnboardingEvent>()
  const count = (event: NativeOnboardingEvent): void => {
    if (entry !== 'onboarding' || counted.has(event)) return
    counted.add(event)
    trackNativeOnboarding(event)
  }
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
  const line = useLine({
    capture,
    // The range the reveal showed, read as each take starts; from C4 when
    // the range was skipped.
    tonic: () => lineTonic(revealed()),
  })
  // This install's beat 9 group, drawn as its onboarding first opens, so
  // every install that starts it has one (onboarding-offer.ts).
  if (entry === 'onboarding') onboardingOfferGroup()

  let skipTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(skipTimer))

  /**
   * Not now has been said: the layer is on its way out, through the Cloud
   * offer when it is due. Never undone.
   */
  let exiting = false
  /** Not now's asks are out: the layer waits on them before it goes. */
  const [deciding, setDeciding] = createSignal(false)
  /** The beat Not now was said on, for the layer's name under its offer. */
  const [leftFrom, setLeftFrom] = createSignal<OnboardingBeat | null>(null)

  // Leaving shuts the mic at once; the layer only fades after.
  createEffect(
    on(
      leaving,
      (gone) => {
        if (!gone) return
        note.leave()
        range.leave()
        line.leave()
      },
      { defer: true },
    ),
  )

  /** Find my range, or again: the range, its mic opened inside this tap. */
  const findRange = (): void => {
    setSkipped(false)
    go('range')
    range.start()
  }

  /**
   * Beat 8, the sung line: after Keep, or straight after the reveal or a
   * skip on a phone with an account. A layer on its way out brings none.
   */
  const toLine = (): void => {
    if (untrack(leaving)) return
    if (exiting) {
      leaveOnboarding('not-now')
      return
    }
    go('line')
    line.arrive()
  }

  /**
   * Beat 7: Keep over the layer, for a phone with no account yet. After the
   * reveal its card flies in; after a skipped range there is none. A phone
   * with an account goes straight on to the line.
   */
  const toKeep = (after: 'reveal' | 'skip'): void => {
    // A layer on its way out brings no Keep: Merc's word on a skip still
    // ends while it fades.
    if (untrack(leaving)) return
    if (!noAccountYet()) {
      toLine()
      return
    }
    go('keep')
    if (after === 'reveal') openKeepFromReveal()
    else openKeep()
    count(
      keepableVoiceprint() === null
        ? 'native_onboarding_keep_view_progress'
        : 'native_onboarding_keep_view_voiceprint',
    )
  }

  /** Skip for now: Merc's word, then Keep. */
  const skip = (): void => {
    if (untrack(skipped)) return
    setSkipped(true)
    count('native_onboarding_range_skipped')
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
    go('reveal')
    reveal.arrive()
  }
  const seeVoice = (): void => showReveal(untrack(range.state).range)
  /** See my voice on the first note: the range this phone already keeps. */
  const seeSaved = saved === null ? undefined : () => showReveal(saved)

  /**
   * Continue without the mic, after a refusal or a mic that would not open:
   * the onboarding's one way on (REQ-NFL-043), straight to its landing,
   * with no offer of either kind (S7b E5). The range on its own has none:
   * its Not now goes back to Keep.
   */
  const withoutMic =
    entry === 'onboarding'
      ? (): void => {
          count('native_onboarding_without_mic')
          leaveOnboarding('finished')
        }
      : undefined

  /** Continue on the reveal: Keep in the onboarding, back to Keep from it. */
  const continueOn = (): void => {
    count('native_onboarding_reveal_complete')
    if (entry === 'onboarding') toKeep('reveal')
    else leaveOnboarding('finished')
  }

  // Keep's "Find your range first", over this layer's beat 7: this layer's
  // own range, inside Keep's tap. Keep brings itself back after the reveal.
  if (entry === 'onboarding') onCleanup(registerLayerRange(findRange))

  /**
   * Beat 9 has opened the Cloud offer. Its free account opens Keep, whose
   * "Find your range first" runs the range here and brings Keep back after
   * the reveal: that Keep closing lands on the Warm-up's path, not on a
   * second line.
   */
  let offered = false

  // Keep has closed, and so has what it handed over to: on to the line.
  // The Cloud offer has closed, and so has what it handed over to: on to
  // the landing. Checked once the tap that closed the sheet is over,
  // because a sheet's ways close it and open what comes next in the one tap
  // (Use email, a sign-in and its voiceprint ask, Find your range first,
  // the offer's free account).
  createEffect(
    on(
      [beat, sheetUp],
      ([now, up]) => {
        if ((now !== 'keep' && now !== 'offer') || up) return
        queueMicrotask(() => {
          if (untrack(sheetUp)) return
          if (exiting) leaveOnboarding('not-now')
          else if (headed === 'keep' && !offered) toLine()
          else if (headed === 'keep' || headed === 'offer') {
            leaveOnboarding('finished')
          }
        })
      },
      { defer: true },
    ),
  )

  /** Beat 9's asks, begun as the line's score shows (onboarding-offer.ts). */
  let offerAsks: Promise<OfferSkip | null> | null = null
  createEffect(
    on(
      () => line.state().phase,
      (phase) => {
        if (phase === 'done') offerAsks ??= prepareOnboardingOffer()
      },
      { defer: true },
    ),
  )
  /** Continue on the line was tapped, and beat 9 is being decided. */
  const [continuing, setContinuing] = createSignal(false)

  /** Continue on the line: beat 9 when its rules allow it, else the landing. */
  const continueLine = (): void => {
    if (untrack(continuing) || untrack(leaving) || exiting) return
    setContinuing(true)
    markFinished()
    const asks = offerAsks ?? prepareOnboardingOffer()
    // Not now while the asks are out takes over: its offer, not this one.
    const stands = (): boolean => !untrack(leaving) && !exiting
    void openOnboardingOffer(asks, stands).then((opened) => {
      setContinuing(false)
      if (!stands()) return
      if (!opened) {
        leaveOnboarding('finished')
        return
      }
      countFinished()
      showOffer()
    })
  }

  /** The offer is up: Merc goes with it, small by its art (S7b beat 9). */
  const showOffer = (): void => {
    offered = true
    setCloudOfferGuest(mercEl() ?? null)
    go('offer')
  }

  /** The mic refused, or would not open, and not granted since (S7b E5). */
  const micRefused = (): boolean =>
    [note.state(), range.state(), line.state()].some(
      (state) => state.phase === 'blocked',
    )

  /**
   * Not now, on the layer or by Back: the onboarding over for good, its mic
   * shut in the tap. Then the Cloud offer when it is due, once its asks
   * have answered, else the alley at once. A second Not now while the asks
   * are out leaves at once. The range on its own goes back to Keep.
   */
  const notNow = (): void => {
    if (entry !== 'onboarding' || exiting) {
      leaveOnboarding('not-now')
      return
    }
    exiting = true
    const refused = micRefused()
    clearTimeout(skipTimer)
    skipTimer = undefined
    note.leave()
    range.leave()
    line.leave()
    markNotNow()
    if (refused || offerSkipNow() !== null) {
      leaveOnboarding('not-now')
      return
    }
    setLeftFrom(untrack(beat))
    setDeciding(true)
    const asks = offerAsks ?? prepareOnboardingOffer()
    const stands = (): boolean => !untrack(leaving)
    void openOnboardingOffer(asks, stands, 'onboarding-exit').then((opened) => {
      setDeciding(false)
      if (!stands()) return
      if (opened) showOffer()
      else leaveOnboarding('not-now')
    })
  }
  onCleanup(registerLayerNotNow(notNow))

  // Counted: each beat as it shows, and as it is done (S7b §7).
  createEffect(
    on(beat, (now) => {
      if (now === 'range') count('native_onboarding_range_view')
      else if (now === 'reveal') count('native_onboarding_reveal_view')
      else if (now === 'line') count('native_onboarding_line_view')
    }),
  )
  createEffect(() => {
    if (note.state().phase === 'heard') {
      count('native_onboarding_first_note_complete')
    }
  })
  createEffect(() => {
    if (range.state().phase === 'done')
      count('native_onboarding_range_complete')
  })
  // The first scored take: the line done, and its band. Once more sings it
  // again, uncounted.
  createEffect(() => {
    const now = line.state()
    if (now.phase !== 'done' || now.score === null) return
    if (counted.has('native_onboarding_line_complete')) return
    count('native_onboarding_line_complete')
    count(lineBandEvent(now.score.hit, now.score.total))
  })
  // The onboarding's first ask for the mic, and its answer.
  createEffect(() => {
    if (
      counted.has('native_onboarding_mic_granted') ||
      counted.has('native_onboarding_mic_denied')
    ) {
      return
    }
    const listening = [note, range, line].some(
      (beatOf) => beatOf.micState() === 'sing',
    )
    const refused = [note.state(), range.state(), line.state()].some(
      (state) => state.phase === 'blocked' && state.block === 'denied',
    )
    if (listening) count('native_onboarding_mic_granted')
    else if (refused) count('native_onboarding_mic_denied')
  })
  // Keep's choices, on the onboarding's beat 7 only: not Keep from the
  // Cloud offer's free account.
  onCleanup(
    onKeepChoice((choice) => {
      if (headed === 'keep') count(KEEP_CHOICE_EVENT[choice])
    }),
  )

  /** The beat on screen's controller: Merc's state and voice are its. */
  const active = () => {
    switch (beat()) {
      case 'range':
        return range
      case 'reveal':
      case 'keep':
        return reveal
      case 'line':
      case 'offer':
        return line
      default:
        return note
    }
  }

  /** Merc's line on the beat on screen, for its bubble and the live region.
   *  None under Keep or the Cloud offer: the sheet says it. */
  const said = (): string | null => {
    // Not now's asks are out: the beats behind it went back to their start,
    // and their asks must not be read out again over the way out.
    if (deciding()) return null
    switch (beat()) {
      case 'keep':
      case 'offer':
        return null
      case 'line':
        return lineSaysText(line)
      default:
        break
    }
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

  /** The layer's name: under Not now's offer, the beat it was said on. */
  const title = (): string => {
    const now = beat()
    const named = now === 'offer' ? (leftFrom() ?? 'line') : now
    switch (named) {
      case 'range':
        return ONBOARDING_COPY.rangeTitle
      case 'reveal':
        return ONBOARDING_COPY.revealTitle
      case 'keep':
        return revealed() === null
          ? ONBOARDING_COPY.title
          : ONBOARDING_COPY.revealTitle
      case 'line':
      case 'offer':
        return ONBOARDING_COPY.lineTitle
      default:
        return ONBOARDING_COPY.title
    }
  }

  /** Keep or the Cloud offer is up over the layer: its Not now stands aside. */
  const underSheet = (): boolean => beat() === 'keep' || beat() === 'offer'

  // One Merc for every beat: made once here, and placed by each beat.
  const merc = (
    <MercView
      state={() => active().mercState()}
      voice={() => active().mercVoice()}
      still={() => active().still()}
      rings={false}
      class={`${styles.mercView} ${MERC_CLASS}`}
      testId="onboarding-merc"
    />
  )
  const mercEl = (): HTMLElement | undefined =>
    merc instanceof HTMLElement ? merc : undefined
  const swaps = createBeatSwap({
    layer: () => root,
    beat: beatOnScreen,
    merc: mercEl,
    reduced: prefersReducedMotion,
    done: (how) => setSwapped(how),
  })
  onCleanup(() => {
    swaps.dispose()
    // A layer gone with the offer still up takes its Merc back from it.
    if (cloudOfferGuest() === merc) setCloudOfferGuest(null)
  })

  // Into the dialog, for a screen reader; nothing is drawn for it.
  onMount(() => {
    root?.focus({ preventScroll: true })
    if (untrack(beat) === 'first-note') {
      count('native_onboarding_first_note_view')
    }
  })

  // The button a beat was left by goes with its beat, and focus would fall to
  // the page behind the dialog. Back into the dialog, whose name says the
  // beat now showing. Not under Keep or the Cloud offer: a sheet takes focus
  // itself.
  createEffect(
    on(
      beat,
      (now) => {
        if (now === 'keep' || now === 'offer') return
        queueMicrotask(() => {
          const active = document.activeElement
          if (
            root === undefined ||
            (active !== null && root.contains(active))
          ) {
            return
          }
          root.focus({ preventScroll: true })
        })
      },
      { defer: true },
    ),
  )

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
      data-swap={swapped()}
    >
      {/* Under Keep or the Cloud offer, the sheet's own Not now is the way
          out: this one stands aside, in place, so nothing moves when the
          sheet has gone. */}
      <div
        class={styles.top}
        classList={{ [styles.away]: underSheet() }}
        inert={underSheet()}
      >
        <button
          type="button"
          class={styles.notNow}
          onClick={notNow}
          aria-busy={deciding() ? 'true' : undefined}
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
      {/* Out of reach while Not now's asks are out: the mic stays shut. */}
      <div
        ref={beats}
        class={styles.beats}
        inert={deciding()}
        data-testid="onboarding-beats"
      >
        <Switch>
          <Match when={beat() === 'first-note'}>
            <FirstNoteView
              controller={note}
              line={said()}
              onRange={findRange}
              onSkip={skip}
              onSeeSaved={seeSaved}
              onWithoutMic={withoutMic}
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
              onWithoutMic={withoutMic}
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
          <Match when={beat() === 'line'}>
            <LineView
              controller={line}
              line={said()}
              onContinue={continueLine}
              continuing={continuing()}
              onWithoutMic={withoutMic}
              merc={merc}
            />
          </Match>
          <Match when={beat() === 'offer'}>
            <KeepView testId="onboarding-offer" />
          </Match>
        </Switch>
      </div>
    </div>
  )
}
