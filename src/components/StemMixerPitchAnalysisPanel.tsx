import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { X } from '@/components/icons'
import { SafeSelect } from '@/components/shared/SafeSelect'
import type { PitchAlgorithm } from '@/lib/pitch-detector'
import { NOTE_NAMES } from '@/lib/scale-data'

/** Scales offered for cleanup key-snapping. */
const CLEANUP_SCALES: { value: string; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'natural-minor', label: 'Minor' },
  { value: 'pentatonic-major', label: 'Pentatonic major' },
  { value: 'pentatonic-minor', label: 'Pentatonic minor' },
  { value: 'chromatic', label: 'Chromatic (no snap)' },
]

export interface StemMixerPitchAnalysisPanelProps {
  algorithm: PitchAlgorithm
  setAlgorithm: (a: PitchAlgorithm) => void
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
      class="sm-pitch-analysis-panel sm-panel-content"
      style={{
        opacity: previewing() ? '0.2' : '1',
        transition: 'opacity 0.12s ease',
        // Compact: cap the height and scroll (the sticky header keeps the
        // close button reachable). Background is set so the sticky header
        // blends seamlessly instead of showing a darker band.
        background: 'var(--bg-card, #1c2128)',
        'max-height': '44vh',
        'overflow-y': 'auto',
      }}
    >
      <div
        class="sm-pitch-analysis-header"
        style={{
          position: 'sticky',
          top: '0',
          'z-index': '2',
          background: 'var(--bg-card, #1c2128)',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          gap: '0.5rem',
          padding: '0.5rem 0',
        }}
      >
        <h3 style={{ margin: '0' }}>Vocal Pitch Analysis</h3>
        <button
          class="sm-btn sm-btn-secondary"
          title="Close"
          aria-label="Close"
          style={{
            display: 'inline-flex',
            'align-items': 'center',
            'justify-content': 'center',
            background: 'transparent',
            border: '1px solid var(--border, #30363d)',
            'border-radius': '6px',
            color: 'var(--text-secondary, #a8b3bf)',
            padding: '4px 6px',
            cursor: 'pointer',
          }}
          onClick={() => props.onClose()}
        >
          <X />
        </button>
      </div>

      <div class="sm-pitch-analysis-body">
        <div class="sm-pitch-analysis-controls">
          <label>
            <span>Algorithm</span>
            <SafeSelect
              value={props.algorithm}
              onChange={(e) =>
                props.setAlgorithm(e.currentTarget.value as PitchAlgorithm)
              }
              disabled={props.isAnalyzing}
            >
              <option value="yin">YIN</option>
              <option value="mpm">MPM</option>
              <option value="swift">SwiftF0 (ML)</option>
            </SafeSelect>
          </label>

          <label>
            <span>Buffer Size ({props.bufferSize})</span>
            <input
              type="range"
              min="512"
              max="4096"
              step="256"
              value={props.bufferSize}
              onInput={(e) =>
                props.setBufferSize(Number(e.currentTarget.value))
              }
              disabled={props.isAnalyzing}
            />
          </label>

          <label>
            <span>Sensitivity ({props.sensitivity})</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={props.sensitivity}
              onInput={(e) =>
                props.setSensitivity(Number(e.currentTarget.value))
              }
              disabled={props.isAnalyzing}
            />
          </label>

