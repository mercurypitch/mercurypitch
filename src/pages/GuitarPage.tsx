import type { Accessor, Setter } from 'solid-js'
import { createEffect, createSignal, For, Show } from 'solid-js'
import { AudioDeviceSettings } from '@/components/guitar/AudioDeviceSettings'
import { ChordSelector } from '@/components/guitar/ChordSelector'
import { DrumMachinePanel } from '@/components/guitar/DrumMachinePanel'
import { GuitarFretboardCanvas } from '@/components/guitar/GuitarFretboardCanvas'
import { GuitarFretboardModeTabs } from '@/components/guitar/GuitarFretboardModeTabs'
import { GuitarPracticeSongPicker } from '@/components/guitar/GuitarPracticeSongPicker'
import { GuitarSignalFlow } from '@/components/guitar/GuitarSignalFlow'
import { GuitarViewToggle } from '@/components/guitar/GuitarViewToggle'
import { InteractiveGuitarFretboardCanvas } from '@/components/guitar/InteractiveGuitarFretboardCanvas'
import { KeyScaleSelector } from '@/components/guitar/KeyScaleSelector'
import { MicInsightHint } from '@/components/MicInsightHint'
import { SharedControlToolbar } from '@/components/shared/SharedControlToolbar'
import { useEngines } from '@/contexts/EngineContext'
import { useGuitar } from '@/contexts/GuitarContext'
import { GuitarTab3DView } from '@/features/guitar-tab-3d/GuitarTab3DView'
import { useMicInsights } from '@/features/mic-feedback/useMicInsights'
import { PLAYBACK_MODE_ONCE, TAB_GUITAR } from '@/features/tabs/constants'
import type { InstrumentType } from '@/lib/audio-engine'
import { NOTE_NAMES } from '@/lib/note-utils'
import { createPersistedSignal } from '@/lib/storage'
import { activeTab, countIn } from '@/stores'

