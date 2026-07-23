import type { Accessor, Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { formatFileSize } from '@/lib/audio-accept'
import type { UvrUploadQueueItem, UvrUploadQueueStatus, } from '@/lib/uvr-upload-queue'
import { isTerminalUploadQueueStatus } from '@/lib/uvr-upload-queue'
import type { UvrProcessingMode } from '@/stores/app-store'
import { CheckCircle, Clock, Cpu, Loader2, MusicNote, Trash2, X, XCircle, Zap, } from './icons'

interface UvrUploadQueueProps {
  items: Accessor<UvrUploadQueueItem[]>
  running: Accessor<boolean>
  mode: Accessor<UvrProcessingMode>
  costPerSong?: Accessor<number | undefined>
  onStart: () => void
  onRemove: (itemId: string) => void
  onCancel: () => void
  onClear: () => void
}

const statusLabel: Record<UvrUploadQueueStatus, string> = {
  queued: 'Ready',
  checking: 'Checking',
  processing: 'Separating',
  completed: 'In your library',
  skipped: 'Already in library',
  error: 'Needs attention',
  cancelled: 'Cancelled',
}

function StatusIcon(props: { status: UvrUploadQueueStatus }) {
  return (
    <span
      class={`uvr-queue-status-icon uvr-queue-status-icon--${props.status}`}
    >
      <Show
        when={props.status === 'checking' || props.status === 'processing'}
        fallback={
          <Show
            when={props.status === 'completed'}
            fallback={
              <Show
                when={props.status === 'error' || props.status === 'cancelled'}
                fallback={
                  <Show when={props.status === 'skipped'} fallback={<Clock />}>
                    <CheckCircle />
                  </Show>
                }
              >
                <XCircle />
              </Show>
            }
          >
            <CheckCircle />
          </Show>
        }
      >
        <Loader2 />
      </Show>
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
  const allFinished = () =>
    props.items().length > 0 && terminalCount() === props.items().length
  const batchCost = () => {
    if (props.mode() !== 'server') return undefined
    const cost = props.costPerSong?.()
    return cost === undefined ? undefined : cost * queuedCount()
  }
  const activeIndex = () =>
    props
      .items()
      .findIndex(
        (item) => item.status === 'checking' || item.status === 'processing',
      )
  const overallProgress = () => {
    if (props.items().length === 0) return 0
    const total = props.items().reduce((sum, item) => {
      if (
        item.status === 'completed' ||
        item.status === 'skipped' ||
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
              <Show
                when={!allFinished()}
                fallback={`${completedCount()} added to your library`}
              >
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
              </div>
              <Show when={item.status === 'queued' && !props.running()}>
                <button
                  class="uvr-queue-row-action"
                  onClick={() => props.onRemove(item.id)}
                  aria-label={`Remove ${item.file.name} from queue`}
                  title="Remove from queue"
                >
                  <X />
                </button>
              </Show>
            </li>
          )}
        </For>
      </ol>

      <div class="uvr-queue-footer">
        <div class="uvr-queue-footnote">
          <Show
            when={props.running()}
            fallback={
              <Show
                when={!allFinished()}
                fallback="Batch complete. Every successful song is ready in Recent Sessions."
              >
                Songs run one at a time. You can keep this tab in the
                background.
              </Show>
            }
          >
            <span class="uvr-queue-live-dot" aria-hidden="true" />
            {queuedCount()} still waiting
          </Show>
        </div>
        <div class="uvr-queue-actions">
          <Show when={props.running()}>
            <button
              class="uvr-queue-button uvr-queue-button--danger"
              onClick={() => props.onCancel()}
            >
              <X /> Cancel current
            </button>
          </Show>
          <Show when={!props.running() && !allFinished()}>
            <button
              class="uvr-queue-button uvr-queue-button--ghost"
              onClick={() => props.onClear()}
            >
              <Trash2 /> Clear
            </button>
            <button
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
          <Show when={!props.running() && allFinished()}>
            <button
              class="uvr-queue-button uvr-queue-button--primary"
              onClick={() => props.onClear()}
            >
              <CheckCircle /> Done
            </button>
          </Show>
        </div>
      </div>
    </section>
  )
}
