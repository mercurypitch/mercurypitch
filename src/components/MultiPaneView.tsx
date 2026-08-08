// ============================================================
// MultiPaneView — Resizable multi-pane layout with sync'd time axes
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import type { VibratoResult } from '@/lib/vocal-analyzer'
import { addPane, paneLayout, removePane, setPaneHeights, togglePaneCollapse, toggleSyncTime, } from '@/stores/pane-layout-store'
import type { PaneConfig, PaneLayerType } from '@/types'
import { AudioWave, ChevronDown, ChevronUp, LinkChain, ListRows, MusicNote, Pencil, Plus, Repeat, RotateCcw, SpeedGauge, WaveformBars, X, } from './icons'
import styles from './MultiPaneView.module.css'
import { CentsDeviationPane } from './panes/CentsDeviationPane'
import { PitchTracePane } from './panes/PitchTracePane'
// ── Pane renderer selectors (imported lazily to avoid circular deps) ──
import { SpectrogramPane } from './panes/SpectrogramPane'
import { SpectrumPane } from './panes/SpectrumPane'
import { WaveformPane } from './panes/WaveformPane'
import { VibratoWaveformCanvas } from './VibratoWaveformCanvas'

// ============================================================
// Types
// ============================================================

export interface MultiPaneViewProps {
  audioDuration: number
  playheadPosition: number
  isPlaying: boolean
  // Data sources for panes
  magnitudeSpectrum: Float32Array | null
  phaseSpectrum?: Float32Array | null
  pitchHistory: PitchTracePoint[]
  centsOffset: number | null
  targetNote?: string | null
  vibratoRate?: number | null
  vibratoDepth?: number | null
  waveformData?: Float32Array | null
  sampleRate?: number
  // Annotation props passed through
  annotationCount?: number
}

export interface PitchTracePoint {
  time: number
  midi: number
  clarity?: number
}

// ============================================================
// Pane type labels & icons
// ============================================================

const PANE_LABELS: Record<PaneLayerType, string> = {
  spectrogram: 'Spectrogram',
  waveform: 'Waveform',
  'pitch-trace': 'Pitch Trace',
  'cents-deviation': 'Cents Dev.',
  vibrato: 'Vibrato',
  annotation: 'Annotations',
  spectrum: 'Spectrum',
}

// One SVG mark per pane type. This map used to hold Unicode drawing
// characters (a triple wave, a sine, two diagonals, a circled dot, a tilde,
// a low block) — arguably legal under the no-emoji rule, but rendered at
// whatever weight and baseline the user's font fallback happened to supply,
// and the pitch-trace entry was two glyphs pretending to be one icon.
const PANE_ICONS: Record<PaneLayerType, Component> = {
  spectrogram: ListRows,
  waveform: AudioWave,
  'pitch-trace': MusicNote,
  'cents-deviation': SpeedGauge,
  vibrato: Repeat,
  annotation: Pencil,
  spectrum: WaveformBars,
}

const paneIcon = (type: PaneLayerType): JSX.Element => {
  const Icon = PANE_ICONS[type]
  return <Icon />
}

// ============================================================
// Component
// ============================================================

