// ============================================================
// What an example song's manifest says about it
// ============================================================
//
// A module of its own, and a leaf, because two modules read it: the web's
// manifest loader (`demo-song.ts`) and the native bundle's
// (`bundled-examples.ts`), which the loader itself calls. Declared in either
// one, the pair imported each other.

export interface DemoSongManifest {
  /**
   * Stable id for this demo. Absent on the shipped manifest, which is
   * `LEGACY_SLUG` by definition — see `demoSessionId`.
   */
  slug?: string
  title: string
  artist: string
  attribution: {
    text: string
    url: string
    license: string
    licenseUrl: string
  }
  stems: { vocal?: string; instrumental?: string }
  /** Lyrics URL — .lrc or .lyricsfile (synced), or .txt (plain). */
  lyrics?: string
  /** Lyrics pasted straight into the studio. Wins over `lyrics` when set. */
  lyricsText?: string
  /**
   * Bumped by the API whenever the lyrics change. Seeding is deliberately
   * non-destructive, so this is the only way an authored correction can
   * reach a visitor who already has the old copy. Absent for the shipped
   * manifest, which is revision zero by definition.
   */
  lyricsRevision?: number
  durationSec?: number
}
