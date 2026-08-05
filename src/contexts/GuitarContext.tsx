// ── GuitarContext ────────────────────────────────────────────────────
// Owns all Guitar-tab state: the practice controller, drum machine, fretboard
// signals + derived memos, the 9 interactive mode-state objects,
// handleFretNotePlayed, and the mode-lifecycle effect.
//
// It is provided ABOVE the tab <Show> (around AppShell) so the state survives
// switching tabs — exactly the previous behaviour when it lived in AppShell —
// while keeping App.tsx free of guitar wiring. GuitarPage consumes it for the
// view; AppShell consumes it for the keyboard shortcuts, the instrument-sync
// effect, and the tab-change cleanup.

import type { Accessor, JSX, Setter } from 'solid-js'
import { createContext, createEffect, createMemo, createSignal, onCleanup, useContext, } from 'solid-js'
import type { FretboardMode } from '@/components/guitar/GuitarFretboardModeTabs'
import { useEngines } from '@/contexts/EngineContext'
import { createAdaptiveJam } from '@/features/guitar-practice/AdaptiveJamState'
import { createCagedTrainer } from '@/features/guitar-practice/CagedTrainerState'
import { createCallResponse } from '@/features/guitar-practice/CallResponseState'
import { createChordProgression } from '@/features/guitar-practice/ChordProgressionState'
import { createEarTraining } from '@/features/guitar-practice/EarTrainingPanel'
import { createMelodyTranscription } from '@/features/guitar-practice/MelodyTranscriptionState'
import { createNoteLocatorQuiz } from '@/features/guitar-practice/NoteLocatorQuiz'
import { createRiffTracker } from '@/features/guitar-practice/RiffTrackerState'
import { createSingToFretboard } from '@/features/guitar-practice/SingToFretboardState'
import { createTranscriptionTrainer } from '@/features/guitar-practice/TranscriptionTrainerState'
import type { GuitarMicOwner } from '@/features/guitar-practice/useGuitarPracticeController'
import { useGuitarPracticeController } from '@/features/guitar-practice/useGuitarPracticeController'
import { TAB_GUITAR } from '@/features/tabs/constants'
import { buildChordToneMidis } from '@/lib/guitar/chord-utils'
import { DrumMachine } from '@/lib/guitar/drum-machine'
import { midiToFreq } from '@/lib/scale-data'
import { KEY_OFFSETS, SCALE_DEFINITIONS } from '@/lib/scale-data'
import { activeTab as activeTabSignal } from '@/stores'

export interface GuitarFretboardState {
  guitarView: Accessor<'interactive' | 'hero' | '3d'>
  setGuitarView: Setter<'interactive' | 'hero' | '3d'>
  fretboardKey: Accessor<string>
  setFretboardKey: Setter<string>
  fretboardScale: Accessor<string>
  setFretboardScale: Setter<string>
  fretboardMode: Accessor<FretboardMode>
  setFretboardMode: Setter<FretboardMode>
  selectedChord: Accessor<string | null>
  setSelectedChord: Setter<string | null>
  lastPlayedNote: Accessor<{
    midi: number
    stringIndex: number
    fret: number
  } | null>
  highlightedNotes: Accessor<Set<number>>
  chordToneMidis: Accessor<Set<number>>
}

export interface GuitarModes {
  noteQuiz: ReturnType<typeof createNoteLocatorQuiz>
  earTraining: ReturnType<typeof createEarTraining>
  melodyTranscription: ReturnType<typeof createMelodyTranscription>
  callResponse: ReturnType<typeof createCallResponse>
  cagedTrainer: ReturnType<typeof createCagedTrainer>
  chordProgression: ReturnType<typeof createChordProgression>
  singToFretboard: ReturnType<typeof createSingToFretboard>
  transcriptionTrainer: ReturnType<typeof createTranscriptionTrainer>
  adaptiveJam: ReturnType<typeof createAdaptiveJam>
  riffTracker: ReturnType<typeof createRiffTracker>
}

export interface GuitarContextValue {
  guitar: ReturnType<typeof useGuitarPracticeController>
  drumMachine: DrumMachine
  drumBpm: Accessor<number>
  setDrumBpm: Setter<number>
  fretboard: GuitarFretboardState
  modes: GuitarModes
  onFretNotePlayed: (midi: number, stringIndex: number, fret: number) => void
}

const GuitarContext = createContext<GuitarContextValue | null>(null)

