// ============================================================
// UVR Result Viewer — Compact stem cards with metadata
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
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
    if (secs === undefined || secs <= 0) return ''
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined || bytes === 0) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleStartPractice = (mode: 'vocal' | 'instrumental' | 'full' | 'midi') => {
    props.onStartPractice?.(mode)
  }

  const handleDownload = async (url: string | undefined, filename: string) => {
    if (url === undefined || url === '') return
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
    const url = `${window.location.origin}/#/uvr/session/${props.sessionId ?? ''}`
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

    if (props.outputs?.vocal !== undefined) {
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
    if (props.outputs?.instrumental !== undefined) {
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
    if (props.outputs?.vocalMidi !== undefined) {
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
          <button class="rv-share-btn" onClick={() => { void handleShare() }} title="Copy share link">
            <Share /> Share
          </button>
          <Show when={props.onClose}>
            <button class="rv-close-btn" onClick={() => props.onClose?.()} aria-label="Close">
              <X />
            </button>
          </Show>
        </div>
      </div>

      {/* Stem Cards Grid */}
      <div class="rv-stems-grid">
        <For each={stems()}>{(stem) => {
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
                  onClick={() => { void handleDownload(stem.url, `${stem.label.toLowerCase()}_stem.${stem.format.toLowerCase()}`) }}
                >
                  <Download />
                </button>
              </div>
            </div>
          )
        }}</For>
      </div>

      {/* Full Mix Card */}
      <Show when={props.outputs?.vocal !== undefined && props.outputs?.instrumental !== undefined}>
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
                if (props.sessionId !== undefined) {
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


