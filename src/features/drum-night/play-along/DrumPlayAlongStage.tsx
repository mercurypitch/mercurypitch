// ============================================================
// Drum Play-Along Stage — truthful prepared-audio room with six live strike surfaces
// ============================================================
//
// Prepared audio never implies a drum transcription. Pocket and Seat retain a
// playable kit, while Score names the missing authored source and its recovery.

import type { JSX } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import styles from './DrumPlayAlongStage.module.css'

export type DrumPlayAlongPreparedMixKind = 'separated' | 'two-stem'

export type DrumPlayAlongStageView = 'pocket' | 'seat' | 'score'

export type DrumPlayAlongPadId =
  | 'crash'
  | 'hi-hat'
  | 'snare'
  | 'tom'
  | 'ride'
  | 'kick'

export interface DrumPlayAlongReducedFidelity {
  readonly sampleRate: number
  readonly mono: boolean
}

export interface DrumPlayAlongStageProps {
  title: string
  mixKind: DrumPlayAlongPreparedMixKind
  view: DrumPlayAlongStageView
  positionSeconds?: number
  durationSeconds?: number | null
  isPlaying?: boolean
  isLoading?: boolean
  recentPadId?: DrumPlayAlongPadId | null
  /** Set when this device's decode budget forced a lower rate or a mono mix. */
  reducedFidelity?: DrumPlayAlongReducedFidelity | null
  /** Set when stems stream off storage in windows instead of a full decode. */
  windowedPlayback?: boolean
  strikeDisabled?: boolean
  onStrike?: (padId: DrumPlayAlongPadId, velocity: number) => void
  onOpenAuthoredScore?: () => void
}

interface PlayAlongPad {
  readonly id: DrumPlayAlongPadId
  readonly label: string
  readonly shortLabel: string
  readonly keyboardLabel: string
}

const PLAY_ALONG_PADS: readonly PlayAlongPad[] = [
  {
    id: 'crash',
    label: 'Crash cymbal',
    shortLabel: 'Crash',
    keyboardLabel: '3',
  },
  {
    id: 'hi-hat',
    label: 'Hi-hat',
    shortLabel: 'Hat',
    keyboardLabel: '1',
  },
  {
    id: 'snare',
    label: 'Snare drum',
    shortLabel: 'Snare',
    keyboardLabel: '2',
  },
  {
    id: 'tom',
    label: 'Tom',
    shortLabel: 'Tom',
    keyboardLabel: '4',
  },
  {
    id: 'ride',
    label: 'Ride cymbal',
    shortLabel: 'Ride',
    keyboardLabel: '5',
  },
  {
    id: 'kick',
    label: 'Kick drum',
    shortLabel: 'Kick',
    keyboardLabel: '6',
  },
]

function acceptsPadPointer(event: PointerEvent): boolean {
  return event.button === 0 && event.isPrimary !== false
}

function pointerVelocity(event: PointerEvent): number {
  const pressure = event.pressure > 0 ? event.pressure : 0.72
  return Math.round(48 + Math.min(1, pressure) * 79)
}

