// ============================================================
// Beat 5 — Twin
// ============================================================
//
// The payoff: your range, your steadiness, your ear, and the legend
// your voice overlaps with. This is the moment the flow has been
// earning, and it is also what Phase 3's account offer asks you to
// keep — so the numbers shown here are exactly the ones a voiceprint
// record will store.
//
// The twin is a playful overlap, never a verdict. When the range task
// produced nothing to match against, the beat says so rather than
// inventing a celebrity.

import type { Component } from 'solid-js'
import { createMemo, createSignal, Show } from 'solid-js'
import { IconCheck } from '@/features/mirror/icons'
import { LegendCaricature } from '@/features/mirror/LegendCaricature'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import { TWIN_NEXT, TWIN_NEXT_PLAN } from '../copy'
import styles from '../onboarding.module.css'
import { TwinStatCard } from './TwinStatCard'

export interface BeatTwinProps {
  /** Share the freshly made voiceprint card (twin + numbers). May resolve to
   *  a line worth saying afterwards — on a desktop there is no share sheet,
   *  so the card is saved and its link copied, and nothing on screen would
   *  otherwise say the link is sitting on the clipboard. */
  onShare?: () => Promise<string | null>
  result: MirrorResult
  /** The singer's glides as one line, for the stat card's ridge. */
  strip?: readonly number[] | null
  /**
   * True while the person's plan is due: the four questions come before the
   * Map, and the line under the card says so.
   */
  planDue?: boolean
  onContinue: () => void
}

export const BeatTwin: Component<BeatTwinProps> = (props) => {
  const twin = createMemo(() => singerForRange(props.result.range))
  const [shareNote, setShareNote] = createSignal<string | null>(null)

  let noteRef: HTMLParagraphElement | undefined

  const share = async (): Promise<void> => {
    setShareNote((await props.onShare?.()) ?? null)
    // On a phone the buttons are pinned to the bottom of the frame and the
    // note lands under them, so a beat that fitted the screen now runs past
    // it: bring the note into view. (jsdom has no scrollIntoView.)
    noteRef?.scrollIntoView?.({ block: 'nearest' })
  }

  return (
    <div class={`${styles.beat} ${styles.twinBeat}`} data-beat="twin">
      <Show
        when={twin() !== null}
        fallback={
          <>
            <p class={styles.eyebrow}>Your voiceprint</p>
            <h1 class={styles.headline}>Here's what Merc heard</h1>
            <p class={styles.sub}>
              Merc couldn't get a clean read on your range this time, so there's
              no twin to show yet. The Map still works, and you can retake this
              whenever you like.
            </p>
          </>
        }
      >
        {/* An 88-320 px box that shrinks with the screen's height: `mid`
            (360 px) stays within 4x of the device pixels either way, since
            a phone short enough for 88 px draws at 2x or more. The master
            (928 px) would be 5x at 180 px on a 1x screen. */}
        <span class={styles.twinArt} aria-hidden="true">
          <LegendCaricature legend={twin() ?? ''} tier="mid" />
        </span>
        <p class={`${styles.eyebrow} ${styles.twinEyebrow}`}>Your twin</p>
        <h1 class={styles.headline}>
          Your range overlaps <span class={styles.lit}>{twin()}</span>
        </h1>
        <p class={styles.sub}>
          A playful overlap, not a verdict: it's about where your voice sits,
          not how it sounds.
        </p>
      </Show>

      <TwinStatCard result={props.result} strip={props.strip ?? null} />

      <p class={styles.mapExplainer}>
        {props.planDue === true ? TWIN_NEXT_PLAN : TWIN_NEXT}
      </p>
      <div class={styles.actions}>
        {/* Share first: Continue sits on the right, under the thumb on a
            phone (owner testing, 11 Oct 2026), and Tab meets the two in
            the order the eye does. */}
        <Show when={props.onShare !== undefined}>
          <button
            type="button"
            class={styles.secondary}
            onClick={() => void share()}
          >
            Share now
          </button>
        </Show>
        {/* Not "See my map": this advances to `keep`, and the Map is
            further on. Promising the Map and then showing an account offer
            that repeats the portrait is what made the two screens read as
            one screen twice. `keep` is also skippable
            (isBeatApplicable: state.hasVoiceprint), and the four questions
            come between it and the Map while the plan is due, so the label
            has to be true whichever comes next. The pull lives in the
            paragraph above, which names the stop after the offer (the plan
            while it is due, the Map after it) without the button having to
            lie about the order. */}
        <button
          type="button"
          class={styles.primary}
          onClick={() => props.onContinue()}
        >
          Continue
        </button>
      </div>
      {/* In the tree before there is anything to say, or the line is never
          announced -- and a link reaching the clipboard is silent. */}
      <span class={styles.spoken} role="status" aria-live="polite">
        {shareNote() ?? ''}
      </span>
      <Show when={shareNote()}>
        <p ref={noteRef} class={styles.shareNote} aria-hidden="true">
          <IconCheck size={17} />
          <span>{shareNote()}</span>
        </p>
      </Show>
    </div>
  )
}

export default BeatTwin
