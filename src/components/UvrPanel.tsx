// ============================================================
// UVR Panel - Unified Vocal Separation Interface
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import type { UvrSession } from '@/stores/app-store'
import { cancelUvrSession, completeUvrSession, currentUvrSession, getAllUvrSessions, saveAllUvrSessions, setCurrentUvrSession, setErrorUvrSession, startUvrSession, updateUvrSessionProgress, } from '@/stores/app-store'
import { processAudio, pollForCompletion, type OutputFile, DEFAULT_PROCESS_REQUEST, } from '@/lib/uvr-api'
import { UvrGuide, UvrProcessControl, UvrResultViewer, UvrSessionResult, UvrUploadControl, } from '.'
import { History, Music, Settings, X } from './icons'

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

    // Poll for completion
    await pollForCompletion(
      response.session_id,
      onProgress,
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

type UvrView = 'upload' | 'processing' | 'results' | 'history'

interface UvrPanelProps {
  /** Currently active view */
  defaultView?: UvrView
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
    props.defaultView || 'upload',
  )
  const [sessionResultsVisible, setSessionResultsVisible] = createSignal(false)
  const [onError, setOnError] = createSignal('')

  // Error handling
  const showError = (message: string) => {
    console.error(message)
    setOnError(message)
  }
  const clearError = () => setOnError('')
  const [showGuide, setShowGuide] = createSignal(false)
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null)

  // Computed session state
  const session = () => currentUvrSession()
  const allSessions = () => getAllUvrSessions()

  // Load initial view
  createEffect(() => {
    if (props.defaultView) {
      setCurrentView(props.defaultView)
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
    setSessionResultsVisible(false)
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
        (progress) => updateUvrSessionProgress(sessionId, progress),
        (files) => {
          // Convert API output to session format
          const outputs: UvrSession['outputs'] = {
            vocal: '',
            instrumental: '',
            vocalMidi: '',
          }

          for (const f of files) {
            if (f.stem === 'vocal') {
              outputs.vocal = f.path
            } else if (f.stem === 'instrumental') {
              outputs.instrumental = f.path
            }
          }

          completeUvrSession(sessionId, outputs)
        },
        showError,
      )
    } catch (error) {
      console.error('Processing error:', error)
      const message = error instanceof Error ? error.message : 'Processing failed'
      setErrorUvrSession(sessionId, message)
      showError(message)
    }
  }

  const handleExport = (
    type: 'vocal' | 'instrumental' | 'vocal-midi' | 'instrumental-midi',
  ) => {
    if (props.onExport) {
      props.onExport(type)
    }
  }

  const handleSessionView = (sessionId: string) => {
    if (props.onSessionView) {
      props.onSessionView(sessionId)
    }
    setCurrentView('results')
    setSessionResultsVisible(true)
  }

  const handlePracticeStart = (
    mode: 'vocal' | 'instrumental' | 'midi' | 'full',
  ) => {
    if (props.onPracticeStart) {
      props.onPracticeStart(mode)
    }
  }

  const handleExportSession = (
    sessionId: string,
    type: 'vocal' | 'instrumental' | 'vocal-midi',
  ) => {
    // Session export logic
    console.log('Exporting:', sessionId, type)
  }

  // Simulate UVR processing (Phase 2 will replace this with real UVR CLI calls)
  function simulateProcessing(sessionId: string) {
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)

        // Complete session
        setTimeout(() => {
          completeUvrSession(sessionId, {
            vocal: `/stems/${sessionId}/vocal.wav`,
            instrumental: `/stems/${sessionId}/instrumental.wav`,
            vocalMidi: `/midi/${sessionId}/vocal.mid`,
          })
        }, 500)
      }

      updateUvrSessionProgress(sessionId, progress)
    }, 500)
  }

  const closePanel = () => {
    if (props.onClose) props.onClose()
  }

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
          <button
            class="header-btn header-btn-close"
            onClick={closePanel}
            title="Close"
          >
            <X />
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
              onProcessStart={handleProcessStart}
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
                status={session()!.status}
                progress={session()!.progress}
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
                processingTime={session()!.processingTime}
                onStartPractice={handlePracticeStart}
                onExport={handleExport}
              />
            )}
          </div>
        </Show>

        <Show when={currentView() === 'history'}>
          <div class="view-section history-section">
            <div class="section-header">
              <h4>Processing History</h4>
              <button class="back-btn" onClick={() => setCurrentView('upload')}>
                <Settings /> New Upload
              </button>
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
                      onExport={(type) =>
                        handleExportSession(
                          s.sessionId,
                          type as 'vocal' | 'instrumental' | 'vocal-midi',
                        )
                      }
                      onClose={() => setCurrentView('upload')}
                    />
                  )}
                </For>
              )}
            </div>
          </div>
        </Show>
      </div>

      {/* Session Results Panel (side view for viewing session details) */}
      <Show when={sessionResultsVisible() && session()}>
        <div class="session-results-panel">
          <div class="session-results-content">
            <UvrSessionResult
              sessionId={session()!.sessionId}
              onView={handleSessionView}
              onExport={handleExportSession}
              onClose={() => setSessionResultsVisible(false)}
            />
          </div>
          <button
            class="panel-overlay"
            onClick={() => setSessionResultsVisible(false)}
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
  border-radius: 1rem;
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
}

.view-section {
  padding: 1.5rem;
  min-height: 400px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
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
  max-width: 800px;
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
  padding: 1.5rem;
}

.quick-tips {
  margin-top: 1.5rem;
  padding: 1rem;
  background: var(--bg-primary);
  border-radius: 0.5rem;
}

.quick-tips h5 {
  margin: 0 0 0.75rem;
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
  padding: 0.25rem 0;
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
  padding: 1.5rem;
}

.history-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  overflow-y: auto;
  max-height: calc(100vh - 200px);
  padding-right: 0.25rem;
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

/* Session Results Panel */
.session-results-panel {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.session-results-content {
  width: 400px;
  max-width: 100%;
  background: var(--bg-secondary);
  height: 100%;
  overflow-y: auto;
  box-shadow: -4px 0 15px rgba(0, 0, 0, 0.3);
}

.panel-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
}
`
