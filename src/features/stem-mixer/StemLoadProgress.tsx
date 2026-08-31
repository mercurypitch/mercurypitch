// ============================================================
// StemLoadProgress — Honest byte-based stem loading progress bar
// ============================================================
//
// Shows a byte-based indeterminate or determinate progress bar with accurate
// phase labeling (connecting, downloading, decoding audio).
//

import { Show } from 'solid-js'
import type { StemLoadPhase } from '@/features/stem-mixer/useStemMixerAudioController'
import { formatBytes } from '@/lib/fetch-progress'

export const STEM_LOAD_PHASE_LABEL: Record<StemLoadPhase, string> = {
  connecting: 'Connecting',
  downloading: 'Downloading',
  decoding: 'Decoding audio',
}

export interface StemLoadProgressProps {
  pct: number
  phase: StemLoadPhase
  loadedBytes: number
  totalBytes: number | null
  songTitle?: string
}

/**
 * The stem download, shown honestly.
 *
 * Three things it deliberately does, all of them lessons from the version that
 * said "Loading stems... 0%" for two minutes on a television:
 *
 *  - The bar is **byte-based**, so it moves continuously instead of stepping
 *    0 / 50 / 100 as whole stems land.
 *  - When the server gave no size, the bar goes **indeterminate** rather than
 *    sitting at a number. A sliding stripe plus a climbing byte count says
 *    "working" without inventing a percentage.
 *  - `decodeAudioData` has no progress at all, so it gets its own phase label.
 *    A bar that parks at 100% while the device chews reads as a hang.
 */
export const StemLoadProgress = (props: StemLoadProgressProps) => {
  // Only the download has a measurable share. Connecting has no bytes yet and
  // decoding has no progress, so both run the indeterminate stripe.
  const determinate = (): boolean =>
    props.phase === 'downloading' && props.totalBytes !== null

  const detail = (): string => {
    if (props.phase === 'connecting') return 'Reaching the song library'
    if (props.phase === 'decoding') return 'Almost ready'
    if (props.totalBytes !== null) {
      return `${formatBytes(props.loadedBytes)} of ${formatBytes(props.totalBytes)}`
    }
    return formatBytes(props.loadedBytes)
  }

  return (
    <div class="sm-load">
      <div class="sm-load-head">
        <span class="sm-load-title">
          {props.songTitle !== undefined && props.songTitle !== ''
            ? props.songTitle
            : 'Loading stems'}
        </span>
        <Show when={determinate()}>
          <span class="sm-load-pct">{props.pct}%</span>
        </Show>
      </div>
      <div
        class="sm-load-track"
        classList={{ 'is-indeterminate': !determinate() }}
        role="progressbar"
        aria-label={`${STEM_LOAD_PHASE_LABEL[props.phase]} stems`}
        // An indeterminate progressbar is one with no aria-valuenow, which is
        // exactly the state we are in when the server sent no Content-Length.
        aria-valuemin={determinate() ? 0 : undefined}
        aria-valuemax={determinate() ? 100 : undefined}
        aria-valuenow={determinate() ? props.pct : undefined}
        aria-valuetext={detail()}
      >
        <div
          class="sm-load-fill"
          style={determinate() ? { width: `${props.pct}%` } : undefined}
        />
      </div>
      <div class="sm-load-meta">
        <span class="sm-load-phase">{STEM_LOAD_PHASE_LABEL[props.phase]}</span>
        <span class="sm-load-bytes">{detail()}</span>
      </div>
    </div>
  )
}
