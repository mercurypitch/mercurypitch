// SpeedChip shows the playback speed ("1x") and opens the list of speeds.
// ============================================================
//
// A chip in the rail's capsule, not a native select: a select drew the
// operating system's menu, wider than the rail and in the wrong palette,
// and it took Space and the letter keys while focused. The list is an
// OverflowMenu of radio rows, so it opens, closes and steps by the same
// rule as every menu in the app. Space still plays and pauses while the
// chip has focus; Enter or the arrow keys open it.
//
// The chip has a fixed width, so the rail does not shift when the speed
// changes, and takes the accent while the song is not at 1x.

import type { Component } from 'solid-js'
import { CheckSmall, ChevronDown } from '@/components/icons'
import { OverflowMenu } from '@/components/OverflowMenu'
import { formatPlaybackSpeed, STEM_MIXER_PLAYBACK_SPEEDS, } from '@/lib/playback-speed-options'
import styles from './SpeedChip.module.css'

export interface SpeedChipProps {
  speed: number
  onSpeedChange: (speed: number) => void
}

export const SpeedChip: Component<SpeedChipProps> = (props) => (
  <OverflowMenu
    label={`Playback speed ${formatPlaybackSpeed(props.speed)}`}
    testId="speed-chip"
    triggerClass={`${styles.chip} ${props.speed === 1 ? '' : styles.changed}`}
    panelClass={`${styles.panel} mp-dark-stage`}
    triggerContent={
      <>
        <span class={styles.value}>{formatPlaybackSpeed(props.speed)}</span>
        <ChevronDown size={12} />
      </>
    }
    items={STEM_MIXER_PLAYBACK_SPEEDS.map((speed) => ({
      key: `speed-${speed}`,
      label: formatPlaybackSpeed(speed),
      checked: speed === props.speed,
      // The row the song is playing at carries the tick.
      icon: () => (speed === props.speed ? <CheckSmall size={16} /> : null),
      onSelect: () => props.onSpeedChange(speed),
    }))}
  />
)
