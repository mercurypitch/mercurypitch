// ============================================================
// UVR Processing Control
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { CheckCircle, Cpu, FilePlus, Loader2, Music, RotateCcw, Server, Settings, Trash2, XCircle, Zap, } from './icons'

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

  const getProcessStage = () => {
    switch (props.status) {
      case 'processing':
        return {
          icon: <Loader2 />,
          title: `Processing ${props.originalFileName ?? 'audio'} into stems`,
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
          <div class="progress-text">
            {(props.indeterminate ?? false)
              ? 'Estimating...'
              : formatPercentage(props.progress)}{' '}
            • {formatTime(props.processingTime ?? 0)}
          </div>
          <Show
            when={
              isLocal() && props.numChunks !== undefined && props.numChunks > 1
            }
          >
            <div class="progress-chunk-info">
              Chunk{' '}
              {Math.max(
                1,
                Math.min(
                  props.numChunks ?? 1,
                  Math.ceil((props.progress / 100) * (props.numChunks ?? 1)),
                ),
              )}{' '}
              of {props.numChunks}
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
        </div>
      </Show>

      {/* Action Buttons */}
      <div class="process-actions">
        <Show when={props.status === 'processing'}>
          <button
            class="process-btn process-btn-danger"
            onClick={() => props.onCancel?.()}
          >
            Cancel
          </button>
        </Show>
        <Show when={props.status === 'error'}>
          <button
            class="process-btn-icon process-btn-retry"
            onClick={() => props.onRetry?.()}
          >
            <span class="process-btn-icon-svg">
              <RotateCcw />
            </span>
            <span class="process-btn-icon-label">Retry</span>
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
          <button class="process-btn process-btn-primary" disabled={true}>
            <CheckCircle /> Complete
          </button>
        </Show>
      </div>
    </div>
  )
}
