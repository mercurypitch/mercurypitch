// ============================================================
// App — Main SolidJS application entry
// ============================================================

import { Component, createSignal, createMemo, Show } from 'solid-js';
import { TransportControls } from '@/components/TransportControls';
import { PianoRollCanvas } from '@/components/PianoRollCanvas';
import { PitchDisplay } from '@/components/PitchDisplay';
import { appStore } from '@/stores/app-store';
import { playback } from '@/stores/playback-store';
import { melodyStore } from '@/stores/melody-store';
import { melodyTotalBeats } from '@/lib/scale-data';
import type { MelodyItem } from '@/types';
import type { PlaybackState } from '@/lib/piano-roll';

export const App: Component = () => {
  const totalBeats = createMemo(() => melodyTotalBeats(melodyStore.items));

  const handlePlay = () => {
    // In the full migration, this triggers the audio engine playback
    // For now, the PianoRollCanvas handles transport internally
  };

  const handleReset = () => {
    // Reset playback
  };

  const handleMelodyChange = (melody: MelodyItem[]) => {
    melodyStore.setMelody(melody);
  };

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
            <div class="practice-controls">
              <label>
                Key:
                <select
                  value={appStore.keyName()}
                  onChange={(e) => {
                    appStore.setKeyName(e.currentTarget.value);
                    melodyStore.refreshScale(e.currentTarget.value, 3, appStore.scaleType());
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
                    appStore.setScaleType(e.currentTarget.value);
                    melodyStore.refreshScale(appStore.keyName(), 3, e.currentTarget.value);
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

            <TransportControls onPlay={handlePlay} onReset={handleReset} />

            <PitchDisplay
              pitch={() => null}
              targetNote={() => 'C4'}
            />

            <div class="practice-hint">
              Press the mic button to start singing. Match the melody notes displayed above.
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
