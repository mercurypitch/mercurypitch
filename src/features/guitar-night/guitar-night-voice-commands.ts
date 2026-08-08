// ============================================================
// Guitar Night voice commands — the room's spoken transport
// ============================================================
//
// Registered by GuitarNightRoom for the room's lifetime, over the SAME
// GuitarBackingTransportController the room's own controls call. Seconds
// domain throughout. Track ids are stem kinds (vocal/drums/bass/...), so
// the shared stem vocabulary maps straight onto setTrackMuted. Phrases come
// from the shared families — what works in karaoke works on stage here.

import type { Accessor } from 'solid-js'
import { BACK_MINUTES_PHRASES, BACK_SECONDS_PHRASES, FORWARD_MINUTES_PHRASES, FORWARD_SECONDS_PHRASES, keyMatchesStemLabel, KNOWN_STEM_KEYS, MIDDLE_PHRASES, PAUSE_PHRASES, PLAY_PHRASES, RESTART_PHRASES, SEEK_START_PHRASES, SPEED_FASTER_PHRASES, SPEED_MULTIPLIER_PHRASES, SPEED_PRESETS, SPEED_SLOWER_PHRASES, SPEED_SPOKEN_PHRASES, stemDisplayName, stemSpokenNames, STOP_PHRASES, } from '@/features/voice-control/shared-phrases'
import type { VoiceCommand, VoiceCommandResult, } from '@/features/voice-control/types'
import { voiceFailure } from '@/features/voice-control/types'

export interface GuitarNightVoiceTrack {
  /** Stem kind doubling as the transport track id. */
  id: string
  muted: boolean
  available: boolean
}

export interface GuitarNightVoiceDeps {
  playing: Accessor<boolean>
  positionSeconds: Accessor<number>
  durationSeconds: Accessor<number>
  play: () => void
  pause: () => void
  stop: () => void
  seek: (seconds: number) => void
  playbackRate: Accessor<number>
  setPlaybackRate: (rate: number) => void
  tracks: () => GuitarNightVoiceTrack[]
  setTrackMuted: (id: string, muted: boolean) => void
}

const SPEED_STEPS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]

const formatSpeed = (multiplier: number): string =>
  `Speed ${String(multiplier)}x`

