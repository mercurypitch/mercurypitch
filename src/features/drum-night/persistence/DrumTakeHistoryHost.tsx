// ============================================================
// Drum Take History host — lazy scalar-summary projection
// ============================================================
//
// Take labels and history rows are assembled only when a Coach history surface
// opens, keeping persistence presentation outside Drum Night's first paint.

import type { JSX } from 'solid-js'
import { createMemo } from 'solid-js'
import { FIRST_POCKET_VARIANTS } from '../session'
import type { DrumTakeHistoryProps, DrumTakeHistoryView, DrumTakeSummaryRow, } from './drum-persistence-ui'
import type { DrumTakeHistoryController } from './drum-take-history-controller'
import type { DrumTakeSummary } from './drum-take-summary'
import { DrumTakeHistory } from './DrumTakeHistory'

export interface DrumTakeHistoryHostProps extends Omit<
  DrumTakeHistoryProps,
  'view'
> {
  readonly controller: DrumTakeHistoryController | null
  readonly capturedHitCount: number
  readonly eligible: boolean
  readonly unavailableReason?: string
  readonly preparing: boolean
  readonly replay: DrumTakeHistoryView['replay']
}

function countedBeat(beat: number): number {
  const bounded = Math.max(0, Number.isFinite(beat) ? beat : 0)
  return Math.round((bounded + 1) * 100) / 100
}

/** A stored range ends exclusively; musicians count the last covered beat. */
export function countedRangeLabel(startBeat: number, endBeat: number): string {
  const first = countedBeat(startBeat)
  const bounded = Math.max(0, Number.isFinite(endBeat) ? endBeat : 0)
  const last = Math.max(first, Math.round(bounded * 100) / 100)
  return `Beats ${first}–${last}`
}

function variantLabel(variationId: DrumTakeSummary['variationId']): string {
  return (
    FIRST_POCKET_VARIANTS.find((variant) => variant.id === variationId)
      ?.label ?? 'First Pocket'
  )
}

function timingLabel(summary: DrumTakeSummary): string {
  if (summary.meanTimingOffsetMs === null) return 'Timing not measured'
  const offset = Math.round(summary.meanTimingOffsetMs)
  if (Math.abs(offset) <= summary.evidencePolicy.centredWindowMs) {
    return 'Centred'
  }
  return offset < 0 ? 'Early' : 'Late'
}

function inputLabel(summary: DrumTakeSummary): string {
  if (summary.inputSources.length === 0) return 'Omitted evidence only'
  return summary.inputSources
    .map((source) =>
      source === 'midi' ? 'MIDI' : source === 'touch' ? 'Touch' : 'Keyboard',
    )
    .join(' + ')
}

export function DrumTakeHistoryHost(
  props: DrumTakeHistoryHostProps,
): JSX.Element {
  const view = createMemo<DrumTakeHistoryView>(() => {
    const history = props.controller?.historyState() ?? {
      kind: 'idle' as const,
    }
    const historyView: DrumTakeHistoryView['history'] =
      history.kind === 'ready'
        ? {
            kind: 'ready',
            takes: history.summaries.map(
              (summary): DrumTakeSummaryRow => ({
                id: summary.id,
                finishedAt: Date.parse(summary.completedAt),
                sourceLabel: 'First Pocket',
                variationLabel: variantLabel(summary.variationId),
                rangeLabel: countedRangeLabel(
                  summary.startBeat,
                  summary.endBeat,
                ),
                matchedHitCount: summary.matchedHitCount,
                targetHitCount: summary.targetHitCount,
                meanTimingOffsetMs: summary.meanTimingOffsetMs,
                timingLabel: timingLabel(summary),
                centredCount: summary.centredCount,
                earlyCount: summary.earlyCount,
                lateCount: summary.lateCount,
                meanVelocityOffset: summary.meanVelocityOffset,
                inputLabel: inputLabel(summary),
              }),
            ),
            skippedCount: history.skippedRecords,
            futureCount: history.futureRecords,
          }
        : history.kind === 'error'
          ? { kind: 'error', message: history.message }
          : { kind: history.kind }

    return {
      capturedHitCount: props.capturedHitCount,
      canFinish: props.eligible,
      ...(props.eligible || props.unavailableReason === undefined
        ? {}
        : { unavailableReason: props.unavailableReason }),
      finish: props.preparing
        ? { kind: 'saving' }
        : (props.controller?.finishState() ?? { kind: 'idle' }),
      replay: props.replay,
      history: historyView,
    }
  })

  return (
    <DrumTakeHistory
      mode={props.mode}
      view={view()}
      onFinishTake={props.onFinishTake}
      onRetryFinish={props.onRetryFinish}
      onDiscardFailedTake={props.onDiscardFailedTake}
      onKeepReplay={props.onKeepReplay}
      onDismissReplay={props.onDismissReplay}
      onLoadHistory={props.onLoadHistory}
      onRetryHistory={props.onRetryHistory}
    />
  )
}
