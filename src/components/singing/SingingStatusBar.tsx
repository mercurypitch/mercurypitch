// ============================================================
// SingingStatusBar — the singing page's slim glass strip along
// the canvas top: scale + melody + tempo + bar.beat position on
// the left, import actions on the right. Shares the visual
// language (and stylesheet) of the Piano/Guitar song status bars.
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import barStyles from '@/components/shared/status-bar/SongStatusBar.module.css'
import { useControlDockOffset } from '@/components/shared/status-bar/use-control-dock-offset'

interface SingingStatusBarProps {
  keyName: () => string
  scaleType: () => string
  melodyName: () => string | null
  bpm: () => number
  currentBeat: () => number
  /** Live singing-playback signal (the controller's, not the dead store one). */
  isPlaying: () => boolean
  onImportMidi: () => void
}

const titleCase = (s: string): string =>
  s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// 0-based float beat → 1-based "bar.beat" (4/4), like Guitar 3D's Tab3DHud.
const barBeat = (b: number): string => {
  const beat = Math.max(0, b)
  return `${Math.floor(beat / 4) + 1}.${Math.floor(beat % 4) + 1}`
}

export const SingingStatusBar: Component<SingingStatusBarProps> = (props) => {
  const scaleLabel = () => `${props.keyName()} ${titleCase(props.scaleType())}`
  let barEl: HTMLDivElement | undefined
  // Height is dynamic (wrap on narrow screens) — keep the container's
  // top-docked control bar measured clear of it.
  useControlDockOffset(() => barEl)
  return (
    <div
      ref={barEl}
      class={barStyles.bar}
      classList={{ [barStyles.dimmed]: props.isPlaying() }}
      data-testid="singing-status-bar"
    >
      <div class={barStyles.info} title={scaleLabel()}>
        <span>{scaleLabel()}</span>
        <Show when={props.melodyName()}>
          {(name) => (
            <>
              <span class={barStyles.infoDot}>·</span>
              <span class={barStyles.infoSecondary} title={name()}>
                {name()}
              </span>
            </>
          )}
        </Show>
      </div>
      <div class={barStyles.infoMeta}>
        <span>{props.bpm()} BPM</span>
        <span class={barStyles.infoDot}>·</span>
        <span class={barStyles.infoPos}>{barBeat(props.currentBeat())}</span>
      </div>
      <div class={barStyles.actions}>
        <button
          class={barStyles.chipBtn}
          onClick={() => props.onImportMidi()}
          title="Import a MIDI melody (or drop a .mid file on the canvas)"
        >
          Import MIDI
        </button>
      </div>
    </div>
  )
}
