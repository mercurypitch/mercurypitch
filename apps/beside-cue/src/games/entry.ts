// ============================================================
// The way into the B-side games
// ============================================================
//
// v1 goes to the stores without the games (maff, 2026-09-14): they are not
// polished enough for a first review. Whether a build carries them is fixed
// when it is built, from VITE_BESIDE_CUE_GAMES=1, and is never a remote
// switch: turning a shipped but hidden feature on after approval is what App
// Review guideline 2.3.1 forbids, so the games come back in a build that is
// reviewed with them.
//
// Without the flag, vite.config.ts answers `@/games/entry` with entry-off.ts,
// so this module and everything it would load are never read: no games code,
// no pitch engine and none of its onnxruntime wasm reach the bundle. A dynamic
// import behind a false constant is not enough. Rollup still loads every
// module an import() names, and the files those modules emit (the pitch
// detector worker, the 25 MB wasm) stay in the output even though no code
// reaches them (measured 2026-09-14). Import this module only as
// `@/games/entry`; a relative path walks around the switch.
//
// The flag alone does not bring the games back: the microphone declarations
// left both native projects with them. docs/games/mini-games.md lists what to
// restore.

import type { Component } from 'solid-js'

export type GamesScreenLoader = () => Promise<{
  readonly default: Component<{ readonly onBack: () => void }>
}>

/** Sets up what the games need before any of their modules runs, then loads the screen. */
export const loadGamesScreen: GamesScreenLoader | undefined = async () => {
  const [{ configureInputDevice }] = await Promise.all([
    import('@irchiinnuss/audio-io'),
    // The pitch engine's asset paths, before any game can ask for pitch.
    import('./glass/pitch-assets'),
  ])
  // The remembered microphone is this product's, not the package's default:
  // two apps served from one origin must not share the entry.
  configureInputDevice({ storageKey: 'beside-cue:input-device' })
  const { GamesScreen } = await import('../screens/GamesScreen')
  return { default: GamesScreen }
}
