import type { Accessor, Component } from 'solid-js'
import { For, Match, Show, Switch } from 'solid-js'
import { formatFileSize } from '@/lib/audio-accept'
import { uvrLengthFactor } from '@/lib/uvr-api'
import type { StemSplitProgress } from '@/lib/uvr-stem-split'
import { activeStemSplits } from '@/lib/uvr-stem-split'
import type { UvrUploadQueueItem, UvrUploadQueueStatus, } from '@/lib/uvr-upload-queue'
import { isTerminalUploadQueueStatus } from '@/lib/uvr-upload-queue'
import type { UvrProcessingMode } from '@/stores/app-store'
import { CheckCircle, Clock, Cpu, Loader2, MusicNote, RotateCcw, SkipForward, Trash2, X, XCircle, Zap, } from './icons'

interface UvrUploadQueueProps {
  items: Accessor<UvrUploadQueueItem[]>
  running: Accessor<boolean>
  mode: Accessor<UvrProcessingMode>
  costPerSong?: Accessor<number | undefined>
  onStart: () => void
  /** Requeue every failed row so Process can rerun them - on whatever
   *  processing mode is selected at that moment. */
  onRetryFailed: () => void
  onRemove: (itemId: string) => void
  onSkip: (itemId: string) => void
  onSkipRemaining: () => void
  onCancel: () => void
  onClear: () => void
}

const statusLabel: Record<UvrUploadQueueStatus, string> = {
  queued: 'Ready',
  checking: 'Checking',
  processing: 'Separating',
  completed: 'In your library',
  skipped: 'Already in library',
  omitted: 'Skipped',
  error: 'Needs attention',
  cancelled: 'Cancelled',
}

/** Second step on a "Full band" card: the background part-split that keeps
 *  running after the main separation lands (drums/bass/guitar/piano). */
const splitStepLabel = (p: StemSplitProgress): string => {
  if (p.phase === 'saving') return `Saving band stems ${Math.round(p.pct)}%`
  if (p.phase === 'uploading') return 'Starting full-band split…'
  return `Separating full band ${Math.round(p.pct)}%`
}

function StatusIcon(props: { status: UvrUploadQueueStatus }) {
  return (
    <span
      class={`uvr-queue-status-icon uvr-queue-status-icon--${props.status}`}
    >
      <Switch fallback={<Clock />}>
        <Match
          when={props.status === 'checking' || props.status === 'processing'}
        >
          <Loader2 />
        </Match>
        <Match
          when={props.status === 'completed' || props.status === 'skipped'}
        >
          <CheckCircle />
        </Match>
        <Match when={props.status === 'omitted'}>
          <SkipForward />
        </Match>
        <Match when={props.status === 'error' || props.status === 'cancelled'}>
          <XCircle />
        </Match>
      </Switch>
    </span>
  )
}

