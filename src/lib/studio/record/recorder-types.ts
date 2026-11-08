// ============================================================
// Studio recorder types — what the recorder shows, what it hands over, and what it needs from the Studio around it
// ============================================================
//
// Kept apart from the recorder (studio-recorder.ts) so the hook that wires
// it, the journal that keeps its takes and the views that draw it name one
// set of shapes, and the recorder stays a readable length.
import type { ChannelPick } from '@/lib/audio-input/input-channels'
import type { StudioCaptureEvents, StudioCaptureHandle } from './capture-node'
import type { StudioClickTrack } from './click-track'
import type { StudioInputMonitor, StudioMonitorLevel } from './input-monitor'
import type { StudioRecordSettings } from './record-settings'
import type { StudioLivePeaks } from './take-audio'
import type { StudioTakeCut } from './take-plan'
import type { StudioTakeAnchor } from './take-timing'

export type StudioRecordPhase =
  | 'idle'
  | 'arming'
  | 'armed'
  | 'counting'
  | 'recording'
  | 'finishing'

/** A take as it records, for the waveform that grows in its lane. */
export interface StudioLiveTake {
  /** The take's title ("Take 3"), shown as its clip will show it. */
  readonly title: string
  /** The song frame the take's first sample lands on. */
  readonly heardFirst: number
  /** Where the clip will start: the playhead, for a take started from silence. */
  readonly fromFrame: number | null
  readonly peaks: StudioLivePeaks
  /** The capture's rate, which the peaks are counted in. */
  readonly sampleRate: number
  /** Peaks drawn so far; a new value on every chunk. */
  readonly count: number
  /** A punch's range, or a loop's: the lane shows only what the take keeps. */
  readonly cut?: StudioTakeCut | null
  /**
   * Where the take sits on the clock (take-timing.ts): as planned until the
   * song starts under it, then the song's own. Where no song plays, the
   * playhead follows it (features/studio/audio/take-clock.ts).
   */
  readonly anchor?: StudioTakeAnchor
}

/** One armed lane: its input opening or open, its level, and its take as it records. */
export interface StudioRecordLane {
  /** The lane, or null for a take that gets a lane of its own. */
  readonly trackId: string | null
  /** Its input is still opening, in the press that armed it. */
  readonly arming: boolean
  /** The loudest input sample lately, 0 to 1. */
  readonly level: number
  readonly live: StudioLiveTake | null
  /** It records a microphone; false for an instrument, and while its input opens. */
  readonly microphone: boolean
}

/** What one lane's take said when it did not end the usual way. */
export interface StudioRecordNotice {
  readonly trackId: string | null
  readonly text: string
}

export interface StudioRecorderView {
  /** Idle with no lane armed, arming while any lane's input opens, else armed; then counting in, recording and keeping, across every armed lane. */
  readonly phase: StudioRecordPhase
  /** The loudest input sample lately on the first armed lane, 0 to 1. */
  readonly level: number
  /** The count-in beats left, while counting in. */
  readonly countBeat: number | null
  /** Why the last arm or take did not happen. */
  readonly error: string | null
  /** What happened to the last lane's take that did not end the usual way. */
  readonly notice: string | null
  /** The first armed lane, which its take goes to, or null for a new lane. */
  readonly targetTrackId: string | null
  /** The first armed lane's take as it records. */
  readonly live: StudioLiveTake | null
  /** Every armed lane, in the order they were armed. */
  readonly lanes?: readonly StudioRecordLane[]
  /** What each lane's last take said, for the lanes whose take did not end the usual way. */
  readonly notices?: readonly StudioRecordNotice[]
  /** Which opening of the microphone the armed lanes share: a new number each time it opens, the same while lanes come and go on it; null while no lane holds one. */
  readonly capture?: number | null
}

/** A finished take, ready to be kept like an imported file. */
export interface StudioCapturedTake {
  readonly id: string
  readonly title: string
  readonly trackId: string | null
  /** The capture's rate; the import decodes it at 48 kHz. */
  readonly sampleRate: number
  readonly samples: Float32Array
  /** The 48 kHz song frame its first sample lands on. */
  readonly heardFirst: number
  readonly fromFrame: number | null
  /** A punch keeps its range, a loop every pass of it (take-passes.ts); absent for a plain take. */
  readonly cut?: StudioTakeCut | null
  /** The clock time of its first sample, to place what was played into it (take-notes.ts); absent for a take kept from the journal. */
  readonly capturedFrom?: number
}

/** What the journal keeps about a take, so a closed tab can still keep it. */
export interface StudioTakeJournalHeader {
  readonly id: string
  readonly trackId: string | null
  readonly title: string
  readonly sampleRate: number
  readonly fromFrame: number | null
  readonly heardFirst: number
  readonly cut?: StudioTakeCut | null
}

