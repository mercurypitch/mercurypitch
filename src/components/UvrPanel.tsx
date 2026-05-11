// ============================================================
// UVR Panel - Unified Vocal Separation Interface
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { computeFileHash } from '@/lib/file-hash'
import { generateVocalMidi } from '@/lib/midi-generator'
import { getProcessStatus } from '@/lib/uvr-api'
import { cancelUvrPipeline, destroyPipeline, preInitModel, runUvrPipeline, } from '@/lib/uvr-processing-pipeline'
import { findSessionByFileHash, getOriginalFileBlob, hydrateStemUrls, saveUvrSession, } from '@/db/services/uvr-service'
import type { UvrProcessingMode, UvrSession } from '@/stores/app-store'
import { cancelUvrSession, completeUvrSession, currentUvrSession, deleteAllUvrSessions, deleteUvrSession, getAllUvrSessions, getAllUvrSessionsReactive, getUvrProcessingMode, getUvrSession, getUvrSessionByHash, retryUvrSession, saveAllUvrSessions, setCurrentUvrSession, setErrorUvrSession, setUvrProcessingMode, startUvrSession, updateUvrSessionOutputs, uvrProcessingMode, } from '@/stores/app-store'
import { showNotification } from '@/stores/notifications-store'
import { StemMixer, UvrGuide, UvrProcessControl, UvrResultViewer, UvrSessionResult, UvrSettings, UvrUploadControl, } from '.'
import { CheckCircle, ImportFile, Music, Settings, Trash2, X, } from './icons'

export type UvrView = 'upload' | 'processing' | 'results' | 'mixer'

interface UvrPanelProps {
  /** Initial view from hash route — only used on first mount */
  initialView?: UvrView
  /** Initial session ID from hash route — loads session and navigates to results on mount */
  initialSessionId?: string
  /** Called when the active UVR session changes — used to sync URL hash */
  onSessionChange?: (sessionId: string | null) => void
  /** Called when the current view changes — used to sync URL hash */
  onViewChange?: (view: UvrView) => void
  /** Callback when practice is started */
  onPracticeStart?: (mode: 'vocal' | 'instrumental' | 'midi' | 'full') => void
  /** Callback when a session is exported */
  onExport?: (
    type: 'vocal' | 'instrumental' | 'vocal-midi' | 'instrumental-midi',
  ) => void
  /** Callback when session is viewed */
  onSessionView?: (sessionId: string) => void
  /** Callback to close panel */
  onClose?: () => void
}

