// ============================================================
// Drum Play-Along Mixer — source-labelled buses with honest separation limits
// ============================================================
//
// This controlled surface changes no audio itself. The host owns every bus,
// track, preset and live-input write, keeping one source of audible truth.

import type { JSX } from 'solid-js'
import { createMemo, createUniqueId, Index, Show } from 'solid-js'
import styles from './DrumPlayAlongMixer.module.css'

export type DrumPlayAlongSourceKind =
  | 'separated-audio'
  | 'two-stem-audio'
  | 'authored-arrangement'

export type DrumPlayAlongMixPreset = 'full' | 'drum-focus' | 'play-along'

export type DrumPlayAlongBusId = 'drums' | 'backing' | 'you' | 'click'

export interface DrumPlayAlongMixChannel {
  level: number
  muted: boolean
  disabled?: boolean
  detail?: string
}

export interface DrumPlayAlongMixTrack extends DrumPlayAlongMixChannel {
  id: string
  label: string
  bus: 'drums' | 'backing'
}

export interface DrumPlayAlongMixerProps {
  sourceKind: DrumPlayAlongSourceKind
  activePreset: DrumPlayAlongMixPreset
  drums: DrumPlayAlongMixChannel
  backing: DrumPlayAlongMixChannel
  you: DrumPlayAlongMixChannel
  click: DrumPlayAlongMixChannel
  tracks: readonly DrumPlayAlongMixTrack[]
  drumsAccessory?: JSX.Element
  onPresetChange: (preset: DrumPlayAlongMixPreset) => void
  onBusLevelChange: (busId: DrumPlayAlongBusId, level: number) => void
  onBusMuteChange: (busId: DrumPlayAlongBusId, muted: boolean) => void
  onTrackLevelChange: (trackId: string, level: number) => void
  onTrackMuteChange: (trackId: string, muted: boolean) => void
}

interface PresetOption {
  readonly id: DrumPlayAlongMixPreset
  readonly label: string
  readonly detail: string
}

interface ChannelStripProps {
  id: DrumPlayAlongBusId
  label: string
  sourceLabel: string
  channel: DrumPlayAlongMixChannel
  unavailable?: boolean
  onLevelChange: (busId: DrumPlayAlongBusId, level: number) => void
  onMuteChange: (busId: DrumPlayAlongBusId, muted: boolean) => void
}

interface TrackStripProps {
  track: DrumPlayAlongMixTrack
  onLevelChange: (trackId: string, level: number) => void
  onMuteChange: (trackId: string, muted: boolean) => void
}

const PRESETS: readonly PresetOption[] = [
  { id: 'full', label: 'Full mix', detail: 'All source buses' },
  { id: 'drum-focus', label: 'Drum focus', detail: 'Bring drums forward' },
  { id: 'play-along', label: 'Play along', detail: 'Take source drums out' },
]

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 0
  return Math.min(1, Math.max(0, level))
}

function levelPercent(level: number): number {
  return Math.round(clampLevel(level) * 100)
}

function sourceHeading(kind: DrumPlayAlongSourceKind): string {
  if (kind === 'separated-audio') return 'Separated source audio'
  if (kind === 'two-stem-audio') return 'Two-stem source audio'
  return 'Authored arrangement'
}

function sourceCopy(kind: DrumPlayAlongSourceKind): string {
  if (kind === 'separated-audio') {
    return 'Source Drums and Backing can be shaped independently.'
  }
  if (kind === 'two-stem-audio') {
    return 'Drums remain inside Backing. Separate drums to unlock drum presets and controls.'
  }
  return 'Source Drums use the authored drum part. Backing tracks are timing and pitch guides.'
}

function ChannelStrip(props: ChannelStripProps): JSX.Element {
  const disabled = (): boolean =>
    props.unavailable === true || props.channel.disabled === true
  const detail = (): string => {
    if (props.unavailable === true) return 'Inside Backing'
    return props.channel.detail ?? 'Bus level'
  }

  return (
    <div
      class={styles.channelStrip}
      data-channel={props.id}
      data-unavailable={props.unavailable === true}
    >
      <div class={styles.channelIdentity}>
        <small>{props.sourceLabel}</small>
        <strong>{props.label}</strong>
        <span>{detail()}</span>
      </div>

      <label class={styles.levelControl}>
        <span class={styles.screenReaderOnly}>{props.label} level</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={levelPercent(props.channel.level)}
          disabled={disabled()}
          aria-label={`${props.label} level`}
          onInput={(event) =>
            props.onLevelChange(
              props.id,
              Number(event.currentTarget.value) / 100,
            )
          }
        />
        <output>
          {disabled() ? 'Unavailable' : `${levelPercent(props.channel.level)}%`}
        </output>
      </label>

      <button
        type="button"
        class={styles.muteButton}
        disabled={disabled()}
        aria-label={`${props.channel.muted ? 'Unmute' : 'Mute'} ${props.label}`}
        aria-pressed={props.channel.muted}
        onClick={() => props.onMuteChange(props.id, !props.channel.muted)}
      >
        <i aria-hidden="true" />
        {props.channel.muted ? 'Muted' : 'On'}
      </button>
    </div>
  )
}

