import type { Component } from 'solid-js'
import { CentsDeviationCanvas } from '@/components/CentsDeviationCanvas'
import { SpectrogramCanvas } from '@/components/SpectrogramCanvas'
import { VibratoWaveformCanvas } from '@/components/VibratoWaveformCanvas'
import type { LiveAnalysisSnapshot } from '@/lib/live-pitch-analysis'
import type { BreathinessResult, HarmonicRichnessResult, ResonanceResult, VibratoResult, } from '@/lib/vocal-analyzer'
import { computeTonalQuality } from '@/lib/vocal-analyzer'
import { ProFader } from './ProFader'
import { ProKnob } from './ProKnob'

// ── Style constants ────────────────────────────────────────────

const pillarBg = {
  background: '#0f172a',
  padding: '24px',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '24px',
} as const
const pillarHeader = (color: string) =>
  ({
    color,
    'font-size': '0.875rem',
    'font-weight': '600',
    'border-bottom': `2px solid ${color}`,
    'padding-bottom': '4px',
    width: '100%',
    'text-align': 'center',
  }) as const

// ── Props ──────────────────────────────────────────────────────

export interface ProDashboardProps {
  isActive: boolean
  pitchStability: number | null
  centsOffset: number | null
  targetNote: string | null
  liveSnapshot: LiveAnalysisSnapshot | null
  vibrato: VibratoResult | null
  spectralMagnitude: Float32Array | null
  /** Real FFT-based breathiness (HNR) from spectral worker */
  fftBreathiness: BreathinessResult | null
  /** Real FFT-based harmonic richness from spectral worker */
  fftRichness: HarmonicRichnessResult | null
  /** Real FFT-based resonance from spectral worker */
  fftResonance: ResonanceResult | null
  /** Audio sample rate for spectrogram frequency axis. Default 44100. */
  sampleRate?: number
}

