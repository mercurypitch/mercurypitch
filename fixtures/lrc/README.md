# Gold-standard lyric mappings

Hand-made word-level mappings, used as the **reference** when scoring any
automatic alignment (vocal-stem onsets, Whisper, forced alignment) and as the
A-side of the mapping differ.

Plan: [docs/plans/lrc-mapper-studio-plan.md](../../docs/plans/lrc-mapper-studio-plan.md).

## Versioning

`<asset>.v<n>.lrc`, where `<asset>` is the **R2 asset path segment**
(`demo/<asset>/…`), so a mapping is always traceable to the audio it was made
against.

Note this is *not* always the demo-song `slug`. The two disagree for one entry,
and both are load-bearing:

| Song | R2 asset path | demo-song `slug` |
|---|---|---|
| Goodbye to Spring | `demo/goodbye-to-spring/` | `karaoke-night` (the legacy slug) |
| I'll Be Right Behind You, Josephine | `demo/josephine/` | `josephine` |

The slug keys local db rows via `demoSessionId(slug)` and must never change;
the asset path names the audio. Fixtures follow the asset path because that is
what identifies the *recording* a mapping was made against.

**`v2` is the gold reference for both songs.** `v1` existed but is not kept:
it was a first pass that contained words absent from the actual lyric text
(a duplicated `seen`, a stray `you`), which disqualifies it as a reference —
a baseline with wrong *text* cannot measure timing.

Automatically produced mappings get the **next free version number** and are
compared against `v2`. They are not committed here unless a specific result is
worth pinning; this directory is for references, not for every experiment.

## Files

| File | Song | Lines | Words |
|---|---|---|---|
| `goodbye-to-spring.v2.lrc` | Josh Woodward — Goodbye to Spring | 25 | 288 |
| `josephine.v2.lrc` | Josh Woodward — I'll Be Right Behind You, Josephine | 38 | 322 |

Both are byte-identical to the `lyricsText` served by
`GET https://api-dev.mercurypitch.com/api/demo-songs` at `lyricsRevision: 2`,
verified 2026-08-06. Edit them through the studio at
`https://dev.mercurypitch.com/#/admin/demo-song`, not by hand here — then
re-sync this directory.

Format is enhanced LRC (A2): inline `[mm:ss.xx]` stamps carry **word starts
only**. Word ends and sub-word split points have no representation here — that
is one of the reasons the plan adopts `lyricsfile` as the native format.

## Comparing

```bash
pnpm lyrics:compare fixtures/lrc/goodbye-to-spring.v2.lrc <candidate>.lrc
```

Reports compared words, mean/median absolute error, p95, max, median bias, and
any mismatched lines or words. A **mismatched line means the text differs**, not
the timing — that is how the v1 errors above were caught, and it is worth
checking first when a comparison looks impossibly bad.

## Licence

Both songs are by **Josh Woodward**, released under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- Goodbye to Spring — https://www.joshwoodward.com/song/GoodbyeToSpring
- I'll Be Right Behind You, Josephine — https://www.joshwoodward.com/song/IllBeRightBehindYouJosephine

Attribution is required wherever these are used, including in-app. The demo
song manifest carries it (`attribution.text` / `.url` / `.license` /
`.licenseUrl`) and the UI must render it — see the plan's Phase 7.

Audio is **not** committed: the stems are served from R2 and pulled on demand.
This directory holds the mappings only.

## A trap: the R2 `lyrics.lrc` files are stale

Each manifest carries both a `lyrics` **URL** and an optional inline
`lyricsText`, and **`lyricsText` wins when set**. As of 2026-08-06 both songs
carry v2 as `lyricsText`, while the R2 URLs still serve older revisions:

- `demo/josephine/lyrics.lrc` → the pre-v2 mapping, including the words that are
  not in the lyric text (a duplicated `seen`, a stray `you`).
- `demo/goodbye-to-spring/lyrics.lrc` → an earlier timing revision of the same
  text, uniformly ~380 ms later than v2.

The app is correct — it reads `lyricsText`. But anyone fetching the R2 URL
directly gets the old mapping and will not be told. Fetch the API, not the
bucket, when you want the current reference.