function TrackStrip(props: TrackStripProps): JSX.Element {
  const disabled = (): boolean => props.track.disabled === true
  return (
    <div class={styles.trackStrip} data-track-id={props.track.id}>
      <span class={styles.trackIdentity}>
        <strong>{props.track.label}</strong>
        <small>{props.track.detail ?? 'Source track'}</small>
      </span>
      <label>
        <span class={styles.screenReaderOnly}>{props.track.label} level</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={levelPercent(props.track.level)}
          disabled={disabled()}
          aria-label={`${props.track.label} level`}
          onInput={(event) =>
            props.onLevelChange(
              props.track.id,
              Number(event.currentTarget.value) / 100,
            )
          }
        />
      </label>
      <output>{levelPercent(props.track.level)}%</output>
      <button
        type="button"
        disabled={disabled()}
        aria-label={`${props.track.muted ? 'Unmute' : 'Mute'} ${props.track.label}`}
        aria-pressed={props.track.muted}
        onClick={() => props.onMuteChange(props.track.id, !props.track.muted)}
      >
        {props.track.muted ? 'Muted' : 'On'}
      </button>
    </div>
  )
}

export function DrumPlayAlongMixer(
  props: DrumPlayAlongMixerProps,
): JSX.Element {
  const titleId = `drum-play-along-mixer-${createUniqueId()}`
  const drumsUnavailable = (): boolean => props.sourceKind === 'two-stem-audio'
  const drumTracks = createMemo(() =>
    props.tracks.filter((track) => track.bus === 'drums'),
  )
  const backingTracks = createMemo(() =>
    props.tracks.filter((track) => track.bus === 'backing'),
  )

  return (
    <section
      class={styles.mixer}
      aria-labelledby={titleId}
      data-source-kind={props.sourceKind}
      data-testid="drum-play-along-mixer"
    >
      <div class={styles.mixerHeading}>
        <div>
          <span>MIX</span>
          <h2 id={titleId}>Play-along balance</h2>
        </div>
        <p>
          <strong>{sourceHeading(props.sourceKind)}</strong>
          <small>{sourceCopy(props.sourceKind)}</small>
        </p>
      </div>

      <div class={styles.presetRail} role="group" aria-label="Mix presets">
        <Index each={PRESETS}>
          {(preset) => {
            const disabled = (): boolean =>
              drumsUnavailable() && preset().id !== 'full'
            return (
              <button
                type="button"
                data-preset={preset().id}
                disabled={disabled()}
                aria-pressed={props.activePreset === preset().id}
                title={
                  disabled()
                    ? 'Separate drums to use this preset'
                    : preset().detail
                }
                onClick={() => props.onPresetChange(preset().id)}
              >
                <i aria-hidden="true" />
                <span>
                  <strong>{preset().label}</strong>
                  <small>{preset().detail}</small>
                </span>
              </button>
            )
          }}
        </Index>
      </div>

      <div class={styles.signalConsole}>
        <div class={styles.consoleLabel}>
          <span>SOURCE</span>
          <small>What the song contributes</small>
        </div>

        <div class={styles.busSection} data-bus-section="drums">
          <ChannelStrip
            id="drums"
            label="Source Drums"
            sourceLabel="SONG"
            channel={props.drums}
            unavailable={drumsUnavailable()}
            onLevelChange={props.onBusLevelChange}
            onMuteChange={props.onBusMuteChange}
          />
          <Show when={!drumsUnavailable() && props.drumsAccessory}>
            <div class={styles.drumsAccessory}>{props.drumsAccessory}</div>
          </Show>
          <Show when={!drumsUnavailable() && drumTracks().length > 0}>
            <div class={styles.trackList} aria-label="Source drum tracks">
              <Index each={drumTracks()}>
                {(track) => (
                  <TrackStrip
                    track={track()}
                    onLevelChange={props.onTrackLevelChange}
                    onMuteChange={props.onTrackMuteChange}
                  />
                )}
              </Index>
            </div>
          </Show>
        </div>

        <div class={styles.busSection} data-bus-section="backing">
          <ChannelStrip
            id="backing"
            label="Backing"
            sourceLabel="SONG"
            channel={props.backing}
            onLevelChange={props.onBusLevelChange}
            onMuteChange={props.onBusMuteChange}
          />
          <Show
            when={backingTracks().length > 0}
            fallback={
              <p class={styles.noTracks}>
                Bus only · This source has no individual backing-track controls.
              </p>
            }
          >
            <div class={styles.trackList} aria-label="Backing tracks">
              <Index each={backingTracks()}>
                {(track) => (
                  <TrackStrip
                    track={track()}
                    onLevelChange={props.onTrackLevelChange}
                    onMuteChange={props.onTrackMuteChange}
                  />
                )}
              </Index>
            </div>
          </Show>
        </div>
      </div>

      <div class={styles.performerConsole}>
        <div class={styles.consoleLabel}>
          <span>PERFORMER</span>
          <small>Independent of the source mix</small>
        </div>
        <div class={styles.performerChannels}>
          <ChannelStrip
            id="you"
            label="You"
            sourceLabel="LIVE"
            channel={props.you}
            onLevelChange={props.onBusLevelChange}
            onMuteChange={props.onBusMuteChange}
          />
          <ChannelStrip
            id="click"
            label="Click"
            sourceLabel="GUIDE"
            channel={props.click}
            onLevelChange={props.onBusLevelChange}
            onMuteChange={props.onBusMuteChange}
          />
        </div>
      </div>
    </section>
  )
}
