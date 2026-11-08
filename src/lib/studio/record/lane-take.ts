// ============================================================
// Studio lane take — one armed lane's take: its audio as it records, its own round trip and journal, and what it says when it ends
// ============================================================
//
// One Record press records every armed lane on the one song clock
// (studio-recorder.ts). Their captures start on the same frame, and each
// lane keeps a take of its own: placed by its own path (a microphone's
// round trip, an instrument's output path), journaled on its own so a
// closed tab keeps every lane, and ended on its own when its input goes,
// saying so, while the other lanes record on.
import type { MicReleaseReason } from '@/lib/mic-manager'
import { STUDIO_MAX_CLIP_PASSES } from '../model/clip-passes'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import type { StudioCaptureStop } from './pcm-capture'
import type { StudioInputLostWords } from './recorder-types'
import type { StudioLivePeaks } from './take-audio'
import { createStudioLivePeaks, createStudioTakeBuffer } from './take-audio'
import type { StudioTakeJournalFeed } from './take-journal-feed'
import { studioTakeClip } from './take-passes'
import type { StudioTakeCut } from './take-plan'

const STOP_NOTICES: Partial<Record<StudioCaptureStop, string>> = {
  'input-lost':
    'The microphone went quiet mid-take, so the take ends there. Studio kept what came before.',
  limit: 'Takes stop at five minutes. Studio kept this one.',
  'fell-behind':
    'Studio fell behind keeping this take, so it stopped there. Studio kept what came before.',
  interrupted:
    'Audio stopped for a moment, so the take ends there. Studio kept what came before.',
  'last-pass': `A loop keeps ${STUDIO_MAX_CLIP_PASSES} passes, so recording stopped after the last one.`,
}

/** A take that ended before the song reached it keeps nothing, and says so. */
const ENDED_BEFORE_THE_TAKE: Partial<Record<StudioCaptureStop, string>> = {
  'input-lost':
    'The microphone went quiet before the take began, so nothing was recorded. Press Record to try again.',
  'fell-behind':
    'Studio fell behind before the take began, so nothing was recorded. Press Record to try again.',
  interrupted:
    'Audio stopped for a moment before the take began, so nothing was recorded. Press Record to try again.',
}

const TAKE_TOO_SHORT = 'That take was too short to keep.'
const BEFORE_THE_IN_POINT =
  'Stopped before the range began, so nothing was recorded.'
/** A punch keeps a tenth of a second at least, a loop's first pass a second (take-passes.ts). */
const TOO_SOON_IN_RANGE =
  'Stopped just after the range began, so the take was too short to keep.'

export const MIC_LOST_MID_TAKE =
  'The microphone went away mid-take. Studio kept what it heard up to then.'
export const MIC_LOST_BEFORE_TAKE =
  'The microphone went away before the take began, so nothing was recorded. Plug it back in, then press Record again.'
export const MIC_LOST_ARMED =
  'The microphone went away. Plug it back in, then press Record again.'
/** An armed lane's microphone, let go by the app as the tab stayed in the background (mic-manager.ts). */
export const MIC_RELEASED_IN_BACKGROUND =
  'Studio let the microphone go while this tab was in the background. Arm the lane again.'
/** An armed lane's microphone, handed to another MercuryPitch tab that asked for it. */
export const MIC_TAKEN_BY_OTHER_TAB =
  'Another MercuryPitch tab took the microphone. Close it there, then arm the lane again.'

const RELEASED_BY_THE_APP: Record<MicReleaseReason, string> = {
  background: MIC_RELEASED_IN_BACKGROUND,
  'other-tab': MIC_TAKEN_BY_OTHER_TAB,
}

/** What a lane on the microphone says when it goes: armed, in the release's own reason, else as a lost device; mid-take; and before its take began. */
export function studioMicLostWords(
  reason: MicReleaseReason | null,
): StudioInputLostWords {
  return {
    armed: reason === null ? MIC_LOST_ARMED : RELEASED_BY_THE_APP[reason],
    midTake: MIC_LOST_MID_TAKE,
    beforeTake: MIC_LOST_BEFORE_TAKE,
  }
}

/** One lane's take, from Record until it is kept or let go. */
export interface StudioLaneTake {
  readonly id: string
  readonly trackId: string | null
  /** The capture's rate. */
  readonly sampleRate: number
  readonly buffer: ReturnType<typeof createStudioTakeBuffer>
  readonly peaks: StudioLivePeaks
  /** Taken off the take's start, in seconds: its own lane's path, read as the take starts. */
  readonly roundTrip: number
  readonly journal: StudioTakeJournalFeed
  readonly releaseMemory: () => void
  /** The clock frame its capture began on: planned, then as the worklet says. */
  startFrame: number
  started: boolean
  /** Its capture was told to stop, by Stop, a lost input or the clock. */
  stopping: boolean
  /** Its capture stopped, or the watchdog gave up waiting for it. */
  ended: boolean
  /** Kept, or let go: nothing more happens to it. */
  finished: boolean
  /** Finishes the take if the worklet never says it stopped. */
  watchdog: ReturnType<typeof setTimeout> | null
  /** The lane's input went mid-take, in these words. */
  lost: StudioInputLostWords | null
}

export function createStudioLaneTake(take: {
  readonly id: string
  readonly trackId: string | null
  readonly sampleRate: number
  readonly maxFrames: number
  readonly roundTrip: number
  readonly startFrame: number
  readonly journal: StudioTakeJournalFeed
  readonly releaseMemory: () => void
}): StudioLaneTake {
  return {
    id: take.id,
    trackId: take.trackId,
    sampleRate: take.sampleRate,
    buffer: createStudioTakeBuffer(),
    peaks: createStudioLivePeaks(take.sampleRate, take.maxFrames),
    roundTrip: take.roundTrip,
    journal: take.journal,
    releaseMemory: take.releaseMemory,
    startFrame: take.startFrame,
    started: false,
    stopping: false,
    ended: false,
    finished: false,
    watchdog: null,
    lost: null,
  }
}

/** The take's length in the 48 kHz frames its import keeps. */
export function takeFrames(take: StudioLaneTake): number {
  return Math.round((take.buffer.frames * STUDIO_SAMPLE_RATE) / take.sampleRate)
}

/** Whether the take keeps anything: past its trim, or enough of a punch's range or a loop's (take-passes.ts). */
export function keepsSomething(
  take: StudioLaneTake,
  placed: {
    readonly heardFirst: number
    readonly fromFrame: number | null
    readonly cut: StudioTakeCut | null
  },
): boolean {
  return studioTakeClip(placed, takeFrames(take)) !== null
}

/** What a finished take says: why it ended, and whether anything was kept. */
export function endNotice(
  kept: boolean,
  named: string | null,
  reason: StudioCaptureStop,
  cut: StudioTakeCut | null,
  /** The capture ran past the range's start. */
  inRange: boolean,
  lost: StudioInputLostWords | null,
): string | null {
  if (kept) return named ?? STOP_NOTICES[reason] ?? null
  if (lost !== null && named === lost.midTake) return lost.beforeTake
  const early = inRange ? TOO_SOON_IN_RANGE : BEFORE_THE_IN_POINT
  const stopped = cut !== null && reason === 'stopped' ? early : null
  return ENDED_BEFORE_THE_TAKE[reason] ?? stopped ?? TAKE_TOO_SHORT
}
