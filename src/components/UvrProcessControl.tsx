// ============================================================
// UVR Processing Control
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { CheckCircle, Loader2, Music, Pause, Play,Settings, XCircle,  } from './icons'

interface ProcessControlProps {
  sessionId: string
  status:
    | 'idle'
    | 'uploading'
    | 'processing'
    | 'completed'
    | 'error'
    | 'cancelled'
  progress: number
  processingTime?: number
  error?: string
  outputs?: {
    vocal?: string
    instrumental?: string
    vocalMidi?: string
    instrumentalMidi?: string
  }
  onCancel?: () => void
  onRetry?: () => void
}

export const UvrProcessControl: Component<ProcessControlProps> = (props) => {
  const _isRunning = createSignal(false)

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatPercentage = (percent: number): string => {
    return `${Math.round(percent)  }%`
  }

  const getProcessStage = () => {
    switch (props.status) {
      case 'processing':
        return {
          icon: <Loader2 />,
          title: 'Processing with UVR',
          description: 'Separating vocals and instrumental...',
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
          description: (props.error && props.error.length > 0) ? props.error : 'Unknown error occurred',
          color: 'var(--error)',
        }
      default:
        return {
          icon: <Loader2 />,
          title: 'Waiting to start',
          description: 'Ready to process',
          color: 'var(--fg-tertiary)',
        }
    }
  }

  const currentStage = getProcessStage()

  return (
    <div class="uvr-process-control">
      {/* Status Header */}
      <div class="process-header">
        <div class="process-icon-wrapper" style={{ color: currentStage.color }}>
          <Show when={props.status === 'processing'}>
            <div class="pulse-spinner" />
          </Show>
          <Show when={props.status !== 'processing'}>
            {currentStage.icon}
          </Show>
        </div>
        <div class="process-info">
          <h3>{currentStage.title}</h3>
          <p>{currentStage.description}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <Show when={props.status === 'processing'}>
        <div class="progress-section">
          <div class="progress-bar-container">
            <div
              class="progress-bar-fill"
              style={{
                width: formatPercentage(props.progress),
                '--progress-color': currentStage.color,
              }}
            />
          </div>
          <div class="progress-text">
            {formatPercentage(props.progress)} •{' '}
            {formatTime(props.processingTime || 0)}
          </div>
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
                active: !!props.outputs?.vocal,
              },
              {
                label: 'Instrumental',
                icon: Settings,
                active: !!props.outputs?.instrumental,
              },
              {
                label: 'Vocal MIDI',
                icon: Settings,
                active: !!props.outputs?.vocalMidi,
              },
            ]}
          >
            {(stage) => (
              <div class={`stage-item ${stage.active ? 'active' : ''}`}>
                <span class="stage-icon">{(stage.icon as any)()}</span>
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
          <button class="action-btn action-btn-danger" onClick={props.onCancel}>
            <Pause /> Cancel
          </button>
        </Show>
        <Show when={props.status === 'error' && props.onRetry}>
          <button class="action-btn action-btn-primary" onClick={props.onRetry}>
            <Play /> Retry
          </button>
        </Show>
        <Show when={props.status === 'completed'}>
          <button class="action-btn action-btn-primary" disabled={true}>
            <CheckCircle /> Complete
          </button>
        </Show>
      </div>
    </div>
  )
}

// ============================================================
// CSS Styles (inline for this component)
// ============================================================

export const UvrProcessControlStyles: string = `
.uvr-process-control {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 1rem;
}

.process-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.process-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  background: var(--bg-primary);
  border-radius: 50%;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.process-info h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--fg-primary);
}

.process-info p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--fg-secondary);
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-bar-container {
  height: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background: var(--progress-color, var(--accent));
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-bar-container::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.2) 50%,
    transparent 100%
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--fg-secondary);
}

.stage-indicators {
  display: flex;
  justify-content: space-around;
  padding: 0.75rem 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.stage-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--fg-tertiary);
}

.stage-item.active {
  color: var(--fg-primary);
}

.stage-icon {
  font-size: 1rem;
}

.stage-label {
  font-size: 0.7rem;
}

.error-section {
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid var(--error);
  border-radius: 0 0.25rem 0.25rem 0;
}

.error-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--error);
}

.process-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.action-btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
}

.action-btn-primary:hover:not(:disabled) {
  opacity: 0.85;
}

.action-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn-danger {
  background: var(--bg-primary);
  color: var(--error);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.action-btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
}

.pulse-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--progress-color, var(--accent));
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
`
