// ============================================================
// A demo's sound: the room's note, then Merc singing it
// ============================================================
//
// On the room's own audio clock (the one its Hear button and its mic use),
// through one bus of the demo's own, so Skip, the way out and the app going
// to the background can close all of it at once, pop-free. The note plays
// exactly as the Hear button plays it (reference-tone.ts).
//
// A take's clock starts `lead` seconds after it is sung: the voice is
// scheduled that far ahead, less the speaker's own latency, so it is heard
// when the screen shows it.

import type { DemoSound, VoiceContourOptions } from '@/lib/demo-audio'
import { playVoiceContour } from '@/lib/demo-audio'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { playReferenceTone } from '@/lib/reference-tone'
import type { DemoVoicePoint } from './demo-plan'

/** The house close (src/lib/preview-player.ts), seconds. */
const RELEASE = 0.18
/** The Hear button's note length (useExerciseCapture.playTone). */
const TONE_SECONDS = 1.1

/** A take the demo can sing: its voice, on the wall clock. */
export interface SungDemoTake {
  readonly voice: readonly DemoVoicePoint[]
}

export interface DemoSoundtrack<Take extends SungDemoTake> {
  /** Seconds from `sing` to the take's clock reading zero. */
  readonly lead: number
  /** The note, as the Hear button plays it. */
  tone: (midi: number) => void
  /** One of Merc's takes on the note. */
  sing: (take: Take, midi: number) => void
  /** Everything off, pop-free; safe to call more than once. */
  stop: () => void
}

/** What the speakers add, seconds, where the browser says. */
export function outputLatency(ctx: AudioContext): number {
  const reported = Number.isFinite(ctx.outputLatency)
    ? ctx.outputLatency
    : ctx.baseLatency
  return Number.isFinite(reported) && reported > 0 ? reported : 0
}

/**
 * The demo's sound on `ctx`; `vibrato` is the one its frames carry, and
 * `timbre` the voice's colour (an open "ooh" unless a room asks for a hum).
 */
export function createDemoSoundtrack<Take extends SungDemoTake>(
  ctx: AudioContext,
  minLead: number,
  vibrato: VoiceContourOptions['vibrato'],
  timbre?: VoiceContourOptions['timbre'],
): DemoSoundtrack<Take> {
  const bus = ctx.createGain()
  bus.connect(ctx.destination)
  const voices: DemoSound[] = []
  const latency = outputLatency(ctx)
  const lead = Math.max(minLead, latency + 0.03)
  let stopped = false
  return {
    lead,
    tone: (midi) => {
      if (!stopped) void playReferenceTone(ctx, midi, TONE_SECONDS, bus)
    },
    sing: (take, midi) => {
      if (stopped) return
      voices.push(
        playVoiceContour(ctx, take.voice, {
          hz: midiToFrequency(midi),
          startAt: ctx.currentTime + lead - latency,
          destination: bus,
          vibrato,
          timbre,
        }),
      )
    },
    stop: () => {
      if (stopped) return
      stopped = true
      for (const voice of voices) voice.stop()
      try {
        const t = ctx.currentTime
        bus.gain.cancelScheduledValues(t)
        bus.gain.setValueAtTime(bus.gain.value, t)
        bus.gain.setTargetAtTime(0, t, RELEASE / 5)
      } catch {
        // The context closed under us: nothing is sounding.
      }
      // Nothing of the demo stays in the graph once its tail has died.
      setTimeout(() => bus.disconnect(), (RELEASE + 0.12) * 1000)
    },
  }
}
