// One overlay, both worlds.
// ============================================================
//
// The Cabinet and the Hallway ask the player for the same two things --
// hold a note, then make it waver -- and until now only the Cabinet told
// them how it was going. The Hallway had the charge bar and nothing
// else, so a player whose wave was too slow, too shallow, or never heard
// at all got the same blank bar for every one of those, held the note
// until they ran out of breath, and learned nothing (maff, 2026-09-03).
//
// The parts, in the order they start mattering:
//
//   TRACK    how charged the ring is, with a mark where a steady hold
//            stops counting. Without the mark the bar stalls at 55% and
//            reads as a bug.
//   GAUGE    the wave as MEASURED: rate against the band that counts,
//            and depth in cents. Only once the hold is done, because
//            that is when it becomes the thing being asked for. This is
//            the part a player cannot otherwise see -- nobody can hear
//            their own vibrato rate.
//   COACH    one line, and never the instruction they are already
//            following. Which way the wave is failing decides what it
//            says.
//
// A stage with phases of its own passes `line` to override the coaching
// while nothing is being sung at.

import { MicInput } from '@irchiinnuss/audio-io/solid'
import { midiToNote } from '@irchiinnuss/pitch-engine'
import { createMemo, Show } from 'solid-js'
import type { World3DConfig } from '../world3d-config'

/** Full width of the wave-rate gauge, in Hz. Wide enough that both edges
 * of the accepted band sit inside it with room to be wrong on either
 * side -- a gauge that ends at the band cannot show "too fast". */
const WAVE_SCALE_HZ = 12

export interface VoiceCoachProps {
  readonly cfg: World3DConfig
  /** The note this world's glass answers to. */
  readonly targetMidi: number
  readonly charge: number
  readonly ringing: boolean
  /** What the mic reports, or null while it hears nothing. */
  readonly heardMidi: number | null
  /** The wave as measured. Rate 0 means "not judged yet", which is not
   * the same as "too slow" and must not be coached as if it were. */
  readonly waveRate: number
  readonly waveDepth: number
  /** Whether the detector counted the wave this frame. */
  readonly wavering: boolean
  /** Hide the track and gauge when the stage is not asking for a note. */
  readonly listening: boolean
  /** Replaces the coaching entirely — for a stage's own phases. */
  readonly line?: string
  readonly onChooseMic: () => void
}

export function VoiceCoach(props: VoiceCoachProps) {
  const targetName = createMemo(() => {
    const t = midiToNote(props.targetMidi)
    return `${t.name}${t.octave}`
  })

  /** What the mic is hearing, in the terms the player needs: which note,
   * and whether it counts. Diagnostic on purpose -- "nothing is
   * happening" and "you are an octave low" look identical otherwise. */
  const heardLine = createMemo(() => {
    const midi = props.heardMidi
    if (midi === null) return 'listening'
    const semis = midi - props.targetMidi
    const tol =
      props.cfg.ring.tolSemis +
      (props.ringing ? props.cfg.ring.pumpTolBonus : 0)
    if (Math.abs(semis) <= tol) {
      const cents = Math.round(semis * 100)
      return `${cents >= 0 ? '+' : '−'}${Math.abs(cents)}¢`
    }
    // The note in brackets is the diagnostic half: "too low" says what to
    // do, and "(G4)" says whether the mic is even hearing the right
    // voice. Octave errors in particular look identical to silence
    // without it.
    const note = midiToNote(Math.round(midi))
    const way = semis > 0 ? 'too high' : 'too low'
    return `${way} (${note.name}${note.octave})`
  })

  const coachLine = createMemo(() => {
    if (props.line !== undefined) return props.line
    if (!props.ringing) return `Hold ${targetName()} — ${heardLine()}`
    if (props.wavering) return 'Keep waving'
    // Ringing but not counting. Which way it is failing decides what the
    // player should change, so say that rather than repeating the
    // instruction they are already following.
    //
    // A measurement of zero is not a diagnosis: it means the window has
    // not filled yet, or the mic is hearing nothing. Correcting a wave
    // that was never heard sends the player to fix the wrong thing.
    const v = props.cfg.vibrato
    if (props.waveRate === 0) return 'Now let it waver'
    if (props.waveRate < v.minHz) return 'Waver faster'
    if (props.waveRate > v.maxHz) return 'Waver slower'
    if (props.waveDepth < v.minDepthCents) return 'Waver wider'
    if (props.waveDepth > v.maxDepthCents) return 'Too wide — stay on the note'
    return 'Now let it waver'
  })

  return (
    <div class="stage3d__meter" classList={{ 'is-ringing': props.ringing }}>
      <Show when={props.listening}>
        <div class="stage3d__track">
          <i style={{ width: `${Math.round(props.charge * 100)}%` }} />
          {/* Where a steady hold stops and vibrato has to take over.
              Marked, because the ceiling is a rule of the game rather
              than the end of the bar. */}
          <b
            style={{
              left: `${Math.round(props.cfg.ring.holdCap * 100)}%`,
            }}
          />
        </div>
        <Show when={props.ringing}>
          <div
            class="stage3d__wave"
            classList={{ 'is-heard': props.wavering }}
            aria-hidden="true"
          >
            <span class="stage3d__band">
              <i
                style={{
                  left: `${Math.round((props.cfg.vibrato.minHz / WAVE_SCALE_HZ) * 100)}%`,
                  width: `${Math.round(((props.cfg.vibrato.maxHz - props.cfg.vibrato.minHz) / WAVE_SCALE_HZ) * 100)}%`,
                }}
              />
              <b
                style={{
                  left: `${Math.round(Math.min(1, props.waveRate / WAVE_SCALE_HZ) * 100)}%`,
                }}
              />
            </span>
            <span class="stage3d__wavenum">
              {props.waveRate > 0
                ? `${props.waveRate.toFixed(1)} Hz · ${Math.round(props.waveDepth)}¢`
                : 'no wave yet'}
            </span>
          </div>
        </Show>
      </Show>
      <p class="stage3d__coach">{coachLine()}</p>
      <MicInput listening onChoose={() => props.onChooseMic()} />
    </div>
  )
}
