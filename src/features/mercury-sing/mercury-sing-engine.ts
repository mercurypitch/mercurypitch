// ============================================================
// Mercury Sing engine — listen, match, decide, hand off
// ============================================================
//
// The headless controller behind the stage: owns its own AudioEngine +
// LivePitchBuffer (exactly like ShazamListen), runs the melody matcher over
// the live contour on a timer, feeds fused scores to the auto-open policy,
// and on an open decision hands the song to its host to open (Karaoke Night
// on the web, the room's stage on the phone) — seeked to where the singer
// already is. The stage component is a thin skin over the signals exposed
// here; nothing in this file renders.
//
// Also the librarian: on start it loads persisted stem fingerprints and
// quietly fingerprints any song that has none yet, so the first Mercury Sing
// session teaches the library while the user sings. Which songs, how one is
// fingerprinted and how one opens are its host's (mercury-sing-host.ts): the
// web's separated songs and Karaoke Night, or the native Karaoke room's.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { saveStemFingerprintData } from '@/db/services/uvr-service'
import { acquireWakeWordHold, speechActiveWithin, } from '@/features/voice-control/voice-command-registry'
import { AudioEngine } from '@/lib/audio-engine'
import { stripAudioExtension } from '@/lib/audio-file-name'
import { audioRegistry } from '@/lib/audio-registry'
import { LivePitchBuffer } from '@/lib/shazam/live-pitch-buffer'
import { addStemFingerprint, hasStemFingerprint, loadStemFingerprints, } from '@/lib/shazam/melody-fingerprints'
import { matchPitchContour } from '@/lib/shazam/melody-matcher'
import { detectOnsets, segmentNotes } from '@/lib/shazam/onset-detector'
import type { LivePitchContour, MatchCandidate } from '@/lib/shazam/types'
import { showNotification } from '@/stores/notifications-store'
import type { AutoOpenSnapshot } from './auto-open-policy'
import { createAutoOpenPolicy } from './auto-open-policy'
import { launchStartSec, sungSince } from './launch-math'
import type { MercurySingHost, MercurySingSong } from './mercury-sing-host'

export type { MercurySingHost, MercurySingSong }

/** How often the live contour is re-matched against the library. */
const MATCH_INTERVAL_MS = 1500
/** Matching needs this much captured signal before it says anything. */
const MIN_FRAMES_FOR_MATCH = 90
const MIN_ONSETS_FOR_MATCH = 3
/**
 * Wheel quadrants — the engine surfaces exactly this many closest matches,
 * and the picker draws one wedge per slot. Lives here (the headless side)
 * because the matcher's `maxResults` must equal what the wheel shows: the
 * engine once asked for 3 while the wheel advertised 4, so slot four could
 * never fill and "sing number four" always failed.
 */
export const WHEEL_SLOTS = 4
/**
 * While you are TALKING to the app, the wheel stops re-ranking.
 *
 * Saying "sing number one" takes about a second, and those words were
 * still being fed to the melody matcher as though they were singing — so
 * the candidate order could change between reading the number and
 * finishing the sentence, and the pick opened a different song from the
 * one on screen. Freezing on speech is what makes the number you say mean
 * the song you saw. Comfortably longer than a spoken command, short enough
 * that ordinary singing never trips it.
 */
const SPEECH_FREEZE_MS = 2500

/** Pitch-trail ring shown by the stage (throttled to every 3rd frame). */
const TRAIL_LENGTH = 96
const TRAIL_FRAME_STRIDE = 3

export type MercurySingStatus =
  | 'starting'
  | 'listening'
  /** The mic let go after the singing stopped; what was found still opens. */
  | 'quiet'
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

export interface MercurySingLibraryEntry {
  sessionId: string
  name: string
  /** False while this song's fingerprint is still being built. */
  ready: boolean
}

