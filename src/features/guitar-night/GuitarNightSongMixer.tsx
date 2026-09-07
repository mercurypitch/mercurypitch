// ============================================================
// Guitar Night song mixer — recorded stems in the shared track-mixer controls
// ============================================================

import { createMemo, For, Show } from 'solid-js'
import { formatGuitarTrackMixDb, GUITAR_TRACK_MIX_MAX_DB, GUITAR_TRACK_MIX_MIN_DB, } from '@/features/guitar/backing/guitar-track-mix'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import { GuitarNightLevelFader, GuitarNightMixerDialog, GuitarNightMixToggle, } from './GuitarNightMixControls'
import styles from './GuitarNightSongMixer.module.css'

interface GuitarNightSongMixerProps {
  title: string
  detail: string
  transport: Pick<
    GuitarBackingTransportController,
    | 'tracks'
    | 'soloedTrackId'
    | 'setTrackLevelDb'
    | 'setTrackMuted'
    | 'toggleTrackSolo'
    | 'resetTrackLevels'
  >
  isOpen: boolean
  onClose(): void
  onSeparateGuitar?(): void
}

export function GuitarNightSongMixer(props: GuitarNightSongMixerProps) {
  // Transport snapshots replace objects after every mix write. Key the DOM by
  // source ID so dragging a live fader cannot replace its own input element.
  const trackIds = createMemo(() =>
    props.transport.tracks().map((track) => track.id),
  )
  const soloedTrack = createMemo(() =>
    props.transport
      .tracks()
      .find((track) => track.id === props.transport.soloedTrackId()),
  )

  return (
    <GuitarNightMixerDialog
      isOpen={props.isOpen}
      title={props.title}
      kicker="Track mixer"
      label={`Track mixer for ${props.title}`}
      closeLabel="Close the track mixer"
      detail={props.detail}
      onClose={() => props.onClose()}
      testId="guitar-night-song-mixer"
      scrimTestId="guitar-night-song-mixer-scrim"
    >
      <div class={styles.mixHeading}>
        <p>Unity is 0 dB. Each track can be lifted by 6 dB.</p>
        <button
          type="button"
          disabled={trackIds().length === 0}
          onClick={() => props.transport.resetTrackLevels()}
        >
          Reset levels
        </button>
      </div>
      <div class={styles.tracks} role="group" aria-label="Recorded song tracks">
        <For
          each={trackIds()}
          fallback={
            <p class={styles.empty}>
              No recorded tracks are available for this song.
            </p>
          }
        >
          {(trackId) => {
            const track = () =>
              props.transport.tracks().find((item) => item.id === trackId)
            const label = () => track()?.label ?? trackId
            const available = () => track()?.available ?? false
            const muted = () => track()?.muted ?? false
            const soloed = () => props.transport.soloedTrackId() === trackId
            const masked = () => !muted() && (track()?.effectiveMuted ?? false)
            const level = () => track()?.levelDb ?? 0
            const belowRange = () =>
              Number.isFinite(level()) && level() <= GUITAR_TRACK_MIX_MIN_DB
            const levelText = () =>
              belowRange()
                ? `${Math.round(level() * 10) / 10} dB`
                : formatGuitarTrackMixDb(level())
            const rangeSuffix = () =>
              belowRange() ? ' · Below fader range' : ''
            const status = () => {
              if (!available()) return 'Unavailable'
              if (muted())
                return `${soloed() ? 'Muted · Solo selected' : 'Muted'}${rangeSuffix()}`
              if (masked())
                return `Quiet while ${soloedTrack()?.label ?? 'another track'} is soloed${rangeSuffix()}`
              if (level() === Number.NEGATIVE_INFINITY) return 'Fader is silent'
              if (belowRange())
                return `${soloed() ? 'Solo · ' : ''}Below fader range`
              return soloed() ? 'Solo' : 'In mix'
            }
            const muteTitle = () => {
              if (!available())
                return `${label()} has no playable audio available`
              if (muted()) return `Unmute ${label()}`
              if (masked())
                return `${label()} is quiet while ${soloedTrack()?.label ?? 'another track'} is soloed`
              return soloed()
                ? `Mute ${label()} and end Solo`
                : `Mute ${label()}`
            }
            return (
              <div
                class={styles.track}
                role="group"
                aria-label={`${label()} track`}
                data-testid="guitar-night-mixer-channel"
                data-track-id={trackId}
              >
                <div class={styles.identity}>
                  <strong title={label()}>{label()}</strong>
                  <small title={status()}>{status()}</small>
                </div>
                <GuitarNightMixToggle
                  kind="mute"
                  pressed={muted()}
                  masked={masked()}
                  label={`${muted() ? 'Unmute' : 'Mute'} ${label()}`}
                  title={muteTitle()}
                  disabled={!available()}
                  onToggle={() =>
                    props.transport.setTrackMuted(trackId, !muted())
                  }
                />
                <GuitarNightMixToggle
                  kind="solo"
                  pressed={soloed()}
                  label={
                    soloed()
                      ? `Turn off solo for ${label()}`
                      : `Solo ${label()}`
                  }
                  title={
                    !available()
                      ? `${label()} has no playable audio available`
                      : soloed()
                        ? 'Restore the full mix; mute choices are kept'
                        : muted()
                          ? `Solo ${label()}; unmute it to hear it`
                          : `Solo ${label()}`
                  }
                  disabled={!available()}
                  onToggle={() => props.transport.toggleTrackSolo(trackId)}
                />
                <GuitarNightLevelFader
                  label={`${label()} level`}
                  value={level()}
                  min={GUITAR_TRACK_MIX_MIN_DB}
                  max={GUITAR_TRACK_MIX_MAX_DB}
                  step={0.5}
                  valueText={levelText()}
                  ariaValueText={
                    belowRange()
                      ? `${levelText()} saved level, below the adjustable fader range. The fader is at its minimum.`
                      : levelText()
                  }
                  disabled={!available()}
                  masked={muted() || masked()}
                  testId="guitar-night-track-level"
                  trackId={trackId}
                  onInput={(value) =>
                    props.transport.setTrackLevelDb(trackId, value)
                  }
                />
              </div>
            )
          }}
        </For>
      </div>
      <Show when={props.onSeparateGuitar !== undefined}>
        <div class={styles.sourceAction}>
          <p>
            Create a separate guitar track for independent control. Runs on a
            cloud GPU and uses credits.
          </p>
          <button type="button" onClick={() => props.onSeparateGuitar?.()}>
            Separate guitar
          </button>
        </div>
      </Show>
    </GuitarNightMixerDialog>
  )
}
