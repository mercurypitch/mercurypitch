// ============================================================
// Analysis takes — one object across every analysable source
//
// The Analysis page used to read three data sources that never met: practice
// history in localStorage (desktop only), cached UVR pitch analysis in
// IndexedDB (phone only), and the live mic. A "take" is the single thing the
// dashboard renders, whichever of those it came from.
//
// Every take declares a *capability*, which is what the source can honestly
// support. Sections whose tier isn't met are not rendered — the page never
// shows a number the underlying data cannot justify.
// ============================================================

import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { loadPitchAnalysisFromDb } from '@/db/services/session-pitch-analysis-service'
import { getSessionHistory } from '@/stores'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import type { SessionResult } from '@/types'

export type TakeSource = 'live' | 'uvr' | 'practice'

/**
 * What a take's data can support.
 *
 * - `audio`   real waveform — every metric, including spectral timbre & vibrato
 * - `notes`   timed detected notes — range, key, coverage, phrasing, pitch trace
 * - `summary` per-note practice scores — accuracy, cents bias, range, trends
 */
export type TakeCapability = 'audio' | 'notes' | 'summary'

/** Ordered weakest → strongest, so tiers can be compared numerically. */
const CAPABILITY_RANK: Record<TakeCapability, number> = {
  summary: 0,
  notes: 1,
  audio: 2,
}

/** Decoded mono audio for the `audio` tier. */
export interface TakeAudio {
  samples: Float32Array
  sampleRate: number
}

export interface AnalysisTake {
  id: string
  source: TakeSource
  capability: TakeCapability
  title: string
  /** Short context line — processing mode, score, note count. */
  subtitle: string
  createdAt: number
  durationSec?: number
  /** Cached detected-note analysis. Present for `notes` and `audio` takes. */
  loadNotes?: () => Promise<SessionPitchData | null>
  /** Decoded mono audio. Present for `audio` takes only. */
  loadAudio?: () => Promise<TakeAudio | null>
  /** Practice record. Present for `summary` takes only. */
  summary?: SessionResult
}

/** True when `take` can support everything `required` needs. */
export function supports(
  take: AnalysisTake | null,
  required: TakeCapability,
): boolean {
  if (take === null) return false
  return CAPABILITY_RANK[take.capability] >= CAPABILITY_RANK[required]
}

/** The synthetic take representing "sing into the mic right now". */
export const LIVE_TAKE_ID = 'live'

function liveTake(): AnalysisTake {
  return {
    id: LIVE_TAKE_ID,
    source: 'live',
    capability: 'audio',
    title: 'Sing now',
    subtitle: 'Live microphone',
    createdAt: Number.MAX_SAFE_INTEGER, // always sorts first
  }
}

/** Fetch and decode a stem URL down to mono samples. */
async function decodeStem(url: string): Promise<TakeAudio | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const arrayBuffer = await resp.arrayBuffer()
    const ctx = new OfflineAudioContext(1, 2, 44100)
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

    const left = audioBuffer.getChannelData(0)
    if (audioBuffer.numberOfChannels === 1) {
      return { samples: left, sampleRate: audioBuffer.sampleRate }
    }
    const right = audioBuffer.getChannelData(1)
    const mono = new Float32Array(left.length)
    for (let i = 0; i < mono.length; i++) mono[i] = (left[i] + right[i]) / 2
    return { samples: mono, sampleRate: audioBuffer.sampleRate }
  } catch {
    return null
  }
}

function uvrSubtitle(session: UvrSession): string {
  const mode = session.processingMode === 'server' ? 'Server' : 'On-device'
  const seconds = session.stemMeta?.vocal?.duration
  if (seconds !== undefined && seconds > 0) {
    return `${mode} · ${Math.round(seconds)}s`
  }
  return mode
}

function uvrTake(session: UvrSession): AnalysisTake {
  const vocalUrl = session.outputs?.vocal
  const hasAudio = vocalUrl !== undefined && vocalUrl !== ''

  return {
    id: `uvr:${session.sessionId}`,
    source: 'uvr',
    capability: hasAudio ? 'audio' : 'notes',
    title: session.originalFile?.name ?? 'Separated song',
    subtitle: uvrSubtitle(session),
    createdAt: session.createdAt,
    durationSec: session.stemMeta?.vocal?.duration,
    loadNotes: () => loadPitchAnalysisFromDb(session.sessionId),
    loadAudio: hasAudio ? () => decodeStem(vocalUrl) : undefined,
  }
}

function practiceTake(session: SessionResult, index: number): AnalysisTake {
  const noteCount = session.practiceItemResult.reduce(
    (sum, item) => sum + item.noteResult.length,
    0,
  )
  return {
    id: `practice:${session.sessionId ?? `${session.completedAt}-${index}`}`,
    source: 'practice',
    capability: 'summary',
    title: session.name || session.sessionName || 'Practice session',
    subtitle: `${session.score ?? 0}% · ${noteCount} notes`,
    createdAt: session.completedAt,
    summary: session,
  }
}

/**
 * Every analysable take, newest first, with the live take pinned to the front.
 *
 * Reactive: reads `getAllUvrSessionsReactive()` and `getSessionHistory()`, so
 * calling this inside a memo re-runs when either changes. Audio and note
 * loaders stay lazy — listing takes must never pull a stem off disk.
 */
export function listTakes(): AnalysisTake[] {
  const uvr = getAllUvrSessionsReactive()
    .filter((s) => s.status === 'completed')
    .map(uvrTake)

  const practice = getSessionHistory().map(practiceTake)

  return [
    liveTake(),
    ...[...uvr, ...practice].sort((a, b) => b.createdAt - a.createdAt),
  ]
}
