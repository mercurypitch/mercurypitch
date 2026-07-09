import type { Accessor, Setter } from 'solid-js'
import { createEffect, createSignal, For, on, Show } from 'solid-js'
import { AudioDeviceSettings } from '@/components/guitar/AudioDeviceSettings'
import { ChordSelector } from '@/components/guitar/ChordSelector'
import { DrumMachinePanel } from '@/components/guitar/DrumMachinePanel'
import { GuitarControlBar } from '@/components/guitar/GuitarControlBar'
import { GuitarFretboardCanvas } from '@/components/guitar/GuitarFretboardCanvas'
import { GuitarFretboardModeTabs } from '@/components/guitar/GuitarFretboardModeTabs'
import { GuitarSignalFlow } from '@/components/guitar/GuitarSignalFlow'
import { InteractiveGuitarFretboardCanvas } from '@/components/guitar/InteractiveGuitarFretboardCanvas'
import { KeyScaleSelector } from '@/components/guitar/KeyScaleSelector'
import { MicInsightHint } from '@/components/MicInsightHint'
import { ControlOverlay } from '@/components/shared/control-bar/ControlOverlay'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { MidiSongStatusBar } from '@/components/shared/status-bar/MidiSongStatusBar'
import barStyles from '@/components/shared/status-bar/SongStatusBar.module.css'
import { useEngines } from '@/contexts/EngineContext'
import { useGuitar } from '@/contexts/GuitarContext'
import { GuitarTab3DView } from '@/features/guitar-tab-3d/GuitarTab3DView'
import { useMicInsights } from '@/features/mic-feedback/useMicInsights'
import { TAB_GUITAR } from '@/features/tabs/constants'
import type { InstrumentType } from '@/lib/audio-engine'
import { defaultScoreTrack } from '@/lib/midi-song'
import { NOTE_NAMES } from '@/lib/note-utils'
import { createPersistedSignal } from '@/lib/storage'
import { GP_FILE_EXTENSIONS, parseGuitarProFile } from '@/lib/tab/gp-import'
import { useFileDropZone } from '@/lib/use-file-drop-zone'
import { useMidiSongPicker } from '@/lib/use-midi-song-picker'
import { isMobile } from '@/lib/use-viewport'
import { activeTab, showNotification } from '@/stores'
import { saveMidiSong } from '@/stores/saved-midi-songs-store'
import { recordActivity } from '@/stores/usage-store'
import type { MelodyItem } from '@/types'

/** Original tab fingering (Guitar Pro imports) is preserved through load. */
interface GuitarSongLoadData {
  midi: number
  noteName?: string
  startBeat: number
  duration: number
  targetFreq?: number
  trackId?: string
  stringIndex?: number
  fret?: number
}

function melodyToGuitarItems(items: MelodyItem[]): GuitarSongLoadData[] {
  return items.map((item) => ({
    midi: item.note.midi,
    noteName: item.note.name,
    startBeat: item.startBeat,
    duration: item.duration,
    targetFreq: item.note.freq,
  }))
}

// Small / touch screens hide the 3D-view overlays (input monitor + nav gizmo)
// by default (isMobile); the user can still toggle them on, and the choice is
// persisted per device.

interface GuitarPageProps {
  /** Shared volume signal (owned by AppShell, used across tabs). */
  volume: Accessor<number>
  setVolume: Setter<number>
}

/**
 * Guitar tab (TAB_GUITAR): fretboard practice + 9 interactive modes.
 *
 * All guitar state lives in GuitarContext, so it survives tab switches and the
 * keyboard/instrument/cleanup wiring in AppShell can share it. This page is the
 * view: it reads the context and renders. Context fields are destructured into
 * identically-named locals so the markup reads 1:1.
 */
