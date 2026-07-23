import type { Component } from 'solid-js'
import { createSignal, createUniqueId, For, onCleanup, onMount, Show, } from 'solid-js'
import { Settings, X } from '@/components/icons'
import { SafeSelect } from '@/components/shared/SafeSelect'
import type { AnalysisAlgorithm } from '@/features/stem-mixer/useStemMixerPitchAnalysisController'
import { NOTE_NAMES } from '@/lib/scale-data'
import styles from './StemMixerPitchAnalysisPanel.module.css'

/** Scales offered for cleanup key-snapping. */
const CLEANUP_SCALES: { value: string; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'natural-minor', label: 'Minor' },
  { value: 'pentatonic-major', label: 'Pentatonic major' },
  { value: 'pentatonic-minor', label: 'Pentatonic minor' },
  { value: 'chromatic', label: 'Chromatic (no snap)' },
]

export interface StemMixerPitchAnalysisPanelProps {
  algorithm: AnalysisAlgorithm
  setAlgorithm: (a: AnalysisAlgorithm) => void
  bufferSize: number
  setBufferSize: (b: number) => void
  sensitivity: number
  setSensitivity: (s: number) => void
  minConfidence: number
  setMinConfidence: (c: number) => void
  minAmplitude: number
  setMinAmplitude: (a: number) => void
  isAnalyzing: boolean
  progress: number
  pitchSourceMode: 'realtime' | 'offline'
  setPitchSourceMode: (m: 'realtime' | 'offline') => void
  runAnalysis: () => void
  onClose: () => void
  // Cleanup slider (re-segments the retained contour live).
  cleanupAmount: number
  setCleanupAmount: (n: number) => void
  songKey: string
  setSongKey: (k: string) => void
  songScale: string
  setSongScale: (s: string) => void
  songBpm: number
  setSongBpm: (b: number) => void
  contourReady: boolean
  /** Detected key label, e.g. 'C major', or '' if none. */
  detectedKeyLabel: string
  /** Number of detected per-region keys. */
  keyRegionCount: number
  // Edit mode — entering it collapses this panel in favour of the floating
  // StemMixerEditToolbar, which owns the per-note actions.
  editMode: boolean
  onToggleEditMode: () => void
  canEdit: boolean
  hasEdits: boolean
  pitchView: 'edited' | 'original' | 'both'
  setPitchView: (v: 'edited' | 'original' | 'both') => void
}

export const StemMixerPitchAnalysisPanel: Component<
  StemMixerPitchAnalysisPanelProps
