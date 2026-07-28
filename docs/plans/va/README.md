# Vocal Analysis & Visualization Enhancement Plans

> **SUPERSEDED.** These phases shipped into `VocalAnalysis.tsx` and made the
> Analysis page an audio-research workbench grafted onto a singing app — most
> controls were unreachable (every Phase 4/5 tool needed accumulated spectra,
> which only exist while the mic is live), and metrics were computed from note
> metadata that could not support them.
>
> The Analysis page is now a capability-tiered singer's dashboard
> (`src/features/analysis/`). The tooling described below still exists, but on
> the hidden Lab surface (`src/features/lab/`, reached at `#/lab`). Keep these
> documents for the DSP background; do not treat them as the current plan.

**Source:** [Sonic Visualiser Feature Audit](../../reports/sonic-visualiser-audit.md)  
**Branch:** `feature/vocal-analysis-enhancements`  
**Status:** Superseded by the Analysis redesign

---

## Phase Overview

| # | Phase | Plan Doc | Effort | Priority |
|---|---|---|---|---|
| 1 | Spectrogram Polish | [phase-1-spectrogram-polish.md](phase-1-spectrogram-polish.md) | 2-3 days | 🔴 High |
| 2 | Annotation System | [phase-2-annotation-system.md](phase-2-annotation-system.md) | 5-7 days | 🔴 High |
| 3 | Multi-Pane Views | [phase-3-multi-pane-views.md](phase-3-multi-pane-views.md) | 5-7 days | 🟡 Medium |
| 4 | Analysis Tools | [phase-4-analysis-tools.md](phase-4-analysis-tools.md) | 7-10 days | 🟡 Medium |
| 5 | Advanced Features | [phase-5-advanced-features.md](phase-5-advanced-features.md) | 10-14 days | 🟢 Lower |

## Total Estimated Scope

**~30-40 days** across all 5 phases.

## Dependencies

```
Phase 1 (Spectrogram Polish) ── independent
Phase 2 (Annotation System) ── independent, but annotations overlay on Phase 1 views
Phase 3 (Multi-Pane Views) ── depends on Phase 1 (needs polished views to split)
Phase 4 (Analysis Tools) ── independent, feeds data to Phase 2 annotations
Phase 5 (Advanced Features) ── depends on Phases 1-4
```

## How to Use These Plans

Each phase plan is self-contained and can be implemented independently. Read the phase plan, approve it, and it becomes the implementation spec.

## Relation to Existing Features

These plans **extend** (not replace) the existing vocal analysis system:
- `VocalAnalysis.tsx` — current host for most visualizations
- `ProDashboard` — Altitude-style mixer UI
- `SpectrogramCanvas` / `CentsDeviationCanvas` / `VibratoWaveformCanvas` — existing canvases to enhance
- `vocal-analyzer.ts` — analysis functions to extend
- `stft-engine.ts` — FFT engine to parameterize
