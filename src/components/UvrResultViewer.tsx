// ============================================================
// UVR Result Viewer — Compact stem cards with metadata
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { Download, Headphones, Midi, MusicBoard, Play, Share, SlidersHorizontal, Voice, X, } from './icons'

interface StemMeta {
  duration?: number
  size?: number
}

interface ResultViewerProps {
  outputs?: {
    vocal?: string
    instrumental?: string
    vocalMidi?: string
    instrumentalMidi?: string
  }
  stemMeta?: Record<string, StemMeta>
  processingTime?: number
  sessionId?: string
  onStartPractice?: (mode: 'vocal' | 'instrumental' | 'full' | 'midi') => void
  onOpenMixer?: (sessionId: string) => void
  onExport?: (
    type: 'vocal' | 'instrumental' | 'vocal-midi' | 'instrumental-midi',
  ) => void
  onClose?: () => void
}

export const UvrResultViewer: Component<ResultViewerProps> = (props) => {
  const [shareToast, setShareToast] = createSignal('')

  const formatDuration = (secs?: number): string => {
    if (!secs || secs <= 0) return ''
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleStartPractice = (mode: 'vocal' | 'instrumental' | 'full' | 'midi') => {
    props.onStartPractice?.(mode)
  }

  const handleDownload = async (url: string | undefined, filename: string) => {
    if (!url) return
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/uvr/session/${props.sessionId || ''}`
    try {
      await navigator.clipboard.writeText(url)
      setShareToast('Link copied to clipboard!')
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setShareToast('Link copied!')
    }
    setTimeout(() => setShareToast(''), 2500)
  }

  const stems = () => {
    const list: {
      key: string
      label: string
      icon: Component
      color: string
      url?: string
      format: string
      practiceMode: 'vocal' | 'instrumental' | 'midi'
      exportType: 'vocal' | 'instrumental' | 'vocal-midi'
    }[] = []

    if (props.outputs?.vocal) {
      list.push({
        key: 'vocal',
        label: 'Vocal',
        icon: Voice,
        color: '#f59e0b',
        url: props.outputs.vocal,
        format: 'WAV',
        practiceMode: 'vocal',
        exportType: 'vocal',
      })
    }
    if (props.outputs?.instrumental) {
      list.push({
        key: 'instrumental',
        label: 'Instrumental',
        icon: Headphones,
        color: '#3b82f6',
        url: props.outputs.instrumental,
        format: 'WAV',
        practiceMode: 'instrumental',
        exportType: 'instrumental',
      })
    }
    if (props.outputs?.vocalMidi) {
      list.push({
        key: 'vocalMidi',
        label: 'Vocal MIDI',
        icon: Midi,
        color: '#8b5cf6',
        url: props.outputs.vocalMidi,
        format: 'MID',
        practiceMode: 'midi',
        exportType: 'vocal-midi',
      })
    }

    return list
  }

  return (
    <div class="uvr-result-viewer">
      {/* Header */}
      <div class="rv-header">
        <div class="rv-header-left">
          <h3>Stems</h3>
          <Show when={props.processingTime}>
            <span class="rv-processing-time">
              processed in {Math.round(props.processingTime! / 1000)}s
            </span>
          </Show>
        </div>
        <div class="rv-header-right">
          <button class="rv-share-btn" onClick={handleShare} title="Copy share link">
            <Share /> Share
          </button>
          <Show when={props.onClose}>
            <button class="rv-close-btn" onClick={props.onClose} aria-label="Close">
              <X />
            </button>
          </Show>
        </div>
      </div>

      {/* Stem Cards Grid */}
      <div class="rv-stems-grid">
        {stems().map((stem) => {
          const meta = props.stemMeta?.[stem.key]
          return (
            <div
              class="rv-stem-card"
              style={{ '--stem-color': stem.color }}
            >
              <div class="rv-stem-card-top">
                <div class="rv-stem-icon" style={{ color: stem.color }}>
                  {<stem.icon />}
                </div>
                <div class="rv-stem-info">
                  <span class="rv-stem-name">{stem.label}</span>
                  <div class="rv-stem-meta">
                    <span class="rv-stem-format">{stem.format}</span>
                    <Show when={formatDuration(meta?.duration)}>
                      <span class="rv-stem-duration">
                        {formatDuration(meta?.duration)}
                      </span>
                    </Show>
                    <Show when={formatFileSize(meta?.size)}>
                      <span class="rv-stem-size">
                        {formatFileSize(meta?.size)}
                      </span>
                    </Show>
                  </div>
                </div>
              </div>
              <div class="rv-stem-card-actions">
                <button
                  class="rv-stem-btn rv-stem-btn-play"
                  onClick={() => handleStartPractice(stem.practiceMode)}
                >
                  <Play /> Play
                </button>
                <button
                  class="rv-stem-btn rv-stem-btn-download"
                  onClick={() => handleDownload(stem.url, `${stem.label.toLowerCase()}_stem.${stem.format.toLowerCase()}`)}
                >
                  <Download />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Full Mix Card */}
      <Show when={props.outputs?.vocal && props.outputs?.instrumental}>
        <div class="rv-full-mix-card">
          <div class="rv-full-mix-left">
            <div class="rv-stem-icon" style={{ color: '#10b981' }}>
              <MusicBoard />
            </div>
            <div class="rv-stem-info">
              <span class="rv-stem-name">Full Mix</span>
              <span class="rv-stem-format">Vocal + Instrumental</span>
            </div>
          </div>
          <div class="rv-full-mix-actions">
            <button
              class="rv-stem-btn rv-stem-btn-play"
              onClick={() => handleStartPractice('full')}
            >
              <Play /> Play
            </button>
            <button
              class="rv-stem-btn rv-stem-btn-mixer"
              onClick={() => {
                if (props.sessionId) {
                  handleStartPractice('full')
                }
              }}
            >
              <SlidersHorizontal /> Mix
            </button>
          </div>
        </div>
      </Show>

      {/* Share Toast */}
      <Show when={shareToast()}>
        <div class="rv-toast">{shareToast()}</div>
      </Show>
    </div>
  )
}

// ============================================================
// CSS Styles
// ============================================================

export const UvrResultViewerStyles: string = `
.uvr-result-viewer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

/* Header */
.rv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rv-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rv-header-left h3 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--fg-primary);
}

.rv-processing-time {
  font-size: 0.72rem;
  color: var(--fg-tertiary);
  background: var(--bg-tertiary);
  padding: 0.15rem 0.5rem;
  border-radius: 0.3rem;
}

.rv-header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rv-share-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.85rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  color: var(--fg-primary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}

.rv-share-btn svg {
  width: 0.8rem;
  height: 0.8rem;
}

.rv-share-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  color: var(--accent);
}

