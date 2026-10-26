// ============================================================
// Voice Mirror — the weekly Check-up's then and now, on the results
// ============================================================
//
// After a guided run, when the voiceprint history holds a week
// (docs/specs/weekly-check-up.ears.md): Then and Now side by side, each with
// its dates, the change in each reading said only when it reaches its
// threshold, and the practice in between. It takes the place of the results'
// "since" line while it shows; without a comparison the results are as they
// always were.
//
// The rules are src/lib/check-up/then-and-now.ts's; this file reads the
// history with the take just saved in it, and draws. A chunk of its own,
// loaded once a run lands, so the Mirror's first paint carries none of it.
// The share card's renderer and Merc's still load once the panel is on
// screen, so the card is drawn before the tap: Safari only shares inside the
// tap that asked.
//
// Signed out, the readings are this browser's and the panel says so, since
// several people can sing on one (REQ-VPR-007). For a browser that has never
// met an account it ends with what an account adds, in Home's words. The
// Mirror's own ask under the share row stays as REQ-VPR-023 sets it; this line
// opens the same dialog and records no funnel event of its own.

import type { JSX } from 'solid-js'
import { createSignal, createUniqueId, For, onCleanup, onMount, Show, } from 'solid-js'
import { accountHeld } from '@/db/services/auth-service'
import { loadProgressSessionRecords } from '@/db/services/progress-session-records'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { listVoiceprints } from '@/db/services/voiceprint-service'
import type { CheckupChange, CheckupMetric, CheckupSide, ThenAndNow, } from '@/lib/check-up/then-and-now'
import { ABOUT_THE_SAME, changeWords, CHECKUP_METRICS, historyNote, practiceBetween, practiceLine, rangeNotes, sideDays, thenAndNow, } from '@/lib/check-up/then-and-now'
import { askForAccount, asksForAccount } from './account-ask'
import type { CardFormat } from './card-renderer'
import styles from './ThenAndNowPanel.module.css'

/** What the panel draws: the comparison, and the practice counted in between. */
export interface ThenAndNowView {
  comparison: ThenAndNow<VoiceprintRecord>
  practice: number
}

/**
 * The comparison with the take just saved in it, or null when the history
 * does not hold a week yet. The practice is what Progress counts: every
 * saved session of this identity (loadProgressSessionRecords), here those
 * between Then's last take and Now's first; none when that read fails.
 */
export async function readThenAndNow(
  saved: VoiceprintRecord,
): Promise<ThenAndNowView | null> {
  const history = await listVoiceprints()
  const withSaved = history.some((take) => take.takenAt === saved.takenAt)
    ? history
    : [saved, ...history]
  const comparison = thenAndNow(withSaved)
  if (comparison === null) return null
  const sessions = await loadProgressSessionRecords()
  return {
    comparison,
    practice: sessions.available
      ? practiceBetween(sessions.records, comparison.between)
      : 0,
  }
}

const METRIC_LABEL: Record<CheckupMetric, string> = {
  range: 'Range',
  accuracy: 'Accuracy',
  steadiness: 'Steadiness',
}

/** A change under its threshold keeps both values and no direction. */
function changeText(change: CheckupChange): string {
  if (change.named) return changeWords(change, { short: true })
  const unit = change.metric === 'range' ? ' semitones' : ''
  return `${ABOUT_THE_SAME}, ${change.then} and ${change.now}${unit}`
}

function Side(props: {
  label: string
  side: CheckupSide
  now: number
}): JSX.Element {
  return (
    <div class={styles.side} data-side={props.label.toLowerCase()}>
      <h3 class={styles.sideTitle}>{props.label}</h3>
      <p class={styles.days}>{sideDays(props.side, props.now)}</p>
      <dl class={styles.readings}>
        <div>
          <dt>Range</dt>
          <dd>
            {props.side.range === null
              ? 'No clean read'
              : rangeNotes(props.side.range)}
          </dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{props.side.accuracy ?? 'Not measured'}</dd>
        </div>
        <div>
          <dt>Steadiness</dt>
          <dd>{props.side.steadiness ?? 'Not measured'}</dd>
        </div>
      </dl>
    </div>
  )
}

/** What a delivery came to, in the panel's words; nothing for a closed sheet. */
function shareWords(outcome: string): string | null {
  if (outcome === 'shared') return 'Shared.'
  if (outcome === 'downloaded') return 'Saved as a picture.'
  if (outcome === 'dismissed') return null
  return "The card couldn't be made. Try again."
}

