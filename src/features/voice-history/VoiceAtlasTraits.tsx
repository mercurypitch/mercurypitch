// ============================================================
// Voice Atlas Traits — neutral pitch and tone facets for kept takes
// ============================================================
//
// Pitch facets come from the contour already stored with a take. Tone facets
// are opt-in because they decode private local audio and run the same spectral
// worker as Vocal Analysis. Nothing is uploaded or written back to the take.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, Show, } from 'solid-js'
import { Sparkles } from '@/components/icons'
import type { VoiceTakeRecord } from '@/db/entities'
import { getVoiceTakeBlob } from '@/db/services/voice-take-service'
import { decodeAudioBlobToMono } from '@/lib/decode-audio-to-mono'
import type { TakeAnalysisResult } from '@/lib/take-analysis-client'
import { TakeAnalysisClient } from '@/lib/take-analysis-client'
import type { DecodedVoiceAtlasContour } from '@/lib/voice-contour'
import type { VoicePitchTraits } from '@/lib/voice-trait-analysis'
import { analyzeVoicePitchTraits, voiceContourFundamentalHz, } from '@/lib/voice-trait-analysis'
import styles from './VoiceAtlasTraits.module.css'

type TimbreReading = NonNullable<TakeAnalysisResult['timbre']>
type ToneState =
  | { status: 'idle' }
  | { status: 'loading'; progress: number }
  | { status: 'ready'; timbre: TimbreReading | null }
  | { status: 'error'; message: string }

interface SelectedTake {
  label: 'Earlier' | 'Later'
  take: VoiceTakeRecord
  contour: DecodedVoiceAtlasContour | null
}

interface VoiceAtlasTraitsProps {
  earlier: VoiceTakeRecord | null
  later: VoiceTakeRecord | null
  earlierContour: DecodedVoiceAtlasContour | null
  laterContour: DecodedVoiceAtlasContour | null
}

interface TraitRowProps {
  label: string
  value: string
  detail: string
  visual?: JSX.Element
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
}

function TraitRow(props: TraitRowProps): JSX.Element {
  return (
    <li class={styles.traitRow}>
      <div class={styles.traitCopy}>
        <span>{props.label}</span>
        <strong>{props.value}</strong>
        <small>{props.detail}</small>
      </div>
      <Show when={props.visual}>{props.visual}</Show>
    </li>
  )
}

function airLabel(timbre: TimbreReading): string {
  if (timbre.breathiness.quality === 'breathy') return 'Air-led'
  if (timbre.breathiness.quality === 'normal') return 'Balanced air'
  if (timbre.breathiness.quality === 'resonant') return 'Clear ring'
  return 'Dense edge'
}

function bloomLabel(timbre: TimbreReading): string {
  if (timbre.richness.quality === 'thin') return 'Focused core'
  if (timbre.richness.quality === 'normal') return 'Layered core'
  if (timbre.richness.quality === 'rich') return 'Harmonic bloom'
  return 'Wide bloom'
}

function resonanceLabel(timbre: TimbreReading): string {
  if (timbre.resonance.dominantZone === 'chest') return 'Chest-led'
  if (timbre.resonance.dominantZone === 'mask') return 'Forward-led'
  if (timbre.resonance.dominantZone === 'head') return 'Head-led'
  return 'Mixed field'
}

function vibratoLabel(pitch: VoicePitchTraits): string {
  if (!pitch.vibrato.detected) return 'No sustained pulse resolved'
  if (pitch.vibrato.classification === 'slow-operatic') return 'Slow pulse'
  if (pitch.vibrato.classification === 'natural') return 'Even pulse'
  if (pitch.vibrato.classification === 'wide') return 'Wide pulse'
  return 'Quick pulse'
}

function heldCenterLabel(spread: number): string {
  if (spread < 15) return 'Narrow centre'
  if (spread < 30) return 'Gentle drift'
  if (spread < 60) return 'Open drift'
  return 'Moving centre'
}

function SpectrumVisual(props: {
  value: number
  start: string
  end: string
}): JSX.Element {
  return (
    <div class={styles.spectrumVisual} aria-hidden="true">
      <span>{props.start}</span>
      <i>
        <b style={{ '--trait-position': `${clampPercent(props.value)}%` }} />
      </i>
      <span>{props.end}</span>
    </div>
  )
}

function ResonanceVisual(props: { timbre: TimbreReading }): JSX.Element {
  const resonance = (): TimbreReading['resonance'] => props.timbre.resonance
  return (
    <div class={styles.resonanceVisual} aria-hidden="true">
      <i style={{ flex: Math.max(0.02, resonance().chestRatio) }} />
      <i style={{ flex: Math.max(0.02, resonance().maskRatio) }} />
      <i style={{ flex: Math.max(0.02, resonance().headRatio) }} />
    </div>
  )
}

