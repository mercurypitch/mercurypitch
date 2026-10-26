// Studio timeline contracts — view state and edit callbacks stay outside persistence.
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'

export interface StudioTimelineProps {
  project: StudioProject
  assets: readonly StudioAsset[]
  selectedClipId: string | null
  playheadFrame: number
  pixelsPerSecond: number
  writable: boolean
  phone: boolean
  onSelectClip(id: string | null): void
  onSeek(frame: number): void
  onCommand(command: StudioCommand): boolean
  onClipDetails(id: string): void
  onTrackDetails(id: string): void
  readCanonicalAsset(assetId: string): Promise<Blob>
}