          <label>
            <span>Min Confidence ({props.minConfidence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={props.minConfidence}
              onInput={(e) =>
                props.setMinConfidence(Number(e.currentTarget.value))
              }
              disabled={props.isAnalyzing}
            />
          </label>

          <label>
            <span>Min Amplitude ({props.minAmplitude.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.1"
              step="0.001"
              value={props.minAmplitude}
              onInput={(e) =>
                props.setMinAmplitude(Number(e.currentTarget.value))
              }
              disabled={props.isAnalyzing}
            />
          </label>

          <button
            class="sm-btn sm-btn-primary"
            onClick={() => props.runAnalysis()}
            disabled={props.isAnalyzing}
            style={{ 'margin-top': '1rem' }}
          >
            {props.isAnalyzing
              ? `Analyzing... ${props.progress}%`
              : 'Run Offline Denoising'}
          </button>

          <div
            class="sm-pitch-cleanup"
            style={{
              display: 'flex',
              'flex-direction': 'column',
              gap: '0.5rem',
              'margin-top': '1rem',
              opacity: props.contourReady ? '1' : '0.5',
            }}
          >
            <span style={{ 'font-size': '0.85rem', 'font-weight': '500' }}>
              Cleanup
            </span>
            <Show when={props.detectedKeyLabel !== ''}>
              <small style={{ color: 'var(--text-muted)' }}>
                Detected key: <strong>{props.detectedKeyLabel}</strong>
                {props.keyRegionCount > 1
                  ? ` · ${props.keyRegionCount} regions`
                  : ''}
              </small>
            </Show>
            <label>
              <span>
                Amount ({Math.round(props.cleanupAmount * 100)}%) — as detected
                to clean
              </span>
              <input
                type="range"
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
            </label>
            <label>
              <span>Key</span>
              <SafeSelect
                value={props.songKey}
                disabled={!props.contourReady}
                onChange={(e) => props.setSongKey(e.currentTarget.value)}
              >
                <For each={NOTE_NAMES}>
                  {(k) => <option value={k}>{k}</option>}
                </For>
              </SafeSelect>
            </label>
            <label>
              <span>Scale</span>
              <SafeSelect
                value={props.songScale}
                disabled={!props.contourReady}
                onChange={(e) => props.setSongScale(e.currentTarget.value)}
              >
                <For each={CLEANUP_SCALES}>
                  {(s) => <option value={s.value}>{s.label}</option>}
                </For>
              </SafeSelect>
            </label>
            <label>
              <span>Tempo (BPM)</span>
              <input
                type="number"
                min="40"
                max="280"
                value={props.songBpm}
                disabled={!props.contourReady}
                onInput={(e) =>
                  props.setSongBpm(Number(e.currentTarget.value) || 120)
                }
              />
            </label>
            <small style={{ color: 'var(--text-muted)' }}>
              {props.contourReady
                ? 'Drag to clean the detected notes. Key/scale drive snapping; tempo drives timing.'
                : 'Run analysis to enable cleanup.'}
            </small>
          </div>

          <div
            class="sm-pitch-edit"
            style={{
              display: 'flex',
              'flex-direction': 'column',
              gap: '0.5rem',
              'margin-top': '1rem',
              opacity: props.canEdit ? '1' : '0.5',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                class={`sm-btn ${props.editMode ? 'sm-btn-primary' : 'sm-btn-secondary'}`}
                style={{ flex: '1' }}
                disabled={!props.canEdit}
                onClick={() => props.onToggleEditMode()}
              >
                {props.editMode ? 'Editing notes…' : 'Edit notes'}
              </button>
            </div>

            {/* Show: original (algorithm) / edited / both. */}
            <div
              style={{
                display: props.hasEdits ? 'flex' : 'none',
                gap: '0.5rem',
              }}
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
                    class={`sm-btn ${props.pitchView === value ? 'sm-btn-primary' : 'sm-btn-secondary'}`}
                    style={{ flex: '1' }}
                    onClick={() => props.setPitchView(value)}
                  >
                    {label}
                  </button>
                )}
              </For>
            </div>

            <small style={{ color: 'var(--text-muted)' }}>
              {!props.canEdit
                ? 'Run analysis to enable editing.'
                : 'Manually clean up the detected notes — a toolbar appears while editing.'}
            </small>
          </div>

          <div
            style={{
              display: 'flex',
              'flex-direction': 'column',
              gap: '0.5rem',
              'margin-top': '1rem',
            }}
          >
            <span
              style={{
                'font-size': '0.85rem',
                'font-weight': '500',
                color: 'var(--fg-primary, #c9d1d9)',
              }}
            >
              Canvas Pitch Display Mode
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                class={`sm-btn ${props.pitchSourceMode === 'realtime' ? 'sm-btn-primary' : 'sm-btn-secondary'}`}
                style={{ flex: '1' }}
                onClick={() => props.setPitchSourceMode('realtime')}
              >
                Realtime
              </button>
              <button
                class={`sm-btn ${props.pitchSourceMode === 'offline' ? 'sm-btn-primary' : 'sm-btn-secondary'}`}
                style={{ flex: '1' }}
                onClick={() => props.setPitchSourceMode('offline')}
              >
                Offline Denoised
              </button>
            </div>
          </div>
        </div>

        <div
          class="sm-pitch-analysis-info"
          style={{ 'margin-top': '1rem', color: 'var(--text-muted)' }}
        >
          <p>
            Offline denoising analyzes the entire vocal buffer ahead of time,
            allowing temporal smoothing to join fragments and eliminate erratic
            octave jumps and noise.
          </p>
        </div>
      </div>
    </div>
  )
}