export const UvrUploadQueue: Component<UvrUploadQueueProps> = (props) => {
  const queuedCount = () =>
    props.items().filter((item) => item.status === 'queued').length
  const completedCount = () =>
    props
      .items()
      .filter(
        (item) => item.status === 'completed' || item.status === 'skipped',
      ).length
  const terminalCount = () =>
    props.items().filter((item) => isTerminalUploadQueueStatus(item.status))
      .length
  const cancelledCount = () =>
    props.items().filter((item) => item.status === 'cancelled').length
  const omittedCount = () =>
    props.items().filter((item) => item.status === 'omitted').length
  const errorCount = () =>
    props.items().filter((item) => item.status === 'error').length
  const allFinished = () =>
    props.items().length > 0 && terminalCount() === props.items().length
  const finishedTitle = () => {
    if (cancelledCount() === props.items().length) return 'Processing cancelled'
    if (omittedCount() === props.items().length) return 'Queue skipped'
    const summary = [`${completedCount()} added`]
    if (omittedCount() > 0) summary.push(`${omittedCount()} skipped`)
    if (cancelledCount() > 0) summary.push(`${cancelledCount()} cancelled`)
    if (errorCount() > 0) summary.push(`${errorCount()} need attention`)
    if (summary.length > 1) return summary.join(' · ')
    return `${completedCount()} added to your library`
  }
  const finishedNote = () => {
    if (omittedCount() > 0 && cancelledCount() === 0 && errorCount() === 0) {
      return 'Stopped after the current song. Skipped songs were not processed.'
    }
    if (cancelledCount() > 0) {
      return 'Cancelled cleanly. Close this queue to choose new songs or processing options.'
    }
    if (errorCount() > 0) {
      return 'Finished with errors. Retry puts the failed songs back in line - switch the processing mode first if this one keeps failing. Successful songs are in Recent Sessions.'
    }
    return 'Batch complete. Every successful song is ready in Recent Sessions.'
  }
  const batchCost = () => {
    if (props.mode() !== 'server') return undefined
    const cost = props.costPerSong?.()
    if (cost === undefined) return undefined
    // Long songs pay per started surcharge block — sum per item so the
    // Process button quotes what will actually be debited.
    return props
      .items()
      .filter((item) => item.status === 'queued')
      .reduce(
        (sum, item) => sum + cost * uvrLengthFactor(item.durationSeconds),
        0,
      )
  }
  const activeIndex = () =>
    props
      .items()
      .findIndex(
        (item) => item.status === 'checking' || item.status === 'processing',
      )
  const hasActiveItem = () => activeIndex() >= 0
  const overallProgress = () => {
    if (props.items().length === 0) return 0
    const total = props.items().reduce((sum, item) => {
      if (
        item.status === 'completed' ||
        item.status === 'skipped' ||
        item.status === 'omitted' ||
        item.status === 'error' ||
        item.status === 'cancelled'
      )
        return sum + 100
      return sum + item.progress
    }, 0)
    return Math.round(total / props.items().length)
  }

  return (
    <section class="uvr-queue" aria-label="Upload queue">
      <div class="uvr-queue-head">
        <div class="uvr-queue-title-lockup">
          <span class="uvr-queue-mark" aria-hidden="true">
            <MusicNote />
          </span>
          <div>
            <p class="uvr-queue-kicker">Setlist queue</p>
            <h3>
              <Show when={!allFinished()} fallback={finishedTitle()}>
                {props.running()
                  ? `Track ${Math.max(1, activeIndex() + 1)} of ${props.items().length}`
                  : `${props.items().length} song${props.items().length === 1 ? '' : 's'} ready`}
              </Show>
            </h3>
          </div>
        </div>
        <span
          class={`uvr-queue-mode uvr-queue-mode--${props.mode()}`}
          title={
            props.mode() === 'server'
              ? 'Studio-quality cloud GPU separation'
              : 'On-device browser separation'
          }
        >
          {props.mode() === 'server' ? <Zap /> : <Cpu />}
          {props.mode() === 'server' ? 'Server HQ' : 'Browser'}
        </span>
      </div>

      <div class="uvr-queue-overall" aria-hidden="true">
        <span style={{ width: `${overallProgress()}%` }} />
      </div>

      <ol class="uvr-queue-list">
        <For each={props.items()}>
          {(item, index) => (
            <li
              class={`uvr-queue-item uvr-queue-item--${item.status}`}
              aria-current={
                item.status === 'checking' || item.status === 'processing'
                  ? 'step'
                  : undefined
              }
            >
              <span class="uvr-queue-number">
                {String(index() + 1).padStart(2, '0')}
              </span>
              <StatusIcon status={item.status} />
              <div class="uvr-queue-copy">
                <div class="uvr-queue-file-line">
                  <strong title={item.file.name}>{item.file.name}</strong>
                  <span>{formatFileSize(item.file.size)}</span>
                  <Show when={uvrLengthFactor(item.durationSeconds) > 1}>
                    <span
                      class="uvr-queue-long-song"
                      title="Songs past the included length pay one extra multiple of the model cost per started block"
                    >
                      {Math.round((item.durationSeconds ?? 0) / 60)} min ·{' '}
                      {uvrLengthFactor(item.durationSeconds)}× credits
                    </span>
                  </Show>
                </div>
                <div class="uvr-queue-state-line">
                  <span>{statusLabel[item.status]}</span>
                  <Show when={item.message !== undefined}>
                    <span class="uvr-queue-message">{item.message}</span>
                  </Show>
                </div>
                <Show when={item.status === 'processing'}>
                  <div class="uvr-queue-track">
                    <span style={{ width: `${Math.max(3, item.progress)}%` }} />
                  </div>
                </Show>
                <Show
                  when={
                    item.sessionId !== undefined
                      ? activeStemSplits()[item.sessionId]
                      : undefined
                  }
                  keyed
                >
                  {(split) => (
                    <>
                      <div class="uvr-queue-state-line uvr-queue-split-line">
                        <span>{splitStepLabel(split)}</span>
                      </div>
                      <div class="uvr-queue-track uvr-queue-track--split">
                        <span style={{ width: `${Math.max(3, split.pct)}%` }} />
                      </div>
                    </>
                  )}
                </Show>
              </div>
              <Show when={item.status === 'queued'}>
                <Show
                  when={props.running()}
                  fallback={
                    <button
                      type="button"
                      class="uvr-queue-row-action"
                      onClick={() => props.onRemove(item.id)}
                      aria-label={`Remove ${item.file.name} from queue`}
                      title="Remove from queue"
                    >
                      <X />
                    </button>
                  }
                >
                  <button
                    type="button"
                    class="uvr-queue-row-action uvr-queue-row-action--skip"
                    onClick={() => props.onSkip(item.id)}
                    aria-label={`Skip ${item.file.name}`}
                    title="Skip this song"
                  >
                    <SkipForward />
                    <span>Skip</span>
                  </button>
                </Show>
              </Show>
            </li>
          )}
        </For>
      </ol>

      <div class="uvr-queue-footer">
        <div class="uvr-queue-footnote">
          <Show
            when={props.running() && !allFinished()}
            fallback={
              <Show when={!allFinished()} fallback={finishedNote()}>
                Songs run one at a time. You can keep this tab in the
                background.
              </Show>
            }
          >
            <span class="uvr-queue-live-dot" aria-hidden="true" />
            <Show
              when={queuedCount() > 0}
              fallback="Finishing the current song · no songs waiting"
            >
              {queuedCount()} still waiting
            </Show>
          </Show>
        </div>
        <div class="uvr-queue-actions">
          <Show when={props.running() && hasActiveItem() && !allFinished()}>
            <Show when={queuedCount() > 0}>
              <button
                type="button"
                class="uvr-queue-button uvr-queue-button--stop"
                onClick={() => props.onSkipRemaining()}
                title="Let this song finish and skip every waiting song"
              >
                <SkipForward /> Stop after current
              </button>
            </Show>
            <button
              type="button"
              class="uvr-queue-button uvr-queue-button--danger"
              onClick={() => props.onCancel()}
              title="Cancel this song, then continue with the next waiting song"
            >
              <X /> Cancel current
            </button>
          </Show>
          <Show when={!props.running() && !allFinished()}>
            <button
              type="button"
              class="uvr-queue-button uvr-queue-button--ghost"
              onClick={() => props.onClear()}
            >
              <Trash2 /> Clear
            </button>
            <button
              type="button"
              class="uvr-queue-button uvr-queue-button--primary"
              onClick={() => props.onStart()}
              disabled={queuedCount() === 0}
            >
              {props.mode() === 'server' ? <Zap /> : <Cpu />}
              Process {queuedCount()}
              <Show when={batchCost() !== undefined}>
                {` · up to ${batchCost()} cr`}
              </Show>
            </button>
          </Show>
          <Show when={allFinished()}>
            <Show when={errorCount() > 0}>
              <button
                type="button"
                class="uvr-queue-button"
                onClick={() => props.onRetryFailed()}
                title="Put the failed songs back in the queue. Pick a different processing mode first if this one keeps failing."
              >
                <RotateCcw /> Retry {errorCount()} failed
              </button>
            </Show>
            <button
              type="button"
              class="uvr-queue-button uvr-queue-button--primary"
              onClick={() => props.onClear()}
            >
              <Show
                when={cancelledCount() > 0 || errorCount() > 0}
                fallback={
                  <>
                    <CheckCircle /> Done
                  </>
                }
              >
                <X /> Close
              </Show>
            </button>
          </Show>
        </div>
      </div>
    </section>
  )
}
