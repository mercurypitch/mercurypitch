// ============================================================
// useNgController: one Ng slides run, from the tap to the result
// ============================================================
//
// The glide rooms' core (room-kit glide/useGlideRoom.ts) runs the run: the
// mic, the take, the scroll, Merc and the demo's way in. This is what is
// Ng slides' own. Five slides fitted to the singer (ng-run.ts), all on
// one scale (bridge-layout.ts pitchY), after a count-in while the bridge
// rolls in (bridge-scroll.ts). Merc rides the voice on the arch's edge
// (bridge-ride.ts) and cheers when all five light.

import { useGlideRoom } from '@/components/room-kit/glide/useGlideRoom'
import type { RoutineRunOptions } from '@/components/room-kit/routine-stop'
import { EXERCISE_NG_SLIDES_BRIDGE } from '@/lib/domain/exercise-contracts'
import { NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import { fitNgSlides } from '@/lib/glide/glide-targets'
import { rememberedNgNote } from '@/stores/ng-slides-store'
import { preloadNgResult } from './bridge-art'
import { ARCH, PLAYHEAD_X } from './bridge-geometry'
import { pitchY } from './bridge-layout'
import { RIDE_STATES, rideTarget, rideX } from './bridge-ride'
import { createBridgeScroll, INTRO_CAMERA } from './bridge-scroll'
import { createNgLines } from './merc-lines'
import type { NgController, NgTypes } from './ng-controller-contract'
import { introLine, keepNgRun, planNgRun, resultLine, slideHeard, slideLine, summarize, } from './ng-run'
import { useNgCapture } from './useNgCapture'

export function useNgController(options: RoutineRunOptions = {}): NgController {
  return useGlideRoom<NgTypes>({
    exercise: EXERCISE_NG_SLIDES_BRIDGE,
    capture: useNgCapture(),
    levels: NG_SLIDES_LEVELS,
    run: {
      fit: fitNgSlides,
      remembered: rememberedNgNote,
      plan: planNgRun,
      heard: slideHeard,
      keep: keepNgRun,
      summarize,
    },
    words: {
      lines: createNgLines(),
      intro: introLine,
      afterArch: slideLine,
      result: resultLine,
      chip: (slide, slides) => `Slide ${slide + 1} of ${slides}`,
    },
    merc: {
      states: {
        intro: RIDE_STATES.intro,
        countIn: RIDE_STATES.countIn,
        voiced: RIDE_STATES.slideVoiced,
        quiet: RIDE_STATES.slideQuiet,
        breath: RIDE_STATES.breath,
        lit: RIDE_STATES.archLit,
        result: RIDE_STATES.result,
        cheer: RIDE_STATES.resultAllLit,
      },
      cheers: (result) => result.archesLit === result.arches.length,
    },
    scene: {
      introCamera: INTRO_CAMERA,
      feetStartY: ARCH.deckY,
      playheadX: PLAYHEAD_X,
      scroll: (plan) => createBridgeScroll(plan.path, plan.countIn),
      pitchY: (midi, arch) => pitchY(midi, arch.rootMidi),
      feetTarget: (voiceMidi, targetMidi, arch) =>
        rideTarget(voiceMidi, targetMidi, arch.rootMidi),
      frame: (run, t, parts) => ({
        camera: run.scroll.at(t),
        strips: parts.strips,
        trace: parts.trace,
        merc: { x: rideX(t, run.plan.countIn), feetY: parts.feetY },
        contact: parts.contact,
      }),
      preloadResult: preloadNgResult,
      // The demo's slide is sung over the intro's bridge and its names.
      demoDrawsTake: false,
    },
    options,
  })
}
