// ── Working out a room song's pitch line ─────────────────────────────
//
// A song that has never been opened in the stem mixer has no stored
// analysis, so `sessionSongNotes` returns an empty list and the jam room
// drew blank lanes -- silently, with no way for the singer to tell a song
// with no guide from a song where the guide had failed to load. There was
// also no way to produce one: the analysis existed only inside the mixer.
//
// Now the room runs it on song load, the way Karaoke Night's zen stage
// does, through the same `analyzeVocalSamples` at the same defaults. The
// host analyses once and re-sends the manifest, so every peer gets the
// line without spending a minute of CPU each, and a song only the host
// holds can be analysed at all.
//
// The song is singable throughout. Nothing here blocks playback: the
// lyrics, the transport and the scoring all work before the notes land,
// and the notes simply appear when they do.

import { batch, createSignal } from 'solid-js'
import { savePitchAnalysisToDb } from '@/db/services/session-pitch-analysis-service'
import type { JamPitchNeed, JamPitchProvisionState, } from '@/lib/jam/jam-pitch-provision'
import { JAM_PITCH_IDLE, jamPitchNeed } from '@/lib/jam/jam-pitch-provision'
import type { JamSong } from '@/lib/jam/jam-song'
import type { JamSongNote } from '@/lib/jam/types'
import type { VocalAnalysis } from '@/lib/pitch-pipeline'
import { analyzeVocalSamples, isAnalysisAbort, pitchHistoryFromNotes, } from '@/lib/pitch-pipeline'
import { showNotification } from '@/stores/notifications-store'

const [jamPitchProvision, setJamPitchProvision] =
  createSignal<JamPitchProvisionState>(JAM_PITCH_IDLE)

export { jamPitchProvision }

/**
 * The two impure edges, swappable so the orchestration can be tested
 * without Web Audio, a network or IndexedDB -- none of which jsdom has.
 */
export interface JamPitchProvisionSeams {
  /** Fetch the stem and decode it to mono samples. */
  loadVocalSamples: (
    url: string,
    signal: AbortSignal,
  ) => Promise<{ samples: Float32Array; sampleRate: number }>
  analyze: typeof analyzeVocalSamples
  save: (sessionId: string, analysis: VocalAnalysis) => Promise<void>
}

const realSeams: JamPitchProvisionSeams = {
  loadVocalSamples: decodeVocalStem,
  analyze: analyzeVocalSamples,
  save: async (sessionId, analysis) => {
    await savePitchAnalysisToDb(sessionId, {
      mergedNotes: analysis.mergedNotes,
      segmentedNotes: analysis.segmentedNotes,
      pitchHistory: pitchHistoryFromNotes(analysis.segmentedNotes),
    })
  },
}

let seams: JamPitchProvisionSeams = realSeams

/** Swap the impure edges. Tests only; `null` puts the real ones back. */
export function setJamPitchProvisionSeams(
  next: Partial<JamPitchProvisionSeams> | null,
): void {
  seams = next === null ? realSeams : { ...realSeams, ...next }
}

/**
 * Fetch a stem and decode it to mono samples.
 *
 * OfflineAudioContext rather than the room's live context: decoding needs
 * no output device and no user gesture, and a room on a phone should not
 * open a second hardware context to read a file.
 */
async function decodeVocalStem(
  url: string,
  signal: AbortSignal,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`vocal stem fetch failed: ${res.status}`)
  const bytes = await res.arrayBuffer()
  if (typeof OfflineAudioContext !== 'function') {
    throw new Error('This browser cannot decode audio outside playback')
  }
  // Length and channel count are irrelevant: decodeAudioData allocates its
  // own buffer and only borrows the sample rate.
  const ctx = new OfflineAudioContext(1, 1, 44100)
  const buffer = await ctx.decodeAudioData(bytes)
  return { samples: buffer.getChannelData(0), sampleRate: buffer.sampleRate }
}

/** Notifications about one song replace each other rather than stack. */
const CHANNEL = 'jam-pitch-provision'

const NOTHING_HEARD_REASON =
  'We could not pick a vocal line out of this song. Try again, or tidy it up in Karaoke Night or the stem mixer.'

const FAILED_REASON =
  'Working out the pitch guide did not finish. Try again in a moment.'

/** The run in flight, so a song change can stop it. */
let inFlight: { songId: string; controller: AbortController } | null = null
/** What to re-run when the singer presses Try again. */
let lastRequest: JamPitchProvisionRequest | null = null

export interface JamPitchProvisionRequest {
  song: JamSong
  isHost: boolean
  /** Where the finished line goes. The store owns the song, not this. */
  onNotes: (songId: string, notes: JamSongNote[]) => void
}