function formatClock(seconds: number): string {
  const bounded = Math.max(
    0,
    Math.floor(Number.isFinite(seconds) ? seconds : 0),
  )
  const minutes = Math.floor(bounded / 60)
  const remainder = bounded % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function sourceStatusLabel(kind: DrumPlayAlongPreparedMixKind): string {
  return kind === 'separated' ? 'Drums separated' : 'Drums in backing'
}

function reducedFidelityCopy(fidelity: DrumPlayAlongReducedFidelity): string {
  const kilohertz = Math.round(fidelity.sampleRate / 100) / 10
  return fidelity.mono
    ? `Decoded at ${kilohertz} kHz in mono to fit this device.`
    : `Decoded at ${kilohertz} kHz to fit this device.`
}

function sourceStatusCopy(kind: DrumPlayAlongPreparedMixKind): string {
  return kind === 'separated'
    ? 'Source Drums and Backing are independent audio.'
    : 'This session has vocal and instrumental audio only. The drums remain inside Backing.'
}

export function DrumPlayAlongStage(
  props: DrumPlayAlongStageProps,
): JSX.Element {
  const titleId = `drum-play-along-stage-${createUniqueId()}`
  const descriptionId = `drum-play-along-stage-description-${createUniqueId()}`
  const duration = (): number | null => {
    const value = props.durationSeconds
    return value === undefined || value === null || !Number.isFinite(value)
      ? null
      : Math.max(0, value)
  }

  return (
    <section
      class={styles.stage}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-view={props.view}
      data-mix-kind={props.mixKind}
      data-playing={props.isPlaying === true}
      data-testid="drum-play-along-stage"
    >
      <div class={styles.stageTopline}>
        <div class={styles.titleBlock}>
          <span class={styles.sourceLabel}>PREPARED AUDIO</span>
          <h2 id={titleId}>{props.title}</h2>
        </div>

        <div class={styles.transportReadout} aria-label="Backing position">
          <i aria-hidden="true" data-active={props.isPlaying === true} />
          <span>{formatClock(props.positionSeconds ?? 0)}</span>
          <Show when={duration() !== null}>
            <small>/ {formatClock(duration()!)}</small>
          </Show>
        </div>
      </div>

      <p id={descriptionId} class={styles.screenReaderOnly}>
        Prepared backing does not contain authored drum notation. Pocket and
        Seat keep six playable drum controls available.
      </p>

      <Show
        when={props.view !== 'score'}
        fallback={
          <div class={styles.scoreTruth} role="note">
            <span class={styles.emptyMark} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <div>
              <small>AUDIO ONLY</small>
              <h3>No drum score was created</h3>
              <p>
                Stem separation can isolate sound, but it does not author drum
                notation. Open MIDI or Guitar Pro to follow a score.
              </p>
              <Show when={props.onOpenAuthoredScore !== undefined}>
                <button
                  type="button"
                  onClick={() => props.onOpenAuthoredScore?.()}
                >
                  Open MIDI or Guitar Pro
                </button>
              </Show>
            </div>
          </div>
        }
      >
        <div
          class={styles.kitField}
          role="group"
          aria-label={`${props.view === 'seat' ? 'Seat' : 'Pocket'} playable drum kit`}
        >
          <div class={styles.kitAxis} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <For each={PLAY_ALONG_PADS}>
            {(pad) => (
              <button
                class={styles.strikePad}
                type="button"
                data-pad={pad.id}
                data-active={props.recentPadId === pad.id}
                disabled={props.strikeDisabled}
                aria-label={`Play ${pad.label}`}
                aria-keyshortcuts={pad.keyboardLabel}
                onPointerDown={(event) => {
                  if (!acceptsPadPointer(event)) return
                  props.onStrike?.(pad.id, pointerVelocity(event))
                }}
                onClick={(event) => {
                  if (event.detail === 0) props.onStrike?.(pad.id, 100)
                }}
              >
                <span>{pad.shortLabel}</span>
                <small>{pad.keyboardLabel}</small>
              </button>
            )}
          </For>

          <div class={styles.playHint} aria-hidden="true">
            <span>{props.view === 'seat' ? 'DRUMMER SEAT' : 'POCKET KIT'}</span>
            <small>Six live surfaces</small>
          </div>
        </div>
      </Show>

      <div class={styles.sourceTruth} role="status" aria-live="polite">
        <span class={styles.routeGlyph} aria-hidden="true">
          <i />
          <i />
        </span>
        <span>
          <strong>{sourceStatusLabel(props.mixKind)}</strong>
          <small>{sourceStatusCopy(props.mixKind)}</small>
          <Show when={props.reducedFidelity}>
            {(fidelity) => (
              <em class={styles.reducedFidelity}>
                {reducedFidelityCopy(fidelity())}
              </em>
            )}
          </Show>
          <Show when={props.windowedPlayback}>
            <em class={styles.reducedFidelity}>
              Streaming from storage in short windows, so even the longest songs
              fit this device at full quality.
            </em>
          </Show>
        </span>
        <Show when={props.isLoading}>
          <b>Loading audio</b>
        </Show>
      </div>
    </section>
  )
}
