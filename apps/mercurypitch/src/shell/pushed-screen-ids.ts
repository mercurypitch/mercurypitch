// ============================================================
// The screens the shell can push over a tab, by id
// ============================================================
//
// Types only, so the modules that key on a screen (premium-rooms.ts,
// premium-exercise-wiring.ts, ShellScreens.tsx) need not import the shell's
// state machine for a name. run-shell-store.ts re-exports both.

/**
 * A screen pushed over the tab, with its own Back.
 *
 * Settings is the root of a stack of them: it is a short grouped list whose
 * rows push screens of their own (S6, decision D1 A), and each of those can
 * push again. Developer stands on its own, reached from More, and so does the
 * Karaoke studio, reached from the Karaoke room's Options (S8 §11, D8 A), and
 * Leagues, reached from More's Together group (NATIVE_LEAGUES), and the
 * Legend room beside it, a premium room drawn full-bleed (premium-rooms.ts).
 */
export type PushedScreen =
  | 'settings'
  | 'account'
  | 'account-name'
  | 'devices'
  | 'delete-account'
  | 'microphone'
  | 'room-noise'
  | 'storage'
  | 'this-phone'
  | 'appearance'
  | 'about'
  | 'karaoke'
  | 'karaoke-studio'
  | 'long-note'
  | 'echo'
  | 'lip-roll'
  | 'ng-slides'
  | 'warm-up'
  | 'home-note'
  | 'first-note'
  | 'leap'
  | 'developer'
  | 'leagues'
  | 'legend'

/** A screen that is only ever reached through Settings. */
export type SettingsChild = Exclude<
  PushedScreen,
  | 'settings'
  | 'developer'
  | 'karaoke-studio'
  | 'long-note'
  | 'echo'
  | 'lip-roll'
  | 'ng-slides'
  | 'warm-up'
  | 'leagues'
  | 'legend'
>
