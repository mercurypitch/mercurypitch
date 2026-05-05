// ============================================================
// UVR Session Result Display
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { deleteUvrSession, getUvrSession } from '@/stores/app-store'
import type { UvrSession, UvrStatus } from '@/types/uvr'
import { Box, Calendar, CheckCircle, Download, FileText, Loader2, Music, Play, Trash2, XCircle } from './icons'

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

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return (
      `${date.toLocaleDateString()
      } ${
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    )
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
    if (confirm('Delete this session?')) {
      deleteUvrSession(props.sessionId)
      if (props.onClose) props.onClose()
    }
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
        <button class="session-delete-btn" onClick={handleDelete} aria-label="Delete session">
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
        <span class="status-text">{session()?.status || 'Idle'}</span>
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
          <span class="info-icon"><Calendar /></span>
          <div class="info-content">
            <span class="info-label">Created</span>
            <span class="info-value">
              {formatDate(session()?.createdAt || 0)}
            </span>
          </div>
        </div>
        <Show when={session()?.originalFile}>
          <div class="info-item">
            <span class="info-icon"><Box /></span>
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
                <div class="file-icon"><Music /></div>
                <div class="file-content">
                  <span class="file-name">Vocal Stem</span>
                  <span class="file-format">WAV</span>
                </div>
                <button class="file-action" onClick={() => handleExport('vocal')}>
                  <Download />
                </button>
              </div>
            </Show>
            <Show when={session()?.outputs?.instrumental}>
              <div class="output-file">
                <div class="file-icon"><Download /></div>
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
                <div class="file-icon"><FileText /></div>
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
      <div class="session-result-actions">
        <Show when={session()?.status === 'completed'}>
          <button
            class="session-result-btn session-result-btn-primary"
            onClick={() => props.onView?.(props.sessionId)}
          >
            <Play /> View Results
          </button>
        </Show>
        <button class="session-result-btn session-result-btn-danger" onClick={handleDelete}>
          <Trash2 /> Delete
        </button>
      </div>
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
}

.status-bar svg {
  width: 0.8rem;
  height: 0.8rem;
}

.status-icon {
  display: flex;
  align-items: center;
}

.status-text {
  flex: 1;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--fg-primary);
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
`
