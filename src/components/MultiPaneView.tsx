// ============================================================
// MultiPaneView — Resizable multi-pane layout with sync'd time axes
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { addPane, paneLayout, removePane, setPaneHeights, togglePaneCollapse, toggleSyncTime, } from '@/stores/pane-layout-store'
import type { PaneConfig, PaneLayerType } from '@/types'
import { CentsDeviationPane } from './panes/CentsDeviationPane'
import { PitchTracePane } from './panes/PitchTracePane'
// ── Pane renderer selectors (imported lazily to avoid circular deps) ──
import { SpectrogramPane } from './panes/SpectrogramPane'
import { SpectrumPane } from './panes/SpectrumPane'
import { WaveformPane } from './panes/WaveformPane'

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

const PANE_ICONS: Record<PaneLayerType, string> = {
  spectrogram: '≋',
  waveform: '∿',
  'pitch-trace': '╱╲',
  'cents-deviation': '◎',
  vibrato: '〜',
  annotation: '📝',
  spectrum: '▁',
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

  // ── Render a single pane ───────────────────────────────────
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
            style={{
              padding: '8px',
              color: 'rgba(255,255,255,0.6)',
              'font-size': '0.75rem',
            }}
          >
            Vibrato: rate={props.vibratoRate ?? '--'} Hz, depth=
            {props.vibratoDepth ?? '--'} ¢
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
        return (
          <div style={{ padding: '12px', color: 'rgba(255,255,255,0.4)' }}>
            Unknown layer
          </div>
        )
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      ref={containerRef!}
      class="multi-pane-view"
      style={{
        display: 'flex',
        'flex-direction': 'column',
        height: '100%',
        'min-height': '400px',
        background: 'var(--surface-1, rgba(255,255,255,0.02))',
        'border-radius': '8px',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        class="multi-pane-toolbar"
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: '8px',
          padding: '6px 12px',
          'border-bottom': '1px solid var(--border, rgba(255,255,255,0.08))',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        {/* Add Pane dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            class="pane-toolbar-btn"
            onClick={() => {
              const menu = document.getElementById('add-pane-menu')
              if (menu)
                menu.style.display =
                  menu.style.display === 'none' ? 'block' : 'none'
            }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.7)',
              'font-size': '0.75rem',
              padding: '4px 10px',
              'border-radius': '4px',
              cursor: 'pointer',
            }}
          >
            + Add Pane
          </button>
          <div
            id="add-pane-menu"
            style={{
              display: 'none',
              position: 'absolute',
              top: '100%',
              left: 0,
              'z-index': 100,
              background: 'var(--surface-2, #1a1a2e)',
              border: '1px solid var(--border, rgba(255,255,255,0.15))',
              'border-radius': '6px',
              'min-width': '160px',
              'margin-top': '4px',
              'box-shadow': '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            <For each={availableTypes}>
              {(type) => (
                <button
                  class="pane-menu-item"
                  onClick={() => {
                    addPane(type)
                    const menu = document.getElementById('add-pane-menu')
                    if (menu) menu.style.display = 'none'
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    'text-align': 'left',
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    'font-size': '0.8rem',
                  }}
                >
                  {PANE_ICONS[type]} {PANE_LABELS[type]}
                </button>
              )}
            </For>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Sync toggle */}
        <button
          class="pane-toolbar-btn"
          onClick={toggleSyncTime}
          title={
            syncTime()
              ? 'Synced (click to unsync)'
              : 'Independent (click to sync)'
          }
          style={{
            background: syncTime()
              ? 'rgba(34,197,94,0.15)'
              : 'rgba(255,255,255,0.06)',
            border: syncTime()
              ? '1px solid rgba(34,197,94,0.3)'
              : '1px solid rgba(255,255,255,0.1)',
            color: syncTime() ? '#22c55e' : 'rgba(255,255,255,0.5)',
            'font-size': '0.72rem',
            padding: '4px 10px',
            'border-radius': '4px',
            cursor: 'pointer',
          }}
        >
          🔗 Sync
        </button>

        {/* Reset */}
        <button
          class="pane-toolbar-btn"
          onClick={() => {
            setTimeRange([0, props.audioDuration || 60])
          }}
          title="Reset time range"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)',
            'font-size': '0.72rem',
            padding: '4px 10px',
            'border-radius': '4px',
            cursor: 'pointer',
          }}
        >
          ↺ Reset
        </button>
      </div>

      {/* Panes */}
      <div
        class="multi-pane-panes"
        style={{
          flex: 1,
          display: 'flex',
          'flex-direction': 'column',
          overflow: 'hidden',
        }}
      >
        <For each={panes()}>
          {(pane, idx) => (
            <>
              {/* Pane */}
              <div
                class={`multi-pane ${pane.collapsed ? 'collapsed' : ''}`}
                style={{
                  height: pane.collapsed ? '32px' : `${pane.height}%`,
                  'min-height': pane.collapsed ? '32px' : '60px',
                  display: 'flex',
                  'flex-direction': 'column',
                  'border-bottom':
                    idx() < panes().length - 1
                      ? '1px solid rgba(255,255,255,0.04)'
                      : 'none',
                  transition: dragState() ? 'none' : 'height 0.15s ease',
                }}
              >
                {/* Pane Header */}
                <div
                  class="pane-header"
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '6px',
                    padding: '2px 10px',
                    background: 'rgba(255,255,255,0.02)',
                    'min-height': '28px',
                    'user-select': 'none',
                  }}
                >
                  <span
                    style={{
                      'font-size': '0.75rem',
                      color: 'rgba(255,255,255,0.5)',
                      'margin-right': '2px',
                    }}
                  >
                    {PANE_ICONS[pane.layerType]}
                  </span>
                  <span
                    style={{
                      'font-size': '0.72rem',
                      color: 'rgba(255,255,255,0.65)',
                      'font-weight': '500',
                    }}
                  >
                    {PANE_LABELS[pane.layerType]}
                  </span>
                  <div style={{ flex: 1 }} />
                  <button
                    class="pane-header-btn"
                    onClick={() => togglePaneCollapse(pane.id)}
                    title={pane.collapsed ? 'Expand' : 'Collapse'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      'font-size': '0.7rem',
                      padding: '0 4px',
                    }}
                  >
                    {pane.collapsed ? '▸' : '▾'}
                  </button>
                  <Show when={panes().length > 1}>
                    <button
                      class="pane-header-btn"
                      onClick={() => removePane(pane.id)}
                      title="Remove pane"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.3)',
                        cursor: 'pointer',
                        'font-size': '0.7rem',
                        padding: '0 4px',
                      }}
                    >
                      ×
                    </button>
                  </Show>
                </div>

                {/* Pane Content */}
                <Show when={!pane.collapsed}>
                  <div
                    class="pane-content"
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
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
                  class="pane-resize-handle"
                  onMouseDown={(e) => onDragStart(e, pane.id)}
                  onTouchStart={(e) =>
                    onDragStart(e as unknown as TouchEvent, pane.id)
                  }
                  style={{
                    height: '6px',
                    'min-height': '6px',
                    cursor: 'row-resize',
                    background:
                      dragState()?.paneId === pane.id
                        ? 'rgba(88,166,255,0.3)'
                        : 'rgba(255,255,255,0.03)',
                    transition: dragState() ? 'none' : 'background 0.15s',
                    'flex-shrink': 0,
                    'z-index': 10,
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background =
                      'rgba(88,166,255,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    if (dragState()?.paneId !== pane.id) {
                      ;(e.currentTarget as HTMLElement).style.background =
                        'rgba(255,255,255,0.03)'
                    }
                  }}
                />
              </Show>
            </>
          )}
        </For>
      </div>

      {/* Time Ruler */}
      <div
        class="multi-pane-time-ruler"
        style={{
          height: '24px',
          'min-height': '24px',
          display: 'flex',
          'align-items': 'center',
          padding: '0 12px',
          'border-top': '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          position: 'relative',
          'font-size': '0.65rem',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        <For each={timeTicks()}>
          {(t) => {
            const [start, end] = timeRange()
            const dur = end - start
            const pct = dur > 0 ? ((t - start) / dur) * 100 : 0
            return (
              <div
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  bottom: '4px',
                  transform: 'translateX(-50%)',
                  'font-size': '0.6rem',
                  color: 'rgba(255,255,255,0.35)',
                }}
              >
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
            return (
              <div
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  background: '#f85149',
                  'z-index': 5,
                  'pointer-events': 'none',
                }}
              />
            )
          })()}
        </Show>
      </div>
    </div>
  )
}
