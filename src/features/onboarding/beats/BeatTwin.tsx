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
import { TWIN_NEXT } from '../copy'
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
  onContinue: () => void
}

export const BeatTwin: Component<BeatTwinProps> = (props) => {
  const twin = createMemo(() => singerForRange(props.result.range))
  const [shareNote, setShareNote] = createSignal<string | null>(null)

  const share = async (): Promise<void> => {
    setShareNote((await props.onShare?.()) ?? null)
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
        {/* 200-320px box: `mid` (360px) lands inside 4x either way, where
            the master was already at 4.6x on the small end. */}
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

      <p class={styles.mapExplainer}>{TWIN_NEXT}</p>
      <div class={styles.actions}>
        {/* Not "See my map": this advances to `keep`, and the Map is one
            screen further on. Promising the Map and then showing an
            account offer that repeats the portrait is what made the two
            screens read as one screen twice. `keep` is also skippable
            (isBeatApplicable: state.hasVoiceprint), so the label has to be
            true whether the next thing is the offer or the Map itself —
            the pull lives in the paragraph above, which sells the Map
            without the button having to lie about the order. */}
        <button
          type="button"
          class={styles.primary}
          onClick={() => props.onContinue()}
        >
          Continue
        </button>
        <Show when={props.onShare !== undefined}>
          <button
            type="button"
            class={styles.secondary}
            onClick={() => void share()}
          >
            Share now
          </button>
        </Show>
      </div>
      {/* In the tree before there is anything to say, or the line is never
          announced -- and a link reaching the clipboard is silent. */}
      <span class={styles.spoken} role="status" aria-live="polite">
        {shareNote() ?? ''}
      </span>
      <Show when={shareNote()}>
        <p class={styles.shareNote} aria-hidden="true">
          <IconCheck size={17} />
          <span>{shareNote()}</span>
        </p>
      </Show>
    </div>
  )
}

export default BeatTwin
