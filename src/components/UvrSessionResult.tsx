// ============================================================
// UVR Session Result Display
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { setSessionStem } from '@/db/services/manual-stem-service'
import { deleteUvrSessionFromDb, getOriginalFileBlob, } from '@/db/services/uvr-service'
import { hasStemFingerprint } from '@/lib/shazam/melody-fingerprints'
import { addSessionToGroup, createGroup, deleteUvrSession, getAllUvrSessionsReactive, getGroupsReactive, removeSessionFromGroup, } from '@/stores/app-store'
import { showNotification } from '@/stores/notifications-store'
import type { UvrSession, UvrStatus } from '@/types/uvr'
import { Box, Calendar, CheckCircle, ChevronDown, Cpu, Download, Headphones, Loader2, Midi, Music, Play, Plus, Repeat, RotateCcw, Server, Share, SlidersHorizontal, Trash2, Voice, X, XCircle, Zap, } from './icons'

interface SessionResultProps {
  sessionId: string
  disabled?: boolean
  onView?: (sessionId: string) => void
  onExport?: (sessionId: string) => void
  onOpenMixer?: (
    sessionId: string,
    stems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean },
  ) => void
  onRetry?: (sessionId: string) => void
  onClose?: () => void
  onReindexStem?: (sessionId: string) => void
  /** Re-run this song on the cloud GPU: 'same' upgrades this session's stems
   *  in place, 'new' spawns a separate session so both results can be
   *  compared. Offered only for completed browser-processed sessions. */
  onRerunHq?: (sessionId: string, target: 'same' | 'new') => void
}

