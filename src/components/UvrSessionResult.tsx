// ============================================================
// UVR Session Result Display
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { deleteUvrSession, getUvrSession } from '@/stores/app-store'
import type { UvrSession, UvrStatus } from '@/types/uvr'
import { Box, Calendar, CheckCircle, Headphones, Loader2, Midi, Music, Play, Share, SlidersHorizontal, Trash2, Voice, XCircle, } from './icons'

interface SessionResultProps {
  sessionId: string
  onView?: (sessionId: string) => void
  onExport?: (
    sessionId: string,
    type: 'vocal' | 'instrumental' | 'vocal-midi',
  ) => void
  onOpenMixer?: (
    sessionId: string,
    stems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean },
  ) => void
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
    const url = `${window.location.origin}/#/uvr/session/${props.sessionId}`
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
      case 'processing':
        return <Loader2 />
      default:
        return <Loader2 />
    }
  }

  return (
    <div class="uvr-session-result">
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
        >
          <Trash2 />
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
                ? 'Processing...'
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
      <Show when={session()?.status === 'completed'}>
        <div class="session-result-actions">
          <button
            class="session-result-btn session-result-btn-primary"
            onClick={() => props.onView?.(props.sessionId)}
          >
            <Play /> View Results
          </button>
          <Show when={hasSelection()}>
            <button
              class="session-result-btn session-result-btn-mixer"
              onClick={handleMixSelected}
            >
              <SlidersHorizontal /> Mix Selected
            </button>
          </Show>
          <button
            class="session-result-btn session-result-btn-copy"
            onClick={(e) => {
              void handleCopyLink(e)
            }}
            title="Copy share link"
          >
            <Share />
          </button>
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
