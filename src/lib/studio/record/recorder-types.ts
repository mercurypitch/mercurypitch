// ============================================================
// Studio recorder types — what the recorder shows, what it hands over, and what it needs from the Studio around it
// ============================================================
//
// Kept apart from the recorder (studio-recorder.ts) so the hook that wires
// it, the journal that keeps its takes and the views that draw it name one
// set of shapes, and the recorder stays a readable length.
import type { StudioCaptureEvents, StudioCaptureHandle } from './capture-node'
import type { StudioClickTrack } from './click-track'
import type { StudioInputMonitor, StudioMonitorLevel } from './input-monitor'
import type { StudioRecordSettings } from './record-settings'
import type { StudioLivePeaks } from './take-audio'
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
  /** The song frame the take's first sample lands on. */
  readonly heardFirst: number
  /** Where the clip will start: the playhead, for a take started from silence. */
  readonly fromFrame: number | null
  readonly peaks: StudioLivePeaks
  /** The capture's rate, which the peaks are counted in. */
  readonly sampleRate: number
  /** Peaks drawn so far; a new value on every chunk. */
  readonly count: number
}

export interface StudioRecorderView {
  readonly phase: StudioRecordPhase
  /** The loudest input sample lately, 0 to 1. */
  readonly level: number
  /** The count-in beats left, while counting in. */
  readonly countBeat: number | null
  /** Why the last arm or take did not happen. */
  readonly error: string | null
  /** What happened to the last take when it did not end the usual way. */
  readonly notice: string | null
  /** The lane the take goes to, or null for a new lane. */
  readonly targetTrackId: string | null
  readonly live: StudioLiveTake | null
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
}

/** What the journal keeps about a take, so a closed tab can still keep it. */
export interface StudioTakeJournalHeader {
  readonly id: string
  readonly trackId: string | null
  readonly title: string
  readonly sampleRate: number
  readonly fromFrame: number | null
  readonly heardFirst: number
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
  play(notBefore: number): Promise<boolean>
  pause(): void
  anchor(): StudioTakeAnchor | null
}

export interface StudioRecorderDeps {
  unlock(): Promise<boolean>
  clock(): AudioContext | null
  acquireMic(): Promise<MediaStream>
  releaseMic(): void
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
  transport: StudioRecorderTransport
  settings(): StudioRecordSettings
  tempoBpm(): number
  /** The round trip new takes are trimmed by, in seconds. */
  roundTrip(context: AudioContext, stream: MediaStream): number
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
