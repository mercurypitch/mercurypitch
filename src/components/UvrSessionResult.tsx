// ============================================================
// UVR Session Result Display
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createResource, createSignal, For, Show } from 'solid-js'
import { setSessionStem } from '@/db/services/manual-stem-service'
import type { PlayAlongPreset, PlayAlongStemKey, } from '@/features/stem-mixer/play-along'
import { sessionSize, sessionSizeLabel } from '@/lib/session-size'
import { hasStemFingerprint } from '@/lib/shazam/melody-fingerprints'
import { deleteUvrSessionWithWarning } from '@/lib/uvr-delete'
import type { RecoveryAvailability } from '@/lib/uvr-session-recovery'
import { canRetryUvrSession, getRecoveryCopy, loadRetainedOriginalSong, } from '@/lib/uvr-session-recovery'
import { addSessionToGroup, createGroup, getAllUvrSessionsReactive, getGroupsReactive, removeSessionFromGroup, } from '@/stores/app-store'
import { showNotification } from '@/stores/notifications-store'
import type { UvrStatus } from '@/types/uvr'
import { ExampleCredit } from './ExampleCredit'
import { Box, Calendar, CheckCircle, ChevronDown, Cpu, DeviceSync, Headphones, Loader2, Midi, Music, Play, Plus, Repeat, RotateCcw, Server, Share, SlidersHorizontal, Trash2, Voice, X, XCircle, Zap, } from './icons'
import type { OverflowMenuItem } from './OverflowMenu'
import { PlayAlongSelect } from './PlayAlongSelect'
import { UvrSessionActions } from './UvrSessionActions'

