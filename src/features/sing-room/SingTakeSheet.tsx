// ============================================================
// Your take — the end card (screen 16)
// ============================================================
//
// Four counts, the same four as one sentence, one line against the last take
// that was kept, and two answers. Never a composite total, never a verdict:
// this is a take, not a score.
//
// KEEP IS THE ONLY THING THAT WRITES. Discard does not write a smaller
// record, it writes nothing at all — which is what makes the footer's
// promise checkable rather than a claim. There is no audio in either path;
// the room never recorded any.
//
// DISMISSING IS KEEPING, NOT DISCARDING. Dragging the sheet away, pressing
// Back, leaving the room — none of those is somebody choosing to throw a take
// away, and the thing at stake is four numbers and two timestamps that never
// leave the phone. Discard is a button you have to mean.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import type { SingTake } from '@/stores/sing-takes-store'
import styles from './sing-room.module.css'
import type { TakeSummary } from './take-summary'
import { formatCentsValue, formatRange, formatTakeCount, formatTakeDate, formatTakeDuration, takeSentence, } from './take-summary'

/** `Against your own history: …`, or null before a first kept take. */
export function historyLine(previous: SingTake | null): string | null {
  if (previous === null) return null
  const range =
    previous.lowNote === null || previous.highNote === null
      ? null
      : `${previous.lowNote} to ${previous.highNote}`
  if (range === null) {
    return `Against your own history: on ${formatTakeDate(previous.endedAt)} you held within ${formatCentsValue(previous.heldWithinCents)}.`
  }
  return `Against your own history: on ${formatTakeDate(previous.endedAt)} you touched ${range} and held within ${formatCentsValue(previous.heldWithinCents)}.`
}

interface SingTakeSheetProps {
  isOpen: boolean
  summary: TakeSummary | null
  previous: SingTake | null
  /** Epoch ms, for the line that dates the take. */
  startedAt: number
  endedAt: number
  roomLabel: string
  onKeep: () => void
  /** Dragged away, Back, or the room being left — anything but the buttons. */
  onDismiss: () => void
  onDiscard: () => void
}

export const SingTakeSheet: Component<SingTakeSheetProps> = (props) => (
  <Sheet
    isOpen={props.isOpen}
    // Dragging it away is not a decision to throw the take away: only the
    // Discard button is. See the header.
    close={() => props.onDismiss()}
    ariaLabel="Your take"
  >
    <Show when={props.summary}>
      {(summary) => (
        <div class={styles.takeSheet} data-testid="sing-take-sheet">
          <h2 class={styles.head}>Your take</h2>
          <p class={styles.caption}>
            {`Sing · ${props.roomLabel} · ${formatTakeDate(props.endedAt)}, ${clock(props.startedAt)} to ${clock(props.endedAt)}`}
          </p>

          <div class={styles.stats}>
            <div class={styles.stat}>
              <div class={styles.statNum} data-testid="sing-stat-duration">
                {formatTakeDuration(summary().durationMs)}
              </div>
              <div class={styles.statLabel}>Duration</div>
            </div>
            <div class={styles.stat}>
              <div class={styles.statNum} data-testid="sing-stat-takes">
                {formatTakeCount(summary().takeNumber)}
              </div>
              <div class={styles.statLabel}>This session</div>
            </div>
            <div class={styles.stat}>
              <div class={styles.statNum} data-testid="sing-stat-range">
                {formatRange(summary().range)}
              </div>
              <div class={styles.statLabel}>Range touched</div>
            </div>
            <div class={styles.stat}>
              <div class={styles.statNum} data-testid="sing-stat-cents">
                {formatCentsValue(summary().heldWithinCents)}
              </div>
              <div class={styles.statLabel}>Held within</div>
            </div>
          </div>

          <p class={styles.body} data-testid="sing-take-sentence">
            {takeSentence(summary())}
          </p>

          <Show when={historyLine(props.previous)}>
            {(line) => (
              <>
                <div class={styles.spectrumRule} />
                <p class={styles.caption} data-testid="sing-take-history">
                  {line()}
                </p>
              </>
            )}
          </Show>

          <div class={styles.btnPair}>
            <button
              type="button"
              classList={{
                [styles.capsule]: true,
                [styles.capsuleSecondary]: true,
              }}
              onClick={() => props.onDiscard()}
              data-testid="sing-take-discard"
            >
              Discard
            </button>
            <button
              type="button"
              class={styles.capsule}
              onClick={() => props.onKeep()}
              data-testid="sing-take-keep"
            >
              Keep
            </button>
          </div>

          <p classList={{ [styles.caption]: true, [styles.center]: true }}>
            Keep stores it on this phone.
          </p>
        </div>
      )}
    </Show>
  </Sheet>
)

/** `9:38` — the two ends of the take, in the phone's own clock. */
function clock(epochMs: number): string {
  const date = new Date(epochMs)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}
