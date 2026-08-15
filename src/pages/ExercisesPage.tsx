import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import { IconChevronRight } from '@/components/exercise-icons'
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
import type { PracticeFrameListener } from '@/features/practice/usePracticeController'
import styles from './ExercisesPage.module.css'

interface ExercisesPageProps {
  /** The app's single pitch-frame stream. Only the warm-up needs it — it
   *  renders its steps on the Zen stage, which consumes frames rather than
   *  running a detector of its own. */
  subscribeFrames: (listener: PracticeFrameListener) => () => void
  /** Exercise selection state lives in AppShell (also set by share/deep-link
   *  and pending-drill flows), so it is threaded in rather than owned here. */
  selectedExercise: Accessor<ExerciseType | null>
  autoStartExercise: Accessor<boolean>
  onSelect: (type: ExerciseType) => void
  onQuickStart: (type: ExerciseType, config?: ExerciseConfig) => void
  onBack: () => void
  onOpenZen?: () => void
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
            headerAction={
              <Show when={props.onOpenZen !== undefined}>
                {/* Was a full-width banner above the gallery — a 110px card
                    with its own heading, sitting where the page's title
                    should be. It is one entry point among eighteen, so it
                    gets a chip beside the title instead of a row of its
                    own. The description it used to carry is on the Zen page
                    it opens. */}
                <button
                  type="button"
                  class={styles.zenChip}
                  onClick={() => props.onOpenZen?.()}
                >
                  <span class={styles.zenChipBadge}>New</span>
                  <span class={styles.zenChipLabel}>Guided pitch loops</span>
                  <IconChevronRight size={15} />
                </button>
              </Show>
            }
          />
        }
      >
        <Show when={props.selectedExercise() === 'warmup'}>
          <WarmupExercise
            audioEngine={audioEngine}
            practiceEngine={practiceEngine}
            subscribeFrames={props.subscribeFrames}
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
