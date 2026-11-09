// ============================================================
// Studio MIDI sounds — the drum kit and the piano a MIDI lane plays, loaded only when a lane needs one, and made for each lane's arm
// ============================================================
//
// Drum Night's kit player and the piano's synth, router and sampled grand
// are big, and the Studio needs none of them until a lane is played from
// MIDI, so they load with import() at the first MIDI arm, never with the
// page. Each armed MIDI lane plays a sound of its own (`attach`), so its
// take holds only its own notes, though two piano lanes are armed at once:
// a sound plays into a node of its own, which the lane's take and its
// monitor listen on, and the sound goes with the arm. Each piano decodes
// the sampled grand's samples for itself, as it plays them (the browser's
// cache serves the files again); the kit does the same with its own.
//
// The piano plays its synth at once and the sampled grand as its samples
// load (from cdn.jsdelivr.net); until a note's sample is ready, the router
// plays that note on the synth. The kit plays General MIDI's drum keys, 35
// to 81, as Drum Night does: a key with no drum in the kit plays nothing.
//
// An offline render (src/features/studio/midi/render/) builds its sound with
// the same two functions, on its OfflineAudioContext, so a rendered clip is
// the sound a take of the same notes records: the same instruments into a
// node of their own at unity. `offline` lifts the instruments' voice caps,
// which a render scheduling notes ahead would otherwise hit, and starts the
// kit without asking a clock that is not running yet to resume. Nothing
// loads on its own there: the render readies the sound itself.
import type { StudioMidiSound } from './studio-midi-sound'

/** The sound modules, loaded together with import(), never with the page. */
function importSoundModules() {
  return Promise.all([
    import('@/features/drum-night/audio/drum-kit-player'),
    import('@/features/piano/runtime/piano-fallback-synth'),
    import('@/features/piano/instrument/piano-instrument-router'),
    import('@/features/piano/instrument/piano-sampled-instrument'),
  ]).then(([drumKit, synth, router, sampled]) => ({
    drumKit,
    synth,
    router,
    sampled,
  }))
}

export type StudioMidiModules = Awaited<ReturnType<typeof importSoundModules>>

/** One sound's notes: a note begins at clock time `at`, and ends there too. */
export interface StudioMidiVoice {
  /** `velocity` 0 to 1, `soft` the soft pedal's 0 to 1 as the note began. */
  start(
    id: string,
    midi: number,
    velocity: number,
    at: number,
    soft: number,
  ): void
  stop(id: string, at: number, release: number): void
  /** Every note it plays, stopped. */
  silence(): void
}

/** A sound taken by one arm: its node, its notes, and the way to let it go. */
export interface StudioMidiAttached {
  readonly node: AudioNode
  readonly voice: StudioMidiVoice
  detach(): void
}

interface Sound {
  readonly bus: GainNode
  readonly voice: StudioMidiVoice
  dispose(): void
}

let loading: Promise<StudioMidiModules> | null = null

/** Load the sound modules, once; a failed load is tried again next time. */
export function loadStudioMidiModules(): Promise<StudioMidiModules> {
  loading ??= importSoundModules()
  loading.catch(() => {
    loading = null
  })
  return loading
}

/** How a sound is built: for a live arm by default, or for an offline render. */
export interface StudioMidiSoundOptions {
  /** On an OfflineAudioContext, its notes scheduled ahead of the render: no voice cap, and the kit starts without a resume. */
  readonly offline?: boolean
}

/** A General MIDI velocity, 1 to 127, from 0 to 1. */
const gmVelocity = (velocity: number) =>
  Math.min(127, Math.max(1, Math.round(velocity * 127)))

/** Drum Night's kit on `context`, into a node of its own; the caller activates it. */
export function buildStudioDrumSound(
  modules: StudioMidiModules,
  context: BaseAudioContext,
  options: StudioMidiSoundOptions = {},
) {
  const bus = context.createGain()
  const kit = modules.drumKit.createDrumKitPlayer({
    getAudioContext: () => context,
    getOutput: () => bus,
    ...(options.offline === true && { offline: true }),
  })
  const voice: StudioMidiVoice = {
    start: (_id, midi, velocity, at) => {
      kit.trigger({
        gmKey: midi,
        velocity: gmVelocity(velocity),
        atContextTime: at,
      })
    },
    // A drum is struck, not held: its note ends without a sound.
    stop: () => undefined,
    silence: () => kit.panic(),
  }
  return {
    bus,
    kit,
    voice,
    dispose: () => {
      kit.dispose()
      bus.disconnect()
    },
  }
}

/** The piano on `context`, into a node of its own: the router over the synth and the sampled grand, playing the synth until it is told otherwise. */
export function buildStudioPianoSound(
  modules: StudioMidiModules,
  context: BaseAudioContext,
  options: StudioMidiSoundOptions = {},
) {
  const bus = context.createGain()
  const output = {
    getAudioContext: () => context,
    getOutput: () => bus,
    ...(options.offline === true && { offline: true }),
  }
  const router = modules.router.createPianoInstrumentRouter({
    fallback: modules.synth.createPianoFallbackSynth(output),
    preference: 'fallback',
  })
  const grand = modules.sampled.createPianoSampledInstrument(output)
  router.setSampled(grand)
  const voice: StudioMidiVoice = {
    start: (id, midi, velocity, at, soft) => {
      router.noteOn({
        id,
        midi,
        velocity,
        softPedalValue: soft,
        atContextTime: at,
      })
    },
    stop: (id, at, release) => {
      router.noteOff({ id, releaseVelocity: release, atContextTime: at })
    },
    silence: () => router.panic(),
  }
  return {
    bus,
    router,
    grand,
    voice,
    dispose: () => {
      router.dispose()
      bus.disconnect()
    },
  }
}

function drumSound(modules: StudioMidiModules, context: AudioContext): Sound {
  const sound = buildStudioDrumSound(modules, context)
  void sound.kit.activate()
  return sound
}

function pianoSound(modules: StudioMidiModules, context: AudioContext): Sound {
  const sound = buildStudioPianoSound(modules, context)
  const loads = new AbortController()
  sound.grand
    .load(loads.signal)
    .then(() => {
      if (!loads.signal.aborted) sound.router.setPreference('auto')
    })
    // Unreached or refused: the synth plays every note.
    .catch(() => undefined)
  return {
    bus: sound.bus,
    voice: sound.voice,
    dispose: () => {
      loads.abort()
      sound.dispose()
    },
  }
}

/** The Studio's MIDI sounds: one for each lane's arm, on the clock it is armed on. */
export function createStudioMidiSounds(modules: StudioMidiModules) {
  const playing = new Set<Sound>()

  return {
    /** A sound of `kind` on `context` for one arm alone, through a node of its own. */
    attach(kind: StudioMidiSound, context: AudioContext): StudioMidiAttached {
      const sound =
        kind === 'drums'
          ? drumSound(modules, context)
          : pianoSound(modules, context)
      playing.add(sound)
      return {
        node: sound.bus,
        voice: sound.voice,
        detach: () => {
          if (!playing.delete(sound)) return
          sound.voice.silence()
          sound.dispose()
        },
      }
    },
    dispose(): void {
      for (const sound of playing) sound.dispose()
      playing.clear()
    },
  }
}

export type StudioMidiSounds = ReturnType<typeof createStudioMidiSounds>
