// ============================================================
// App — Main SolidJS application entry
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
import { TransportControls } from '@/components/TransportControls';
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
import type { MelodyItem, PitchResult, NoteResult, PracticeResult } from '@/types';
import type { PlaybackState } from '@/lib/piano-roll';
import type { PitchSample } from '@/components/PitchCanvas';

// ── Engine instances (single shared) ────────────────────────

let audioEngine: AudioEngine;
let melodyEngine: MelodyEngine;
let practiceEngine: PracticeEngine;

export const App: Component = () => {
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

  // ── Engine lifecycle ────────────────────────────────────────

  onMount(() => {
    audioEngine = new AudioEngine();
    melodyEngine = new MelodyEngine({
      bpm: appStore.bpm(),
      melody: melodyStore.items,
      onNoteStart: (note, noteIndex) => {
        setCurrentNoteIndex(noteIndex);
        melodyStore.setCurrentNoteIndex(noteIndex);
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

    onCleanup(() => {
      melodyEngine.destroy();
      practiceEngine.destroy();
      audioEngine.destroy();
    });
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
    if (audioEngine) {
      // Metronome playback is handled in melody engine
    }
  };

  // ── Animation loop: update pitch history every frame ────────

  let animId: number;
  onMount(() => {
    const loop = () => {
      // Update pitch history for canvas trail
      const pitch = practiceEngine.update();
      if (pitch && pitch.frequency > 0 && pitch.clarity >= 0.2) {
        const beat = melodyEngine.getCurrentBeat();
        setPitchHistory((prev) => {
          const next = [...prev, { beat, freq: pitch.frequency, confidence: pitch.clarity }];
          // Keep last 800 samples
          return next.length > 800 ? next.slice(-800) : next;
        });
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    onCleanup(() => cancelAnimationFrame(animId));
  });

  // ── Melody change handler ────────────────────────────────────

  const handleMelodyChange = (melody: MelodyItem[]) => {
    melodyStore.setMelody(melody);
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

  return (
    <div class="app">
      <header class="app-header">
        <h1>PitchPerfect</h1>
        <nav class="app-nav">
          <button
            class={appStore.activeTab() === 'practice' ? 'active' : ''}
            onClick={() => appStore.setActiveTab('practice')}
          >
            Practice
          </button>
          <button
            class={appStore.activeTab() === 'editor' ? 'active' : ''}
            onClick={() => appStore.setActiveTab('editor')}
          >
            Editor
          </button>
          <button
            class={appStore.activeTab() === 'about' ? 'active' : ''}
            onClick={() => appStore.setActiveTab('about')}
          >
            About
          </button>
        </nav>
      </header>

      <main class="app-main">
        <Show when={appStore.activeTab() === 'practice'}>
          <section class="practice-panel">
            {/* Controls row */}
            <div class="practice-controls">
              <label>
                Key:
                <select
                  value={appStore.keyName()}
                  onChange={(e) => {
                    const key = e.currentTarget.value;
                    appStore.setKeyName(key);
                    melodyStore.refreshScale(key, 3, appStore.scaleType());
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
                  <option value="Eb">Eb</option>
                </select>
              </label>

              <label>
                Scale:
                <select
                  value={appStore.scaleType()}
                  onChange={(e) => {
                    const st = e.currentTarget.value;
                    appStore.setScaleType(st);
                    melodyStore.refreshScale(appStore.keyName(), 3, st);
                  }}
                >
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                  <option value="pentatonic-maj">Pentatonic Major</option>
                  <option value="pentatonic-min">Pentatonic Minor</option>
                  <option value="blues">Blues</option>
                  <option value="chromatic">Chromatic</option>
                  <option value="dorian">Dorian</option>
                  <option value="mixolydian">Mixolydian</option>
                </select>
              </label>

              <label>
                BPM:
                <input
                  type="number"
                  value={appStore.bpm()}
                  min="40"
                  max="240"
                  onChange={(e) => appStore.setBpm(parseInt(e.currentTarget.value) || 120)}
                />
              </label>
            </div>

            {/* Transport + mic row */}
            <div class="practice-toolbar">
              <TransportControls onPlay={handlePlay} onReset={handleReset} />
              <MicButton
                active={appStore.micActive()}
                onClick={handleMicToggle}
                disabled={isPlaying() || isPaused()}
              />
              <MetronomeButton
                active={metronomeActive()}
                onClick={handleMetronomeToggle}
              />
            </div>

            {/* Score display */}
            <Show when={practiceResult() !== null}>
              <div class={`score-overlay grade-${practiceResult()!.score >= 90 ? 'perfect' : practiceResult()!.score >= 70 ? 'good' : practiceResult()!.score >= 50 ? 'okay' : 'needs-work'}`}>
                <div class="score-value">{practiceResult()!.score}%</div>
                <div class="score-label">
                  {practiceResult()!.score >= 90 ? 'Pitch Perfect!' :
                   practiceResult()!.score >= 80 ? 'Excellent!' :
                   practiceResult()!.score >= 65 ? 'Good!' :
                   practiceResult()!.score >= 50 ? 'Okay!' : 'Needs Work'}
                </div>
              </div>
            </Show>

            {/* Main practice area */}
            <div class="practice-area">
              {/* Top: pitch display */}
              <div class="pitch-section">
                <PitchDisplay
                  pitch={currentPitch}
                  targetNote={targetNoteName}
                />
              </div>

              {/* Middle: pitch canvas + note list */}
              <div class="pitch-and-notes">
                <div class="pitch-canvas-wrap">
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
                </div>
                <div class="note-list-wrap">
                  <NoteList
                    melody={() => melodyStore.items}
                    currentNoteIndex={currentNoteIndex}
                    noteResults={noteResults}
                    isPlaying={isPlaying}
                  />
                </div>
              </div>

              {/* Bottom: history canvas */}
              <div class="history-canvas-wrap">
                <HistoryCanvas
                  frequencyData={frequencyData}
                  liveScore={liveScore}
                />
              </div>
            </div>
          </section>
        </Show>

        <Show when={appStore.activeTab() === 'editor'}>
          <section class="editor-panel">
            <PianoRollCanvas
              melody={() => melodyStore.items}
              scale={() => melodyStore.currentScale()}
              bpm={() => appStore.bpm()}
              totalBeats={() => totalBeats()}
              playbackState={() => playback.state() as PlaybackState}
              currentNoteIndex={() => melodyStore.currentNoteIndex()}
              onMelodyChange={handleMelodyChange}
              onPlayClick={handlePlay}
              onResetClick={handleReset}
            />
          </section>
        </Show>

        <Show when={appStore.activeTab() === 'about'}>
          <section class="about-panel">
            <h2>About PitchPerfect</h2>
            <p>
              PitchPerfect is a singing practice tool with a built-in piano roll editor.
              Sing into your microphone and get real-time feedback on your pitch accuracy.
            </p>
            <p>
              This is the TypeScript + SolidJS migration of the original JavaScript application.
            </p>
          </section>
        </Show>
      </main>

      <Show when={appStore.notifications.length > 0}>
        <div class="notifications">
          {appStore.notifications.map((n) => (
            <div class={`notification notification-${n.type}`}>{n.message}</div>
          ))}
        </div>
      </Show>
    </div>
  );
};
