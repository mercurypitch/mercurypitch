// ============================================================
// Beat 3 — Fork
// ============================================================
//
// One screen, one button (owner decisions V2 and V8, 10-11 Oct 2026).
// The voiceprint is what a new singer came for, so after the first note
// the only button leads into it. This screen used to offer two cards of
// equal weight, "Map my whole voice" and "Take me in", and one visitor
// in seven took the second: a choice they made before they knew what the
// first one gave them. Leaving is still one tap away, but it is the
// small "Not now" at the top right of the frame (FirstLight's rail),
// never a second button beside this one.
//
// The headline asks about RANGE on purpose. The legend twin is a range
// match (`singerForRange`; legend-catalog.ts holds nothing but ranges),
// so "sings like you" would promise a comparison of tone the app never
// makes.
//
// The body's numbers are the voiceprint beat's own: four steps (glide up,
// glide down, hold, match five), 66 seconds of timed stages (37 of them
// singing) plus the four "I'm ready" gates. If BeatVoiceprint's script
// changes, this sentence changes with it.
//
// Someone who has ALREADY mapped their voice gets a different fork, with
// the same single-button shape: their voiceprints, shown at full size,
// rather than a second measurement they did not ask for.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { noteArticle } from '@/lib/note-utils'
import type { OnboardingTrack } from '../flow'
import styles from '../onboarding.module.css'

/** The first-run Fork's words, exported so tests hold the copy to them. */
export const FORK_COPY = {
  eyebrow: 'Your first note',
  headline: 'Which legend has a range like yours?',
  body: 'About 90 seconds: glide up, glide down, hold a note, then match five. You get your voiceprint and your legend twin.',
  primary: 'Find my twin',
} as const

/**
 * What beat 2 heard, in one clause, on the returning singer's fork. It
 * says "an A3", never "a A3": A, E and F are read out loud starting on a
 * vowel sound.
 */
const SangNote: Component<{ note: string | null }> = (props) => (
  <Show when={props.note !== null}>
    You sang {noteArticle(props.note ?? '')} {props.note}.{' '}
  </Show>
)

export interface BeatForkProps {
  /** The note heard at beat 2, e.g. 'G3'. Null if the mic was skipped. */
  firstNote: string | null
  /** Voiceprints already on file for this visitor. */
  savedCount: number
  /** When the newest one was taken, already formatted. Null if none. */
  savedWhen: string | null
  onChoose: (track: OnboardingTrack) => void
}

export const BeatFork: Component<BeatForkProps> = (props) => (
  <div class={styles.beat} data-beat="fork">
    <Show
      when={props.savedCount > 0}
      fallback={
        <>
          <p class={styles.eyebrow}>{FORK_COPY.eyebrow}</p>
          <h1 class={styles.headline}>{FORK_COPY.headline}</h1>
          <p class={styles.sub}>{FORK_COPY.body}</p>
          <div class={styles.actions}>
            <button
              type="button"
              class={`${styles.primary} ${styles.primaryLarge}`}
              onClick={() => props.onChoose('full')}
            >
              {FORK_COPY.primary}
            </button>
          </div>
        </>
      }
    >
      <p class={styles.eyebrow}>Welcome back</p>
      <h1 class={styles.headline}>You've already mapped your voice</h1>
      <p class={styles.sub}>
        <SangNote note={props.firstNote} />
        <Show
          when={props.savedCount === 1}
          fallback={`You have ${props.savedCount} voiceprints on file`}
        >
          Your voiceprint is on file
        </Show>
        <Show when={props.savedWhen !== null}>
          , the newest from {props.savedWhen}
        </Show>
        . Open {props.savedCount === 1 ? 'it' : 'them'} to see your twin and
        range again.
      </p>
      <div class={styles.actions}>
        <button
          type="button"
          class={`${styles.primary} ${styles.primaryLarge}`}
          onClick={() => props.onChoose('gallery')}
        >
          {props.savedCount === 1 ? 'See my voiceprint' : 'See my voiceprints'}
        </button>
      </div>
    </Show>
  </div>
)

export default BeatFork
