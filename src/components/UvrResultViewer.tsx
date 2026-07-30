// ============================================================
// UVR Result Viewer — Compact stem cards with metadata
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { setSessionStem } from '@/db/services/manual-stem-service'
import { getStemBlobUrl } from '@/db/services/uvr-service'
import { eventBus } from '@/lib/event-bus'
import { generateVocalMidi } from '@/lib/midi-generator'
import { createPreviewPlayer } from '@/lib/preview-player'
import { drawStemPeaks, evictStemPeaks, getStemPeaks } from '@/lib/stem-peaks'
import type { StemSplitPart, StemSplitProgress } from '@/lib/uvr-stem-split'
import { PART_STEM_DISPLAY, runStemSplit, SPLIT_PART_STEMS, StemSplitError, } from '@/lib/uvr-stem-split'
import { getUvrSession } from '@/stores/app-store'
import { showNotification } from '@/stores/notifications-store'
import { AudioWave, Clock, Download, Drum, Guitar, Headphones, Midi, Music, MusicBoard, Pause, Play, Repeat, Share, SlidersHorizontal, Voice, X, } from './icons'
import { UvrSessionActions } from './UvrSessionActions'

/** Icons for the part stems the instrumental split produces. */
const PART_STEM_ICONS: Record<StemSplitPart, Component> = {
  drums: Drum,
  bass: AudioWave,
  guitar: Guitar,
  piano: Music,
  other: Music,
}

/** Translucent waveform + playback-progress layer behind a stem card's
 *  content. Pointer-transparent — the card handles select/scrub clicks.
 *  Only shown (and only decoded) while the stem is playing: the visible
 *  waveform doubles as the "this card scrubs now" mode indicator; hidden
 *  cards stay plain select-toggles. */
const StemCardWave: Component<{
  url: string
  color: string
  /** True while this stem is the one playing — fades the layer in and
   *  triggers the (lazy, cached) peak decode. */
  visible: boolean
  /** 0..1 playback position; 0 hides the fill. */
  progress: number
}> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  createEffect(() => {
    // Decode lazily: nothing is fetched until the stem is first played.
    if (!props.visible) return
    const url = props.url
    const color = props.color
    const canvas = canvasRef
    if (!canvas) return
    let alive = true
    let peaks: Float32Array | null = null
    const redraw = () => {
      // Guard the zero-size window: the effect can run before layout, and
      // a one-shot draw then paints a 1px-wide (invisible) waveform. The
      // observer fires again the moment the card gets real dimensions.
      if (alive && peaks !== null && canvas.clientWidth > 0) {
        drawStemPeaks(canvas, peaks, color)
      }
    }
    const observer = new ResizeObserver(redraw)
    observer.observe(canvas)
    getStemPeaks(url)
      .then((p) => {
        peaks = p
        redraw()
      })
      .catch(() => {
        /* no waveform is fine — the card still works */
      })
    onCleanup(() => {
      alive = false
      observer.disconnect()
    })
  })
  return (
    <div
      class="rv-stem-wave-layer"
      classList={{ 'rv-stem-wave-visible': props.visible }}
      aria-hidden="true"
    >
      <div
        class="rv-stem-wave-progress"
        style={{
          width: `${Math.min(100, Math.max(0, props.progress * 100))}%`,
          background: props.color,
        }}
      />
      <canvas ref={canvasRef} class="rv-stem-wave-canvas" />
    </div>
  )
}

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
  originalFileName?: string
  disabled?: boolean
  onStartPractice?: (mode: 'vocal' | 'instrumental' | 'full' | 'midi') => void
  onStartMix?: (selectedStems: string[]) => void
  onOpenMixer?: (sessionId: string) => void
  onExport?: (
    type: 'vocal' | 'instrumental' | 'vocal-midi' | 'instrumental-midi',
  ) => void
  onClose?: () => void
  onRerunHq?: (sessionId: string, target: 'same' | 'new') => void
  /** Credit cost of the instrumental split, when known (server pricing).
   *  Shown on the Split button so a paid second pass is never a surprise. */
  splitCostCredits?: number
}

