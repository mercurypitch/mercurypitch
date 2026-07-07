// ============================================================
// UVR Processing Control
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import { openSettingsSection } from '@/stores/ui-store'
import type { UvrStatus } from '@/types/uvr'
import { CheckCircle, Cpu, FilePlus, Loader2, Music, RotateCcw, Server, Settings, Trash2, XCircle, Zap, } from './icons'

/** Billing/auth failures get a shortcut button in the error card — the
 *  toast with the same action disappears after a few seconds, but the
 *  failed-session card stays on screen. */
function errorActionFor(
  error: string | undefined,
): { label: string; onClick: () => void } | null {
  if (error === undefined) return null
  if (error.includes('Not enough credits')) {
    return {
      label: 'Get credits',
      onClick: () => openSettingsSection('credits'),
    }
  }
  if (error.includes('Sign in to use cloud')) {
    return { label: 'Sign in', onClick: () => openSettingsSection('account') }
  }
  return null
}

interface ProcessControlProps {
  sessionId: string
  apiSessionId?: string
  status: UvrStatus
  progress: number
  indeterminate?: boolean
  processingTime?: number
  error?: string
  outputs?: {
    vocal?: string
    instrumental?: string
    vocalMidi?: string
    instrumentalMidi?: string
  }
  processingMode?: 'server' | 'local'
  numChunks?: number
  provider?: string
  originalFileName?: string
  onCancel?: () => void
  onRetry?: () => void
  onNewSession?: () => void
  onDeleteAndNew?: () => void
  onViewResults?: () => void
  /** Re-attach to an already-paid server job and re-fetch its stems (no new
   *  charge). Passed only for server sessions whose RunPod id we still hold, so
   *  a lost/backgrounded job can be recovered instead of re-run. */
  onFetchStems?: () => void
  phase?: 'queued' | 'processing'
}

