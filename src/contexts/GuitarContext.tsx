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
import { createSingToFretboard } from '@/features/guitar-practice/SingToFretboardState'
import { createTranscriptionTrainer } from '@/features/guitar-practice/TranscriptionTrainerState'
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
  const { audioEngine, practiceEngine } = useEngines()
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
  createEffect(() => {
    const active = activeTab() === TAB_GUITAR && guitarView() === 'interactive'
    const mode = active ? fretboardMode() : null

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

    // singToFretboard: start/stop with mic lifecycle
    if (mode === 'singToFretboard') {
      if (!singToFretboard.running()) {
        void practiceEngine.startMic()
        singToFretboard.start()
      }
    } else if (singToFretboard.running()) {
      singToFretboard.stop()
      practiceEngine.stopMic()
    }

    // transcriptionTrainer: stop when leaving mode
    if (mode !== 'transcriptionTrainer') {
      transcriptionTrainer.stop()
    }

    // Hero / 3D playback views manage the mic directly through the guitar
    // controller (guitar.startMic/stopMic, backed by the shared MicManager) —
    // driven by the toolbar / 3D-overlay toggle. We deliberately do NOT drive
    // practiceEngine's mic here: it wraps the same AudioEngine, and toggling it
    // on gameState changes tore the shared mic down when Play was pressed. One
    // owner for the guitar mic avoids that fight. (singToFretboard above is the
    // only mode that legitimately needs practiceEngine's own mic.)
  })

  onCleanup(() => drumMachine.dispose())

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
