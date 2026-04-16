// ============================================================
// PresetSelector — Shared preset management component
// Used in both Practice and Editor tabs
// ============================================================

import { Component, createSignal, createMemo, onCleanup } from 'solid-js';
import {
  appStore,
  savePreset,
  loadPreset,
  deletePreset,
  type PresetData,
} from '@/stores/app-store';
import { melodyStore } from '@/stores/melody-store';
import { copyShareURL } from '@/lib/share-url';

interface PresetSelectorProps {
  /** Called when a preset is loaded */
  onLoad?: (preset: PresetData) => void;
  /** Whether to show save/new/delete controls (editor tab), not shown in practice tab */
  showControls?: boolean;
}

export const PresetSelector: Component<PresetSelectorProps> = (props) => {
  const [saveName, setSaveName] = createSignal<string>('');

  // Reactive preset names from appStore
  const presetNames = createMemo(() => {
    void appStore.presets; // track changes
    return Object.keys(appStore.presets).sort();
  });

  const currentName = createMemo(() => appStore.currentPresetName() ?? '');

  // Sync save-name input when a preset is selected
  const handleLoad = (name: string) => {
    if (!name) return;
    setSaveName(name);
    const preset = loadPreset(name);
    if (preset) {
      props.onLoad?.(preset);
    }
  };

  const handleSave = () => {
    const name = saveName().trim() || currentName();
    if (!name) return;

    const melody = melodyStore.items;
    const totalBeats = melody.length > 0
      ? Math.max(...melody.map((n) => n.startBeat + n.duration))
      : 16;

    const data: PresetData = {
      notes: melody.map((n) => ({
        midi: n.note.midi,
        startBeat: n.startBeat,
        duration: n.duration,
        effectType: n.effectType,
        linkedTo: n.linkedTo,
      })),
      totalBeats,
      bpm: appStore.bpm(),
      scale: melodyStore.currentScale().map((s) => ({
        midi: s.midi,
        name: s.name,
        octave: s.octave,
        freq: s.freq,
      })),
    };

    savePreset(name, data);
    appStore.showNotification(`Preset "${name}" saved`, 'success');
  };

  const handleNew = () => {
    setSaveName('');
    melodyStore.setMelody([]);
    appStore.showNotification('Melody cleared', 'info');
  };

  const handleDelete = () => {
    const name = saveName().trim() || currentName();
    if (!name) return;
    deletePreset(name);
    setSaveName('');
    appStore.showNotification(`Preset "${name}" deleted`, 'info');
  };

  const handleShare = async () => {
    const melody = melodyStore.items;
    if (melody.length === 0) {
      appStore.showNotification('Nothing to share', 'warning');
      return;
    }
    const totalBeats = Math.max(...melody.map((n) => n.startBeat + n.duration));
    const ok = await copyShareURL(
      melody,
      appStore.bpm(),
      appStore.keyName(),
      appStore.scaleType(),
      totalBeats
    );
    appStore.showNotification(
      ok ? 'Share URL copied to clipboard!' : 'Failed to copy URL',
      ok ? 'success' : 'error'
    );
  };

  return (
    <div class="preset-selector">
      <select
        id="preset-select"
        value={currentName()}
        onChange={(e) => handleLoad(e.currentTarget.value)}
      >
        <option value="">— Select Preset —</option>
        {presetNames().map((name) => (
          <option value={name}>{name}</option>
        ))}
      </select>

      {props.showControls && (
        <>
          <input
            type="text"
            id="preset-name-input"
            placeholder="Preset name"
            value={saveName()}
            onInput={(e) => setSaveName(e.currentTarget.value)}
          />
          <button class="ctrl-btn small" onClick={handleSave} title="Save preset">
            Save
          </button>
          <button class="ctrl-btn small" onClick={handleNew} title="New preset">
            +
          </button>
          {currentName() && (
            <button class="ctrl-btn small danger" onClick={handleDelete} title="Delete preset">
              ×
            </button>
          )}
        </>
      )}

      <button class="share-btn small" onClick={handleShare} title="Copy share link">
        Share
      </button>
    </div>
  );
};
