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
import { PitchCanvas } from '@/components/PitchCanvas';
import { SettingsPanel } from '@/components/SettingsPanel';
import { loadFromURL, hasSharedPresetInURL } from '@/lib/share-url';
import { AppSidebar } from '@/components/AppSidebar';
import { ScaleBuilder } from '@/components/ScaleBuilder';
import { PracticeTabHeader } from '@/components/PracticeTabHeader';
import type { PresetData } from '@/stores/app-store';
import { HistoryCanvas } from '@/components/HistoryCanvas';
import { appStore, getNoteAccuracyMap } from '@/stores/app-store';
import { playback } from '@/stores/playback-store';
import { melodyStore } from '@/stores/melody-store';
import { melodyTotalBeats, buildSampleMelody, keyTonicFreq, midiToNote } from '@/lib/scale-data';
import { AudioEngine } from '@/lib/audio-engine';
import { MelodyEngine } from '@/lib/melody-engine';
import { PracticeEngine } from '@/lib/practice-engine';
import type { PitchResult, NoteResult, PracticeResult, NoteName, MelodyItem, EffectType } from '@/types';
import type { PracticeSubMode } from '@/components/PracticeTabHeader';
import type { PlaybackState } from '@/lib/piano-roll';
import type { PitchSample } from '@/components/PitchCanvas';

// ── Engine instances (single shared) ────────────────────────

let audioEngine: AudioEngine;
let melodyEngine: MelodyEngine;
let practiceEngine: PracticeEngine;

/** Convert preset note data to melody items, preserving exact note properties */
function presetToMelody(preset: PresetData): MelodyItem[] {
  return preset.notes.map((n) => {
    // Use the scale data stored with the preset for accurate note lookup
    const scaleNote = preset.scale.find((s) => s.midi === n.midi);
    return {
      id: melodyStore.generateId(),
      note: {
        midi: n.midi,
        // Use stored scale data, fallback to computed from current scale
        name: (scaleNote?.name ?? melodyStore.currentScale().find((s) => s.midi === n.midi)?.name ?? 'C') as NoteName,
        octave: scaleNote?.octave ?? melodyStore.currentScale().find((s) => s.midi === n.midi)?.octave ?? 4,
        freq: scaleNote?.freq ?? melodyStore.currentScale().find((s) => s.midi === n.midi)?.freq ?? 440,
      },
      startBeat: n.startBeat,
      duration: n.duration,
      effectType: n.effectType as EffectType | undefined,
      linkedTo: n.linkedTo,
    };
  });
}

