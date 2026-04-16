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
import { loadFromURL, hasSharedPresetInURL, copyShareURL } from '@/lib/share-url';
import { NoteList } from '@/components/NoteList';
import { MicButton } from '@/components/MicButton';
import { MetronomeButton } from '@/components/MetronomeButton';
import { HistoryCanvas } from '@/components/HistoryCanvas';
import { appStore, getNoteAccuracyMap } from '@/stores/app-store';
import { playback } from '@/stores/playback-store';
import { melodyStore } from '@/stores/melody-store';
import { melodyTotalBeats } from '@/lib/scale-data';
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
      </header>

      {/* Main layout */}
      <div class="main-layout" id="main-layout">
        {/* Practice tab — notes panel + pitch area side by side */}
        <Show when={appStore.activeTab() === 'practice'}>
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
                <button class="octave-btn" title="Lower octave" onClick={() => handleOctaveShift(-1)}>
                  <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
                </button>
                <span class="octave-value">{melodyStore.currentOctave()}</span>
                <button class="octave-btn" title="Higher octave" onClick={() => handleOctaveShift(1)}>
                  <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
                </button>
              </div>

              <span class="preset-label">Scale:</span>
              <select
                id="scale-select"
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
            </div>

            {/* Preset selector */}
            <div id="preset-info">
              <span class="preset-label">Preset:</span>
              <select
                id="preset-select"
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
                            name: (scaleNote?.name ?? 'C') as NoteName,
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
                <option value="">— Select —</option>
              </select>
            </div>

            {/* Share button */}
            <div id="share-preset">
              <button
                id="btn-share"
                class="share-btn"
                title="Copy share link to clipboard"
                onClick={async () => {
                  const totalBeats = melodyStore.items.length > 0
                    ? Math.max(...melodyStore.items.map(n => n.startBeat + n.duration))
                    : undefined;
                  const ok = await copyShareURL(
                    melodyStore.items,
                    appStore.bpm(),
                    appStore.keyName(),
                    appStore.scaleType(),
                    totalBeats
                  );
                  appStore.showNotification(
                    ok ? 'Share URL copied to clipboard!' : 'Failed to copy URL',
                    ok ? 'success' : 'error'
                  );
                }}
              >
                Share
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
                <button id="btn-once" class={`mode-btn ${playMode() === 'once' ? 'active' : ''}`} onClick={() => setPlayMode('once')}>Once</button>
                <button id="btn-repeat" class={`mode-btn ${playMode() === 'repeat' ? 'active' : ''}`} onClick={() => setPlayMode('repeat')}>Repeat</button>
                <button id="btn-practice" class={`mode-btn ${playMode() === 'practice' ? 'active' : ''}`} onClick={() => setPlayMode('practice')}>Practice</button>
              </div>

              {/* Practice options (shown when practice mode) */}
              <Show when={playMode() === 'practice'}>
                <div class="practice-options">
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
                  <button
                    id="btn-start-practice"
                    class="ctrl-btn accent"
                    onClick={handlePlay}
                  >
                    Start
                  </button>
                </div>
              </Show>

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

              {/* Count-in options */}
              <div class="countin-group">
                <label class="opt-label">Count-in:</label>
                <select
                  id="countin-select"
                  value={appStore.countIn()}
                  onChange={(e) => appStore.setCountIn(parseInt(e.currentTarget.value) as any)}
                  class="countin-select"
                >
                  <option value="0">Off</option>
                  <option value="1">1 beat</option>
                  <option value="2">2 beats</option>
                  <option value="4">4 beats</option>
                </select>
              </div>

              {/* Metronome toggle */}
              <MetronomeButton
                active={metronomeEnabled()}
                onClick={() => setMetronomeEnabled(!metronomeEnabled())}
              />

              {/* Speed control */}
              <div class="speed-group">
                <label class="opt-label">Speed:</label>
                <select
                  id="speed-select"
                  value="1"
                  class="speed-select"
                  onChange={(e) => {
                    const speed = parseFloat(e.currentTarget.value);
                    melodyEngine?.setPlaybackSpeed(speed);
                  }}
                >
                  <option value="0.25">0.25x</option>
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>

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
                <span id="cycle-counter">
                  {playMode() === 'practice' ? `Cycle ${currentCycle()}/${practiceCycles()}` : playMode() === 'repeat' ? 'Repeat' : ''}
                </span>
              </div>

              {/* Count-in display */}
              <Show when={isCountingIn()}>
                <div id="countin-display" class="countin-badge">
                  {countInBeat()}
                </div>
              </Show>
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
              onInstrumentChange={(instrument) => audioEngine.setInstrument(instrument as any)}
            />
          </div>
        </Show>

        {/* Settings tab */}
        <Show when={appStore.activeTab() === 'settings'}>
          <div id="settings-panel">
            <SettingsPanel />
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