interface SessionResultProps {
  sessionId: string
  disabled?: boolean
  onView?: (sessionId: string) => void
  onOpenMixer?: (
    sessionId: string,
    stems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean },
  ) => void
  onPlayAlong?: (sessionId: string, preset: PlayAlongPreset) => void
  onRetry?: (sessionId: string) => void
  onClose?: () => void
  onReindexStem?: (sessionId: string) => void
  /** Re-run this song on the cloud GPU: 'same' upgrades this session's stems
   *  in place, 'new' spawns a separate session so both results can be
   *  compared. Offered only for completed browser-processed sessions. */
  onRerunHq?: (sessionId: string, target: 'same' | 'new') => void
  /** Push this song to another of the user's devices (device sync). */
  onSendToDevice?: (sessionId: string) => void
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
  const [showGroupSelect, setShowGroupSelect] = createSignal(false)
  /**
   * The second tier.
   *
   * Everything somebody goes LOOKING for rather than arrives wanting:
   * changing the group, adding or replacing a stem by hand, re-indexing
   * for Shazam, the session id, which machine did the work. None of them
   * is ever the reason a card is on screen, and together they were half
   * its height.
   */
  const [showMore, setShowMore] = createSignal(false)
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

  const playAlongStems = (): PlayAlongStemKey[] => [
    ...(hasVocal() ? (['vocal'] as const) : []),
    ...(hasInstrumental() ? (['instrumental'] as const) : []),
  ]

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

  /**
   * The stems plus the source, not the source alone.
   *
   * The old chip showed `originalFile.size`, which understates a prepared
   * song by roughly five times and disappears entirely on a song that
   * arrived by device sync — the one case where a person is most likely
   * to be counting megabytes.
   */
  const sizeLabel = (): string | null => {
    const s = session()
    return s === undefined ? null : sessionSizeLabel(s, formatFileSize)
  }

  /** The breakdown, on hover, so the headline number is explainable. */
  const sizeDetail = (): string | null => {
    const s = session()
    if (s === undefined) return null
    const size = sessionSize(s)
    if (size.bytes <= 0) return null
    const parts = [`Stems ${formatFileSize(size.stemBytes)}`]
    if (size.originalBytes > 0) {
      parts.push(`original ${formatFileSize(size.originalBytes)}`)
    }
    if (!size.complete) parts.push('some parts unmeasured')
    return parts.join(' · ')
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
    // The helper warns through the global notifier, not the local toast:
    // onClose can unmount this component before the cascade settles, and
    // a warning nobody sees is no warning.
    void deleteUvrSessionWithWarning(props.sessionId)
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

  /**
   * What the card contributes to the one menu in its header.
   *
   * Passed down to UvrSessionActions rather than rendered here, so a card
   * has a single "..." instead of two that behave differently.
   */
  const cardMenuItems = createMemo((): OverflowMenuItem[] => [
    {
      key: 'share',
      label: 'Copy share link',
      icon: () => <Share />,
      disabled: props.disabled === true,
      onSelect: () => {
        void handleCopyLink(new Event('copy-link'))
      },
    },
    {
      key: 'delete',
      label: 'Delete this song',
      note: 'Removes its stems from this device',
      icon: () => <Trash2 />,
      destructive: true,
      disabled: props.disabled === true,
      onSelect: () => handleDelete(new Event('delete')),
    },
  ])

  const hasSelection = () => selectedStems().size > 0
  const needsRecovery = () => {
    const status = session()?.status
    return status === 'cancelled' || status === 'interrupted'
  }
  const [retainedOriginal] = createResource(
    () => (needsRecovery() ? props.sessionId : undefined),
    (sessionId) => loadRetainedOriginalSong(sessionId),
  )
  const recoveryAvailability = (): RecoveryAvailability => {
    if (retainedOriginal.loading) return 'checking'
    return retainedOriginal() === true ? 'available' : 'unavailable'
  }
  const canProcessAgain = () => {
    return canRetryUvrSession(
      session()?.status,
      session()?.originalFile !== undefined,
      recoveryAvailability(),
      props.onRetry !== undefined,
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
            // The final stretch reports no granular progress — the pulse
            // keeps a ring parked at ~95% reading as "alive", not hung.
            class="status-ring-live"
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
            {/* Delete and Copy link used to sit here as their own buttons,
                and everything else sat in a row of eight at the bottom.
                One trigger, top right, where a card's menu belongs. */}
            <UvrSessionActions
              sessionId={props.sessionId}
              session={session()}
              disabled={props.disabled}
              onRerunHq={props.onRerunHq}
              onSendToDevice={props.onSendToDevice}
              extraItems={cardMenuItems()}
            />
          </div>
        </div>

        {/* Song title — full width across the card */}
        <p
          class="session-filename"
          title={session()?.originalFile?.name ?? 'Unknown'}
        >
          {session()?.originalFile?.name ?? 'Unknown'}
        </p>
        <ExampleCredit sessionId={props.sessionId} />
        <Show when={showMore()}>
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
        </Show>
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
            if (st === 'cancelled') return 'Cancelled before completion'
            if (st === 'finalizing') return 'Saving stems…'
            if (st === 'completed') return 'Completed'
            if (st === 'processing') {
              const pct = Math.round(session()?.progress ?? 0)
              // ≥90% = the server is writing/uploading stems with no finer
              // progress to report — say so instead of parking on a number.
              return pct >= 90
                ? `Finishing up… ${pct}% — still working`
                : `Processing... ${pct}%`
            }
            return st ?? 'Idle'
          })()}
        </span>
        <span class="status-time">
          {(() => {
            const s = session()
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
        {/* A song that arrived by device sync or Drive restore is the
            bundle's re-encode, not the original — said on the card, so
            "why does this one sound different" has a visible answer. */}
        <Show when={session()?.audioQuality?.startsWith('portable')}>
          <div
            class="status-provider"
            title="Received from another device at travel quality. The full-quality original stays on the device that separated it."
          >
            <span class="provider-icon">
              <DeviceSync />
            </span>
            Compact copy
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
        <Show when={sizeLabel()}>
          <div class="info-item">
            <span class="info-icon">
              <Box />
            </span>
            <div class="info-content">
              <span class="info-label">On this device</span>
              <span class="info-value" title={sizeDetail() ?? undefined}>
                {sizeLabel()}
              </span>
            </div>
          </div>
        </Show>
      </div>

      {/* Group Assignment — second tier: a song's group is set once and
          then read off the chip in the header. */}
      <Show when={showMore()}>
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
      </Show>

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
                <Show when={showMore()}>
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
                </Show>
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

          {/* Add / replace uploaded stems — second tier. Reaching for
              this means going looking; it is never why a card is open. */}
          <Show when={session()?.status === 'completed' && showMore()}>
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

      <Show when={needsRecovery()}>
        <div
          class="session-recovery"
          classList={{
            'session-recovery--unavailable':
              recoveryAvailability() === 'unavailable',
          }}
        >
          <span class="session-recovery-icon" aria-hidden="true">
            <Show
              when={recoveryAvailability() !== 'checking'}
              fallback={<Loader2 />}
            >
              <Show
                when={recoveryAvailability() === 'available'}
                fallback={<XCircle />}
              >
                <RotateCcw />
              </Show>
            </Show>
          </span>
          <div class="session-recovery-copy">
            <strong>{getRecoveryCopy(recoveryAvailability()).title}</strong>
            <span>{getRecoveryCopy(recoveryAvailability()).description}</span>
          </div>
        </div>
      </Show>

      {/* Actions */}
      <Show
        when={
          session()?.status === 'completed' ||
          session()?.status === 'processing' ||
          canProcessAgain()
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
            <Show
              when={
                session()?.status === 'completed' &&
                props.onPlayAlong !== undefined
              }
            >
              <PlayAlongSelect
                sessionId={props.sessionId}
                availableStems={playAlongStems()}
                discoverStoredStems
                compact
                disabled={props.disabled}
                ariaLabel={`Choose what you perform in ${session()?.originalFile?.name ?? 'this song'}`}
                onSelect={(preset) =>
                  props.onPlayAlong?.(props.sessionId, preset)
                }
              />
            </Show>
            <Show when={session()?.status === 'completed' && hasSelection()}>
              <button
                class="session-result-btn session-result-btn-mixer"
                disabled={props.disabled}
                onClick={handleMixSelected}
              >
                <SlidersHorizontal /> Mix
              </button>
            </Show>
          </Show>
          <Show when={canProcessAgain()}>
            <button
              type="button"
              class="session-result-btn session-result-btn-primary"
              disabled={props.disabled}
              onClick={(e) => {
                e.stopPropagation()
                props.onRetry?.(props.sessionId)
              }}
            >
              <RotateCcw />{' '}
              {session()?.status === 'error' ? 'Retry' : 'Process again'}
            </button>
          </Show>
        </div>
      </Show>

      {/* The second tier's own switch. A card should be scannable in a
          second and stackable ten to a screen; this is where the rest
          went, and it says so rather than hiding it. */}
      <button
        type="button"
        class="session-more-toggle"
        aria-expanded={showMore()}
        onClick={(e) => {
          e.stopPropagation()
          setShowMore((v) => !v)
        }}
      >
        {showMore() ? 'Show less' : 'Show more'}
        <span class="session-more-chevron" classList={{ open: showMore() }}>
          <ChevronDown size={12} />
        </span>
      </button>

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