export function createGuitarNightVoiceCommands(
  deps: GuitarNightVoiceDeps,
): VoiceCommand[] {
  const clampSeconds = (seconds: number): number =>
    Math.min(Math.max(seconds, 0), Math.max(0, deps.durationSeconds()))

  const seekRelative = (deltaSeconds: number): string => {
    deps.seek(clampSeconds(deps.positionSeconds() + deltaSeconds))
    const magnitude = Math.abs(deltaSeconds)
    return `${deltaSeconds >= 0 ? 'Forward' : 'Back'} ${String(magnitude)}s`
  }

  const findTrack = (key: string): GuitarNightVoiceTrack | undefined =>
    deps.tracks().find((t) => t.available && keyMatchesStemLabel(key, t.id))

  const setMuted = (key: string, muted: boolean): VoiceCommandResult => {
    const track = findTrack(key)
    if (track === undefined) {
      return voiceFailure(`No ${key} stem in this session`)
    }
    if (track.muted === muted) {
      return voiceFailure(
        `${stemDisplayName(key)} already ${muted ? 'muted' : 'on'}`,
      )
    }
    deps.setTrackMuted(track.id, muted)
    return `${stemDisplayName(key)} ${muted ? 'muted' : 'on'}`
  }

  const setSpeedClamped = (multiplier: number): string => {
    const clamped = Math.min(Math.max(multiplier, 0.25), 2)
    deps.setPlaybackRate(clamped)
    return formatSpeed(clamped)
  }

  const stepSpeed = (direction: 1 | -1): string => {
    const current = deps.playbackRate()
    let nearest = 0
    let bestDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < SPEED_STEPS.length; i++) {
      const distance = Math.abs(SPEED_STEPS[i] - current)
      if (distance < bestDistance) {
        bestDistance = distance
        nearest = i
      }
    }
    return setSpeedClamped(
      SPEED_STEPS[
        Math.min(Math.max(nearest + direction, 0), SPEED_STEPS.length - 1)
      ],
    )
  }

  const commands: VoiceCommand[] = [
    {
      id: 'guitarNight.play',
      label: 'Play',
      phrases: PLAY_PHRASES,
      run: () => {
        if (deps.playing()) return voiceFailure('Already playing')
        deps.play()
        return 'Play'
      },
    },
    {
      id: 'guitarNight.pause',
      label: 'Pause',
      phrases: PAUSE_PHRASES,
      run: () => {
        if (!deps.playing()) return voiceFailure('Nothing playing')
        deps.pause()
        return 'Pause'
      },
    },
    {
      id: 'guitarNight.stop',
      label: 'Stop',
      phrases: STOP_PHRASES,
      run: () => {
        deps.stop()
        return 'Stop'
      },
    },
    {
      id: 'guitarNight.restart',
      label: 'From the top',
      phrases: RESTART_PHRASES,
      run: () => {
        deps.seek(0)
        if (!deps.playing()) deps.play()
        return 'From the top'
      },
    },
    {
      id: 'guitarNight.seekStart',
      label: 'Go to start',
      phrases: SEEK_START_PHRASES,
      run: () => {
        deps.seek(0)
        return 'Go to start'
      },
    },
    {
      id: 'guitarNight.forwardSeconds',
      label: 'Skip forward',
      phrases: FORWARD_SECONDS_PHRASES,
      run: (args) => seekRelative(args.n ?? 10),
    },
    {
      id: 'guitarNight.backSeconds',
      label: 'Skip back',
      phrases: BACK_SECONDS_PHRASES,
      run: (args) => seekRelative(-(args.n ?? 10)),
    },
    {
      id: 'guitarNight.forwardMinutes',
      label: 'Skip forward',
      phrases: FORWARD_MINUTES_PHRASES,
      run: (args) => seekRelative((args.n ?? 1) * 60),
    },
    {
      id: 'guitarNight.backMinutes',
      label: 'Skip back',
      phrases: BACK_MINUTES_PHRASES,
      run: (args) => seekRelative(-(args.n ?? 1) * 60),
    },
    {
      id: 'guitarNight.middle',
      label: 'Go to the middle',
      phrases: MIDDLE_PHRASES,
      run: () => {
        if (deps.durationSeconds() <= 0) return voiceFailure('Nothing loaded')
        deps.seek(deps.durationSeconds() / 2)
        return 'Go to the middle'
      },
    },
    {
      id: 'guitarNight.speedFaster',
      label: 'Faster',
      phrases: SPEED_FASTER_PHRASES,
      run: () => stepSpeed(1),
    },
    {
      id: 'guitarNight.speedSlower',
      label: 'Slower',
      phrases: SPEED_SLOWER_PHRASES,
      run: () => stepSpeed(-1),
    },
    ...SPEED_PRESETS.map(
      ([multiplier, phrases]): VoiceCommand => ({
        id: `guitarNight.speedPreset.${String(multiplier)}`,
        label: formatSpeed(multiplier),
        phrases,
        run: () => setSpeedClamped(multiplier),
      }),
    ),
    {
      id: 'guitarNight.speedMultiplier',
      label: 'Set speed',
      phrases: SPEED_MULTIPLIER_PHRASES,
      run: (args) =>
        args.n !== undefined && Number.isFinite(args.n) && args.n > 0
          ? setSpeedClamped(args.n)
          : voiceFailure('Speed unchanged'),
    },
    {
      id: 'guitarNight.speedSpoken',
      label: 'Set speed',
      phrases: SPEED_SPOKEN_PHRASES,
      run: (args) => {
        if (args.n === undefined || !Number.isFinite(args.n) || args.n <= 0) {
          return voiceFailure('Speed unchanged')
        }
        return setSpeedClamped(args.n > 2.5 ? args.n / 100 : args.n)
      },
    },
  ]

  for (const key of KNOWN_STEM_KEYS) {
    if (key === 'midi') continue
    const names = stemSpokenNames(key)
    const shown = stemDisplayName(key)
    commands.push(
      {
        id: `guitarNight.mute.${key}`,
        label: `Mute ${shown}`,
        phrases: names.flatMap((n) => [`mute ${n}`, `${n} off`]),
        run: () => setMuted(key, true),
      },
      {
        id: `guitarNight.unmute.${key}`,
        label: `Unmute ${shown}`,
        phrases: names.flatMap((n) => [`unmute ${n}`, `${n} on`]),
        run: () => setMuted(key, false),
      },
    )
  }

  return commands
}
