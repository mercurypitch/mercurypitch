// ============================================================
// UVR Panel - Unified Vocal Separation Interface
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { generateVocalMidi } from '@/lib/midi-generator'
import { getProcessStatus } from '@/lib/uvr-api'
import { cancelUvrPipeline, destroyPipeline, preInitModel, runUvrPipeline } from '@/lib/uvr-processing-pipeline'
import type { UvrProcessingMode, UvrSession } from '@/stores/app-store'
import { cancelUvrSession, completeUvrSession, currentUvrSession, deleteAllUvrSessions, deleteUvrSession, getAllUvrSessions, getAllUvrSessionsReactive, getUvrProcessingMode, getUvrSession, retryUvrSession, saveAllUvrSessions, setCurrentUvrSession, setErrorUvrSession, setUvrProcessingMode, startUvrSession, updateUvrSessionOutputs, uvrProcessingMode, } from '@/stores/app-store'
import { StemMixer, UvrGuide, UvrProcessControl, UvrResultViewer, UvrSessionResult, UvrSettings, UvrUploadControl, } from '.'
import { CheckCircle, FileUpload, History, Music, Settings, Trash2, X, } from './icons'


export type UvrView = 'upload' | 'processing' | 'results' | 'history' | 'mixer'

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
  const [modelStatus, setModelStatus] = createSignal<'unloaded' | 'loading' | 'ready' | 'error'>('unloaded')
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

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    const mode = getUvrProcessingMode()
    const sessionId = startUvrSession(
      file.name,
      file.size,
      file.type,
      'separate',
      mode,
    )
    setCurrentView('processing')
    // Immediately start processing with the created session
    handleProcessStart(sessionId, mode)
  }

  const handleProcessStart = async (sessionId: string, mode?: UvrProcessingMode) => {
    const file = selectedFile()
    if (!file) {
      console.error('No file selected')
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
          setCurrentView('results')
        },
        onError: (message) => {
          setErrorUvrSession(sessionId, message)
          showError(message)
        },
      })
    } catch (error) {
      console.error('Processing error:', error)
      const message = error instanceof Error ? error.message : 'Processing failed'
      setErrorUvrSession(sessionId, message)
      showError(message)
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

  const handleSessionView = (sessionId: string) => {
    if (props.onSessionView) {
      props.onSessionView(sessionId)
    }
    // Set the session from history into current view
    const session = getUvrSession(sessionId)
    if (session) {
      setCurrentUvrSession(session)
      // Refresh outputs from API if we have an API session ID
      if (
        session.apiSessionId !== undefined &&
        session.status === 'completed'
      ) {
        refreshSessionOutputs(session)
      }
    }
    setCurrentView('results')
  }

  const handlePracticeStart = (
    mode: 'vocal' | 'instrumental' | 'midi' | 'full',
  ) => {
    const s = currentUvrSession()
    if (!s?.outputs) return

    setPrevView(currentView())
    setMixerPracticeMode(mode)
    setMixerSessionId(s.sessionId)

    // Set stems and requestedStems based on mode
    if (mode === 'vocal') {
      setMixerStems({ vocal: s.outputs.vocal })
      setMixerRequestedStems({ vocal: true })
    } else if (mode === 'instrumental') {
      setMixerStems({ instrumental: s.outputs.instrumental })
      setMixerRequestedStems({ instrumental: true })
    } else if (mode === 'midi') {
      // MIDI generation needs vocal audio — always include vocal URL
      setMixerStems({ vocal: s.outputs.vocal })
      setMixerRequestedStems({ midi: true })
    } else {
      // full: vocal + instrumental
      setMixerStems({
        vocal: s.outputs.vocal,
        instrumental: s.outputs.instrumental,
      })
      setMixerRequestedStems({ vocal: true, instrumental: true })
    }
    setCurrentView('mixer')

    if (props.onPracticeStart) {
      props.onPracticeStart(mode)
    }
  }

  const handleOpenMixerFromHistory = (
    sessionId: string,
    stems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean },
  ) => {
    const s = getUvrSession(sessionId)
    if (!s?.outputs) return
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
  }

  // Refresh outputs when viewing history
  createEffect(() => {
    if (currentView() === 'history') {
      refreshSessionOutputs()
    }
  })

  return (
    <div class="uvr-panel">
      {/* Header */}
      <div class="panel-header">
        <div class="header-left">
          <div class="header-icon">
            <Music />
          </div>
          <div>
            <h3>Vocal Separation</h3>
            <p class="header-subtitle">
              {allSessions().length > 0
                ? `${allSessions().length} session${allSessions().length !== 1 ? 's' : ''} · ${allSessions().filter((s) => s.status === 'completed').length} done`
                : 'Separate vocals and create MIDI'}
            </p>
          </div>
        </div>
        <div class="header-actions">
          <div class="uvr-mode-toggle" title={`Processing: ${uvrProcessingMode() === 'local' ? 'Browser' : 'Server'}`}>
            <button
              class={`mode-toggle-btn${uvrProcessingMode() === 'server' ? ' active' : ''}`}
              onClick={() => setUvrProcessingMode('server')}
            >
              Server
            </button>
            <button
              class={`mode-toggle-btn${uvrProcessingMode() === 'local' ? ' active' : ''}`}
              onClick={() => setUvrProcessingMode('local')}
            >
              Browser
            </button>
            <Show when={uvrProcessingMode() === 'local' && modelStatus() !== 'ready'}>
              <span
                class={`model-status-badge model-status-${modelStatus()}`}
                title={modelStatus() === 'error' ? modelError() : modelStatus() === 'loading' ? 'Loading ONNX model...' : ''}
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
          <button
            class="header-btn header-btn-ghost"
            onClick={() => setShowSettings(!showSettings())}
            title="UVR Settings"
          >
            <Settings />
          </button>
          <button
            class="header-btn header-btn-ghost"
            onClick={() => setShowGuide(!showGuide())}
            title="View Guide"
          >
            <Music />
          </button>
          <button
            class="header-btn header-btn-ghost"
            onClick={() => setCurrentView('history')}
            title="History"
          >
            <History />
          </button>
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
            {/* Sessions list first (if any exist) */}
            <Show when={allSessions().length > 0}>
              <div class="section-header">
                <h4>Recent Sessions</h4>
                <button
                  class="back-btn"
                  onClick={() => setCurrentView('history')}
                >
                  View All ({allSessions().length})
                </button>
              </div>
              <div class="history-list history-list-inline">
                <For
                  each={allSessions()
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .slice(0, 12)}
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
                    />
                  )}
                </For>
              </div>
              <div class="upload-divider">
                <span class="upload-divider-text">or start a new session</span>
              </div>
              <div class="section-header">
                <h4>Upload Audio</h4>
                <button class="guide-toggle" onClick={() => setShowGuide(true)}>
                  <Music /> See Guide
                </button>
              </div>
            </Show>
            <Show when={allSessions().length === 0}>
              <div class="section-header">
                <h4>Upload Audio</h4>
                <button class="guide-toggle" onClick={() => setShowGuide(true)}>
                  <Music /> See Guide
                </button>
              </div>
            </Show>
            <UvrUploadControl
              onFileSelect={handleFileSelect}
              onFileReady={setSelectedFile}
              onProcessStart={(file) => {
                void handleProcessStart(file)
              }}
              processing={session()?.status === 'processing'}
            />
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
                onCancel={() => {
                  cancelUvrPipeline(session()!.processingMode ?? 'server')
                  cancelUvrSession(session()!.sessionId)
                  setCurrentView('upload')
                }}
                onRetry={() => {
                  retryUvrSession(session()!.sessionId)
                  void handleProcessStart(session()!.sessionId, session()!.processingMode)
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
              <h4>Processing Results</h4>
              <button class="back-btn" onClick={() => setCurrentView('upload')}>
                <FileUpload /> Back to Upload
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
                onExport={(type) => {
                  void handleExport(type)
                }}
              />
            )}
          </div>
        </Show>

        <Show when={currentView() === 'history'}>
          <div class="view-section history-section">
            <div class="section-header">
              <h4>Processing History</h4>
              <div class="section-header-actions">
                <Show when={allSessions().length > 0}>
                  <button
                    class="delete-all-btn"
                    onClick={() => setShowDeleteAllConfirm(true)}
                  >
                    <Trash2 /> Delete All
                  </button>
                </Show>
                <button
                  class="back-btn"
                  onClick={() => setCurrentView('upload')}
                >
                  <FileUpload /> New Upload
                </button>
              </div>
            </div>
            <div class="history-list">
              {allSessions().length === 0 ? (
                <div class="history-empty">
                  <Music />
                  <p>No processing history yet</p>
                  <button onClick={() => setCurrentView('upload')}>
                    Start First Session
                  </button>
                </div>
              ) : (
                <For
                  each={allSessions().sort((a, b) => b.createdAt - a.createdAt)}
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
                    />
                  )}
                </For>
              )}
            </div>
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
  )
}
