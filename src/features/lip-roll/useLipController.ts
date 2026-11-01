// ============================================================
// useLipController: one Lip roll run, from the tap to the result
// ============================================================
//
// The glide rooms' core (room-kit glide/useGlideRoom.ts) runs the run: the
// mic, the take, the scroll, Merc and the demo's way in. This is what is
// Lip roll's own. Three waves fitted to the singer (lip-run.ts), each with
// its own height in semitones (bay-layout.ts pitchY), after a count-in
// that zooms from screen 1's wave to the run's (bay-scroll.ts). Merc
// surfs the voice (bay-ride.ts) and cheers a new best. The demo's camera
// can stand still while the voice rides on (scripted-take.ts `hold`), and
// the demo reads where Merc will ride (`mercAhead`) to keep its tooltips
// clear of him.

import { useGlideRoom } from '@/components/room-kit/glide/useGlideRoom'
import type { RoutineRunOptions } from '@/components/room-kit/routine-stop'
import { EXERCISE_LIP_ROLL_BAY } from '@/lib/domain/exercise-contracts'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import { fitLipRoll } from '@/lib/glide/glide-targets'
import { rememberedLipNote } from '@/stores/lip-roll-store'
import { preloadLipResult } from './bay-art'
import { PLAYHEAD_X, WAVE } from './bay-geometry'
import { pitchY } from './bay-layout'
import { BUZZ_RIDE_TAU_SEC, RIDE_STATES, rideTarget, rideXOn } from './bay-ride'
import { createBayScroll, holdCamera, INTRO_CAMERA } from './bay-scroll'
import type { LipController, LipTypes } from './lip-controller-contract'
import { introLine, keepLipRun, planLipRun, resultLine, summarize, waveHeard, waveLine, } from './lip-run'
import { mercAheadOf } from './merc-ahead'
import { createLipLines } from './merc-lines'
import { useLipCapture } from './useLipCapture'

export function useLipController(
  options: RoutineRunOptions = {},
): LipController {
  const room = useGlideRoom<LipTypes>({
    exercise: EXERCISE_LIP_ROLL_BAY,
    capture: useLipCapture(),
    levels: LIP_ROLL_LEVELS,
    run: {
      fit: fitLipRoll,
      remembered: rememberedLipNote,
      plan: planLipRun,
      heard: waveHeard,
      keep: keepLipRun,
      summarize,
    },
    words: {
      lines: createLipLines(),
      intro: introLine,
      afterArch: waveLine,
      result: resultLine,
      chip: (wave, waves) => `Wave ${wave + 1} of ${waves}`,
    },
    merc: {
      states: {
        intro: RIDE_STATES.intro,
        countIn: RIDE_STATES.countIn,
        voiced: RIDE_STATES.waveVoiced,
        quiet: RIDE_STATES.waveQuiet,
        breath: RIDE_STATES.breath,
        lit: RIDE_STATES.waveLit,
        result: RIDE_STATES.result,
        cheer: RIDE_STATES.resultBest,
      },
      // DESIGN-lip-roll.md 1: he floats at the result, or cheers a new best.
      cheers: (_result, shown) => shown.improved,
    },
    scene: {
      introCamera: INTRO_CAMERA,
      feetStartY: WAVE.rootY,
      playheadX: PLAYHEAD_X,
      // The demo's camera may stand while the voice rides on.
      scroll: (plan, scripted) => {
        const follow = createBayScroll(plan.path, plan.countIn)
        const hold = scripted?.hold ?? null
        return hold === null ? follow : holdCamera(follow, hold)
      },
      pitchY: (midi, wave) =>
        pitchY(midi, wave.rootMidi, wave.topMidi - wave.rootMidi),
      // A lip trill's pitch flutters with the lips: he rides the wave it
      // draws rather than bobbing on each flutter (glide-ride.ts).
      rideTauSec: BUZZ_RIDE_TAU_SEC,
      feetTarget: (voiceMidi, targetMidi, wave) =>
        rideTarget(
          voiceMidi,
          targetMidi,
          wave.rootMidi,
          wave.topMidi - wave.rootMidi,
        ),
      frame: (run, t, parts) => ({
        camera: run.scroll.camera(t),
        zoom: run.scroll.zoom(t),
        strips: parts.strips,
        trace: parts.trace,
        merc: { x: rideXOn(run.scroll, t), feetY: parts.feetY },
        voiced: run.take.voiced(),
        contact: parts.contact,
      }),
      preloadResult: preloadLipResult,
      demoDrawsTake: true,
    },
    options,
  })

  return {
    ...room,
    mercAhead: (seconds) => {
      const run = room.live()
      const scripted = run?.scripted ?? null
      if (run === null || scripted === null) return []
      return mercAheadOf(
        {
          path: run.plan.path,
          countIn: run.plan.countIn,
          scroll: run.scroll,
          waveAt: run.take.archAt,
          voice: scripted.voice,
          now: scripted.now(),
        },
        seconds,
      )
    },
  }
}
