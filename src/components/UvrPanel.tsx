// ============================================================
// UVR Panel - Unified Vocal Separation Interface
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import type { OutputFile } from '@/lib/uvr-api'
import { DEFAULT_PROCESS_REQUEST, getProcessStatus, pollForCompletion, processAudio, } from '@/lib/uvr-api'
import type { UvrSession } from '@/stores/app-store'
import { cancelUvrSession, completeUvrSession, currentUvrSession, deleteAllUvrSessions, getAllUvrSessions, getAllUvrSessionsReactive, getUvrSession, saveAllUvrSessions, setCurrentUvrSession, setErrorUvrSession, setUvrSessionApiId, startUvrSession, updateUvrSessionOutputs, updateUvrSessionProgress, } from '@/stores/app-store'
import { StemMixer, UvrGuide, UvrProcessControl, UvrResultViewer, UvrSessionResult, UvrSettings, UvrUploadControl, } from '.'
import { CheckCircle, History, Music, Settings, Trash2, X } from './icons'

/**
 * Progress callback type for processing
 */
type OnProgress = (progress: number) => void

/**
 * Handle starting the actual audio processing via API
 */
async function startRealProcessing(
  file: File,
  sessionId: string,
  onProgress: OnProgress,
  onComplete: (files: OutputFile[]) => void,
  onError: (error: string) => void,
): Promise<void> {
  try {
    const response = await processAudio(file, DEFAULT_PROCESS_REQUEST)

    if (response.status !== 'processing') {
      throw new Error('Failed to start processing')
    }

    // Store the API session UUID for future queries
    setUvrSessionApiId(sessionId, response.session_id)

    const processingStartTime = Date.now()

    // Poll for completion, passing elapsed time with progress updates
    await pollForCompletion(
      response.session_id,
      (progress, indeterminate) => {
        const elapsed = Date.now() - processingStartTime
        updateUvrSessionProgress(sessionId, progress, elapsed, indeterminate)
        onProgress(progress)
      },
      (files) => onComplete(files),
      onError,
      1000,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed'
    setErrorUvrSession(sessionId, message)
    onError(message)
  }
}

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
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null)
  const [prevView, setPrevView] = createSignal<UvrView>('upload')
  const [mixerStems, setMixerStems] = createSignal<{
    vocal?: string
    vocalMidi?: string
    instrumental?: string
  }>({})
  const [mixerSessionId, setMixerSessionId] = createSignal('')

  // Computed session state
  const session = () => currentUvrSession()
  const allSessions = () => getAllUvrSessionsReactive()

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

  // Cleanup on unmount
  onCleanup(() => {
    // Clean up any processing sessions
    if (session()?.status === 'processing') {
      cancelUvrSession(session()!.sessionId)
    }
  })

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    const sessionId = startUvrSession(
      file.name,
      file.size,
      file.type,
      'separate',
    )
    setCurrentView('processing')
    // Immediately start processing with the created session
    handleProcessStart(sessionId)
  }

  const handleProcessStart = async (sessionId: string) => {
    const file = selectedFile()
    if (!file) {
      console.error('No file selected')
      return
    }

    // Set session to processing status
    const sessions = getAllUvrSessions()
    const session = sessions.find((s) => s.sessionId === sessionId)
    if (session) {
      session.status = 'processing'
      saveAllUvrSessions(sessions)
      setCurrentUvrSession(session)
    }

    // Start real processing
    try {
      await startRealProcessing(
        file,
        sessionId,
        (_progress) => {
          // Session state already updated inside startRealProcessing
        },
        (files) => {
          // Convert API output to session format
          const outputs: UvrSession['outputs'] = {
            vocal: '',
            instrumental: '',
            vocalMidi: '',
          }
          const meta: Record<string, { duration?: number; size?: number }> = {}

          for (const f of files) {
            if (f.stem === 'vocal') {
              outputs.vocal = f.path
              meta.vocal = { duration: f.duration, size: f.size }
            } else if (f.stem === 'instrumental') {
              outputs.instrumental = f.path
              meta.instrumental = { duration: f.duration, size: f.size }
            }
          }

          completeUvrSession(sessionId, outputs, meta)
          setCurrentView('results')
        },
        showError,
      )
    } catch (error) {
      console.error('Processing error:', error)
      const message =
        error instanceof Error ? error.message : 'Processing failed'
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
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const ext = type.includes('midi') ? '.mid' : '.wav'
      a.download = `${type.replace('-', '_')}${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
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
    setMixerStems({
      vocal: s.outputs.vocal,
      instrumental: s.outputs.instrumental,
      vocalMidi: s.outputs.vocalMidi,
    })
    setMixerSessionId(s.sessionId)
    setCurrentView('mixer')

    if (props.onPracticeStart) {
      props.onPracticeStart(mode)
    }
  }

  const handleOpenMixerFromHistory = (
    sessionId: string,
    stems?: { vocal?: boolean; instrumental?: boolean },
  ) => {
    const s = getUvrSession(sessionId)
    if (!s?.outputs) return
    setCurrentUvrSession(s)

    setPrevView(currentView())
    const filter = stems || {}
    setMixerStems({
      vocal: filter.vocal !== false ? s.outputs.vocal : undefined,
      instrumental:
        filter.instrumental !== false ? s.outputs.instrumental : undefined,
      vocalMidi: s.outputs.vocalMidi,
    })
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
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const ext = type === 'vocal-midi' ? '.mid' : '.wav'
      a.download = `${type.replace('-', '_')}${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
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
            <div class="quick-tips">
              <h5>Quick Tips</h5>
              <ul>
                <li>Supports MP3 and WAV files up to 100MB</li>
                <li>Processing typically takes 30-120 seconds</li>
                <li>Generated files are saved for later use</li>
              </ul>
            </div>
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
                onCancel={() => {
                  cancelUvrSession(session()!.sessionId)
                  setCurrentView('upload')
                }}
                onRetry={() => {
                  // Retry logic
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
                <Settings /> Back to Upload
              </button>
            </div>
            {session() && (
              <UvrResultViewer
                outputs={session()!.outputs}
                stemMeta={session()!.stemMeta}
                processingTime={session()!.processingTime}
                sessionId={session()!.sessionId}
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
                  <Settings /> New Upload
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

      {/* Stem Mixer Inline */}
      <Show when={currentView() === 'mixer'}>
        <div class="view-section mixer-section">
          <StemMixer
            stems={mixerStems()}
            sessionId={mixerSessionId()}
            songTitle={currentUvrSession()?.originalFile?.name ?? 'Unknown'}
            onBack={() => setCurrentView(prevView())}
          />
        </div>
      </Show>
    </div>
  )
}

// ============================================================
// CSS Styles
// ============================================================

export const UvrPanelStyles: string = `
.uvr-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: 1rem 1rem 0 0;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0.75rem;
  color: white;
}

.header-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.header-left h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--fg-primary);
}

.header-subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: var(--fg-secondary);
}

.header-actions {
  display: flex;
  gap: 0.25rem;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--fg-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.header-btn:hover {
  background: var(--bg-hover);
}

.header-btn-ghost {
  background: transparent;
  border-color: transparent;
}

.header-btn-ghost:hover {
  background: var(--bg-primary);
}

.header-btn-close:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  position: relative;
  padding-bottom: 1.5rem;
}

.view-section {
  padding: 1.5rem;
  min-height: 0;
}

.mixer-section {
  padding: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.section-header h4 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--fg-primary);
}

.guide-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--fg-primary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.guide-toggle:hover {
  background: var(--bg-hover);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--fg-primary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--bg-hover);
}

/* Guide Modal */
.guide-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.guide-container {
  background: var(--bg-secondary);
  border-radius: 1rem;
  width: 620px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
}

.guide-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  border-bottom: 1px solid var(--border);
}

.guide-header h3 {
  margin: 0;
  color: var(--fg-primary);
}

.guide-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--fg-primary);
  cursor: pointer;
}

.guide-close:hover {
  background: var(--bg-hover);
}

/* Upload Section */
.upload-section {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.quick-tips {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: 0.5rem;
}

.quick-tips h5 {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: var(--fg-primary);
}

.quick-tips ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.quick-tips li {
  font-size: 0.85rem;
  color: var(--fg-secondary);
  padding: 0.2rem 0;
  padding-left: 1rem;
  position: relative;
}

.quick-tips li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--accent);
}

/* History Section */
.history-section {
  padding: 1rem;
  max-width: min(85%, 1200px);
  margin: 0 auto;
}

.history-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  overflow-y: auto;
  max-height: calc(100vh - 200px);
  padding-right: 0.25rem;
}

.history-list-inline {
  flex: 6 0 auto;
  overflow-y: auto;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.75rem;
}

.upload-divider {
  display: flex;
  align-items: center;
  margin: 0 0 0.75rem;
}

.upload-divider::before {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--border);
}

.upload-divider-text {
  padding: 0 1rem;
  font-size: 0.8rem;
  color: var(--fg-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.upload-section .section-header {
  flex-shrink: 0;
}

.upload-section .upload-divider {
  flex-shrink: 0;
}

.upload-section .uvr-upload-control {
  flex: 4 1 auto;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  margin-bottom: 0.5rem;
}

.upload-section .quick-tips {
  flex-shrink: 0;
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: var(--fg-tertiary);
}

.history-empty svg {
  width: 3rem;
  height: 3rem;
  margin-bottom: 1rem;
}

.history-empty p {
  margin: 0 0 1rem;
  font-size: 0.9rem;
}

.history-empty button {
  padding: 0.625rem 1.25rem;
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.history-empty button:hover {
  opacity: 0.9;
}

/* Section Header Actions */
.section-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.delete-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.4rem;
  color: var(--error);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}

.delete-all-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

.delete-all-btn svg {
  width: 0.8rem;
  height: 0.8rem;
}

/* Delete All Confirmation Modal */
.delete-all-overlay {
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

.delete-all-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.5rem;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: dialog-in 0.2s ease;
}

@keyframes dialog-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.delete-all-dialog h4 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--fg-primary);
}

.delete-all-dialog p {
  margin: 0 0 1.25rem;
  font-size: 0.85rem;
  color: var(--fg-secondary);
  line-height: 1.5;
}

.delete-all-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.delete-all-cancel {
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  color: var(--fg-primary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
}

.delete-all-cancel:hover {
  background: var(--bg-hover);
}

.delete-all-confirm {
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

.delete-all-confirm:hover {
  opacity: 0.85;
}

.delete-all-confirm svg {
  width: 0.9rem;
  height: 0.9rem;
}

/* History Toast Notification */
.history-toast {
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

.history-toast-icon {
  display: flex;
  align-items: center;
  color: var(--success);
}

.history-toast-icon svg {
  width: 0.9rem;
  height: 0.9rem;
}
`
