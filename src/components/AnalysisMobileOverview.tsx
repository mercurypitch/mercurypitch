import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import { CheckCircle, Clock, Cpu, Loader2, MusicNote, Voice, WaveformBars, } from '@/components/icons'
import { DesktopHint } from '@/components/mobile/DesktopHint'
import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { loadPitchAnalysisFromDb } from '@/db/services/session-pitch-analysis-service'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import { buildMobileAnalysisSummary } from '@/lib/mobile-analysis-summary'
import { setActiveTab } from '@/stores'
import type { UvrSession } from '@/stores/uvr-store'
import { currentUvrSession, getAllUvrSessionsReactive, setCurrentUvrSession, } from '@/stores/uvr-store'
import styles from './AnalysisMobileOverview.module.css'

interface VoiceprintBar {
  x: number
  y: number
  width: number
}

type AnalysisLoadState = 'empty' | 'loading' | 'ready' | 'error'

interface AnalysisLoadResult {
  data: SessionPitchData | null
  failed: boolean
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

/** Human-readable relative timestamp (e.g. "2 hours ago", "3 days ago"). */
export function relativeTime(epochMs: number): string {
  const deltaMs = Date.now() - epochMs
  if (deltaMs < 0) return 'just now'
  const seconds = Math.floor(deltaMs / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
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

export async function loadMobileAnalysis(
  sessionId: string,
  load: (
    id: string,
  ) => Promise<SessionPitchData | null> = loadPitchAnalysisFromDb,
): Promise<AnalysisLoadResult> {
  try {
    return { data: await load(sessionId), failed: false }
  } catch {
    return { data: null, failed: true }
  }
}

export const AnalysisMobileOverview: Component = () => {
  const [analysisData, setAnalysisData] = createSignal<SessionPitchData | null>(
    null,
  )
  const [loadState, setLoadState] = createSignal<AnalysisLoadState>('empty')
  const [showGallery, setShowGallery] = createSignal(false)
  let loadVersion = 0

  const loadAnalysis = (sessionId: string | null): void => {
    const version = ++loadVersion
    setAnalysisData(null)

    if (sessionId === null) {
      setLoadState('empty')
      return
    }

    setLoadState('loading')
    void loadMobileAnalysis(sessionId).then((result) => {
      if (version !== loadVersion) return
      setAnalysisData(result.data)
      setLoadState(result.failed ? 'error' : 'ready')
    })
  }

  createEffect(() => loadAnalysis(currentUvrSession()?.sessionId ?? null))
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

  /** Completed UVR sessions available for selection, newest first. */
  const completedSessions = createMemo(() =>
    getAllUvrSessionsReactive()
      .filter((s) => s.status === 'completed')
      .sort((a, b) => b.createdAt - a.createdAt),
  )

  const openKaraoke = (): void => {
    setActiveTab(TAB_KARAOKE)
  }

  const selectSession = (session: UvrSession): void => {
    setCurrentUvrSession(session)
    setShowGallery(false)
  }

  const changeSong = (): void => {
    setShowGallery(true)
  }

  /** Render the session gallery (list of completed UVR sessions). */
  const SessionGallery = () => (
    <section class={styles.gallerySection} data-testid="session-gallery">
      <div class={styles.galleryHeader}>
        <div>
          <p class={styles.eyebrow}>Your songs</p>
          <h2>Choose a session</h2>
        </div>
        <Show when={currentUvrSession()}>
          <button
            type="button"
            class={styles.secondaryAction}
            onClick={() => setShowGallery(false)}
          >
            Cancel
          </button>
        </Show>
      </div>

      <Show
        when={completedSessions().length > 0}
        fallback={
          <div class={styles.galleryEmpty}>
            <div class={styles.emptyGlyph}>
              <WaveformBars size={30} />
            </div>
            <p class={styles.galleryEmptyTitle}>No sessions yet</p>
            <p>
              Process a song in Karaoke first. Once stem separation is complete,
              the session will appear here.
            </p>
            <button
              type="button"
              class={styles.primaryAction}
              onClick={openKaraoke}
            >
              Go to Karaoke
            </button>
          </div>
        }
      >
        <ul class={styles.galleryList}>
          <For each={completedSessions()}>
            {(session) => (
              <li>
                <button
                  type="button"
                  class={styles.galleryItem}
                  classList={{
                    [styles.galleryItemActive]:
                      session.sessionId === currentUvrSession()?.sessionId,
                  }}
                  onClick={() => selectSession(session)}
                  data-testid={`session-pick-${session.sessionId}`}
                >
                  <div class={styles.galleryItemIcon}>
                    <MusicNote />
                  </div>
                  <div class={styles.galleryItemInfo}>
                    <span class={styles.galleryItemName}>
                      {session.originalFile?.name ?? 'Untitled'}
                    </span>
                    <span class={styles.galleryItemMeta}>
                      {session.processingMode === 'server'
                        ? 'Server'
                        : 'On-device'}
                      {' \u00B7 '}
                      {relativeTime(session.createdAt)}
                    </span>
                  </div>
                  <span
                    class={styles.status}
                    classList={{
                      [styles.statusReady]: session.status === 'completed',
                    }}
                  >
                    {statusLabel(session.status)}
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )

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
        when={currentUvrSession() && !showGallery()}
        fallback={<SessionGallery />}
      >
        {(_session) => {
          const session = () => currentUvrSession()!
          return (
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
                    when={loadState() !== 'error'}
                    fallback={
                      <div class={styles.analysisEmpty}>
                        <p class={styles.analysisEmptyTitle}>
                          Pitch map unavailable
                        </p>
                        <p>
                          MercuryPitch could not read this session's saved
                          analysis. Try loading it again.
                        </p>
                        <button
                          type="button"
                          class={styles.secondaryAction}
                          onClick={() =>
                            loadAnalysis(currentUvrSession()?.sessionId ?? null)
                          }
                        >
                          Try again
                        </button>
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
                            In Karaoke, open this song's pitch tools and run
                            Analyze vocal. The compact result will be available
                            here next time you visit.
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
                              <span>
                                {facts().rangeSemitones} semitone span
                              </span>
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
                </Show>
              </section>

              <div class={styles.sessionActions}>
                <button
                  type="button"
                  class={styles.sessionLink}
                  onClick={openKaraoke}
                >
                  <span>
                    <Clock />
                    Open full session
                  </span>
                  <span aria-hidden="true">&rsaquo;</span>
                </button>

                <button
                  type="button"
                  class={styles.sessionLink}
                  onClick={changeSong}
                  data-testid="change-song-btn"
                >
                  <span>
                    <MusicNote />
                    Change song
                  </span>
                  <span aria-hidden="true">&rsaquo;</span>
                </button>
              </div>
            </>
          )
        }}
      </Show>

      <DesktopHint message="Live mic diagnostics, detector tuning, benchmark tools and multi-pane analysis are available on desktop." />
    </main>
  )
}
