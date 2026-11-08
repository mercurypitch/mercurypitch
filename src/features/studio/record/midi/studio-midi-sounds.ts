// ============================================================
// Studio MIDI sounds — the drum kit and the piano a MIDI lane plays, loaded only when a lane needs one, and made once per clock
// ============================================================
//
// Drum Night's kit player and the piano's synth, router and sampled grand
// are big, and the Studio needs none of them until a lane is played from
// MIDI, so they load with import() at the first MIDI arm, never with the
// page. Each sound is made once for the Studio's clock and kept for every
// arm after, so the sampled grand downloads and decodes once. Each plays
// into a bus of its own; an arm takes the bus through a node of its own
// (`attach`), which its take and its monitor listen on, and which comes
// apart from the bus when the arm ends.
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

/** The Studio's MIDI sounds, made on the clock they are first asked for, and again on a new one. */
export function createStudioMidiSounds(modules: StudioMidiModules) {
  let clock: AudioContext | null = null
  const made = new Map<StudioMidiSound, Sound>()

  function release(): void {
    for (const sound of made.values()) sound.dispose()
    made.clear()
  }

  function sound(kind: StudioMidiSound, context: AudioContext): Sound {
    if (clock !== context) {
      release()
      clock = context
    }
    let found = made.get(kind)
    if (found === undefined) {
      found =
        kind === 'drums'
          ? drumSound(modules, context)
          : pianoSound(modules, context)
      made.set(kind, found)
    }
    return found
  }

  return {
    /** Take `kind`'s sound on `context` through a node of the arm's own. */
    attach(kind: StudioMidiSound, context: AudioContext): StudioMidiAttached {
      const { bus, voice } = sound(kind, context)
      const node = context.createGain()
      bus.connect(node)
      return {
        node,
        voice,
        detach: () => {
          voice.silence()
          try {
            bus.disconnect(node)
          } catch {
            // Already apart.
          }
        },
      }
    },
    dispose: release,
  }
}

export type StudioMidiSounds = ReturnType<typeof createStudioMidiSounds>
