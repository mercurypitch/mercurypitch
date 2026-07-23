import type { Accessor, Component } from 'solid-js'
import { WaveformBars } from '@/components/icons'
import { SheetViewToggle } from '@/components/SheetViewToggle'
import styles from './PracticeViewToolbar.module.css'

interface PracticeViewToolbarProps {
  context: string
  sheetActive: Accessor<boolean>
  onViewChange: (sheet: boolean) => void
}

export const PracticeViewToolbar: Component<PracticeViewToolbarProps> = (
  props,
) => (
  <div class={styles.toolbar} data-testid="practice-view-toolbar">
    <div class={styles.identity}>
      <span class={styles.icon} aria-hidden="true">
        <WaveformBars size={16} />
      </span>
      <span class={styles.copy}>
        <span class={styles.eyebrow}>{props.context}</span>
        <span class={styles.description} aria-live="polite">
          {props.sheetActive()
            ? 'Readable score, synced to the playhead'
            : 'Live pitch lanes and timing feedback'}
        </span>
      </span>
    </div>
    <SheetViewToggle active={props.sheetActive} onToggle={props.onViewChange} />
  </div>
)
