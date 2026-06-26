// ============================================================
// UVR Processing Control
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import { CheckCircle, Cpu, FilePlus, Loader2, Music, RotateCcw, Server, Settings, Trash2, XCircle, Zap, } from './icons'
import { Button } from './shared/Button'
import styles from './UvrProcessControl.module.css'

interface ProcessControlProps {
  sessionId: string
  apiSessionId?: string
  status:
    | 'idle'
    | 'uploading'
    | 'processing'
    | 'completed'
    | 'error'
    | 'cancelled'
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
}

export const UvrProcessControl: Component<ProcessControlProps> = (props) => {
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
          title: `Separating ${props.originalFileName ?? 'audio'} into stems`,
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
    <div class={styles.uvrProcessControl}>
      {/* Status Header */}
      <div class={styles.processHeader}>
        <div
          class={styles.processIconWrapper}
          style={{ color: currentStage().color }}
        >
          <Show when={props.status === 'processing'}>
            <div class={styles.pulseSpinner} />
          </Show>
          <Show when={props.status !== 'processing'}>
            {currentStage().icon}
          </Show>
        </div>
        <div class={styles.processInfo}>
          <h3>{currentStage().title}</h3>
          <Show when={currentStage().description}>
            <p>{currentStage().description}</p>
          </Show>
          <div class={styles.processMetaInfo}>
            <Show when={props.processingMode}>
              <div class={styles.statusProvider}>
                {props.processingMode === 'server' ? 'Server' : 'Browser'}
              </div>
            </Show>
            <Show when={props.processingMode === 'server' || props.provider}>
              <div class={styles.statusProvider}>
                <span
                  class={styles.providerIcon}
                  classList={{
                    [styles.providerGpu]: props.provider === 'webgpu',
                  }}
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
            <p class={styles.processSessionId} title={displayId()}>
              {displayId().length > 16 ? displayId().slice(-8) : displayId()}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <Show when={props.status === 'processing'}>
        <div class={styles.progressSection}>
          <div class={styles.progressBarContainer}>
            <div
              class={styles.progressBarFill}
              classList={{
                [styles.progressBarIndeterminate]: props.indeterminate ?? false,
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
              <div class={styles.progressRow}>
                <span class={styles.progressPct}>
                  {formatPercentage(props.progress)}
                </span>
                <span class={styles.progressTimes}>
                  <span>{formatTime(displayTime())}</span>
                  <span class={styles.progressSep}>/</span>
                  <span class={styles.progressEstimate}>
                    ~{formatTime(estimatedRemaining())}
                  </span>
                </span>
                <Show when={isLocal() && (props.numChunks ?? 0) > 1}>
                  <span class={styles.progressChunks}>
                    Chunk {currentChunk()} of {props.numChunks}
                  </span>
                </Show>
              </div>
            }
          >
            <div class={styles.progressText}>Estimating...</div>
          </Show>
        </div>
      </Show>

      {/* Stage Indicators */}
      <Show when={props.status === 'completed' && props.outputs}>
        <div class={styles.stageIndicators}>
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
              <div
                class={`${styles.stageItem} ${stage.active ? styles.active : ''}`}
              >
                <span class={styles.stageIcon}>{stage.icon({})}</span>
                <span class={styles.stageLabel}>{stage.label}</span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Error Message */}
      <Show when={props.status === 'error'}>
        <div class={styles.errorSection}>
          <p class={styles.errorText}>{props.error}</p>
        </div>
      </Show>

      {/* Action Buttons */}
      <div class={styles.processActions}>
        <Show when={props.status === 'processing'}>
          <Button
            variant="danger"
            class={`${styles.processBtn} ${styles.processBtnDanger}`}
            onClick={() => props.onCancel?.()}
          >
            Cancel
          </Button>
        </Show>
        <Show when={props.status === 'error'}>
          <Button
            variant="primary"
            class={`${styles.processBtnIcon} ${styles.processBtnRetry}`}
            onClick={() => props.onRetry?.()}
          >
            <span class={styles.processBtnIconSvg}>
              <RotateCcw />
            </span>
            <span class={styles.processBtnIconLabel}>Retry</span>
          </Button>
          <Button
            variant="secondary"
            class={`${styles.processBtnIcon} ${styles.processBtnNew}`}
            onClick={() => props.onNewSession?.()}
          >
            <span class={styles.processBtnIconSvg}>
              <FilePlus />
            </span>
            <span class={styles.processBtnIconLabel}>New Session</span>
          </Button>
          <Button
            variant="secondary"
            class={`${styles.processBtnIcon} ${styles.processBtnDelete}`}
            onClick={() => props.onDeleteAndNew?.()}
          >
            <span class={styles.processBtnIconSvg}>
              <Trash2 />
            </span>
            <span class={styles.processBtnIconLabel}>Delete & New</span>
          </Button>
        </Show>
        <Show when={props.status === 'completed'}>
          <Button variant="primary" class={styles.processBtn} disabled={true}>
            <CheckCircle /> Complete
          </Button>
        </Show>
      </div>
    </div>
  )
}
