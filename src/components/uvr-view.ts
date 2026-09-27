// ============================================================
// The Karaoke panel's views
// ============================================================
//
// A leaf, so a module the panel imports can name a view without importing
// the panel back (uvr-studio-hosting.ts). UvrPanel re-exports it for every
// caller that already takes it from there.

export type UvrView =
  | 'upload'
  | 'processing'
  | 'results'
  | 'mixer'
  | 'shazam-listen'
  | 'shazam-results'