export const UvrProcessControl: Component<ProcessControlProps> = (props) => {
  const errorAction = createMemo(() => errorActionFor(props.error))

  /** Honest copy for the indeterminate bar. 'Estimating...' hid the two
   *  real situations users kept hitting: the job waiting for a GPU worker
   *  (cold start / image pull after a release — can take minutes) and a
   *  song simply running past its estimate. */
  const waitingMessage = (): string => {
    if (props.phase === 'queued') {
      return "Warming up the server — the first song can take a minute. You can switch away; we'll fetch your stems automatically when it's done."
    }
    return 'Taking a little longer than estimated — still separating'
  }

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatPercentage = (percent: number): string => {
    return `${Math.round(percent)}%`
  }

  const isLocal = (): boolean => props.processingMode === 'local'

  // Continuous elapsed-time display while processing.
  // The pipeline only sends progress at chunk boundaries (~5s on CPU)
  // so the visible time would freeze between chunks without this timer.
  const [tick, setTick] = createSignal(0)
  let timer: ReturnType<typeof setInterval> | null = null

  createEffect(() => {
    if (props.status === 'processing') {
      timer = setInterval(() => setTick((t) => t + 1), 200)
    } else {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      setTick(0)
    }
    onCleanup(() => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    })
  })

  const displayTime = createMemo(() => {
    if (props.status !== 'processing') return 0
    const local = tick() * 200
    return Math.max(props.processingTime ?? 0, local)
  })

  const estimatedRemaining = createMemo(() => {
    if (props.progress <= 0 || (props.indeterminate ?? false)) return 0
    return Math.max(
      0,
      (displayTime() * (100 - props.progress)) / props.progress,
    )
  })

  const currentChunk = createMemo(() =>
    Math.max(
      1,
      Math.min(
        props.numChunks ?? 1,
        Math.ceil((props.progress / 100) * (props.numChunks ?? 1)),
      ),
    ),
  )

  const getProcessStage = () => {
    switch (props.status) {
      case 'processing':
        return {
          icon: <Loader2 />,
          title: (
            <span
              style={{
                display: 'flex',
                'align-items': 'center',
                'flex-wrap': 'wrap',
              }}
            >
              <span>Separating</span>
              <span
                class="process-filename-pill"
                title={props.originalFileName ?? 'audio'}
              >
                {props.originalFileName ?? 'audio'}
              </span>
              <span>into stems</span>
            </span>
          ),
          description: '',
          color: 'var(--accent)',
        }
      case 'completed':
        return {
          icon: <CheckCircle />,
          title: 'Processing Complete',
          description: 'Stems generated successfully',
          color: 'var(--success)',
        }
      case 'error':
        return {
          icon: <XCircle />,
          title: 'Processing Failed',
          description:
            (props.error ?? '').length > 0
              ? props.error
              : 'Unknown error occurred',
          color: 'var(--error)',
        }
      case 'uploading':
        return {
          icon: <Loader2 />,
          title: 'Uploading file...',
          description: 'Preparing to process',
          color: 'var(--accent)',
        }
      case 'finalizing':
        return {
          icon: <Loader2 />,
          title: 'Saving stems...',
          description: 'Almost done',
          color: 'var(--accent)',
        }
      case 'interrupted':
        return {
          icon: <XCircle />,
          title: 'Separation interrupted',
          description:
            (props.error ?? '').length > 0
              ? props.error
              : 'The app was reloaded while this was processing.',
          color: 'var(--error)',
        }
      case 'idle':
      default:
        return {
          icon: <Loader2 />,
          title: 'Waiting to start',
          description: 'Ready to process',
          color: 'var(--fg-tertiary)',
        }
    }
  }

  const currentStage = createMemo(() => getProcessStage())
  const displayId = createMemo(() => props.apiSessionId ?? props.sessionId)

  return (
    <div class="uvr-process-control">
      {/* Status Header */}
      <div class="process-header">
        <div
          class="process-icon-wrapper"
          style={{ color: currentStage().color }}
        >
          <Show when={props.status === 'processing'}>
            <div class="pulse-spinner" />
          </Show>
          <Show when={props.status !== 'processing'}>
            {currentStage().icon}
          </Show>
        </div>
        <div class="process-info">
          <h3>{currentStage().title}</h3>
          <Show when={currentStage().description}>
            <p>{currentStage().description}</p>
          </Show>
          <div class="process-meta-info">
            <Show when={props.processingMode}>
              <div class="status-provider">
                {props.processingMode === 'server' ? 'Server' : 'Browser'}
              </div>
            </Show>
            <Show when={props.processingMode === 'server' || props.provider}>
              <div class="status-provider">
                <span
                  class="provider-icon"
                  classList={{ 'provider-gpu': props.provider === 'webgpu' }}
                >
                  {props.processingMode === 'server' ? (
                    <Server />
                  ) : props.provider === 'webgpu' ? (
                    <Zap />
                  ) : (
                    <Cpu />
                  )}
                </span>
                {props.processingMode === 'server'
                  ? 'Cloud Server'
                  : props.provider === 'webgpu'
                    ? 'GPU (WebGPU)'
                    : 'CPU (WASM)'}
              </div>
            </Show>
            <p class="process-session-id" title={displayId()}>
              {displayId().length > 16 ? displayId().slice(-8) : displayId()}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <Show when={props.status === 'processing'}>
        <div class="progress-section">
          <div class="progress-bar-container">
            <div
              class="progress-bar-fill"
              classList={{
                'progress-bar-indeterminate': props.indeterminate ?? false,
              }}
              style={{
                width:
                  (props.indeterminate ?? false)
                    ? '100%'
                    : formatPercentage(props.progress),
                '--progress-color': currentStage().color,
              }}
            />
          </div>
          <Show
            when={props.indeterminate ?? false}
            fallback={
              <div class="progress-row">
                <span class="progress-pct">
                  {formatPercentage(props.progress)}
                </span>
                <span class="progress-times">
                  <span>{formatTime(displayTime())}</span>
                  <span class="progress-sep">/</span>
                  <span class="progress-estimate">
                    ~{formatTime(estimatedRemaining())}
                  </span>
                </span>
                <Show when={isLocal() && (props.numChunks ?? 0) > 1}>
                  <span class="progress-chunks">
                    Chunk {currentChunk()} of {props.numChunks}
                  </span>
                </Show>
              </div>
            }
          >
            <div class="progress-text" data-testid="uvr-progress-text">
              {waitingMessage()}
            </div>
          </Show>
        </div>
      </Show>

      {/* Stage Indicators */}
      <Show when={props.status === 'completed' && props.outputs}>
        <div class="stage-indicators">
          <For
            each={[
              { label: 'Original File', icon: Music, active: true },
              {
                label: 'Vocal Stem',
                icon: Music,
                active: props.outputs?.vocal !== undefined,
              },
              {
                label: 'Instrumental',
                icon: Settings,
                active: props.outputs?.instrumental !== undefined,
              },
              {
                label: 'Vocal MIDI',
                icon: Settings,
                active: props.outputs?.vocalMidi !== undefined,
              },
            ]}
          >
            {(stage) => (
              <div class={`stage-item ${stage.active ? 'active' : ''}`}>
                <span class="stage-icon">{stage.icon({})}</span>
                <span class="stage-label">{stage.label}</span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Error Message */}
      <Show when={props.status === 'error'}>
        <div class="error-section">
          <p class="error-text">{props.error}</p>
          <Show when={errorAction()}>
            {(action) => (
              <button
                class="process-btn process-btn-primary error-action-btn"
                onClick={() => action().onClick()}
                data-testid="uvr-error-action"
              >
                {action().label}
              </button>
            )}
          </Show>
        </div>
      </Show>

      {/* Action Buttons */}
      <div class="process-actions">
        <Show when={props.status === 'processing'}>
          <button
            class="process-btn process-btn-danger"
            title={
              props.processingMode === 'server' && props.phase !== 'queued'
                ? 'Stops the job. A song already separating on the GPU still uses its credit; a queued one is refunded.'
                : undefined
            }
            onClick={() => props.onCancel?.()}
          >
            Cancel
          </button>
        </Show>
        <Show when={props.status === 'error' || props.status === 'interrupted'}>
          <Show when={props.onFetchStems}>
            <button
              class="process-btn process-btn-primary"
              onClick={() => props.onFetchStems?.()}
              title="Re-fetch the stems from your already-paid job — no new charge."
            >
              <RotateCcw /> Fetch my stems
            </button>
          </Show>
          <button
            class="process-btn-icon process-btn-retry"
            onClick={() => props.onRetry?.()}
          >
            <span class="process-btn-icon-svg">
              <RotateCcw />
            </span>
            <span class="process-btn-icon-label">
              {props.processingMode === 'server' ? 'Separate again' : 'Retry'}
            </span>
          </button>
          <button
            class="process-btn-icon process-btn-new"
            onClick={() => props.onNewSession?.()}
          >
            <span class="process-btn-icon-svg">
              <FilePlus />
            </span>
            <span class="process-btn-icon-label">New Session</span>
          </button>
          <button
            class="process-btn-icon process-btn-delete"
            onClick={() => props.onDeleteAndNew?.()}
          >
            <span class="process-btn-icon-svg">
              <Trash2 />
            </span>
            <span class="process-btn-icon-label">Delete & New</span>
          </button>
        </Show>
        <Show when={props.status === 'completed'}>
          <button
            class="process-btn process-btn-primary"
            onClick={() => props.onViewResults?.()}
            data-testid="uvr-view-results"
          >
            <CheckCircle /> View results
          </button>
        </Show>
      </div>
    </div>
  )
}
