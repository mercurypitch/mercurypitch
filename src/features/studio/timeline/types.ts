// Studio timeline contracts — view state and edit callbacks stay outside persistence.
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioClip, StudioProject, } from '@/lib/studio/model/types'

export interface StudioTimelineProps {
  project: StudioProject
  assets: readonly StudioAsset[]
  selectedClipId: string | null
  /** The lane new takes join when they fit there. */
  selectedTrackId?: string | null
  onSelectTrack?(id: string): void
  /** Double-click or double-tap under the lane headers makes a new lane. */
  onNewLane?(): void
  playheadFrame: number
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
  onPointerEditStart?(): void
  onSelectClip(id: string | null): void
  onSeek(frame: number): void
  onZoom?(pixelsPerSecond: number): void
  onAddTakes?(): void
  onCommand(command: StudioCommand): boolean
  onClipDetails(id: string): void
  onTrackDetails(id: string): void
  readCanonicalAsset(assetId: string): Promise<Blob>
}