// Small / touch screens hide the 3D-view overlays (input monitor + nav gizmo)
// by default; the user can still toggle them on and the choice is persisted.
const isSmallScreen = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 768px), (pointer: coarse)').matches

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
    import.meta.env.DEV && !isSmallScreen(),
    { validator: (v): v is boolean => typeof v === 'boolean' },
  )
  // Orientation gizmo (X/Y/Z axes) overlay in the 3D view (toggle); persisted
  // per device, shown by default on desktop, hidden on small / touch screens.
  const [showGizmo, setShowGizmo] = createPersistedSignal(
    'gp-tab3d-gizmo',
    !isSmallScreen(),
    { validator: (v): v is boolean => typeof v === 'boolean' },
  )
  // Collapse the shared transport toolbar to reclaim vertical space.
  const [toolbarHidden, setToolbarHidden] = createSignal(false)
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

  // The 3D view carries its own transport/input controls in its overlay, so the
  // shared toolbar would just duplicate them — hide it there by default (still
  // toggleable via "Show bar"). Other views always show it.
  createEffect(() => {
    setToolbarHidden(guitarView() === '3d')
  })

  return (
    <div id="guitar-practice-panel">
      <Show when={!toolbarHidden()}>
        <SharedControlToolbar
          activeTab={activeTab}
          guitarTab={() => activeTab() === TAB_GUITAR}
          isPlaying={() =>
            guitar.gameState() === 'playing' ||
            guitar.gameState() === 'countdown'
          }
          isPaused={() => guitar.gameState() === 'paused'}
          onPlay={() => void guitar.startGame()}
          onPause={guitar.pauseGame}
          onResume={guitar.resumeGame}
          onStop={guitar.stopGame}
          volume={props.volume}
          onVolumeChange={(vol) => {
            props.setVolume(vol)
            audioEngine?.setVolume(vol / 100)
          }}
          speed={1}
          onSpeedChange={() => {}}
          metronomeEnabled={() => false}
          onMetronomeToggle={() => {}}
          playMode={() => PLAYBACK_MODE_ONCE}
          playModeChange={() => {}}
          practiceCycles={() => 1}
          onCyclesChange={() => {}}
          currentCycle={() => 1}
          practiceSubMode={() => 'all' as const}
          onPracticeSubModeChange={() => {}}
          isCountingIn={() => guitar.gameState() === 'countdown'}
          countInBeat={() =>
            guitar.playheadBeat() < 0 ? Math.ceil(-guitar.playheadBeat()) : 0
          }
          countInBeats={() => countIn()}
          showNoteLabels={guitar.showNoteLabels}
          onToggleNoteLabels={() => guitar.setShowNoteLabels((p) => !p)}
          showUserNotes={guitar.showUserNotes}
          onToggleUserNotes={() => guitar.setShowUserNotes((p) => !p)}
          bpmValue={guitarView() === 'interactive' ? drumBpm : guitar.songBpm}
          onBpmChange={
            guitarView() === 'interactive'
              ? (b: number) => {
                  drumMachine.setBpm(b)
                  setDrumBpm(b)
                }
              : () => {}
          }
          onMicToggle={() =>
            guitar.isMicActive() ? guitar.stopMic() : void guitar.startMic()
          }
          onMidiToggle={() =>
            guitar.midiConnected()
              ? guitar.midiDisconnect()
              : void guitar.midiConnect()
          }
          midiConnected={guitar.midiConnected}
        />
      </Show>
      <div class="gp-header-controls">
        <div class="gp-header-left" data-tour="guitar.song-picker">
          <GuitarPracticeSongPicker
            onSongLoaded={guitar.loadSong}
            currentSong={guitar.currentSong}
            mutedTrackIds={guitar.mutedTrackIds}
            onToggleMute={guitar.toggleTrackMute}
            visibleTrackIds={guitar.visibleTrackIds}
            onToggleVisibility={guitar.toggleTrackVisibility}
            playheadBeat={guitar.playheadBeat}
            totalBeats={guitar.totalBeats}
            songBpm={guitar.songBpm}
            onSeek={guitar.seekToBeat}
          />
        </div>
        <div class="gp-header-right">
          <div class="gp-instrument-selector" data-tour="guitar.instruments">
            <span class="gp-instrument-label">Sound:</span>
            <For
              each={
                [
                  {
                    value: 'guitar-acoustic' as InstrumentType,
                    label: 'Acoustic',
                  },
                  {
                    value: 'guitar-electric' as InstrumentType,
                    label: 'Electric',
                  },
                  {
                    value: 'bass' as InstrumentType,
                    label: 'Bass',
                  },
                ] as const
              }
            >
              {(opt) => (
                <button
                  class="gp-instrument-btn"
                  classList={{
                    'gp-instrument-active':
                      guitar.instrumentType() === opt.value,
                  }}
                  onClick={() => guitar.setInstrumentType(opt.value)}
                >
                  {opt.label}
                </button>
              )}
            </For>
          </div>
          <div data-tour="guitar.view-toggle">
            <GuitarViewToggle
              activeView={guitarView}
              onViewChange={setGuitarView}
            />
          </div>
          <button
            class="gp-btn gp-toolbar-toggle"
            title={
              toolbarHidden()
                ? 'Show transport controls'
                : 'Hide transport controls'
            }
            aria-label={
              toolbarHidden()
                ? 'Show transport controls'
                : 'Hide transport controls'
            }
            aria-pressed={toolbarHidden()}
            onClick={() => setToolbarHidden((v) => !v)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d={toolbarHidden() ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} />
            </svg>
            {toolbarHidden() ? 'Show bar' : 'Hide bar'}
          </button>
          <button
            class="gp-btn gp-toolbar-toggle"
            title="Audio input/output devices"
            aria-label="Audio input/output devices"
            aria-pressed={devicesOpen()}
            onClick={() => setDevicesOpen((v) => !v)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 10v4h4l5 4V6l-5 4z" />
              <path d="M16 8a5 5 0 0 1 0 8" />
            </svg>
            Devices
          </button>
        </div>
      </div>
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
        style={{ position: 'relative' }}
      >
        <MicInsightHint
          message={micInsights.message}
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            'z-index': '6',
            'white-space': 'nowrap',
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
      <Show when={guitar.gameState() === 'finished' && guitarView() !== '3d'}>
        <div class="gp-score-overlay">
          <div class="gp-score-card">
            <h2>Complete!</h2>
            <div class="gp-score-grade">
              {(() => {
                const s = guitar.score()
                const t = guitar.totalNotes()
                const pct = t > 0 ? Math.round((s / (t * 100)) * 100) : 0
                return pct >= 90
                  ? 'Pitch Perfect!'
                  : pct >= 80
                    ? 'Excellent!'
                    : pct >= 65
                      ? 'Good!'
                      : pct >= 50
                        ? 'Okay!'
                        : 'Keep Practicing!'
              })()}
            </div>
            <div class="gp-score-pct">
              {guitar.totalNotes() > 0
                ? Math.round(
                    (guitar.score() / (guitar.totalNotes() * 100)) * 100,
                  )
                : 0}
              %
            </div>
            <div class="gp-score-detail">
              {guitar.totalNotes()} notes · Max Combo: {guitar.maxCombo()}x
            </div>
            <div class="gp-score-actions">
              <button
                class="gp-btn gp-btn-play"
                onClick={() => void guitar.startGame()}
              >
                Play Again
              </button>
              <button class="gp-btn gp-btn-close" onClick={guitar.stopGame}>
                Close
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
