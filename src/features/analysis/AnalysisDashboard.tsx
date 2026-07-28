// ============================================================
// Analysis dashboard — one responsive page for every take
//
// Replaces VocalAnalysis.tsx (3,102 lines) and AnalysisMobileOverview.tsx.
// There is no viewport fork and no subtab bar: phones and desktops render
// the same tree, and the audio-research tooling moved to the Lab.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, Show, } from 'solid-js'
import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { getStreakState } from '@/db/services/streak-service'
import { buildMobileAnalysisSummary } from '@/lib/mobile-analysis-summary'
import { getSessionHistory } from '@/stores'
import styles from './AnalysisDashboard.module.css'
import { LiveCapture } from './LiveCapture'
import { buildPracticeMetrics } from './metrics'
import { NotesOverview, PracticeOverview, TrendsCard, TuningCard, } from './sections'
import { TakePicker } from './TakePicker'
import type { AnalysisTake } from './takes'
import { listTakes, LIVE_TAKE_ID } from './takes'
import { useLiveCapture } from './use-live-capture'

export const AnalysisDashboard: Component = () => {
  const takes = createMemo(() => listTakes())
  const [selectedId, setSelectedId] = createSignal<string>(LIVE_TAKE_ID)
  const capture = useLiveCapture()

  const selected = createMemo<AnalysisTake | null>(
    () => takes().find((t) => t.id === selectedId()) ?? null,
  )

  // Selecting a different take must not leave the mic running.
  createEffect(() => {
    if (selectedId() !== LIVE_TAKE_ID && capture.isActive()) capture.stop()
  })

  const [streak] = createResource(getStreakState)

  // Cached note analysis for the selected take — refetches on selection.
  // The take itself is the resource source, so the fetcher reads no signals.
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

  const noteSummary = createMemo(() => {
    const data = notes()
    return data === null || data === undefined
      ? null
      : buildMobileAnalysisSummary(data)
  })

  const practiceMetrics = createMemo(() => {
    const take = selected()
    if (take?.summary === undefined) return null
    return buildPracticeMetrics(take.summary)
  })

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
            <TuningCard metrics={metrics()} />
          </>
        )}
      </Show>

      <Show when={noteSummary()}>
        {(summary) => <NotesOverview summary={summary()} />}
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
            This song hasn't been through a pitch pass. Open it in Karaoke and
            run the pitch analysis — the results show up here afterwards.
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
