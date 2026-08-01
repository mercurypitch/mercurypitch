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
import type { PitchTracePoint } from '@/components/MultiPaneView'
import { MultiPaneView } from '@/components/MultiPaneView'
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
import styles from './Lab.module.css'

/** STFT hop used by the spectral worker — the tools must match it. */
const HOP_SIZE = 2048
const MIN_FRAMES = 10
const MIN_SEGMENT_FRAMES = 20

export const SpectralWorkbench: Component = () => {
  const engines = useEngines()
  const capture = useLiveCapture()

  const [onsets, setOnsets] = createSignal<OnsetResult[]>([])
  const [bpm, setBpm] = createSignal<number | null>(null)
  const [key, setKey] = createSignal<KeyResult | null>(null)
  const [alignment, setAlignment] = createSignal<AlignmentResult | null>(null)
  const [chords, setChords] = createSignal<ChordFrame[]>([])
  const [segments, setSegments] = createSignal<SegmentationResult | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [selectedAnnotation, setSelectedAnnotation] = createSignal<
    string | null
  >(null)
  const [transformCount, setTransformCount] = createSignal(0)

  let onsetClient: OnsetClient | null = null
  let alignClient: AlignClient | null = null

  const sampleRate = () => engines?.audioEngine.getSampleRate() ?? 44100
  const spectra = () => capture.spectraHistory()
  const enoughFrames = () => spectra().length >= MIN_FRAMES

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
    setBusy(true)
    onsetClient?.destroy()
    onsetClient = new OnsetClient(
      (result) => {
        setOnsets(result.onsets)
        setBpm(result.bpm)
        setBusy(false)
      },
      () => setBusy(false),
    )
    onsetClient.detect(spectra(), sampleRate(), HOP_SIZE)
  }

  const detectKey = () => {
    if (!enoughFrames()) return
    setBusy(true)
    setTimeout(() => {
      try {
        setKey(detectKeyFromSpectra(spectra(), sampleRate(), HOP_SIZE))
      } catch {
        /* leave the previous result in place */
      }
      setBusy(false)
    }, 0)
  }

  const detectChordsNow = () => {
    if (!enoughFrames()) return
    setBusy(true)
    setTimeout(() => {
      try {
        const chroma = spectra().map((s) =>
          computeNNLSChroma(s, sampleRate(), HOP_SIZE),
        )
        setChords(
          simplifyChordSequence(
            detectChords(chroma, HOP_SIZE / sampleRate(), {
              medianWindow: 3,
              minDuration: 0.25,
            }),
          ),
        )
      } catch {
        /* leave the previous result in place */
      }
      setBusy(false)
    }, 0)
  }

  const segment = () => {
    if (spectra().length < MIN_SEGMENT_FRAMES) return
    setBusy(true)
    setTimeout(() => {
      try {
        setSegments(
          segmentAudio(spectra(), sampleRate(), HOP_SIZE, {
            minSegmentDuration: 4,
            maxSegments: 12,
          }),
        )
      } catch {
        /* leave the previous result in place */
      }
      setBusy(false)
    }, 0)
  }

  /** Self-alignment demo: aligns the capture's chroma against a truncated
   *  copy of itself. There is no reference-track picker yet, so this
   *  exercises the DTW path rather than measuring anything real. */
  const alignToSelf = () => {
    if (!enoughFrames()) return
    setBusy(true)
    setTimeout(() => {
      try {
        const rate = sampleRate()
        const chroma = spectra().map((s) => {
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
          setBusy(false)
          return
        }

        alignClient?.destroy()
        alignClient = new AlignClient(
          (result) => {
            setAlignment(result)
            setBusy(false)
          },
          () => setBusy(false),
        )
        alignClient.align(
          chroma,
          chroma.slice(0, Math.floor(chroma.length * 0.9)),
        )
      } catch {
        setBusy(false)
      }
    }, 0)
  }

  const exportWorkspace = () => {
    void (async () => {
      const { exportWorkspace: save } = await import('@/lib/session-io')
      save({
        version: '1.0.0',
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
      })
    })()
  }

  const importWorkspace = (file: File) => {
    void (async () => {
      const { importWorkspace: load } = await import('@/lib/session-io')
      const ws = await load(file)
      if (ws === null) return
      if (ws.annotations.length > 0) setAnnotations(ws.annotations)
      setPaneLayout(ws.paneLayout)
      if (ws.analysisResults?.detectedBpm !== undefined) {
        setBpm(ws.analysisResults.detectedBpm)
      }
    })()
  }

  return (
    <div>
      <div class={styles.toolbar}>
        <Show
          when={capture.isActive()}
          fallback={
            <button
              type="button"
              class={styles.toolBtn}
              onClick={() => void capture.start()}
            >
              ● Start capture
            </button>
          }
        >
          <button
            type="button"
            class={styles.toolBtn}
            onClick={() => capture.stop()}
          >
            ■ Stop capture
          </button>
        </Show>

        <button
          type="button"
          class={styles.toolBtn}
          onClick={detectBeats}
          disabled={busy() || !enoughFrames()}
        >
          Detect beats
        </button>
        <button
          type="button"
          class={styles.toolBtn}
          onClick={detectKey}
          disabled={busy() || !enoughFrames()}
        >
          Detect key
        </button>
        <button
          type="button"
          class={styles.toolBtn}
          onClick={detectChordsNow}
          disabled={busy() || !enoughFrames()}
        >
          Detect chords
        </button>
        <button
          type="button"
          class={styles.toolBtn}
          onClick={segment}
          disabled={busy() || spectra().length < MIN_SEGMENT_FRAMES}
        >
          Segment
        </button>
        <button
          type="button"
          class={styles.toolBtn}
          onClick={alignToSelf}
          disabled={busy() || !enoughFrames()}
          title="Self-alignment demo — no reference track picker yet"
        >
          Align (demo)
        </button>

        <button type="button" class={styles.toolBtn} onClick={exportWorkspace}>
          Export
        </button>
        <label class={styles.toolBtn}>
          Import
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0]
              if (file !== undefined) importWorkspace(file)
            }}
          />
        </label>

        <span class={styles.frameCount}>
          {spectra().length} frames · {transformCount()} transforms
        </span>
      </div>

      <Show when={!enoughFrames()}>
        <p class={styles.hint}>
          The analysis tools run on accumulated spectra. Start capture and sing
          for a few seconds to fill the buffer. Press Space while capturing to
          drop a time marker.
        </p>
      </Show>

      <div class={styles.results}>
        <Show when={bpm() !== null}>
          <div class={styles.resultCard}>
            <span class={styles.resultLabel}>Tempo</span>
            <span class={styles.resultValue}>{bpm()?.toFixed(1)} BPM</span>
            <span class={styles.resultLabel}>{onsets().length} onsets</span>
          </div>
        </Show>
        <Show when={key()}>
          <div class={styles.resultCard}>
            <span class={styles.resultLabel}>Key</span>
            <span class={styles.resultValue}>{key()!.key}</span>
            <span class={styles.resultLabel}>
              {Math.round(key()!.confidence * 100)}% confident
            </span>
          </div>
        </Show>
        <Show when={chords().length > 0}>
          <div class={styles.resultCard}>
            <span class={styles.resultLabel}>Chords</span>
            <span class={styles.resultValue}>{chords().length}</span>
          </div>
        </Show>
        <Show when={segments()}>
          <div class={styles.resultCard}>
            <span class={styles.resultLabel}>Segments</span>
            <span class={styles.resultValue}>
              {segments()!.segments.length}
            </span>
          </div>
        </Show>
        <Show when={alignment()}>
          <div class={styles.resultCard}>
            <span class={styles.resultLabel}>Alignment</span>
            <span class={styles.resultValue}>
              {Math.round(alignment()!.similarityScore * 100)}%
            </span>
            <span class={styles.resultLabel}>
              {alignment()!.tempoRatio.toFixed(2)}× tempo
            </span>
          </div>
        </Show>
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

      <UnitConverter />
      <TransformRunner />
    </div>
  )
}
