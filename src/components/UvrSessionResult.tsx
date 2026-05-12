// ============================================================
// UVR Session Result Display
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { deleteUvrSessionFromDb } from '@/db/services/uvr-service'
import { deleteUvrSession, getUvrSession } from '@/stores/app-store'
import type { UvrSession, UvrStatus } from '@/types/uvr'
import { Box, Calendar, CheckCircle, Cpu, Headphones, Loader2, Midi, Music, Play, RotateCcw, Server, Share, SlidersHorizontal, Trash2, Voice, X, XCircle, Zap, } from './icons'

interface SessionResultProps {
  sessionId: string
  disabled?: boolean
  onView?: (sessionId: string) => void
  onExport?: (
    sessionId: string,
    type: 'vocal' | 'instrumental' | 'vocal-midi',
  ) => void
  onOpenMixer?: (
    sessionId: string,
    stems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean },
  ) => void
  onRetry?: (sessionId: string) => void
  onClose?: () => void
}

export const UvrSessionResult: Component<SessionResultProps> = (props) => {
  const session = () => getUvrSession(props.sessionId)
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false)
  const [toastMessage, setToastMessage] = createSignal('')
  const [selectedStems, setSelectedStems] = createSignal<Set<string>>(new Set())

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  const formatDuration = (secs?: number): string => {
    if (secs === undefined || secs <= 0) return ''
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleCopyLink = async (e: Event) => {
    e.stopPropagation()
    const url = `${window.location.origin}/#/uvr/session/${props.sessionId}/mixer`
    try {
      await navigator.clipboard.writeText(url)
      setToastMessage('Link copied to clipboard!')
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setToastMessage('Link copied!')
    }
    setTimeout(() => setToastMessage(''), 2500)
  }

  const handleDelete = (e: Event) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    deleteUvrSession(props.sessionId)
    void deleteUvrSessionFromDb(props.sessionId)
    setShowDeleteConfirm(false)
    if (props.onClose) props.onClose()
    setToastMessage('Session deleted')
    setTimeout(() => setToastMessage(''), 2500)
  }

  const _handleExport = (type: 'vocal' | 'instrumental' | 'vocal-midi') => {
    if (props.onExport) {
      props.onExport(props.sessionId, type)
    }
  }

  const toggleStemSelection = (stem: string) => {
    if (props.disabled === true && session()?.status !== 'processing') return
    setSelectedStems((prev) => {
      const next = new Set(prev)
      if (next.has(stem)) next.delete(stem)
      else next.add(stem)
      return next
    })
  }

  const handleMixSelected = () => {
    const sel = selectedStems()
    if (sel.size === 0) return
    props.onOpenMixer?.(props.sessionId, {
      vocal: sel.has('vocal'),
      instrumental: sel.has('instrumental'),
      midi: sel.has('vocal-midi'),
    })
  }

  const hasSelection = () => selectedStems().size > 0

  const getStatusColor = (status: UvrStatus): string => {
    switch (status) {
      case 'completed':
        return 'var(--success)'
      case 'error':
        return 'var(--error)'
      case 'cancelled':
        return 'var(--fg-secondary)'
      case 'processing':
        return 'var(--accent)'
      default:
        return 'var(--fg-tertiary)'
    }
  }

  const getStatusIcon = (status: UvrStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle />
      case 'error':
        return <XCircle />
      case 'cancelled':
        return <X />
      case 'processing': {
        const progress = session()?.progress ?? 0
        const radius = 9
        const circumference = 2 * Math.PI * radius
        const offset = circumference - (progress / 100) * circumference
        return (
          <svg
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle
              cx="12"
              cy="12"
              r={radius}
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-opacity="0.2"
            />
            <circle
              cx="12"
              cy="12"
              r={radius}
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-dasharray={circumference.toString()}
              stroke-dashoffset={offset.toString()}
              stroke-linecap="round"
              style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
          </svg>
        )
      }
      default:
        return <Loader2 />
    }
  }

  return (
    <div
      class={`uvr-session-result ${
        props.disabled === true && session()?.status !== 'processing'
          ? 'disabled'
          : ''
      }`}
    >
      {/* Header */}
      <div class="session-header">
        <div class="session-icon-wrapper">
          <Music />
        </div>
        <div class="session-title-area">
          <h3>UVR Session</h3>
          <p class="session-filename">
            {session()?.originalFile?.name ?? 'Unknown'}
          </p>
          <p
            class="session-id-pill"
            title={
              (session()?.apiSessionId as string | undefined) ??
              session()?.sessionId ??
              ''
            }
          >
            {(() => {
              const id =
                (session()?.apiSessionId as string | undefined) ??
                session()?.sessionId
              return id !== undefined
                ? id.length > 16
                  ? id.slice(-8)
                  : id
                : ''
            })()}
          </p>
        </div>
        <button
          class="session-delete-btn"
          onClick={handleDelete}
          aria-label="Delete session"
          disabled={props.disabled}
        >
          <Trash2 />
        </button>
        <button
          class="session-share-btn"
          onClick={(e) => {
            void handleCopyLink(e)
          }}
          title="Copy share link"
          disabled={props.disabled}
        >
          <Share />
        </button>
      </div>

      {/* Status */}
      <div
        class="status-bar"
        style={{
          '--status-color': getStatusColor(session()?.status ?? 'idle'),
        }}
      >
        <span class="status-icon">
          {getStatusIcon(session()?.status ?? 'idle')}
        </span>
        <span class="status-text">
          {session()?.status === 'error'
            ? (session()?.error ?? 'Processing failed')
            : session()?.status === 'completed'
              ? 'Completed'
              : session()?.status === 'processing'
                ? `Processing... ${Math.round(session()?.progress ?? 0)}%`
                : (session()?.status ?? 'Idle')}
        </span>
        <span class="status-time">
          {(() => {
            const s = session() as UvrSession | null
            return s?.processingTime !== undefined
              ? `${Math.round(s.processingTime / 1000)}s`
              : ''
          })()}
        </span>
        <Show
          when={session()?.processingMode === 'server' || session()?.provider}
        >
          <div class="status-provider">
            <span
              class="provider-icon"
              classList={{ 'provider-gpu': session()?.provider === 'webgpu' }}
            >
              {session()?.processingMode === 'server' ? (
                <Server />
              ) : session()?.provider === 'webgpu' ? (
                <Zap />
              ) : (
                <Cpu />
              )}
            </span>
            {session()?.processingMode === 'server'
              ? 'Cloud Server'
              : session()?.provider === 'webgpu'
                ? 'GPU (WebGPU)'
                : 'CPU (WASM)'}
          </div>
        </Show>
        <Show when={!session()}>
          <span class="status-time">Idle</span>
        </Show>
      </div>

      {/* Info Grid */}
      <div class="info-grid">
        <div class="info-item">
          <span class="info-icon">
            <Calendar />
          </span>
          <div class="info-content">
            <span class="info-label">Created</span>
            <span class="info-value">
              {formatDate(session()?.createdAt ?? 0)}
            </span>
          </div>
        </div>
        <Show when={session()?.originalFile}>
          <div class="info-item">
            <span class="info-icon">
              <Box />
            </span>
            <div class="info-content">
              <span class="info-label">Size</span>
              <span class="info-value">
                {formatFileSize(session()!.originalFile!.size)}
              </span>
            </div>
          </div>
        </Show>
      </div>

      {/* Outputs — compact multi-select stem pills */}
      <Show when={session()?.outputs}>
        <div class="outputs-section">
          <h4>Available Stems</h4>
          <div class="stem-pills">
            <Show when={session()?.outputs?.vocal}>
              <button
                class={`stem-pill stem-pill-vocal ${selectedStems().has('vocal') ? 'stem-pill-selected' : ''}`}
                onClick={() => toggleStemSelection('vocal')}
                title={
                  selectedStems().has('vocal')
                    ? 'Deselect Vocal'
                    : 'Select Vocal for Mix'
                }
              >
                <Voice />
                <span>Vocal</span>
                <Show
                  when={formatDuration(session()?.stemMeta?.vocal?.duration)}
                >
                  <span class="stem-pill-duration">
                    {formatDuration(session()?.stemMeta?.vocal?.duration)}
                  </span>
                </Show>
              </button>
            </Show>
            <Show when={session()?.outputs?.instrumental}>
              <button
                class={`stem-pill stem-pill-instrumental ${selectedStems().has('instrumental') ? 'stem-pill-selected' : ''}`}
                onClick={() => toggleStemSelection('instrumental')}
                title={
                  selectedStems().has('instrumental')
                    ? 'Deselect Instrumental'
                    : 'Select Instrumental for Mix'
                }
              >
                <Headphones />
                <span>Inst</span>
                <Show
                  when={formatDuration(
                    session()?.stemMeta?.instrumental?.duration,
                  )}
                >
                  <span class="stem-pill-duration">
                    {formatDuration(
                      session()?.stemMeta?.instrumental?.duration,
                    )}
                  </span>
                </Show>
              </button>
            </Show>
            <Show when={session()?.outputs?.vocal}>
              <button
                class={`stem-pill stem-pill-midi ${selectedStems().has('vocal-midi') ? 'stem-pill-selected' : ''}`}
                onClick={() => toggleStemSelection('vocal-midi')}
                title={
                  selectedStems().has('vocal-midi')
                    ? 'Deselect MIDI'
                    : 'Select MIDI for Mix'
                }
              >
                <Midi />
                <span>MIDI</span>
              </button>
            </Show>
          </div>
        </div>
      </Show>

      {/* Actions */}
      <Show
        when={
          session()?.status === 'completed' ||
          session()?.status === 'error' ||
          session()?.status === 'processing'
        }
      >
        <div class="session-result-actions">
          <Show
            when={
              session()?.status === 'completed' ||
              session()?.status === 'processing'
            }
          >
            <button
              class="session-result-btn session-result-btn-primary"
              disabled={
                props.disabled === true && session()?.status !== 'processing'
              }
              onClick={() => props.onView?.(props.sessionId)}
            >
              <Show
                when={session()?.status === 'processing'}
                fallback={
                  <>
                    <Play /> View Results
                  </>
                }
              >
                <span
                  style={{
                    animation: 'spin 1.5s linear infinite',
                    display: 'inline-flex',
                    'align-items': 'center',
                  }}
                >
                  <Loader2 />
                </span>{' '}
                View Progress
              </Show>
            </button>
            <Show when={session()?.status === 'completed' && hasSelection()}>
              <button
                class="session-result-btn session-result-btn-mixer"
                disabled={props.disabled}
                onClick={handleMixSelected}
              >
                <SlidersHorizontal /> Mix Selected
              </button>
            </Show>
          </Show>
          <Show when={session()?.status === 'error' && session()?.originalFile}>
            <button
              class="session-result-btn session-result-btn-primary"
              disabled={props.disabled}
              onClick={(e) => {
                e.stopPropagation()
                props.onRetry?.(props.sessionId)
              }}
            >
              <RotateCcw /> Retry
            </button>
          </Show>
        </div>
      </Show>

      {/* Delete Confirmation Modal */}
      <Show when={showDeleteConfirm()}>
        <div
          class="delete-confirm-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            class="delete-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Delete Session</h4>
            <p>
              This action cannot be undone. The session and all generated files
              will be permanently removed.
            </p>
            <div class="delete-confirm-actions">
              <button
                class="delete-confirm-cancel"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button class="delete-confirm-delete" onClick={confirmDelete}>
                <Trash2 /> Delete
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Toast Notification */}
      <Show when={toastMessage()}>
        <div class="session-toast">
          <span class="session-toast-icon">
            <CheckCircle />
          </span>
          {toastMessage()}
        </div>
      </Show>
    </div>
  )
}