export const UvrSessionResult: Component<SessionResultProps> = (props) => {
  const session = () =>
    getAllUvrSessionsReactive().find(
      (candidate) => candidate.sessionId === props.sessionId,
    )
  const vocalFingerprinted = createMemo(() =>
    hasStemFingerprint(props.sessionId),
  )
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false)
  const [toastMessage, setToastMessage] = createSignal('')
  const [selectedStems, setSelectedStems] = createSignal<Set<string>>(new Set())
  const [reindexing, setReindexing] = createSignal(false)
  const [downloadingOriginal, setDownloadingOriginal] = createSignal(false)
  const [showHqMenu, setShowHqMenu] = createSignal(false)
  const [showGroupSelect, setShowGroupSelect] = createSignal(false)
  const [newGroupName, setNewGroupName] = createSignal('')

  const groups = () => getGroupsReactive()
  const currentGroup = () => {
    const gid = session()?.groupId
    if (gid == null) return null
    return groups().find((g) => g.id === gid) ?? null
  }

  // ── Per-stem add / replace (uploaded stems) ─────────────────
  const hasVocal = () =>
    session()?.outputs?.vocal != null || session()?.stemMeta?.vocal != null
  const hasInstrumental = () =>
    session()?.outputs?.instrumental != null ||
    session()?.stemMeta?.instrumental != null

  const [stemBusy, setStemBusy] = createSignal<'vocal' | 'instrumental' | null>(
    null,
  )
  // Returns a file-input change handler; used as an event handler in JSX.
  // eslint-disable-next-line solid/reactivity
  const handleStemFile = (stemType: 'vocal' | 'instrumental') => (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file === undefined) return
    const had = stemType === 'vocal' ? hasVocal() : hasInstrumental()
    setStemBusy(stemType)
    void setSessionStem(props.sessionId, stemType, file)
      .then(() =>
        showNotification(
          `${stemType === 'vocal' ? 'Vocal' : 'Instrumental'} ${had ? 'replaced' : 'added'}`,
          'success',
        ),
      )
      .catch(() => showNotification(`Failed to update ${stemType}`, 'error'))
      .finally(() => setStemBusy(null))
  }

  const handleGroupChange = async (groupId: string) => {
    setShowGroupSelect(false)
    try {
      await addSessionToGroup(props.sessionId, groupId)
    } catch {
      showNotification('Could not change the session group.', 'error')
    }
  }

  const handleCreateAndAssign = async () => {
    const name = newGroupName().trim()
    if (!name) return
    try {
      const group = await createGroup(name)
      await addSessionToGroup(props.sessionId, group.id)
      setNewGroupName('')
      setShowGroupSelect(false)
    } catch {
      showNotification('Could not create and assign the group.', 'error')
    }
  }

  const handleRemoveFromGroup = async () => {
    setShowGroupSelect(false)
    try {
      await removeSessionFromGroup(props.sessionId)
    } catch {
      showNotification('Could not remove the session from its group.', 'error')
    }
  }

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

  const handleReindex = (e: Event) => {
    e.stopPropagation()
    if (reindexing()) return
    setReindexing(true)
    props.onReindexStem?.(props.sessionId)
    setTimeout(() => setReindexing(false), 3000)
  }

  // Download the original uploaded mix. We keep it in IndexedDB for the retry
  // path (see UvrPanel.handleProcessStart), so users who deleted their local
  // copy can pull it back — e.g. to re-run a higher-quality server separation.
  const handleDownloadOriginal = async (e: Event) => {
    e.stopPropagation()
    if (downloadingOriginal()) return
    setDownloadingOriginal(true)
    try {
      const file = await getOriginalFileBlob(props.sessionId)
      if (!file) {
        showNotification(
          "The original file isn't stored for this session.",
          'warning',
        )
        return
      }
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = session()?.originalFile?.name ?? file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error('[UvrSessionResult] original download failed:', err)
      showNotification('Could not read the original file.', 'error')
    } finally {
      setDownloadingOriginal(false)
    }
  }

  const hasSelection = () => selectedStems().size > 0

  // HQ re-run makes sense only for a finished browser separation that still
  // has its original upload to feed the cloud GPU. Manual-stem sessions have
  // no full mix, and server sessions already ran the HQ model.
  const canRerunHq = () => {
    const s = session()
    return (
      s?.status === 'completed' &&
      s.processingMode === 'local' &&
      s.provider !== 'manual' &&
      s.originalFile != null &&
      props.onRerunHq !== undefined
    )
  }

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
      case 'interrupted':
      case 'error':
        return <XCircle />
      case 'cancelled':
        return <X />
      case 'finalizing':
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
        {/* Top row: icon + band/group on the left, actions on the right */}
        <div class="session-header-top">
          <div class="session-icon-wrapper">
            <Music />
          </div>
          <Show when={currentGroup()}>
            <p class="session-band" title={currentGroup()!.name}>
              {currentGroup()!.name}
            </p>
          </Show>
          <div class="session-header-actions">
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
                e.stopPropagation()
                props.onExport?.(props.sessionId)
              }}
              title="Export session to ZIP"
              disabled={
                props.disabled === true || session()?.status !== 'completed'
              }
            >
              <Download />
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
        </div>

        {/* Song title — full width across the card */}
        <p
          class="session-filename"
          title={session()?.originalFile?.name ?? 'Unknown'}
        >
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
            return id !== undefined ? (id.length > 16 ? id.slice(-8) : id) : ''
          })()}
        </p>
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
          {(() => {
            const st = session()?.status
            if (st === 'error') return session()?.error ?? 'Processing failed'
            if (st === 'interrupted')
              return session()?.error ?? 'Interrupted — please retry'
            if (st === 'finalizing') return 'Saving stems…'
            if (st === 'completed') return 'Completed'
            if (st === 'processing')
              return `Processing... ${Math.round(session()?.progress ?? 0)}%`
            return st ?? 'Idle'
          })()}
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

      {/* Group Assignment */}
      <div class="session-group-assign">
        <span class="session-group-assign-label">Group</span>
        <div class="session-group-assign-dropdown">
          <button
            class="session-group-assign-btn"
            onClick={() => setShowGroupSelect(!showGroupSelect())}
            title="Assign to group"
          >
            <span class="session-group-assign-current">
              {currentGroup()?.name ?? 'No group'}
            </span>
            <span
              class="session-group-assign-chevron"
              classList={{ open: showGroupSelect() }}
            >
              <ChevronDown size={12} />
            </span>
          </button>
          <Show when={showGroupSelect()}>
            <div class="session-group-assign-menu">
              <For each={groups()}>
                {(group) => (
                  <button
                    class="session-group-assign-item"
                    classList={{
                      'session-group-assign-item--active':
                        session()?.groupId === group.id,
                    }}
                    onClick={() => void handleGroupChange(group.id)}
                  >
                    {group.name}
                    <span class="session-group-assign-item-count">
                      {group.sessionIds.length}
                    </span>
                  </button>
                )}
              </For>
              <Show when={session()?.groupId}>
                <button
                  class="session-group-assign-item session-group-assign-item--remove"
                  onClick={() => void handleRemoveFromGroup()}
                >
                  Remove from group
                </button>
              </Show>
              <div class="session-group-assign-divider" />
              <div class="session-group-assign-new">
                <input
                  type="text"
                  class="session-group-assign-new-input"
                  placeholder="New group name"
                  value={newGroupName()}
                  onInput={(e) => setNewGroupName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateAndAssign()
                    if (e.key === 'Escape') setShowGroupSelect(false)
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  class="session-group-assign-new-btn"
                  onClick={() => void handleCreateAndAssign()}
                >
                  Create & assign
                </button>
              </div>
            </div>
            <div
              class="session-group-assign-backdrop"
              onClick={() => setShowGroupSelect(false)}
            />
          </Show>
        </div>
      </div>

      {/* Outputs — compact multi-select stem pills */}
      <Show when={session()?.outputs || session()?.stemMeta}>
        <div class="outputs-section">
          <h4>Available Stems</h4>
          <div class="stem-pills">
            <Show
              when={
                session()?.outputs?.vocal != null ||
                session()?.stemMeta?.vocal != null
              }
            >
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
                <Show when={vocalFingerprinted()}>
                  <span
                    class="stem-pill-shazam"
                    title="Included in Shazam Sing matching"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Shazam
                  </span>
                </Show>
                <span
                  class="stem-pill-reindex"
                  classList={{ 'stem-pill-reindexing': reindexing() }}
                  onClick={handleReindex}
                  role="button"
                  tabindex={
                    reindexing() || props.disabled === true ? undefined : '0'
                  }
                  aria-disabled={reindexing() || props.disabled === true}
                  title={
                    vocalFingerprinted()
                      ? 'Re-index vocal stem for Shazam matching'
                      : 'Index vocal stem for Shazam matching'
                  }
                >
                  <RotateCcw />
                </span>
                <Show
                  when={formatDuration(session()?.stemMeta?.vocal?.duration)}
                >
                  <span class="stem-pill-duration">
                    {formatDuration(session()?.stemMeta?.vocal?.duration)}
                  </span>
                </Show>
              </button>
            </Show>
            <Show
              when={
                session()?.outputs?.instrumental != null ||
                session()?.stemMeta?.instrumental != null
              }
            >
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
            <Show
              when={
                session()?.outputs?.vocal != null ||
                session()?.stemMeta?.vocal != null
              }
            >
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

          {/* Add / replace uploaded stems — icon-only, single row */}
          <Show when={session()?.status === 'completed'}>
            <div class="stem-manage">
              <label
                class="stem-manage-btn"
                classList={{ 'stem-manage-btn--busy': stemBusy() === 'vocal' }}
                title={hasVocal() ? 'Replace vocal stem' : 'Add a vocal stem'}
              >
                <Voice />
                <Show when={hasVocal()} fallback={<Plus size={13} />}>
                  <Repeat size={13} />
                </Show>
                <input
                  type="file"
                  accept="audio/*"
                  style={{ display: 'none' }}
                  onChange={handleStemFile('vocal')}
                  disabled={props.disabled === true || stemBusy() !== null}
                />
              </label>
              <label
                class="stem-manage-btn"
                classList={{
                  'stem-manage-btn--busy': stemBusy() === 'instrumental',
                }}
                title={
                  hasInstrumental()
                    ? 'Replace instrumental stem'
                    : 'Add an instrumental stem'
                }
              >
                <Headphones />
                <Show when={hasInstrumental()} fallback={<Plus size={13} />}>
                  <Repeat size={13} />
                </Show>
                <input
                  type="file"
                  accept="audio/*"
                  style={{ display: 'none' }}
                  onChange={handleStemFile('instrumental')}
                  disabled={props.disabled === true || stemBusy() !== null}
                />
              </label>
            </div>
          </Show>
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
                <SlidersHorizontal /> Mix
              </button>
            </Show>
            <Show
              when={
                session()?.status === 'completed' && session()?.originalFile
              }
            >
              <button
                class="session-result-btn"
                disabled={props.disabled === true || downloadingOriginal()}
                onClick={(e) => void handleDownloadOriginal(e)}
                title="Download the original uploaded file (full mix)"
              >
                <Download /> Original
              </button>
            </Show>
            <Show when={canRerunHq()}>
              <div class="session-hq-rerun">
                <button
                  class="session-result-btn session-result-btn-hq"
                  disabled={props.disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowHqMenu(!showHqMenu())
                  }}
                  title="Re-run this song on the cloud GPU for higher-quality stems"
                >
                  <Zap /> HQ
                  <span
                    class="session-hq-rerun-chevron"
                    classList={{ open: showHqMenu() }}
                  >
                    <ChevronDown size={12} />
                  </span>
                </button>
                <Show when={showHqMenu()}>
                  <div class="session-hq-rerun-menu">
                    <button
                      class="session-hq-rerun-item"
                      onClick={() => {
                        setShowHqMenu(false)
                        props.onRerunHq?.(props.sessionId, 'same')
                      }}
                    >
                      Upgrade this session
                      <span class="session-hq-rerun-item-note">
                        Replaces these stems with cloud HQ stems
                      </span>
                    </button>
                    <button
                      class="session-hq-rerun-item"
                      onClick={() => {
                        setShowHqMenu(false)
                        props.onRerunHq?.(props.sessionId, 'new')
                      }}
                    >
                      New session to compare
                      <span class="session-hq-rerun-item-note">
                        Keeps this one — the HQ result arrives separately
                      </span>
                    </button>
                    <div class="session-hq-rerun-hint">
                      Runs on the cloud GPU — uses credits
                    </div>
                  </div>
                </Show>
              </div>
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
