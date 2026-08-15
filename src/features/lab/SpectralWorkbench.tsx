// ============================================================
// Spectral workbench — the Sonic Visualiser-derived tooling
//
// Ported out of VocalAnalysis.tsx, where these controls sat on the
// user-facing page permanently disabled: every one of them requires
// accumulated spectra, and spectra only accumulate while the mic is live.
// Here the mic control sits next to them, so the gate is reachable.
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { AnnotationControls } from '@/components/AnnotationControls'
import { ExportFile, ImportFile, WaveformBars } from '@/components/icons'
import type { PitchTracePoint } from '@/components/MultiPaneView'
import { MultiPaneView } from '@/components/MultiPaneView'
import { IconRecord, IconStop } from '@/components/shared/control-bar/icons'
import { TransformRunner } from '@/components/TransformRunner'
import { UnitConverter } from '@/components/UnitConverter'
import { useEngines } from '@/contexts/EngineContext'
import { useLiveCapture } from '@/features/analysis/use-live-capture'
import { AlignClient, OnsetClient } from '@/lib/analysis-clients'
import { computeNNLSChroma, detectChords, simplifyChordSequence, } from '@/lib/chord-detector'
import { frequencyToMidi } from '@/lib/frequency-to-note'
import { detectKeyFromSpectra } from '@/lib/key-detector'
import { segmentAudio } from '@/lib/segmenter'
import { getTransforms, registerBuiltinTransforms, } from '@/lib/transform-registry'
import { annotations, createTimeInstant, setAnnotations, } from '@/stores/annotation-store'
import { paneLayout, setPaneLayout } from '@/stores/pane-layout-store'
import type { AlignmentResult, ChordFrame, KeyResult, OnsetResult, SegmentationResult, } from '@/types'
import styles from './SpectralWorkbench.module.css'

/** STFT hop used by the spectral worker — the tools must match it. */
const HOP_SIZE = 2048
const MIN_FRAMES = 10
const MIN_SEGMENT_FRAMES = 20

type AnalysisTask =
  | 'Beat detection'
  | 'Key detection'
  | 'Chord detection'
  | 'Segmentation'
  | 'Self-alignment'

