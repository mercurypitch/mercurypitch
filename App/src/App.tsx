// ============================================================
// App — Main SolidJS application entry
// Matches the original JS app's HTML structure exactly
// ============================================================

import {
  Component,
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  Show,
} from 'solid-js';
import { PianoRollCanvas } from '@/components/PianoRollCanvas';
import { PitchDisplay } from '@/components/PitchDisplay';
import { PitchCanvas } from '@/components/PitchCanvas';
import { NoteList } from '@/components/NoteList';
import { MicButton } from '@/components/MicButton';
import { MetronomeButton } from '@/components/MetronomeButton';
import { HistoryCanvas } from '@/components/HistoryCanvas';
import { appStore } from '@/stores/app-store';
import { playback } from '@/stores/playback-store';
import { melodyStore } from '@/stores/melody-store';
import { melodyTotalBeats } from '@/lib/scale-data';
import { AudioEngine } from '@/lib/audio-engine';
import { MelodyEngine } from '@/lib/melody-engine';
import { PracticeEngine } from '@/lib/practice-engine';
import type { PitchResult, NoteResult, PracticeResult } from '@/types';
import type { PlaybackState } from '@/lib/piano-roll';
import type { PitchSample } from '@/components/PitchCanvas';

// ── Engine instances (single shared) ────────────────────────

let audioEngine: AudioEngine;
let melodyEngine: MelodyEngine;
let practiceEngine: PracticeEngine;

interface AppProps {
  onMounted?: () => void;
}

