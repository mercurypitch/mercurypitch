// ============================================================
// Settings sections — the web Settings panel's sub-tabs, by name
// ============================================================
//
// A module of its own so the native shell bridge (native-shell-store.ts) can
// name a section without importing ui-store, which imports the bridge.

export type SettingsSection =
  | 'account'
  | 'singing'
  | 'karaoke'
  | 'display'
  | 'sync'
  | 'credits'