export const SpectralWorkbench: Component = () => {
  const engines = useEngines()
  const capture = useLiveCapture()

  const [onsets, setOnsets] = createSignal<OnsetResult[]>([])
  const [bpm, setBpm] = createSignal<number | null>(null)
  const [key, setKey] = createSignal<KeyResult | null>(null)
  const [alignment, setAlignment] = createSignal<AlignmentResult | null>(null)
  const [chords, setChords] = createSignal<ChordFrame[]>([])
  const [segments, setSegments] = createSignal<SegmentationResult | null>(null)
  const [busyTask, setBusyTask] = createSignal<AnalysisTask | null>(null)
  const [analysisMessage, setAnalysisMessage] = createSignal<string | null>(
    null,
  )
  const [workspaceMessage, setWorkspaceMessage] = createSignal<string | null>(
    null,
  )
  const [selectedAnnotation, setSelectedAnnotation] = createSignal<
    string | null
  >(null)
  const [transformCount, setTransformCount] = createSignal(0)

  let onsetClient: OnsetClient | null = null
  let alignClient: AlignClient | null = null
  let workspaceFileInput!: HTMLInputElement

  const sampleRate = () => engines?.audioEngine.getSampleRate() ?? 44100
  const spectra = () => capture.spectraHistory()
  const enoughFrames = () => spectra().length >= MIN_FRAMES
  const isBusy = () => busyTask() !== null

  const captureStatus = createMemo(() => {
    const frameCount = spectra().length
    if (capture.isActive()) {
      return frameCount >= MIN_FRAMES
        ? `Listening · ${frameCount} frames ready`
        : `Building buffer · ${frameCount} of ${MIN_FRAMES} frames`
    }
    if (frameCount >= MIN_FRAMES) return `Capture ready · ${frameCount} frames`
    if (frameCount > 0)
      return `Buffer incomplete · ${frameCount} of ${MIN_FRAMES} frames`
    return 'Microphone idle'
  })

  const beginAnalysis = (task: AnalysisTask) => {
    setBusyTask(task)
    setAnalysisMessage(`${task} running…`)
  }

  const finishAnalysis = (task: AnalysisTask) => {
    setBusyTask(null)
    setAnalysisMessage(`${task} complete.`)
  }

  const failAnalysis = (task: AnalysisTask) => {
    setBusyTask(null)
    setAnalysisMessage(
      `${task} could not finish. Capture a little more audio and try again.`,
    )
  }

  const pitchHistory = createMemo<PitchTracePoint[]>(() =>
    capture.samples().map((s) => ({
      time: s.timestamp,
      midi: s.frequency > 0 ? frequencyToMidi(s.frequency, false) : 0,
      clarity: s.clarity * 100,
    })),
  )

  const duration = createMemo(() => {
    const samples = capture.samples()
    return samples.length > 0 ? samples[samples.length - 1].timestamp + 2 : 60
  })

  /** Every tile in the results grid is behind its own <Show>, so the grid
   *  itself has to be gated too — otherwise it contributes its bottom margin
   *  as dead space before anything has been measured. */
  const hasResults = createMemo(
    () =>
      bpm() !== null ||
      key() !== null ||
      chords().length > 0 ||
      segments() !== null ||
      alignment() !== null,
  )

  // Space drops a time marker while the mic is live.
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== ' ' && e.code !== 'Space') return
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (!capture.isActive()) return
    e.preventDefault()
    createTimeInstant(capture.elapsed(), undefined)
  }

  onMount(() => {
    registerBuiltinTransforms()
    setTransformCount(getTransforms().length)
    window.addEventListener('keydown', handleKeyDown)
  })

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown)
    onsetClient?.destroy()
    alignClient?.destroy()
  })

  const detectBeats = () => {
    if (!enoughFrames()) return
    const task: AnalysisTask = 'Beat detection'
    beginAnalysis(task)
    onsetClient?.destroy()
    onsetClient = new OnsetClient(
      (result) => {
        setOnsets(result.onsets)
        setBpm(result.bpm)
        finishAnalysis(task)
      },
      () => failAnalysis(task),
    )
    onsetClient.detect(spectra(), sampleRate(), HOP_SIZE)
  }

  const detectKey = () => {
    if (!enoughFrames()) return
    const task: AnalysisTask = 'Key detection'
    const currentSpectra = spectra()
    const rate = sampleRate()
    beginAnalysis(task)
    setTimeout(() => {
      try {
        setKey(detectKeyFromSpectra(currentSpectra, rate, HOP_SIZE))
        finishAnalysis(task)
      } catch {
        failAnalysis(task)
      }
    }, 0)
  }

  const detectChordsNow = () => {
    if (!enoughFrames()) return
    const task: AnalysisTask = 'Chord detection'
    const currentSpectra = spectra()
    const rate = sampleRate()
    beginAnalysis(task)
    setTimeout(() => {
      try {
        const chroma = currentSpectra.map((s) =>
          computeNNLSChroma(s, rate, HOP_SIZE),
        )
        setChords(
          simplifyChordSequence(
            detectChords(chroma, HOP_SIZE / rate, {
              medianWindow: 3,
              minDuration: 0.25,
            }),
          ),
        )
        finishAnalysis(task)
      } catch {
        failAnalysis(task)
      }
    }, 0)
  }

  const segment = () => {
    if (spectra().length < MIN_SEGMENT_FRAMES) return
    const task: AnalysisTask = 'Segmentation'
    const currentSpectra = spectra()
    const rate = sampleRate()
    beginAnalysis(task)
    setTimeout(() => {
      try {
        setSegments(
          segmentAudio(currentSpectra, rate, HOP_SIZE, {
            minSegmentDuration: 4,
            maxSegments: 12,
          }),
        )
        finishAnalysis(task)
      } catch {
        failAnalysis(task)
      }
    }, 0)
  }

  /** Self-alignment demo: aligns the capture's chroma against a truncated
   *  copy of itself. There is no reference-track picker yet, so this
   *  exercises the DTW path rather than measuring anything real. */
  const alignToSelf = () => {
    if (!enoughFrames()) return
    const task: AnalysisTask = 'Self-alignment'
    const currentSpectra = spectra()
    const rate = sampleRate()
    beginAnalysis(task)
    setTimeout(() => {
      try {
        const chroma = currentSpectra.map((s) => {
          const bins = new Float32Array(12)
          for (let i = 0; i < s.length; i++) {
            const freq = (i / s.length) * (rate / 2)
            if (freq <= 65) continue
            const pc = Math.round(frequencyToMidi(freq, false)) % 12
            bins[pc < 0 ? pc + 12 : pc] += s[i]
          }
          const total = bins.reduce((a, b) => a + b, 0)
          if (total > 0) for (let j = 0; j < 12; j++) bins[j] /= total
          return bins
        })

        if (chroma.length < 5) {
          failAnalysis(task)
          return
        }

        alignClient?.destroy()
        alignClient = new AlignClient(
          (result) => {
            setAlignment(result)
            finishAnalysis(task)
          },
          () => failAnalysis(task),
        )
        alignClient.align(
          chroma,
          chroma.slice(0, Math.floor(chroma.length * 0.9)),
        )
      } catch {
        failAnalysis(task)
      }
    }, 0)
  }

  const exportWorkspace = () => {
    // Signal reads stay synchronous; the lazy module load must not capture a
    // later, internally inconsistent workspace after the user keeps working.
    const workspace = {
      version: '1.0.0' as const,
      exportedAt: Date.now(),
      annotations: annotations(),
      paneLayout: paneLayout(),
      analysisResults: {
        onsets: onsets(),
        key: key() ?? undefined,
        chords: chords(),
        segments: segments()?.segments,
        detectedBpm: bpm() ?? undefined,
      },
    }
    void (async () => {
      setWorkspaceMessage('Preparing workspace export…')
      try {
        const { exportWorkspace: save } = await import('@/lib/session-io')
        save(workspace)
        setWorkspaceMessage('Workspace exported.')
      } catch {
        setWorkspaceMessage('Workspace export failed. Try again.')
      }
    })()
  }

  const importWorkspace = (file: File) => {
    void (async () => {
      setWorkspaceMessage(`Importing ${file.name}…`)
      try {
        const { importWorkspace: load } = await import('@/lib/session-io')
        const ws = await load(file)
        if (ws === null) {
          setWorkspaceMessage('That file is not a valid Lab workspace.')
          return
        }
        if (ws.annotations.length > 0) setAnnotations(ws.annotations)
        setPaneLayout(ws.paneLayout)
        if (ws.analysisResults?.detectedBpm !== undefined) {
          setBpm(ws.analysisResults.detectedBpm)
        }
        setWorkspaceMessage(`${file.name} imported.`)
      } catch {
        setWorkspaceMessage(
          'Workspace import failed. Check the file and try again.',
        )
      }
    })()
  }

  return (
    <div class={styles.workbench}>
      <section class={styles.captureBar} aria-labelledby="capture-heading">
        <div class={styles.captureCluster}>
          <div class={styles.captureCopy}>
            <span class={styles.stageLabel}>Capture</span>
            <h2 id="capture-heading" class={styles.stageTitle}>
              Live spectral source
            </h2>
            <span id="capture-status" class={styles.captureStatus}>
              <Show when={capture.isActive()}>
                <span class={styles.liveDot} aria-hidden="true" />
              </Show>
              {captureStatus()}
            </span>
          </div>

          <Show
            when={capture.isActive()}
            fallback={
              <button
                type="button"
                class={`${styles.toolBtn} ${styles.captureBtn}`}
                aria-describedby="capture-status"
                onClick={() => void capture.start()}
              >
                <IconRecord />
                Start capture
              </button>
            }
          >
            <button
              type="button"
              class={`${styles.toolBtn} ${styles.captureActive}`}
              aria-describedby="capture-status"
              onClick={() => capture.stop()}
            >
              <IconStop />
              Stop capture
            </button>
          </Show>
        </div>

        <details class={styles.workspaceDisclosure}>
          <summary class={styles.workspaceSummary}>Workspace</summary>
          <div class={styles.workspaceActions}>
            <button
              type="button"
              class={styles.toolBtn}
              onClick={exportWorkspace}
            >
              <ExportFile />
              Export JSON
            </button>
            <button
              type="button"
              class={styles.toolBtn}
              onClick={() => workspaceFileInput.click()}
            >
              <ImportFile />
              Import JSON
            </button>
            <input
              ref={workspaceFileInput!}
              class={styles.visuallyHiddenFile}
              type="file"
              accept=".json,application/json"
              aria-label="Import Lab workspace JSON"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file !== undefined) importWorkspace(file)
              }}
            />
          </div>
        </details>
      </section>

      <Show when={capture.error()}>
        <p class={styles.errorMessage} role="alert">
          {capture.error()}
        </p>
      </Show>

      <Show when={workspaceMessage()}>
        <p class={styles.systemMessage} role="status" aria-live="polite">
          {workspaceMessage()}
        </p>
      </Show>

      <Show when={!enoughFrames()}>
        <div class={styles.capturePrimer}>
          <span class={styles.primerGlyph} aria-hidden="true">
            <WaveformBars />
          </span>
          <div class={styles.primerCopy}>
            <strong>Build a short spectral buffer</strong>
            <span>
              Start capture and sustain sound for a few seconds. Press{' '}
              <kbd class={styles.key}>Space</kbd> while listening to drop a time
              marker.
            </span>
          </div>
          <div class={styles.bufferReadout}>
            <span
              class={styles.bufferTrack}
              role="progressbar"
              aria-label="Spectral buffer"
              aria-valuemin={0}
              aria-valuemax={MIN_FRAMES}
              aria-valuenow={Math.min(spectra().length, MIN_FRAMES)}
            >
              <span
                class={styles.bufferFill}
                style={{
                  width: `${Math.min(100, (spectra().length / MIN_FRAMES) * 100)}%`,
                }}
              />
            </span>
            <span class={styles.bufferValue}>
              {Math.min(spectra().length, MIN_FRAMES)}/{MIN_FRAMES} frames
            </span>
          </div>
        </div>
      </Show>

      <Show when={enoughFrames()}>
        <section
          class={styles.analysisSection}
          aria-labelledby="analysis-heading"
          aria-busy={isBusy()}
        >
          <div class={styles.sectionHeading}>
            <div>
              <span class={styles.stageLabel}>Analyze</span>
              <h2 id="analysis-heading" class={styles.stageTitle}>
                Measure this capture
              </h2>
            </div>
            <span class={styles.frameReadout}>
              {spectra().length} frames · {transformCount()} transforms
            </span>
          </div>

          <div class={styles.analysisActions}>
            <button
              type="button"
              class={styles.analysisBtn}
              onClick={detectBeats}
              disabled={isBusy()}
            >
              Detect beats
            </button>
            <button
              type="button"
              class={styles.analysisBtn}
              onClick={detectKey}
              disabled={isBusy()}
            >
              Detect key
            </button>
            <button
              type="button"
              class={styles.analysisBtn}
              onClick={detectChordsNow}
              disabled={isBusy()}
            >
              Detect chords
            </button>

            <details class={styles.advancedDisclosure}>
              <summary>Advanced analysis</summary>
              <div class={styles.advancedActions}>
                <button
                  type="button"
                  class={styles.analysisBtn}
                  onClick={segment}
                  disabled={isBusy() || spectra().length < MIN_SEGMENT_FRAMES}
                  title={
                    spectra().length < MIN_SEGMENT_FRAMES
                      ? `Capture at least ${MIN_SEGMENT_FRAMES} frames to segment`
                      : undefined
                  }
                >
                  Segment structure
                </button>
                <button
                  type="button"
                  class={styles.analysisBtn}
                  onClick={alignToSelf}
                  disabled={isBusy()}
                  title="Self-alignment demonstration; reference-track alignment is not available yet"
                >
                  Self-align demo
                </button>
              </div>
            </details>
          </div>

          <Show when={analysisMessage()}>
            <p class={styles.analysisStatus} role="status" aria-live="polite">
              {analysisMessage()}
            </p>
          </Show>
        </section>
      </Show>

      <Show when={hasResults()}>
        <section class={styles.measurements} aria-labelledby="results-heading">
          <div class={styles.sectionHeading}>
            <div>
              <span class={styles.stageLabel}>Measured</span>
              <h2 id="results-heading" class={styles.stageTitle}>
                Capture summary
              </h2>
            </div>
          </div>
          <div class={styles.results} role="list">
            <Show when={bpm() !== null}>
              <div class={styles.resultCard} role="listitem">
                <span class={styles.resultLabel}>Tempo</span>
                <span class={styles.resultValue}>
                  {bpm()?.toFixed(1)}
                  <span class={styles.resultUnit}>BPM</span>
                </span>
                <span class={styles.resultDetail}>
                  {onsets().length} onsets
                </span>
              </div>
            </Show>
            <Show when={key()}>
              <div class={styles.resultCard} role="listitem">
                <span class={styles.resultLabel}>Key</span>
                <span class={styles.resultValue}>{key()!.key}</span>
                <span class={styles.resultDetail}>
                  {Math.round(key()!.confidence * 100)}% confident
                </span>
              </div>
            </Show>
            <Show when={chords().length > 0}>
              <div class={styles.resultCard} role="listitem">
                <span class={styles.resultLabel}>Chords</span>
                <span class={styles.resultValue}>{chords().length}</span>
                <span class={styles.resultDetail}>simplified sequence</span>
              </div>
            </Show>
            <Show when={segments()}>
              <div class={styles.resultCard} role="listitem">
                <span class={styles.resultLabel}>Segments</span>
                <span class={styles.resultValue}>
                  {segments()!.segments.length}
                </span>
                <span class={styles.resultDetail}>structural boundaries</span>
              </div>
            </Show>
            <Show when={alignment()}>
              <div class={styles.resultCard} role="listitem">
                <span class={styles.resultLabel}>Alignment</span>
                <span class={styles.resultValue}>
                  {Math.round(alignment()!.similarityScore * 100)}
                  <span class={styles.resultUnit}>%</span>
                </span>
                <span class={styles.resultDetail}>
                  {alignment()!.tempoRatio.toFixed(2)}× tempo
                </span>
              </div>
            </Show>
          </div>
        </section>
      </Show>

      <section class={styles.inspectSection} aria-labelledby="inspect-heading">
        <div class={styles.sectionHeading}>
          <div>
            <span class={styles.stageLabel}>Inspect</span>
            <h2 id="inspect-heading" class={styles.stageTitle}>
              Synchronized panes
            </h2>
          </div>
          <p class={styles.sectionHint}>
            Add views, resize them, and compare every reading on one time axis.
          </p>
        </div>

        <div class={styles.paneWrap}>
          <MultiPaneView
            audioDuration={duration()}
            playheadPosition={capture.elapsed()}
            isPlaying={capture.isActive()}
            magnitudeSpectrum={capture.spectrum()}
            pitchHistory={pitchHistory()}
            centsOffset={capture.centsOffset()}
            targetNote={capture.currentNote()}
            vibratoRate={capture.snapshot()?.vibrato.rateHz ?? null}
            vibratoDepth={capture.snapshot()?.vibrato.depthCents ?? null}
            sampleRate={sampleRate()}
            annotationCount={annotations().length}
          />
        </div>

        <Show when={annotations().length > 0}>
          <AnnotationControls
            annotations={annotations()}
            selectedId={selectedAnnotation()}
            onSelect={setSelectedAnnotation}
            onDeselectAll={() => setSelectedAnnotation(null)}
          />
        </Show>
      </section>

      <section
        class={styles.referenceSection}
        aria-labelledby="reference-heading"
      >
        <div class={styles.sectionHeading}>
          <div>
            <span class={styles.stageLabel}>Reference</span>
            <h2 id="reference-heading" class={styles.stageTitle}>
              Optional utilities
            </h2>
          </div>
          <p class={styles.sectionHint}>
            Open these only when the capture calls for a conversion or plug-in.
          </p>
        </div>

        <div class={styles.referenceTools}>
          <details class={styles.utilityDisclosure}>
            <summary>
              <span>Frequency and note converter</span>
              <small>Hz, MIDI and note names</small>
            </summary>
            <div class={styles.utilityBody}>
              <UnitConverter />
            </div>
          </details>
          <details class={styles.utilityDisclosure}>
            <summary>
              <span>Transform plug-ins</span>
              <small>{transformCount()} registered transforms</small>
            </summary>
            <div class={styles.utilityBody}>
              <TransformRunner />
            </div>
          </details>
        </div>
      </section>
    </div>
  )
}
