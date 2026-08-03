// ============================================================
// Analysis dashboard — one responsive page for every take
//
// Replaces VocalAnalysis.tsx (3,102 lines) and AnalysisMobileOverview.tsx.
// There is no viewport fork and no subtab bar: phones and desktops render the
// same tree. Depth is progressive, not conditional — the dense sections are
// present at every width, folded by default on a phone.
//
// What a take shows is bounded by its capability tier, never padded out with
// numbers its data cannot support.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, onCleanup, Show, } from 'solid-js'
import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { getStreakState } from '@/db/services/streak-service'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { buildMobileAnalysisSummary } from '@/lib/mobile-analysis-summary'
import type { TakeAnalysisResult } from '@/lib/take-analysis-client'
import { TakeAnalysisClient } from '@/lib/take-analysis-client'
import { getSessionHistory } from '@/stores'
import styles from './AnalysisDashboard.module.css'
import { CollapsibleCard } from './CollapsibleCard'
import { LiveCapture } from './LiveCapture'
import { buildPracticeMetrics } from './metrics'
import { NotesOverview, PracticeOverview, TimbreCard, TrendsCard, TuningCard, } from './sections'
import { TakePicker } from './TakePicker'
import type { AnalysisTake } from './takes'
import { listTakes, LIVE_TAKE_ID } from './takes'
import { TakeSpectrogram } from './TakeSpectrogram'
import { TakeTrace } from './TakeTrace'
import { useLiveCapture } from './use-live-capture'

type AudioState =
  | { status: 'idle' }
  | { status: 'loading'; pct: number }
  | { status: 'ready'; result: TakeAnalysisResult }
  | { status: 'error'; message: string }

