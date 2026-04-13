// ============================================================
// PianoRollCanvas — Piano roll editor wrapper
// ============================================================

import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { PianoRollEditor } from '@/lib/piano-roll';
import type { PlaybackState } from '@/lib/piano-roll';
import type { MelodyItem, ScaleDegree } from '@/types';
import type { PitchPerfectWindow } from '@/types';

interface PianoRollCanvasProps {
  melody: () => MelodyItem[];
  scale: () => ScaleDegree[];
  bpm: () => number;
  totalBeats: () => number;
  playbackState: () => PlaybackState;
  currentNoteIndex: () => number;
  onMelodyChange: (melody: MelodyItem[]) => void;
  onPlayClick: () => void;
  onResetClick: () => void;
}

export const PianoRollCanvas: Component<PianoRollCanvasProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let editor: PianoRollEditor | null = null;
  let _onMelodyChange: ((melody: MelodyItem[]) => void) | null = null;

  onMount(() => {
    if (!containerRef) return;

    editor = new PianoRollEditor({ container: containerRef });
    _onMelodyChange = props.onMelodyChange;
    editor.setMelody(props.melody());
    editor.setScale(props.scale());
    editor.setBPM(props.bpm());
    editor.setTotalBeats(props.totalBeats());

    // Load presets from localStorage
    editor.loadPresets();

    // Expose on window for debugging
    (window as PitchPerfectWindow).pianoRollEditor = editor;
    (window as PitchPerfectWindow).pianoRollGenerateId = () => Date.now();
  });

  // Propagate melody changes to the editor
  createEffect(() => {
    const m = props.melody();
    editor?.setMelody(m);
  });

  // Propagate scale changes
  createEffect(() => {
    const s = props.scale();
    editor?.setScale(s);
  });

  // Propagate BPM changes
  createEffect(() => {
    editor?.setBPM(props.bpm());
  });

  // Propagate total beats changes
  createEffect(() => {
    editor?.setTotalBeats(props.totalBeats());
  });

  // Propagate playback state changes
  createEffect(() => {
    editor?.setPlaybackState(props.playbackState());
  });

  // Propagate current note index
  createEffect(() => {
    editor?.setCurrentNote(props.currentNoteIndex());
  });

  onCleanup(() => {
    editor?.destroy();
    delete (window as PitchPerfectWindow).pianoRollEditor;
    delete (window as PitchPerfectWindow).pianoRollGenerateId;
  });

  return <div ref={containerRef} class="piano-roll-container" />;
};
