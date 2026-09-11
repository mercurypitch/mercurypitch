// ============================================================
// Arming the in-app developer console, without dragging it in
// ============================================================
//
// Every entry calls `armDeveloperConsole()`, and for almost everybody the
// answer is "not today" — so this is deliberately NOT an unconditional
// `import('@/components/ConsoleLog')`. That version pulled the panel, its
// stylesheet and its icons into every production page load, and appended a
// host to `<body>` on a page that would never show one. The standalone rooms
// spend real effort keeping their first paint empty; a debug panel is the
// last thing that should undo it.
//
// In `src/lib`, not beside the store it reads, because Piano Night and Drum
// Night call it: `assert-piano-night-bundle.mjs` and its drum twin forbid
// `src/stores/` in a room bundle, and a room importing the store for one
// boolean is exactly the kind of creep they exist to stop. So the flag is
// read straight out of localStorage, in the shape `createPersistedSignal`
// writes a boolean.
//
// Reading once is enough HERE: a standalone room has no Settings panel, so
// the flag cannot change while one is open. In the studio it can, and
// SettingsPanel mounts the panel itself on the press that turns it on —
// which is also where `ConsoleLog` is already imported.

/** Shared with the persisted signal in src/stores/console-store.ts. */
export const DEVELOPER_CONSOLE_KEY = 'pitchperfect_developer_console'

export function armDeveloperConsole(): void {
  let on = false
  try {
    on = localStorage.getItem(DEVELOPER_CONSOLE_KEY) === 'true'
  } catch {
    // Private mode, or site data blocked. Nothing to arm.
    return
  }
  if (!on) return
  void import('@/components/ConsoleLog').then((m) => {
    m.setupDeveloperConsole()
  })
}
