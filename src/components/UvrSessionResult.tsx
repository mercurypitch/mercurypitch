// ============================================================
// UVR Session Result Display
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, Show } from 'solid-js'
import { deleteUvrSessionFromDb } from '@/db/services/uvr-service'
import { hasStemFingerprint } from '@/lib/shazam/melody-fingerprints'
import { deleteUvrSession, getUvrSession } from '@/stores/app-store'
import type { UvrSession, UvrStatus } from '@/types/uvr'
import { Box, Calendar, CheckCircle, Cpu, Headphones, Loader2, Midi, Music, Play, RotateCcw, Server, Share, SlidersHorizontal, Trash2, Voice, X, XCircle, Zap, } from './icons'
import { Button } from './shared/Button'
import styles from './UvrSessionResult.module.css'

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
  onReindexStem?: (sessionId: string) => void
}

export const UvrSessionResult: Component<SessionResultProps> = (props) => {
  const session = () => getUvrSession(props.sessionId)
  const vocalFingerprinted = createMemo(() =>
    hasStemFingerprint(props.sessionId),
  )
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false)
  const [toastMessage, setToastMessage] = createSignal('')
  const [selectedStems, setSelectedStems] = createSignal<Set<string>>(new Set())
  const [reindexing, setReindexing] = createSignal(false)

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
      class={`${styles.uvrSessionResult} ${
        props.disabled === true && session()?.status !== 'processing'
          ? styles.disabled
          : ''
      }`}
    >
      {/* Header */}
      <div class={styles.sessionHeader}>
        <div class={styles.sessionIconWrapper}>
          <Music />
        </div>
        <div class={styles.sessionTitleArea}>
          <h3>UVR Session</h3>
          <p class={styles.sessionFilename}>
            {session()?.originalFile?.name ?? 'Unknown'}
          </p>
          <p
            class={styles.sessionIdPill}
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
        <Button
          variant="secondary"
          class={styles.sessionDeleteBtn}
          onClick={handleDelete}
          aria-label="Delete session"
          disabled={props.disabled}
        >
          <Trash2 />
        </Button>
        <Button
          variant="secondary"
          class={styles.sessionShareBtn}
          onClick={(e) => {
            void handleCopyLink(e)
          }}
          title="Copy share link"
          disabled={props.disabled}
        >
          <Share />
        </Button>
      </div>

      {/* Status */}
      <div
        class={styles.statusBar}
        style={{
          '--status-color': getStatusColor(session()?.status ?? 'idle'),
        }}
      >
        <span class={styles.statusIcon}>
          {getStatusIcon(session()?.status ?? 'idle')}
        </span>
        <span class={styles.statusText}>
          {session()?.status === 'error'
            ? (session()?.error ?? 'Processing failed')
            : session()?.status === 'completed'
              ? 'Completed'
              : session()?.status === 'processing'
                ? `Processing... ${Math.round(session()?.progress ?? 0)}%`
                : (session()?.status ?? 'Idle')}
        </span>
        <span class={styles.statusTime}>
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
          <div class={styles.statusProvider}>
            <span
              class={styles.providerIcon}
              classList={{
                [styles.providerGpu]: session()?.provider === 'webgpu',
              }}
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
          <span class={styles.statusTime}>Idle</span>
        </Show>
      </div>

      {/* Info Grid */}
      <div class={styles.infoGrid}>
        <div class={styles.infoItem}>
          <span class={styles.infoIcon}>
            <Calendar />
          </span>
          <div class={styles.infoContent}>
            <span class={styles.infoLabel}>Created</span>
            <span class={styles.infoValue}>
              {formatDate(session()?.createdAt ?? 0)}
            </span>
          </div>
        </div>
        <Show when={session()?.originalFile}>
          <div class={styles.infoItem}>
            <span class={styles.infoIcon}>
              <Box />
            </span>
            <div class={styles.infoContent}>
              <span class={styles.infoLabel}>Size</span>
              <span class={styles.infoValue}>
                {formatFileSize(session()!.originalFile!.size)}
              </span>
            </div>
          </div>
        </Show>
      </div>

      {/* Outputs — compact multi-select stem pills */}
      <Show when={session()?.outputs}>
        <div class={styles.outputsSection}>
          <h4>Available Stems</h4>
          <div class={styles.stemPills}>
            <Show when={session()?.outputs?.vocal}>
              <button
                class={`${styles.stemPill} ${styles.stemPillVocal} ${selectedStems().has('vocal') ? styles.stemPillSelected : ''}`}
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
                    class={styles.stemPillShazam}
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
                  class={styles.stemPillReindex}
                  classList={{ [styles.stemPillReindexing]: reindexing() }}
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
                  <span class={styles.stemPillDuration}>
                    {formatDuration(session()?.stemMeta?.vocal?.duration)}
                  </span>
                </Show>
              </button>
            </Show>
            <Show when={session()?.outputs?.instrumental}>
              <button
                class={`${styles.stemPill} ${styles.stemPillInstrumental} ${selectedStems().has('instrumental') ? styles.stemPillSelected : ''}`}
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
                  <span class={styles.stemPillDuration}>
                    {formatDuration(
                      session()?.stemMeta?.instrumental?.duration,
                    )}
                  </span>
                </Show>
              </button>
            </Show>
            <Show when={session()?.outputs?.vocal}>
              <button
                class={`${styles.stemPill} ${styles.stemPillMidi} ${selectedStems().has('vocal-midi') ? styles.stemPillSelected : ''}`}
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
        <div class={styles.sessionResultActions}>
          <Show
            when={
              session()?.status === 'completed' ||
              session()?.status === 'processing'
            }
          >
            <Button
              variant="primary"
              class={styles.sessionResultBtn}
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
            </Button>
            <Show when={session()?.status === 'completed' && hasSelection()}>
              <Button
                variant="secondary"
                class={`${styles.sessionResultBtn} ${styles.sessionResultBtnMixer}`}
                disabled={props.disabled}
                onClick={handleMixSelected}
              >
                <SlidersHorizontal /> Mix Selected
              </Button>
            </Show>
          </Show>
          <Show when={session()?.status === 'error' && session()?.originalFile}>
            <Button
              variant="primary"
              class={styles.sessionResultBtn}
              disabled={props.disabled}
              onClick={(e) => {
                e.stopPropagation()
                props.onRetry?.(props.sessionId)
              }}
            >
              <RotateCcw /> Retry
            </Button>
          </Show>
        </div>
      </Show>

      {/* Delete Confirmation Modal */}
      <Show when={showDeleteConfirm()}>
        <div
          class={styles.deleteConfirmOverlay}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            class={styles.deleteConfirmDialog}
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Delete Session</h4>
            <p>
              This action cannot be undone. The session and all generated files
              will be permanently removed.
            </p>
            <div class={styles.deleteConfirmActions}>
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete}>
                <Trash2 /> Delete
              </Button>
            </div>
          </div>
        </div>
      </Show>

      {/* Toast Notification */}
      <Show when={toastMessage()}>
        <div class={styles.sessionToast}>
          <span class={styles.sessionToastIcon}>
            <CheckCircle />
          </span>
          {toastMessage()}
        </div>
      </Show>
    </div>
  )
}
