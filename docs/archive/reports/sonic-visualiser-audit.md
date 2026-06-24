# Sonic Visualiser Feature Audit — MercuryPitch Comparison

**Date:** 2026-06-10  
**Source:** [Sonic Visualiser](https://github.com/Komediruzecki/sonic-visualiser) (C++ Qt desktop app, v5.2.1)  
**Goal:** Identify features from Sonic Visualiser (SV) that could be adapted for MercuryPitch (MP), a web-based vocal practice app.

---

## 1. Overview

Sonic Visualiser is a mature (20+ years), cross-platform C++ desktop application for music audio visualization, annotation, and analysis. It's built on Qt with a plugin architecture (Vamp plugins for analysis, LADSPA for effects). It handles large audio files efficiently through multithreading and supports extensive annotation layering.

MercuryPitch is a web-based (TypeScript/SolidJS/Web Audio) vocal practice app with real-time pitch detection, UVR stem separation, and vocal analysis features. It operates in the browser with a different set of constraints (no native file system, limited CPU, no plugin system).

---

## 2. Feature Comparison Matrix

### 2.1 Audio Visualization

| Feature | Sonic Visualiser | MercuryPitch | Gap |
|---|---|---|---|
| **Waveform display** | Peak/mean/butterfly modes, sinc-interpolated at close zoom | Basic waveform in StemMixer | **Medium** — no butterfly mode, no sinc interpolation |
| **Plain spectrogram** | FFT-based, highly configurable | Canvas2D scrolling spectrogram via STFT worker | **Low** — basic spectrogram exists, fewer options |
| **Melodic Range Spectrogram** | Frequency range cropped to melodic fundamentals (e.g. 40-1500 Hz) | Not implemented | **Low** — simple frequency range toggle |
| **Peak Frequency Spectrogram** | Phase-derived peak frequencies shown as lines, colours by power | Not implemented | **Medium** — requires phase unwrapping from STFT |
| **Spectrum (instantaneous)** | Vertical frequency slice at a point in time | Static spectrum bar chart in VocalAnalysis | **Low** — needs interactive time scrubber |
| **Colour 3D Plot** | Grid-based 3D data from plugin transforms | Not implemented | **High** — niche, depends on plugin data |
| **Slice layer** | Y-axis slice through Colour 3D Plot | N/A | **N/A** — depends on 3D Plot |

### 2.2 Spectrogram Display Options

| Feature | Sonic Visualiser | MercuryPitch | Gap |
|---|---|---|---|
| **Colour maps** | Multiple gradients + Banded + Highlight | Viridis-like only | **Low** — add 2-3 more colour maps |
| **Colour Rotation** | Adjusts colour mapping threshold to isolate intensity bands | Not implemented | **Low** — single slider control |
| **Normalization modes** | Column, View, Hybrid | None (fixed scaling) | **Medium** — global/locale normalization toggle |
| **Peak bins display** | Shows only spectral peaks (higher than neighbours) | Not implemented | **Low** — simple bin comparison filter |
| **Phase colour scale** | Colours by phase angle instead of power | Not implemented | **Low** — already have phase data from STFT |
| **Window shape options** | Hann, Hamming, Blackman, Blackman-Harris, Nuttall, Gaussian, Parzen, triangular, rectangular | Fixed window (via stft-engine.ts) | **Low** — expose window function parameter |
| **Window size/overlap** | Interactive controls | Fixed (2048 FFT, full overlap) | **Low** — expose as optional params |
| **Frequency scale** | Linear or logarithmic with piano keyboard overlay | Linear only | **High** — piano keyboard scale is a signature SV feature |
| **Oversampling** | 1x/2x/4x/8x zero-padding | Not exposed | **Low** — parameter on STFT call |
| **Harmonic cursor** | Vertical line with tick marks at harmonic frequencies | Not implemented | **Low** — simple overlay on spectrogram |

### 2.3 Annotation & Layering

| Feature | Sonic Visualiser | MercuryPitch | Gap |
|---|---|---|---|
| **Time Instants** | Point annotations with labels, segmentation display | Not implemented | **Medium** — useful for marking breath points, phrase boundaries |
| **Time Values** | Points/stems/connected/lines/curves display modes | Not implemented | **High** — curves useful for pitch drift, intensity over time |
| **Notes layer** | Start/duration/pitch with MIDI note range Y-axis | Piano roll editor (compose tab) | **Low** — editor exists, missing annotation overlay |
| **Regions** | Time spans with value and label | Not implemented | **Medium** — useful for phrase/section marking |
| **Boxes** | Rectangular areas covering time + Y range | Not implemented | **Low** — niche, for spectrogram annotation |
| **Text labels** | Freeform annotation at specific times | Not implemented | **Low** — simple overlay |
| **Image layer** | Images from file/URL at time positions | N/A | **N/A** — not relevant for vocal practice |
| **Layer stacking** | Multiple layers overlaid with aligned scales | Basic multi-view (standard/pro dashboard toggles) | **High** — core SV paradigm |
| **Multi-pane views** | Simultaneous independent views of same audio | Single view at a time | **High** — split-pane: waveform + spectrogram + pitch |

### 2.4 Analysis & Feature Extraction

| Feature | Sonic Visualiser | MercuryPitch | Gap |
|---|---|---|---|
| **Beat tracking** | Vamp plugin (tempo, beat positions) | Not implemented | **Medium** — useful for rhythm practice, metronome sync |
| **Pitch detection** | YIN + plugin ecosystem (pYIN, CREPE, etc.) | YIN, MPM, SwiftF0 ONNX | **Low** — MP has more algorithms already |
| **Onset detection** | Vamp plugins | Not implemented | **Medium** — note onset detection for attack timing |
| **Key detection** | Vamp plugins (QM Key Detector) | User selects key manually | **Medium** — auto key detection from audio |
| **Chord detection** | Vamp plugins (Chordino, NNLS Chroma) | Not implemented | **High** — major feature, complex |
| **Structural segmentation** | Vamp plugins (QM Segmenter) | Not implemented | **Medium** — auto section detection (verse/chorus) |
| **MATCH alignment** | DTW-based timeline alignment across files | Not implemented | **High** — align user recording to reference track |
| **Unit Converter** | Frequency ↔ MIDI ↔ Note name, tempo converter | Basic (frequency-to-note.ts) | **Low** — complete the conversion utilities |

### 2.5 Annotation Workflow

| Feature | Sonic Visualiser | MercuryPitch | Gap |
|---|---|---|---|
| **Import annotations** | CSV, RDF, MIDI, text formats | MIDI import only | **Medium** — CSV label import |
| **Export annotations** | CSV, RDF, MIDI, SVG image | MIDI export only | **Medium** — CSV label export |
| **Annotation by tapping** | Real-time point insertion during playback (keyboard/MIDI) | Not implemented | **Medium** — tap to mark breath/note boundaries |
| **Measurement tool** | Persistent rectangles with time/Y-axis dimensions | Not implemented | **Low** — useful for measuring pitch range/time intervals |
| **Automatic measurement** | Double-click measures similarly-coloured region | Not implemented | **Low** — niche, simple image processing |
| **Snap to features** | Selection snaps to annotation boundaries | Not implemented | **Medium** — snap to note boundaries during editing |
| **Session save/load** | Full session persistence (layout, layers, annotations) | Partial (localStorage for settings, IndexedDB for sessions) | **Medium** — save entire workspace state |

### 2.6 Playback & Transport

| Feature | Sonic Visualiser | MercuryPitch | Gap |
|---|---|---|---|
| **Extreme time stretching** | "Tiny fraction or huge multiple" with synchronized display | Speed 0.5x-2x | **Low** — extend range to 0.25x-4x |
| **Seamless looping** | Complex non-contiguous loop regions | Basic loop region in karaoke mode | **Medium** — multi-region loop, skip markers |
| **Loop playback** | Loop any selection | Basic loop endpoints | **Low** — already being worked on (karaoke-looping) |
| **Synthesised annotation playback** | Annotations rendered as audio alongside original | Not implemented | **High** — play annotations as tones (e.g., reference pitch) |
| **Multi-file alignment** | MATCH algorithm aligns timelines | Not implemented | **High** — align practice recording to teacher track |
| **OSC remote control** | Network-based control protocol | Not implemented | **Low** — web already has programmatic control |

---

## 3. Feature Adaptation Feasibility

### High Value + Low Effort (Quick Wins)

| SV Feature | MP Adaptation | Effort |
|---|---|---|
| **Piano keyboard frequency scale** | Overlay piano keys on spectrogram Y-axis. Already have MIDI-to-frequency mapping. | 1-2 days |
| **Colour map selector** | Add 2-3 additional colour maps (Banded, Greyscale, Thermal) to spectrogram. | 0.5 day |
| **Peak bins display** | Filter spectrogram to show only local maxima bins. Simple bin comparison. | 0.5 day |
| **Window shape options** | Expose Hann/Hamming/Blackman parameter on STFT engine. | 0.5 day |
| **Time Instants annotation** | Simple click-to-add labelled time points during playback. Store in IndexedDB. | 2-3 days |
| **Unit Converter UI** | Complete the frequency ↔ MIDI ↔ note converter with a simple card. | 0.5 day |

### High Value + Medium Effort

| SV Feature | MP Adaptation | Effort |
|---|---|---|
| **Annotation layering** | Allow overlaying time points, curves, and regions on the waveform/spectrogram. Reuse existing IndexedDB service pattern. | 5-7 days |
| **Time Values (curves)** | Pitch drift, intensity, HNR trend lines over time. Build on existing pitch history buffer. | 3-4 days |
| **Multi-pane views** | Split view: spectrogram + pitch trace + waveform. Each in a resizable panel. | 5-7 days |
| **Annotation by tapping** | Spacebar/click to mark time points during playback. Store as Time Instant annotations. | 2-3 days |
| **Beat tracking** | Port a lightweight onset detector (spectral flux). Use for rhythmic feedback in practice. | 5-7 days |
| **Auto key detection** | Krumhansl-Schmuckler key finding from chromagram. Helpful for "what key is this song?" | 3-4 days |
| **Session export/import** | Export practice session as JSON/ZIP (audio + annotations + scores). Import to restore. | 3-4 days |
| **Snap to features** | Selection snaps to note boundaries in piano roll. Builds on existing note detection. | 2-3 days |

### High Value + High Effort

| SV Feature | MP Adaptation | Effort |
|---|---|---|
| **MATCH alignment** | DTW or cross-correlation to align user recording to reference track. Foundation for "Naked Vocal Match" (Phase 3.1 of vocal analysis). | 7-10 days |
| **Chord detection** | Chroma extraction + template matching. Show chord labels alongside lyrics/notes. | 7-10 days |
| **Structural segmentation** | Self-similarity matrix + novelty detection. Auto-detect verse/chorus boundaries. | 10-14 days |
| **Synthesised annotation playback** | Play reference tones (target pitch) alongside user recording. Already have tone synthesis. | 5-7 days |
| **Plugin architecture** | Web Worker-based transform plugins. Define standard interface, allow community transforms. | 14-21 days |

### Not Feasible / Low Priority for Web

| SV Feature | Reason |
|---|---|
| Colour 3D Plot | Too niche for vocal practice context |
| OSC remote control | Web already has programmatic APIs, unnecessary |
| Image layer | Not relevant for audio/vocal practice |
| LADSPA effects plugins | Web Audio API provides native effects, no plugin system needed |
| Extreme time stretching (100x+) | Rubber-band library is C++; Web Audio stretch is limited |

---

## 4. Architectural Differences

### Sonic Visualiser
- **Language:** C++17 with Qt 6
- **Audio:** Native file I/O, libsndfile, libsamplerate
- **FFT:** FFTW3, vDSP (macOS)
- **Plugin system:** Vamp (C++), LADSPA (C)
- **Rendering:** QPainter / QGraphicsView (vector)
- **Data model:** Hierarchy of Model → Layer → Pane → View
- **Threading:** Pervasive background thread pool for analysis
- **Session:** XML-based session file format

### MercuryPitch
- **Language:** TypeScript, SolidJS
- **Audio:** Web Audio API (AudioContext, AnalyserNode)
- **FFT:** Custom STFT engine (Bluestein Chirp-Z) + Web Worker offloading
- **Plugin system:** None (hardcoded analysis in lib/)
- **Rendering:** Canvas2D + SVG + CSS
- **Data model:** SolidJS signals + IndexedDB persistence
- **Threading:** Web Workers + requestAnimationFrame
- **Session:** IndexedDB for history, localStorage for settings

### Key Constraints for Web Porting
1. **CPU budget:** Browser has ~10-20% of desktop CPU. Heavy analysis must be offloaded to Web Workers or done server-side.
2. **Memory:** Browser tab is typically <512MB. Large audio files need careful buffer management.
3. **FFT performance:** Web Audio's AnalyserNode provides real-time FFT at low cost, but only ~2048 bins max. Custom STFT in worker needed for higher resolution.
4. **No native file system:** File access is limited. IndexedDB for persistence works but is slower.
5. **No plugin ecosystem:** Vamp/LADSPA are native. Web Workers can fill this role but need a defined interface.

---

## 5. Recommended Implementation Order

Based on value/effort ratio and existing MercuryPitch infrastructure:

```
Phase 1: Spectrogram Polish (2-3 days)
  ├── Piano keyboard frequency scale overlay
  ├── Colour map selector (3-4 options)
  ├── Peak bins toggle
  └── Window shape parameter exposure

Phase 2: Annotation System (5-7 days)
  ├── Time Instants (click-to-mark during playback)
  ├── Time Values / Curves (pitch drift, intensity trends)
  ├── Annotation store (IndexedDB-backed)
  └── Export annotations as CSV

Phase 3: Multi-Pane Views (5-7 days)
  ├── Resizable split-pane layout
  ├── Independent spectrogram + pitch trace + waveform
  ├── Synchronized time axes
  └── Save/restore layout state

Phase 4: Analysis Tools (7-10 days)
  ├── Beat tracking (spectral flux onset detector)
  ├── Auto key detection (chromagram + K-S algorithm)
  ├── MATCH alignment (DTW for practice-to-reference)
  └── Synthesised annotation playback (reference tones)

Phase 5: Advanced Features (10-14 days)
  ├── Chord detection
  ├── Structural segmentation
  ├── Plugin-like transform interface
  └── Full session export/import
```

---

## 6. Conclusion

Sonic Visualiser has ~15 years of development on MercuryPitch and targets a different use case (general audio analysis vs. vocal practice). However, many of its visualization features are directly applicable:

- **Spectrogram enhancements** (piano keyboard scale, colour maps, peak bins) are low-effort and would make MP's spectrogram significantly more professional.
- **Annotation layering** (time instants, curves, regions) would give MP a new dimension — not just practice what you sing, but mark up and analyze your recordings.
- **MATCH alignment** is the single most valuable feature to port — it directly enables Phase 3.1 of our vocal analysis roadmap (aligned comparison engine).

The web platform constraints mean we can't match SV's raw performance or plugin ecosystem, but we can replicate the most user-visible features using Canvas2D + Web Workers + Web Audio.
