// Guitar Night tuner preflight owns a temporary listener only outside a mounted rehearsal room.
// ============================================================

import type { Accessor } from 'solid-js'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { GuitarNightTunerExperience } from './GuitarNightTunerExperience'
import { useGuitarListeningController } from './useGuitarListeningController'
import { useGuitarNightTunerController } from './useGuitarNightTunerController'

interface GuitarNightTunerPreflightProps {
  tuning: Accessor<InstrumentTuning>
  transport: GuitarBackingTransportController
  onTuning(tuning: InstrumentTuning): void
  onBack(): void
}

export function GuitarNightTunerPreflight(
  props: GuitarNightTunerPreflightProps,
) {
  const listening = useGuitarListeningController({
    activateAudio: () => props.transport.activate(),
    getAudioGraph: () => props.transport.getAudioGraph(),
  })
  const tuner = useGuitarNightTunerController({
    tuning: () => props.tuning(),
    listening,
    activateAudio: () => props.transport.activate(),
    getAudioGraph: () => props.transport.getAudioGraph(),
    pausePlayback: () => props.transport.pause(),
    onTuning: (next) => props.onTuning(next),
  })

  return (
    <GuitarNightTunerExperience
      controller={tuner}
      tuning={() => props.tuning()}
      detectedFrequencyHz={listening.detectedFrequency}
      detectedNoteLabel={listening.currentNote}
      surfaceMode="overlay"
      recoveryActionLabel={() =>
        listening.canTakeOverInput() ? 'Use it here' : null
      }
      onRecoveryAction={() => void listening.useInputHere()}
      onBack={() => props.onBack()}
    />
  )
}
