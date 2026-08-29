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
import { InfoPopover } from '@/components/InfoPopover'
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
  explanation: TraitExplanation
  visual?: JSX.Element
}

interface TraitExplanation {
  meaning: string
  calculation: string
  limits: string
}

const HELD_TONE_PULSE_EXPLANATION: TraitExplanation = {
  meaning:
    'A repeating rise and fall of pitch inside the clearest held part of this take. Resolving a pulse is descriptive; it is not a better-or-worse result.',
  calculation:
    'We keep confident, continuous pitch regions held for at least half a second, then look for a repeating 3–10 Hz pattern with more than 10 cents of span. The strongest reliable region is shown.',
  limits:
    'Short notes, slides, consonants, accompaniment, and background noise can prevent a pulse from resolving.',
}

const LOCAL_PITCH_SPREAD_EXPLANATION: TraitExplanation = {
  meaning:
    'How tightly detected pitch gathered around its local centre during held notes. A smaller number means less movement in those moments, not automatically better singing.',
  calculation:
    'We measure pitch variation in overlapping half-second windows with at least five confident frames and no large note change. The median window spread is reported in cents; 100 cents equals one semitone.',
  limits:
    'Intentional vibrato and expressive movement can increase this number. It should only be compared in similar material and recording conditions.',
}

const HARMONIC_CONTRAST_EXPLANATION: TraitExplanation = {
  meaning:
    'The contrast between energy near harmonic multiples and the remaining recorded spectrum. Higher means harmonics dominate this recording more strongly; it is not a breath-support or health rating.',
  calculation:
    'From an average of the stronger recorded frames, we anchor the spectrum to the detected fundamental, add the power near its first 15 harmonics, and compare that with the remaining power. The ratio is shown in decibels.',
  limits:
    'Vowels, melody, microphone, distance, room, and background sound all change this estimate, so compare only like-for-like recordings.',
}

const HARMONIC_PEAKS_EXPLANATION: TraitExplanation = {
  meaning:
    'How many harmonic multiples were clearly visible in this recording snapshot. More peaks are not inherently better; different pitches and vowels naturally produce different patterns.',
  calculation:
    'We inspect up to the first 15 multiples of the detected fundamental in the average spectrum. A peak counts when it is stronger than 5% of the first harmonic.',
  limits:
    'The count depends on pitch, vowel, microphone bandwidth, distance, room, and noise. It is a recording landmark, not a tone-quality score.',
}

const SPECTRAL_CENTRE_EXPLANATION: TraitExplanation = {
  meaning:
    'The frequency balance point of the recorded sound. A higher or lower centre describes where this take carried more spectral energy; it does not identify register or resonance placement.',
  calculation:
    'Each frequency is weighted by its power in the average stronger-frame spectrum. The percentages are shares of total recorded spectral power around 200–800 Hz, 800–2500 Hz, and above 2500 Hz; the muted remainder is energy outside those bands.',
  limits:
    'Pitch, vowel, microphone, distance, room, and recording level can all move the balance point. Use it as a same-setup comparison clue only.',
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
}

function TraitRow(props: TraitRowProps): JSX.Element {
  return (
    <li class={styles.traitRow}>
      <div class={styles.traitCopy}>
        <div class={styles.traitLabel}>
          <span>{props.label}</span>
          <InfoPopover
            label={`About ${props.label}`}
            class={styles.traitInfo}
            panelClass={styles.traitInfoPanel}
          >
            <dl class={styles.traitExplanation}>
              <div>
                <dt>What it means</dt>
                <dd>{props.explanation.meaning}</dd>
              </div>
              <div>
                <dt>How it is estimated</dt>
                <dd>{props.explanation.calculation}</dd>
              </div>
              <div>
                <dt>Keep in mind</dt>
                <dd>{props.explanation.limits}</dd>
              </div>
            </dl>
          </InfoPopover>
        </div>
        <strong>{props.value}</strong>
        <small>{props.detail}</small>
      </div>
      <Show when={props.visual}>{props.visual}</Show>
    </li>
  )
}

