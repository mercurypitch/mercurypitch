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
import { SettingsPanel } from '@/components/SettingsPanel';
import { loadFromURL, hasSharedPresetInURL } from '@/lib/share-url';
import { NoteList } from '@/components/NoteList';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';
import type { PresetData } from '@/stores/app-store';
import { HistoryCanvas } from '@/components/HistoryCanvas';
import { appStore, getNoteAccuracyMap } from '@/stores/app-store';
import { playback } from '@/stores/playback-store';
import { melodyStore } from '@/stores/melody-store';
import { melodyTotalBeats, buildSampleMelody } from '@/lib/scale-data';
import { AudioEngine } from '@/lib/audio-engine';
import { MelodyEngine } from '@/lib/melody-engine';
import { PracticeEngine } from '@/lib/practice-engine';
import type { PitchResult, NoteResult, PracticeResult, NoteName } from '@/types';
import type { PlaybackState } from '@/lib/piano-roll';
import type { PitchSample } from '@/components/PitchCanvas';

// ── Engine instances (single shared) ────────────────────────

let audioEngine: AudioEngine;
let melodyEngine: MelodyEngine;
let practiceEngine: PracticeEngine;

/** Convert preset note data to melody items, mapping midi to current scale */
function presetToMelody(preset: PresetData): import('@/types').MelodyItem[] {
  return preset.notes.map((n) => {
    const scaleNote = melodyStore.currentScale().find((s) => s.midi === n.midi);
    return {
      id: melodyStore.generateId(),
      note: {
        midi: n.midi,
        name: (scaleNote?.name ?? 'C') as NoteName,
        octave: scaleNote?.octave ?? 4,
        freq: scaleNote?.freq ?? 440,
      },
      startBeat: n.startBeat,
      duration: n.duration,
    };
  });
}

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
  const [countInBeat, setCountInBeat] = createSignal<number>(0);
  const [isCountingIn, setIsCountingIn] = createSignal(false);
  const [metronomeEnabled, setMetronomeEnabled] = createSignal(false);
  const [targetPitch, setTargetPitch] = createSignal<number | null>(null);

  // ── Play mode ────────────────────────────────────────────────
  type PlayMode = 'once' | 'repeat' | 'practice';
  const [playMode, setPlayMode] = createSignal<PlayMode>('once');
  const [practiceCycles, setPracticeCycles] = createSignal<number>(5);
  const [currentCycle, setCurrentCycle] = createSignal<number>(1);
  const [allCycleResults, setAllCycleResults] = createSignal<NoteResult[][]>([]);
  const [isPracticeComplete, setIsPracticeComplete] = createSignal<boolean>(false);
  const [savedVol, setSavedVol] = createSignal<number>(80);

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
    appStore.initSessionHistory();
    appStore.initSettings();

    // Check for shared preset in URL
    if (hasSharedPresetInURL()) {
      const sharedData = loadFromURL();
      if (sharedData) {
        // Load shared preset into melody store
        melodyStore.setMelody(sharedData.melody);
        if (sharedData.bpm) {
          appStore.setBpm(sharedData.bpm);
        }
        if (sharedData.key) {
          appStore.setKeyName(sharedData.key);
        }
        if (sharedData.scaleType) {
          appStore.setScaleType(sharedData.scaleType);
        }
        appStore.showNotification('Shared preset loaded from URL', 'info');
      }
    }

    // Load saved volume
    const savedVol = parseInt(localStorage.getItem('pp_volume') || '80', 10);
    setSavedVol(savedVol);
    audioEngine = new AudioEngine();
    audioEngine.setVolume(savedVol / 100);

    melodyEngine = new MelodyEngine({
      bpm: appStore.bpm(),
      melody: melodyStore.items,
      onNoteStart: (note, noteIndex) => {
        setCurrentNoteIndex(noteIndex);
        setTargetPitch(note.freq);
        practiceEngine.onNoteStart(note, noteIndex);
        // Play tone for the note
        audioEngine.playTone(note.freq);
      },
      onNoteEnd: () => {
        audioEngine.stopTone();
      },
      onBeatUpdate: (beat) => {
        setCurrentBeat(beat);
      },
      onCountIn: (beat) => {
        setCountInBeat(beat);
        setIsCountingIn(true);
        // Play a click sound for count-in when metronome is enabled
        if (metronomeEnabled()) {
          audioEngine?.playClick();
        }
      },
      onCountInComplete: () => {
        setIsCountingIn(false);
        setCountInBeat(0);
      },
      onComplete: () => {
        const results = practiceEngine.onPlaybackComplete();
        const mode = playMode();

        if (mode === 'practice') {
          // Accumulate results for practice mode
          const currentResults = noteResults();
          setAllCycleResults((prev) => [...prev, currentResults]);
          const currentC = currentCycle();

          if (currentC < practiceCycles()) {
            // More cycles coming — reset silently and restart
            setCurrentCycle(currentC + 1);
            setNoteResults([]);
            setLiveScore(null);
            setCurrentBeat(0);
            setCurrentNoteIndex(-1);
            melodyStore.setCurrentNoteIndex(-1);
            setPitchHistory([]);
            practiceEngine.resetSession();
            setTimeout(() => melodyEngine.start(appStore.countIn()), 600);
            return;
          } else {
            // All cycles done — compute combined result
            setIsPracticeComplete(true);
            const allResults = [...allCycleResults(), currentResults];
            const allNotes = allResults.flat();
            const combinedScore = practiceEngine.calculateScore(allNotes);
            const combinedPr: PracticeResult = {
              noteResults: allNotes,
              score: combinedScore,
              avgCents: allNotes.length > 0
                ? allNotes.reduce((s, r) => s + Math.abs(r.avgCents), 0) / allNotes.length
                : 0,
              noteCount: allNotes.length,
            };
            setPracticeResult(combinedPr);
            setLiveScore(combinedScore);
            appStore.setLastScore(combinedScore);
            appStore.setPracticeCount(appStore.practiceCount() + 1);
            appStore.saveSession({
              score: combinedScore,
              avgCents: combinedPr.avgCents,
              noteCount: combinedPr.noteCount,
              noteResults: allNotes.map((r) => ({
                midi: r.targetNote.midi,
                avgCents: r.avgCents,
                rating: r.rating,
              })),
            });
            appStore.showNotification(`Practice complete! Score: ${combinedScore}%`, combinedScore >= 80 ? 'success' : combinedScore >= 50 ? 'info' : 'warning');
            handleStop();
          }
        } else if (mode === 'repeat') {
          // Auto-restart for repeat mode
          setNoteResults([]);
          setLiveScore(null);
          setCurrentBeat(0);
          setCurrentNoteIndex(-1);
          melodyStore.setCurrentNoteIndex(-1);
          setPitchHistory([]);
          practiceEngine.resetSession();
          handleStop();
          setTimeout(() => handlePlay(), 300);
        } else {
          // Once mode
          if (results) {
            const pr = practiceEngine.calculatePracticeResult(results);
            setPracticeResult(pr);
            setLiveScore(pr.score);
            appStore.setLastScore(pr.score);
            appStore.setPracticeCount(appStore.practiceCount() + 1);
            appStore.saveSession({
              score: pr.score,
              avgCents: pr.avgCents,
              noteCount: pr.noteCount,
              noteResults: pr.noteResults.map((r) => ({
                midi: r.targetNote.midi,
                avgCents: r.avgCents,
                rating: r.rating,
              })),
            });
            appStore.showNotification(
              `Practice complete! Score: ${pr.score}%`,
              pr.score >= 80 ? 'success' : pr.score >= 50 ? 'info' : 'warning'
            );
          }
          handleStop();
        }
      },
    });
    practiceEngine = new PracticeEngine(audioEngine, { sensitivity: 5 });

    // Sync settings to PracticeEngine
    createEffect(() => {
      const s = appStore.settings();
      practiceEngine.syncSettings({
        sensitivity: s.sensitivity,
        minConfidence: s.minConfidence,
        minAmplitude: s.minAmplitude,
        bands: s.bands.map(b => ({ threshold: b.threshold, band: b.band })),
      });
    });

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
        console.log('[App] Mic state changed:', active ? 'ACTIVE' : 'INACTIVE', error ? 'Error: ' + error : '');
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
    const handleOctaveChange = (e: CustomEvent) => {
      // Sync octave and numOctaves to the scale builder
      melodyStore.setOctave(e.detail.octave);
      melodyStore.setNumOctaves(e.detail.numOctaves);
    };
    const handleModeChange = (e: CustomEvent) => {
      appStore.setScaleType(e.detail.mode);
    };
    window.addEventListener('pitchperfect:presetSaved', handlePresetSaved as EventListener);
    window.addEventListener('pitchperfect:presetLoaded', handlePresetLoaded as EventListener);
    window.addEventListener('pitchperfect:octaveChange', handleOctaveChange as EventListener);
    window.addEventListener('pitchperfect:modeChange', handleModeChange as EventListener);

    // Listen for seek events from PitchCanvas (playhead drag)
    const handleSeek = (e: CustomEvent) => {
      if (!isPlaying() && !isPaused()) return;
      const targetBeat = e.detail.beat as number;
      const beatDurationMs = 60000 / appStore.bpm();
      const targetTime = targetBeat * beatDurationMs;
      melodyEngine.seekTo(targetBeat);
      setCurrentBeat(targetBeat);
    };
    window.addEventListener('pitchperfect:seekToBeat', handleSeek as EventListener);

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
      window.removeEventListener('pitchperfect:octaveChange', handleOctaveChange as EventListener);
      window.removeEventListener('pitchperfect:modeChange', handleModeChange as EventListener);
      window.removeEventListener('pitchperfect:seekToBeat', handleSeek as EventListener);
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

    // Initialize audio engine
    await audioEngine.init();
    await audioEngine.resume();

    // Sync engine with current melody/bpm
    melodyEngine.setMelody(melodyStore.items);
    melodyEngine.setBPM(appStore.bpm());

    practiceEngine.startSession();
    setIsPlaying(true);
    setIsPaused(false);
    playback.startPlayback();

    // Start with count-in if configured
    melodyEngine.start(appStore.countIn());
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
    // Reset practice mode state
    setAllCycleResults([]);
    setCurrentCycle(1);
    setIsPracticeComplete(false);
  };

  // ── Mic handlers ─────────────────────────────────────────────

  const handleMicToggle = async () => {
    if (appStore.micActive()) {
      practiceEngine.stopMic();
    } else {
      await practiceEngine.startMic();
    }
  };

  // ── Octave shift ─────────────────────────────────────────────

  const handleOctaveShift = (delta: number) => {
    const newOctave = melodyStore.currentOctave() + delta;
    if (newOctave < 1 || newOctave > 6) return;

    const keyName = appStore.keyName();
    const scaleType = appStore.scaleType();

    // Check if we have notes that can be transposed
    if (melodyStore.items.length > 0) {
      // Transpose all notes by the octave delta
      const MIDI_OCTAVE_SHIFT = 12;
      const transposed = melodyStore.items.map(item => ({
        ...item,
        note: {
          ...item.note,
          midi: item.note.midi + delta * MIDI_OCTAVE_SHIFT,
          octave: item.note.octave + delta,
          freq: 440 * Math.pow(2, (item.note.midi + delta * MIDI_OCTAVE_SHIFT - 69) / 12),
        },
      }));
      melodyStore.setMelody(transposed);
    }

    // Rebuild scale with new octave
    melodyStore.refreshScale(keyName, newOctave, scaleType);
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

  // ── Accuracy heatmap ───────────────────────────────────────

  const noteAccuracyMap = createMemo(() => {
    // Track session history so this recomputes when history changes
    void appStore.sessionHistory.length;
    return getNoteAccuracyMap();
  });

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
        <div class="header-left">
          <h1 id="app-title">PitchPerfect</h1>
          <p class="subtitle">Voice Pitch Practice</p>
        </div>
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
            <Show when={melodyStore.items.length > 0}>
              <span class="tab-badge">{melodyStore.items.length}</span>
            </Show>
          </button>
          <button
            id="tab-settings"
            class={`app-tab ${appStore.activeTab() === 'settings' ? 'active' : ''}`}
            onClick={() => appStore.setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>
        {/* Shared header controls */}
        <AppHeader
          isPlaying={isPlaying}
          isPaused={isPaused}
          metronomeEnabled={metronomeEnabled}
          liveScore={liveScore}
          volume={savedVol}
          onMicToggle={handleMicToggle}
          onPlayPauseStop={() => {
            if (isPlaying()) {
              handlePause();
            } else if (isPaused()) {
              handleResume();
            } else {
              handlePlay();
            }
          }}
          onReset={handleReset}
          onMetronomeToggle={() => setMetronomeEnabled(!metronomeEnabled())}
          onSpeedChange={(speed) => melodyEngine?.setPlaybackSpeed(speed)}
          onVolumeChange={(vol) => {
            setSavedVol(vol);
            audioEngine?.setVolume(vol / 100);
          }}
        />
      </header>

      {/* Main layout: sidebar + content */}
      <div class="main-layout" id="main-layout">
        {/* Shared sidebar */}
        <AppSidebar
          onPresetLoad={(preset) => {
            melodyStore.setMelody(presetToMelody(preset));
            if (preset.bpm) {
              appStore.setBpm(preset.bpm);
              melodyEngine?.setBPM(preset.bpm);
            }
          }}
          onOctaveShift={handleOctaveShift}
        />

        {/* Tab content */}
        <div class="main-content">
          {/* Practice tab */}
          <Show when={appStore.activeTab() === 'practice'}>
            {/* Mode toggles (Practice-specific) */}
            <div id="mode-group" class="content-toolbar">
              <button id="btn-once" class={`mode-btn ${playMode() === 'once' ? 'active' : ''}`} onClick={() => setPlayMode('once')}>Once</button>
              <button id="btn-repeat" class={`mode-btn ${playMode() === 'repeat' ? 'active' : ''}`} onClick={() => setPlayMode('repeat')}>Repeat</button>
              <button id="btn-practice" class={`mode-btn ${playMode() === 'practice' ? 'active' : ''}`} onClick={() => setPlayMode('practice')}>Practice</button>
              <Show when={playMode() === 'practice'}>
                <label class="opt-label">Cycles:</label>
                <input
                  type="number"
                  id="cycles"
                  min="2"
                  max="20"
                  value={practiceCycles()}
                  onInput={(e) => setPracticeCycles(Math.max(2, Math.min(20, parseInt(e.currentTarget.value) || 5)))}
                  class="cycles-input"
                />
              </Show>
              <div id="run-indicator">
                <span id="cycle-counter">
                  {playMode() === 'practice' ? `Cycle ${currentCycle()}/${practiceCycles()}` : playMode() === 'repeat' ? 'Repeat' : ''}
                </span>
              </div>
              <Show when={isCountingIn()}>
                <div id="countin-display" class="countin-badge">
                  {countInBeat()}
                </div>
              </Show>
            </div>

            {/* Note list + pitch reference */}
            <div id="notes-content">
              <NoteList
                melody={() => melodyStore.items}
                currentNoteIndex={currentNoteIndex}
                noteResults={noteResults}
                isPlaying={isPlaying}
              />
              <PitchDisplay
                pitch={currentPitch}
                targetNote={targetNoteName}
              />
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
                targetPitch={targetPitch}
                noteAccuracyMap={noteAccuracyMap}
              />
              <div id="playhead" style={{
                display: (isPlaying() || isPaused()) ? 'block' : 'none',
                left: `${(currentBeat() / Math.max(1, totalBeats())) * 100}%`
              }} />
            </div>

            {/* History */}
            <div id="history-container">
              <HistoryCanvas
                frequencyData={frequencyData}
                liveScore={liveScore}
              />
            </div>
          </Show>

          {/* Editor tab */}
          <Show when={appStore.activeTab() === 'editor'}>
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
              onInstrumentChange={(instrument) => audioEngine.setInstrument(instrument as any)}
            />
          </Show>

          {/* Settings tab */}
          <Show when={appStore.activeTab() === 'settings'}>
            <div id="settings-panel">
              <SettingsPanel />
            </div>
          </Show>
        </div>
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

            {/* Session history mini chart */}
            <Show when={appStore.sessionHistory.length > 1}>
              <div id="score-history">
                <h3 class="history-title">Recent Progress</h3>
                <div class="history-chart">
                  {appStore.sessionHistory.slice(0, 10).map((session, idx) => (
                    <div
                      class="history-bar"
                      style={{ height: `${session.score}%` }}
                      title={`Score: ${session.score}%`}
                    />
                  ))}
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};
