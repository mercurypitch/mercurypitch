// ============================================================
// StemMixer voice commands — the karaoke tab's own spoken set
// ============================================================
//
// Registered by StemMixer for exactly its mount lifetime, which ends the
// global transport set's "not available on this view" era on Karaoke: these
// commands close over the mixer's OWN handlers (the same ones its buttons
// call), so voice can only do what a click already can. Stem commands are
// generated for every known stem name AND every live track label — a stem
// the session does not have answers with "No <stem> in this mix" instead of
// pretending the phrase does not exist. The transport here runs on SECONDS
// (audio time), unlike the beat-based global transport.

import type { Accessor } from 'solid-js'
import { ABSOLUTE_MINUTES_PHRASES, ABSOLUTE_SECONDS_PHRASES, BACK_MINUTES_PHRASES, BACK_SECONDS_PHRASES, END_PHRASES, FORWARD_MINUTES_PHRASES, FORWARD_SECONDS_PHRASES, LOOP_CLEAR_PHRASES, LOOP_OFF_PHRASES, LOOP_ON_PHRASES, LOOP_RANGE_PHRASES, LOOP_SET_A_PHRASES, LOOP_SET_B_PHRASES, LOOP_TOGGLE_PHRASES, MIDDLE_PHRASES, PAUSE_PHRASES, PLAY_PHRASES, RESTART_PHRASES, SEEK_START_PHRASES, SPEED_FASTER_PHRASES, SPEED_MULTIPLIER_PHRASES, SPEED_PRESETS, SPEED_SLOWER_PHRASES, SPEED_SPOKEN_PHRASES, STOP_PHRASES, } from '@/features/voice-control/shared-phrases'
import type { VoiceCommand, VoiceCommandResult, } from '@/features/voice-control/types'
import { voiceFailure } from '@/features/voice-control/types'

export interface StemMixerVoiceTrack {
  label: string
  muted: boolean
  soloed: boolean
  volume: number
}

export interface StemMixerVoiceDeps {
  playing: Accessor<boolean>
  /** Seconds domain — the mixer transport runs on audio time, not beats. */
  elapsed: Accessor<number>
  duration: Accessor<number>
  play: () => void
  pause: () => void
  stop: () => void
  seekToTime: (seconds: number) => void
  tracks: () => StemMixerVoiceTrack[]
  toggleMute: (label: string) => void
  toggleSolo: (label: string) => void
  /** Volume is the mixer's 0..1 slider value. */
  setTrackVolume: (label: string, volume: number) => void
  /** Gate for the whole set (e.g. "only while the Karaoke tab is active");
   *  heard-elsewhere phrases then report "not available on this view". */
  available?: Accessor<boolean>
  /** Playback rate, 1 = normal. */
  speed: Accessor<number>
  setSpeed: (multiplier: number) => void
  /** The mixer's own A-B loop, in seconds. */
  loop: {
    enabled: Accessor<boolean>
    setEnabled: (on: boolean) => void
    start: Accessor<number>
    setStart: (seconds: number) => void
    end: Accessor<number>
    setEnd: (seconds: number) => void
    clear: () => void
  }
  playlist: {
    active: Accessor<boolean>
    next: () => void
    prev: () => void
    /** Jump to a random queue entry; false when there is nothing to jump to. */
    random: () => boolean
  }
  /** The "Songs" rail — the songs-and-playlists sidebar. */
  songsSidebar: {
    isOpen: Accessor<boolean>
    open: () => void
    close: () => void
  }
}

// ── Stem naming ────────────────────────────────────────────────

/** Spoken aliases per canonical stem key (lowercased track label). */
const STEM_ALIASES: Record<string, string[]> = {
  vocal: ['vocals', 'voice', 'the vocals', 'singing'],
  // "bass" reaches the recognizer as "base" more often than not, and
  // "bass guitar" as "base guitar" or even "based guitar".
  bass: [
    'the bass',
    'base',
    'the base',
    'bass guitar',
    'base guitar',
    'based guitar',
  ],
  instrumental: [
    'instrumentals',
    'the instrumental',
    'music',
    'backing',
    'backing track',
    'the band',
  ],
  midi: ['the midi', 'guide', 'melody guide'],
  drums: ['the drums', 'drum', 'percussion'],
  guitar: ['the guitar', 'guitars'],
  piano: ['the piano', 'keys', 'keyboard'],
  other: ['the rest', 'everything else'],
}