export function GuitarProvider(props: { children: JSX.Element }) {
  const { audioEngine } = useEngines()
  const activeTab = () => activeTabSignal()

  const drumMachine = new DrumMachine()
  const [drumBpm, setDrumBpm] = createSignal(drumMachine.bpm)
  drumMachine.onChange(() => setDrumBpm(drumMachine.bpm))

  const guitar = useGuitarPracticeController(audioEngine)

  const [guitarView, setGuitarView] = createSignal<
    'interactive' | 'hero' | '3d'
  >('hero')
  const [fretboardKey, setFretboardKey] = createSignal('C')
  const [fretboardScale, setFretboardScale] = createSignal('major')
  const [lastPlayedNote, setLastPlayedNote] = createSignal<{
    midi: number
    stringIndex: number
    fret: number
  } | null>(null)

  const highlightedNotes = createMemo(() => {
    const keyOffset = KEY_OFFSETS[fretboardKey()] ?? 0
    const degrees =
      SCALE_DEFINITIONS[fretboardScale()]?.degrees ??
      SCALE_DEFINITIONS.major.degrees
    const openMidi = [40, 45, 50, 55, 59, 64]
    const set = new Set<number>()
    for (let s = 0; s < 6; s++)
      for (let f = 0; f <= 15; f++) {
        const midi = openMidi[s] + f
        const deg = (((midi - keyOffset) % 12) + 12) % 12
        if (degrees.includes(deg)) set.add(midi)
      }
    return set
  })

  const [fretboardMode, setFretboardMode] =
    createSignal<FretboardMode>('explore')
  const [selectedChord, setSelectedChord] = createSignal<string | null>(null)

  const chordToneMidis = createMemo(() => {
    const chord = selectedChord()
    const key = fretboardKey()
    if (chord === null) return new Set<number>()
    const rootMidi = (KEY_OFFSETS[key] ?? 0) + 60
    return buildChordToneMidis(rootMidi, chord)
  })

  const noteQuiz = createNoteLocatorQuiz()
  const earTraining = createEarTraining(audioEngine)
  const melodyTranscription = createMelodyTranscription(
    audioEngine,
    fretboardKey,
    fretboardScale,
  )
  const callResponse = createCallResponse(
    audioEngine,
    fretboardKey,
    fretboardScale,
  )

  const cagedTrainer = createCagedTrainer()
  const chordProgression = createChordProgression(
    fretboardKey,
    setSelectedChord,
  )

  const singToFretboard = createSingToFretboard(audioEngine)
  const transcriptionTrainer = createTranscriptionTrainer(audioEngine)
  const adaptiveJam = createAdaptiveJam(
    fretboardKey,
    drumMachine,
    setSelectedChord,
  )
  const riffTracker = createRiffTracker()

  const handleFretNotePlayed = (
    midi: number,
    stringIndex: number,
    fret: number,
  ) => {
    const mode = fretboardMode()
    if (mode === 'noteQuiz') {
      noteQuiz.handleNotePlayed(midi)
    } else if (mode === 'earTraining') {
      earTraining.handleNotePlayed(midi)
    } else if (mode === 'melodyTranscription') {
      melodyTranscription.handleNotePlayed(midi)
    } else if (mode === 'callResponse') {
      callResponse.handleNotePlayed(midi)
    } else if (mode === 'singToFretboard') {
      singToFretboard.handleFretNotePlayed(midi)
    } else if (mode === 'transcriptionTrainer') {
      transcriptionTrainer.handleFretNotePlayed(midi)
    } else if (mode === 'adaptiveJam') {
      adaptiveJam.handleFretNotePlayed(midi)
    } else {
      audioEngine?.playTone(midiToFreq(midi), 600)
    }
    setLastPlayedNote({ midi, stringIndex, fret })
  }

  // ── Guitar mode lifecycle ────────────────────────────────────
  // Single createEffect dispatches on the active mode, starting the correct
  // sub-mode on enter and stopping/disabling it on leave.

  // Tuner, Riff Tracker and Sing share one logical auto claim on the Guitar
  // controller. A separate manual claim can coexist, so leaving an automatic
  // mode never tears down a capture the player explicitly started.
  const interactiveMicOwner: GuitarMicOwner = 'interactive-auto'
  let interactiveMicClaimed = false
  let interactiveMicStartPending = false
  let interactiveMicStartGeneration = 0

  const stopInactivePracticeActivities = (mode: FretboardMode | null) => {
    if (mode !== 'noteQuiz' && noteQuiz.roundActive()) noteQuiz.stopRound()
    if (
      mode !== 'earTraining' &&
      (earTraining.targetMidi() !== null || earTraining.feedback() !== null)
    ) {
      earTraining.stop()
    }
    if (
      mode !== 'melodyTranscription' &&
      melodyTranscription.phase() !== 'idle'
    ) {
      melodyTranscription.stop()
    }
    if (mode !== 'callResponse' && callResponse.phase() !== 'idle') {
      callResponse.stop()
    }
    if (mode !== 'riffTracker' && riffTracker.phase() === 'recording') {
      riffTracker.stopRecording()
    }
  }

  createEffect(() => {
    const guitarMicActive = guitar.isMicActive()
    const active = activeTab() === TAB_GUITAR && guitarView() === 'interactive'
    const mode = active ? fretboardMode() : null

    stopInactivePracticeActivities(mode)

    // Modes that auto-start on enter
    if (mode === 'noteQuiz' && !noteQuiz.roundActive()) {
      noteQuiz.startRound()
    }
    if (mode === 'earTraining' && earTraining.targetMidi() === null) {
      earTraining.playNewNote()
    }
    if (
      mode === 'melodyTranscription' &&
      melodyTranscription.phase() === 'idle'
    ) {
      melodyTranscription.startNewPhrase()
    }
    if (mode === 'callResponse' && callResponse.phase() === 'idle') {
      callResponse.startRound()
    }

    // Modes that auto-start on enter AND auto-stop on leave
    if (mode === 'chordProgression') {
      if (!chordProgression.playing()) chordProgression.start()
    } else if (chordProgression.playing()) {
      chordProgression.stop()
    }

    if (mode === 'adaptiveJam') {
      if (!adaptiveJam.playing()) adaptiveJam.start()
    } else if (adaptiveJam.playing()) {
      adaptiveJam.stop()
    }

    // Sing-to-Fretboard owns only its detection loop here. Its microphone is
    // acquired through the same controller claim as Tuner and Riff Tracker.
    if (mode === 'singToFretboard') {
      if (!singToFretboard.running()) singToFretboard.start()
    } else {
      if (singToFretboard.running()) singToFretboard.stop()
    }

    const modeNeedsInteractiveMic =
      mode === 'tuner' || mode === 'riffTracker' || mode === 'singToFretboard'
    if (modeNeedsInteractiveMic) {
      if (
        !interactiveMicClaimed ||
        (!guitarMicActive && !interactiveMicStartPending)
      ) {
        interactiveMicClaimed = true
        interactiveMicStartPending = true
        const startGeneration = ++interactiveMicStartGeneration
        void guitar.startMic(interactiveMicOwner).finally(() => {
          if (startGeneration === interactiveMicStartGeneration) {
            interactiveMicStartPending = false
          }
        })
      }
    } else if (interactiveMicClaimed) {
      interactiveMicClaimed = false
      interactiveMicStartPending = false
      interactiveMicStartGeneration++
      guitar.stopMic(interactiveMicOwner)
    }

    // transcriptionTrainer: stop when leaving mode
    if (mode !== 'transcriptionTrainer') {
      transcriptionTrainer.stop()
    }

    // Hero / 3D playback views use the controller's independent manual claim,
    // driven by the toolbar / 3D-overlay toggle.
  })

  onCleanup(() => {
    interactiveMicClaimed = false
    interactiveMicStartPending = false
    interactiveMicStartGeneration++
    stopInactivePracticeActivities(null)
    chordProgression.stop()
    adaptiveJam.stop()
    singToFretboard.stop()
    transcriptionTrainer.stop()
    guitar.stopAllMic()
    drumMachine.dispose()
  })

  const value: GuitarContextValue = {
    guitar,
    drumMachine,
    drumBpm,
    setDrumBpm,
    fretboard: {
      guitarView,
      setGuitarView,
      fretboardKey,
      setFretboardKey,
      fretboardScale,
      setFretboardScale,
      fretboardMode,
      setFretboardMode,
      selectedChord,
      setSelectedChord,
      lastPlayedNote,
      highlightedNotes,
      chordToneMidis,
    },
    modes: {
      noteQuiz,
      earTraining,
      melodyTranscription,
      callResponse,
      cagedTrainer,
      chordProgression,
      singToFretboard,
      transcriptionTrainer,
      adaptiveJam,
      riffTracker,
    },
    onFretNotePlayed: handleFretNotePlayed,
  }

  return (
    <GuitarContext.Provider value={value}>
      {props.children}
    </GuitarContext.Provider>
  )
}

export function useGuitar(): GuitarContextValue {
  const context = useContext(GuitarContext)
  if (!context) {
    throw new Error('useGuitar must be used within a GuitarProvider')
  }
  return context
}
