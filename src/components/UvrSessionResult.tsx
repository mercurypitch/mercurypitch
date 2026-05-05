// ============================================================
// UVR Session Result Display
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { deleteUvrSession, getUvrSession } from '@/stores/app-store'
import type { UvrSession, UvrStatus } from '@/types/uvr'
import { Box, Calendar, CheckCircle, Download, FileText, Loader2, Music, Play, Trash2, XCircle, } from './icons'

interface SessionResultProps {
  sessionId: string
  onView?: (sessionId: string) => void
  onExport?: (
    sessionId: string,
    type: 'vocal' | 'instrumental' | 'vocal-midi',
  ) => void
  onClose?: () => void
}

export const UvrSessionResult: Component<SessionResultProps> = (props) => {
  const session = () => getUvrSession(props.sessionId)
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false)
  const [toastMessage, setToastMessage] = createSignal('')

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

  const handleExport = (type: 'vocal' | 'instrumental' | 'vocal-midi') => {
    if (props.onExport) {
      props.onExport(props.sessionId, type)
    }
  }

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
            {session()?.originalFile?.name || 'Unknown'}
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
          '--status-color': getStatusColor(session()?.status || 'idle'),
        }}
      >
        <span class="status-icon">
          {getStatusIcon(session()?.status || 'idle')}
        </span>
        <span class="status-text">
          {session()?.status === 'error'
            ? session()?.error || 'Processing failed'
            : session()?.status === 'completed'
              ? 'Completed'
              : session()?.status === 'processing'
                ? 'Processing...'
                : session()?.status || 'Idle'}
        </span>
        <span class="status-time">
          {(() => {
            const s = session() as UvrSession | null
            return s?.processingTime
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
              {formatDate(session()?.createdAt || 0)}
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

      {/* Outputs */}
      <Show when={session()?.outputs}>
        <div class="outputs-section">
          <h4>Generated Outputs</h4>
          <div class="output-files">
            <Show when={session()?.outputs?.vocal}>
              <div class="output-file">
                <div class="file-icon">
                  <Music />
                </div>
                <div class="file-content">
                  <span class="file-name">Vocal Stem</span>
                  <span class="file-format">WAV</span>
                </div>
                <button
                  class="file-action"
                  onClick={() => handleExport('vocal')}
                >
                  <Download />
                </button>
              </div>
            </Show>
            <Show when={session()?.outputs?.instrumental}>
              <div class="output-file">
                <div class="file-icon">
                  <Download />
                </div>
                <div class="file-content">
                  <span class="file-name">Instrumental</span>
                  <span class="file-format">WAV</span>
                </div>
                <button
                  class="file-action"
                  onClick={() => handleExport('instrumental')}
                >
                  <Download />
                </button>
              </div>
            </Show>
            <Show when={session()?.outputs?.vocalMidi}>
              <div class="output-file">
                <div class="file-icon">
                  <FileText />
                </div>
                <div class="file-content">
                  <span class="file-name">Vocal MIDI</span>
                  <span class="file-format">MIDI</span>
                </div>
                <button
                  class="file-action"
                  onClick={() => handleExport('vocal-midi')}
                >
                  <Download />
                </button>
              </div>
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

// ============================================================
// CSS Styles (inline for this component)
// ============================================================

export const UvrSessionResultStyles: string = `
.uvr-session-result {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.875rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  overflow: hidden;
}

.uvr-session-result:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.session-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.session-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  background: var(--bg-primary);
  border-radius: 50%;
  color: var(--fg-primary);
  flex-shrink: 0;
}

.session-icon-wrapper svg {
  width: 1.1rem;
  height: 1.1rem;
}

.session-title-area {
  flex: 1;
  min-width: 0;
}

.session-title-area h3 {
  margin: 0;
  font-size: 0.85rem;
  color: var(--fg-primary);
}

.session-filename {
  margin: 0.15rem 0 0;
  font-size: 0.75rem;
  color: var(--fg-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  color: var(--fg-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
  opacity: 0;
}

.uvr-session-result:hover .session-delete-btn {
  opacity: 1;
}

.session-delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}

.session-delete-btn svg {
  width: 1rem;
  height: 1rem;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  background: var(--bg-primary);
  border-radius: 0.4rem;
  border-left: 3px solid var(--status-color, var(--fg-tertiary));
  position: relative;
  overflow: hidden;
}

.status-bar::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--status-color, var(--fg-tertiary));
  opacity: 0.08;
  pointer-events: none;
}

.status-bar svg {
  width: 0.8rem;
  height: 0.8rem;
}

.status-icon {
  display: flex;
  align-items: center;
  position: relative;
}

.status-text {
  flex: 1;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--fg-primary);
  position: relative;
}

.status-time {
  font-size: 0.7rem;
  color: var(--fg-tertiary);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.info-item {
  display: flex;
  gap: 0.4rem;
  padding: 0.4rem;
  background: var(--bg-primary);
  border-radius: 0.4rem;
}

.info-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-tertiary);
  flex-shrink: 0;
}

.info-icon svg {
  width: 0.9rem;
  height: 0.9rem;
}

.info-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.info-label {
  font-size: 0.65rem;
  color: var(--fg-tertiary);
  margin-bottom: 0.1rem;
}

.info-value {
  font-size: 0.75rem;
  color: var(--fg-primary);
  font-weight: 500;
}

.outputs-section {
  padding: 0.6rem;
  background: var(--bg-primary);
  border-radius: 0.4rem;
}

.outputs-section h4 {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
  color: var(--fg-primary);
}

.output-files {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.output-file {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem;
  background: var(--bg-secondary);
  border-radius: 0.35rem;
}

.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--fg-tertiary);
}

.file-icon svg {
  width: 1rem;
  height: 1rem;
}

.file-content {
  flex: 1;
  min-width: 0;
}

.file-name {
  display: block;
  font-size: 0.78rem;
  color: var(--fg-primary);
  margin-bottom: 0.1rem;
}

.file-format {
  display: block;
  font-size: 0.65rem;
  color: var(--fg-tertiary);
}

.file-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.35rem;
  color: var(--fg-primary);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.file-action svg {
  width: 0.85rem;
  height: 0.85rem;
}

.file-action:hover {
  background: var(--border);
  color: var(--accent);
}

.session-result-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
}

.session-result-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 0.4rem;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.session-result-btn svg {
  width: 0.85rem;
  height: 0.85rem;
}

.session-result-btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
}

.session-result-btn-primary:hover:not(:disabled) {
  opacity: 0.85;
}

.session-result-btn-danger {
  background: var(--bg-tertiary);
  color: var(--fg-primary);
  border: 1px solid var(--border);
}

.session-result-btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
  border-color: rgba(239, 68, 68, 0.3);
}

/* Delete Confirmation Modal */
.delete-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: overlay-in 0.15s ease;
}

@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.delete-confirm-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.5rem;
  max-width: 380px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: dialog-in 0.2s ease;
}

@keyframes dialog-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.delete-confirm-dialog h4 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--fg-primary);
}

.delete-confirm-dialog p {
  margin: 0 0 1.25rem;
  font-size: 0.85rem;
  color: var(--fg-secondary);
  line-height: 1.5;
}

.delete-confirm-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.delete-confirm-cancel {
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  color: var(--fg-primary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
}

.delete-confirm-cancel:hover {
  background: var(--bg-hover);
}

.delete-confirm-delete {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  background: var(--error);
  color: white;
  border: none;
  border-radius: 0.4rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.delete-confirm-delete:hover {
  opacity: 0.85;
}

.delete-confirm-delete svg {
  width: 0.9rem;
  height: 0.9rem;
}

/* Toast Notification */
.session-toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  font-size: 0.85rem;
  color: var(--fg-primary);
  z-index: 1001;
  animation: toast-in 0.25s ease, toast-out 0.25s ease 2s forwards;
}

@keyframes toast-in {
  from { transform: translateX(-50%) translateY(1rem); opacity: 0; }
  to { transform: translateX(-50%) translateY(0); opacity: 1; }
}

@keyframes toast-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

.session-toast-icon {
  display: flex;
  align-items: center;
  color: var(--success);
}

.session-toast-icon svg {
  width: 0.9rem;
  height: 0.9rem;
}
`
