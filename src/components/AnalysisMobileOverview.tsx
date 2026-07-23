import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import { CheckCircle, Clock, Cpu, Loader2, MusicNote, Voice, WaveformBars, } from '@/components/icons'
import { DesktopHint } from '@/components/mobile/DesktopHint'
import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { loadPitchAnalysisFromDb } from '@/db/services/session-pitch-analysis-service'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import { buildMobileAnalysisSummary } from '@/lib/mobile-analysis-summary'
import { setActiveTab } from '@/stores'
import { currentUvrSession } from '@/stores/uvr-store'
import styles from './AnalysisMobileOverview.module.css'

type AnalysisLoadState = 'empty' | 'loading' | 'ready'

interface VoiceprintBar {
  x: number
  y: number
  width: number
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`
}

function statusLabel(status: string): string {
  if (status === 'completed') return 'Ready'
  if (status === 'finalizing') return 'Saving'
  if (status === 'processing' || status === 'uploading') return 'Processing'
  if (status === 'interrupted') return 'Needs attention'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function buildVoiceprint(data: SessionPitchData | null): VoiceprintBar[] {
  if (!data) return []
  const notes =
    data.segmentedNotes.length > 0 ? data.segmentedNotes : data.mergedNotes
  if (notes.length === 0) return []

  let start = Infinity
  let end = -Infinity
  let low = Infinity
  let high = -Infinity
  for (const note of notes) {
    start = Math.min(start, note.startSec)
    end = Math.max(end, note.endSec)
    low = Math.min(low, note.midi)
    high = Math.max(high, note.midi)
  }

  const timeSpan = Math.max(0.001, end - start)
  const pitchSpan = Math.max(1, high - low)
  const step = Math.max(1, Math.ceil(notes.length / 140))
  const bars: VoiceprintBar[] = []
  for (let index = 0; index < notes.length; index += step) {
    const note = notes[index]
    bars.push({
      x: ((note.startSec - start) / timeSpan) * 100,
      y: 37 - ((note.midi - low) / pitchSpan) * 32,
      width: Math.max(0.55, ((note.endSec - note.startSec) / timeSpan) * 100),
    })
  }
  return bars
}

export const AnalysisMobileOverview: Component = () => {
  const [analysisData, setAnalysisData] = createSignal<SessionPitchData | null>(
    null,
  )
  const [loadState, setLoadState] = createSignal<AnalysisLoadState>('empty')
  let loadVersion = 0

  createEffect(() => {
    const sessionId = currentUvrSession()?.sessionId ?? null
    const version = ++loadVersion
    setAnalysisData(null)

    if (sessionId === null) {
      setLoadState('empty')
      return
    }

    setLoadState('loading')
    void loadPitchAnalysisFromDb(sessionId).then((data) => {
      if (version !== loadVersion) return
      setAnalysisData(data)
      setLoadState('ready')
    })
  })

  onCleanup(() => {
    loadVersion++
  })

  const summary = createMemo(() => {
    const data = analysisData()
    return data ? buildMobileAnalysisSummary(data) : null
  })
  const voiceprint = createMemo(() => buildVoiceprint(analysisData()))
  const stemCount = createMemo(() => {
    const outputs = currentUvrSession()?.outputs
    return (
      Number(Boolean(outputs?.vocal)) + Number(Boolean(outputs?.instrumental))
    )
  })
  const duration = createMemo(() => {
    const meta = currentUvrSession()?.stemMeta
    if (!meta) return 0
    let longest = 0
    for (const item of Object.values(meta)) {
      longest = Math.max(longest, item.duration ?? 0)
    }
    return longest
  })

  const openKaraoke = (): void => {
    setActiveTab(TAB_KARAOKE)
  }

  return (
    <main class={styles.page} data-testid="analysis-mobile-overview">
      <div class={styles.header}>
        <div class={styles.headerMark}>
          <Voice />
        </div>
        <div>
          <p class={styles.eyebrow}>Voice lab</p>
          <h1>Analysis</h1>
          <p class={styles.subtitle}>
            A clear read on the song currently loaded in Karaoke.
          </p>
        </div>
      </div>

      <Show
        when={currentUvrSession()}
        fallback={
          <section class={styles.emptyHero}>
            <div class={styles.emptyGlyph}>
              <WaveformBars size={30} />
            </div>
            <p class={styles.eyebrow}>No song loaded</p>
            <h2>Bring a separated track into focus</h2>
            <p>
              Open a completed Karaoke session first. Its stems and saved pitch
              pass will appear here automatically.
            </p>
            <button
              type="button"
              class={styles.primaryAction}
              onClick={openKaraoke}
            >
              Choose a Karaoke session
            </button>
          </section>
        }
      >
        {(session) => (
          <>
            <section
              class={styles.sessionCard}
              aria-labelledby="mobile-session-title"
            >
              <div class={styles.cardTopline}>
                <span>Loaded UVR session</span>
                <span
                  class={styles.status}
                  classList={{
                    [styles.statusReady]: session().status === 'completed',
                  }}
                >
                  {statusLabel(session().status)}
                </span>
              </div>

              <div class={styles.sessionIdentity}>
                <div class={styles.albumMark}>
                  <MusicNote />
                </div>
                <div>
                  <h2 id="mobile-session-title">
                    {session().originalFile?.name ?? 'Untitled session'}
                  </h2>
                  <p>
                    {session().processingMode === 'server'
                      ? 'Server separation'
                      : 'On-device separation'}
                  </p>
                </div>
              </div>

              <dl class={styles.sessionFacts}>
                <div>
                  <dt>Stems</dt>
                  <dd>{stemCount()} available</dd>
                </div>
                <div>
                  <dt>Length</dt>
                  <dd>
                    {duration() > 0
                      ? formatSeconds(duration())
                      : 'Not reported'}
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{formatBytes(session().originalFile?.size ?? 0)}</dd>
                </div>
              </dl>
            </section>

            <section
              class={styles.analysisCard}
              aria-labelledby="mobile-algorithm-title"
            >
              <div class={styles.analysisHeading}>
                <div>
                  <p class={styles.eyebrow}>Saved detector pass</p>
                  <h2 id="mobile-algorithm-title">Pitch algorithm</h2>
                </div>
                <span class={styles.analysisIcon}>
                  <Cpu />
                </span>
              </div>

              <Show
                when={loadState() !== 'loading'}
                fallback={
                  <div class={styles.loading}>
                    <Loader2 />
                    <span>Reading the session pitch map…</span>
                  </div>
                }
              >
                <Show
                  when={summary()}
                  fallback={
                    <div class={styles.analysisEmpty}>
                      <p class={styles.analysisEmptyTitle}>
                        No cached pitch map yet
                      </p>
                      <p>
                        In Karaoke, open this song’s pitch tools and run Analyze
                        vocal. The compact result will be available here next
                        time you visit.
                      </p>
                      <button
                        type="button"
                        class={styles.secondaryAction}
                        onClick={openKaraoke}
                      >
                        Open pitch tools
                      </button>
                    </div>
                  }
                >
                  {(facts) => (
                    <>
                      <div class={styles.voiceprint}>
                        <div class={styles.voiceprintLabel}>
                          <span>Detected melody</span>
                          <span>{facts().coveragePercent}% voiced</span>
                        </div>
                        <svg
                          viewBox="0 0 100 42"
                          preserveAspectRatio="none"
                          role="img"
                          aria-label={`Detected pitch map from ${facts().lowNote} to ${facts().highNote}`}
                        >
                          <defs>
                            <linearGradient
                              id="mobile-voiceprint-gradient"
                              x1="0"
                              x2="1"
                            >
                              <stop offset="0" stop-color="#69e3c2" />
                              <stop offset=".52" stop-color="#8f82ff" />
                              <stop offset="1" stop-color="#ec77c5" />
                            </linearGradient>
                          </defs>
                          <For each={voiceprint()}>
                            {(bar) => (
                              <rect
                                x={bar.x}
                                y={bar.y}
                                width={bar.width}
                                height="3.2"
                                rx="1.6"
                                fill="url(#mobile-voiceprint-gradient)"
                              />
                            )}
                          </For>
                        </svg>
                        <div class={styles.rangeLabels}>
                          <span>{facts().lowNote}</span>
                          <span>{facts().rangeSemitones} semitone span</span>
                          <span>{facts().highNote}</span>
                        </div>
                      </div>

                      <dl class={styles.metrics}>
                        <div>
                          <dt>Clean notes</dt>
                          <dd>{facts().cleanedNoteCount}</dd>
                        </div>
                        <div>
                          <dt>Voiced time</dt>
                          <dd>{formatSeconds(facts().voicedSeconds)}</dd>
                        </div>
                        <div>
                          <dt>Detected key</dt>
                          <dd>{facts().keyLabel}</dd>
                        </div>
                        <div>
                          <dt>Key regions</dt>
                          <dd>{facts().keyRegionCount}</dd>
                        </div>
                      </dl>

                      <div class={styles.passSummary}>
                        <CheckCircle />
                        <div>
                          <strong>Cleanup pass complete</strong>
                          <p>
                            {facts().rawNoteCount} raw fragments became{' '}
                            {facts().cleanedNoteCount} stable notes
                            {facts().manualEditCount > 0
                              ? `, with ${facts().manualEditCount} saved manual edits.`
                              : '.'}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </Show>
              </Show>
            </section>

            <button
              type="button"
              class={styles.sessionLink}
              onClick={openKaraoke}
            >
              <span>
                <Clock />
                Open full session
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </>
        )}
      </Show>

      <DesktopHint message="Live mic diagnostics, detector tuning, benchmark tools and multi-pane analysis are available on desktop." />
    </main>
  )
}
