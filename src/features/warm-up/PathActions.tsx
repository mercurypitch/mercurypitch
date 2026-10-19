// ============================================================
// The Warm-up path's buttons: Start, the card, Skip and Next, the end
// ============================================================
//
// The bottom of the path (DESIGN-warm-up.md §5 and Codex's frames), one
// set per state:
//
//   start     Start warm-up
//   between   the card ("Lip roll: 86% lit", Again at its right end), and
//             under it Skip and "Next: Ng slides", which counts down
//             (pw-next) with a pause beside it: Stay here
//   resume    "Next: Long note"
//   end       Done and Sing a song
//   done      Warm up again and Sing a song
//   locked    Warm up with Premium, with a padlock (N3; no build locks it)
//
// Skip names its stop for a screen reader ("Skip Ng slides"); Again and
// Skip arrive 2.5 s after the card (§5.6), so the result is read first.

import type { JSX } from 'solid-js'
import { Match, Show, Switch } from 'solid-js'
import { CheckSmall, Lock, Pause } from '@/components/icons'
import type { PathView } from './path-view'
import { nextLabel, PATH_WORDS } from './path-view'
import styles from './WarmUpPath.module.css'

export interface PathActionsProps {
  view: PathView
  /** The card has risen. */
  card: boolean
  /** Again, Skip and Next show. */
  actions: boolean
  /** The countdown runs from this many seconds; null when it does not. */
  counting: number | null
  /** Start, Next, or the countdown's end: open the next stop. */
  onNext: () => void
  onAgain: (index: number) => void
  onSkip: () => void
  onStay: () => void
  onDone: () => void
  onSong: () => void
  onWarmUpAgain: () => void
  onPremium?: () => void
}

/** The next stop's name, for Next and Skip. */
function nextName(view: PathView): string {
  return view.next === null ? '' : (view.stops[view.next]?.name ?? '')
}

function Primary(props: {
  label: string
  testId: string
  onClick: () => void
  children?: JSX.Element
}): JSX.Element {
  return (
    <button
      type="button"
      class={styles.primary}
      onClick={() => props.onClick()}
      data-testid={props.testId}
    >
      {props.children}
      <span class={styles.buttonText}>{props.label}</span>
    </button>
  )
}

function Secondary(props: {
  label: string
  testId: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      class={styles.secondary}
      onClick={() => props.onClick()}
      data-testid={props.testId}
    >
      {props.label}
    </button>
  )
}

/** The card about the stop just finished or skipped, and Again. */
function Card(props: PathActionsProps): JSX.Element {
  return (
    <Show when={props.card ? props.view.card : null}>
      {(card) => (
        <div class={styles.card} data-testid="warm-up-card">
          <Show
            when={card().again !== null}
            fallback={<span class={styles.skippedMark} aria-hidden="true" />}
          >
            <span class={styles.check} aria-hidden="true">
              <CheckSmall size={18} />
            </span>
          </Show>
          <span class={styles.cardLine}>{card().line}</span>
          {/* Not `when={card().again}`: the first stop's index is 0. */}
          <Show when={props.actions && card().again !== null}>
            <button
              type="button"
              class={styles.again}
              onClick={() => {
                const again = card().again
                if (again !== null) props.onAgain(again)
              }}
              data-testid="warm-up-again"
            >
              {PATH_WORDS.again}
            </button>
          </Show>
        </div>
      )}
    </Show>
  )
}

/** Skip and Next under the card, and the countdown's pause. */
function NextRow(props: PathActionsProps): JSX.Element {
  return (
    <Show when={props.actions && props.view.next !== null}>
      <div class={styles.row}>
        <button
          type="button"
          class={`${styles.secondary} ${styles.skip}`}
          onClick={() => props.onSkip()}
          aria-label={`${PATH_WORDS.skip} ${nextName(props.view)}`}
          data-testid="warm-up-skip"
        >
          {PATH_WORDS.skip}
        </button>
        <button
          type="button"
          class={styles.primary}
          onClick={() => props.onNext()}
          data-countdown-go=""
          data-testid="warm-up-next"
        >
          <span class={styles.buttonText}>
            {nextLabel(nextName(props.view))}
          </span>
          {/* It drains rather than fills: a shrinking thing reads as a
              deadline (RoutineRibbon.tsx). */}
          <Show when={props.counting}>
            {(seconds) => (
              <span
                class={styles.drain}
                style={{ 'animation-duration': `${seconds()}s` }}
                aria-hidden="true"
                data-testid="warm-up-countdown"
              />
            )}
          </Show>
        </button>
        <Show when={props.counting !== null}>
          <button
            type="button"
            class={styles.stay}
            onClick={() => props.onStay()}
            aria-label={PATH_WORDS.stay}
            data-testid="warm-up-stay"
          >
            <Pause />
          </button>
        </Show>
      </div>
    </Show>
  )
}

/** Two side by side: an outlined way out and the filled way on. */
function Pair(props: {
  outlined: { label: string; testId: string; onClick: () => void }
  filled: { label: string; testId: string; onClick: () => void }
}): JSX.Element {
  return (
    <div class={styles.row}>
      <Secondary {...props.outlined} />
      <Primary {...props.filled} />
    </div>
  )
}

export function PathActions(props: PathActionsProps): JSX.Element {
  const sing = (): { label: string; testId: string; onClick: () => void } => ({
    label: PATH_WORDS.sing,
    testId: 'warm-up-sing',
    onClick: () => props.onSong(),
  })
  return (
    <Switch>
      <Match when={props.view.state === 'start'}>
        <Primary
          label={PATH_WORDS.start}
          testId="warm-up-start"
          onClick={() => props.onNext()}
        />
      </Match>
      <Match when={props.view.state === 'locked'}>
        <Primary
          label={PATH_WORDS.premium}
          testId="warm-up-premium"
          onClick={() => props.onPremium?.()}
        >
          <Lock size={18} />
        </Primary>
      </Match>
      <Match when={props.view.state === 'resume'}>
        <Primary
          label={nextLabel(nextName(props.view))}
          testId="warm-up-next"
          onClick={() => props.onNext()}
        />
      </Match>
      <Match when={props.view.state === 'between'}>
        <Card {...props} />
        <NextRow {...props} />
      </Match>
      <Match when={props.view.state === 'end'}>
        <Pair
          outlined={{
            label: PATH_WORDS.done,
            testId: 'warm-up-done',
            onClick: () => props.onDone(),
          }}
          filled={sing()}
        />
      </Match>
      <Match when={props.view.state === 'done'}>
        <Pair
          outlined={{
            label: PATH_WORDS.warmUpAgain,
            testId: 'warm-up-again-run',
            onClick: () => props.onWarmUpAgain(),
          }}
          filled={sing()}
        />
      </Match>
    </Switch>
  )
}
