import type { Accessor } from 'solid-js'
import { createEffect, on, Show } from 'solid-js'
import { FallingNotesCanvas } from '@/components/FallingNotesCanvas'
import { FallingNotesSongPicker } from '@/components/FallingNotesSongPicker'
import { MicInsightHint } from '@/components/MicInsightHint'
import { PianoControlBar } from '@/components/piano/PianoControlBar'
import { ControlOverlay } from '@/components/shared/control-bar/ControlOverlay'
import type { useFallingNotesController } from '@/features/falling-notes/useFallingNotesController'
import { useMicInsights } from '@/features/mic-feedback/useMicInsights'
import { PLAYBACK_MODE_ONCE, PLAYBACK_MODE_REPEAT, } from '@/features/tabs/constants'
import { recordActivity } from '@/stores/usage-store'

type FallingNotesController = ReturnType<typeof useFallingNotesController>

interface PianoPageProps {
  fallingNotes: FallingNotesController
  /** Derived in AppShell (also consumed by the playback wiring), threaded in. */
  isPlaying: Accessor<boolean>
  isPaused: Accessor<boolean>
  /** Shared volume signal (used across tabs), owned by AppShell. */
  volume: Accessor<number>
  onVolumeChange: (vol: number) => void
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

  return (
    <div id="falling-notes-panel">
      <div data-tour="piano.song-picker">
        <FallingNotesSongPicker
          onSongLoaded={fallingNotes.loadSong}
          currentSong={fallingNotes.currentSong}
          mutedTrackIds={fallingNotes.mutedTrackIds}
          onToggleMute={fallingNotes.toggleTrackMute}
          visibleTrackIds={fallingNotes.visibleTrackIds}
          onToggleVisibility={fallingNotes.toggleTrackVisibility}
          playheadBeat={fallingNotes.playheadBeat}
          totalBeats={fallingNotes.totalBeats}
          songBpm={fallingNotes.currentSongBpm}
          onSeek={fallingNotes.seekToBeat}
        />
      </div>
      <div
        id="falling-notes-canvas-container"
        data-tour="piano.canvas"
        style={{ position: 'relative' }}
      >
        <MicInsightHint
          message={micInsights.message}
          insight={micInsights.insight}
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            'z-index': '6',
            'white-space': 'nowrap',
          }}
        />
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
        />
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
                void fallingNotes.startMic()
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
          />
        </ControlOverlay>
      </div>
      {/* Score overlay for finished game */}
      <Show when={fallingNotes.gameState() === 'finished'}>
        <div class="fn-score-overlay">
          <div class="fn-score-card">
            <h2>Complete!</h2>
            <div class="fn-score-grade">
              {(() => {
                const s = fallingNotes.score()
                const t = fallingNotes.totalNotes()
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
            <div class="fn-score-pct">
              {fallingNotes.totalNotes() > 0
                ? Math.round(
                    (fallingNotes.score() / (fallingNotes.totalNotes() * 100)) *
                      100,
                  )
                : 0}
              %
            </div>
            <div class="fn-score-detail">
              {fallingNotes.totalNotes()} notes · Max Combo:{' '}
              {fallingNotes.maxCombo()}x
            </div>
            <div class="fn-score-actions">
              <button
                class="fn-btn fn-btn-play"
                onClick={() => void fallingNotes.startGame()}
                aria-label="Play again"
                title="Play again"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>{' '}
                Play Again
              </button>
              <button
                class="fn-btn fn-btn-close"
                onClick={fallingNotes.resetGame}
                aria-label="Close"
                title="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>{' '}
                Close
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
