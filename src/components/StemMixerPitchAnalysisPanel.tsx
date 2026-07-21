import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
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
  // Escape closes the panel.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') props.onClose()
  }
  onMount(() => window.addEventListener('keydown', onKey))
  onCleanup(() => window.removeEventListener('keydown', onKey))

  return (
    <div
      class={styles.sidebar}
      style={{
        opacity: previewing() ? '0.2' : '1',
        transition: 'opacity 0.12s ease',
      }}
    >
      <div class={styles.header}>
        <h3 class={styles.title}>
          <Settings />
          Vocal Pitch Settings
        </h3>
        <button
          class={styles.iconBtn}
          title="Close"
          aria-label="Close"
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
            <label class={styles.label}>
              <span>Algorithm</span>
            </label>
            <SafeSelect
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
            <label class={styles.label}>
              <span>Buffer Size</span>
              <span class={styles.value}>{props.bufferSize}</span>
            </label>
            <input
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
            <label class={styles.label}>
              <span>Sensitivity</span>
              <span class={styles.value}>{props.sensitivity}</span>
            </label>
            <input
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
            <label class={styles.label}>
              <span>Min Confidence</span>
              <span class={styles.value}>{props.minConfidence.toFixed(2)}</span>
            </label>
            <input
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
            <label class={styles.label}>
              <span>Min Amplitude</span>
              <span class={styles.value}>{props.minAmplitude.toFixed(3)}</span>
            </label>
            <input
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
            class={styles.btnPrimary}
            onClick={() => props.runAnalysis()}
            disabled={props.isAnalyzing}
            style={{ 'margin-top': '0.3rem' }}
          >
            {props.isAnalyzing
              ? `Analyzing... ${props.progress}%`
              : 'Run Offline Denoising'}
          </button>
        </div>

        {/* ── Section 2: Vocal Cleanup & Key Snapping ──────── */}
        <div
          class={styles.card}
          style={{ opacity: props.contourReady ? '1' : '0.6' }}
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
            <label class={styles.label}>
              <span>Cleanup Amount</span>
              <span class={styles.value}>
                {Math.round(props.cleanupAmount * 100)}%
              </span>
            </label>
            <input
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
              onPointerDown={() => setPreviewing(true)}
              onPointerUp={() => setPreviewing(false)}
              onPointerCancel={() => setPreviewing(false)}
              onBlur={() => setPreviewing(false)}
            />
          </div>

          <div class={styles.controlGroup}>
            <label class={styles.label}>
              <span>Key</span>
            </label>
            <SafeSelect
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
            <label class={styles.label}>
              <span>Scale</span>
            </label>
            <SafeSelect
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
            <label class={styles.label}>
              <span>Tempo (BPM)</span>
            </label>
            <input
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
          class={styles.card}
          style={{ opacity: props.canEdit ? '1' : '0.6' }}
        >
          <h4 class={styles.cardTitle}>Note Editing</h4>
          <button
            class={`${styles.btnSecondary} ${props.editMode ? styles.btnActive : ''}`}
            disabled={!props.canEdit}
            onClick={() => props.onToggleEditMode()}
          >
            {props.editMode ? 'Editing notes…' : 'Edit notes'}
          </button>

          <Show when={props.hasEdits}>
            <div class={styles.btnGroup}>
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
                    class={`${styles.btnSecondary} ${props.pitchView === value ? styles.btnActive : ''}`}
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
          <div class={styles.btnGroup}>
            <button
              class={`${styles.btnSecondary} ${props.pitchSourceMode === 'realtime' ? styles.btnActive : ''}`}
              onClick={() => props.setPitchSourceMode('realtime')}
            >
              Realtime
            </button>
            <button
              class={`${styles.btnSecondary} ${props.pitchSourceMode === 'offline' ? styles.btnActive : ''}`}
              onClick={() => props.setPitchSourceMode('offline')}
            >
              Offline Denoised
            </button>
          </div>
        </div>

        {/* ── Info footer ────────────────────────────────────── */}
        <p class={styles.hint} style={{ 'margin-top': '0.2rem' }}>
          Offline denoising analyzes the vocal track ahead of time to eliminate
          octave jumps, noise artifacts, and smooth note contours.
        </p>
      </div>
    </div>
  )
}
