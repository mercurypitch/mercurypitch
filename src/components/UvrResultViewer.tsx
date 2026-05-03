// ============================================================
// UVR Result Viewer
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { FileText, Music, Download, Play, X } from './icons'

interface ResultViewerProps {
  outputs?: {
    vocal?: string
    instrumental?: string
    vocalMidi?: string
    instrumentalMidi?: string
  }
  processingTime?: number
  onStartPractice?: (mode: 'vocal' | 'instrumental' | 'full' | 'midi') => void
  onExport?: (type: 'vocal' | 'instrumental' | 'vocal-midi' | 'instrumental-midi') => void
  onClose?: () => void
}

export const UvrResultViewer: Component<ResultViewerProps> = (props) => {
  const [selectedOutput, setSelectedOutput] = createSignal<'vocal' | 'instrumental' | null>(null)

  const outputs = () => props.outputs || {}

  const handleStartPractice = (mode: 'vocal' | 'instrumental' | 'full' | 'midi') => {
    if (props.onStartPractice) {
      props.onStartPractice(mode)
    }
  }

  const handleExport = (type: 'vocal' | 'instrumental' | 'vocal-midi' | 'instrumental-midi') => {
    if (props.onExport) {
      props.onExport(type)
    }
  }

  return (
    <div class="uvr-result-viewer">
      {/* Header */}
      <div class="result-header">
        <h3>Processing Results</h3>
        <button class="close-btn" onClick={props.onClose} aria-label="Close">
          <X />
        </button>
      </div>

      {/* Processing Info */}
      <div class="result-info">
        <div class="info-item">
          <span class="info-icon">⏱️</span>
          <div>
            <span class="info-label">Processing Time</span>
            <span class="info-value">
              {props.processingTime
                ? Math.round(props.processingTime / 1000) + 's'
                : 'Not available'}
            </span>
          </div>
        </div>
      </div>

      {/* Output Sections */}
      <div class="output-sections">
        {/* Vocal Output */}
        <div class="output-section">
          <div class="section-header">
            <div class="section-icon vocal-icon">🎤</div>
            <div class="section-title">
              <h4>Vocal Stem</h4>
              <span class="section-tag">WAV</span>
            </div>
          </div>

          <Show when={outputs().vocal}>
            <div class="output-actions">
              <button
                class="output-btn output-btn-primary"
                onClick={() => handleStartPractice('vocal')}
              >
                <Play /> Practice with Vocal
              </button>
              <button
                class="output-btn output-btn-secondary"
                onClick={() => handleExport('vocal')}
              >
                <Download /> Download
              </button>
            </div>
          </Show>
        </div>

        {/* Instrumental Output */}
        <div class="output-section">
          <div class="section-header">
            <div class="section-icon instrumental-icon">🎵</div>
            <div class="section-title">
              <h4>Instrumental</h4>
              <span class="section-tag">WAV</span>
            </div>
          </div>

          <Show when={outputs().instrumental}>
            <div class="output-actions">
              <button
                class="output-btn output-btn-primary"
                onClick={() => handleStartPractice('instrumental')}
              >
                <Play /> Practice Instrumental
              </button>
              <button
                class="output-btn output-btn-secondary"
                onClick={() => handleExport('instrumental')}
              >
                <Download /> Download
              </button>
            </div>
          </Show>
        </div>

        {/* Vocal MIDI Output */}
        <div class="output-section">
          <div class="section-header">
            <div class="section-icon vocal-icon">🎹</div>
            <div class="section-title">
              <h4>Vocal MIDI</h4>
              <span class="section-tag">MIDI</span>
            </div>
          </div>

          <Show when={outputs().vocalMidi}>
            <div class="output-actions">
              <button
                class="output-btn output-btn-primary"
                onClick={() => handleStartPractice('midi')}
              >
                <Play /> Practice MIDI
              </button>
              <button
                class="output-btn output-btn-secondary"
                onClick={() => handleExport('vocal-midi')}
              >
                <Download /> Download
              </button>
            </div>
          </Show>
        </div>

        {/* Full Mix (Karaoke style) */}
        <div class="output-section">
          <div class="section-header">
            <div class="section-icon full-icon">🎸</div>
            <div class="section-title">
              <h4>Full Mix (Karaoke)</h4>
              <span class="section-tag">Both Stems</span>
            </div>
          </div>

          <Show when={outputs().vocal && outputs().instrumental}>
            <div class="output-actions">
              <button
                class="output-btn output-btn-primary"
                onClick={() => handleStartPractice('full')}
              >
                <Play /> Practice Full Mix
              </button>
            </div>
          </Show>
        </div>
      </div>

      {/* Share Button */}
      <div class="result-footer">
        <button class="share-btn" disabled={true}>
          <FileText /> Share Session
        </button>
      </div>
    </div>
  )
}

// ============================================================
// CSS Styles (inline for this component)
// ============================================================

export const UvrResultViewerStyles: string = `
.uvr-result-viewer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--fg-primary);
}

.close-btn {
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

.close-btn:hover {
  background: var(--border);
  color: var(--fg-secondary);
}

.result-info {
  display: flex;
  gap: 1.5rem;
}

.info-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.info-icon {
  font-size: 1rem;
}

.info-label {
  font-size: 0.75rem;
  color: var(--fg-secondary);
}

.info-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-primary);
}

.output-sections {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.output-section {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 0.75rem;
  border: 2px solid var(--border);
  transition: all 0.2s;
}

.output-section:hover {
  border-color: var(--accent);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.section-icon {
  font-size: 1.25rem;
}

.vocal-icon { color: #f59e0b; }
.instrumental-icon { color: #3b82f6; }
.vocal-icon, .full-icon { color: #10b981; }
.instrumental-icon, .full-icon { color: #8b5cf6; }

.section-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title h4 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--fg-primary);
}

.section-tag {
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 0.25rem;
  color: var(--fg-tertiary);
}

.output-actions {
  display: flex;
  gap: 0.5rem;
}

.output-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.output-btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.output-btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.output-btn-secondary {
  background: var(--bg-primary);
  color: var(--fg-primary);
  border: 1px solid var(--border);
}

.output-btn-secondary:hover {
  background: var(--bg-hover);
}

.result-footer {
  display: flex;
  justify-content: center;
}

.share-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--fg-secondary);
  font-size: 0.85rem;
  cursor: not-allowed;
}
`