/** Filter melody items based on practice sub-mode */
function filterMelodyForPractice(
  melody: MelodyItem[],
  subMode: PracticeSubMode
): MelodyItem[] {
  if (subMode === 'all') return melody;

  if (subMode === 'reverse') {
    return [...melody].reverse().map((item) => ({
      ...item,
      startBeat: 0, // Reset timing — will be recalculated by engine
    }));
  }

  if (subMode === 'random') {
    // Keep ~50% of notes, preserving their timing
    return melody.filter(() => Math.random() >= 0.5);
  }

  if (subMode === 'focus') {
    // Use session history to find worst-performing notes
    const history = appStore.sessionHistory;
    if (history.length === 0) return melody; // No history — practice all

    // Find notes with the most errors
    const errorCounts = new Map<number, number>();
    for (const session of history) {
      // Each session has noteResults with avgCents per note
      // We approximate by looking at score — low scores = many errors
      if (session.score < 70) {
        // Rough heuristic: low-scoring sessions suggest problem notes
        // Count each session as a "bad note" indicator
        for (let i = 0; i < Math.ceil((100 - session.score) / 10); i++) {
          const idx = i % melody.length;
          errorCounts.set(idx, (errorCounts.get(idx) ?? 0) + 1);
        }
      }
    }

    if (errorCounts.size === 0) return melody;

    // Include notes that appear in error counts (the "problem" notes)
    const errorIndices = new Set(errorCounts.keys());
    return melody.filter((_, i) => errorIndices.has(i));
  }

  return melody;
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
  const [waveformData, setWaveformData] = createSignal<Float32Array | null>(null);
  const [countInBeat, setCountInBeat] = createSignal<number>(0);
  const [isCountingIn, setIsCountingIn] = createSignal(false);
  const [metronomeEnabled, setMetronomeEnabled] = createSignal(false);
  const [targetPitch, setTargetPitch] = createSignal<number | null>(null);

  // ── Recording ────────────────────────────────────────────────
  const [isRecording, setIsRecording] = createSignal(false);
  const [recordedMelody, setRecordedMelody] = createSignal<MelodyItem[]>([]);
  let lastRecordedBeat = -1;
  let lastRecordedMidi = -1;
  let silenceFrames = 0;
  let currentNoteStartBeat = -1;
  let currentNoteMidi = -1;
  let pendingNoteId = 0;

  // ── Play mode ────────────────────────────────────────────────
  type PlayMode = 'once' | 'repeat' | 'practice';
  const [playMode, setPlayMode] = createSignal<PlayMode>('once');
  const [practiceCycles, setPracticeCycles] = createSignal<number>(5);
  const [currentCycle, setCurrentCycle] = createSignal<number>(1);
  const [allCycleResults, setAllCycleResults] = createSignal<NoteResult[][]>([]);
  const [isPracticeComplete, setIsPracticeComplete] = createSignal<boolean>(false);
  const [practiceSubMode, setPracticeSubMode] = createSignal<PracticeSubMode>('all');
  const [savedVol, setSavedVol] = createSignal<number>(80);
  const [showScaleBuilder, setShowScaleBuilder] = createSignal<boolean>(false);

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
    // Initialize theme and settings from localStorage
    appStore.initTheme();
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
    // Sync ADSR settings from appStore
    audioEngine.syncFromAppStore(appStore.adsr());

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
      onMetronomeTick: (beat, isDownbeat) => {
        // Play metronome click during playback (not during count-in)
        if (metronomeEnabled()) {
          audioEngine?.playMetronomeClick(isDownbeat);
        }
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

    // Sync ADSR settings to AudioEngine when they change
    createEffect(() => {
      const adsr = appStore.adsr();
      if (audioEngine) {
        audioEngine.syncFromAppStore(adsr);
      }
    });

    // Sync playback speed to MelodyEngine when it changes
    createEffect(() => {
      const speed = appStore.playbackSpeed();
      if (melodyEngine) {
        melodyEngine.setPlaybackSpeed(speed);
      }
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

        // Record to piano roll
        if (isRecording()) {
          const midi = Math.round(69 + 12 * Math.log2(pitch.frequency / 440));
          if (midi !== currentNoteMidi) {
            // New pitch detected — finalize previous note
            if (currentNoteMidi > 0 && currentNoteStartBeat > 0) {
              const duration = Math.max(0.25, beat - currentNoteStartBeat);
              const note = midiToNote(currentNoteMidi);
              setRecordedMelody((prev) => [
                ...prev,
                {
                  id: pendingNoteId++,
                  note: { name: note?.name ?? '', octave: note?.octave ?? 4, midi: currentNoteMidi, freq: 440 * Math.pow(2, (currentNoteMidi - 69) / 12) },
                  duration,
                  startBeat: currentNoteStartBeat,
                },
              ]);
            }
            currentNoteMidi = midi;
            currentNoteStartBeat = beat;
          }
          silenceFrames = 0;
        }
      } else if (isRecording()) {
        silenceFrames++;
        // 10+ frames of silence ends the current note
        if (silenceFrames >= 10 && currentNoteMidi > 0) {
          const beat = melodyEngine.getCurrentBeat();
          const duration = Math.max(0.25, beat - currentNoteStartBeat);
          const note = midiToNote(currentNoteMidi);
          setRecordedMelody((prev) => [
            ...prev,
            {
              id: pendingNoteId++,
              note: { name: note?.name ?? '', octave: note?.octave ?? 4, midi: currentNoteMidi, freq: 440 * Math.pow(2, (currentNoteMidi - 69) / 12) },
              duration,
              startBeat: currentNoteStartBeat,
            },
          ]);
          currentNoteMidi = -1;
          currentNoteStartBeat = -1;
        }
      }
      // Capture waveform data when mic is active
      if (practiceEngine.isMicActive()) {
        setWaveformData(practiceEngine.getWaveformData());
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
    const baseMelody = melodyStore.items;
    const subMode = playMode() === 'practice' ? practiceSubMode() : 'all';
    const filteredMelody = filterMelodyForPractice(baseMelody, subMode);
    melodyEngine.setMelody(filteredMelody);
    melodyEngine.setBPM(appStore.bpm());

    practiceEngine.startSession();
    setIsPlaying(true);
    setIsPaused(false);
    playback.startPlayback();

    // Play tonic anchor tone if enabled — helps singer lock in to the key
    if (appStore.settings().tonicAnchor) {
      const tonicFreq = keyTonicFreq(appStore.keyName(), melodyStore.currentOctave());
      const bpm = appStore.bpm();
      const tonicDuration = Math.round(60000 / bpm); // 1 beat
      audioEngine.playTone(tonicFreq, tonicDuration);
    }

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
    audioEngine.stopTone();
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

  // ── Recording ────────────────────────────────────────────────

  const handleRecordToggle = async () => {
    if (isRecording()) {
      // Stop recording — finalize any pending note
      if (currentNoteMidi > 0 && currentNoteStartBeat > 0) {
        const beat = melodyEngine.getCurrentBeat();
        const duration = Math.max(0.25, beat - currentNoteStartBeat);
        const note = midiToNote(currentNoteMidi);
        setRecordedMelody((prev) => [
          ...prev,
          {
            id: pendingNoteId++,
            note: { name: note?.name ?? '', octave: note?.octave ?? 4, midi: currentNoteMidi, freq: 440 * Math.pow(2, (currentNoteMidi - 69) / 12) },
            duration,
            startBeat: currentNoteStartBeat,
          },
        ]);
      }
      const items = recordedMelody();
      if (items.length > 0) {
        melodyStore.setMelody([...melodyStore.items, ...items]);
      }
      setRecordedMelody([]);
      currentNoteMidi = -1;
      currentNoteStartBeat = -1;
      setIsRecording(false);
      appStore.setActiveTab('editor');
    } else {
      // Start recording
      const micOk = await practiceEngine.startMic();
      if (!micOk) return;
      setRecordedMelody([]);
      currentNoteMidi = -1;
      currentNoteStartBeat = -1;
      silenceFrames = 0;
      setIsRecording(true);
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
          onOpenScaleBuilder={() => setShowScaleBuilder(true)}
          melody={() => melodyStore.items}
          currentNoteIndex={currentNoteIndex}
          noteResults={noteResults}
          isPlaying={isPlaying}
          pitch={currentPitch}
          targetNoteName={targetNoteName}
        />

        {/* Tab content */}
        <div class="main-content">
          {/* Practice tab */}
          <Show when={appStore.activeTab() === 'practice'}>
            {/* Practice-specific header: mic + mode toggles + playback controls */}
            <PracticeTabHeader
              isPlaying={isPlaying}
              isPaused={isPaused}
              playMode={playMode}
              practiceCycles={practiceCycles}
              currentCycle={currentCycle}
              isCountingIn={isCountingIn}
              countInBeat={countInBeat}
              metronomeEnabled={metronomeEnabled}
              volume={savedVol}
              practiceSubMode={practiceSubMode}
              onMicToggle={handleMicToggle}
              onPlayModeChange={setPlayMode}
              onCyclesChange={setPracticeCycles}
              onPlay={handlePlay}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleReset}
              onMetronomeToggle={() => setMetronomeEnabled(!metronomeEnabled())}
              onSpeedChange={(speed) => melodyEngine?.setPlaybackSpeed(speed)}
              onVolumeChange={(vol) => {
                setSavedVol(vol);
                audioEngine?.setVolume(vol / 100);
              }}
              onPracticeSubModeChange={setPracticeSubMode}
              isRecording={isRecording}
              onRecordToggle={handleRecordToggle}
            />

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
                waveformData={waveformData}
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

      {/* Scale Builder Modal */}
      <ScaleBuilder
        isOpen={showScaleBuilder()}
        onClose={() => setShowScaleBuilder(false)}
      />
    </div>
  );
};