export const ProDashboard: Component<ProDashboardProps> = (props) => {
  // ── Derived metrics ──────────────────────────────────────

  const centsOffset = () => props.centsOffset
  const pitchAccuracy = () => {
    const c = centsOffset()
    if (c === null) return 0
    return Math.max(0, Math.round(100 - Math.abs(c) * 2)) // 0¢=100, 50¢=0
  }
  const tonalQuality = () =>
    props.fftRichness?.richnessScore ?? props.liveSnapshot?.richness?.score ?? 0
  const pitchStab = () => props.pitchStability ?? 0
  const hnrScore = () =>
    props.fftBreathiness?.efficiency ??
    props.liveSnapshot?.breathiness?.score ??
    0
  const resonanceConfidence = () =>
    props.liveSnapshot?.resonance?.confidence ?? 0

  const tonalQualityScore = () =>
    computeTonalQuality(hnrScore(), tonalQuality(), pitchStab())

  // Real resonance zone ratios from FFT (0-1 mapped to 0-100 for faders)
  const chestRatio = () =>
    Math.round((props.fftResonance?.chestRatio ?? 0.33) * 100)
  const maskRatio = () =>
    Math.round((props.fftResonance?.maskRatio ?? 0.34) * 100)
  const headRatio = () =>
    Math.round((props.fftResonance?.headRatio ?? 0.33) * 100)

  return (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'column',
        gap: '2px',
        background: '#090e17',
        'border-radius': '12px',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header: Spectrogram background + master knobs */}
      <div
        style={{
          position: 'relative',
          height: '160px',
          width: '100%',
          background: 'linear-gradient(180deg, #111a28 0%, #090e17 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.8,
            'mix-blend-mode': 'screen',
          }}
        >
          <SpectrogramCanvas
            isActive={props.isActive}
            magnitudeSpectrum={props.spectralMagnitude}
            sampleRate={props.sampleRate}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            top: '24px',
            left: '24px',
            display: 'flex',
            gap: '32px',
          }}
        >
          <ProKnob
            label="Accuracy"
            value={pitchAccuracy()}
            min={0}
            max={100}
            color="#ef4444"
            size={80}
            showValue
          />
          <ProKnob
            label="Tone"
            value={tonalQualityScore().score}
            min={0}
            max={100}
            color="#3b82f6"
            size={80}
            showValue
            valueFormatter={(_v) => tonalQualityScore().label}
          />
        </div>
      </div>

      {/* 2. Three pillars: Pitch, Resonance, Dynamics */}
      <div
        style={{
          display: 'grid',
          'grid-template-columns': '1fr 1fr 1fr',
          gap: '1px',
          background: '#1e293b',
        }}
      >
        {/* Pillar 1: Pitch (Green) */}
        <div style={pillarBg}>
          <div style={pillarHeader('#2dd4bf')}>⏻ pitch</div>

          <ProKnob
            label="Stability"
            value={pitchStab()}
            min={0}
            max={100}
            color="#2dd4bf"
            size={60}
          />

          <div style={{ display: 'flex', gap: '16px' }}>
            <ProKnob
              label="Cents"
              value={centsOffset() !== null ? Math.abs(centsOffset()!) : 0}
              min={0}
              max={50}
              color="#2dd4bf"
              size={40}
              valueFormatter={(v) => `±${v.toFixed(0)}¢`}
            />
            <ProKnob
              label="On Note"
              value={props.targetNote !== null ? 100 : 0}
              min={0}
              max={100}
              color="#2dd4bf"
              size={40}
              valueFormatter={(_v) => props.targetNote ?? '--'}
            />
          </div>
        </div>

        {/* Pillar 2: Resonance (Orange) — chest/mask/head ratios */}
        <div style={pillarBg}>
          <div style={pillarHeader('#fb923c')}>⏻ resonance</div>

          <div style={{ display: 'flex', gap: '24px', height: '120px' }}>
            <ProFader
              label="Chest"
              value={chestRatio()}
              min={0}
              max={100}
              color="#f97316"
              ticks={[25, 50, 75]}
            />
            <ProFader
              label="Mask"
              value={maskRatio()}
              min={0}
              max={100}
              color="#fb923c"
              ticks={[25, 50, 75]}
            />
            <ProFader
              label="Head"
              value={headRatio()}
              min={0}
              max={100}
              color="#fdba74"
              ticks={[25, 50, 75]}
            />
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.5)',
              'font-size': '0.7rem',
              'text-align': 'center',
            }}
          >
            {props.fftResonance?.dominantZone !== undefined
              ? `${props.fftResonance.dominantZone} dominant`
              : (props.liveSnapshot?.resonance?.zone ?? '')}
          </div>
        </div>

        {/* Pillar 3: Dynamics (Yellow) */}
        <div style={pillarBg}>
          <div style={pillarHeader('#eab308')}>⏻ dynamics</div>

          <ProKnob
            label="HNR"
            value={hnrScore()}
            min={0}
            max={100}
            color="#eab308"
            size={60}
            valueFormatter={(v) => {
              if (v >= 80) return 'Resonant'
              if (v >= 60) return 'Normal'
              return 'Breathy'
            }}
          />

          <div style={{ display: 'flex', gap: '16px' }}>
            <ProKnob
              label="Clarity"
              value={resonanceConfidence()}
              min={0}
              max={100}
              color="#eab308"
              size={40}
            />
            <ProKnob
              label="Weight"
              value={tonalQuality()}
              min={0}
              max={100}
              color="#eab308"
              size={40}
              valueFormatter={(v) => {
                if (v >= 75) return 'Rich'
                if (v >= 50) return 'Normal'
                return 'Thin'
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. Bottom: Vibrato + Cents Deviation widgets */}
      <div
        style={{
          background: '#090e17',
          padding: '16px 24px',
          display: 'flex',
          gap: '24px',
        }}
      >
        <div
          style={{ flex: '0 0 200px', height: '100px', position: 'relative' }}
        >
          <VibratoWaveformCanvas
            isActive={props.isActive}
            vibrato={props.vibrato}
          />
        </div>

        <div
          style={{
            flex: 1,
            height: '100px',
            display: 'flex',
            'flex-direction': 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              'justify-content': 'space-between',
              'margin-bottom': '4px',
            }}
          >
            <span
              style={{
                color: 'rgba(255,255,255,0.7)',
                'font-size': '0.75rem',
                'font-weight': '600',
              }}
            >
              ⏻ pitch trace
            </span>
            <span
              style={{ color: 'rgba(255,255,255,0.4)', 'font-size': '0.75rem' }}
            >
              {props.targetNote ?? '--'}
            </span>
          </div>
          <div style={{ position: 'relative', flex: 1, 'min-height': 0 }}>
            <CentsDeviationCanvas
              isActive={props.isActive}
              centsOffset={props.centsOffset}
              targetNote={props.targetNote}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
