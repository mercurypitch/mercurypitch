# Agent Instructions

## PR Workflow
- Each prompt or task must be addressed in a separate PR.
- PRs must always target `mercurypitch/mercurypitch:main`, even if the repo is a fork.
- Always assign `Komediruzecki` as the reviewer on every PR.
- Never push directly to main. All changes go through branches and PRs.
- Never merge a PR without explicit permission.

## Emoji Usage
- Never use emojis in any communication, including:
  - Pull Request titles and descriptions.
  - Commit messages.
  - Issue comments.
  - Responses to the user.

## Code Quality
- Always run `pnpm check:fix:all` after making any code changes to ensure there are no TypeScript, ESLint, or formatting errors.

## SolidJS Reactivity Rules & Gotchas
- **"computations created outside component root" warning**: This happens when a reactive accessor (like a `createMemo` or `createSignal` getter, e.g., `activeTrack()`) is invoked inside an asynchronous callback (like a `setTimeout`, `setInterval`, or an `async` function execution context).
  - *Mistake*: `onClick={() => { void (async () => { const track = activeTrack(); await delete(track.id) })() }}`
  - *Correct*: `onClick={() => { const track = activeTrack(); void (async () => { await delete(track.id) })() }}`
  - *Rule*: Always extract reactive values synchronously outside the async block.

## Canvas Performance
- Avoid looping over large arrays (like an entire audio waveform float array) purely per-pixel inside `requestAnimationFrame`. If `samples.length` is large, iterating `samples.length / width` per pixel will cause extreme lag (hundreds of millions of iterations per frame).
  - *Solution*: Cache the drawn background to an `OffscreenCanvas`, or aggressively downsample inside the draw loop (e.g., jump by `stepSize = Math.max(1, Math.floor(samplesPerPixel / 100))` to calculate min/max values for waveform envelopes).
- **Moire Banding / Aliasing on Waveforms**: Be careful when downsampling waveforms visually by skipping samples (e.g. jumping by `stepSize`). If the visual skip rate aligns with the audio frequencies, you'll see "stripes" or Moire patterns that appear to move or pulse at different zoom levels.
  - *Solution*: Instead of skipping samples during rendering, precalculate a "Peak Cache" (min/max mipmap) in `Float32Array` blocks (e.g. 256 samples per block) during load time. Draw by iterating the precomputed blocks instead of the raw audio data. This gives $O(1)$ constant rendering time with zero aliasing.