export const UvrPanel: Component<UvrPanelProps> = (props) => {
  const [currentView, setCurrentView] = createSignal<UvrView>(
    props.initialView || 'upload',
  )
  const [_onError, setOnError] = createSignal('')

  // Error handling
  const showError = (message: string) => {
    console.error(message)
    setOnError(message)
  }
  const _clearError = () => setOnError('')
  const [showGuide, setShowGuide] = createSignal(false)
  const [showSettings, setShowSettings] = createSignal(false)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = createSignal(false)
  const [deleteAllToast, setDeleteAllToast] = createSignal('')
  const [midiExporting, setMidiExporting] = createSignal(false)
  const [midiExportProgress, setMidiExportProgress] = createSignal(0)
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null)
  const [prevView, setPrevView] = createSignal<UvrView>('upload')
  const [mixerStems, setMixerStems] = createSignal<{
    vocal?: string
    vocalMidi?: string
    instrumental?: string
  }>({})
  const [mixerSessionId, setMixerSessionId] = createSignal('')
  const [mixerPracticeMode, setMixerPracticeMode] = createSignal<
    'vocal' | 'instrumental' | 'full' | 'midi'
  >('full')
  const [mixerRequestedStems, setMixerRequestedStems] = createSignal<{
    vocal?: boolean
    instrumental?: boolean
    midi?: boolean
  }>()

  // Computed session state
  const session = () => currentUvrSession()
  const allSessions = () => getAllUvrSessionsReactive()

  // Model loading state for browser mode
  const [modelStatus, setModelStatus] = createSignal<
    'unloaded' | 'loading' | 'ready' | 'error'
  >('unloaded')
  const [modelError, setModelError] = createSignal('')

  // Pre-initialize ONNX model when switching to browser mode
  createEffect(() => {
    const mode = uvrProcessingMode()
    if (mode === 'local' && modelStatus() === 'unloaded') {
      setModelStatus('loading')
      setModelError('')
      preInitModel()
        .then(() => setModelStatus('ready'))
        .catch((err: Error) => {
          setModelStatus('error')
          setModelError(err.message || 'Failed to load model')
        })
    }
  })

  // Clean up separator when switching away from local mode or unmounting
  createEffect(() => {
    const mode = uvrProcessingMode()
    if (mode === 'server' && modelStatus() !== 'unloaded') {
      destroyPipeline()
      setModelStatus('unloaded')
    }
  })

  onCleanup(() => {
    destroyPipeline()
  })

  // React to initialView prop changes (from hash navigation)
  let lastInitialView: UvrView | null = null
  createEffect(() => {
    const v = props.initialView
    if (v && v !== lastInitialView) {
      lastInitialView = v
      setCurrentView(v)
    }
  })

  // Sync active session and view to parent (for URL hash)
  createEffect(() => {
    const view = currentView()
    props.onViewChange?.(view)
    if (view === 'results' || view === 'mixer') {
      const s = currentUvrSession()
      if (s?.sessionId !== undefined) {
        props.onSessionChange?.(s.sessionId)
        return
      }
    }
    props.onSessionChange?.(null)
  })

  // Deep-link: navigate to session from hash route (reactive to URL changes)
  let lastLoadedSessionId: string | null = null
  createEffect(() => {
    const sid = props.initialSessionId
    if (sid !== undefined && sid !== lastLoadedSessionId) {
      lastLoadedSessionId = sid
      handleSessionView(sid)
    }
  })

  // Hydrate stale blob URLs from IndexedDB for local-mode completed sessions
  const ensureHydrated = async (session: UvrSession): Promise<UvrSession> => {
    if (session.processingMode === 'local' && session.status === 'completed') {
      const urls = await hydrateStemUrls(session.sessionId)
      if (urls) {
        return { ...session, outputs: { ...session.outputs, ...urls } }
      }
    }
    return session
  }

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)

    // Compute file hash for dedup
    const hash = await computeFileHash(file)

    // Check localStorage first for a completed session with this hash
    const existing = getUvrSessionByHash(hash)
    if (existing) {
      const hydrated = await ensureHydrated(existing)
      setCurrentUvrSession(hydrated)
      setCurrentView('results')
      showNotification('This file was already processed — loaded existing stems.', 'info')
      return
    }

    // Check IndexedDB for persisted sessions with this hash
    const dbMatch = await findSessionByFileHash(hash)
    if (dbMatch) {
      const stored = getUvrSession(dbMatch.sessionId)
      if (stored && stored.status === 'completed') {
        const hydrated = await ensureHydrated(stored)
        setCurrentUvrSession(hydrated)
        setCurrentView('results')
        showNotification('This file was already processed — loaded existing stems.', 'info')
        return
      }
    }

    const mode = getUvrProcessingMode()
    const sessionId = startUvrSession(
      file.name,
      file.size,
      file.type,
      'separate',
      mode,
      hash,
    )
    setCurrentView('processing')
    handleProcessStart(sessionId, mode)
  }

  const handleProcessStart = async (
    sessionId: string,
    mode?: UvrProcessingMode,
  ) => {
    let file = selectedFile()
    if (!file) {
      // Retry path: original file is no longer in memory, load from IndexedDB
      file = await getOriginalFileBlob(sessionId)
    }
    if (!file) {
      const msg = 'File lost from memory. Please start a new session.'
      console.error(msg)
      setErrorUvrSession(sessionId, msg)
      showNotification(msg, 'warning')
      return
    }

    const processingMode = mode ?? getUvrProcessingMode()

    // Set session to processing status
    const sessions = getAllUvrSessions()
    const session = sessions.find((s) => s.sessionId === sessionId)
    if (session) {
      session.status = 'processing'
      saveAllUvrSessions(sessions)
      setCurrentUvrSession({ ...session })
    }

    try {
      await runUvrPipeline(file, sessionId, processingMode, {
        onProgress: (_pct) => {
          // Progress already updated inside the pipeline via updateUvrSessionProgress
        },
        onComplete: (result) => {
          completeUvrSession(sessionId, result.outputs, result.stemMeta)
          // Persist session to IndexedDB for hash-based dedup
          const s = getUvrSession(sessionId)
          if (s) {
            void saveUvrSession({
              sessionId,
              status: 'completed',
              progress: 100,
              fileHash: s.fileHash,
              originalFileName: s.originalFile?.name ?? file.name,
              originalFileSize: s.originalFile?.size ?? file.size,
              originalFileType: s.originalFile?.mimeType ?? file.type,
              processingMode: processingMode,
              processingTime: s.processingTime,
            })
          }
          setCurrentView('results')
        },
        onError: (message) => {
          setErrorUvrSession(sessionId, message)
          showError(message)
        },
      })
    } catch (error) {
      console.error('Processing error:', error)
      const message =
        error instanceof Error ? error.message : 'Processing failed'
      setErrorUvrSession(sessionId, message)
      showNotification(message, 'error')
    }
  }

  const handleExport = async (
    type: 'vocal' | 'instrumental' | 'vocal-midi' | 'instrumental-midi',
  ) => {
    const s = session()
    if (!s?.outputs) return

    const url =
      type === 'vocal'
        ? s.outputs.vocal
        : type === 'instrumental'
          ? s.outputs.instrumental
          : type === 'vocal-midi'
            ? s.outputs.vocalMidi
            : s.outputs.instrumentalMidi

    if (url === undefined) return

    try {
      let blob: Blob
      const ext = type.includes('midi') ? '.mid' : '.wav'

      if (
        type === 'vocal-midi' &&
        (url === '' || url === undefined) &&
        s.outputs.vocal !== undefined
      ) {
        // Generate MIDI on-the-fly from vocal stem
        setMidiExporting(true)
        setMidiExportProgress(0)
        const midiBlob = await generateVocalMidi(s.outputs.vocal, (pct) =>
          setMidiExportProgress(pct),
        )
        setMidiExporting(false)
        if (!midiBlob) {
          console.error('MIDI generation produced no notes')
          return
        }
        blob = midiBlob
      } else {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        blob = await resp.blob()
      }

      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const base = (s.originalFile?.name ?? 'audio')
        .replace(/\.[^.]+$/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
      a.download = `${base}_${type.replace('-', '_')}${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      setMidiExporting(false)
      console.error('Download failed:', err)
    }
    props.onExport?.(type)
  }

  const handleSessionView = async (sessionId: string) => {
    if (props.onSessionView) {
      props.onSessionView(sessionId)
    }
    const session = getUvrSession(sessionId)
    if (!session) {
      setCurrentView('results')
      return
    }
    // Refresh outputs from API if we have an API session ID
    if (
      session.apiSessionId !== undefined &&
      session.status === 'completed'
    ) {
      refreshSessionOutputs(session)
    }
    // Hydrate blob URLs from IndexedDB before showing results
    // (blob: URLs from localStorage are dead after page reload)
    const hydrated = await ensureHydrated(session)
    setCurrentUvrSession(hydrated)
    // Persist the hydrated URLs to localStorage
    if (hydrated !== session) {
      const all = getAllUvrSessions()
      const idx = all.findIndex((s) => s.sessionId === sessionId)
      if (idx !== -1) {
        all[idx] = { ...all[idx], outputs: { ...all[idx].outputs, ...hydrated.outputs } }
        saveAllUvrSessions(all)
      }
    }
    setCurrentView('results')
  }

  const handlePracticeStart = async (
    mode: 'vocal' | 'instrumental' | 'midi' | 'full',
  ) => {
    const current = currentUvrSession()
    if (!current?.outputs) return
    const s = await ensureHydrated(current)

    setCurrentUvrSession(s)
    setPrevView(currentView())
    setMixerPracticeMode(mode)
    setMixerSessionId(s.sessionId)

    // Set stems and requestedStems based on mode
    if (mode === 'vocal') {
      setMixerStems({ vocal: s.outputs?.vocal })
      setMixerRequestedStems({ vocal: true })
    } else if (mode === 'instrumental') {
      setMixerStems({ instrumental: s.outputs?.instrumental })
      setMixerRequestedStems({ instrumental: true })
    } else if (mode === 'midi') {
      // MIDI generation needs vocal audio — always include vocal URL
      setMixerStems({ vocal: s.outputs?.vocal })
      setMixerRequestedStems({ midi: true })
    } else {
      // full: vocal + instrumental
      setMixerStems({
        vocal: s.outputs?.vocal,
        instrumental: s.outputs?.instrumental,
      })
      setMixerRequestedStems({ vocal: true, instrumental: true })
    }
    setCurrentView('mixer')

    if (props.onPracticeStart) {
      props.onPracticeStart(mode)
    }
  }

  const handleMixStart = async (selectedStems: string[]) => {
    const current = currentUvrSession()
    if (!current?.outputs) return
    const s = await ensureHydrated(current)

    setCurrentUvrSession(s)
    setPrevView(currentView())
    setMixerSessionId(s.sessionId)

    const stemUrls: { vocal?: string; instrumental?: string } = {}
    const requested: {
      vocal?: boolean
      instrumental?: boolean
      midi?: boolean
    } = {}

    for (const key of selectedStems) {
      if (key === 'vocal') {
        stemUrls.vocal = s.outputs?.vocal
        requested.vocal = true
      } else if (key === 'instrumental') {
        stemUrls.instrumental = s.outputs?.instrumental
        requested.instrumental = true
      } else if (key === 'vocalMidi') {
        // MIDI needs the vocal audio to generate from
        stemUrls.vocal = s.outputs?.vocal
        requested.midi = true
      }
    }

    setMixerStems(stemUrls)
    setMixerRequestedStems(requested)
    setMixerPracticeMode('full')
    setCurrentView('mixer')
  }

  const handleOpenMixerFromHistory = async (
    sessionId: string,
    stems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean },
  ) => {
    const raw = getUvrSession(sessionId)
    if (!raw?.outputs) return
    const s = await ensureHydrated(raw)
    if (!s.outputs) return
    setCurrentUvrSession(s)

    setPrevView(currentView())
    const filter = stems || {}
    const wantsMidi = filter.midi === true
    const wantsVocal = filter.vocal !== false
    const wantsInst = filter.instrumental !== false

    // Determine practice mode
    if (Object.keys(filter).length === 0) {
      setMixerPracticeMode('full')
    } else if (wantsMidi && !wantsVocal && !wantsInst) {
      setMixerPracticeMode('midi')
    } else if (wantsMidi) {
      setMixerPracticeMode('midi')
    } else if (wantsVocal && !wantsInst) {
      setMixerPracticeMode('vocal')
    } else if (!wantsVocal && wantsInst) {
      setMixerPracticeMode('instrumental')
    } else {
      setMixerPracticeMode('full')
    }

    // MIDI generation requires vocal audio — always include vocal URL when MIDI is wanted
    setMixerStems({
      vocal: wantsVocal || wantsMidi ? s.outputs.vocal : undefined,
      instrumental: wantsInst ? s.outputs.instrumental : undefined,
    })
    setMixerRequestedStems(
      Object.keys(filter).length > 0
        ? { vocal: wantsVocal, instrumental: wantsInst, midi: wantsMidi }
        : undefined,
    )
    setMixerSessionId(s.sessionId)
    setCurrentView('mixer')
  }

  const handleExportSession = async (
    sessionId: string,
    type: 'vocal' | 'instrumental' | 'vocal-midi',
  ) => {
    const s = getUvrSession(sessionId)
    if (!s?.outputs) return

    const url =
      type === 'vocal'
        ? s.outputs.vocal
        : type === 'instrumental'
          ? s.outputs.instrumental
          : s.outputs.vocalMidi

    if (url === undefined) return

    try {
      let blob: Blob
      const ext = type === 'vocal-midi' ? '.mid' : '.wav'

      if (
        type === 'vocal-midi' &&
        (url === '' || url === undefined) &&
        s.outputs.vocal !== undefined
      ) {
        setMidiExporting(true)
        setMidiExportProgress(0)
        const midiBlob = await generateVocalMidi(s.outputs.vocal, (pct) =>
          setMidiExportProgress(pct),
        )
        setMidiExporting(false)
        if (!midiBlob) {
          console.error('MIDI generation produced no notes')
          return
        }
        blob = midiBlob
      } else {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        blob = await resp.blob()
      }

      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const base = (s.originalFile?.name ?? 'audio')
        .replace(/\.[^.]+$/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
      a.href = blobUrl
      a.download = `${base}_${type.replace('-', '_')}${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      setMidiExporting(false)
      console.error('Download failed:', err)
    }
  }

  const handleDeleteAll = () => {
    deleteAllUvrSessions()
    setShowDeleteAllConfirm(false)
    setDeleteAllToast('All sessions deleted')
    setTimeout(() => setDeleteAllToast(''), 2500)
  }

  // Refresh session outputs from API
  const refreshSessionOutputs = async (sessionToRefresh?: UvrSession) => {
    const sessions = sessionToRefresh
      ? [sessionToRefresh]
      : getAllUvrSessions().filter(
          (s) => s.apiSessionId !== undefined && s.status === 'completed',
        )

    for (const s of sessions) {
      if (s.apiSessionId === undefined || s.apiSessionId === '') continue
      try {
        const status = await getProcessStatus(s.apiSessionId)
        if (status.status === 'completed' && status.files.length > 0) {
          updateUvrSessionOutputs(s.sessionId, status.files)
        }
      } catch {
        // API unavailable — keep stored data
      }
    }

    // Hydrate local-mode sessions from IndexedDB (blob URLs stale after reload)
    const localSessions = sessionToRefresh
      ? [sessionToRefresh].filter(
          (s) => s.processingMode === 'local' && s.status === 'completed',
        )
      : getAllUvrSessions().filter(
          (s) => s.processingMode === 'local' && s.status === 'completed',
        )
    for (const s of localSessions) {
      void hydrateStemUrls(s.sessionId).then((urls) => {
        if (urls) {
          const all = getAllUvrSessions()
          const idx = all.findIndex((x) => x.sessionId === s.sessionId)
          if (idx !== -1) {
            all[idx] = { ...all[idx], outputs: { ...all[idx].outputs, ...urls } }
            saveAllUvrSessions(all)
          }
        }
      })
    }
  }

  return (
    <div class="uvr-panel">
      {/* Header */}
      <div class="panel-header">
        <div class="header-left">
          <div>
            <h3>Karaoke | Vocal Separation</h3>
            <p class="header-subtitle">
              {allSessions().length > 0
                ? `${allSessions().length} session${allSessions().length !== 1 ? 's' : ''} · ${allSessions().filter((s) => s.status === 'completed').length} done`
                : 'Separate vocals and create MIDI'}
            </p>
          </div>
        </div>
        <div class="header-actions">
          <div
            class="uvr-mode-toggle"
            title={`Processing: ${uvrProcessingMode() === 'local' ? 'Browser' : 'Server'}`}
          >
            <button
              class={`mode-toggle-btn mode-toggle-btn-disabled${uvrProcessingMode() === 'server' ? ' active' : ''}`}
              onClick={() =>
                showNotification(
                  'Server-side processing not yet available.',
                  'info',
                )
              }
            >
              Server
            </button>
            <button
              class={`mode-toggle-btn${uvrProcessingMode() === 'local' ? ' active' : ''}`}
              onClick={() => setUvrProcessingMode('local')}
            >
              Browser
            </button>
            <Show
              when={
                uvrProcessingMode() === 'local' && modelStatus() !== 'ready'
              }
            >
              <span
                class={`model-status-badge model-status-${modelStatus()}`}
                title={
                  modelStatus() === 'error'
                    ? modelError()
                    : modelStatus() === 'loading'
                      ? 'Loading ONNX model...'
                      : ''
                }
              >
                <Show when={modelStatus() === 'loading'}>
                  <span class="model-loading-dot" />
                </Show>
                <Show when={modelStatus() === 'error'}>
                  <span class="model-error-icon">!</span>
                </Show>
              </span>
            </Show>
          </div>
          <div class="uvr-view-tabs">
            <button
              class="view-tab"
              classList={{ active: currentView() === 'upload' }}
              onClick={() => {
                setCurrentView('upload')
                props.onViewChange?.('upload')
                props.onSessionChange?.(null)
              }}
            >
              <ImportFile />
              <span>Sessions</span>
            </button>
            <button
              class="view-tab"
              classList={{ active: showSettings() }}
              onClick={() => setShowSettings(!showSettings())}
            >
              <Settings />
              <span>Settings</span>
            </button>
            <button
              class="view-tab"
              classList={{ active: showGuide() }}
              onClick={() => setShowGuide(!showGuide())}
            >
              <Music />
              <span>Guide</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div class="panel-content">
        {showGuide() && (
          <div class="guide-modal">
            <div class="guide-container">
              <div class="guide-header">
                <h3>Vocal Separation Guide</h3>
                <button class="guide-close" onClick={() => setShowGuide(false)}>
                  <X />
                </button>
              </div>
              <UvrGuide onClose={() => setShowGuide(false)} />
            </div>
          </div>
        )}

        {showSettings() && (
          <div class="guide-modal" onClick={() => setShowSettings(false)}>
            <div class="guide-container" onClick={(e) => e.stopPropagation()}>
              <div class="guide-header">
                <h3>UVR Settings</h3>
                <button
                  class="guide-close"
                  onClick={() => setShowSettings(false)}
                >
                  <X />
                </button>
              </div>
              <UvrSettings />
            </div>
          </div>
        )}

        <Show when={currentView() === 'upload'}>
          <div class="view-section upload-section">
            <div class="section-header">
              <h4>Upload Audio</h4>
              <button class="guide-toggle" onClick={() => setShowGuide(true)}>
                <Music /> See Guide
              </button>
            </div>
            <UvrUploadControl
              onFileSelect={handleFileSelect}
              onFileReady={setSelectedFile}
              onProcessStart={(file) => {
                void handleProcessStart(file)
              }}
              processing={session()?.status === 'processing'}
            />
            <Show when={allSessions().length > 0}>
              <div class="section-header">
                <h4>Recent Sessions</h4>
                <button
                  class="delete-all-btn"
                  onClick={() => setShowDeleteAllConfirm(true)}
                >
                  <Trash2 /> Delete All
                </button>
              </div>
              <div class="history-list history-list-inline">
                <For
                  each={allSessions()
                    .sort((a, b) => b.createdAt - a.createdAt)}
                >
                  {(s) => (
                    <UvrSessionResult
                      sessionId={s.sessionId}
                      onView={() => handleSessionView(s.sessionId)}
                      onExport={(type) => {
                        void handleExportSession(
                          s.sessionId,
                          type as 'vocal' | 'instrumental' | 'vocal-midi',
                        )
                      }}
                      onOpenMixer={(sessionId, stems) =>
                        handleOpenMixerFromHistory(sessionId, stems)
                      }
                      onRetry={(sessionId) => {
                        retryUvrSession(sessionId)
                        void handleProcessStart(
                          sessionId,
                          getUvrSession(sessionId)?.processingMode,
                        )
                      }}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={currentView() === 'processing'}>
          <div class="view-section processing-section">
            <div class="section-header">
              <h4>Processing Audio</h4>
            </div>
            {session() && (
              <UvrProcessControl
                sessionId={session()!.sessionId}
                apiSessionId={session()!.apiSessionId}
                status={session()!.status}
                progress={session()!.progress}
                indeterminate={session()!.indeterminate}
                processingTime={session()!.processingTime}
                error={session()!.error}
                processingMode={session()!.processingMode}
                numChunks={session()!.numChunks}
                provider={session()!.provider}
                originalFileName={session()!.originalFile?.name}
                onCancel={() => {
                  cancelUvrPipeline(
                    session()!.processingMode ?? 'server',
                    session()!.apiSessionId,
                  )
                  cancelUvrSession(session()!.sessionId)
                  setCurrentView('upload')
                }}
                onRetry={() => {
                  retryUvrSession(session()!.sessionId)
                  void handleProcessStart(
                    session()!.sessionId,
                    session()!.processingMode,
                  )
                }}
                onNewSession={() => setCurrentView('upload')}
                onDeleteAndNew={() => {
                  deleteUvrSession(session()!.sessionId)
                  setCurrentView('upload')
                }}
              />
            )}
          </div>
        </Show>

        <Show when={currentView() === 'results'}>
          <div class="view-section results-section">
            <div class="section-header">
              <h4>
                Processing Results for{' '}
                {session()?.originalFile?.name ?? 'audio'}
              </h4>
              <button class="back-btn" onClick={() => setCurrentView('upload')}>
                <ImportFile /> Back to Upload
              </button>
            </div>
            {session() && (
              <UvrResultViewer
                outputs={session()!.outputs}
                stemMeta={session()!.stemMeta}
                processingTime={session()!.processingTime}
                sessionId={session()!.sessionId}
                originalFileName={session()?.originalFile?.name}
                onStartPractice={handlePracticeStart}
                onStartMix={handleMixStart}
                onExport={(type) => {
                  void handleExport(type)
                }}
              />
            )}
          </div>
        </Show>

        {/* Stem Mixer Inline */}
        <Show when={currentView() === 'mixer'}>
          <div class="view-section mixer-section">
            <StemMixer
              stems={mixerStems()}
              sessionId={mixerSessionId()}
              songTitle={currentUvrSession()?.originalFile?.name ?? 'Unknown'}
              practiceMode={mixerPracticeMode()}
              requestedStems={mixerRequestedStems()}
              onBack={() => setCurrentView(prevView())}
            />
          </div>
        </Show>

      </div>

      {/* Delete All Confirmation Modal */}
      <Show when={showDeleteAllConfirm()}>
        <div
          class="delete-all-overlay"
          onClick={() => setShowDeleteAllConfirm(false)}
        >
          <div class="delete-all-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Delete All Sessions</h4>
            <p>
              This will permanently remove all {allSessions().length} session
              {allSessions().length !== 1 ? 's' : ''} and their generated files.
              This action cannot be undone.
            </p>
            <div class="delete-all-actions">
              <button
                class="delete-all-cancel"
                onClick={() => setShowDeleteAllConfirm(false)}
              >
                Cancel
              </button>
              <button class="delete-all-confirm" onClick={handleDeleteAll}>
                <Trash2 /> Delete All
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Delete All Toast */}
      <Show when={deleteAllToast()}>
        <div class="history-toast">
          <span class="history-toast-icon">
            <CheckCircle />
          </span>
          {deleteAllToast()}
        </div>
      </Show>

      {/* MIDI Export Progress Toast */}
      <Show when={midiExporting()}>
        <div class="history-toast">
          <span class="history-toast-icon">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="var(--border, #30363d)"
                stroke-width="2"
              />
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="var(--accent, #8b5cf6)"
                stroke-width="2"
                stroke-dasharray={String(2 * Math.PI * 10)}
                stroke-dashoffset={String(
                  2 * Math.PI * 10 * (1 - midiExportProgress() / 100),
                )}
                stroke-linecap="round"
                transform="rotate(-90 12 12)"
              />
            </svg>
          </span>
          Generating MIDI... {midiExportProgress()}%
        </div>
      </Show>

    </div>
  )
}