export const App: Component<AppProps> = (props) => {
  // ── Derived state ──────────────────────────────────────────

  const totalBeats = createMemo(() => melodyTotalBeats(melodyStore.items));

  // ── Practice mode signals ───────────────────────────────────

  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isPaused, setIsPaused] = createSignal(false);
  const [currentBeat, setCurrentBeat] = createSignal(0);
  const [currentNoteIndex, setCurrentNoteIndex] = createSignal(-1);
  const [pitchHistory, setPitchHistory] = createSignal<PitchSample[]>([]);
  const [currentPitch, setCurrentPitch] = createSignal<PitchResult | null>(null);
  const [noteResults, setNoteResults] = createSignal<NoteResult[]>([]);
  const [practiceResult, setPracticeResult] = createSignal<PracticeResult | null>(null);
  const [liveScore, setLiveScore] = createSignal<number | null>(null);
  const [frequencyData, setFrequencyData] = createSignal<Float32Array | null>(null);
  const [metronomeActive, setMetronomeActive] = createSignal(false);

  // ── Stats panel ──────────────────────────────────────────────

  const statsCounts = createMemo(() => {
    const results = noteResults();
    return {
      perfect: results.filter((r) => r.rating === 'perfect').length,
      excellent: results.filter((r) => r.rating === 'excellent').length,
      good: results.filter((r) => r.rating === 'good').length,
      okay: results.filter((r) => r.rating === 'okay').length,
      off: results.filter((r) => r.rating === 'off').length,
    };
  });

  createEffect(() => {
    const counts = statsCounts();
    const total = Math.max(1, counts.perfect + counts.excellent + counts.good + counts.okay + counts.off);

    const updateBar = (id: string, count: number) => {
      const el = document.getElementById(id);
      if (el) el.style.width = `${(count / total) * 100}%`;
      const cntEl = document.getElementById(`cnt-${id}`);
      if (cntEl) cntEl.textContent = String(count);
    };

    updateBar('bar-100', counts.perfect);
    updateBar('bar-90', counts.excellent);
    updateBar('bar-75', counts.good);
    updateBar('bar-50', counts.okay);
    updateBar('bar-0', counts.off);
  });

  // ── Engine lifecycle ────────────────────────────────────────

  onMount(() => {
    // Initialize presets from localStorage
    appStore.initPresets();

    // Load saved volume
    const savedVol = parseInt(localStorage.getItem('pp_volume') || '80', 10);
    audioEngine = new AudioEngine();
    audioEngine.setVolume(savedVol / 100);

    melodyEngine = new MelodyEngine({
      bpm: appStore.bpm(),
      melody: melodyStore.items,
      onNoteStart: (note, noteIndex) => {
        setCurrentNoteIndex(noteIndex);
        practiceEngine.onNoteStart(note, noteIndex);
      },
      onBeatUpdate: (beat) => {
        setCurrentBeat(beat);
      },
      onComplete: () => {
        const results = practiceEngine.onPlaybackComplete();
        if (results) {
          setNoteResults(results);
          const pr = practiceEngine.calculatePracticeResult(results);
          setPracticeResult(pr);
          setLiveScore(pr.score);
          appStore.setLastScore(pr.score);
          appStore.setPracticeCount(appStore.practiceCount() + 1);
          appStore.showNotification(
            `Practice complete! Score: ${pr.score}%`,
            pr.score >= 80 ? 'success' : pr.score >= 50 ? 'info' : 'warning'
          );
        }
        handleStop();
      },
    });
    practiceEngine = new PracticeEngine(audioEngine, { sensitivity: 5 });

    // Link practice callbacks
    practiceEngine.setCallbacks({
      onPitchDetected: (pitch) => {
        setCurrentPitch(pitch);
        if (pitch.frequency > 0 && pitch.clarity >= 0.2) {
          setFrequencyData(audioEngine.getFrequencyData());
        }
      },
      onNoteComplete: (result) => {
        setNoteResults((prev) => [...prev, result]);
        // Update live score
        const allResults = [...noteResults(), result];
        setLiveScore(practiceEngine.calculateScore(allResults));
      },
      onMicStateChange: (active, error) => {
        appStore.setMicActive(active);
        if (error) {
          appStore.setMicError(error);
          appStore.showNotification(error, 'error');
        }
      },
    });

    // Listen for preset events from piano roll
    const handlePresetSaved = (e: CustomEvent) => {
      appStore.showNotification(`Preset "${e.detail.name}" saved`, 'success');
    };
    const handlePresetLoaded = (e: CustomEvent) => {
      if (e.detail.bpm) {
        appStore.setBpm(e.detail.bpm);
        melodyEngine.setBPM(e.detail.bpm);
      }
      if (e.detail.melody) {
        melodyStore.setMelody(e.detail.melody);
      }
      appStore.showNotification(`Preset "${e.detail.name}" loaded`, 'info');
    };
    window.addEventListener('pitchperfect:presetSaved', handlePresetSaved as EventListener);
    window.addEventListener('pitchperfect:presetLoaded', handlePresetLoaded as EventListener);

    // Animation loop for pitch history
    let animId: number;
    const loop = () => {
      const pitch = practiceEngine.update();
      if (pitch && pitch.frequency > 0 && pitch.clarity >= 0.2) {
        const beat = melodyEngine.getCurrentBeat();
        setPitchHistory((prev) => {
          const next = [...prev, { beat, freq: pitch.frequency, confidence: pitch.clarity }];
          return next.length > 800 ? next.slice(-800) : next;
        });
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    onCleanup(() => {
      cancelAnimationFrame(animId);
      melodyEngine.destroy();
      practiceEngine.destroy();
      audioEngine.destroy();
      window.removeEventListener('pitchperfect:presetSaved', handlePresetSaved as EventListener);
      window.removeEventListener('pitchperfect:presetLoaded', handlePresetLoaded as EventListener);
    });

    // Signal that app has fully initialized (for FOUC prevention)
    props.onMounted?.();
  });

  // ── Playback handlers ───────────────────────────────────────

  const handlePlay = async () => {
    if (isPaused()) {
      handleResume();
      return;
    }

    // Reset state
    setPitchHistory([]);
    setNoteResults([]);
    setPracticeResult(null);
    setLiveScore(null);
    setCurrentBeat(0);
    setCurrentNoteIndex(-1);
    melodyStore.setCurrentNoteIndex(-1);

    // Sync engine with current melody/bpm
    melodyEngine.setMelody(melodyStore.items);
    melodyEngine.setBPM(appStore.bpm());

    practiceEngine.startSession();
    setIsPlaying(true);
    setIsPaused(false);
    playback.startPlayback();

    melodyEngine.start();
  };

  const handlePause = () => {
    melodyEngine.pause();
    setIsPlaying(false);
    setIsPaused(true);
    playback.pausePlayback();
  };

  const handleResume = () => {
    melodyEngine.resume();
    setIsPlaying(true);
    setIsPaused(false);
    playback.continuePlayback();
  };

  const handleStop = () => {
    melodyEngine.stop();
    practiceEngine.endSession();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentBeat(0);
    setCurrentNoteIndex(-1);
    melodyStore.setCurrentNoteIndex(-1);
    setPitchHistory([]);
    playback.resetPlayback();
  };

  const handleReset = () => {
    handleStop();
    setNoteResults([]);
    setPracticeResult(null);
    setLiveScore(null);
  };

  // ── Mic handlers ─────────────────────────────────────────────

  const handleMicToggle = async () => {
    if (appStore.micActive()) {
      practiceEngine.stopMic();
    } else {
      await practiceEngine.startMic();
    }
  };

  // ── Metronome ──────────────────────────────────────────────

  const handleMetronomeToggle = () => {
    setMetronomeActive((prev) => !prev);
  };


  // ── Tab switching ─────────────────────────────────────────────

  const handleTabPractice = () => {
    appStore.setActiveTab('practice');
  };

  const handleTabEditor = () => {
    appStore.setActiveTab('editor');
  };

  // ── Target note for pitch display ───────────────────────────

  const targetNote = createMemo(() => {
    const idx = currentNoteIndex();
    if (idx < 0 || idx >= melodyStore.items.length) return null;
    return melodyStore.items[idx].note;
  });

  const targetNoteName = createMemo(() => {
    const note = targetNote();
    if (!note) return null;
    return note.name + note.octave;
  });

  // ── Score overlay ──────────────────────────────────────────

  const scoreGrade = createMemo(() => {
    const pr = practiceResult();
    if (!pr) return '';
    if (pr.score >= 90) return 'grade-perfect';
    if (pr.score >= 80) return 'grade-excellent';
    if (pr.score >= 65) return 'grade-good';
    if (pr.score >= 50) return 'grade-okay';
    return 'grade-needs-work';
  });

  const scoreLabel = createMemo(() => {
    const pr = practiceResult();
    if (!pr) return '';
    if (pr.score >= 90) return 'Pitch Perfect!';
    if (pr.score >= 80) return 'Excellent!';
    if (pr.score >= 65) return 'Good!';
    if (pr.score >= 50) return 'Okay!';
    return 'Needs Work';
  });

  const closeScoreOverlay = () => {
    setPracticeResult(null);
    setLiveScore(null);
  };

  return (
    <div id="app">
      {/* Header */}
      <header>
        <h1 id="app-title">PitchPerfect</h1>
        <p class="subtitle">Voice Pitch Practice</p>
        <nav id="app-tabs">
          <button
            id="tab-practice"
            class={`app-tab ${appStore.activeTab() === 'practice' ? 'active' : ''}`}
            onClick={handleTabPractice}
          >
            Practice
          </button>
          <button
            id="tab-editor"
            class={`app-tab ${appStore.activeTab() === 'editor' ? 'active' : ''}`}
            onClick={handleTabEditor}
          >
            Editor
          </button>
        </nav>
      </header>

      {/* Main layout */}
      <div class="main-layout" id="main-layout">
        {/* Practice tab — notes panel + pitch area side by side */}
        <Show when={appStore.activeTab() !== 'editor'}>
          {/* Left panel — scale info and note list */}
          <aside id="notes-panel">
            <h2 class="panel-title">Scale</h2>

            {/* Scale controls */}
            <div id="scale-info">
              <span class="key-label">Key:</span>
              <select
                id="key-select"
                value={appStore.keyName()}
                onChange={(e) => {
                  const key = e.currentTarget.value;
                  appStore.setKeyName(key);
                  melodyStore.refreshScale(key, melodyStore.currentOctave(), appStore.scaleType());
                }}
              >
                <option value="C">C</option>
                <option value="G">G</option>
                <option value="D">D</option>
                <option value="A">A</option>
                <option value="E">E</option>
                <option value="B">B</option>
                <option value="F">F</option>
                <option value="Bb">Bb</option>
              </select>

              <span class="octave-label">Oct:</span>
              <div class="octave-ctrl">
                <button class="octave-btn" title="Lower octave" onClick={() => melodyStore.refreshScale(appStore.keyName(), Math.max(1, melodyStore.currentOctave() - 1), appStore.scaleType())}>
                  <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
                </button>
                <span class="octave-value">{melodyStore.currentOctave()}</span>
                <button class="octave-btn" title="Higher octave" onClick={() => melodyStore.refreshScale(appStore.keyName(), Math.min(6, melodyStore.currentOctave() + 1), appStore.scaleType())}>
                  <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
                </button>
              </div>

              <span class="preset-label">Scale:</span>
              <select
                id="preset-select"
                value={appStore.scaleType()}
                onChange={(e) => {
                  const st = e.currentTarget.value;
                  appStore.setScaleType(st);
                  melodyStore.refreshScale(appStore.keyName(), melodyStore.currentOctave(), st);
                }}
              >
                <option value="major">Major</option>
                <option value="natural-minor">Minor (Natural)</option>
                <option value="harmonic-minor">Harmonic Minor</option>
                <option value="melodic-minor">Melodic Minor</option>
                <option value="dorian">Dorian</option>
                <option value="mixolydian">Mixolydian</option>
                <option value="phrygian">Phrygian</option>
                <option value="lydian">Lydian</option>
                <option value="pentatonic-major">Pentatonic Major</option>
                <option value="pentatonic-minor">Pentatonic Minor</option>
                <option value="blues">Blues</option>
                <option value="chromatic">Chromatic</option>
              </select>

              <button
                class="ctrl-btn small"
                title="Clear melody"
                onClick={() => melodyStore.clearMelody()}
              >
                Clear
              </button>
            </div>

            {/* Note list */}
            <NoteList
              melody={() => melodyStore.items}
              currentNoteIndex={currentNoteIndex}
              noteResults={noteResults}
              isPlaying={isPlaying}
            />

            {/* Pitch reference */}
            <PitchDisplay
              pitch={currentPitch}
              targetNote={targetNoteName}
            />

            {/* Stats panel */}
            <div id="stats-panel">
              <h3>Accuracy</h3>
              <div id="stats-bars">
                <div class="stat-row" data-band="100">
                  <span class="stat-label">Perfect</span>
                  <div class="stat-bar-bg"><div class="stat-bar" id="bar-100" /></div>
                  <span class="stat-count" id="cnt-100">0</span>
                </div>
                <div class="stat-row" data-band="90">
                  <span class="stat-label">Excellent</span>
                  <div class="stat-bar-bg"><div class="stat-bar" id="bar-90" /></div>
                  <span class="stat-count" id="cnt-90">0</span>
                </div>
                <div class="stat-row" data-band="75">
                  <span class="stat-label">Good</span>
                  <div class="stat-bar-bg"><div class="stat-bar" id="bar-75" /></div>
                  <span class="stat-count" id="cnt-75">0</span>
                </div>
                <div class="stat-row" data-band="50">
                  <span class="stat-label">Okay</span>
                  <div class="stat-bar-bg"><div class="stat-bar" id="bar-50" /></div>
                  <span class="stat-count" id="cnt-50">0</span>
                </div>
                <div class="stat-row" data-band="0">
                  <span class="stat-label">Off</span>
                  <div class="stat-bar-bg"><div class="stat-bar" id="bar-0" /></div>
                  <span class="stat-count" id="cnt-0">0</span>
                </div>
              </div>
              <div id="score-display">
                <span id="score-label">Score:</span>
                <span id="score-value">
                  {liveScore() !== null ? `${liveScore()}%` : '--'}
                </span>
              </div>
            </div>
          </aside>

          {/* Right panel — pitch area */}
          <main id="pitch-area">
            {/* Controls bar */}
            <div id="controls">
              {/* Transport */}
              <MicButton
                active={appStore.micActive()}
                onClick={handleMicToggle}
                disabled={isPlaying() || isPaused()}
              />

              {/* Inline play/reset instead of TransportControls wrapper */}
              <button
                id="btn-play"
                class="ctrl-btn"
                onClick={() => {
                  if (isPlaying()) {
                    handlePause();
                  } else if (isPaused()) {
                    handleResume();
                  } else {
                    handlePlay();
                  }
                }}
              >
                {isPlaying() ? (
                  <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                )}
                <span>{isPlaying() ? 'Pause' : isPaused() ? 'Continue' : 'Start'}</span>
              </button>

              <button
                id="btn-reset"
                class="ctrl-btn"
                onClick={handleReset}
                disabled={!isPlaying() && !isPaused()}
              >
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>
                <span>Reset</span>
              </button>

              <div class="ctrl-sep" />

              {/* Mode toggles */}
              <div id="mode-group">
                <button id="btn-once" class="mode-btn active">Once</button>
                <button id="btn-repeat" class="mode-btn">Repeat</button>
                <button id="btn-practice" class="mode-btn">Practice</button>
              </div>

              <div class="ctrl-sep" />

              {/* Tempo */}
              <div class="tempo-group">
                <label class="opt-label">BPM:</label>
                <input
                  type="range"
                  id="tempo"
                  min="40"
                  max="280"
                  value={appStore.bpm()}
                  class="tempo-slider"
                  onInput={(e) => appStore.setBpm(parseInt(e.currentTarget.value) || 80)}
                />
                <span id="tempo-value">{appStore.bpm()}</span>
              </div>

              {/* Precount (formerly metronome) */}
              <button
                id="btn-precount"
                class={`ctrl-btn ${metronomeActive() ? 'active' : ''}`}
                onClick={handleMetronomeToggle}
                title="Pre-count before playback"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                  <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
                </svg>
                <span>Precount</span>
              </button>

              {/* Sensitivity */}
              <div class="sensitivity-group">
                <label class="opt-label">Sens:</label>
                <input
                  type="range"
                  id="sensitivity"
                  min="1"
                  max="10"
                  value="5"
                  class="sensitivity-slider"
                />
                <span id="sensitivity-value">5</span>
              </div>

              {/* Preset */}
              <div class="preset-group">
                <label class="opt-label">Preset:</label>
                <select
                  id="preset-select"
                  class="preset-select"
                  onChange={(e) => {
                    const name = e.currentTarget.value;
                    if (name) {
                      const preset = appStore.loadPreset(name);
                      if (preset) {
                        // Load preset melody
                        const melody = preset.notes.map((n) => {
                          const scaleNote = melodyStore.currentScale().find((s) => s.midi === n.midi);
                          return {
                            id: melodyStore.generateId(),
                            note: {
                              midi: n.midi,
                              name: scaleNote?.name ?? '?',
                              octave: scaleNote?.octave ?? 4,
                              freq: scaleNote?.freq ?? 440,
                            },
                            startBeat: n.startBeat,
                            duration: n.duration,
                          };
                        });
                        melodyStore.setMelody(melody);
                        if (preset.bpm) {
                          appStore.setBpm(preset.bpm);
                          melodyEngine.setBPM(preset.bpm);
                        }
                        appStore.showNotification(`Preset "${name}" loaded`, 'info');
                      }
                    }
                  }}
                >
                  <option value="">— Load —</option>
                </select>
              </div>

              {/* Volume */}
              <div class="volume-group">
                <label class="opt-label">Vol:</label>
                <input
                  type="range"
                  id="volume"
                  min="0"
                  max="100"
                  value="80"
                  class="volume-slider"
                  onInput={(e) => {
                    const vol = parseInt(e.currentTarget.value) || 80;
                    audioEngine?.setVolume(vol / 100);
                    // Persist volume preference
                    localStorage.setItem('pp_volume', String(vol));
                  }}
                />
                <span id="volume-value">80</span>
              </div>

              {/* Run indicator */}
              <div id="run-indicator">
                <span id="run-counter">Run 1</span>
                <span id="cycle-counter" />
              </div>
            </div>

            {/* Canvas */}
            <div id="canvas-container">
              <PitchCanvas
                melody={() => melodyStore.items}
                scale={() => melodyStore.currentScale()}
                totalBeats={totalBeats}
                currentBeat={currentBeat}
                pitchHistory={pitchHistory}
                currentNoteIndex={currentNoteIndex}
                isPlaying={isPlaying}
                isPaused={isPaused}
                isScrolling={() => false}
              />
              <div id="playhead" style={{ display: (isPlaying() || isPaused()) ? 'block' : 'none' }} />
            </div>

            {/* History */}
            <div id="history-container">
              <HistoryCanvas
                frequencyData={frequencyData}
                liveScore={liveScore}
              />
            </div>
          </main>
        </Show>

        {/* Editor tab — full-screen piano roll */}
        <Show when={appStore.activeTab() === 'editor'}>
          <div id="editor-panel" class="editor-fullscreen">
            <PianoRollCanvas
              melody={() => melodyStore.items}
              scale={() => melodyStore.currentScale()}
              bpm={() => appStore.bpm()}
              totalBeats={() => totalBeats()}
              playbackState={() => playback.state() as PlaybackState}
              currentNoteIndex={() => melodyStore.currentNoteIndex()}
              onMelodyChange={(melody) => melodyStore.setMelody(melody)}
              onPlayClick={handlePlay}
              onResetClick={handleReset}
            />
          </div>
        </Show>
      </div>

      {/* Score overlay */}
      <Show when={practiceResult() !== null}>
        <div class="overlay" onClick={closeScoreOverlay}>
          <div id="score-card" onClick={(e) => e.stopPropagation()}>
            <button class="overlay-close" onClick={closeScoreOverlay}>&times;</button>
            <h2 id="score-title">Run Complete!</h2>
            <div id="score-grade" class={scoreGrade()}>{scoreLabel()}</div>
            <div id="score-pct">{practiceResult()!.score}%</div>
            <div id="score-detail">
              {practiceResult()!.noteCount} notes · {practiceResult()!.avgCents.toFixed(1)}¢ avg
            </div>
            <div id="score-stats">
              <div class="score-stat score-stat-perfect">
                <div class="score-stat-value">
                  {noteResults().filter(r => r.rating === 'perfect').length}
                </div>
                <div class="score-stat-label">Perfect</div>
              </div>
              <div class="score-stat score-stat-excellent">
                <div class="score-stat-value">
                  {noteResults().filter(r => r.rating === 'excellent').length}
                </div>
                <div class="score-stat-label">Excellent</div>
              </div>
              <div class="score-stat score-stat-good">
                <div class="score-stat-value">
                  {noteResults().filter(r => r.rating === 'good').length}
                </div>
                <div class="score-stat-label">Good</div>
              </div>
              <div class="score-stat score-stat-okay">
                <div class="score-stat-value">
                  {noteResults().filter(r => r.rating === 'okay').length}
                </div>
                <div class="score-stat-label">Okay</div>
              </div>
              <div class="score-stat score-stat-off">
                <div class="score-stat-value">
                  {noteResults().filter(r => r.rating === 'off').length}
                </div>
                <div class="score-stat-label">Off</div>
              </div>
            </div>
            <div id="score-actions">
              <button class="overlay-btn primary" onClick={() => { closeScoreOverlay(); handleReset(); handlePlay(); }}>
                Try Again
              </button>
              <button class="overlay-btn" onClick={closeScoreOverlay}>
                Close
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