export interface MercurySingEngine {
  status: Accessor<MercurySingStatus>
  candidates: Accessor<MercurySingCandidateView[]>
  armed: Accessor<AutoOpenSnapshot>
  /** Wall seconds since listening began. */
  elapsedSec: Accessor<number>
  /** Recent pitch trail as MIDI numbers; NaN marks unvoiced frames. */
  trail: Accessor<readonly number[]>
  /** Every song being listened for, named — so the stage can show WHAT it
   *  is matching against before any candidate scores. */
  library: Accessor<MercurySingLibraryEntry[]>
  /** Songs currently matchable (grows as background fingerprinting runs). */
  libraryCount: Accessor<number>
  /** Background fingerprinting progress; total 0 = nothing to do. */
  fingerprinting: Accessor<{ done: number; total: number }>
  /** True while the ranking is held still because someone is speaking. */
  frozen: Accessor<boolean>
  /** Launch candidate at `index` (0-based). False when nothing is there. */
  pick: (index: number) => boolean
  /**
   * Launch the candidate for this song, wherever it ranks now: a row the
   * singer tapped is the song they meant, even if the order just changed.
   */
  pickSession: (sessionId: string) => boolean
  /** Open a roster song from the top — "I know which one it is". */
  openFromLibrary: (sessionId: string) => boolean
  /** Cancel and release everything. Safe to call twice. */
  dispose: () => void
}

const toMidi = (frequency: number): number =>
  12 * Math.log2(frequency / 440) + 69