export const AnalysisDashboard: Component = () => {
  const takes = createMemo(() => listTakes())
  const [selectedId, setSelectedId] = createSignal<string>(LIVE_TAKE_ID)
  const capture = useLiveCapture()

  // listTakes() rebuilds every take object on each run, and it re-runs
  // whenever the UVR store ticks (including separation progress) or a session
  // is saved. Comparing by id keeps the selected take referentially stable
  // across that churn, so the resource below doesn't refetch from IndexedDB on
  // every progress update.
  const selected = createMemo<AnalysisTake | null>(
    () => takes().find((t) => t.id === selectedId()) ?? null,
    null,
    { equals: (a, b) => a?.id === b?.id },
  )

  // Selecting a different take must not leave the mic running.
  createEffect(() => {
    if (selectedId() !== LIVE_TAKE_ID && capture.isActive()) capture.stop()
  })

  const [streak] = createResource(getStreakState)

  /**
   * Cached note analysis for the selected take. The take itself is the
   * resource source, so the fetcher reads no signals.
   *
   * Read via `.latest`, never `notes()`. This tab is lazy-loaded inside a
   * <Suspense>, and calling a loading resource inside that boundary
   * re-suspends the WHOLE tab: picking a different take unmounted the
   * dashboard root, flashed the tab skeleton, and rebuilt the page —
   * which is the "flicks and reloads" the owner saw. `.latest` keeps the
   * previous value on screen while the next one loads, so only the parts
   * that depend on it change.
   */
  const [notes] = createResource<SessionPitchData | null, AnalysisTake>(
    selected,
    async (take) => {
      if (take.loadNotes === undefined) return null
      try {
        return await take.loadNotes()
      } catch {
        return null
      }
    },
  )

  const detectedNotes = createMemo(() => {
    const data = notes.latest
    if (data === null || data === undefined) return []
    return data.segmentedNotes.length > 0
      ? data.segmentedNotes
      : data.mergedNotes
  })

  const noteSummary = createMemo(() => {
    const data = notes.latest
    return data === null || data === undefined
      ? null
      : buildMobileAnalysisSummary(data)
  })

  const practiceMetrics = createMemo(() => {
    const take = selected()
    if (take?.summary === undefined) return null
    return buildPracticeMetrics(take.summary)
  })

  const practiceNotes = createMemo(() => {
    const take = selected()
    if (take?.summary === undefined) return []
    return take.summary.practiceItemResult.flatMap((item) => item.noteResult)
  })

  // ── Offline audio analysis ──────────────────────────────────
  // Decoding a stem and running a full STFT over it is expensive, so it is
  // opt-in per take rather than automatic on selection.

  const [audio, setAudio] = createSignal<AudioState>({ status: 'idle' })
  let client: TakeAnalysisClient | null = null

  const disposeClient = () => {
    client?.destroy()
    client = null
  }
  onCleanup(disposeClient)

  // A new selection invalidates any analysis in flight or on screen.
  createEffect(() => {
    selectedId()
    disposeClient()
    setAudio({ status: 'idle' })
  })

  /** Median of the detected notes — a better f0 than a spectral guess. */
  const fundamentalHz = (): number | undefined => {
    const all = detectedNotes()
    if (all.length === 0) return undefined
    const midis = all.map((n) => n.midi).sort((a, b) => a - b)
    return midiToFrequency(midis[Math.floor(midis.length / 2)])
  }

  const analyzeAudio = () => {
    const take = selected()
    if (take?.loadAudio === undefined) return

    setAudio({ status: 'loading', pct: 0 })
    disposeClient()

    void (async () => {
      const decoded = await take.loadAudio!()
      if (decoded === null) {
        setAudio({
          status: 'error',
          message: "Couldn't read this take's audio.",
        })
        return
      }
      // The take may have changed while decoding.
      if (selected()?.id !== take.id) return

      client = new TakeAnalysisClient(
        (result) => setAudio({ status: 'ready', result }),
        (pct) => setAudio({ status: 'loading', pct }),
        (message) => setAudio({ status: 'error', message }),
      )
      client.analyze(decoded.samples, decoded.sampleRate, fundamentalHz())
    })()
  }

  const canAnalyzeAudio = () =>
    selected()?.capability === 'audio' && selected()?.source !== 'live'

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <h1 class={styles.title}>Analysis</h1>
        <p class={styles.subtitle}>
          Pick a take to see what your voice actually did.
        </p>
      </header>

      <TakePicker
        takes={takes()}
        selectedId={selectedId()}
        onSelect={(take) => setSelectedId(take.id)}
      />

      <Show when={selected()?.source === 'live'}>
        <LiveCapture capture={capture} />
      </Show>

      <Show when={practiceMetrics()}>
        {(metrics) => (
          <>
            <PracticeOverview metrics={metrics()} />
            <CollapsibleCard
              title="Pitch"
              note="note sequence, coloured by accuracy"
              storageKey="analysis_open_trace"
              tour="analysis.trace"
            >
              <TakeTrace results={practiceNotes()} />
            </CollapsibleCard>
            <TuningCard metrics={metrics()} />
          </>
        )}
      </Show>

      <Show when={noteSummary()}>
        {(summary) => (
          <>
            <NotesOverview summary={summary()} />
            <CollapsibleCard
              title="Pitch"
              note="detected notes over the take"
              storageKey="analysis_open_trace"
              tour="analysis.trace"
            >
              <TakeTrace notes={detectedNotes()} />
            </CollapsibleCard>
          </>
        )}
      </Show>

      {/* Spectrogram + timbre for a take that carries real audio. */}
      <Show when={canAnalyzeAudio()}>
        <CollapsibleCard
          title="Spectrum"
          note="from the separated vocal"
          storageKey="analysis_open_spectrum"
          tour="analysis.spectrum"
        >
          <Show
            when={audio().status === 'ready'}
            fallback={
              <div>
                <p class={styles.unavailable}>
                  {audio().status === 'error'
                    ? (audio() as { message: string }).message
                    : audio().status === 'loading'
                      ? `Analysing the vocal… ${(audio() as { pct: number }).pct}%`
                      : 'Read the whole vocal to get a spectrogram and timbre for this take. It runs in the background and takes a few seconds.'}
                </p>
                <Show when={audio().status !== 'loading'}>
                  <div class={styles.actions}>
                    <button
                      type="button"
                      data-testid="analyse-audio"
                      class={styles.primaryBtn}
                      onClick={analyzeAudio}
                    >
                      Analyse audio
                    </button>
                  </div>
                </Show>
              </div>
            }
          >
            <TakeSpectrogram
              analysis={(audio() as { result: TakeAnalysisResult }).result}
            />
          </Show>
        </CollapsibleCard>
      </Show>

      <Show
        when={
          audio().status === 'ready' &&
          (audio() as { result: TakeAnalysisResult }).result.timbre
        }
      >
        {(timbre) => (
          <TimbreCard
            breathiness={timbre().breathiness}
            richness={timbre().richness}
            resonance={timbre().resonance}
            note={`measured across the take at ~${timbre().fundamentalHz} Hz`}
          />
        )}
      </Show>

      {/* A separated song with no cached pitch pass yet — say why, don't
          render empty cards or invent numbers. */}
      <Show
        when={
          selected()?.source === 'uvr' &&
          !notes.loading &&
          noteSummary() === null
        }
      >
        <section class={styles.card}>
          <h3 class={styles.cardTitle}>Not analysed yet</h3>
          <p class={styles.unavailable}>
            This song hasn't been through a pitch pass, so there are no notes to
            plot. Open it in Karaoke and run the pitch analysis — the results
            show up here afterwards. The spectrum above works either way.
          </p>
        </section>
      </Show>

      {/* Always present: progress is about practice overall, not the selected
          take, and with no history it honestly reads zero rather than faking
          numbers. It also gives the page a stable anchor for the tour. */}
      <TrendsCard sessions={getSessionHistory()} streak={streak() ?? null} />
    </div>
  )
}
