import type { Accessor } from 'solid-js'
import { createEffect, createMemo, lazy, on, Show, Suspense } from 'solid-js'
import { FallingNotesCanvas } from '@/components/FallingNotesCanvas'
import { PianoKeys } from '@/components/icons'
import { MicInsightHint } from '@/components/MicInsightHint'
import { PianoMobileStage } from '@/components/mobile/PianoMobileStage'
import { PianoControlBar } from '@/components/piano/PianoControlBar'
import { PracticeViewToolbar } from '@/components/PracticeViewToolbar'
import { ControlOverlay } from '@/components/shared/control-bar/ControlOverlay'
import { MidiSongStatusBar } from '@/components/shared/status-bar/MidiSongStatusBar'
import barStyles from '@/components/shared/status-bar/SongStatusBar.module.css'
import type { useFallingNotesController } from '@/features/falling-notes/useFallingNotesController'
import { useMicInsights } from '@/features/mic-feedback/useMicInsights'
import { fallingNotesToMelodyItems, melodyItemsToFallingNotes, midiSongNotesToFallingNotes, } from '@/features/piano/legacy/piano-song-adapter'
import launchStyles from '@/features/piano-night/PianoNightLaunch.module.css'
import { PIANO_NIGHT_PATH } from '@/features/piano-night/route'
import { useLibraryMelodySelection } from '@/features/practice/useLibraryMelodySelection'
import { PLAYBACK_MODE_ONCE, PLAYBACK_MODE_REPEAT, } from '@/features/tabs/constants'
import { useFileDropZone } from '@/lib/use-file-drop-zone'
import { useMidiSongPicker } from '@/lib/use-midi-song-picker'
import { isNarrow } from '@/lib/use-viewport'
import { keyName, scaleType, showNotification } from '@/stores'
import type { FallingNote } from '@/stores/falling-notes-store'
import { selectedSongName } from '@/stores/falling-notes-store'
import { melodyStore } from '@/stores/melody-store'
import { pianoSheetView, setPianoSheetView } from '@/stores/ui-store'
import { recordActivity } from '@/stores/usage-store'

const SheetMusicView = lazy(async () =>
  import('@/components/SheetMusicView').then((m) => ({
    default: m.SheetMusicView,
  })),
)

type FallingNotesController = ReturnType<typeof useFallingNotesController>

interface PianoPageProps {
  fallingNotes: FallingNotesController
  /** Derived in AppShell (also consumed by the playback wiring), threaded in. */
  isPlaying: Accessor<boolean>
  isPaused: Accessor<boolean>
  /** Shared volume signal (used across tabs), owned by AppShell. */
  volume: Accessor<number>
  onVolumeChange: (vol: number) => void
  // A-B Loop (shared across tabs)
  loopEnabled: () => boolean
  loopA: () => number
  loopB: () => number
  onSetLoopA: () => void
  onSetLoopB: () => void
  onToggleLoop: () => void
  onClearLoop: () => void
  /** Drag the A / B markers on the seek rail (beats). */
  onMoveLoopA: (beat: number) => void
  onMoveLoopB: (beat: number) => void
  /** Loop-aware seek (records loop-escape so scrubbing past B isn't yanked
   *  back); falls back to the raw controller seek when absent. */
  onSeek?: (beat: number) => void
}