> = (props) => {
  // While the cleanup slider is dragged, fade the panel so the pitch view it
  // overlaps stays visible — the user can judge how much cleanup looks right.
  const [previewing, setPreviewing] = createSignal(false)
  const panelId = createUniqueId()
  const titleId = `${panelId}-title`
  const controlId = (name: string): string => `${panelId}-${name}`

  // Escape closes the panel.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') props.onClose()
  }
  onMount(() => window.addEventListener('keydown', onKey))
  onCleanup(() => window.removeEventListener('keydown', onKey))

  return (
    <aside
      class={`${styles.sidebar} ${previewing() ? styles.previewing : ''}`}
      aria-labelledby={titleId}
    >
      <div class={styles.header}>
        <h3 id={titleId} class={styles.title}>
          <span class={styles.titleIcon} aria-hidden="true">
            <Settings />
          </span>
          Vocal Pitch Settings
        </h3>
        <button
          type="button"
          class={styles.iconBtn}
          title="Close pitch settings"
          aria-label="Close pitch settings"
          onClick={() => props.onClose()}
        >
          <X />
        </button>
      </div>

      <div class={styles.body}>
        {/* ── Section 1: Pitch Analysis & Denoising ──────── */}
        <div class={styles.card}>
          <h4 class={styles.cardTitle}>Denoising Engine</h4>

          <div class={styles.controlGroup}>
            <label class={styles.label} for={controlId('algorithm')}>
              <span>Algorithm</span>
            </label>
            <SafeSelect
              id={controlId('algorithm')}
              class={styles.select}
              value={props.algorithm}
              onChange={(e) =>
                props.setAlgorithm(e.currentTarget.value as AnalysisAlgorithm)
              }
              disabled={props.isAnalyzing}
            >
              <option value="auto">Auto (best of YIN + MPM)</option>
              <option value="yin">YIN</option>
              <option value="mpm">MPM</option>
              <option value="swift">SwiftF0 (ML)</option>
            </SafeSelect>
          </div>

          <div class={styles.controlGroup}>
            <label class={styles.label} for={controlId('buffer-size')}>
              <span>Buffer Size</span>
              <span class={styles.value}>{props.bufferSize}</span>
            </label>
            <input
              id={controlId('buffer-size')}
              type="range"
              class={styles.range}
              min="512"
              max="4096"
              step="256"
              value={props.bufferSize}
              onInput={(e) =>
                props.setBufferSize(Number(e.currentTarget.value))
              }
              disabled={props.isAnalyzing}
            />
          </div>

          <div class={styles.controlGroup}>
            <label class={styles.label} for={controlId('sensitivity')}>
              <span>Sensitivity</span>
              <span class={styles.value}>{props.sensitivity}</span>
            </label>
            <input
              id={controlId('sensitivity')}
              type="range"
              class={styles.range}
              min="1"
              max="10"
              step="1"
              value={props.sensitivity}
              onInput={(e) =>
                props.setSensitivity(Number(e.currentTarget.value))
              }
              disabled={props.isAnalyzing}
            />
          </div>

          <div class={styles.controlGroup}>
            <label class={styles.label} for={controlId('min-confidence')}>
              <span>Min Confidence</span>
              <span class={styles.value}>{props.minConfidence.toFixed(2)}</span>
            </label>
            <input
              id={controlId('min-confidence')}
              type="range"
              class={styles.range}
              min="0"
              max="1"
              step="0.05"
              value={props.minConfidence}
              onInput={(e) =>
                props.setMinConfidence(Number(e.currentTarget.value))
              }
              disabled={props.isAnalyzing}
            />
          </div>

          <div class={styles.controlGroup}>
            <label class={styles.label} for={controlId('min-amplitude')}>
              <span>Min Amplitude</span>
              <span class={styles.value}>{props.minAmplitude.toFixed(3)}</span>
            </label>
            <input
              id={controlId('min-amplitude')}
              type="range"
              class={styles.range}
              min="0.001"
              max="0.1"
              step="0.001"
              value={props.minAmplitude}
              onInput={(e) =>
                props.setMinAmplitude(Number(e.currentTarget.value))
              }
              disabled={props.isAnalyzing}
            />
          </div>

          <button
            type="button"
            class={styles.btnPrimary}
            onClick={() => props.runAnalysis()}
            disabled={props.isAnalyzing}
            aria-busy={props.isAnalyzing}
            style={{ 'margin-top': '0.3rem' }}
          >
            {props.isAnalyzing
              ? `Analyzing... ${props.progress}%`
              : 'Run Offline Denoising'}
          </button>
        </div>

        {/* ── Section 2: Vocal Cleanup & Key Snapping ──────── */}
        <div
          class={`${styles.card} ${props.contourReady ? '' : styles.cardDisabled}`}
          aria-disabled={!props.contourReady}
        >
          <div class={styles.cardTitle}>
            <span>Vocal Cleanup</span>
            <Show when={props.detectedKeyLabel !== ''}>
              <span class={styles.badge} title="Detected key for vocal take">
                {props.detectedKeyLabel}
                {props.keyRegionCount > 1
                  ? ` (${props.keyRegionCount} regions)`
                  : ''}
              </span>
            </Show>
          </div>

          <div class={styles.controlGroup}>
            <label class={styles.label} for={controlId('cleanup-amount')}>
              <span>Cleanup Amount</span>
              <span class={styles.value}>
                {Math.round(props.cleanupAmount * 100)}%
              </span>
            </label>
            <input
              id={controlId('cleanup-amount')}
              type="range"
              class={styles.range}
              min="0"
              max="100"
              step="1"
              value={Math.round(props.cleanupAmount * 100)}
              disabled={!props.contourReady}
              onInput={(e) =>
                props.setCleanupAmount(Number(e.currentTarget.value) / 100)
              }
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                setPreviewing(true)
              }}
              onPointerUp={() => setPreviewing(false)}
              onPointerCancel={() => setPreviewing(false)}
              onLostPointerCapture={() => setPreviewing(false)}
              onBlur={() => setPreviewing(false)}
            />
          </div>

          <div class={styles.controlGroup}>
            <label class={styles.label} for={controlId('song-key')}>
              <span>Key</span>
            </label>
            <SafeSelect
              id={controlId('song-key')}
              class={styles.select}
              value={props.songKey}
              disabled={!props.contourReady}
              onChange={(e) => props.setSongKey(e.currentTarget.value)}
            >
              <For each={NOTE_NAMES}>
                {(k) => <option value={k}>{k}</option>}
              </For>
            </SafeSelect>
          </div>

          <div class={styles.controlGroup}>
            <label class={styles.label} for={controlId('song-scale')}>
              <span>Scale</span>
            </label>
            <SafeSelect
              id={controlId('song-scale')}
              class={styles.select}
              value={props.songScale}
              disabled={!props.contourReady}
              onChange={(e) => props.setSongScale(e.currentTarget.value)}
            >
              <For each={CLEANUP_SCALES}>
                {(s) => <option value={s.value}>{s.label}</option>}
              </For>
            </SafeSelect>
          </div>

          <div class={styles.controlGroup}>
            <label class={styles.label} for={controlId('song-bpm')}>
              <span>Tempo (BPM)</span>
            </label>
            <input
              id={controlId('song-bpm')}
              type="number"
              class={styles.input}
              min="40"
              max="280"
              value={props.songBpm}
              disabled={!props.contourReady}
              onInput={(e) =>
                props.setSongBpm(Number(e.currentTarget.value) || 120)
              }
            />
          </div>

          <p class={styles.hint}>
            {props.contourReady
              ? 'Drag to clean detected notes. Key/scale drive pitch snapping; tempo drives note quantization.'
              : 'Run analysis to enable cleanup & snapping.'}
          </p>
        </div>

        {/* ── Section 3: Manual Note Editing ─────────────────── */}
        <div
          class={`${styles.card} ${props.canEdit ? '' : styles.cardDisabled}`}
          aria-disabled={!props.canEdit}
        >
          <h4 class={styles.cardTitle}>Note Editing</h4>
          <button
            type="button"
            class={`${styles.btnSecondary} ${props.editMode ? styles.btnActive : ''}`}
            disabled={!props.canEdit}
            aria-pressed={props.editMode}
            onClick={() => props.onToggleEditMode()}
          >
            {props.editMode ? 'Editing notes…' : 'Edit notes'}
          </button>

          <Show when={props.hasEdits}>
            <div
              class={styles.btnGroup}
              role="group"
              aria-label="Pitch edit comparison"
            >
              <For
                each={
                  [
                    ['original', 'Original'],
                    ['edited', 'Edited'],
                    ['both', 'Both'],
                  ] as const
                }
              >
                {([value, label]) => (
                  <button
                    type="button"
                    class={`${styles.btnSecondary} ${props.pitchView === value ? styles.btnActive : ''}`}
                    aria-pressed={props.pitchView === value}
                    onClick={() => props.setPitchView(value)}
                  >
                    {label}
                  </button>
                )}
              </For>
            </div>
          </Show>

          <p class={styles.hint}>
            {!props.canEdit
              ? 'Run analysis to enable manual editing.'
              : 'Manually adjust detected notes — a toolbar opens while editing.'}
          </p>
        </div>

        {/* ── Section 4: Pitch Display Mode ─────────────────── */}
        <div class={styles.card}>
          <h4 class={styles.cardTitle}>Canvas Pitch Mode</h4>
          <div
            class={styles.btnGroup}
            role="group"
            aria-label="Canvas pitch mode"
          >
            <button
              type="button"
              class={`${styles.btnSecondary} ${props.pitchSourceMode === 'realtime' ? styles.btnActive : ''}`}
              aria-pressed={props.pitchSourceMode === 'realtime'}
              onClick={() => props.setPitchSourceMode('realtime')}
            >
              Realtime
            </button>
            <button
              type="button"
              class={`${styles.btnSecondary} ${props.pitchSourceMode === 'offline' ? styles.btnActive : ''}`}
              aria-pressed={props.pitchSourceMode === 'offline'}
              onClick={() => props.setPitchSourceMode('offline')}
            >
              Offline Denoised
            </button>
          </div>
        </div>

        {/* ── Info footer ────────────────────────────────────── */}
        <p class={`${styles.hint} ${styles.footerHint}`}>
          Offline denoising analyzes the vocal track ahead of time to eliminate
          octave jumps, noise artifacts, and smooth note contours.
        </p>
      </div>
    </aside>
  )
}