function PitchRows(props: { pitch: VoicePitchTraits | null }): JSX.Element {
  return (
    <Show
      when={props.pitch}
      keyed
      fallback={
        <li class={styles.unavailableRow}>
          Pitch facets need a contour captured with this take.
        </li>
      }
    >
      {(pitch) => (
        <>
          <TraitRow
            label="Vibrato pulse"
            value={vibratoLabel(pitch)}
            detail={
              pitch.vibrato.detected
                ? `${pitch.vibrato.rateHz.toFixed(1)} Hz · ${pitch.vibrato.depthCents} cent span`
                : 'Measured only across continuous held regions'
            }
            visual={
              <div
                class={styles.pulseVisual}
                classList={{ [styles.pulseDetected]: pitch.vibrato.detected }}
                aria-hidden="true"
              >
                <For each={[0, 1, 2, 3, 4, 5]}>{() => <i />}</For>
              </div>
            }
          />
          <TraitRow
            label="Held centre"
            value={
              pitch.heldCenterSpreadCents === null
                ? 'Not enough held tone'
                : heldCenterLabel(pitch.heldCenterSpreadCents)
            }
            detail={
              pitch.heldCenterSpreadCents === null
                ? 'A longer continuous note will reveal local motion'
                : `~${pitch.heldCenterSpreadCents} cent local spread · ${pitch.heldWindowCount} ${pitch.heldWindowCount === 1 ? 'window' : 'windows'}`
            }
          />
        </>
      )}
    </Show>
  )
}

function ToneRows(props: { state: ToneState }): JSX.Element {
  const timbre = (): TimbreReading | null =>
    props.state.status === 'ready' ? props.state.timbre : null
  return (
    <Show
      when={timbre()}
      keyed
      fallback={
        <li class={styles.unavailableRow} aria-live="polite">
          {props.state.status === 'loading'
            ? `Mapping tone traits · ${props.state.progress}%`
            : props.state.status === 'error'
              ? props.state.message
              : props.state.status === 'ready'
                ? 'No voiced spectrum resolved in this recording.'
                : 'Map the local audio to reveal air, bloom, and resonance.'}
        </li>
      }
    >
      {(reading) => (
        <>
          <TraitRow
            label="Air and ring"
            value={airLabel(reading)}
            detail={`${reading.breathiness.hnrDb.toFixed(1)} dB harmonic-to-noise reading`}
            visual={
              <SpectrumVisual
                value={((reading.breathiness.hnrDb + 5) / 40) * 100}
                start="Air"
                end="Ring"
              />
            }
          />
          <TraitRow
            label="Harmonic bloom"
            value={bloomLabel(reading)}
            detail={`${reading.richness.harmonicCount} harmonics resolved · ${reading.richness.richnessScore}/100 density`}
            visual={
              <SpectrumVisual
                value={reading.richness.richnessScore}
                start="Core"
                end="Bloom"
              />
            }
          />
          <TraitRow
            label="Resonance compass"
            value={resonanceLabel(reading)}
            detail={`${reading.resonance.spectralCentroid} Hz spectral centre`}
            visual={<ResonanceVisual timbre={reading} />}
          />
        </>
      )}
    </Show>
  )
}

function TakeTraitColumn(props: {
  selected: SelectedTake
  state: ToneState
}): JSX.Element {
  const pitch = createMemo(() =>
    analyzeVoicePitchTraits(props.selected.contour),
  )
  return (
    <article
      class={styles.takeColumn}
      classList={{
        [styles.earlier]: props.selected.label === 'Earlier',
        [styles.later]: props.selected.label === 'Later',
      }}
    >
      <div class={styles.takeHeading}>
        <span>{props.selected.label}</span>
        <strong>{props.selected.take.title}</strong>
        <small>
          {pitch() === null
            ? 'Waveform archive'
            : `${Math.round(pitch()!.voicedRatio * 100)}% voiced contour`}
        </small>
      </div>
      <ul class={styles.traitList}>
        <PitchRows pitch={pitch()} />
        <ToneRows state={props.state} />
      </ul>
    </article>
  )
}

