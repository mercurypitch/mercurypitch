// ============================================================
// Guitar Night drum sound controls — compact next-play kit and feel picker
// ============================================================
//
// The controls persist lightweight identities only. Choosing a sampled kit is
// audio-inert; the room imports its player and requests bytes from Play.

import type { Accessor } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { GuitarRoomDrumPlaybackSnapshot } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarNightDrumFeelId, GuitarNightDrumKitId, } from './guitar-night-drum-sound'
import { GUITAR_NIGHT_DRUM_FEEL_OPTIONS, GUITAR_NIGHT_DRUM_KIT_OPTIONS, readGuitarNightDrumSound, writeGuitarNightDrumSound, } from './guitar-night-drum-sound'
import styles from './GuitarNightApp.module.css'

interface GuitarNightDrumSoundControlsProps {
  disabled?: boolean
  /** A live room keeps Kit available while Feel remains next-run scheduling. */
  liveKit?: boolean
  kitId?: Accessor<GuitarNightDrumKitId>
  feelId?: Accessor<GuitarNightDrumFeelId>
  playback?: Accessor<GuitarRoomDrumPlaybackSnapshot | null>
  onKitChange?(kitId: GuitarNightDrumKitId): void
  onFeelChange?(feelId: GuitarNightDrumFeelId): void
}

export function GuitarNightDrumSoundControls(
  props: GuitarNightDrumSoundControlsProps,
) {
  const initial = readGuitarNightDrumSound()
  const [localKitId, setLocalKitId] = createSignal(initial.kitId)
  const [localFeelId, setLocalFeelId] = createSignal(initial.feelId)
  const kitId = () => props.kitId?.() ?? localKitId()
  const feelId = () => props.feelId?.() ?? localFeelId()
  const readinessCopy = (): string => {
    const playback = props.playback?.()
    if (playback === undefined || playback === null) {
      return props.liveKit === true
        ? 'Kit changes live after audio starts. Feel starts on next Play. Sampled kits use Mercury fallback while warming.'
        : 'Applies on next Play. Sampled kits load only then.'
    }
    const routed = playback.routingCounts
    const routingNote =
      routed.sampled +
        routed.synthesized +
        routed.synthFallback +
        routed.unmapped +
        routed.dropped >
      0
        ? ` ${routed.sampled} sampled, ${routed.synthFallback} fallback, ${routed.unmapped} unmapped, ${routed.dropped} dropped routing decisions.${routed.synthesized > 0 ? ` ${routed.synthesized} synth-kit hits.` : ''}`
        : ''
    if (playback.status === 'error') {
      return `Sample preparation failed; Mercury fallback remains ready.${routingNote}`
    }
    if (playback.status === 'warming') {
      return `Kit warming; Mercury fallback is ready.${routingNote}`
    }
    if (playback.sampledReady) {
      const format = playback.selectedFormat?.toUpperCase()
      const coreCopy = `Sampled core ready${format === undefined ? '' : ` (${format})`}.`
      if (playback.sampleStatus === 'fallback') {
        return `${coreCopy} Some other kit articulations did not pass the sample quality check; Mercury Synth covers them.${routingNote}`
      }
      if (playback.sampleStatus === 'reduced') {
        return `${coreCopy} Other kit articulations have reduced sampled coverage; Mercury Synth covers unavailable sounds.${routingNote}`
      }
      return `${coreCopy}${routingNote}`
    }
    if (playback.sampleStatus === 'fallback') {
      return `Some kit articulations did not pass the sample quality check; Mercury Synth covers them.${routingNote}`
    }
    if (playback.sampleStatus === 'reduced') {
      return `Reduced sampled kit ready; Mercury fallback covers unavailable articulations.${routingNote}`
    }
    if (playback.status === 'ready' && playback.fallbackReady) {
      return playback.sampledPlayerCount > 0
        ? `Sampled kit active; unavailable articulations use Mercury fallback.${routingNote}`
        : `Synth kit ready.${routingNote}`
    }
    return `Kit activates on Play.${routingNote}`
  }

  const persist = (
    nextKitId: typeof initial.kitId,
    nextFeelId: typeof initial.feelId,
  ): void => {
    setLocalKitId(nextKitId)
    setLocalFeelId(nextFeelId)
    writeGuitarNightDrumSound({ kitId: nextKitId, feelId: nextFeelId })
  }

  return (
    <fieldset
      class={styles.drumSoundControls}
      data-testid="guitar-night-drum-sound-controls"
      disabled={props.disabled}
    >
      <legend>Drum sound</legend>
      <label>
        <span>Kit</span>
        <select
          aria-label="Guitar Night drum kit"
          value={kitId()}
          onChange={(event) => {
            const nextKitId = event.currentTarget.value as GuitarNightDrumKitId
            persist(nextKitId, feelId())
            props.onKitChange?.(nextKitId)
          }}
        >
          <For each={GUITAR_NIGHT_DRUM_KIT_OPTIONS}>
            {(option) => <option value={option.id}>{option.label}</option>}
          </For>
        </select>
      </label>
      <label>
        <span>Feel</span>
        <select
          aria-label="Guitar Night generated drum feel"
          value={feelId()}
          onChange={(event) => {
            const nextFeelId = event.currentTarget
              .value as GuitarNightDrumFeelId
            persist(kitId(), nextFeelId)
            props.onFeelChange?.(nextFeelId)
          }}
        >
          <For each={GUITAR_NIGHT_DRUM_FEEL_OPTIONS}>
            {(option) => <option value={option.id}>{option.label}</option>}
          </For>
        </select>
      </label>
      <small>{readinessCopy()}</small>
      <Show when={kitId() === 'muldjord' || kitId() === 'crocell'}>
        <small>
          {kitId() === 'muldjord'
            ? 'Expanded acoustic kit. Pedal hi-hat and unsupported articulations use Mercury fallback.'
            : 'Expanded acoustic kit with pedal hi-hat, rim, bell, china and splash. Unsupported percussion uses Mercury fallback.'}{' '}
          <a
            href={`/drum-night/kits/${kitId()}/LICENSE.md`}
            target="_blank"
            rel="noreferrer"
          >
            Credits and sample licence (CC BY 4.0)
          </a>
        </small>
      </Show>
    </fieldset>
  )
}
