import type { Component } from 'solid-js'
import type { PitchAlgorithm } from '@/lib/pitch-detector'

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
}

export const StemMixerPitchAnalysisPanel: Component<
  StemMixerPitchAnalysisPanelProps
> = (props) => {
  return (
    <div class="sm-pitch-analysis-panel sm-panel-content">
      <div class="sm-pitch-analysis-header">
        <h3>Vocal Pitch Analysis</h3>
        <button class="sm-btn sm-btn-secondary" onClick={() => props.onClose()}>
          Close
        </button>
      </div>

      <div class="sm-pitch-analysis-body">
        <div class="sm-pitch-analysis-controls">
          <label>
            <span>Algorithm</span>
            <select
              value={props.algorithm}
              onChange={(e) =>
                props.setAlgorithm(e.currentTarget.value as PitchAlgorithm)
              }
              disabled={props.isAnalyzing}
            >
              <option value="yin">YIN</option>
              <option value="mpm">MPM</option>
              <option value="swift">SwiftF0 (ML)</option>
            </select>
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