export function GuitarPage(props: GuitarPageProps) {
  const { audioEngine } = useEngines()
  const ctx = useGuitar()
  const guitar = ctx.guitar
  // Bottom fretboard reference panel in the 3D view (toggle).
  const [show3dFretboard, setShow3dFretboard] = createSignal(true)
  // Input signal monitor overlay in the 3D view (toggle); persisted per device.
  // Defaults on in dev, off for players, and off on small / touch screens.
  const [showInputMonitor, setShowInputMonitor] = createPersistedSignal(
    'gp-tab3d-input-monitor',
    import.meta.env.DEV && !isMobile(),
    { validator: (v): v is boolean => typeof v === 'boolean' },
  )
  // Orientation gizmo (X/Y/Z axes) overlay in the 3D view (toggle); persisted
  // per device, shown by default on desktop, hidden on small / touch screens.
  const [showGizmo, setShowGizmo] = createPersistedSignal(
    'gp-tab3d-gizmo',
    !isMobile(),
    { validator: (v): v is boolean => typeof v === 'boolean' },
  )
  // Read-only mirror of the 3D HUD's dock (Tab3DHud owns/writes it) so the
  // mic-off hint can sit opposite the HUD: when the HUD is top-docked the hint
  // drops to the bottom, clearing a bar that grows taller as it wraps.
  const [hud3dDock] = createPersistedSignal<'top' | 'bottom'>(
    'gp-tab3d-hud-dock',
    isMobile() ? 'top' : 'bottom',
    { validator: (v): v is 'top' | 'bottom' => v === 'top' || v === 'bottom' },
  )

  // Audio input/output device picker panel.
  const [devicesOpen, setDevicesOpen] = createSignal(false)
  // Recent run scores (%), most-recent-first, for the 3D corner score card.
  const [recentScores, setRecentScores] = createSignal<number[]>([])
  let prevGameState = guitar.gameState()
  createEffect(() => {
    const state = guitar.gameState()
    if (state === 'finished' && prevGameState !== 'finished') {
      const total = guitar.totalNotes()
      const pct =
        total > 0 ? Math.round((guitar.score() / (total * 100)) * 100) : 0
      setRecentScores((prev) => [pct, ...prev].slice(0, 4))
    }
    prevGameState = state
  })

  // Mic feedback: "can't hear you" / "too quiet" while playing along. Gate on
  // 'playing' only — during the count-in the user is waiting, not playing, so a
  // long count-in shouldn't trip the "can't hear you" message.
  const micInsights = useMicInsights({
    micActive: guitar.isMicActive,
    isPlaying: () => guitar.gameState() === 'playing',
    getLevel: guitar.getInputLevel,
    isDetecting: () =>
      guitar.detectedMidi() !== null || guitar.detectedClarity() > 0,
  })

  // Each practice run counts as real app usage (gates the survey).
  // Edge-triggered via on() so the effect depends only on the game state.
  createEffect(
    on(
      () => guitar.gameState(),
      (state) => {
        if (state === 'playing') recordActivity()
      },
    ),
  )

  const drumMachine = ctx.drumMachine
  const drumBpm = ctx.drumBpm
  const setDrumBpm = ctx.setDrumBpm
  const handleFretNotePlayed = ctx.onFretNotePlayed
  const {
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
  } = ctx.fretboard
  const {
    noteQuiz,
    earTraining,
    melodyTranscription,
    callResponse,
    cagedTrainer,
    chordProgression,
    singToFretboard,
    transcriptionTrainer,
    adaptiveJam,
  } = ctx.modes

  const picker = useMidiSongPicker<GuitarSongLoadData>({
    currentSong: () => guitar.currentSong(),
    fromMelodyItems: melodyToGuitarItems,
    fromScoreNotes: (notes) => notes,
    fromBackingNotes: (notes, trackId) => notes.map((n) => ({ ...n, trackId })),
    onSongLoaded: (items, name, bpm, backing, muted, song) =>
      guitar.loadSong(items, name, bpm, backing, muted, song),
    // The page remounts on every tab visit; the controller (and its loaded
    // song) live in GuitarContext — don't clobber them with the first melody.
    skipAutoLoad: () => guitar.selectedSongName() !== '',
  })

  const [gpStatus, setGpStatus] = createSignal('')
  let gpFileInput: HTMLInputElement | undefined

  const importGuitarProFile = async (file: File) => {
    setGpStatus(`Loading ${file.name}…`)
    try {
      const { song, name } = await parseGuitarProFile(file)
      const score = defaultScoreTrack(song)
      const backing = song.tracks
        .filter((t) => t.id !== score.id)
        .map((t) => t.id)
      const saved = saveMidiSong(name, song, score.id, backing)
      picker.loadSavedSong(saved)
      const count = song.tracks.length
      setGpStatus(`Loaded ${name} (${count} track${count === 1 ? '' : 's'})`)
    } catch (err) {
      setGpStatus(err instanceof Error ? err.message : 'Failed to load tab')
    }
  }

  const dropZone = useFileDropZone({
    accept: /\.(mid|midi|gp|gp3|gp4|gp5|gpx)$/i,
    onFiles: (files) => {
      const file = files[0]
      if (/\.(mid|midi)$/i.test(file.name)) {
        void picker.importMidiFile(file)
      } else {
        void importGuitarProFile(file)
      }
    },
    onRejected: () =>
      showNotification(
        'Drop a MIDI (.mid) or Guitar Pro file to load it here.',
        'info',
      ),
  })

  return (
    <div id="guitar-practice-panel">
      {/* In flow above everything, so the canvas HUD (3D status chip,
          score cards) keeps the full canvas top to itself. */}
      <MidiSongStatusBar
        picker={picker}
        prefix="gp"
        dataTour="guitar.song-picker"
        currentSong={guitar.currentSong}
        mutedTrackIds={guitar.mutedTrackIds}
        onToggleMute={guitar.toggleTrackMute}
        visibleTrackIds={guitar.visibleTrackIds}
        onToggleVisibility={guitar.toggleTrackVisibility}
        playheadBeat={guitar.playheadBeat}
        totalBeats={guitar.totalBeats}
        songBpm={guitar.songBpm}
        onSeek={guitar.seekToBeat}
        songName={guitar.selectedSongName}
        isPlaying={() =>
          guitar.gameState() === 'playing' || guitar.gameState() === 'countdown'
        }
        extraStatus={gpStatus}
        extraActions={
          <>
            <SegmentedControl
              label="Sound"
              dataTour="guitar.instruments"
              options={[
                { value: 'guitar-acoustic', label: 'Acoustic' },
                { value: 'guitar-electric', label: 'Electric' },
                { value: 'bass', label: 'Bass' },
              ]}
              value={() => guitar.instrumentType()}
              onChange={(v) => guitar.setInstrumentType(v as InstrumentType)}
            />
            <SegmentedControl
              ariaLabel="View"
              dataTour="guitar.view-toggle"
              options={[
                {
                  value: 'interactive',
                  label: 'Fretboard',
                  dataTour: 'guitar.view-fretboard',
                },
                { value: 'hero', label: 'Practice' },
                { value: '3d', label: '3D' },
              ]}
              value={guitarView}
              onChange={setGuitarView}
            />
            <button
              class={barStyles.chipBtn}
              onClick={() => gpFileInput?.click()}
              title="Import a Guitar Pro tab (or drop one on the canvas)"
            >
              Import GP
            </button>
            <input
              ref={gpFileInput}
              type="file"
              accept={GP_FILE_EXTENSIONS}
              style={{ display: 'none' }}
              onChange={(e) => {
                const input = e.currentTarget as HTMLInputElement
                const file = input.files?.[0]
                input.value = ''
                if (file) void importGuitarProFile(file)
              }}
            />
            <button
              class={barStyles.chipBtn}
              aria-expanded={devicesOpen()}
              onClick={() => setDevicesOpen((v) => !v)}
              title="Audio input/output devices"
            >
              Devices
            </button>
          </>
        }
      />
      <Show when={devicesOpen()}>
        <GuitarSignalFlow
          inputMode={guitar.inputMode}
          detectedMidi={guitar.detectedMidi}
          isPlaying={() =>
            guitar.gameState() === 'playing' ||
            guitar.gameState() === 'countdown'
          }
          combo={guitar.combo}
        />
        <AudioDeviceSettings
          inputDeviceId={guitar.inputDeviceId}
          setInputDevice={(id) => void guitar.setInputDevice(id)}
          outputDeviceId={guitar.outputDeviceId}
          setOutputDevice={(id) => void guitar.setOutputDevice(id)}
          outputSupported={guitar.outputDeviceSupported()}
          getInputLevel={guitar.getInputLevel}
          isMicActive={guitar.isMicActive}
          startMic={() => void guitar.startMic()}
        />
      </Show>
      <Show when={guitarView() === 'interactive'}>
        <KeyScaleSelector
          selectedKey={fretboardKey}
          selectedScale={fretboardScale}
          onKeyChange={setFretboardKey}
          onScaleChange={setFretboardScale}
        >
          <GuitarFretboardModeTabs
            activeMode={fretboardMode}
            onModeChange={setFretboardMode}
          />
          <Show
            when={fretboardMode() === 'explore' || fretboardMode() === 'jam'}
          >
            <ChordSelector
              selectedKey={fretboardKey}
              selectedScale={fretboardScale}
              selectedChord={selectedChord}
              onChordChange={setSelectedChord}
            />
          </Show>
        </KeyScaleSelector>
        <Show when={fretboardMode() === 'noteQuiz'}>
          <div class="gp-quiz-hud">
            <div class="gp-quiz-target">
              Find all{' '}
              <span
                style={{
                  color: 'var(--accent)',
                  'font-weight': '700',
                }}
              >
                {NOTE_NAMES[noteQuiz.targetMidiClass()]}
              </span>{' '}
              on the neck
            </div>
            <div class="gp-quiz-stats">
              <span class="gp-quiz-timer">
                {noteQuiz.roundActive() ? `${noteQuiz.timeLeft()}s` : '--'}
              </span>
              <span class="gp-quiz-progress">
                {noteQuiz.foundMidis().size}/
                {(() => {
                  const target = noteQuiz.targetMidiClass()
                  const openMidi = [40, 45, 50, 55, 59, 64]
                  let count = 0
                  for (let s = 0; s < 6; s++)
                    for (let f = 0; f <= 15; f++) {
                      if ((openMidi[s] + f) % 12 === target) count++
                    }
                  return count
                })()}{' '}
                found
              </span>
              <span class="gp-quiz-score">Score: {noteQuiz.score()}</span>
            </div>
          </div>
        </Show>
        <Show when={fretboardMode() === 'earTraining'}>
          <div class="gp-ear-panel">
            <div class="gp-ear-difficulty">
              <span class="gp-key-scale-label">Difficulty</span>
              <select
                class="gp-key-scale-select"
                value={earTraining.difficulty()}
                onChange={(e) =>
                  earTraining.setDifficulty(
                    e.currentTarget.value as 'easy' | 'medium' | 'hard',
                  )
                }
              >
                <option value="easy">Easy (frets 0-3)</option>
                <option value="medium">Medium (frets 0-7)</option>
                <option value="hard">Hard (full neck)</option>
              </select>
            </div>
            <div class="gp-ear-hud">
              <span class="gp-ear-label">What note is this?</span>
              <span class="gp-ear-streak">Streak: {earTraining.streak()}</span>
              <span class="gp-ear-accuracy">
                {Math.round(earTraining.accuracy() * 100)}%
              </span>
              {earTraining.feedback() && (
                <span
                  class="gp-ear-feedback"
                  classList={{
                    'gp-ear-correct': earTraining.feedback() === 'correct',
                    'gp-ear-wrong': earTraining.feedback() === 'wrong',
                  }}
                >
                  {earTraining.feedback() === 'correct'
                    ? 'Correct!'
                    : 'Try again'}
                </span>
              )}
            </div>
          </div>
        </Show>
        <Show when={fretboardMode() === 'melodyTranscription'}>
          <div class="gp-transcription-hud">
            <div class="gp-transcription-left">
              <span class="gp-transcription-label">
                {melodyTranscription.phase() === 'playing'
                  ? 'Listen...'
                  : melodyTranscription.phase() === 'listening'
                    ? 'Your turn! Play the melody'
                    : melodyTranscription.phase() === 'feedback'
                      ? 'Feedback'
                      : 'Ready'}
              </span>
              <span class="gp-transcription-progress">
                Note {melodyTranscription.currentNoteIndex() + 1}/
                {melodyTranscription.phraseLength()}
              </span>
            </div>
            <div class="gp-transcription-right">
              <span class="gp-transcription-score">
                Score: {melodyTranscription.score()}
              </span>
              <div class="gp-transcription-length">
                <span class="gp-key-scale-label">Length</span>
                <select
                  class="gp-key-scale-select"
                  value={melodyTranscription.phraseLength()}
                  onChange={(e) =>
                    melodyTranscription.setPhraseLength(
                      Number(e.currentTarget.value),
                    )
                  }
                >
                  <option value={2}>2 notes</option>
                  <option value={3}>3 notes</option>
                  <option value={4}>4 notes</option>
                  <option value={5}>5 notes</option>
                </select>
              </div>
              <button
                class="gp-btn"
                onClick={() => melodyTranscription.startNewPhrase()}
              >
                New Phrase
              </button>
              <button
                class="gp-btn"
                onClick={() => melodyTranscription.skipPhrase()}
              >
                Skip
              </button>
            </div>
          </div>
        </Show>
        <Show when={fretboardMode() === 'callResponse'}>
          <div class="gp-callresponse-hud">
            <div class="gp-callresponse-left">
              <span class="gp-callresponse-label">
                {callResponse.phase() === 'callPlaying'
                  ? 'Listen to the call...'
                  : callResponse.phase() === 'callEcho'
                    ? 'Your turn! Echo the call'
                    : callResponse.phase() === 'responsePlaying'
                      ? 'Listen to the response...'
                      : callResponse.phase() === 'responseImprov'
                        ? 'Improvise your reply!'
                        : callResponse.phase() === 'feedback'
                          ? 'Round feedback'
                          : 'Ready'}
              </span>
              <span class="gp-callresponse-phase-indicator">
                {callResponse.phase() === 'callEcho'
                  ? `Echo: ${callResponse.userEchoNotes().length}/${callResponse.callNotes().length}`
                  : callResponse.phase() === 'responseImprov'
                    ? `Notes: ${callResponse.userImprovNotes().length}`
                    : ''}
              </span>
            </div>
            <div class="gp-callresponse-right">
              <span class="gp-callresponse-score">
                Score: {callResponse.totalScore()}
              </span>
              <Show when={callResponse.phase() === 'callEcho'}>
                <button
                  class="gp-btn"
                  onClick={() => callResponse.finishEcho()}
                >
                  Echo Done
                </button>
              </Show>
              <Show when={callResponse.phase() === 'responseImprov'}>
                <button
                  class="gp-btn"
                  onClick={() => callResponse.finishImprov()}
                >
                  Improv Done
                </button>
              </Show>
              <Show
                when={
                  callResponse.phase() === 'callPlaying' ||
                  callResponse.phase() === 'responsePlaying'
                }
              >
                <button class="gp-btn" onClick={() => callResponse.skipRound()}>
                  Skip
                </button>
              </Show>
            </div>
          </div>
        </Show>
        <Show when={fretboardMode() === 'cagedTrainer'}>
          <div class="gp-caged-hud">
            <div class="gp-caged-left">
              <span class="gp-caged-label">
                {cagedTrainer.activeShape()} Position
              </span>
              <span class="gp-caged-chord">
                Chord: {cagedTrainer.activeChord()}
              </span>
            </div>
            <div class="gp-caged-right">
              <button class="gp-btn" onClick={() => cagedTrainer.prevShape()}>
                Prev
              </button>
              <button class="gp-btn" onClick={() => cagedTrainer.nextShape()}>
                Next
              </button>
            </div>
          </div>
        </Show>
        <Show when={fretboardMode() === 'chordProgression'}>
          <div class="gp-chordprog-hud">
            <div class="gp-chordprog-left">
              <span class="gp-chordprog-progression">
                {chordProgression.progressionName()}
              </span>
              <span class="gp-chordprog-chord">
                {chordProgression.currentChordName()}
              </span>
            </div>
            <div class="gp-chordprog-controls">
              <button
                class="gp-btn gp-btn-sm"
                onClick={() => chordProgression.prevProgression()}
              >
                Prev
              </button>
              <button
                class="gp-btn gp-btn-sm"
                onClick={() => chordProgression.toggle()}
              >
                {chordProgression.playing() ? 'Stop' : 'Start'}
              </button>
              <button
                class="gp-btn gp-btn-sm"
                onClick={() => chordProgression.nextProgression()}
              >
                Next
              </button>
            </div>
          </div>
        </Show>
        <Show when={fretboardMode() === 'singToFretboard'}>
          <div class="gp-singtofret-hud">
            <div class="gp-singtofret-left">
              <span class="gp-singtofret-phase">
                {singToFretboard.phase() === 'listening'
                  ? 'Sing a note...'
                  : singToFretboard.phase() === 'locked'
                    ? `Find ${singToFretboard.targetNoteName()}`
                    : 'Found!'}
              </span>
            </div>
            <div class="gp-singtofret-right">
              <span class="gp-singtofret-streak">
                Streak: {singToFretboard.streak()}
              </span>
              <span class="gp-singtofret-total">
                Found: {singToFretboard.totalFound()}
              </span>
            </div>
          </div>
        </Show>
        <Show when={fretboardMode() === 'transcriptionTrainer'}>
          <div class="gp-tt-hud">
            <div class="gp-tt-left">
              <span class="gp-tt-label">Transcribe</span>
              <span class="gp-tt-progress">
                {transcriptionTrainer.phase() === 'idle'
                  ? 'Load audio to start'
                  : transcriptionTrainer.phase() === 'loaded'
                    ? 'Ready — press Play'
                    : `${transcriptionTrainer.currentTime().toFixed(1)}s / ${transcriptionTrainer.duration().toFixed(1)}s`}
              </span>
            </div>
            <div class="gp-tt-right">
              <span class="gp-tt-score">
                Notes: {transcriptionTrainer.foundNotes().length}
              </span>
              <Show when={transcriptionTrainer.phase() === 'idle'}>
                <label class="gp-tt-load-btn">
                  Load Audio
                  <input
                    type="file"
                    accept="audio/*"
                    style="display:none"
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0]
                      if (file) transcriptionTrainer.loadAudio(file)
                    }}
                  />
                </label>
              </Show>
              <Show when={transcriptionTrainer.phase() !== 'idle'}>
                <button
                  class="gp-btn gp-btn-sm"
                  onClick={() => transcriptionTrainer.play()}
                >
                  Play
                </button>
                <button
                  class="gp-btn gp-btn-sm"
                  onClick={() => transcriptionTrainer.pause()}
                >
                  Pause
                </button>
                <button
                  class="gp-btn gp-btn-sm"
                  onClick={() => transcriptionTrainer.stop()}
                >
                  Stop
                </button>
                <button
                  class="gp-btn gp-btn-sm"
                  onClick={() => transcriptionTrainer.toggleLoop()}
                >
                  {transcriptionTrainer.loopEnabled() ? 'Loop' : 'No Loop'}
                </button>
              </Show>
            </div>
          </div>
          <Show when={transcriptionTrainer.phase() !== 'idle'}>
            <div class="gp-tt-controls">
              <span class="gp-tt-speed-label">
                Speed: {transcriptionTrainer.playbackRate().toFixed(2)}x
              </span>
              <input
                type="range"
                class="gp-tt-speed-slider"
                min="0.25"
                max="2"
                step="0.05"
                value={transcriptionTrainer.playbackRate()}
                onInput={(e) =>
                  transcriptionTrainer.setPlaybackRate(
                    Number(e.currentTarget.value),
                  )
                }
              />
              <button
                class="gp-btn gp-btn-sm"
                onClick={() => transcriptionTrainer.clearFoundNotes()}
              >
                Clear Notes
              </button>
            </div>
          </Show>
        </Show>
      </Show>
      <Show when={fretboardMode() === 'adaptiveJam'}>
        <div class="gp-aj-hud">
          <div class="gp-aj-left">
            <span class="gp-aj-label">Adaptive Jam</span>
            <span class="gp-aj-chord">
              {adaptiveJam.currentChordRoot()}
              {adaptiveJam.currentChord()}
            </span>
          </div>
          <div class="gp-aj-right">
            <span class="gp-aj-density">
              {adaptiveJam.userNoteDensity().toFixed(1)} n/s
            </span>
            <div class="gp-aj-history">
              <For each={adaptiveJam.chordHistory()}>
                {(c) => <span class="gp-aj-history-chip">{c}</span>}
              </For>
            </div>
          </div>
        </div>
      </Show>
      <div
        id="guitar-fretboard-container"
        data-tour="guitar.fretboard"
        ref={dropZone.bind}
        style={{
          position: 'relative',
          // Reserve headroom for the top-docked floating control bar so it
          // sits above the fret grid instead of over the top string. The 3D
          // view has no floating bar (its own HUD floats), so no reserve.
          'padding-top': guitarView() === '3d' ? undefined : '60px',
        }}
      >
        <Show when={dropZone.isDragOver()}>
          <div class={barStyles.dropOverlay}>
            <span class={barStyles.dropLabel}>
              Drop MIDI or Guitar Pro to load
            </span>
          </div>
        </Show>
        {/* The 3D view carries its own transport/input controls in its
            overlay, so the floating bar is not rendered there. */}
        <Show when={guitarView() !== '3d'}>
          <ControlOverlay
            idPrefix="guitar"
            containerSelector="#guitar-fretboard-container"
            defaultDock="top"
          >
            <GuitarControlBar
              isPlaying={() =>
                guitar.gameState() === 'playing' ||
                guitar.gameState() === 'countdown'
              }
              isPaused={() => guitar.gameState() === 'paused'}
              onPlay={() => void guitar.startGame()}
              onPause={guitar.pauseGame}
              onResume={guitar.resumeGame}
              onStop={guitar.stopGame}
              isCountingIn={() => guitar.gameState() === 'countdown'}
              countInBeat={() =>
                guitar.playheadBeat() < 0
                  ? Math.ceil(-guitar.playheadBeat())
                  : 0
              }
              volume={props.volume}
              onVolumeChange={(vol) => {
                props.setVolume(vol)
                audioEngine?.setVolume(vol / 100)
              }}
              bpm={() =>
                guitarView() === 'interactive' ? drumBpm() : guitar.songBpm()
              }
              onBpmChange={(b) => {
                if (guitarView() === 'interactive') {
                  drumMachine.setBpm(b)
                  setDrumBpm(b)
                }
              }}
              micActive={guitar.isMicActive}
              onMicToggle={() =>
                guitar.isMicActive() ? guitar.stopMic() : void guitar.startMic()
              }
              midiConnected={guitar.midiConnected}
              onMidiToggle={() =>
                guitar.midiConnected()
                  ? guitar.midiDisconnect()
                  : void guitar.midiConnect()
              }
              showNoteLabels={guitar.showNoteLabels}
              onToggleNoteLabels={() => guitar.setShowNoteLabels((p) => !p)}
              showUserNotes={guitar.showUserNotes}
              onToggleUserNotes={() => guitar.setShowUserNotes((p) => !p)}
            />
          </ControlOverlay>
        </Show>
        <MicInsightHint
          message={micInsights.message}
          insight={micInsights.insight}
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            'z-index': '6',
            'white-space': 'nowrap',
            // Clear the top chrome: the floating control bar (fretboard/hero
            // sit at top:68px below it), or — in 3D with the HUD docked top —
            // drop to the bottom, which is free and immune to HUD wrap.
            ...(guitarView() === '3d' && hud3dDock() === 'top'
              ? { bottom: '14px' }
              : { top: '68px' }),
          }}
        />
        <Show
          when={guitarView() === 'interactive'}
          fallback={
            <Show
              when={guitarView() === '3d'}
              fallback={
                <GuitarFretboardCanvas
                  fallingNotes={guitar.fallingNotes}
                  gameState={guitar.gameState}
                  playheadBeat={guitar.playheadBeat}
                  hitResults={guitar.hitResults}
                  combo={guitar.combo}
                  score={guitar.score}
                  visibleBeatWindow={guitar.visibleBeatWindow}
                  showNoteLabels={guitar.showNoteLabels}
                  songBpm={guitar.songBpm}
                  isActive={() => activeTab() === TAB_GUITAR}
                  detectedMidi={guitar.detectedMidi}
                  detectedClarity={guitar.detectedClarity}
                  showUserNotes={guitar.showUserNotes}
                  onStrum={guitar.strumString}
                />
              }
            >
              <GuitarTab3DView
                fallingNotes={guitar.fallingNotes}
                playheadBeat={guitar.playheadBeat}
                visibleBeatWindow={guitar.visibleBeatWindow}
                showNoteLabels={guitar.showNoteLabels}
                showFretboard={show3dFretboard}
                isActive={() => activeTab() === TAB_GUITAR}
                controls={{
                  gameState: guitar.gameState,
                  togglePlay: guitar.togglePlay,
                  songName: guitar.selectedSongName,
                  songBpm: guitar.songBpm,
                  playheadBeat: guitar.playheadBeat,
                  playbackRate: guitar.playbackRate,
                  setPlaybackRate: guitar.setPlaybackRate,
                  transpose: guitar.transpose,
                  setTranspose: guitar.setTranspose,
                  transposeBounds: guitar.transposeBounds,
                  showNoteLabels: guitar.showNoteLabels,
                  setShowNoteLabels: guitar.setShowNoteLabels,
                  showFretboard: show3dFretboard,
                  setShowFretboard: setShow3dFretboard,
                  loopEnabled: guitar.loopEnabled,
                  loopStartBeat: guitar.loopStartBeat,
                  setLoopStartBeat: guitar.setLoopStartBeat,
                  loopEndBeat: guitar.loopEndBeat,
                  setLoopEndBeat: guitar.setLoopEndBeat,
                  rampEnabled: guitar.rampEnabled,
                  setRampEnabled: guitar.setRampEnabled,
                  startingRate: guitar.startingRate,
                  setStartingRate: guitar.setStartingRate,
                  stepRate: guitar.stepRate,
                  setStepRate: guitar.setStepRate,
                  startPracticeLoop: guitar.startPracticeLoop,
                  stopPracticeLoop: guitar.stopPracticeLoop,
                  score: guitar.score,
                  totalNotes: guitar.totalNotes,
                  maxCombo: guitar.maxCombo,
                  recentScores,
                  startGame: () => void guitar.startGame(),
                  stopGame: guitar.stopGame,
                  combo: guitar.combo,
                  detectedMidi: guitar.detectedMidi,
                  detectedClarity: guitar.detectedClarity,
                  hitResults: guitar.hitResults,
                  showUserNotes: guitar.showUserNotes,
                  isMicActive: guitar.isMicActive,
                  startMic: () => void guitar.startMic(),
                  stopMic: guitar.stopMic,
                  midiConnected: guitar.midiConnected,
                  midiConnect: () => void guitar.midiConnect(),
                  midiDisconnect: guitar.midiDisconnect,
                  inputMode: guitar.inputMode,
                  getInputLevel: guitar.getInputLevel,
                  getInputTimeData: guitar.getInputTimeData,
                  showInputMonitor,
                  setShowInputMonitor,
                  showGizmo,
                  setShowGizmo,
                }}
              />
            </Show>
          }
        >
          <InteractiveGuitarFretboardCanvas
            selectedKey={fretboardKey}
            selectedScale={fretboardScale}
            highlightedNotes={highlightedNotes}
            isActive={() =>
              activeTab() === TAB_GUITAR && guitarView() === 'interactive'
            }
            lastPlayedNote={lastPlayedNote}
            onNotePlayed={handleFretNotePlayed}
            selectedChord={selectedChord}
            chordToneMidis={chordToneMidis}
            mode={fretboardMode}
            quizFoundMidis={noteQuiz.foundMidis}
            earTargetMidi={earTraining.targetMidi}
            earFeedback={earTraining.feedback}
            transcriptionResults={
              fretboardMode() === 'callResponse'
                ? callResponse.echoResults
                : melodyTranscription.noteResults
            }
            transcriptionPhase={
              fretboardMode() === 'callResponse'
                ? () =>
                    callResponse.phase() === 'callEcho'
                      ? 'listening'
                      : 'feedback'
                : melodyTranscription.phase
            }
            cagedHighlight={cagedTrainer.highlightedFrets}
            viewFretRange={cagedTrainer.viewFretRange}
            singTargetMidi={singToFretboard.targetMidi}
          />
        </Show>

        {/* Finished-run score: a non-blocking corner card (same pattern as
            Piano and Guitar-3D) instead of a modal — the fretboard stays
            visible behind it. Inside the container so it anchors to the
            canvas; 3D keeps its own HUD card. */}
        <Show when={guitar.gameState() === 'finished' && guitarView() !== '3d'}>
          {(() => {
            const pct = () => {
              const t = guitar.totalNotes()
              return t > 0 ? Math.round((guitar.score() / (t * 100)) * 100) : 0
            }
            const grade = () =>
              pct() >= 90
                ? 'Pitch Perfect!'
                : pct() >= 80
                  ? 'Excellent!'
                  : pct() >= 65
                    ? 'Good!'
                    : pct() >= 50
                      ? 'Okay!'
                      : 'Keep Practicing!'
            return (
              <div class="fn-score-corner" aria-label="Run score">
                <span class="fn-score-corner-title">Complete</span>
                <span class="fn-score-corner-pct">{pct()}%</span>
                <span class="fn-score-corner-grade">{grade()}</span>
                <span class="fn-score-corner-detail">
                  {guitar.totalNotes()} notes · Max Combo: {guitar.maxCombo()}x
                </span>
                <div class="fn-score-corner-actions">
                  <button
                    class="fn-btn fn-btn-play"
                    onClick={() => void guitar.startGame()}
                  >
                    Play Again
                  </button>
                  <button class="fn-btn fn-btn-close" onClick={guitar.stopGame}>
                    Close
                  </button>
                </div>
              </div>
            )
          })()}
        </Show>
      </div>

      <Show
        when={
          guitarView() === 'interactive' &&
          (fretboardMode() === 'jam' ||
            fretboardMode() === 'adaptiveJam' ||
            fretboardMode() === 'chordProgression')
        }
      >
        <DrumMachinePanel drumMachine={drumMachine} />
      </Show>
    </div>
  )
}