export interface StudioTakeJournalWriter {
  begin(header: StudioTakeJournalHeader): Promise<void>
  /** The take's first sample has a song frame now known for certain. */
  place(id: string, heardFirst: number): Promise<void>
  append(
    id: string,
    sequence: number,
    firstFrame: number,
    pcm: Int16Array,
  ): Promise<void>
  discard(id: string): Promise<void>
}

export interface StudioRecorderTransport {
  playing(): boolean
  playheadFrame(): number
  /** Whether a Play from `frame` has anything to play. */
  canPlay(frame: number): boolean
  /** Start the song from `fromFrame`, heard no sooner than `notBefore`. */
  play(notBefore: number, fromFrame: number): Promise<boolean>
  pause(): void
  anchor(): StudioTakeAnchor | null
}

/** The microphone an arm opened, and the one way to give that one back (MicManager.acquireFrom). */
export interface StudioMicHold {
  readonly stream: MediaStream
  /** The input or aligned pair of it the lane records; null or absent for the default its channel count makes. */
  readonly pick?: ChannelPick | null
  release(): void
}

/** An instrument a MIDI lane plays in place of a microphone: its sound is made in the page, and no microphone opens for it. */
export interface StudioInstrumentHold {
  readonly kind: 'instrument'
  /** Make the instrument's sound on the clock: the node the lane records and hears. */
  play(context: AudioContext): AudioNode
  /** Its input is still there: the port connected. */
  connected(): boolean
  /** Stop its sound and let its input go. */
  release(): void
}

/** What an arm opened for a lane: a microphone, or an instrument. */
export type StudioInputHold = StudioMicHold | StudioInstrumentHold

/** What a lane says when its input goes: while armed, mid-take, and before the take began. */
export interface StudioInputLostWords {
  readonly armed: string
  readonly midTake: string
  readonly beforeTake: string
}

/** What an arm opened: the input's channels, and what the lane records of them. */
export interface StudioInputOpened {
  readonly stream: MediaStream
  /** The input's channels as its track reports them; null where the browser does not say. */
  readonly channels: number | null
  /** What the lane records: one input, or an aligned pair mixed to mono; null where the count is not known and the input goes as it is. */
  readonly pick: ChannelPick | null
  /** The lane's pick that the input does not have, or does not say it has, so the default records in its place; null when none was missing. */
  readonly missing: ChannelPick | null
}

export interface StudioRecorderDeps {
  unlock(): Promise<boolean>
  clock(): AudioContext | null
  /** Open the input `trackId` records from: its own, or the Studio's (null: a new lane). Lanes on one microphone are handed the same stream, which they share. */
  acquireMic(trackId: string | null): Promise<StudioMicHold>
  /** A MIDI lane's instrument, asked first and inside the press, opened in place of a microphone; null for a lane that records one. */
  acquireInstrument?(
    trackId: string | null,
  ): Promise<StudioInstrumentHold> | null
  prepareWorklet(context: AudioContext): Promise<void>
  openCapture(
    context: AudioContext,
    input: AudioNode,
    events: StudioCaptureEvents,
  ): StudioCaptureHandle
  createSource(context: AudioContext, stream: MediaStream): AudioNode
  createClicks(
    context: AudioContext,
  ): Pick<StudioClickTrack, 'schedule' | 'stop'>
  createMonitor(
    context: AudioContext,
    input: AudioNode,
  ): Pick<StudioInputMonitor, 'set' | 'dispose'>
  monitorLevel(trackId: string | null): StudioMonitorLevel
  /** The input a lane's arm opened (`trackId`): how many channels it has, what the lane records of them, and whether its pick was there. */
  inputOpened?(
    opened: StudioInputOpened & { readonly trackId: string | null },
  ): void
  transport: StudioRecorderTransport
  settings(): StudioRecordSettings
  /** What the next take keeps: a punch or a loop of the range, or null for a plain take. */
  takeCut?(): StudioTakeCut | null
  tempoBpm(): number
  /** What a new take is moved earlier by, in seconds: a microphone's round trip, or an instrument's (`stream` null) output path; read for each lane's take. */
  roundTrip(context: AudioContext, stream: MediaStream | null): number
  /** Hold `bytes` for one lane's take; throws when there is not room. */
  reserveMemory(bytes: number): () => void
  journal?: StudioTakeJournalWriter
  /** Store the take; true once it is kept. */
  keep(take: StudioCapturedTake): Promise<boolean>
  title(): string
  createId(): string
  /** What to say when the microphone or the clock would not open. */
  describeError(error: unknown): string
  onChange(view: StudioRecorderView): void
}