/** Stems that get commands even when the session lacks them, so "mute
 *  drums" with no drum stem explains itself instead of reading as noise. */
const KNOWN_STEM_KEYS = Object.keys(STEM_ALIASES)

const keyMatchesLabel = (key: string, label: string): boolean => {
  const l = label.toLowerCase()
  return l === key || l === `${key}s` || `${l}s` === key
}

const displayName = (key: string): string =>
  key.charAt(0).toUpperCase() + key.slice(1)

const VOLUME_STEP = 0.1

/** Same ladder the global transport's speed steps climb. */
const SPEED_STEPS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]

const formatSpeed = (multiplier: number): string =>
  `Speed ${String(multiplier)}x`

export function createStemMixerVoiceCommands(
  deps: StemMixerVoiceDeps,
): VoiceCommand[] {
  const findTrack = (key: string): StemMixerVoiceTrack | undefined =>
    deps.tracks().find((t) => keyMatchesLabel(key, t.label))

  const missing = (key: string): VoiceCommandResult =>
    voiceFailure(`No ${key} stem in this mix`)

  // ── Transport (seconds domain) ─────────────────────────────

  const clampSeconds = (seconds: number): number =>
    Math.min(Math.max(seconds, 0), Math.max(0, deps.duration()))

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const rest = Math.round(seconds % 60)
    return minutes > 0
      ? `${String(minutes)}:${String(rest).padStart(2, '0')}`
      : `${String(rest)}s`
  }

  const seekRelative = (deltaSeconds: number): string => {
    deps.seekToTime(clampSeconds(deps.elapsed() + deltaSeconds))
    const magnitude = Math.abs(deltaSeconds)
    return `${deltaSeconds >= 0 ? 'Forward' : 'Back'} ${String(magnitude)}s`
  }

  const seekAbsolute = (seconds: number): VoiceCommandResult => {
    if (deps.duration() <= 0) return voiceFailure('Nothing loaded')
    deps.seekToTime(clampSeconds(seconds))
    return `Go to ${formatTime(seconds)}`
  }

  // ── Stem mixing ────────────────────────────────────────────

  const setMuted = (key: string, muted: boolean): VoiceCommandResult => {
    const track = findTrack(key)
    if (track === undefined) return missing(key)
    if (track.muted === muted) {
      return voiceFailure(`${track.label} already ${muted ? 'muted' : 'on'}`)
    }
    deps.toggleMute(track.label)
    return `${track.label} ${muted ? 'muted' : 'on'}`
  }

  const setSoloed = (key: string, soloed: boolean): VoiceCommandResult => {
    const track = findTrack(key)
    if (track === undefined) return missing(key)
    if (track.soloed === soloed) {
      return voiceFailure(
        soloed ? `${track.label} already solo` : `${track.label} not solo`,
      )
    }
    deps.toggleSolo(track.label)
    return soloed ? `Solo ${track.label}` : `${track.label} solo off`
  }

  const nudgeVolume = (key: string, direction: 1 | -1): VoiceCommandResult => {
    const track = findTrack(key)
    if (track === undefined) return missing(key)
    const volume = Math.min(
      Math.max(track.volume + direction * VOLUME_STEP, 0),
      1,
    )
    deps.setTrackVolume(track.label, volume)
    return `${track.label} ${String(Math.round(volume * 100))}%`
  }

  const setVolumePercent = (
    key: string,
    percent: number | undefined,
  ): VoiceCommandResult => {
    const track = findTrack(key)
    if (track === undefined) return missing(key)
    if (percent === undefined || !Number.isFinite(percent) || percent < 0) {
      return voiceFailure('Volume unchanged')
    }
    const volume = Math.min(Math.max(percent / 100, 0), 1)
    deps.setTrackVolume(track.label, volume)
    return `${track.label} ${String(Math.round(volume * 100))}%`
  }

  /** Everything except the MIDI guide participates in role presets. */
  const presetTracks = (): StemMixerVoiceTrack[] =>
    deps.tracks().filter((t) => !keyMatchesLabel('midi', t.label))

  const applyRolePreset = (mutedKey: string | null): VoiceCommandResult => {
    let target: StemMixerVoiceTrack | undefined
    if (mutedKey !== null) {
      target = findTrack(mutedKey)
      if (target === undefined) return missing(mutedKey)
    }
    for (const track of presetTracks()) {
      const shouldMute = target !== undefined && track.label === target.label
      if (track.muted !== shouldMute) deps.toggleMute(track.label)
      if (track.soloed) deps.toggleSolo(track.label)
    }
    return target !== undefined
      ? `${target.label} muted, everything else on`
      : 'Full mix'
  }

  const clearSolos = (): string => {
    for (const track of deps.tracks()) {
      if (track.soloed) deps.toggleSolo(track.label)
    }
    return 'Solo off'
  }

  // ── Speed and loop (mixer-owned, seconds domain) ───────────

  const setSpeedClamped = (multiplier: number): string => {
    const clamped = Math.min(Math.max(multiplier, 0.25), 2)
    deps.setSpeed(clamped)
    return formatSpeed(clamped)
  }

  const stepSpeed = (direction: 1 | -1): string => {
    const current = deps.speed()
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

  const setLoopRange = (
    from: number | undefined,
    to: number | undefined,
  ): VoiceCommandResult => {
    if (
      from === undefined ||
      to === undefined ||
      !Number.isFinite(from) ||
      !Number.isFinite(to)
    ) {
      return voiceFailure('Say loop from A to B seconds')
    }
    if (to <= from) return voiceFailure('Loop end must be after its start')
    deps.loop.setStart(clampSeconds(from))
    deps.loop.setEnd(clampSeconds(to))
    deps.loop.setEnabled(true)
    deps.seekToTime(clampSeconds(from))
    if (!deps.playing()) deps.play()
    return `Loop ${String(from)}s to ${String(to)}s`
  }

  // ── The set ────────────────────────────────────────────────

  const commands: VoiceCommand[] = [
    {
      id: 'karaoke.play',
      label: 'Play',
      phrases: PLAY_PHRASES,
      run: () => {
        if (deps.playing()) return voiceFailure('Already playing')
        deps.play()
        return 'Play'
      },
    },
    {
      id: 'karaoke.pause',
      label: 'Pause',
      phrases: PAUSE_PHRASES,
      run: () => {
        if (!deps.playing()) return voiceFailure('Nothing playing')
        deps.pause()
        return 'Pause'
      },
    },
    {
      id: 'karaoke.stop',
      label: 'Stop',
      phrases: STOP_PHRASES,
      run: () => {
        deps.stop()
        return 'Stop'
      },
    },
    {
      id: 'karaoke.restart',
      label: 'From the top',
      phrases: [...RESTART_PHRASES, 'sing that again', 'sing it again'],
      run: () => {
        deps.seekToTime(0)
        if (!deps.playing()) deps.play()
        return 'From the top'
      },
    },
    {
      id: 'karaoke.seekStart',
      label: 'Go to start',
      phrases: SEEK_START_PHRASES,
      run: () => {
        deps.seekToTime(0)
        return 'Go to start'
      },
    },
    {
      id: 'karaoke.forwardSeconds',
      label: 'Skip forward',
      phrases: FORWARD_SECONDS_PHRASES,
      run: (args) => seekRelative(args.n ?? 10),
    },
    {
      id: 'karaoke.backSeconds',
      label: 'Skip back',
      phrases: BACK_SECONDS_PHRASES,
      run: (args) => seekRelative(-(args.n ?? 10)),
    },
    {
      id: 'karaoke.forwardMinutes',
      label: 'Skip forward',
      phrases: FORWARD_MINUTES_PHRASES,
      run: (args) => seekRelative((args.n ?? 1) * 60),
    },
    {
      id: 'karaoke.backMinutes',
      label: 'Skip back',
      phrases: BACK_MINUTES_PHRASES,
      run: (args) => seekRelative(-(args.n ?? 1) * 60),
    },
    {
      id: 'karaoke.absoluteSeconds',
      label: 'Go to time',
      phrases: ABSOLUTE_SECONDS_PHRASES,
      run: (args) => seekAbsolute(args.n ?? 0),
    },
    {
      id: 'karaoke.absoluteMinutes',
      label: 'Go to time',
      phrases: ABSOLUTE_MINUTES_PHRASES,
      run: (args) => seekAbsolute((args.n ?? 0) * 60),
    },
    {
      id: 'karaoke.middle',
      label: 'Go to the middle',
      phrases: MIDDLE_PHRASES,
      run: () => {
        if (deps.duration() <= 0) return voiceFailure('Nothing loaded')
        deps.seekToTime(deps.duration() / 2)
        return 'Go to the middle'
      },
    },
    {
      id: 'karaoke.end',
      label: 'Go to the end',
      phrases: END_PHRASES,
      run: () => {
        if (deps.duration() <= 0) return voiceFailure('Nothing loaded')
        deps.seekToTime(clampSeconds(deps.duration() - 2))
        return 'Go to the end'
      },
    },
    {
      id: 'karaoke.nextSong',
      label: 'Next song',
      phrases: ['next song', 'next track', 'skip this song', 'next'],
      run: () => {
        if (!deps.playlist.active()) return voiceFailure('No playlist running')
        deps.playlist.next()
        return 'Next song'
      },
    },
    {
      id: 'karaoke.previousSong',
      label: 'Previous song',
      phrases: [
        'previous song',
        'previous track',
        'last song',
        'go back a song',
        'previous',
      ],
      run: () => {
        if (!deps.playlist.active()) return voiceFailure('No playlist running')
        deps.playlist.prev()
        return 'Previous song'
      },
    },
    {
      id: 'karaoke.randomSong',
      label: 'Random song',
      phrases: [
        'play random song from my list',
        'play a random song',
        'play random song',
        'random song',
        'shuffle song',
        'surprise me',
      ],
      run: () =>
        deps.playlist.random()
          ? 'Random song'
          : voiceFailure('No playlist running'),
    },
    {
      id: 'karaoke.fullMix',
      label: 'Full mix',
      phrases: [
        'full mix',
        'everything on',
        'unmute everything',
        'unmute all',
        'all stems on',
      ],
      run: () => applyRolePreset(null),
    },
    {
      id: 'karaoke.soloOff',
      label: 'Solo off',
      phrases: ['solo off', 'clear solo', 'no solo', 'unsolo everything'],
      run: () => clearSolos(),
    },
    {
      id: 'karaoke.songsOpen',
      label: 'Songs open',
      // "Library" stays the app's melody library; this is the karaoke rail.
      phrases: [
        'open songs',
        'show songs',
        'open the songs',
        'songs',
        'open playlist',
        'open playlists',
        'open the playlist',
        'show playlists',
        'open songs and playlists',
      ],
      run: () => {
        if (deps.songsSidebar.isOpen()) {
          return voiceFailure('Songs already open')
        }
        deps.songsSidebar.open()
        return 'Songs open'
      },
    },
    {
      id: 'karaoke.songsClose',
      label: 'Songs closed',
      phrases: [
        'close songs',
        'hide songs',
        'close the songs',
        'close playlist',
        'close playlists',
        'hide playlists',
      ],
      run: () => {
        if (!deps.songsSidebar.isOpen()) {
          return voiceFailure('Songs are not open')
        }
        deps.songsSidebar.close()
        return 'Songs closed'
      },
    },
    {
      id: 'karaoke.loopSetA',
      label: 'Loop A set',
      phrases: LOOP_SET_A_PHRASES,
      run: () => {
        const at = deps.elapsed()
        deps.loop.setStart(at)
        if (deps.loop.end() > 0 && deps.loop.end() <= at) {
          deps.loop.setEnd(0)
          deps.loop.setEnabled(false)
        }
        return 'Loop A set'
      },
    },
    {
      id: 'karaoke.loopSetB',
      label: 'Loop B set',
      phrases: LOOP_SET_B_PHRASES,
      run: () => {
        const at = deps.elapsed()
        if (at <= deps.loop.start()) {
          return voiceFailure('Loop B must come after A')
        }
        deps.loop.setEnd(at)
        deps.loop.setEnabled(true)
        return 'Loop B set'
      },
    },
    {
      id: 'karaoke.loopToggle',
      label: 'Toggle loop',
      phrases: LOOP_TOGGLE_PHRASES,
      run: () => {
        const next = !deps.loop.enabled()
        deps.loop.setEnabled(next)
        return next ? 'Loop on' : 'Loop off'
      },
    },
    {
      id: 'karaoke.loopOn',
      label: 'Loop on',
      phrases: LOOP_ON_PHRASES,
      run: () => {
        if (deps.loop.end() <= deps.loop.start()) {
          return voiceFailure('Set A and B first')
        }
        deps.loop.setEnabled(true)
        return 'Loop on'
      },
    },
    {
      id: 'karaoke.loopOff',
      label: 'Loop off',
      phrases: LOOP_OFF_PHRASES,
      run: () => {
        deps.loop.setEnabled(false)
        return 'Loop off'
      },
    },
    {
      id: 'karaoke.loopClear',
      label: 'Loop cleared',
      phrases: LOOP_CLEAR_PHRASES,
      run: () => {
        deps.loop.clear()
        return 'Loop cleared'
      },
    },
    {
      id: 'karaoke.loopRange',
      label: 'Loop range',
      phrases: LOOP_RANGE_PHRASES,
      run: (args) => setLoopRange(args.n, args.m),
    },
    {
      id: 'karaoke.speedFaster',
      label: 'Faster',
      phrases: SPEED_FASTER_PHRASES,
      run: () => stepSpeed(1),
    },
    {
      id: 'karaoke.speedSlower',
      label: 'Slower',
      phrases: SPEED_SLOWER_PHRASES,
      run: () => stepSpeed(-1),
    },
    ...SPEED_PRESETS.map(
      ([multiplier, phrases]): VoiceCommand => ({
        id: `karaoke.speedPreset.${String(multiplier)}`,
        label: formatSpeed(multiplier),
        phrases,
        run: () => setSpeedClamped(multiplier),
      }),
    ),
    {
      id: 'karaoke.speedMultiplier',
      label: 'Set speed',
      // Explicit x/times is ALWAYS a multiplier — "10 x" clamps to 2x, it
      // never becomes 10 percent.
      phrases: SPEED_MULTIPLIER_PHRASES,
      run: (args) =>
        args.n !== undefined && Number.isFinite(args.n) && args.n > 0
          ? setSpeedClamped(args.n)
          : voiceFailure('Speed unchanged'),
    },
    {
      id: 'karaoke.speedSpoken',
      label: 'Set speed',
      // Bare numbers over 2.5 read as percent — same rule as the global
      // transport.
      phrases: SPEED_SPOKEN_PHRASES,
      run: (args) => {
        if (args.n === undefined || !Number.isFinite(args.n) || args.n <= 0) {
          return voiceFailure('Speed unchanged')
        }
        return setSpeedClamped(args.n > 2.5 ? args.n / 100 : args.n)
      },
    },
  ]

  // ── Role presets ───────────────────────────────────────────

  // Tense and homophone tolerance: "i played drums" and "i play base
  // guitar" are the same intent as their canonical forms.
  const roleInstrumentPhrases = (spokenNames: string[]): string[] =>
    spokenNames.flatMap((name) => [
      `i play ${name}`,
      `i played ${name}`,
      `i play the ${name}`,
      `i played the ${name}`,
      `i am playing ${name}`,
      `i m playing ${name}`,
    ])

  const rolePresets: Array<{ key: string; phrases: string[] }> = [
    {
      key: 'vocal',
      phrases: [
        'i sing',
        'i am singing',
        'i m singing',
        'i am the singer',
        'i m the singer',
        'i am a singer',
      ],
    },
    { key: 'guitar', phrases: roleInstrumentPhrases(['guitar', 'guitars']) },
    {
      key: 'bass',
      phrases: roleInstrumentPhrases([
        'bass',
        'base',
        'bass guitar',
        'base guitar',
        'based guitar',
      ]),
    },
    { key: 'piano', phrases: roleInstrumentPhrases(['piano', 'keys']) },
    {
      key: 'drums',
      phrases: [...roleInstrumentPhrases(['drums']), 'i drum'],
    },
  ]
  for (const preset of rolePresets) {
    commands.push({
      id: `karaoke.role.${preset.key}`,
      label: `You play ${preset.key}`,
      phrases: [...new Set(preset.phrases)],
      run: () => applyRolePreset(preset.key),
    })
  }

  // ── Per-stem mix commands ──────────────────────────────────

  // Known stems always answer; live labels outside the known set (custom
  // splits) get commands generated from their own label.
  const stemKeys = [...KNOWN_STEM_KEYS]
  for (const track of deps.tracks()) {
    if (!stemKeys.some((key) => keyMatchesLabel(key, track.label))) {
      stemKeys.push(track.label.toLowerCase())
    }
  }

  for (const key of stemKeys) {
    // Every name also answers with a "the" prefix — "mute the vocals" and
    // "mute vocals" are the same intent.
    const names = [
      ...new Set(
        [key, ...(STEM_ALIASES[key] ?? [])].flatMap((n) =>
          n.startsWith('the ') ? [n] : [n, `the ${n}`],
        ),
      ),
    ]
    const shown = displayName(key)
    commands.push(
      {
        id: `karaoke.mute.${key}`,
        label: `Mute ${shown}`,
        phrases: names.flatMap((n) => [`mute ${n}`, `${n} off`]),
        run: () => setMuted(key, true),
      },
      {
        id: `karaoke.unmute.${key}`,
        label: `Unmute ${shown}`,
        phrases: names.flatMap((n) => [`unmute ${n}`, `${n} on`]),
        run: () => setMuted(key, false),
      },
      {
        id: `karaoke.solo.${key}`,
        label: `Solo ${shown}`,
        phrases: names.flatMap((n) => [`solo ${n}`, `only ${n}`, `just ${n}`]),
        run: () => setSoloed(key, true),
      },
      {
        id: `karaoke.unsolo.${key}`,
        label: `Unsolo ${shown}`,
        phrases: names.map((n) => `unsolo ${n}`),
        run: () => setSoloed(key, false),
      },
      {
        id: `karaoke.volumeUp.${key}`,
        label: `${shown} up`,
        phrases: names.flatMap((n) => [
          `${n} up`,
          `turn ${n} up`,
          `${n} louder`,
        ]),
        run: () => nudgeVolume(key, 1),
      },
      {
        id: `karaoke.volumeDown.${key}`,
        label: `${shown} down`,
        phrases: names.flatMap((n) => [
          `${n} down`,
          `turn ${n} down`,
          `${n} quieter`,
        ]),
        run: () => nudgeVolume(key, -1),
      },
      {
        id: `karaoke.volumeSet.${key}`,
        label: `${shown} volume`,
        phrases: names.flatMap((n) => [
          `${n} volume <n> percent`,
          `${n} volume <n>`,
          `${n} <n> percent`,
        ]),
        run: (args) => setVolumePercent(key, args.n),
      },
    )
  }

  const gate = deps.available
  if (gate === undefined) return commands
  return commands.map((command) => ({ ...command, available: gate }))
}
