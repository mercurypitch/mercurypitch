On 28 October the public R2 bucket the example songs come from stalled transfers for minutes, then dropped them. Two things in CI depend on that bucket, and both failed #1242 and #1243 for that reason alone:

- **Every native build fetches the Karaoke room's six example stems.** `sync-native-assets.mjs` calls `ensureKaraokeExamples()`, and each stem was fetched once, with no time limit. A stalled transfer held the build until the socket dropped, then failed it with `TypeError: terminated`.
  - On #1242 that failed the PR gate's Mercury Pitch build, build / iOS and build / Android.
  - On #1243 it failed build / iOS and iOS Release, which hung on `josephine/vocal.m4a` for 6 min 37 s and 10 min 18 s.
- **`jam-stage-layout.spec.ts` opens Goodbye to Spring.** The room takes a song only once its words have arrived from the bucket. On #1243's first head, one of the spec's tests failed all three tries, and five passed only on a retry.

Nothing here changes what the app ships or does: one change is a build script, the other a test.

## What changes

- `apps/mercurypitch/scripts/fetch-karaoke-examples.mjs`:
  - Each file gets three tries, 5 s and then 10 s apart.
  - A try is abandoned once 30 s pass with nothing arriving, either before the answer or between two parts of its body. A transfer that is slow but still moving is never cut off.
  - A 5xx or a 429 is tried again. Any other answer that is not ok stops the build at once, as before.
  - Each failed try is logged, and the build's error names the tries. The pin check and the `.part` file are unchanged.
- `apps/mercurypitch/src/karaoke-examples.test.ts`: six new tests.
  - A fetch that fails, then succeeds.
  - A body that drops part-way.
  - A 503 and then the file; a 404 tried once.
  - Three failures: the error names them, and nothing is written.
  - Against a server on the machine: a transfer that stalls after two bytes is abandoned and tried again. One that sends a byte every 100 ms under a 300 ms limit is not cut off.
- `src/e2e/jam-stage-layout.spec.ts`: the spec serves the demo song itself before each test, as `jam-control-bar.spec.ts` does.
  - `lyrics.lrc` is the gold copy in `fixtures/lrc`, with the same words the bucket serves.
  - Each stem is a 220 Hz tone as long as the song, 246 s, served in byte ranges. The room parks on line 6, 56 s in, and an element that cannot seek lands every jump on zero.

## Checks

On `24391ce39`, on `main` `5155a5663` (v0.9.24):

- `pnpm check`: no errors and the 11 warnings `main` has. It changed no files.
- `karaoke-examples.test.ts`: 21 tests pass, the six new ones among them.
- `pnpm pr:validate`: pass.

Earlier, on the same code:

- **On `main` `866e53c30`:** the app's `tsc`, eslint and prettier pass, and its vitest suite passes, 167 files and 1,860 tests. No file under `apps/mercurypitch` changed between `866e53c30` and `5155a5663`.
- **Mutations:** each of these fails at least one new test.
  - one try only;
  - the stall timer not reset per body part;
  - no abort signal;
  - a 404 tried again;
  - a body error thrown past the retry.
- **`jam-stage-layout.spec.ts`, on a `build:e2e` of `main` `9fd052508`,** with every request to `r2.dev` aborted and logged. (#1243, merged since, touches none of these files.)
  - 14 tests pass, and none tries the bucket.
  - With the spec's new routes removed, all 14 fail waiting for line 6, and 42 requests try the bucket.

## Left open

- **Four more specs open Goodbye to Spring with no route to the bucket:** `jam-lyric-progress`, `jam-lyric-versions`, `jam-song-picker-mobile` and `shared-drag-gesture`. They passed on these runs. Whether they need the song's words was not checked.
- **A cache for the stems in CI, or a custom domain for the bucket,** would take the bucket out of most runs. Neither is done here.
