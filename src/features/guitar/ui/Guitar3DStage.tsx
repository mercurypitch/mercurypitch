// Guitar3DStage is the host-neutral surface shared by the legacy tab and standalone rooms.
// ============================================================

import type { Accessor } from 'solid-js'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import { GuitarTab3DView } from '@/features/guitar-tab-3d/GuitarTab3DView'
import type { TabScene } from '@/features/guitar-tab-3d/renderer/TabRenderer'
import type { Tab3DControls } from '@/features/guitar-tab-3d/ui/Tab3DHud'

export interface Guitar3DStageProps {
  source: GuitarPerformanceStageSource
  visibleBeatWindow: Accessor<number>
  showNoteLabels: Accessor<boolean>
  showFretboard: Accessor<boolean>
  isActive: Accessor<boolean>
  controls?: Tab3DControls
  display?: Accessor<TabScene['display']>
  showGizmo?: Accessor<boolean>
  ariaLabel?: Accessor<string>
  fallbackText?: Accessor<string>
  borderRadius?: Accessor<string>
  /** The instrument the notes sit on. Absent leaves the neck inferred. */
  tuning?: Accessor<{ stringCount: number; openMidi: readonly number[] }>
}

export function Guitar3DStage(props: Guitar3DStageProps) {
  return (
    <GuitarTab3DView
      fallingNotes={props.source.notes}
      playheadBeat={() => props.source.timeline.playheadBeat() ?? 0}
      visibleBeatWindow={props.visibleBeatWindow}
      showNoteLabels={props.showNoteLabels}
      showFretboard={props.showFretboard}
      isActive={props.isActive}
      controls={props.controls}
      display={props.display}
      showGizmo={props.showGizmo}
      ariaLabel={props.ariaLabel}
      fallbackText={props.fallbackText}
      borderRadius={props.borderRadius}
      tuning={props.tuning}
    />
  )
}