function vibratoLabel(pitch: VoicePitchTraits): string {
  return pitch.vibrato.detected ? 'Pulse resolved' : 'No pulse resolved'
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

function BandBalanceVisual(props: { timbre: TimbreReading }): JSX.Element {
  const resonance = (): TimbreReading['resonance'] => props.timbre.resonance
  const remaining = (): number =>
    Math.max(
      0,
      1 -
        resonance().chestRatio -
        resonance().maskRatio -
        resonance().headRatio,
    )
  return (
    <div class={styles.resonanceVisual} aria-hidden="true">
      <i style={{ flex: `${resonance().chestRatio} 1 0` }} />
      <i style={{ flex: `${resonance().maskRatio} 1 0` }} />
      <i style={{ flex: `${resonance().headRatio} 1 0` }} />
      <i style={{ flex: `${remaining()} 1 0` }} />
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
            label="Held-tone pulse"
            value={vibratoLabel(pitch)}
            explanation={HELD_TONE_PULSE_EXPLANATION}
            detail={
              pitch.vibrato.detected
                ? `Strongest qualifying held region · ${pitch.vibrato.rateHz.toFixed(1)} Hz · ~${pitch.vibrato.depthCents} cent span`
                : 'No qualifying held region produced a reliable periodic pulse'
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
            label="Local pitch spread"
            explanation={LOCAL_PITCH_SPREAD_EXPLANATION}
            value={
              pitch.heldCenterSpreadCents === null
                ? 'Not resolved'
                : `~${pitch.heldCenterSpreadCents} cents`
            }
            detail={
              pitch.heldCenterSpreadCents === null
                ? 'A longer continuous note is needed for a local spread estimate'
                : `Typical spread across ${pitch.heldWindowCount} qualifying ${pitch.heldWindowCount === 1 ? 'window' : 'windows'}`
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
            ? `Mapping recording spectrum · ${props.state.progress}%`
            : props.state.status === 'error'
              ? props.state.message
              : props.state.status === 'ready'
                ? 'No voiced spectrum resolved in this recording.'
                : 'Map the local audio to reveal an experimental spectrum snapshot.'}
        </li>
      }
    >
      {(reading) => (
        <>
          <TraitRow
            label="Harmonic contrast estimate"
            value={`${reading.breathiness.hnrDb.toFixed(1)} dB`}
            explanation={HARMONIC_CONTRAST_EXPLANATION}
            detail="Whole-recording estimate; melody, microphone, distance, and room affect it"
            visual={
              <SpectrumVisual
                value={((reading.breathiness.hnrDb + 5) / 40) * 100}
                start="Lower"
                end="Higher"
              />
            }
          />
          <TraitRow
            label="Resolved harmonic peaks"
            explanation={HARMONIC_PEAKS_EXPLANATION}
            value={
              reading.richness.harmonicProfile.length === 0
                ? 'Not resolved'
                : `${reading.richness.harmonicCount} peaks`
            }
            detail={
              reading.richness.harmonicProfile.length === 0
                ? 'This pass did not resolve a usable harmonic peak set'
                : 'Whole-recording spectrum snapshot; not a tone-quality score'
            }
          />
          <TraitRow
            label="Spectral centre"
            value={`${reading.resonance.spectralCentroid} Hz`}
            explanation={SPECTRAL_CENTRE_EXPLANATION}
            detail={`${Math.round(reading.resonance.chestRatio * 100)}% low · ${Math.round(reading.resonance.maskRatio * 100)}% mid · ${Math.round(reading.resonance.headRatio * 100)}% high recorded energy`}
            visual={<BandBalanceVisual timbre={reading} />}
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
      data-testid={`voice-atlas-traits-${props.selected.label.toLowerCase()}`}
    >
      <div class={styles.takeHeading}>
        <span>{props.selected.label}</span>
        <strong>{props.selected.take.title}</strong>
        <div class={styles.takeCoverage}>
          <small>
            {pitch() === null
              ? 'Waveform archive'
              : `Trait-ready pitch · ${Math.round(pitch()!.resolvedPitchRatio * 100)}% of saved frames`}
          </small>
          <Show when={pitch() !== null}>
            <InfoPopover
              label={`About ${props.selected.label.toLowerCase()} take pitch coverage`}
              class={styles.coverageInfo}
              panelClass={styles.traitInfoPanel}
            >
              <dl class={styles.traitExplanation}>
                <div>
                  <dt>What it means</dt>
                  <dd>
                    The share of all saved moments with pitch clear enough for
                    the Atlas traits. This is coverage, not pitch accuracy.
                  </dd>
                </div>
                <div>
                  <dt>How it is calculated</dt>
                  <dd>
                    We count saved contour frames that contain pitch and clear
                    the trait confidence floor, then divide by every saved frame
                    in the take.
                  </dd>
                </div>
                <div>
                  <dt>Keep in mind</dt>
                  <dd>
                    Silence, consonants, noise, and ambiguous sound remain in
                    the denominator. The listening map may draw some
                    lower-confidence pitch that these traits do not use.
                  </dd>
                </div>
              </dl>
            </InfoPopover>
          </Show>
        </div>
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
            Pitch motion appears from the saved contour. Optional spectrum rows
            report raw, recording-dependent estimates from one private,
            on-device pass per take.
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
                ? 'Remap spectrum snapshot'
                : 'Map spectrum snapshot'}
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
        These are listening landmarks, not a quality score. Spectrum rows
        describe this recording, not breath support, resonance placement,
        technique, or vocal health. Your saved audio stays unchanged and on this
        device.
      </p>
    </section>
  )
}
