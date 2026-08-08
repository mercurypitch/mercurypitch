// ============================================================
// Mercury Sing engine — listen, match, decide, hand off
// ============================================================
//
// The headless controller behind the stage: owns its own AudioEngine +
// LivePitchBuffer (exactly like ShazamListen), runs the melody matcher over
// the live contour on a timer, feeds fused scores to the auto-open policy,
// and on an open decision launches Karaoke Night through the shared launch
// contract — seeked to where the singer already is. The stage component is
// a thin skin over the signals exposed here; nothing in this file renders.
//
// Also the librarian: on start it loads persisted stem fingerprints and
// quietly fingerprints any completed separation that has none yet, so the
// first Mercury Sing session teaches the library while the user sings.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { getStemBlobUrl, saveStemFingerprintData, } from '@/db/services/uvr-service'
import { acquireWakeWordHold } from '@/features/voice-control/voice-command-registry'
import { AudioEngine } from '@/lib/audio-engine'
import { audioRegistry } from '@/lib/audio-registry'
import { karaokeNightSessionUrl } from '@/lib/karaoke-night-link'
import { LivePitchBuffer } from '@/lib/shazam/live-pitch-buffer'
import { addStemFingerprint, hasStemFingerprint, loadStemFingerprints, } from '@/lib/shazam/melody-fingerprints'
import { matchPitchContour } from '@/lib/shazam/melody-matcher'
import { detectOnsets, segmentNotes } from '@/lib/shazam/onset-detector'
import { extractStemFingerprint } from '@/lib/shazam/stem-fingerprinter'
import type { LivePitchContour, MatchCandidate } from '@/lib/shazam/types'
import { showNotification } from '@/stores/notifications-store'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessionsReactive, initSessionStore } from '@/stores/uvr-store'
import type { AutoOpenSnapshot } from './auto-open-policy'
import { createAutoOpenPolicy } from './auto-open-policy'
import { closeMercurySing } from './mercury-sing-store'

/** How often the live contour is re-matched against the library. */
const MATCH_INTERVAL_MS = 1500
/** Matching needs this much captured signal before it says anything. */
const MIN_FRAMES_FOR_MATCH = 90
const MIN_ONSETS_FOR_MATCH = 3
/**
 * The backing starts this far BEHIND the singer's estimated position:
 * slightly early is forgiving (you re-enter on the phrase you just sang),
 * overshooting drops you mid-line. Tuned on device once M3 field data
 * exists; one constant on purpose.
 */
const PRE_ROLL_SEC = 2.0
/** Pitch-trail ring shown by the stage (throttled to every 3rd frame). */
const TRAIL_LENGTH = 96
const TRAIL_FRAME_STRIDE = 3

export type MercurySingStatus =
  | 'starting'
  | 'listening'
  | 'mic-denied'
  | 'no-library'
  | 'launching'

export interface MercurySingCandidateView {
  sessionId: string
  name: string
  /** Matcher confidence, 0-100 (display scale). */
  confidence: number
  matchOffsetSec: number | null
  breakdown: { pitch: number; interval: number; chroma: number; rhythm: number }
}

export interface MercurySingEngine {
  status: Accessor<MercurySingStatus>
  candidates: Accessor<MercurySingCandidateView[]>
  armed: Accessor<AutoOpenSnapshot>
  /** Wall seconds since listening began. */
  elapsedSec: Accessor<number>
  /** Recent pitch trail as MIDI numbers; NaN marks unvoiced frames. */
  trail: Accessor<readonly number[]>
  /** Songs currently matchable (grows as background fingerprinting runs). */
  libraryCount: Accessor<number>
  /** Background fingerprinting progress; total 0 = nothing to do. */
  fingerprinting: Accessor<{ done: number; total: number }>
  /** Launch candidate at `index` (0-based). False when nothing is there. */
  pick: (index: number) => boolean
  /** Cancel and release everything. Safe to call twice. */
  dispose: () => void
}

const toMidi = (frequency: number): number =>
  12 * Math.log2(frequency / 440) + 69

