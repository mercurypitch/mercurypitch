// ============================================================
// The developer console's switch, by the key it is kept under
// ============================================================
//
// One key, read in two places: the persisted signal behind the Settings
// toggle (src/stores/developer-console-store.ts) and the arming every entry
// calls (src/components/developer-console-arming.ts), which loads the
// floating panel only when the switch is on. The key lives here, in
// src/lib, because both of them can import it: a store may not reach into
// the component layer, and src/lib may not reach into it at all.

/** Shared with the persisted signal in src/stores/developer-console-store.ts. */
export const DEVELOPER_CONSOLE_KEY = 'pitchperfect_developer_console'