export const MultiPaneView: Component<MultiPaneViewProps> = (props) => {
  const [containerHeight, setContainerHeight] = createSignal(600)
  const [dragState, setDragState] = createSignal<{
    paneId: string
    startY: number
    startHeights: Map<string, number>
    nextPaneId: string | null
  } | null>(null)
  let containerRef!: HTMLDivElement

  // ── Time sync ──────────────────────────────────────────────
  const audioDuration = createMemo(() => props.audioDuration || 60)
  const [timeRange, setTimeRange] = createSignal<[number, number]>([0, 60])
  // Update initial time range from prop (one-shot on load)
  let _initialized = false
  createEffect(() => {
    const dur = audioDuration()
    if (!_initialized) {
      _initialized = true
      setTimeRange([0, dur])
    }
  })

  // Live capture runs past the initial window; without following, the
  // trace runs off the right edge and the pane goes blank (owner testing).
  // Follow keeps the playhead at 85% of the window width once it would
  // leave the view - width (the user's zoom) is preserved.
  createEffect(() => {
    if (!props.isPlaying) return
    const pos = props.playheadPosition
    const [t0, t1] = untrack(timeRange)
    if (pos > t1) {
      const width = Math.max(1, t1 - t0)
      setTimeRange([pos - width * 0.85, pos + width * 0.15])
    }
  })

  const panes = createMemo(() => paneLayout().panes)
  const syncTime = createMemo(() => paneLayout().syncTime)

  // ── ResizeObserver ─────────────────────────────────────────
  onMount(() => {
    if (containerRef === undefined) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    ro.observe(containerRef)
    onCleanup(() => ro.disconnect())
  })

  // ── Drag resize ────────────────────────────────────────────
  // Tracks the teardown for an in-flight drag so window listeners are removed
  // even if the component unmounts mid-drag (before pointer-up fires).
  let activeDragEnd: (() => void) | null = null
  onCleanup(() => activeDragEnd?.())

  const onDragStart = (e: MouseEvent | TouchEvent, paneId: string) => {
    e.preventDefault()
    const layout = paneLayout()
    const idx = layout.panes.findIndex((p) => p.id === paneId)
    const nextPaneId =
      idx < layout.panes.length - 1 ? layout.panes[idx + 1].id : null
    const startHeights = new Map<string, number>()
    layout.panes.forEach((p) => startHeights.set(p.id, p.height))
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY

    setDragState({ paneId, startY, startHeights, nextPaneId })

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const ds = dragState()
      if (!ds) return
      const clientY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY
      const dy = clientY - ds.startY
      const ch = containerHeight()
      if (ch <= 0) return

      const dyPct = (dy / ch) * 100
      const newHeights = new Map(ds.startHeights)

      const currentH = ds.startHeights.get(ds.paneId) ?? 0
      const newH = Math.max(8, Math.min(90, currentH + dyPct))
      newHeights.set(ds.paneId, newH)

      if (ds.nextPaneId !== null) {
        const nextH = ds.startHeights.get(ds.nextPaneId) ?? 0
        newHeights.set(ds.nextPaneId, Math.max(8, nextH - dyPct))
      }

      setPaneHeights(newHeights)
    }

    const onEnd = () => {
      setDragState(null)
      window.removeEventListener(
        'mousemove',
        onMove as unknown as EventListener,
      )
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener(
        'touchmove',
        onMove as unknown as EventListener,
      )
      window.removeEventListener('touchend', onEnd)
      activeDragEnd = null
    }

    activeDragEnd = onEnd
    window.addEventListener('mousemove', onMove as unknown as EventListener)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onMove as unknown as EventListener)
    window.addEventListener('touchend', onEnd)
  }

  // ── Add pane dropdown ──────────────────────────────────────
  const availableTypes: PaneLayerType[] = [
    'spectrogram',
    'waveform',
    'pitch-trace',
    'cents-deviation',
    'vibrato',
    'spectrum',
  ]

  // ── Time ruler ticks ───────────────────────────────────────
  const timeTicks = createMemo(() => {
    const [start, end] = timeRange()
    const duration = end - start
    // Adaptive interval
    let step = 1
    if (duration > 120) step = 30
    else if (duration > 60) step = 10
    else if (duration > 20) step = 5
    else if (duration > 10) step = 2
    else step = 1

    const ticks: number[] = []
    const t0 = Math.ceil(start / step) * step
    for (let t = t0; t <= end; t += step) {
      ticks.push(t)
    }
    return ticks
  })

  const formatTime = (t: number): string => {
    const mins = Math.floor(t / 60)
    const secs = Math.floor(t % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * The vibrato pane draws the animated wave, so rate/depth get dressed
   * back up as the VibratoResult the canvas was built around. Rate/depth
   * thresholds mirror vocal-analyzer's classifier — its spectral
   * significance gate isn't available here, so this pane can read
   * "detected" slightly more eagerly than the analyzer. The canvas only
   * reads detected/rateHz/depthCents.
   */
  const vibratoResult = (): VibratoResult | null => {
    const rate = props.vibratoRate ?? null
    const depth = props.vibratoDepth ?? null
    if (rate === null || depth === null || rate <= 0) return null
    const detected = depth >= 10
    return {
      rateHz: rate,
      depthCents: depth,
      detected,
      classification: !detected
        ? 'none'
        : rate < 4.5
          ? 'slow-operatic'
          : rate <= 7
            ? 'natural'
            : depth > 80
              ? 'wide'
              : 'nervous',
      confidence: detected ? 75 : 0,
    }
  }

  // ── Render a single pane ───────────────────────────────────
  // Every branch below hands the pane its own pixel height and lets it
  // paint itself. No colour crosses this boundary: the canvas palettes live
  // in the *Canvas components, because a 2D context cannot resolve a CSS
  // variable.
  const renderPaneContent = (pane: PaneConfig) => {
    const [t0, t1] = timeRange()
    const h = (pane.height / 100) * containerHeight()
    switch (pane.layerType) {
      case 'spectrogram':
        return (
          <SpectrogramPane
            magnitudeSpectrum={props.magnitudeSpectrum}
            phaseSpectrum={props.phaseSpectrum}
            sampleRate={props.sampleRate ?? 44100}
            isActive={props.isPlaying}
            timeRange={[t0, t1]}
            height={Math.max(60, h - 32)}
          />
        )
      case 'waveform':
        return (
          <WaveformPane
            waveformData={props.waveformData}
            timeRange={[t0, t1]}
            playheadPosition={props.playheadPosition}
            height={Math.max(60, h - 32)}
            isActive={props.isPlaying}
          />
        )
      case 'pitch-trace':
        return (
          <PitchTracePane
            pitchHistory={props.pitchHistory}
            timeRange={[t0, t1]}
            height={Math.max(60, h - 32)}
            isActive={props.isPlaying}
            playheadPosition={props.playheadPosition}
          />
        )
      case 'cents-deviation':
        return (
          <CentsDeviationPane
            centsOffset={props.centsOffset}
            targetNote={props.targetNote ?? null}
            height={Math.max(60, h - 32)}
            isActive={props.isPlaying}
          />
        )
      case 'vibrato':
        return (
          <div
            class={styles.vibratoWrap}
            style={{ height: `${Math.max(80, h - 32)}px` }}
          >
            <VibratoWaveformCanvas
              vibrato={vibratoResult()}
              isActive={props.isPlaying ?? true}
            />
          </div>
        )
      case 'spectrum':
        return (
          <SpectrumPane
            magnitudeSpectrum={props.magnitudeSpectrum}
            sampleRate={props.sampleRate ?? 44100}
            height={Math.max(60, h - 32)}
            isActive={props.isPlaying}
          />
        )
      default:
        return <div class={styles.unknown}>Unknown layer</div>
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div ref={containerRef!} class={styles.root}>
      {/* Toolbar */}
      <div class={styles.toolbar}>
        {/* Add Pane dropdown */}
        <div class={styles.addWrap}>
          <button
            type="button"
            class={styles.toolBtn}
            onClick={() => {
              const menu = document.getElementById('add-pane-menu')
              if (menu)
                menu.style.display =
                  menu.style.display === 'none' ? 'block' : 'none'
            }}
          >
            <Plus />
            Add Pane
          </button>
          {/* `display` is the one declaration that cannot move to the
              stylesheet: the toggle above reads it back off the element, and
              an empty inline value would invert the first click. */}
          <div
            id="add-pane-menu"
            class={styles.menu}
            style={{ display: 'none' }}
          >
            <For each={availableTypes}>
              {(type) => (
                <button
                  type="button"
                  class={styles.menuItem}
                  onClick={() => {
                    addPane(type)
                    const menu = document.getElementById('add-pane-menu')
                    if (menu) menu.style.display = 'none'
                  }}
                >
                  {paneIcon(type)} {PANE_LABELS[type]}
                </button>
              )}
            </For>
          </div>
        </div>

        <div class={styles.spacer} />

        {/* Sync toggle */}
        <button
          type="button"
          class={styles.toolBtn}
          classList={{ [styles.syncOn]: syncTime() }}
          onClick={toggleSyncTime}
          aria-pressed={syncTime()}
          title={
            syncTime()
              ? 'Synced (click to unsync)'
              : 'Independent (click to sync)'
          }
        >
          <LinkChain /> Sync
        </button>

        {/* Reset */}
        <button
          type="button"
          class={styles.toolBtn}
          onClick={() => {
            setTimeRange([0, props.audioDuration || 60])
          }}
          title="Reset time range"
        >
          <RotateCcw /> Reset
        </button>
      </div>

      {/* Panes */}
      <div class={styles.panes}>
        <For each={panes()}>
          {(pane, idx) => (
            <>
              {/* Pane */}
              <div
                class={styles.pane}
                classList={{
                  [styles.paneCollapsed]: pane.collapsed,
                  [styles.paneStatic]: dragState() !== null,
                }}
                style={{
                  height: pane.collapsed ? '32px' : `${pane.height}%`,
                }}
              >
                {/* Pane Header */}
                <div class={styles.paneHeader}>
                  <span class={styles.paneGlyph} aria-hidden="true">
                    {paneIcon(pane.layerType)}
                  </span>
                  <span class={styles.paneTitle}>
                    {PANE_LABELS[pane.layerType]}
                  </span>
                  <div class={styles.spacer} />
                  <button
                    type="button"
                    class={styles.paneBtn}
                    onClick={() => togglePaneCollapse(pane.id)}
                    title={pane.collapsed ? 'Expand' : 'Collapse'}
                  >
                    {pane.collapsed ? <ChevronDown /> : <ChevronUp />}
                  </button>
                  <Show when={panes().length > 1}>
                    <button
                      type="button"
                      class={`${styles.paneBtn} ${styles.paneBtnDanger}`}
                      onClick={() => removePane(pane.id)}
                      title="Remove pane"
                    >
                      <X />
                    </button>
                  </Show>
                </div>

                {/* Pane Content */}
                <Show when={!pane.collapsed}>
                  <div class={styles.paneContent}>
                    {renderPaneContent(pane)}
                  </div>
                </Show>
              </div>

              {/* Resize Handle (between panes) */}
              <Show
                when={
                  !pane.collapsed &&
                  idx() < panes().length - 1 &&
                  !panes()[idx() + 1].collapsed
                }
              >
                <div
                  class={styles.handle}
                  classList={{
                    [styles.handleActive]: dragState()?.paneId === pane.id,
                  }}
                  role="separator"
                  aria-orientation="horizontal"
                  onMouseDown={(e) => onDragStart(e, pane.id)}
                  onTouchStart={(e) =>
                    onDragStart(e as unknown as TouchEvent, pane.id)
                  }
                />
              </Show>
            </>
          )}
        </For>
      </div>

      {/* Time Ruler */}
      <div class={styles.ruler}>
        <For each={timeTicks()}>
          {(t) => {
            const [start, end] = timeRange()
            const dur = end - start
            const pct = dur > 0 ? ((t - start) / dur) * 100 : 0
            return (
              <div class={styles.tick} style={{ left: `${pct}%` }}>
                {formatTime(t)}
              </div>
            )
          }}
        </For>
        {/* Playhead */}
        <Show when={props.playheadPosition > 0}>
          {(() => {
            const [start, end] = timeRange()
            const dur = end - start
            const pct =
              dur > 0 ? ((props.playheadPosition - start) / dur) * 100 : 0
            return <div class={styles.playhead} style={{ left: `${pct}%` }} />
          })()}
        </Show>
      </div>
    </div>
  )
}
