// Studio timeline contracts — view state and edit callbacks stay outside persistence.
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioClip, StudioProject, } from '@/lib/studio/model/types'

export interface StudioTimelineProps {
  project: StudioProject
  assets: readonly StudioAsset[]
  selectedClipId: string | null
  playheadFrame: number
  pixelsPerSecond: number
  writable: boolean
  phone: boolean
  /** Touch-sized handles and narrower headers: tablets and coarse pointers. */
  tablet?: boolean
  keyboardPreviewClip?: StudioClip | null
  /** A drawer covers the timeline: the clip bar and the empty hint would be cut. */
  drawerOpen?: boolean
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