/**
 * Stop whatever is running and forget it.
 *
 * Called when the song changes, is cleared, or the room is left. A run
 * left going would spend a phone's battery on a song nobody is singing
 * and then hand its notes to whatever is loaded instead.
 */
export function abandonJamSongPitch(): void {
  inFlight?.controller.abort()
  inFlight = null
  lastRequest = null
  setJamPitchProvision(JAM_PITCH_IDLE)
}

/**
 * Make sure the loaded song has a pitch line, working one out if it can.
 *
 * Safe to call again for the same song: an analysis already running for it
 * is left alone rather than restarted. A different song aborts the old run
 * first.
 */
export function provideJamSongPitch(request: JamPitchProvisionRequest): void {
  const { song, isHost } = request
  const need = jamPitchNeed(song, isHost)

  if (inFlight !== null && inFlight.songId !== song.id) {
    inFlight.controller.abort()
    inFlight = null
  }
  // Already working on this very song. Asking twice -- a re-render, a
  // reconnect -- must not start a second pass over the same stem.
  if (inFlight !== null) return

  lastRequest = request
  applyNeed(need, request)
}

/** Run the same request again. The singer asked; nothing retries itself. */
export function retryJamSongPitch(): void {
  const request = lastRequest
  if (request === null || inFlight !== null) return
  applyNeed(jamPitchNeed(request.song, request.isHost), request)
}

function applyNeed(
  need: JamPitchNeed,
  request: JamPitchProvisionRequest,
): void {
  const songId = request.song.id
  switch (need.kind) {
    case 'have':
    case 'wait':
      setJamPitchProvision({ ...JAM_PITCH_IDLE, songId })
      return
    case 'cannot':
      setJamPitchProvision({
        phase: 'unavailable',
        progress: 0,
        songId,
        reason: need.reason,
        retryable: false,
      })
      return
    case 'analyse':
      void runAnalysis(need.sessionId, need.vocalUrl, request)
  }
}

async function runAnalysis(
  sessionId: string,
  vocalUrl: string,
  request: JamPitchProvisionRequest,
): Promise<void> {
  const songId = request.song.id
  const controller = new AbortController()
  inFlight = { songId, controller }
  setJamPitchProvision({
    phase: 'working',
    progress: 0,
    songId,
    reason: '',
    retryable: false,
  })

  try {
    const { samples, sampleRate } = await seams.loadVocalSamples(
      vocalUrl,
      controller.signal,
    )
    const analysis = await seams.analyze(
      samples,
      sampleRate,
      {},
      {
        signal: controller.signal,
        onProgress: (progress) => {
          // A result for a song that has since been swapped must not
          // repaint the bar under the new one.
          if (inFlight?.controller !== controller) return
          setJamPitchProvision((prev) =>
            prev.songId === songId && prev.phase === 'working'
              ? { ...prev, progress }
              : prev,
          )
        },
      },
    )
    if (inFlight?.controller !== controller) return

    const notes: JamSongNote[] = analysis.segmentedNotes.map((n) => ({
      midi: n.midi,
      startSec: n.startSec,
      endSec: n.endSec,
    }))
    // Persisted before it is announced, so a reload or a second room on
    // this device finds it rather than working it out again. A storage
    // failure is not worth losing the line over -- the room has the notes
    // in memory either way.
    await seams.save(sessionId, analysis).catch(() => undefined)
    if (inFlight?.controller !== controller) return
    inFlight = null

    if (notes.length === 0) {
      // Not an error, and emphatically not something to retry by itself:
      // re-running the same settings over the same samples produces the
      // same nothing, forever, on a device that is now warm.
      fail(songId, NOTHING_HEARD_REASON, true)
      return
    }

    batch(() => {
      setJamPitchProvision({ ...JAM_PITCH_IDLE, songId })
      request.onNotes(songId, notes)
    })
    showNotification('Pitch guide ready', 'success', { channel: CHANNEL })
  } catch (error) {
    if (inFlight?.controller === controller) inFlight = null
    // An abort is this code's own doing -- a song change, a room left --
    // so it says nothing at all.
    if (isAnalysisAbort(error) || controller.signal.aborted) {
      if (jamPitchProvision().songId === songId)
        setJamPitchProvision(JAM_PITCH_IDLE)
      return
    }
    console.error('[JamPitch] analysis failed', error)
    fail(songId, FAILED_REASON, true)
  }
}

function fail(songId: string, reason: string, retryable: boolean): void {
  setJamPitchProvision({
    phase: 'unavailable',
    progress: 0,
    songId,
    reason,
    retryable,
  })
  showNotification(reason, 'warning', { channel: CHANNEL })
}