export const UvrResultViewer: Component<ResultViewerProps> = (props) => {
  const [shareToast, setShareToast] = createSignal('')
  const [midiDownloading, setMidiDownloading] = createSignal(false)
  const [midiDownloadProgress, setMidiDownloadProgress] = createSignal(0)

  const session = () =>
    props.sessionId !== undefined && props.sessionId !== ''
      ? getUvrSession(props.sessionId)
      : undefined

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

  const handleStartPractice = (
    mode: 'vocal' | 'instrumental' | 'full' | 'midi',
  ) => {
    props.onStartPractice?.(mode)
  }

  const handleDownload = async (
    url: string | undefined,
    filename: string,
    stemKey?: string,
  ) => {
    // Handle MIDI stems — generate on-the-fly from vocal audio
    if (
      (url === undefined || url === '') &&
      stemKey === 'vocalMidi' &&
      props.outputs?.vocal !== undefined
    ) {
      try {
        setMidiDownloading(true)
        setMidiDownloadProgress(0)
        const midiBlob = await generateVocalMidi(props.outputs.vocal, (pct) =>
          setMidiDownloadProgress(pct),
        )
        setMidiDownloading(false)
        if (midiBlob) {
          url = URL.createObjectURL(midiBlob)
        }
      } catch (err) {
        setMidiDownloading(false)
        console.error('MIDI generation failed:', err)
        return
      }
    }
    if (url === undefined || url === '') return
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const base = (props.originalFileName ?? 'audio')
        .replace(/\.[^.]+$/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
      a.download =
        stemKey === 'vocalMidi'
          ? `${base}_vocal_midi.mid`
          : `${base}_${stemKey ?? 'stem'}.${filename.split('.').pop() ?? 'wav'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/#/uvr/session/${props.sessionId ?? ''}/mixer`
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

  // ── Instrument parts (drums / bass / guitar / other) ─────────
  // Loaded from IndexedDB by (sessionId, stemType); produced on demand by
  // a second separation pass over the instrumental (runStemSplit).
  const ALL_PARTS = Object.keys(PART_STEM_DISPLAY) as StemSplitPart[]
  const [partUrls, setPartUrls] = createSignal<
    Partial<Record<StemSplitPart, string>>
  >({})
  const [splitBusy, setSplitBusy] = createSignal(false)
  const [splitProgress, setSplitProgress] =
    createSignal<StemSplitProgress | null>(null)
  // ── Inline preview player ────────────────────────────────────
  // One shared player for every stem card: Play previews the stem right
  // here (the mixer is reached by selecting stems and mixing), an rAF
  // clock drives the card's progress fill, and clicking the card while
  // its stem is loaded scrubs. Playback goes through preview-player's
  // gain envelope — bare HTMLAudioElement play()/pause()/seek pops, and
  // on a PA that pop is LOUD (see .claude/memory/audio-pop-free-playback.md).
  const [previewKey, setPreviewKey] = createSignal<string | null>(null)
  const [previewPlaying, setPreviewPlaying] = createSignal(false)
  const [previewTime, setPreviewTime] = createSignal(0)
  const [previewDuration, setPreviewDuration] = createSignal(0)
  let previewRaf = 0

  const player = createPreviewPlayer({
    onEnded: () => {
      cancelAnimationFrame(previewRaf)
      setPreviewPlaying(false)
      setPreviewTime(player.duration)
    },
  })

  const tickPreview = () => {
    setPreviewTime(player.currentTime)
    if (player.duration > 0) setPreviewDuration(player.duration)
    if (player.playing) previewRaf = requestAnimationFrame(tickPreview)
  }

  const stopPreview = () => {
    cancelAnimationFrame(previewRaf)
    player.stop()
    setPreviewKey(null)
    setPreviewPlaying(false)
    setPreviewTime(0)
    setPreviewDuration(0)
  }

  const togglePreview = (key: string, url: string) => {
    if (previewKey() === key) {
      // Same stem: pause/resume, keeping the position.
      if (previewPlaying()) {
        player.pause()
        setPreviewPlaying(false)
        cancelAnimationFrame(previewRaf)
        setPreviewTime(player.currentTime)
      } else {
        void player.play(url)
        setPreviewPlaying(true)
        cancelAnimationFrame(previewRaf)
        previewRaf = requestAnimationFrame(tickPreview)
      }
      return
    }
    cancelAnimationFrame(previewRaf)
    setPreviewKey(key)
    setPreviewTime(0)
    setPreviewDuration(0)
    void player.play(url)
    setPreviewPlaying(true)
    previewRaf = requestAnimationFrame(tickPreview)
  }

  const seekPreview = (fraction: number) => {
    player.seekToFraction(fraction)
    if (previewDuration() > 0) setPreviewTime(fraction * previewDuration())
  }

  const loadPartUrls = async (sessionId: string) => {
    const entries = await Promise.all(
      ALL_PARTS.map(async (part) => {
        const url = await getStemBlobUrl(sessionId, part)
        return [part, url] as const
      }),
    )
    const next: Partial<Record<StemSplitPart, string>> = {}
    for (const [part, url] of entries) if (url !== null) next[part] = url
    setPartUrls((prev) => {
      for (const url of Object.values(prev)) {
        URL.revokeObjectURL(url)
        evictStemPeaks(url)
      }
      return next
    })
  }

  createEffect(() => {
    const sessionId = props.sessionId
    stopPreview()
    if (sessionId === undefined || sessionId === '') {
      setPartUrls({})
      return
    }
    void loadPartUrls(sessionId)
  })

  // A "Full band" upload chains the split in the panel after separation —
  // refresh the part cards the moment those stems land. Subscribed in
  // onMount per the eventBus house pattern (usePianoRollEvents).
  let unsubPartsUpdated: (() => void) | undefined
  onMount(() => {
    unsubPartsUpdated = eventBus.on<{ sessionId: string }>(
      'uvr:parts-updated',
      // The event callback must compare against the CURRENT sessionId at
      // fire time — an untracked read is the point, not an oversight.
      // eslint-disable-next-line solid/reactivity
      (detail) => {
        if (detail.sessionId === props.sessionId) {
          void loadPartUrls(detail.sessionId)
        }
      },
    )
  })

  onCleanup(() => {
    unsubPartsUpdated?.()
    stopPreview()
    player.dispose()
    for (const url of Object.values(partUrls())) {
      URL.revokeObjectURL(url)
      evictStemPeaks(url)
    }
  })

  const partsList = () => {
    const urls = partUrls()
    return ALL_PARTS.filter((p) => urls[p] !== undefined).map((part) => ({
      part,
      url: urls[part]!,
      ...PART_STEM_DISPLAY[part],
    }))
  }

  const handleSplit = async () => {
    const sessionId = props.sessionId
    if (sessionId === undefined || sessionId === '' || splitBusy()) return
    setSplitBusy(true)
    setSplitProgress(null)
    try {
      await runStemSplit(sessionId, { onProgress: setSplitProgress })
      await loadPartUrls(sessionId)
      showNotification('Instrumental split into parts', 'success')
    } catch (err) {
      const message =
        err instanceof StemSplitError
          ? err.message
          : 'Splitting the instrumental failed.'
      showNotification(message, 'error')
    } finally {
      setSplitBusy(false)
      setSplitProgress(null)
    }
  }

  const splitProgressLabel = () => {
    const p = splitProgress()
    if (p === null) return 'Starting…'
    if (p.phase === 'uploading') return 'Uploading instrumental…'
    if (p.phase === 'saving') return 'Saving stems…'
    return `Separating… ${Math.round(p.pct)}%`
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
      /** Part stems (drums/bass/…) have no practice/export/replace flows —
       *  they preview inline and join mixes via selection. */
      isPart?: boolean
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
    // Instrument parts sit with the stems they came from, selectable into
    // any mix combination — including "redundant" ones like drums + full
    // instrumental, if that's the experiment the user wants.
    for (const entry of partsList()) {
      list.push({
        key: entry.part,
        label: entry.label,
        icon: PART_STEM_ICONS[entry.part],
        color: entry.color,
        url: entry.url,
        format: 'WAV',
        practiceMode: 'instrumental',
        exportType: 'instrumental',
        isPart: true,
      })
    }
    if (props.outputs?.vocal !== undefined) {
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
  const [selectedKeys, setSelectedKeys] = createSignal<Set<string>>(new Set())

  // ── Add / replace stems ─────────────────────────────────────
  const hasVocal = () => props.outputs?.vocal !== undefined
  const hasInstrumental = () => props.outputs?.instrumental !== undefined
  const [stemBusy, setStemBusy] = createSignal<'vocal' | 'instrumental' | null>(
    null,
  )
  // Returns a file-input change handler; used as an event handler in JSX.
  // eslint-disable-next-line solid/reactivity
  const replaceStem = (stemType: 'vocal' | 'instrumental') => (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    const sid = props.sessionId
    if (file === undefined || sid === undefined) return
    const had = stemType === 'vocal' ? hasVocal() : hasInstrumental()
    setStemBusy(stemType)
    void setSessionStem(sid, stemType, file)
      .then(() =>
        showNotification(
          `${stemType === 'vocal' ? 'Vocal' : 'Instrumental'} ${had ? 'replaced' : 'added'}`,
          'success',
        ),
      )
      .catch(() => showNotification(`Failed to update ${stemType}`, 'error'))
      .finally(() => setStemBusy(null))
  }

  const toggleSelected = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const selectedCount = () => selectedKeys().size

  const handleMixPlay = () => {
    const keys = selectedKeys()
    if (keys.size < 2) return
    props.onStartMix?.([...keys])
  }

  const selectedLabel = () => {
    const keys = selectedKeys()
    const labels = stems()
      .filter((s) => keys.has(s.key))
      .map((s) => s.label)
    return labels.join(' + ')
  }

  return (
    <div class="uvr-result-viewer">
      {/* Header */}
      <div class="rv-header">
        <div class="rv-header-left">
          <h3>Stems</h3>
          <Show when={props.processingTime}>
            <span class="rv-processing-time">
              <span class="rv-time-icon">
                <Clock />
              </span>
              {Math.round(props.processingTime! / 1000)}s
            </span>
          </Show>
        </div>
        <div class="rv-header-right">
          <Show when={props.sessionId}>
            {(sessionId) => (
              <UvrSessionActions
                sessionId={sessionId()}
                session={session()}
                originalFileName={props.originalFileName}
                disabled={props.disabled}
                onRerunHq={props.onRerunHq}
              />
            )}
          </Show>
          <button
            class="rv-share-btn"
            onClick={() => {
              void handleShare()
            }}
            title="Copy share link"
          >
            <Share /> Share
          </button>
          <Show when={props.onClose}>
            <button
              class="rv-close-btn"
              onClick={() => props.onClose?.()}
              aria-label="Close"
            >
              <X />
            </button>
          </Show>
        </div>
      </div>

      {/* Stem Cards Grid */}
      <div class="rv-stems-grid">
        <For each={stems()}>
          {(stem) => {
            const meta = props.stemMeta?.[stem.key]
            const isSelected = () => selectedKeys().has(stem.key)
            return (
              <div
                class="rv-stem-card"
                classList={{
                  'rv-stem-card-selected': isSelected(),
                  'rv-stem-card-playing':
                    previewKey() === stem.key && previewPlaying(),
                }}
                style={{ '--stem-color': stem.color }}
                onClick={(e) => {
                  // While this stem is PLAYING the card surface is a
                  // scrubber (the visible waveform signals the mode);
                  // otherwise — including paused — clicking selects. The
                  // select circle always selects (it stops propagation).
                  if (
                    previewKey() === stem.key &&
                    previewPlaying() &&
                    previewDuration() > 0
                  ) {
                    const rect = e.currentTarget.getBoundingClientRect()
                    seekPreview((e.clientX - rect.left) / rect.width)
                  } else {
                    toggleSelected(stem.key)
                  }
                }}
              >
                <Show when={stem.url}>
                  {(url) => (
                    <StemCardWave
                      url={url()}
                      color={stem.color}
                      visible={previewKey() === stem.key && previewPlaying()}
                      progress={
                        previewKey() === stem.key && previewDuration() > 0
                          ? previewTime() / previewDuration()
                          : 0
                      }
                    />
                  )}
                </Show>
                <div class="rv-stem-card-top">
                  <div
                    class="rv-stem-select"
                    classList={{ 'rv-stem-select-active': isSelected() }}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelected(stem.key)
                    }}
                  >
                    <Show
                      when={isSelected()}
                      fallback={
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          width="100%"
                          height="100%"
                        >
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        width="100%"
                        height="100%"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          fill="currentColor"
                          opacity="0.15"
                        />
                        <polyline points="8 12 11 15 16 9" />
                      </svg>
                    </Show>
                  </div>
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
                <div
                  class="rv-stem-card-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    class="rv-stem-btn rv-stem-btn-play"
                    onClick={() => {
                      // Audio stems preview inline; MIDI (generated on
                      // demand, no URL) still opens the practice view.
                      if (stem.key === 'vocalMidi' || stem.url === undefined) {
                        handleStartPractice(stem.practiceMode)
                        return
                      }
                      togglePreview(stem.key, stem.url)
                    }}
                  >
                    <Show
                      when={previewKey() === stem.key && previewPlaying()}
                      fallback={
                        <>
                          <Play /> Play
                        </>
                      }
                    >
                      <Pause /> Pause
                    </Show>
                  </button>
                  <button
                    class="rv-stem-btn rv-stem-btn-download"
                    onClick={() => {
                      void handleDownload(
                        stem.url,
                        `${stem.label.toLowerCase()}_stem.${stem.format.toLowerCase()}`,
                        stem.key,
                      )
                    }}
                    disabled={midiDownloading() && stem.key === 'vocalMidi'}
                  >
                    {midiDownloading() && stem.key === 'vocalMidi' ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        class="rv-circular-progress"
                      >
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
                            2 *
                              Math.PI *
                              10 *
                              (1 - midiDownloadProgress() / 100),
                          )}
                          stroke-linecap="round"
                          transform="rotate(-90 12 12)"
                        />
                      </svg>
                    ) : (
                      <Download />
                    )}
                  </button>
                  <Show
                    when={
                      props.sessionId !== undefined &&
                      (stem.key === 'vocal' || stem.key === 'instrumental')
                    }
                  >
                    <label
                      class="rv-stem-btn rv-stem-btn-replace"
                      classList={{
                        'rv-stem-btn--busy': stemBusy() === stem.key,
                      }}
                      title="Replace this stem with a new file"
                    >
                      <Repeat /> Replace
                      <input
                        type="file"
                        accept="audio/*"
                        style={{ display: 'none' }}
                        onChange={replaceStem(
                          stem.key as 'vocal' | 'instrumental',
                        )}
                        disabled={stemBusy() !== null}
                      />
                    </label>
                  </Show>
                </div>
              </div>
            )
          }}
        </For>

        {/* Add a missing stem */}
        <Show when={props.sessionId !== undefined && !hasVocal()}>
          <label class="rv-stem-card rv-stem-add">
            <div class="rv-stem-icon" style={{ color: '#f59e0b' }}>
              <Voice />
            </div>
            <span class="rv-stem-add-text">Add vocal stem</span>
            <input
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={replaceStem('vocal')}
              disabled={stemBusy() !== null}
            />
          </label>
        </Show>
        <Show when={props.sessionId !== undefined && !hasInstrumental()}>
          <label class="rv-stem-card rv-stem-add">
            <div class="rv-stem-icon" style={{ color: '#3b82f6' }}>
              <Headphones />
            </div>
            <span class="rv-stem-add-text">Add instrumental stem</span>
            <input
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={replaceStem('instrumental')}
              disabled={stemBusy() !== null}
            />
          </label>
        </Show>
      </div>

      {/* Instrument parts — split of the instrumental stem */}
      <Show when={props.sessionId !== undefined && hasInstrumental()}>
        <div class="rv-parts">
          <div class="rv-parts-header">
            <span class="rv-parts-title">Instrument parts</span>
            <Show
              when={!splitBusy()}
              fallback={
                <span class="rv-parts-progress">{splitProgressLabel()}</span>
              }
            >
              <button
                class="rv-stem-btn rv-parts-split-btn"
                onClick={() => void handleSplit()}
                disabled={props.disabled}
                title={`${
                  partsList().length > 0
                    ? 'Run the split again (replaces the parts)'
                    : 'Separate the instrumental into drums, bass, guitar and other'
                }${
                  props.splitCostCredits !== undefined
                    ? ` — ${props.splitCostCredits} credit${props.splitCostCredits === 1 ? '' : 's'}`
                    : ''
                }`}
              >
                <SlidersHorizontal />
                {partsList().length > 0 ? 'Re-split' : 'Split into parts'}
                <Show when={props.splitCostCredits !== undefined}>
                  <span class="rv-split-cost">
                    {props.splitCostCredits}
                    {' cr'}
                  </span>
                </Show>
              </button>
            </Show>
          </div>
          <Show when={partsList().length === 0 && !splitBusy()}>
            <p class="rv-parts-hint">
              Break the instrumental into {SPLIT_PART_STEMS.join(', ')} stems on
              the separation server — they appear above with the other stems,
              and always add back up to the instrumental.
            </p>
          </Show>
        </div>
      </Show>

      {/* Full Mix — always visible when both stems exist */}
      <Show
        when={
          props.outputs?.vocal !== undefined &&
          props.outputs?.instrumental !== undefined
        }
      >
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
          </div>
        </div>
      </Show>

      {/* Mix Selected — any combination of checked stems opens the mixer */}
      <Show when={selectedCount() >= 1}>
        <div class="rv-mix-selected-card">
          <div class="rv-full-mix-left">
            <div class="rv-stem-icon" style={{ color: '#8b5cf6' }}>
              <SlidersHorizontal />
            </div>
            <div class="rv-stem-info">
              <span class="rv-stem-name">
                {selectedCount() === 1
                  ? '1 stem selected'
                  : `${selectedCount()} stems selected`}
              </span>
              <span class="rv-stem-format">{selectedLabel()}</span>
            </div>
          </div>
          <div class="rv-full-mix-actions">
            <button
              class="rv-stem-btn rv-stem-btn-play"
              onClick={handleMixPlay}
            >
              <SlidersHorizontal /> Mix{' '}
              {selectedCount() === 1 ? 'this stem' : 'these stems'}
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
