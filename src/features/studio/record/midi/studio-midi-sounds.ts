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

/** A General MIDI velocity, 1 to 127, from 0 to 1. */
const gmVelocity = (velocity: number) =>
  Math.min(127, Math.max(1, Math.round(velocity * 127)))

function drumSound(modules: StudioMidiModules, context: AudioContext): Sound {
  const bus = context.createGain()
  const player = modules.drumKit.createDrumKitPlayer({
    getAudioContext: () => context,
    getOutput: () => bus,
  })
  void player.activate()
  return {
    bus,
    voice: {
      start: (_id, midi, velocity, at) => {
        player.trigger({
          gmKey: midi,
          velocity: gmVelocity(velocity),
          atContextTime: at,
        })
      },
      // A drum is struck, not held: its note ends without a sound.
      stop: () => undefined,
      silence: () => player.panic(),
    },
    dispose: () => {
      player.dispose()
      bus.disconnect()
    },
  }
}

function pianoSound(modules: StudioMidiModules, context: AudioContext): Sound {
  const bus = context.createGain()
  const output = { getAudioContext: () => context, getOutput: () => bus }
  const router = modules.router.createPianoInstrumentRouter({
    fallback: modules.synth.createPianoFallbackSynth(output),
    preference: 'fallback',
  })
  const sampled = modules.sampled.createPianoSampledInstrument(output)
  router.setSampled(sampled)
  const loads = new AbortController()
  sampled
    .load(loads.signal)
    .then(() => {
      if (!loads.signal.aborted) router.setPreference('auto')
    })
    // Unreached or refused: the synth plays every note.
    .catch(() => undefined)
  return {
    bus,
    voice: {
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
    },
    dispose: () => {
      loads.abort()
      router.dispose()
      bus.disconnect()
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
