// ============================================================
// UVR Session Result — Compact Gallery Card
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { deleteUvrSession, getUvrSession } from '@/stores/app-store'
import type { UvrSession, UvrStatus } from '@/types/uvr'
import { CheckCircle, Download, FileText, Loader2, Music, Play, Trash2, XCircle } from './icons'

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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  const formatTime = (timestamp: number): string => {
    const d = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}d ago`
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
    <div
      class="uvr-session-result"
      onClick={() => props.onView?.(props.sessionId)}
      role="button"
      tabindex={0}
    >
      {/* Top row: status dot + filename + delete */}
      <div class="session-card-top">
        <span
          class="session-status-dot"
          style={{ background: getStatusColor(session()?.status || 'idle') }}
        />
        <span class="session-card-filename">
          {session()?.originalFile?.name || 'Unknown'}
        </span>
        <button class="session-card-delete" onClick={handleDelete} aria-label="Delete session">
          <Trash2 />
        </button>
      </div>

      {/* Status + time row */}
      <div class="session-card-meta">
        <span class="session-card-status">
          {getStatusIcon(session()?.status || 'idle')}
          {session()?.status || 'idle'}
        </span>
        <span class="session-card-time">
          {session()?.createdAt ? formatTime(session()!.createdAt) : ''}
        </span>
        <Show when={(session() as UvrSession | null)?.processingTime}>
          <span class="session-card-duration">
            {Math.round((session()?.processingTime || 0) / 1000)}s
          </span>
        </Show>
      </div>

      {/* Size info */}
      <Show when={session()?.originalFile}>
        <span class="session-card-size">
          {formatFileSize(session()!.originalFile!.size)}
        </span>
      </Show>

      {/* Output chips */}
      <Show when={session()?.outputs}>
        <div class="session-card-chips">
          <Show when={session()?.outputs?.vocal}>
            <span class="output-chip output-chip-vocal" onClick={(e) => { e.stopPropagation(); handleExport('vocal') }}>
              <Music /> Vocal <Download />
            </span>
          </Show>
          <Show when={session()?.outputs?.instrumental}>
            <span class="output-chip output-chip-inst" onClick={(e) => { e.stopPropagation(); handleExport('instrumental') }}>
              <Music /> Inst <Download />
            </span>
          </Show>
          <Show when={session()?.outputs?.vocalMidi}>
            <span class="output-chip output-chip-midi" onClick={(e) => { e.stopPropagation(); handleExport('vocal-midi') }}>
              <FileText /> MIDI <Download />
            </span>
          </Show>
        </div>
      </Show>

      {/* View button for completed */}
      <Show when={session()?.status === 'completed'}>
        <button
          class="session-card-view"
          onClick={(e) => { e.stopPropagation(); props.onView?.(props.sessionId) }}
        >
          <Play /> View
        </button>
      </Show>
    </div>
  )
}

// ============================================================
// CSS Styles (inline for this component)
// ============================================================

export const UvrSessionResultStyles: string = `
/* ── Gallery card ── */
.uvr-session-result {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  overflow: hidden;
}

.uvr-session-result:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

/* ── Top row: dot + filename + delete ── */
.session-card-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.session-status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.session-card-filename {
  flex: 1;
  min-width: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-card-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
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

.uvr-session-result:hover .session-card-delete {
  opacity: 1;
}

.session-card-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}

/* ── Status + time meta row ── */
.session-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--fg-tertiary);
}

.session-card-status {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.session-card-status svg {
  width: 0.75rem;
  height: 0.75rem;
}

.session-card-time {
  margin-left: auto;
}

.session-card-duration {
  color: var(--fg-secondary);
}

/* ���─ Size ── */
.session-card-size {
  font-size: 0.7rem;
  color: var(--fg-tertiary);
}

/* ── Output chips ── */
.session-card-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.output-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.7rem;
  color: var(--fg-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.output-chip svg {
  width: 0.65rem;
  height: 0.65rem;
}

.output-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.output-chip-vocal { border-left: 2px solid var(--success); }
.output-chip-inst  { border-left: 2px solid var(--accent); }
.output-chip-midi  { border-left: 2px solid var(--purple); }

/* ── View button ── */
.session-card-view {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  width: 100%;
}

.session-card-view svg {
  width: 0.8rem;
  height: 0.8rem;
}

.session-card-view:hover {
  opacity: 0.85;
}
`