.rv-close-btn {
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

.rv-close-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}

.rv-close-btn svg {
  width: 0.9rem;
  height: 0.9rem;
}

/* Stem Cards Grid */
.rv-stems-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rv-stem-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.85rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  border-left: 3px solid var(--stem-color, var(--border));
  transition: border-color 0.2s, box-shadow 0.2s;
}

.rv-stem-card:hover {
  border-color: var(--stem-color, var(--accent));
  box-shadow: 0 0 0 1px rgba(from var(--stem-color) r g b / 0.15);
}

.rv-stem-card-top {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.rv-stem-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: var(--bg-primary);
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.rv-stem-icon svg {
  width: 1rem;
  height: 1rem;
}

.rv-stem-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.rv-stem-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-primary);
}

.rv-stem-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.rv-stem-format {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.35rem;
  background: var(--bg-tertiary);
  border-radius: 0.2rem;
  color: var(--fg-tertiary);
}

.rv-stem-duration {
  font-size: 0.68rem;
  font-family: monospace;
  color: var(--fg-secondary);
}

.rv-stem-size {
  font-size: 0.65rem;
  color: var(--fg-tertiary);
}

.rv-stem-card-actions {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.rv-stem-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 0.4rem;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.rv-stem-btn svg {
  width: 0.75rem;
  height: 0.75rem;
}

.rv-stem-btn-play {
  background: var(--accent);
  color: var(--bg-primary);
}

.rv-stem-btn-play:hover {
  opacity: 0.85;
}

.rv-stem-btn-download {
  background: var(--bg-tertiary);
  color: var(--fg-secondary);
  border: 1px solid var(--border);
  padding: 0.4rem 0.5rem;
}

.rv-stem-btn-download:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.rv-stem-btn-mixer {
  background: var(--bg-tertiary);
  color: var(--accent);
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.rv-stem-btn-mixer:hover {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.5);
}

/* Full Mix Card */
.rv-full-mix-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.85rem;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(139, 92, 246, 0.08));
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 0.6rem;
}

.rv-full-mix-left {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.rv-full-mix-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* Toast */
.rv-toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.6rem 1.25rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  font-size: 0.85rem;
  color: var(--fg-primary);
  z-index: 1001;
  animation: rv-toast-in 0.25s ease, rv-toast-out 0.25s ease 2s forwards;
}

@keyframes rv-toast-in {
  from { transform: translateX(-50%) translateY(1rem); opacity: 0; }
  to { transform: translateX(-50%) translateY(0); opacity: 1; }
}

@keyframes rv-toast-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
`