/** One engine per stage opening — created on mount, disposed on cleanup. */
export function createMercurySingEngine(
  host: MercurySingHost,
  /**
   * The singing has stopped for a while: the mic is let go (status
   * `quiet`), and the stage closes itself or keeps what it found.
   */
  giveUp: () => void,
): MercurySingEngine {
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
  const [library, setLibrary] = createSignal<MercurySingLibraryEntry[]>([])
  const [libraryCount, setLibraryCount] = createSignal(0)
  const [fingerprinting, setFingerprinting] = createSignal({
    done: 0,
    total: 0,
  })
  const [frozen, setFrozen] = createSignal(false)

  const policy = createAutoOpenPolicy()
  const releaseWakeHold = acquireWakeWordHold()

  let audioEngine: AudioEngine | null = null
  let buffer: LivePitchBuffer | null = null
  let matchTimer: ReturnType<typeof setInterval> | null = null
  let disposed = false
  let launching = false
  /**
   * How long the singer had sung at the last match, from the first note to
   * the last voiced frame: where they had got to past the match's start. A
   * pause after it does not move them on.
   */
  let lastSungSec = 0
  /** The host's songs: only these are offered, whatever else is indexed. */
  let songIds = new Set<string>()

  const trailRing: number[] = []
  let frameCounter = 0

  /** Let the mic go and stop matching; what was found stays, and opens. */
  const stopListening = () => {
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
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    stopListening()
    releaseWakeHold()
  }

  /** The one way out of the stage: open a song, rolling. `startAtSec` of 0
   *  is a plain "just play this one from the top". Returns false when a
   *  launch is already in flight — the caller must NOT report success for
   *  a pick that was swallowed while another song is opening. */
  const launchSession = (
    sessionId: string,
    name: string,
    startAtSec: number,
  ): boolean => {
    if (disposed || launching) return false
    launching = true
    setStatus('launching')
    console.log(
      '[mercury-sing] launching',
      sessionId,
      'at',
      startAtSec.toFixed(1),
    )
    // Release the mic BEFORE the song opens: the room wants it for scoring.
    dispose()
    host.launch({ sessionId, name }, startAtSec)
    return true
  }

  const launch = (candidate: MercurySingCandidateView): boolean =>
    launchSession(
      candidate.sessionId,
      candidate.name,
      launchStartSec(candidate.matchOffsetSec, lastSungSec),
    )

  const runMatch = () => {
    if (disposed || buffer === null || status() !== 'listening') return
    // Someone is talking to the app, not singing to it — hold the wheel
    // still so a pick lands on what they can see. The policy is told once
    // per freeze: its sustain clock is wall-adjacent (nowMs deltas), and
    // an unreported frozen span must not count as held evidence.
    if (speechActiveWithin(SPEECH_FREEZE_MS)) {
      if (!frozen()) setArmed(policy.interrupt())
      setFrozen(true)
      return
    }
    setFrozen(false)
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
      lastSungSec = sungSince(frames, onsets[0].time)

      const matched = matchPitchContour(contour, {
        maxResults: WHEEL_SLOTS,
        sourceFilter: 'stem',
        // Only the host's songs can be opened. A fingerprint can outlive its
        // song this run (a song removed since); matched at all, it would
        // take one of the slots from a song that is still there.
        sessionIds: songIds,
      })
      const view = matched
        .filter(
          (c): c is MatchCandidate & { sessionId: string } =>
            typeof c.sessionId === 'string' && c.sessionId !== '',
        )
        .map((c) => ({
          sessionId: c.sessionId,
          // A fingerprint saved without a file name must still read as
          // something in the list — a blank row is unpickable.
          name: stripAudioExtension(c.name).trim() || 'Your song',
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

      // One line per tick, copy-pasteable — this is what a field run brings
      // back so the open threshold can be set from evidence rather than
      // guessed. See docs/plans/mercury-sing-field-test.md.
      const margin =
        view.length > 1 ? view[0].confidence - view[1].confidence : null
      console.log(
        `[mercury-sing] t=${contour.durationSec.toFixed(1)}s notes=${contour.noteSequence.length}`,
        `| ${view
          .map((c) => `${c.name} ${String(c.confidence)}%`)
          .join(' · ')}`,
        `| margin=${margin === null ? 'n/a' : String(margin)}`,
        `| ${snapshot.kind}${snapshot.kind === 'arming' ? ` ${String(Math.round(snapshot.armedFraction * 100))}%` : ''}`,
        view.length > 0
          ? `| top breakdown p=${String(view[0].breakdown.pitch)} i=${String(view[0].breakdown.interval)} c=${String(view[0].breakdown.chroma)} r=${String(view[0].breakdown.rhythm)} @${view[0].matchOffsetSec?.toFixed(1) ?? '?'}s`
          : '',
      )
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

  /** Fingerprint the songs that have none yet, one at a time. */
  const fingerprintPending = async (pending: readonly MercurySingSong[]) => {
    if (pending.length === 0) return
    setFingerprinting({ done: 0, total: pending.length })
    for (const song of pending) {
      if (disposed) return
      try {
        // A stage closed mid-way skips what has not started (the host
        // checks), and keeps a fingerprint that finished all the same.
        const fp = await host.fingerprint(song, () => disposed)
        if (fp === null) continue
        await saveStemFingerprintData(song.sessionId, fp)
        addStemFingerprint(fp)
        if (disposed) return
        setLibrary((prev) =>
          prev.map((entry) =>
            entry.sessionId === song.sessionId
              ? { ...entry, ready: true }
              : entry,
          ),
        )
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
      const [, songs] = await Promise.all([
        loadStemFingerprints(),
        host.songs(),
      ])
      if (disposed) return
      songIds = new Set(songs.map((song) => song.sessionId))
      // The roster the stage shows: every song listened for, each flagged
      // with whether its fingerprint is already usable.
      setLibrary(
        songs.map((s) => ({
          sessionId: s.sessionId,
          name: s.name,
          ready: hasStemFingerprint(s.sessionId),
        })),
      )
      setLibraryCount(
        songs.filter((s) => hasStemFingerprint(s.sessionId)).length,
      )
      if (songs.length === 0) {
        setStatus('no-library')
        return
      }
      void fingerprintPending(
        songs.filter((s) => !hasStemFingerprint(s.sessionId)),
      )

      audioEngine = new AudioEngine()
      audioEngine.init()
      audioRegistry.register(audioEngine)
      buffer = new LivePitchBuffer(audioEngine, {
        onFrame: (frame) => {
          handleFrame(frame.time, frame.pitch.frequency, frame.pitch.clarity)
        },
        onAutoStop: () => {
          if (disposed) return
          stopListening()
          // Nothing more is heard, so nothing opens by itself now: no row may
          // go on saying it is about to.
          setArmed(policy.interrupt())
          // With the mic let go, nothing sung can reach the voice commands,
          // so they need not wait behind the wake word any more. The release
          // from dispose then does nothing; Listen again takes a hold of its
          // own.
          releaseWakeHold()
          setStatus('quiet')
          if (host.heardNothing !== undefined) {
            showNotification(host.heardNothing, 'info')
          }
          giveUp()
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
    library,
    libraryCount,
    fingerprinting,
    frozen,
    pick: (index) => {
      const candidate = candidates()[index]
      if (candidate === undefined) return false
      return launch(candidate)
    },
    pickSession: (sessionId) => {
      const candidate = candidates().find((c) => c.sessionId === sessionId)
      if (candidate === undefined) return false
      return launch(candidate)
    },
    openFromLibrary: (sessionId) => {
      const entry = library().find((e) => e.sessionId === sessionId)
      if (entry === undefined) return false
      return launchSession(entry.sessionId, entry.name, 0)
    },
    dispose,
  }
}
