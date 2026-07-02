import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import ArpeggioJumperExercise from '@/features/exercises/arpeggio-jumper/ArpeggioJumperExercise'
import CallResponseExercise from '@/features/exercises/call-response/CallResponseExercise'
import ChordStackerExercise from '@/features/exercises/chord-stacker/ChordStackerExercise'
import DroneIntonationExercise from '@/features/exercises/drone-intonation/DroneIntonationExercise'
import DynamicSwellExercise from '@/features/exercises/dynamic-swell/DynamicSwellExercise'
import ExerciseMenu from '@/features/exercises/ExerciseMenu'
import IntervalTrainerExercise from '@/features/exercises/interval-trainer/IntervalTrainerExercise'
import LongNoteExercise from '@/features/exercises/long-note/LongNoteExercise'
import MirrorMelodyExercise from '@/features/exercises/mirror-melody/MirrorMelodyExercise'
import PitchHoldExercise from '@/features/exercises/pitch-hold/PitchHoldExercise'
import PitchPursuitExercise from '@/features/exercises/pitch-pursuit/PitchPursuitExercise'
import RoutineRunnerExercise from '@/features/exercises/routine-runner/RoutineRunnerExercise'
import ScaleRunnerExercise from '@/features/exercises/scale-runner/ScaleRunnerExercise'
import SightSingingExercise from '@/features/exercises/sight-singing/SightSingingExercise'
import SirenExercise from '@/features/exercises/siren/SirenExercise'
import SlideExercise from '@/features/exercises/slide/SlideExercise'
import StaccatoPrecisionExercise from '@/features/exercises/staccato-precision/StaccatoPrecisionExercise'
import type { ExerciseConfig, ExerciseType } from '@/features/exercises/types'
import VibratoExercise from '@/features/exercises/vibrato/VibratoExercise'
import WarmupExercise from '@/features/exercises/warmup/WarmupExercise'

interface ExercisesPageProps {
  /** Exercise selection state lives in AppShell (also set by share/deep-link
   *  and pending-drill flows), so it is threaded in rather than owned here. */
  selectedExercise: Accessor<ExerciseType | null>
  autoStartExercise: Accessor<boolean>
  onSelect: (type: ExerciseType) => void
  onQuickStart: (type: ExerciseType, config?: ExerciseConfig) => void
  onBack: () => void
}

/** Exercises tab (TAB_EXERCISES): the menu plus the selected exercise. */
export function ExercisesPage(props: ExercisesPageProps) {
  const { audioEngine, practiceEngine } = useEngines()

  return (
    <div id="exercises-panel">
      <Show
        when={props.selectedExercise()}
        fallback={
          <ExerciseMenu
            onSelect={(type) => props.onSelect(type)}
            onQuickStart={props.onQuickStart}
          />
        }
      >
        <Show when={props.selectedExercise() === 'warmup'}>
          <WarmupExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'long-note'}>
          <LongNoteExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'vibrato'}>
          <VibratoExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'slide'}>
          <SlideExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'pitch-hold'}>
          <PitchHoldExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'mirror-melody'}>
          <MirrorMelodyExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'pitch-pursuit'}>
          <PitchPursuitExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'interval-trainer'}>
          <IntervalTrainerExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'scale-runner'}>
          <ScaleRunnerExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'arpeggio-jumper'}>
          <ArpeggioJumperExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'drone-intonation'}>
          <DroneIntonationExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'siren'}>
          <SirenExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'call-response'}>
          <CallResponseExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'dynamic-swell'}>
          <DynamicSwellExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'chord-stacker'}>
          <ChordStackerExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'staccato-precision'}>
          <StaccatoPrecisionExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'routine-runner'}>
          <RoutineRunnerExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
        <Show when={props.selectedExercise() === 'sight-singing'}>
          <SightSingingExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            onBack={props.onBack}
            autoStart={props.autoStartExercise()}
          />
        </Show>
      </Show>
    </div>
  )
}