/** One engine per stage opening — created on mount, disposed on cleanup. */
export function createMercurySingEngine(): MercurySingEngine {
  const [status, setStatus] = createSignal<MercurySingStatus>('starting')
  const [candidates, setCandidates] = createSignal<MercurySingCandidateView[]>(
    [],
  )
  const [armed, setArmed] = createSignal<AutoOpenSnapshot>({
    kind: 'listening',
    leaderId: null,
    armedFraction: 0,
  })
  const [elapsedSec, setElapsedSec] = createSignal(0)
  const [trail, setTrail] = createSignal<readonly number[]>([])
  const [libraryCount, setLibraryCount] = createSignal(0)
  const [fingerprinting, setFingerprinting] = createSignal({
    done: 0,
    total: 0,
  })

  const policy = createAutoOpenPolicy()
  const releaseWakeHold = acquireWakeWordHold()

  let audioEngine: AudioEngine | null = null
  let buffer: LivePitchBuffer | null = null
  let matchTimer: ReturnType<typeof setInterval> | null = null
  let disposed = false
  let launching = false
  /** Duration of the last matched contour — the singer's "now" anchor. */
  let lastContourDurationSec = 0

  const trailRing: number[] = []
  let frameCounter = 0

  const dispose = () => {
    if (disposed) return
    disposed = true
    if (matchTimer !== null) {
      clearInterval(matchTimer)
      matchTimer = null
    }
    if (buffer !== null) {
      buffer.cancel()
      buffer = null
    }
    if (audioEngine !== null) {
      audioRegistry.unregister(audioEngine)
      audioEngine.destroy()
      audioEngine = null
    }
    releaseWakeHold()
  }

  const launch = (candidate: MercurySingCandidateView) => {
    if (disposed || launching) return
    launching = true
    setStatus('launching')
    const startAtSec = Math.max(
      0,
      (candidate.matchOffsetSec ?? 0) + lastContourDurationSec - PRE_ROLL_SEC,
    )
    const minutes = Math.floor(startAtSec / 60)
    const seconds = Math.floor(startAtSec % 60)
    console.log(
      '[mercury-sing] launching',
      candidate.sessionId,
      'at',
      startAtSec.toFixed(1),
    )
    showNotification(
      `Mercury Sing: "${candidate.name}" — joining you at ${String(minutes)}:${String(seconds).padStart(2, '0')}`,
      'success',
    )
    // Release the mic BEFORE navigating: Karaoke Night wants it for scoring.
    dispose()
    window.location.assign(
      karaokeNightSessionUrl(candidate.sessionId, {
        startAtSec,
        autoplay: true,
      }),
    )
  }

  const runMatch = () => {
    if (disposed || buffer === null || status() !== 'listening') return
    const frames = buffer.getCurrentFrames()
    if (frames.length < MIN_FRAMES_FOR_MATCH) return
    try {
      const onsets = detectOnsets(frames)
      if (onsets.length < MIN_ONSETS_FOR_MATCH) return
      const segmented = segmentNotes(frames, onsets)
      const contour: LivePitchContour = {
        frames,
        onsets,
        durationSec: frames.length > 0 ? frames[frames.length - 1].time : 0,
        noteSequence: segmented.noteSequence,
        ioiSequence: segmented.ioiSequence,
        noteDurations: segmented.noteDurations,
      }
      lastContourDurationSec = contour.durationSec

      const matched = matchPitchContour(contour, {
        maxResults: 3,
        sourceFilter: 'stem',
      })
      const view = matched
        .filter(
          (c): c is MatchCandidate & { sessionId: string } =>
            typeof c.sessionId === 'string' && c.sessionId !== '',
        )
        .map((c) => ({
          sessionId: c.sessionId,
          name: c.name.replace(/\.[a-z0-9]+$/i, ''),
          confidence: Math.round(c.confidence),
          matchOffsetSec: c.matchOffsetSec ?? null,
          breakdown: {
            pitch: Math.round(c.breakdown.pitchScore * 100),
            interval: Math.round(c.breakdown.intervalScore * 100),
            chroma: Math.round(c.breakdown.chromaScore * 100),
            rhythm: Math.round(c.breakdown.rhythmScore * 100),
          },
        }))
      setCandidates(view)

      // Sung time drives the policy: material means singing, not waiting.
      const snapshot = policy.report(
        Math.round(contour.durationSec * 1000),
        view.map((c) => ({ id: c.sessionId, score: c.confidence / 100 })),
      )
      setArmed(snapshot)
      if (snapshot.kind === 'open' && snapshot.leaderId !== null) {
        const leader = view.find((c) => c.sessionId === snapshot.leaderId)
        if (leader !== undefined) launch(leader)
      }
    } catch (err) {
      // A bad tick must not kill the session — just skip it.
      console.warn('[mercury-sing] match tick failed:', err)
    }
  }

  const handleFrame = (time: number, frequency: number, clarity: number) => {
    frameCounter++
    if (frameCounter % TRAIL_FRAME_STRIDE !== 0) return
    const voiced = frequency > 0 && clarity > 0
    trailRing.push(voiced ? toMidi(frequency) : Number.NaN)
    if (trailRing.length > TRAIL_LENGTH) trailRing.shift()
    setTrail([...trailRing])
    setElapsedSec(buffer?.getElapsed() ?? time)
  }

  /** Fingerprint completed separations that have none yet, one at a time. */
  const fingerprintPending = async (pending: UvrSession[]) => {
    if (pending.length === 0) return
    setFingerprinting({ done: 0, total: pending.length })
    for (const session of pending) {
      if (disposed) return
      try {
        const vocalUrl = await getStemBlobUrl(session.sessionId, 'vocal')
        if (vocalUrl === null) continue
        const response = await fetch(vocalUrl)
        const arrayBuffer = await response.arrayBuffer()
        const audioCtx = new AudioContext()
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
        await audioCtx.close()
        if (disposed) return
        const fp = await extractStemFingerprint(audioBuffer, {
          sessionId: session.sessionId,
          originalFileName: session.originalFile?.name ?? 'Your song',
        })
        if ('reason' in fp) {
          console.warn(
            '[mercury-sing] fingerprint skipped:',
            session.sessionId,
            fp.reason,
          )
          continue
        }
        await saveStemFingerprintData(session.sessionId, fp)
        addStemFingerprint(fp)
        setLibraryCount((c) => c + 1)
      } catch (err) {
        console.warn('[mercury-sing] fingerprinting failed:', err)
      } finally {
        setFingerprinting((p) => ({ done: p.done + 1, total: p.total }))
      }
    }
  }

  const start = async () => {
    try {
      const [loaded] = await Promise.all([
        loadStemFingerprints(),
        initSessionStore(),
      ])
      if (disposed) return
      const pending = getAllUvrSessionsReactive().filter(
        (s) => s.status === 'completed' && !hasStemFingerprint(s.sessionId),
      )
      setLibraryCount(loaded)
      if (loaded === 0 && pending.length === 0) {
        setStatus('no-library')
        return
      }
      void fingerprintPending(pending)

      audioEngine = new AudioEngine()
      audioEngine.init()
      audioRegistry.register(audioEngine)
      buffer = new LivePitchBuffer(audioEngine, {
        onFrame: (frame) => {
          handleFrame(frame.time, frame.pitch.frequency, frame.pitch.clarity)
        },
        onAutoStop: () => {
          if (disposed) return
          showNotification(
            'Mercury Sing stopped — I did not hear singing.',
            'info',
          )
          closeMercurySing()
        },
      })
      const ok = await buffer.start()
      if (disposed) return
      if (!ok) {
        setStatus('mic-denied')
        return
      }
      setStatus('listening')
      matchTimer = setInterval(runMatch, MATCH_INTERVAL_MS)
    } catch (err) {
      console.error('[mercury-sing] failed to start:', err)
      if (!disposed) setStatus('mic-denied')
    }
  }
  void start()

  return {
    status,
    candidates,
    armed,
    elapsedSec,
    trail,
    libraryCount,
    fingerprinting,
    pick: (index) => {
      const candidate = candidates()[index]
      if (candidate === undefined) return false
      launch(candidate)
      return true
    },
    dispose,
  }
}