/** Piano tab (TAB_PIANO): falling-notes game with toolbar + song picker. */
export function PianoPage(props: PianoPageProps) {
  // Stable controller created once in AppShell — aliasing it is safe (it never
  // changes), so the reactive-prop warning is a false positive here.
  // eslint-disable-next-line solid/reactivity
  const fallingNotes = props.fallingNotes

  // Mic feedback: "can't hear you" / "too quiet" while playing the game.
  const micInsights = useMicInsights({
    micActive: fallingNotes.isMicActive,
    isPlaying: () => fallingNotes.gameState() === 'playing',
    getLevel: fallingNotes.getInputLevel,
    isDetecting: () => (fallingNotes.currentPitch()?.frequency ?? 0) > 0,
  })

  // Each game run counts as real app usage (gates the survey).
  // Edge-triggered via on() so the effect depends only on the game state.
  createEffect(
    on(
      () => fallingNotes.gameState(),
      (state) => {
        if (state === 'playing') recordActivity()
      },
    ),
  )
  useLibraryMelodySelection(melodyStore.getCurrentMelody, (melody) => {
    const notes = melodyItemsToFallingNotes(melody.items)
    fallingNotes.loadSong(notes, melody.name, melody.bpm, [], [], null)
  })
  const picker = useMidiSongPicker<FallingNote>({
    currentSong: () => fallingNotes.currentSong(),
    fromMelodyItems: melodyItemsToFallingNotes,
    fromScoreNotes: midiSongNotesToFallingNotes,
    fromBackingNotes: (notes, trackId) =>
      midiSongNotesToFallingNotes(notes).map((note) => ({ ...note, trackId })),
    onSongLoaded: (items, name, bpm, backing, muted, song) =>
      fallingNotes.loadSong(items, name, bpm, backing, muted, song),
    onScoreTrackChange: (items, name, bpm, backing, muted, song) =>
      fallingNotes.changeScoreTrack(items, name, bpm, backing, muted, song),
    // The page remounts on every tab visit; the controller (and its loaded
    // song) live app-wide — don't clobber them with the first library melody.
    skipAutoLoad: () => selectedSongName() !== '',
    prepareImportedMidi: async (file, options) => {
      const { importPianoProjectForLegacy } =
        await import('@/features/piano-project/import-piano-project-for-legacy')
      return importPianoProjectForLegacy(file, options)
    },
    persistMidiSelection: async (song) => {
      const { persistPianoCompatibilitySelection } =
        await import('@/features/piano-project/import-piano-project-for-legacy')
      await persistPianoCompatibilitySelection(song)
    },
  })

  const dropZone = useFileDropZone({
    accept: /\.(mid|midi)$/i,
    onFiles: (files) => void picker.importMidiFile(files[0]),
    onRejected: () =>
      showNotification('Drop a .mid or .midi file to load it here.', 'info'),
  })

  // Shared factories: the desktop tree and the mobile stage each mount
  // their OWN instances inside their branch (a canvas must never be
  // re-parented across the isNarrow() swap). The controller lives in
  // AppShell above the branch, so swapping is presentation-only.
  const renderFallingCanvas = () => (
    <FallingNotesCanvas
      songNotes={fallingNotes.songNotes}
      gameState={fallingNotes.gameState}
      playheadBeat={fallingNotes.playheadBeat}
      hitResults={fallingNotes.hitResults}
      combo={fallingNotes.combo}
      score={fallingNotes.score}
      totalNotes={fallingNotes.totalNotes}
      notesMissed={fallingNotes.notesMissed}
      currentPitch={fallingNotes.currentPitch}
      isMicActive={fallingNotes.isMicActive}
      inputMode={fallingNotes.inputMode}
      visibleBeatWindow={fallingNotes.visibleBeatWindow}
      midiHeldNotes={fallingNotes.midiHeldNotes}
      onClickPianoOn={fallingNotes.clickPianoNoteOn}
      onClickPianoOff={fallingNotes.clickPianoNoteOff}
      clickPianoEnabled={fallingNotes.clickPianoEnabled}
      loopA={props.loopA}
      loopB={props.loopB}
      loopEnabled={props.loopEnabled}
      onMoveLoopA={props.onMoveLoopA}
      onMoveLoopB={props.onMoveLoopB}
    />
  )

  const sheetMelody = createMemo(() =>
    fallingNotesToMelodyItems(fallingNotes.songNotes()),
  )

  const renderMicHint = (top: string) => (
    <MicInsightHint
      message={micInsights.message}
      insight={micInsights.insight}
      style={{
        position: 'absolute',
        top,
        left: '50%',
        transform: 'translateX(-50%)',
        'z-index': '6',
        'white-space': 'nowrap',
      }}
    />
  )

  // Finished-run score: a quiet corner readout (same pattern as the
  // Singing scoreboard) — no action buttons; the transport's play
  // control already restarts a finished run, and loading a song resets.
  const renderScoreCard = () => (
    <Show when={fallingNotes.gameState() === 'finished'}>
      {(() => {
        const pct = () => {
          const t = fallingNotes.totalNotes()
          return t > 0
            ? Math.round((fallingNotes.score() / (t * 100)) * 100)
            : 0
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
          <div
            class="fn-score-corner fn-score-corner--quiet"
            aria-label="Run score"
          >
            <span class="fn-score-corner-title">Complete</span>
            <span class="fn-score-corner-pct">{pct()}%</span>
            <span class="fn-score-corner-grade">{grade()}</span>
            <span class="fn-score-corner-detail">
              {fallingNotes.totalNotes()} notes · Max Combo:{' '}
              {fallingNotes.maxCombo()}x
            </span>
          </div>
        )
      })()}
    </Show>
  )

  return (
    <Show
      when={!isNarrow()}
      fallback={
        <PianoMobileStage
          fallingNotes={fallingNotes}
          picker={picker}
          onSeek={props.onSeek ?? fallingNotes.seekToBeat}
          volume={props.volume}
          onVolumeChange={props.onVolumeChange}
          renderCanvas={renderFallingCanvas}
          renderMicHint={() => renderMicHint('10px')}
          renderScoreCard={renderScoreCard}
        />
      }
    >
      <div id="falling-notes-panel">
        {/* In flow above the canvas, so the canvas HUD (score corners) keeps
          the full canvas top to itself. */}
        <MidiSongStatusBar
          picker={picker}
          prefix="fn"
          dataTour="piano.song-picker"
          currentSong={fallingNotes.currentSong}
          mutedTrackIds={fallingNotes.mutedTrackIds}
          onToggleMute={fallingNotes.toggleTrackMute}
          visibleTrackIds={fallingNotes.visibleTrackIds}
          onToggleVisibility={fallingNotes.toggleTrackVisibility}
          playheadBeat={fallingNotes.playheadBeat}
          totalBeats={fallingNotes.totalBeats}
          songBpm={fallingNotes.currentSongBpm}
          onSeek={props.onSeek ?? fallingNotes.seekToBeat}
          songName={selectedSongName}
          isPlaying={() => fallingNotes.gameState() === 'playing'}
          loopA={props.loopA}
          loopB={props.loopB}
          loopEnabled={props.loopEnabled}
          onMoveLoopA={props.onMoveLoopA}
          onMoveLoopB={props.onMoveLoopB}
          extraActions={
            <a
              class={`${barStyles.chipBtn} ${launchStyles.desktopLink}`}
              href={PIANO_NIGHT_PATH}
              title="Open Piano Night — the new Performance Horizon room"
              data-tour="piano-night-launch"
              data-testid="open-piano-night"
            >
              <span class={launchStyles.nightGlyph} aria-hidden="true">
                <PianoKeys />
              </span>
              <span class={barStyles.chipLabel}>Piano Night</span>
            </a>
          }
        />
        <PracticeViewToolbar
          context="Piano guide"
          sheetActive={pianoSheetView}
          onViewChange={setPianoSheetView}
        />
        <div
          id="falling-notes-canvas-container"
          data-tour="piano.canvas"
          ref={dropZone.bind}
          style={{ position: 'relative' }}
        >
          <Show when={dropZone.isDragOver()}>
            <div class={barStyles.dropOverlay}>
              <span class={barStyles.dropLabel}>Drop MIDI to load</span>
            </div>
          </Show>
          <Show when={!pianoSheetView()}>
            {/* Below the top-docked control bar. */}
            {renderMicHint('68px')}
          </Show>
          <Show
            when={!pianoSheetView()}
            fallback={
              <div class="practice-sheet-surface">
                <Suspense
                  fallback={
                    <div class="sheet-loading">Preparing notation…</div>
                  }
                >
                  <SheetMusicView
                    melody={sheetMelody}
                    musicKey={keyName}
                    scaleType={scaleType}
                    currentBeat={fallingNotes.playheadBeat}
                    isPlaying={() => fallingNotes.gameState() === 'playing'}
                    onSeek={props.onSeek ?? fallingNotes.seekToBeat}
                  />
                </Suspense>
              </div>
            }
          >
            {renderFallingCanvas()}
          </Show>
          <ControlOverlay
            idPrefix="piano"
            containerSelector="#falling-notes-canvas-container"
            defaultDock="top"
          >
            <PianoControlBar
              isPlaying={props.isPlaying}
              isPaused={props.isPaused}
              onPlay={() => {
                // Fresh user-triggered Play resets cycle counter.
                if (fallingNotes.gameState() !== 'paused') {
                  fallingNotes.setPianoCurrentCycle(1)
                }
                void fallingNotes.startGame()
              }}
              onPause={fallingNotes.pauseGame}
              onResume={fallingNotes.resumeGame}
              onStop={fallingNotes.resetGame}
              playMode={() =>
                fallingNotes.pianoPlayMode() === 'repeat'
                  ? PLAYBACK_MODE_REPEAT
                  : PLAYBACK_MODE_ONCE
              }
              playModeChange={(mode) => {
                fallingNotes.setPianoPlayMode(
                  mode === PLAYBACK_MODE_REPEAT ? 'repeat' : 'once',
                )
                if (mode === PLAYBACK_MODE_REPEAT) {
                  fallingNotes.setPianoCurrentCycle(1)
                }
              }}
              practiceCycles={() => fallingNotes.pianoRepeatCycles()}
              onCyclesChange={(n) => fallingNotes.setPianoRepeatCycles(n)}
              currentCycle={() => fallingNotes.pianoCurrentCycle()}
              isCountingIn={() => fallingNotes.isCountingIn()}
              countInBeat={() => fallingNotes.countInBeat()}
              volume={props.volume}
              onVolumeChange={props.onVolumeChange}
              speed={fallingNotes.speed}
              onSpeedChange={fallingNotes.setSpeed}
              bpm={fallingNotes.currentSongBpm}
              onBpmChange={fallingNotes.setBpm}
              micActive={fallingNotes.isMicActive}
              onMicToggle={() => {
                if (fallingNotes.isMicActive()) {
                  fallingNotes.stopMic()
                } else {
                  void fallingNotes.startMic().then((ok) => {
                    if (!ok) {
                      showNotification(
                        'Microphone unavailable — check permissions or the selected input device.',
                        'error',
                      )
                    }
                  })
                }
              }}
              midiConnected={fallingNotes.midiConnected}
              onMidiToggle={() => {
                if (fallingNotes.midiConnected()) {
                  fallingNotes.midiDisconnect()
                } else {
                  void fallingNotes.midiConnect()
                }
              }}
              showNoteLabels={fallingNotes.showNoteLabels}
              onToggleNoteLabels={fallingNotes.toggleNoteLabels}
              zoomPercent={fallingNotes.zoomPercent}
              onZoomIn={fallingNotes.zoomIn}
              onZoomOut={fallingNotes.zoomOut}
              loopEnabled={props.loopEnabled}
              loopA={props.loopA}
              loopB={props.loopB}
              onSetLoopA={props.onSetLoopA}
              onSetLoopB={props.onSetLoopB}
              onToggleLoop={props.onToggleLoop}
              onClearLoop={props.onClearLoop}
            />
          </ControlOverlay>
          {renderScoreCard()}
        </div>
      </div>
    </Show>
  )
}