export interface ThenAndNowPanelProps {
  view: ThenAndNowView
  /** The shape the Mirror's card options have chosen. */
  format: CardFormat
  /** Start the guided run again, straight from here. */
  onSingAgain: () => void
  /** The clock, for a test; the wall clock otherwise. */
  now?: () => number
}

/** What the panel takes from the share card's module, which loads on its
 *  own once the panel is on screen. */
interface ThenAndNowCard {
  renderThenAndNowCard: (
    comparison: ThenAndNow,
    practice: number,
    format: CardFormat,
  ) => Promise<HTMLCanvasElement>
  shareThenAndNowCard: (
    canvas: HTMLCanvasElement,
    shouldDeliver?: () => boolean,
  ) => Promise<{ outcome: string }>
}

export function ThenAndNowPanel(props: ThenAndNowPanelProps): JSX.Element {
  const titleId = createUniqueId()
  const now = (): number => props.now?.() ?? Date.now()
  const [sharing, setSharing] = createSignal(false)
  const [status, setStatus] = createSignal<string | null>(null)
  let disposed = false
  let drawn: { format: CardFormat; canvas: Promise<HTMLCanvasElement> } | null =
    null
  const cardModule = (): Promise<ThenAndNowCard> =>
    import('@/features/progress/then-and-now-card')

  /** The card in this shape, drawn once and kept for the tap. */
  function draw(format: CardFormat): Promise<HTMLCanvasElement> {
    if (drawn === null || drawn.format !== format) {
      const { comparison, practice } = props.view
      drawn = {
        format,
        canvas: cardModule().then((card) =>
          card.renderThenAndNowCard(comparison, practice, format),
        ),
      }
    }
    return drawn.canvas
  }

  onMount(() => {
    draw(props.format).catch(() => undefined)
  })
  onCleanup(() => {
    disposed = true
  })

  async function share(): Promise<void> {
    if (sharing()) return
    const format = props.format
    setSharing(true)
    setStatus(null)
    try {
      const [card, canvas] = await Promise.all([cardModule(), draw(format)])
      const result = await card.shareThenAndNowCard(canvas, () => !disposed)
      if (!disposed) setStatus(shareWords(result.outcome))
    } catch {
      if (!disposed) setStatus(shareWords('failed'))
    } finally {
      if (!disposed) setSharing(false)
    }
  }

  const comparison = (): ThenAndNow<VoiceprintRecord> => props.view.comparison

  return (
    <section
      class={styles.panel}
      aria-labelledby={titleId}
      data-testid="mirror-then-and-now"
    >
      <p class={styles.eyebrow}>Weekly Check-up</p>
      <h2 class={styles.title} id={titleId}>
        Then and now
      </h2>

      <div class={styles.sides}>
        <Side label="Then" side={comparison().then} now={now()} />
        <Side label="Now" side={comparison().now} now={now()} />
      </div>

      <ul class={styles.changes}>
        <For each={CHECKUP_METRICS}>
          {(metric) => (
            <Show when={comparison().changes[metric]}>
              {(change) => (
                <li data-metric={metric}>
                  <span class={styles.changeLabel}>{METRIC_LABEL[metric]}</span>
                  <span class={styles.changeText}>{changeText(change())}</span>
                </li>
              )}
            </Show>
          )}
        </For>
      </ul>

      <Show when={practiceLine(props.view.practice)}>
        {(line) => <p class={styles.practice}>{line()}</p>}
      </Show>
      <Show when={historyNote(accountHeld())}>
        {(note) => <p class={styles.note}>{note()}</p>}
      </Show>

      <div class={styles.actions}>
        <button
          type="button"
          class={`mirror-cta ${styles.share}`}
          aria-disabled={sharing() ? 'true' : undefined}
          onClick={() => void share()}
        >
          Share then and now
        </button>
        <button
          type="button"
          class={`mirror-cta mirror-cta-secondary ${styles.again}`}
          onClick={() => props.onSingAgain()}
        >
          Sing it once more
        </button>
      </div>
      <p class={styles.againLine}>
        Your Check-up keeps the better of your last two takes this week.
      </p>
      <p class={styles.status} role="status">
        {status() ?? ''}
      </p>

      <Show when={asksForAccount()}>
        <p class={styles.account} data-testid="mirror-then-and-now-account">
          Your Check-ups stay in this browser. A free account keeps every one,
          on every device.{' '}
          <button
            type="button"
            class={styles.accountButton}
            onClick={() => askForAccount()}
          >
            Create a free account
          </button>
        </p>
      </Show>
    </section>
  )
}
