// Studio timeline contracts — view state and edit callbacks stay outside persistence.
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioClip, StudioProject, } from '@/lib/studio/model/types'
import type { StudioFrameRange } from '@/lib/studio/playback/loop-range'
import type { StudioLaneInput } from '@/lib/studio/record/lane-inputs'
import type { StudioLiveTake, StudioRecordPhase, } from '@/lib/studio/record/studio-recorder'
import type { StudioPlayheadClock } from './playhead-motion'
import type { StudioWaveformPeaksStore } from './waveform-resource'

/** A lane being recorded into: its level, and the take growing in it. */
export interface StudioTimelineRecording {
  /** An armed lane, or null for a take that gets a lane of its own. */
  readonly trackId: string | null
  readonly live: StudioLiveTake | null
  readonly level: number
  /** Armed, counting in or recording: the lane shows its level. */
  readonly listening: boolean
}

/** Each lane's arm button: whether its lane is armed, and the press that arms or disarms that lane alone. */
export interface StudioLaneArming {
  /** How lane `trackId`'s button shows: idle while it is not armed, opening, armed, then counting in, recording or keeping with every armed lane. */
  laneState(trackId: string): StudioRecordPhase
  /** The recorder's phase across every armed lane. */
  phase(): StudioRecordPhase
  /** Whether a press can arm a lane now: the song takes edits and its audio is free. */
  canArm(): boolean
  toggle(trackId: string): void
}

/** Each lane's own input, kept on this device, and the name of the Studio's that the others follow. */
export interface StudioTimelineLaneInputs {
  of(trackId: string): StudioLaneInput
  studioInputName(): string
}

/** A sentence for the timeline's status pill; a new object shows it again. */
export interface StudioTimelineNotice {
  text: string
}

export interface StudioTimelineProps {
  project: StudioProject
  assets: readonly StudioAsset[]
  selectedClipId: string | null
  /** The lane new takes join when they fit there. */
  selectedTrackId?: string | null
  onSelectTrack?(id: string): void
  /** Double-click or double-tap under the lane headers makes a new lane. */
  onNewLane?(): void
  /** The playhead for readouts and edits; it trails a playing song by up to a tenth of a second. */
  playheadFrame: number
  /** The clock a playing song's line follows every display frame, and the frame a split uses. */
  playheadClock?: StudioPlayheadClock
  /** A playing song jumps once a ruler drag ends, not under every move. */
  playing?: boolean
  pixelsPerSecond: number
  writable: boolean
  phone: boolean
  /** Touch-sized handles and narrower headers: tablets and coarse pointers. */
  tablet?: boolean
  keyboardPreviewClip?: StudioClip | null
  /** A drawer covers the timeline: the clip bar and the empty hint would be cut. */
  drawerOpen?: boolean
  /**
   * The mixing desk takes the space below: zoom and the selected clip's
   * commands move to a dock beside the lanes, clear of every lane and the ruler.
   */
  deskOpen?: boolean
  /** Said in the status pill and to assistive tech, such as where a take landed. */
  notice?: StudioTimelineNotice | null
  onPointerEditStart?(): void
  onSelectClip(id: string | null): void
  onSeek(frame: number): void
  onZoom?(pixelsPerSecond: number): void
  onAddTakes?(): void
  onCommand(command: StudioCommand): boolean
  onClipDetails(id: string): void
  /** A lane's details; at its input when its header's input chip asks. */
  onTrackDetails(id: string, at?: 'input'): void
  /**
   * Each lane's own input and channel, for its header's chip on a computer
   * or tablet (lane-input-badge.ts); a lane on all of the Studio's input
   * shows none.
   */
  laneInputs?: StudioTimelineLaneInputs
  readCanonicalAsset(assetId: string): Promise<Blob>
  /** Where each take's waveform peaks are kept between visits. */
  assetPeaks?: StudioWaveformPeaksStore
  /** Every armed lane's recording, from its arm until its take is kept, in the order they were armed. */
  records?: readonly StudioTimelineRecording[]
  /** The lanes' arm buttons; absent, the headers show none. */
  arming?: StudioLaneArming
  /** The range on the ruler Repeat loops and Punch records in (StudioRulerRange.tsx). */
  range?: StudioFrameRange | null
  /** Set or clear the range: a drag along the ruler, its handles, or a clip's toolbar. */
  onRange?(range: StudioFrameRange | null): void
}