export function VoiceAtlasTraits(props: VoiceAtlasTraitsProps): JSX.Element {
  const titleId = createUniqueId()
  const [states, setStates] = createSignal<Record<string, ToneState>>({})
  const [mapping, setMapping] = createSignal(false)
  let client: TakeAnalysisClient | null = null
  let generation = 0
  let rejectWorker: ((reason: Error) => void) | null = null
  let selectionKey = ''

  const selectedTakes = createMemo<SelectedTake[]>(() => {
    const selected: SelectedTake[] = []
    if (props.earlier !== null) {
      selected.push({
        label: 'Earlier',
        take: props.earlier,
        contour: props.earlierContour,
      })
    }
    if (props.later !== null) {
      selected.push({
        label: 'Later',
        take: props.later,
        contour: props.laterContour,
      })
    }
    return selected
  })

  const stateFor = (takeId: string): ToneState =>
    states()[takeId] ?? { status: 'idle' }
  const setTakeState = (takeId: string, state: ToneState): void => {
    setStates((current) => ({ ...current, [takeId]: state }))
  }
  const cancelAnalysis = (): void => {
    generation += 1
    client?.destroy()
    client = null
    rejectWorker?.(new Error('Voice trait mapping cancelled.'))
    rejectWorker = null
    setMapping(false)
  }

  createEffect(() => {
    const nextKey = selectedTakes()
      .map((selected) => selected.take.id)
      .join('\n')
    if (selectionKey !== '' && nextKey !== selectionKey && mapping()) {
      cancelAnalysis()
    }
    selectionKey = nextKey
  })
  onCleanup(cancelAnalysis)

  const analyzeDecoded = (
    takeId: string,
    samples: Float32Array,
    sampleRate: number,
    fundamentalHz: number | undefined,
    run: number,
  ): Promise<TimbreReading | null> =>
    new Promise<TimbreReading | null>((resolve, reject) => {
      rejectWorker = reject
      client = new TakeAnalysisClient(
        (result) => {
          client?.destroy()
          client = null
          rejectWorker = null
          if (run === generation) resolve(result.timbre)
        },
        (progress) => {
          if (run === generation) {
            setTakeState(takeId, { status: 'loading', progress })
          }
        },
        (message) => {
          client?.destroy()
          client = null
          rejectWorker = null
          reject(new Error(message))
        },
      )
      client.analyze(samples, sampleRate, fundamentalHz)
    })

  const mapToneTraits = (): void => {
    const selected = selectedTakes()
    if (selected.length === 0 || mapping()) return
    const run = ++generation
    setMapping(true)

    void (async () => {
      for (const item of selected) {
        if (run !== generation) return
        setTakeState(item.take.id, { status: 'loading', progress: 0 })
        try {
          const blob = await getVoiceTakeBlob(item.take.id)
          if (run !== generation) return
          if (blob === null)
            throw new Error('The local recording is unavailable.')
          const decoded = await decodeAudioBlobToMono(blob)
          if (run !== generation) return
          const timbre = await analyzeDecoded(
            item.take.id,
            decoded.samples,
            decoded.sampleRate,
            voiceContourFundamentalHz(item.contour),
            run,
          )
          if (run === generation) {
            setTakeState(item.take.id, { status: 'ready', timbre })
          }
        } catch (error) {
          if (run !== generation) return
          setTakeState(item.take.id, {
            status: 'error',
            message:
              error instanceof Error && error.message.includes('unavailable')
                ? error.message
                : 'This recording could not be mapped here. Try again in this browser.',
          })
        }
      }
      if (run === generation) setMapping(false)
    })()
  }

  const allReady = createMemo(() => {
    const selected = selectedTakes()
    const currentStates = states()
    return (
      selected.length > 0 &&
      selected.every((item) => currentStates[item.take.id]?.status === 'ready')
    )
  })
  const overallProgress = createMemo(() => {
    const selected = selectedTakes()
    const currentStates = states()
    if (selected.length === 0) return 0
    const total = selected.reduce((sum, item) => {
      const state = currentStates[item.take.id] ?? { status: 'idle' }
      if (state.status === 'ready') return sum + 100
      if (state.status === 'loading') return sum + state.progress
      return sum
    }, 0)
    return Math.round(total / selected.length)
  })

  return (
    <section class={styles.traits} aria-labelledby={titleId}>
      <div class={styles.heading}>
        <div>
          <span>Atlas traits</span>
          <h4 id={titleId}>The shape behind the trail.</h4>
          <p>
            Pitch motion appears from the saved contour. Tone facets use one
            private, on-device spectral pass per take.
          </p>
        </div>
        <button
          type="button"
          class={styles.mapButton}
          disabled={mapping() || selectedTakes().length === 0}
          onClick={mapToneTraits}
        >
          <Sparkles />
          <span>
            {mapping()
              ? `Mapping ${overallProgress()}%`
              : allReady()
                ? 'Remap tone traits'
                : 'Map tone traits'}
          </span>
        </button>
      </div>

      <div
        class={styles.takeGrid}
        classList={{ [styles.single]: selectedTakes().length < 2 }}
      >
        <For each={selectedTakes()}>
          {(selected) => (
            <TakeTraitColumn
              selected={selected}
              state={stateFor(selected.take.id)}
            />
          )}
        </For>
      </div>

      <p class={styles.disclaimer}>
        These are listening landmarks, not a quality score. Microphone,
        distance, and room can change tone readings; your saved audio stays
        unchanged and on this device.
      </p>
    </section>
  )
}
