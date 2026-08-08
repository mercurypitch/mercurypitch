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
  playlist: {
    active: Accessor<boolean>
    next: () => void
    prev: () => void
    /** Jump to a random queue entry; false when there is nothing to jump to. */
    random: () => boolean
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

  // ── The set ────────────────────────────────────────────────

  const commands: VoiceCommand[] = [
    {
      id: 'karaoke.play',
      label: 'Play',
      phrases: [
        'play',
        'start',
        'go',
        'begin',
        'resume',
        'continue',
        'keep going',
      ],
      run: () => {
        if (deps.playing()) return voiceFailure('Already playing')
        deps.play()
        return 'Play'
      },
    },
    {
      id: 'karaoke.pause',
      label: 'Pause',
      phrases: ['pause', 'hold', 'hold on', 'wait'],
      run: () => {
        if (!deps.playing()) return voiceFailure('Nothing playing')
        deps.pause()
        return 'Pause'
      },
    },
    {
      id: 'karaoke.stop',
      label: 'Stop',
      phrases: ['stop', 'finish', 'stop playback', 'stop playing'],
      run: () => {
        deps.stop()
        return 'Stop'
      },
    },
    {
      id: 'karaoke.restart',
      label: 'From the top',
      phrases: [
        'again',
        'restart',
        'from the top',
        'from the beginning',
        'start over',
        'start again',
        'one more time',
        'once more',
        'take it from the top',
      ],
      run: () => {
        deps.seekToTime(0)
        if (!deps.playing()) deps.play()
        return 'From the top'
      },
    },
    {
      id: 'karaoke.seekStart',
      label: 'Go to start',
      phrases: [
        'go to start',
        'go to the start',
        'go to beginning',
        'go to the beginning',
        'beginning',
        'rewind',
      ],
      run: () => {
        deps.seekToTime(0)
        return 'Go to start'
      },
    },
    {
      id: 'karaoke.forwardSeconds',
      label: 'Skip forward',
      phrases: [
        'forward <n> seconds',
        'forward <n> second',
        'forwards <n> seconds',
        'forwards <n>',
        'skip <n> seconds',
        'skip ahead <n> seconds',
        'ahead <n> seconds',
        'jump forward <n> seconds',
        'forward <n>',
        'skip <n>',
      ],
      run: (args) => seekRelative(args.n ?? 10),
    },
    {
      id: 'karaoke.backSeconds',
      label: 'Skip back',
      phrases: [
        'back <n> seconds',
        'back <n> second',
        'go back <n> seconds',
        'rewind <n> seconds',
        'jump back <n> seconds',
        'back <n>',
      ],
      run: (args) => seekRelative(-(args.n ?? 10)),
    },
    {
      id: 'karaoke.forwardMinutes',
      label: 'Skip forward',
      phrases: [
        'forward <n> minutes',
        'forward <n> minute',
        'skip <n> minutes',
      ],
      run: (args) => seekRelative((args.n ?? 1) * 60),
    },
    {
      id: 'karaoke.backMinutes',
      label: 'Skip back',
      phrases: ['back <n> minutes', 'back <n> minute', 'go back <n> minutes'],
      run: (args) => seekRelative(-(args.n ?? 1) * 60),
    },
    {
      id: 'karaoke.absoluteSeconds',
      label: 'Go to time',
      phrases: [
        'go to <n> seconds',
        'go to <n> second',
        'go to second <n>',
        'start at <n> seconds',
        'jump to <n> seconds',
        'go to <n>',
        'skip the first <n> seconds',
        'skip first <n> seconds',
      ],
      run: (args) => seekAbsolute(args.n ?? 0),
    },
    {
      id: 'karaoke.absoluteMinutes',
      label: 'Go to time',
      phrases: ['go to <n> minutes', 'go to <n> minute', 'go to minute <n>'],
      run: (args) => seekAbsolute((args.n ?? 0) * 60),
    },
    {
      id: 'karaoke.middle',
      label: 'Go to the middle',
      phrases: ['go to the middle', 'go to middle', 'middle', 'halfway'],
      run: () => {
        if (deps.duration() <= 0) return voiceFailure('Nothing loaded')
        deps.seekToTime(deps.duration() / 2)
        return 'Go to the middle'
      },
    },
    {
      id: 'karaoke.end',
      label: 'Go to the end',
      phrases: ['go to the end', 'go to end', 'the end'],
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
