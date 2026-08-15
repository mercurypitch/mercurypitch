# Bug hunt — MercuryPitch

Audit date: 2026-08-14. Commit `e45a0c8`.

Six independent hunts ran in parallel, each with a different lens — asynchrony
and lifecycle, DSP and numerics, worker security, state and persistence, UI and
resource leaks, error handling. Every candidate below cites a file and line and
was found by reading the code, not by pattern-matching a linter.

## How to read the status column

| Status        | Meaning                                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CONFIRMED** | Independently reproduced during this audit, with the evidence recorded below. Treat as fact.                                                                                                  |
| **FIXED**     | Confirmed, fixed, and covered by a regression test that was verified to fail without the fix.                                                                                                 |
| reported      | Found and evidenced by a hunt agent that read the code. Adversarial verification was still running when this document was written. Treat as a strong lead, not as fact — check before acting. |

Confidence is the finding agent's own rating and is orthogonal to status.

---

## Fixed on this branch

**19 defects are fixed on this branch** — 18 from the hunt plus one found while
reviewing those fixes. Every `certain`-confidence candidate has now been read
against the code; see the verification pass below for the two that are confirmed
but deliberately left unfixed, and the three whose _suggested fix_ was wrong.

13 of the fixes carry a regression test that was verified to fail when the fix
is reverted. Where there is no test, the reason is stated rather than glossed:

| Location                                                      | Fix                                                                                   | Test                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/stores/uvr-store.ts:967`                                 | `sessionStemPresence` reports present/absent/unknown; only absent authorises a delete | mutation-verified                                                                                               |
| `src/lib/pitch-algorithms/fft-detector.ts:294`                | Forward twiddle sign; spectrum now matches a naive DFT bin for bin                    | mutation-verified                                                                                               |
| `src/lib/pitch-detector.ts:274`                               | Bin to hertz divides by `bufferSize`, not `bufferSize/2`                              | mutation-verified                                                                                               |
| `src/lib/hash-router.ts:220`                                  | `safeDecode` — a malformed URL no longer takes the app down at boot                   | mutation-verified                                                                                               |
| `src/stores/jam-store.ts:2113`                                | In-flight guard — one capture per unmute                                              | mutation-verified                                                                                               |
| `src/stores/jam-store.ts:2114`                                | Service and room re-checked after the await, so Leave really leaves                   | none — needs a leave-during-await harness                                                                       |
| `src/features/stem-mixer/useStemMixerCanvasController.ts:197` | Peak cache is a `WeakMap`, so decoded audio can be collected                          | none — behaviourally identical; only a heap profile can tell them apart                                         |
| `src/components/UvrPanel.tsx:153`                             | Vocal-stem object URL revoked in a `finally`                                          | none — `setup.ts` stubs `createObjectURL` and does not stub `revokeObjectURL`, so the balance is not observable |
| `src/components/StemMixer.tsx:2281`                           | Clipboard rejection shows a toast instead of the crash modal                          | none — no test drives this button                                                                               |
| `src/components/jam/JamInviteModal.tsx:20`                    | "Copied!" only after the write actually succeeds                                      | none — no test drives this modal                                                                                |

Making the last four testable is itself a finding: the `revokeObjectURL` gap in
`src/tests/setup.ts` means **no leak of this class is observable anywhere in the
suite**, and it is the reason the audit had to find these by reading rather than
by running. See TESTING.md §5.3.

The remaining 36 are unfixed. The one that most needs a decision rather than a
patch is the account takeover in §2.

## Verification pass — what is real, and where the hunt was wrong

Every `certain`-confidence candidate was read against the code. The findings
themselves held up well: **not one was fabricated**, and the file/line citations
were accurate throughout. What did not hold up as reliably were the _suggested
fixes_ and, in two cases, the severity.

That is the useful lesson from this pass. The hunt reasoned locally — correctly
about the code in front of it, and without checking who else depended on that
code. Three of its remedies would have introduced a worse defect than the one
they closed.

### Verified real, and fixed

| Finding                                                             | Note                                                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `AppErrorBoundary.tsx:56` network errors show the crash modal       | Exactly as described. `preventDefault()` in the other listener does not stop this one.                                   |
| `uvr-service.ts:115` the `*Strict` reads are not strict             | All four readers, not just the one cited.                                                                                |
| `sync-peer.ts:94` dispose during the ICE fetch                      | Same check-then-await-then-act shape as the jam unmute bug.                                                              |
| `index.ts:218` `where[]` filters as a query oracle                  | Real. Values were already parameterised, so this is disclosure, not injection. Fixed for `privateCols` only — see below. |
| `chord-detector.ts:200` previous-segment start from the array index | Real, and worse than described: it makes the minimum-duration filter largely inert.                                      |
| `OfflinePitchCanvas.tsx:61` `forceRedraw` never queues a frame      | Real. The loop only re-arms while playing, so a stopped canvas never repaints.                                           |
| `HistoryCanvas.tsx:84` waveform double-scaled                       | Real. Arithmetic confirmed: past x=400 of an 800px strip every column reads out of range.                                |

### Verified real, severity corrected downward

**`jam/service.ts:152` — ICE recovery timers survive leaving the room.**
The hunt implied a restart is attempted on a closed connection. It is not: the
timer callback re-checks `pc.iceConnectionState === 'disconnected'`, and a closed
connection reports `'closed'`. What is real is narrower — the timer holds the
peer connection alive for the rest of the grace window, and stale retry counts
carry into the next room. Cleared anyway, as hygiene.

### Verified real, but the suggested fix is wrong

These are the ones to be careful with. The defect is genuine; applying the
proposed remedy as written would break something else.

**`StemMixer.tsx:1724` — the added stem's object URL is never revoked.**
Leak confirmed. The suggested fix — "revoke as soon as `decodeAudioData`
resolves" — is **wrong**: the URL is stored on the track and re-fetched later by
`useStemMixerAudioController.ts:588` (`loadOne(t.url)`) and `:1284`. Revoking
after the decode would break stem reloading and export. The correct place is
when the extra stem is removed, or when the mixer tears down. Left unfixed
because it needs that lifetime traced properly.

**`melody-store.ts:1041` — deleting a melody leaves dangling `melodyId`s.**
Confirmed: `deleteMelody` filters `playlists[].melodyKeys` and never touches
`library.sessions`. The suggested fix — drop session items whose `melodyId`
matches — would break `restoreMelody`, the undo path directly below it: undoing
the delete would bring the melody back with the session items already gone. The
`missing: true` variant the hunt offered as an alternative is the right shape.
**Fixed** that way, with the state derived rather than stored so the undo needs
no second write. See the full entry below.

**`index.ts:218` — the `publicCols` half of the query oracle.**
**Now fixed too.** The worry that it would block a singer filtering their own
rows on a `user`-scoped table was right, and is handled by exempting
`access: 'user'` outright — `scopeRead` pins those reads to the caller, so a
filter there can only reveal something about the caller. `orderBy` went the
same way, which the original entry had missed: paginating a sort on a hidden
column recovers its value without ever reading it.

## A defect the hunt missed, found by reviewing the fixes

`src/lib/jam/service.ts:152` — `leaveRoom`

The hunt's `jam-store.ts:2114` finding observed in passing that `leaveRoom`
"closes the data channels and peer connections but **deliberately** does NOT
call `stopLocalStream()`". Reviewing the fix for that finding showed the word
"deliberately" was doing a lot of work:

- `leaveRoom()` releases no local media.
- `dispose()` does release it — and `disposeJam()`, its only caller, has **zero call sites in the app**. `JamPanel.tsx:1075` wires the Leave button to `leaveJamRoom`, which calls `leaveRoom()`, never `dispose()`.
- `cleanupJam()` runs `setJamLocalStream(null)`, which drops the store's reference but leaves the service holding a live `MediaStream`.

So leaving a jam room never released the microphone. The capture stayed live,
with the browser's recording indicator lit, until the tab was closed. Rejoining
reused the still-open capture, which is why nothing looked broken from inside
the app.

`cleanupJam` states the intended contract in its own comment — "the next room
captures its own microphone on its own first unmute" — which is only true if the
previous capture was released. It was not.

Fixed by stopping local media in `leaveRoom`. Covered by
`src/lib/jam/service-local-media.test.ts`, which drives the real
`createJamService` rather than a double; reverting the fix turns two of its
three cases red.

**Worth noting for how the audit ran:** the hunt found the narrow race and
described the broad bug in a subordinate clause without recognising it. That is
an argument for reviewing findings against the code rather than accepting the
framing that comes with them.

## The four that were verified in depth

### 1. FIXED — Startup prune could permanently delete paid separations

`src/stores/uvr-store.ts:967`, `src/db/services/uvr-service.ts:135`

`pruneOrphanedCompletedSessions()` runs on every app start and durably deletes
any `completed` session whose stems it cannot find. `sessionHasPlayableStems()`
returned `false` on **any** thrown error, so "the read failed" and "there are no
stems" were the same answer. The delete has no undo and each lost session is a
separation the user paid for.

Severity stated honestly: this needs a _transient_ failure. Under a total
IndexedDB outage the bug is self-limiting, because `deleteUvrSessionFromDb`
reads the same store and bails out too. The dangerous window is one failed read
followed by a working one — which IndexedDB does produce per transaction
(`TransactionInactiveError`, eviction mid-session, a timeout under load).

**Fixed.** `sessionStemPresence()` now returns `'present' | 'absent' | 'unknown'`
and only `'absent'` authorises a delete. Regression test in
`src/tests/uvr-session-reconcile.test.ts`, mutation-verified: reverting the fix
makes it fail with `expected 1 to be +0`.

### 2. CONFIRMED — Anonymous account takeover: the credential is a public identifier

`workers/db-worker/src/auth.ts:1046-1073`, `workers/db-worker/src/index.ts:985`

For an anonymous account the user id **is** the `deviceId`, and `deviceId` is the
sole credential `POST /api/auth/anonymous` accepts:

```ts
const id = body.deviceId
const existing = await findUserById(env.DB, id)
if (existing) {
  if (existing.authProvider !== 'anonymous') return respond({...}, {status: 403})
  return issueSession(env, existing, respond)   // <- session, on id alone
}
```

That id is published. `GET /api/leaderboard` is **unauthenticated** — the route
at `index.ts:2002` applies a rate limit and nothing else — and its response
projection emits `userId: r.userId` for every entry (`index.ts:985`).

So the attack is: read the public leaderboard, harvest `userId` values, POST each
one to `/api/auth/anonymous`, and receive a valid session for every account still
on `authProvider === 'anonymous'`. Those are exactly the users who appear on the
board before they ever sign up. The attacker then holds their practice history,
streaks and profile.

The `authProvider !== 'anonymous'` check contains the blast radius to
un-upgraded accounts. It does not close the hole.

**Fixed** — option _(b)_, by owner decision. The id stays public, because
`sessionRecords`, `follows`, `userProfiles` and every share reference it and
renaming it would orphan all of them. What changed is that it is no longer
sufficient: migration `0029_device_secret.sql` adds `users.deviceSecretHash`,
the client mints a 256-bit secret per browser (`getDeviceSecret`), and every
path that would act on an anonymous account now goes through
`authorizeDeviceSecret`:

- `POST /api/auth/anonymous` — 403 without the secret
- `POST /api/auth/register` with a `deviceId` — 403, so the permanent takeover
  is closed too
- `POST /api/auth/google` and the redirect flow — the deviceId is dropped
  unless proved, so sign-in still succeeds and simply creates a fresh account
  rather than absorbing somebody else's

The redirect's consent URL is now fetched with `POST /api/auth/google/start`
rather than assembled from a query string: a secret in a URL lands in browser
history, server logs and `Referer` headers. The GET form still works for a
stale cached bundle — it just cannot carry a deviceId whose account has bound
a secret.

**Residual risk, accepted.** Existing accounts have no hash and nothing can
back-fill one — the secret only ever existed on a client. They are
grandfathered: the first sign-in that presents a secret binds it, and the id
alone stops working from then on. So an attacker who replays a harvested id
before its owner next opens the app binds their own secret and keeps the
account. The alternative was signing every existing anonymous singer out of
their own practice history on deploy day. `'is trust-on-first-use, and this is
who wins the race'` in `node-tests/device-secret-integration.test.ts` asserts
that window rather than hiding it.

### 3. CONFIRMED — realFFT computes a mirrored phantom spectrum

`src/lib/pitch-algorithms/fft-detector.ts:288-294`

The real-FFT unpack derives Even and Odd correctly, then applies the twiddle with
the wrong sign — `e^{+i pi k / halfN}` where the forward transform needs
`e^{-i pi k / halfN}`.

Verified by comparing `realFFT` against a naive O(n^2) DFT on a two-tone signal
(bins 3 and 17, n=256):

| Bin                | Naive DFT |   realFFT |     Error |
| ------------------ | --------: | --------: | --------: |
| 17 (real tone)     |     38.40 |     35.11 |      3.29 |
| **111** (= 128-17) |  **0.00** | **15.56** | **15.56** |
| **125** (= 128-3)  |  **0.00** |  **6.59** |  **6.59** |

The errors land at the mirror positions `halfN - k`: the wrong twiddle sign
reflects energy into bins that should be empty. A phantom at 15.56 is 40% of the
magnitude of the genuine second tone.

Why the existing tests miss it: for a single dominant tone the **peak bin is
still correct** (3 vs 3 in this run), and `fft-detector.test.ts` only asserts the
detected frequency. The spectrum is wrong; the argmax usually is not.

Impact is real for anything reading the magnitudes rather than the argmax —
harmonic analysis, timbre, and any signal where a phantom can outrank a true
harmonic.

### 4. CONFIRMED — Frequency-domain fallback is one octave sharp

`src/lib/pitch-detector.ts:274`

```ts
const frequency = (maxIdx * this.sampleRate) / (this.bufferSize / 2)
```

`freqData` is a frequency-domain array whose length is `fftSize / 2`, so the
bin-to-hertz conversion is `maxIdx * sampleRate / fftSize`. Dividing by
`bufferSize / 2` is exactly **2x too high** — every pitch from this path is
reported one octave sharp. A hunt agent measured it end to end: a 220 Hz sine
returns `frequency: 430.66, noteName: 'A', octave: 4`.

Fix: divide by `this.bufferSize`, and restrict the peak search to the
`[minFrequency, maxFrequency]` bin range rather than scanning the whole array.

---

## Full candidate list

46 candidates, ordered by severity. The four above are marked; the rest carry the
`reported` status defined at the top.

| Severity | Location                                                             | Finding                                                                                                                     | Confidence | Status                                     |
| -------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------ |
| critical | `src/lib/pitch-algorithms/fft-detector.ts:294`                       | realFFT applies the conjugate (wrong-sign) twiddle, producing a mirrored phantom spectrum                                   | certain    | **FIXED**                                  |
| critical | `src/stores/uvr-store.ts:967`                                        | Startup prune permanently deletes completed songs when the IndexedDB read merely fails                                      | certain    | **FIXED**                                  |
| critical | `workers/db-worker/src/auth.ts:1057`                                 | Anonymous account takeover: the anonymous credential (deviceId) is published as userProfiles.id                             | certain    | **CONFIRMED** — FIXED                      |
| high     | `src/components/AppErrorBoundary.tsx:56`                             | Network-error rejections still trigger the full-screen crash modal — preventDefault() does not stop the second listener     | certain    | **FIXED**                                  |
| high     | `src/components/HistoryCanvas.tsx:84`                                | HistoryCanvas live waveform is double-scaled — the right half of the strip always draws flat                                | certain    | **FIXED**                                  |
| high     | `src/components/PitchTestingTab.tsx:674`                             | Lab pitch analysis mixes two sample rates: detectors hardcode 44100 while the AudioContext runs at 48000                    | likely     | reported                                   |
| high     | `src/db/services/settings-service.ts:241`                            | Cloud settings sync silently discards local annotations once they exceed the 8 KB push ceiling                              | likely     | reported                                   |
| high     | `src/db/services/streak-service.ts:81`                               | Streaks, daily goal and Ascent days key on UTC dates while the rest of the app uses local dates                             | likely     | reported                                   |
| high     | `src/db/services/uvr-service.ts:115`                                 | The uvr-service `*Strict` reads are not strict — findAll swallows storage failures and returns []                           | certain    | **FIXED**                                  |
| high     | `src/features/stem-mixer/useStemMixerCanvasController.ts:197`        | Stem-mixer waveform peak cache is a strong Map keyed by AudioBuffer — every decoded song stays resident                     | certain    | **FIXED**                                  |
| high     | `src/lib/jam/jam-song-transfer.ts:238`                               | sendInChunks can wait forever on `bufferedamountlow` after the peer's channel dies, wedging the jam song share              | likely     | reported                                   |
| high     | `src/lib/pitch-detector.ts:274`                                      | Frequency-domain fallback converts bin index to Hz with the wrong denominator — every pitch is exactly one octave sharp     | certain    | **FIXED**                                  |
| high     | `src/lib/sync/sync-peer.ts:94`                                       | Closing the sync modal mid-connect still opens a WebSocket and a room nothing can ever close                                | certain    | **FIXED**                                  |
| high     | `src/stores/drive-sync-store.ts:172`                                 | Drive backup finds zero songs after any page reload because `outputs` is never rehydrated                                   | likely     | reported                                   |
| high     | `src/stores/jam-store.ts:2113`                                       | Double-tap unmute in a jam room opens two microphone captures                                                               | certain    | **FIXED**                                  |
| high     | `src/stores/jam-store.ts:2114`                                       | Leaving a jam room during the unmute await restarts pitch detection and leaks a 20 Hz interval plus a live mic              | likely     | **FIXED**                                  |
| high     | `workers/db-worker/src/index.ts:904`                                 | Unilateral follow rows let any authenticated user read any user's private streak and score aggregates                       | likely     | reported                                   |
| medium   | `src/components/OfflinePitchCanvas.tsx:61`                           | OfflinePitchCanvas sets forceRedraw but never queues a frame — analysis results and label toggles do not repaint            | certain    | **FIXED**                                  |
| medium   | `src/components/PitchCanvas.tsx:199`                                 | PitchCanvas starts the AudioEngine with a floating promise, turning a failed AudioContext into an unhandled rejection       | likely     | reported                                   |
| medium   | `src/components/PitchCanvas.tsx:2079`                                | PitchCanvas runs a full redraw from a createEffect on top of its own rAF loop — two render paths, double the work per frame | certain    | reported                                   |
| medium   | `src/components/StemMixer.tsx:1724`                                  | "Add stem" mints a blob URL for a multi-megabyte WAV that is never revoked                                                  | certain    | **CONFIRMED** (fix needs care — see above) |
| medium   | `src/components/StemMixer.tsx:2281`                                  | Share button's clipboard write has no rejection handler — a blocked clipboard pops the crash modal instead of a toast       | certain    | **FIXED**                                  |
| medium   | `src/components/UvrPanel.tsx:153`                                    | Shazam fingerprinting leaks the vocal stem's blob URL on every indexed song                                                 | certain    | **FIXED**                                  |
| medium   | `src/components/jam/JamInviteModal.tsx:20`                           | Jam "Copy link" buttons show "Copied!" even when the clipboard write is rejected                                            | certain    | **FIXED**                                  |
| medium   | `src/components/panes/WaveformPane.tsx:63`                           | WaveformPane maps absolute window time through the window duration — the waveform collapses once the view scrolls off zero  | likely     | reported                                   |
| medium   | `src/db/services/grant-flush.ts:253`                                 | grant-flush's local badge write is not idempotent, so a retried flush duplicates userBadges rows                            | likely     | reported                                   |
| medium   | `src/features/stem-mixer/useStemMixerLyricsController.ts:864`        | Lyrics lookup reports a network outage as "no lyrics found"; the abort branch is dead code                                  | likely     | reported                                   |
| medium   | `src/lib/chord-detector.ts:200`                                      | detectChords computes the previous segment's start time from the merged-array index instead of its stored time              | certain    | **FIXED**                                  |
| medium   | `src/lib/hash-router.ts:220`                                         | A malformed percent-escape in the URL hash makes parseHash throw URIError and crash the app                                 | certain    | **FIXED**                                  |
| medium   | `src/lib/jam/service.ts:152`                                         | Jam ICE recovery timers survive leaving the room and disposing the service                                                  | certain    | **FIXED**                                  |
| medium   | `src/lib/uvr-processing-pipeline.ts:162`                             | Processing pipeline mutates the live session cache array in place, bypassing copy-on-write                                  | likely     | reported                                   |
| medium   | `src/stores/melody-store.ts:1041`                                    | Deleting a melody leaves dangling melodyId references in every session that used it                                         | certain    | **CONFIRMED** — FIXED                      |
| medium   | `src/workers/spectral.worker.ts:40`                                  | Spectral worker reads only STFT frame 0, which is half zero-padding — timbre is measured on a decaying half-window          | likely     | reported                                   |
| medium   | `workers/db-worker/src/billing.ts:925`                               | Stripe checkout grants credits without checking payment_status                                                              | possible   | reported                                   |
| medium   | `workers/db-worker/src/index.ts:218`                                 | where[] filters accept any column, turning masked/private columns into a query oracle                                       | certain    | **FIXED**                                  |
| low      | `src/components/PitchCanvas.tsx:989`                                 | Target-pitch tolerance band on the practice canvas is 0.1 cents wide, so it renders as zero pixels                          | likely     | reported                                   |
| low      | `src/components/StemMixerTransport.tsx:603`                          | Stem-mixer transport seek bar is a click-only div with no role, tabindex or keyboard handler                                | certain    | reported                                   |
| low      | `src/features/editor/useEditorController.ts:35`                      | Editor share handler leaves a clipboard rejection unhandled and gives no failure feedback                                   | certain    | reported                                   |
| low      | `src/features/stem-mixer/useStemMixerCanvasController.ts:151`        | setCanvasRef's teardown branch is unreachable — canvases are never unobserved and their listeners never removed             | likely     | reported                                   |
| low      | `src/features/stem-mixer/useStemMixerPitchAnalysisController.ts:242` | parseInt(noteName.slice(-1)) \|\| 4 mangles octave 0, negative octaves and octave 10                                        | likely     | reported                                   |
| low      | `src/lib/lyrics-service.ts:280`                                      | Timeout timer and abort listener leak whenever the lyrics fetch rejects                                                     | likely     | reported                                   |
| low      | `src/lib/vocal-analyzer.ts:320`                                      | computeHNR returns -Infinity for hnrDb when no harmonic bin carries energy                                                  | possible   | reported                                   |
| low      | `workers/db-worker/src/auth.ts:1361`                                 | verifyState decodes the OAuth state signature outside any try/catch — malformed state returns 500, not 400                  | certain    | reported                                   |
| low      | `workers/db-worker/src/auth.ts:2093`                                 | Device-link poll token hash compared with !== (non-constant-time)                                                           | possible   | reported                                   |
| low      | `workers/db-worker/src/index.ts:2133`                                | decodeURIComponent on the path segment throws on malformed percent-encoding, yielding 500                                   | certain    | reported                                   |
| low      | `workers/db-worker/src/index.ts:236`                                 | Unvalidated offset query parameter is bound to SQL as NaN                                                                   | possible   | reported                                   |

---

## Detail

Each entry below carries the failure scenario and the suggested fix as recorded
by the hunt. Locations are unchanged from the table above.

### [critical] realFFT applies the conjugate (wrong-sign) twiddle, producing a mirrored phantom spectrum

`src/lib/pitch-algorithms/fft-detector.ts:294` — confidence: certain — status: FIXED

`realFFT` unpacks the half-length complex FFT using the standard split formula X[k] = Xe[k] + W^k·Xo[k], where for a forward DFT W^k = e^(-i·π·k/halfN) = cosVal - i·sinVal. The code instead multiplies (reOdd + i·imOdd) by (cosVal + i·sinVal), i.e. e^(+i·π·k/halfN) — the inverse twiddle. The complexFFT it feeds from is a forward transform (`this.complexFFT(data, halfN, false)` → sign = -1), so the two conventions disagree. The result is not the correct magnitude spectrum: energy at bin k leaks into bin (fftSize/2 - k), i.e. every real component at frequency f produces a phantom peak at (sampleRate/2 - f), and the true peak is attenuated. I verified this by diffing `realFFT` against a naive DFT (max magnitude error 0.197 on a 64-point two-tone signal, vs <1e-9 after flipping the sign to `twRe = reOdd*cosVal + imOdd*sinVal; twIm = -reOdd*sinVal + imOdd*cosVal`). All 52 existing fft-detector tests pass with the bug present, because pure in-band tones put their phantom above 20 kHz, outside the 65-2100 Hz search range — so the defect is invisible to the suite but live in production.

**Failure scenario.** Any near-Nyquist content aliases into the vocal band as a confident false pitch. I ran the real `FFTDetector` on a pure 20500 Hz tone at 44100 Hz (amplitude 0.9, 4096 samples, bufferSize 2048) and it returned `{"frequency":1550.24,"clarity":0.537,"noteName":"G6","octave":6,"midi":91}` — an inaudible ultrasonic component reported as a solid G6 with 54% confidence. Real mic input (hiss, cymbals, ADC aliasing, switching-supply whine near Nyquist) will therefore produce phantom notes. Separately, every genuine peak's magnitude is wrong because it is split with its mirror, which biases the `minAmplitude` gate and the SNR-derived `clarity`.

**Suggested fix.** Conjugate the twiddle to match the forward-DFT convention used by `complexFFT`: `const twRe = reOdd * cosVal + imOdd * sinVal; const twIm = -reOdd * sinVal + imOdd * cosVal;`. Add a regression test that compares `realFFT` magnitudes against a naive O(N^2) DFT for a random signal, which is what caught this.

### [critical] Startup prune permanently deletes completed songs when the IndexedDB read merely fails

`src/stores/uvr-store.ts:967` — confidence: certain — status: FIXED

`pruneOrphanedCompletedSessions()` is fired unawaited from `initSessionStore()` (uvr-store.ts:881) on every app start. For each completed session it asks `sessionHasPlayableStems(sessionId)` and, on `false`, calls `deleteUvrSessionFromDb` + `removeUvrSessionFromCache` — a permanent delete of the session record, its stem blobs and its fingerprints.

The predicate cannot distinguish "no stems" from "could not read". It swallows errors twice over: `sessionHasPlayableStems` (uvr-service.ts:135-149) has its own `catch { ... return false }`, and even without that, `DexieRepository.findAll` already catches every error, logs a warning and returns `[]` unless `throwOnError: true` is passed (dexie-adapter.ts:209-215) — which this call does not pass. So any transient IndexedDB failure (blocked upgrade, storage evicted mid-read, Safari private mode, a DataError on the `sessionId` index) is read as "this completed song has no audio" and the song is destroyed.

The codebase already knows this hazard — `listStemTypesStrict` right above it is documented as existing "so callers cannot mistake an unread database for a session with no stems" — but the one operation that deletes user data uses the failure-swallowing variant.

**Failure scenario.** A user has 20 separated songs (hundreds of MB of stems) in IndexedDB. On a launch where the `uvrStemBlobs` read fails or resolves empty for any reason — a Dexie version upgrade racing the unawaited prune, storage pressure, a private-window quirk — `repo.findAll({where:{sessionId}})` returns `[]` for every session. The prune loop then deletes all 20 sessions from IndexedDB and from the in-memory cache. The library is empty on the next render and there is no undo; the only recovery is a Drive restore, which (see the separate finding) is itself broken after a reload.

**Suggested fix.** Make the destructive predicate strict: give `sessionHasPlayableStems` a strict sibling that passes `throwOnError: true` and does not catch, and have `pruneOrphanedCompletedSessions` skip (not delete) any session whose stem read threw. Deleting user audio should require a positive, successful read that returned zero rows — never an error degraded to `false`.

### [critical] Anonymous account takeover: the anonymous credential (deviceId) is published as userProfiles.id

`workers/db-worker/src/auth.ts:1057` — confidence: certain — status: FIXED

An anonymous account's userId IS the client-generated device UUID (`handleAnonymous` uses `body.deviceId` verbatim as `users.id` and `userProfiles.id`), and the comment at auth.ts:1064 declares "Knowing the random UUID is the anonymous credential." But that UUID is not secret: `ensureProfile` creates a `userProfiles` row whose `id` equals it, `userProfiles` has TableDef access `'owner'` (public, unauthenticated reads — `scopeRead` returns `{}` for it, see index.ts:277), and `publicCols` at tables.ts:160 explicitly includes `'id'`. So `GET /api/userProfiles?limit=1000&offset=N` (no Authorization header required, no rate limit — index.ts only rate-limits POST/PATCH/DELETE) enumerates every user id in the deployment, and every id belonging to an anonymous account is a working credential.

Two separate escalations follow. (a) `POST /api/auth/anonymous {"deviceId":"<victim id>"}` returns a signed JWT for that account — full read/write access to their sessionRecords, voiceprints, userSettings, userActivity and songManifests (their whole song library listing). (b) Worse and permanent: `handleRegister` (auth.ts:1105) upgrades an anonymous row in place from a bare `deviceId` in the body with **no token required at all**, so `POST /api/auth/register {email: attacker@x, password: …, deviceId: <victim id>}` rewrites `users.authProvider='password', email, passwordHash` on the victim's row and hands the attacker permanent ownership of the account and its data.

The leaderboard (index.ts:988 `userId: r.userId`) and `handleFriendRedeem` also emit raw user ids, so even without the profile list the ids leak. Rate limits (`anonymous` 30/min + 100/day, `register` 5/5min) bound the rate per IP but not the vulnerability.

**Failure scenario.** Attacker runs `curl 'https://api/api/userProfiles?limit=1000'` with no auth, receiving `[{"id":"3f2b…","displayName":"Singer-3f2b",…}, …]`. For each id they POST /api/auth/anonymous with that id as deviceId; every id belonging to an anonymous singer returns 200 with a valid 30-day JWT. Using it they read `GET /api/songManifests` (the victim's entire song library: titles, durations, stem sizes) and `GET /api/voiceprints` (measured voice history). Then they POST /api/auth/register with the same deviceId and their own email/password; the UPDATE at auth.ts:1109 flips the row to `authProvider='password'` with the attacker's passwordHash and bumps tokenVersion, evicting the real owner from their own account forever.

**Suggested fix.** Stop treating a publicly-readable identifier as a bearer credential. Either (a) drop `'id'` from `userProfiles.publicCols` and stop emitting raw userIds in the leaderboard/friend responses, replacing them with an opaque per-viewer handle, or preferably (b) decouple the anonymous credential from the row id: keep the client's deviceId as a separate secret column (`users.deviceSecretHash`), mint `users.id = crypto.randomUUID()` server-side, and require the secret — not the id — on /api/auth/anonymous and on the register/google in-place upgrade paths.

**Fixed** by `0029_device_secret.sql` plus `authorizeDeviceSecret` in `auth.ts`, taking option (b) with one deliberate difference: `users.id` keeps equalling the deviceId rather than being re-minted server-side, because every other table joins on it and re-minting would orphan the rows this is meant to protect. The id being public is harmless once it is not a credential. `/api/auth/anonymous`, `/api/auth/register` and both Google paths now require the secret. Existing rows are grandfathered trust-on-first-use — see the CONFIRMED entry above for the window that leaves, which is asserted rather than hidden in `node-tests/device-secret-integration.test.ts`.

### [high] Network-error rejections still trigger the full-screen crash modal — preventDefault() does not stop the second listener

`src/components/AppErrorBoundary.tsx:56` — confidence: certain — status: FIXED

Two independent `unhandledrejection` listeners are installed on `window`. `initGlobalErrorHandlers()` (src/index.tsx:35, before the app mounts) registers one that deliberately swallows offline/backend-unreachable rejections:

```ts
// src/lib/global-error-handler.ts:51
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  if (isNetworkError(e.reason)) {
    console.warn('[net] request failed (backend unreachable / offline):', ...)
    e.preventDefault()
    return
  }
  ...
})
```

`AppErrorBoundary` then registers a SECOND listener in `onMount` (line 56) that has ResizeObserver and "Script error." filters but NO network filter, and unconditionally sets the global crash signal. `event.preventDefault()` only suppresses the browser's default "Uncaught (in promise)" action; it does not stop other listeners on the same target (that would need `stopImmediatePropagation()`). The team clearly knows this — the ResizeObserver guard is duplicated in both files for exactly this reason — but the network guard was never copied over.

`<CrashModal />` is mounted unconditionally at src/App.tsx:4178 and renders whenever `appError()` is non-null (src/components/CrashModal.tsx:109 `<Show when={error() !== null}>`), so the result is a modal `role="dialog"` titled "Application Error" covering the whole app.

**Failure scenario.** User goes offline (or the db-worker/jam-worker is briefly down). Any floating fetch promise rejects with TypeError "Failed to fetch" / "Load failed" / "NetworkError when attempting to fetch resource". global-error-handler logs the warn and calls preventDefault(), but AppErrorBoundary's listener runs anyway on the same event, calls setAppErrorSignal(), and the full-screen "Application Error" crash modal covers the app for what the code itself documents as "degraded-but-expected". Same path fires for a rejected clipboard write (DOMException NotAllowedError) — see the StemMixer share finding.

**Suggested fix.** Move the `isNetworkError` check into a shared helper and apply it in AppErrorBoundary's `errorHandler` before `setAppErrorSignal` (returning early for network reasons), or have global-error-handler call `event.stopImmediatePropagation()` in addition to `preventDefault()` and guarantee it is registered first.

### [high] HistoryCanvas live waveform is double-scaled — the right half of the strip always draws flat

`src/components/HistoryCanvas.tsx:84` — confidence: certain — status: FIXED

The per-column sample index is scaled twice by `step`. `step = floor(N / w)` already converts pixels to samples, but the index expression multiplies `x * step` AND then by `N / w` again, so the buffer is consumed `step` times too fast. Data runs out at `x = w / step`; every column past that has `idx >= waveform.length`, so `count` stays 0, `avg` is 0, and `ctx.lineTo(x, centerY)` paints a dead flat line. The analyser buffer is 2048 samples (`bufferSize = 2048` in src/lib/audio-engine.ts:133), so on any container narrower than ~1024 CSS px — i.e. every phone, tablet, and most desktop practice-panel widths — `step >= 2` and at least half the live waveform strip is permanently flat. The correct index is `x * step + j` (or `floor(x * N / w) + j`).

**Failure scenario.** Practice panel history strip is 800 CSS px wide, waveform buffer is 2048 samples. step = floor(2048/800) = 2. For x >= 400, idx = floor(x \* 5.12) >= 2048, so count === 0 and avg === 0. Columns 400..799 are drawn at centerY: the singer sees a live waveform that occupies only the left half of the strip and a dead-flat line across the right half, no matter how loudly they sing. At 683 px the flat region is two thirds of the width.

**Suggested fix.** Replace the index with `const idx = x * step + j` and drop the redundant `/ w * waveform.length` factor (or, if a fractional mapping is wanted, `const idx = Math.floor((x / w) * waveform.length) + j`).

### [high] Lab pitch analysis mixes two sample rates: detectors hardcode 44100 while the AudioContext runs at 48000

`src/components/PitchTestingTab.tsx:674` — confidence: likely — status: reported

The four detectors are constructed once with no options (line 133-138: `new YINDetector(), new FFTDetector(), new AutocorrelatorDetector(), ...`), so each defaults to `sampleRate: 44100`. The audio they analyse is decoded through `new AudioContext()` created with no `sampleRate` option (lines 583-589, 860-868), which on virtually every desktop browser resamples the file to 48000 Hz. Two intake paths then disagree, and each breaks a different axis:

(a) File upload (lines 436-447, 600-607): the waveform IS decimated to ~44100 (`if (sampleRate > 44100) { const ratio = 44100 / sampleRate; ... }`), so pitch matches the detectors — but `analyzeUploadedAudio` timestamps every sample with `sampleRate = audioContext()?.sampleRate` = 48000 (line 674, 686), compressing the whole time axis by 44100/48000 = 0.919.

(b) Vocal-stem separation (lines 869-889): `waveform: mono` is stored at the raw 48000 Hz context rate with no decimation, so timestamps are right but the 44100-configured YIN computes `frequency = 44100 / tau` from a period measured in 48 kHz samples.

**Failure scenario.** Path (a): a 3-minute uploaded song analysed on a 48 kHz device gets every detected note stamped 8.1% early — the last note of the track is placed ~14.7 s before where it was sung, so the note overlay and the whisper/LRC lyric alignment drift apart over the song. Path (b): after 'separate vocals first', a sung A4 (440 Hz) has period 48000/440 = 109.09 samples; the detector reports 44100/109.09 = 404.25 Hz and labels it G#4 — every note in the separated stem reads 147 cents flat, roughly a semitone and a half.

**Suggested fix.** Make one rate authoritative. Construct the detectors with the actual data rate (`new YINDetector({ sampleRate: effectiveRate })`, rebuilt whenever a track loads) instead of relying on the 44100 default, and derive `sampleRate` in `analyzeUploadedAudio` from the same value that produced `waveform` rather than from `audioContext().sampleRate`. Storing the effective rate alongside `waveform` on `AnalyzedTrack` would make the two paths impossible to desynchronise. (`totalSteps` is also off by one — it should be `+ 1` — which silently drops the final window.)

### [high] Cloud settings sync silently discards local annotations once they exceed the 8 KB push ceiling

`src/db/services/settings-service.ts:241` — confidence: likely — status: reported

`isSyncedKey` (line 133) treats every localStorage key starting with `pitchperfect_` as a synced preference. That set includes real user _content_, not just preferences — notably `pitchperfect_annotations` (annotation-store.ts:8-12, a `createPersistedSignal`, so it is hooked into `onPersistedWrite`) and `pitchperfect_custom_scales` (settings-store.ts:369).

The push side drops anything over 8 KB without a trace: `if (serialized.length > MAX_VALUE_BYTES) return` (line 241). The pull side has no such gate and no merge for these keys — `pullCloudSettings` does `applyPersistedValue(row.key, next)` where `next` is simply `row.value` for any key not in `MERGE_ON_PULL` (line 192), overwriting both localStorage and the live signal.

So the two halves are asymmetric: once a user's annotation set grows past ~68 entries (~120 bytes each) it stops uploading, but the stale small cloud row keeps winning on every pull. `pullCloudSettings` is re-run on every `authVersion()` change and at startup, so this fires on ordinary app launches, not just account switches. `MERGE_ON_PULL` and `EXCLUDED_KEYS` exist precisely for this class of key (`pitchperfect_session_history` is excluded, `mp_path_progress` is merged) — annotations and custom scales were simply not classified.

**Failure scenario.** A signed-in user makes 20 annotations on a take; the ~2.5 KB value pushes fine and a cloud `userSettings` row is created. Over the next weeks they build up 150 annotations (~18 KB). Every write now exceeds MAX_VALUE_BYTES and is dropped by the push hook with no warning. On the next app start (or any token refresh) `pullCloudSettings` reads the stale 20-annotation cloud row, `local !== next`, and `applyPersistedValue` overwrites localStorage and the live `annotations` signal. 130 annotations are gone permanently.

**Suggested fix.** Classify content keys explicitly: add `pitchperfect_annotations` and `pitchperfect_custom_scales` either to `EXCLUDED_KEYS` (device-local, like session history) or to `MERGE_ON_PULL` with a set-union resolver keyed on annotation id / scale name. Independently, the push hook must not fail silently — when a synced key exceeds MAX_VALUE_BYTES, either drop the cloud row for that key so a stale copy can never win the pull, or log/surface the skip.

### [high] Streaks, daily goal and Ascent days key on UTC dates while the rest of the app uses local dates

`src/db/services/streak-service.ts:81` — confidence: likely — status: reported

`todayDateString()` returns `new Date().toISOString().slice(0, 10)` — the UTC date. The same UTC key is used by `path-progress.ts:77` (`todayStr`, the Ascent ring segments) and by `practice-minutes.ts` (`msKey`/`countedKey`, the daily-goal accumulator and the streak-crossing latch). `daysBetween` parses those keys as UTC midnight, so the whole streak state machine consistently runs on UTC days.

The rest of the app deliberately does not. `src/features/practice-intelligence/practice-activity.ts:31` defines `localDayKey` with the comment: "toISOString() would bucket a 23:30 run into tomorrow for anyone east of UTC, and yesterday's late practice into the wrong square" — and the streak calendar renders from it. So the calendar and the streak counter can disagree about which days were practised.

Because the UTC day boundary lands mid-afternoon or mid-evening in local terms outside Europe/Africa, consecutive _local_ practice days can be 0 or 2 UTC days apart:

- East of UTC (e.g. UTC+9/+13): the UTC date flips at 09:00 / 13:00 local. Practising Monday 08:00 and Tuesday 10:00 local gives UTC keys two days apart → `gap = 2`, `missedDays = 1` → a freeze is spent, or with no freezes the streak resets to 1.
- West of UTC (e.g. UTC-7): the UTC date flips at 17:00 local. Practising Monday 18:00 and Tuesday 09:00 local gives the same UTC key → `gap = 0`, so `advanceStreak` returns unchanged, `recordPathPracticeDay` sees `days.includes(date)` and returns, and Tuesday's practice lights no ring segment and advances no streak.

**Failure scenario.** A singer in Tokyo (UTC+9) practises every morning at 08:00 local. Each session's UTC date is the _previous_ calendar day, so Monday 08:00 → Sunday UTC and Tuesday 08:00 → Monday UTC; that part is consistent. But the moment they practise once in the afternoon — Tuesday 08:00 (UTC Monday) then Wednesday 15:00 (UTC Wednesday) — `daysBetween` reports 2, `missedDays = 1`, and a freeze is silently consumed; a singer with zero freezes has their 40-day streak reset to 1 despite practising on consecutive days. Meanwhile the StreakCalendar, which uses `localDayKey`, shows both days lit — so the UI contradicts itself.

**Suggested fix.** Replace `todayDateString()` and `path-progress.todayStr()` with the existing `localDayKey(new Date().toISOString())` (or an equivalent local `YYYY-MM-DD`), and keep `daysBetween`'s UTC-midnight parsing — parsing local-derived day strings at UTC midnight is still correct for whole-day differences. Migrate carefully: existing stored `lastPracticeDate` values are UTC-derived, so a one-time tolerance (treat a gap of 2 on the first read after the change as gap 1) avoids breaking live streaks.

### [high] The uvr-service `*Strict` reads are not strict — findAll swallows storage failures and returns []

`src/db/services/uvr-service.ts:115` — confidence: certain — status: FIXED

Every `*Strict` reader in uvr-service is documented as preserving storage failures for archive/data-integrity work, but each one calls `repo.findAll(...)` without `throwOnError: true`. `DexieRepository.findAll` catches the error, `console.warn`s, and returns `[]` (dexie-adapter.ts:209-215). So the strict readers report "absent", not "unreadable":

- `listStemTypesStrict` (line 115) → `[]`
- `getStemBlobStrict` (line 227) → `null`
- `getOriginalFileBlobStrict` (line 257) → `null`
- `getStemFingerprintDataStrict` (line 357) → `null`
- every read inside `deleteImportedUvrSessionDataStrict` (line 545) → `[]`

Two consequences. (1) `listSessionExportStems` (session-export-service.ts:139) builds the ZIP stem list from `listStemTypesStrict`, so an unreadable DB produces an archive containing session.json and no audio, reported as a successful backup. (2) `deleteImportedUvrSessionDataStrict` is the rollback for a torn portable/ZIP import; its docstring says "failures reject so the importer cannot claim a rollback that did not land", but with reads degraded to `[]` it deletes nothing and resolves successfully, leaving multi-MB orphaned stem blobs behind.

**Failure scenario.** A user exports their library as a restorable ZIP while IndexedDB is under pressure and the `uvrStemBlobs` read errors. `listStemTypesStrict` returns `[]`, `listSessionExportStems` returns `[]`, the stem loop in `writeSessionFilesToZip` never runs, and the user downloads a ZIP with metadata and zero audio while the UI reports a completed export. They then delete the local sessions to free space, believing they have a backup.

**Suggested fix.** Add `throwOnError: true` to every `findAll`/`count` inside the `*Strict` helpers (and inside `deleteImportedUvrSessionDataStrict`), so the swallow-and-return-[] path in the adapter cannot masquerade as an empty result. Alternatively expose a `findAllStrict` on the repository interface that always rejects, and have the strict layer use only that.

### [high] Stem-mixer waveform peak cache is a strong Map keyed by AudioBuffer — every decoded song stays resident

`src/features/stem-mixer/useStemMixerCanvasController.ts:197` — confidence: certain — status: FIXED

`peakCache` is a plain `Map` keyed by `AudioBuffer`. `getPeaks(buffer)` inserts on first draw and nothing ever deletes, clears, or evicts (grep for `peakCache` yields only lines 197, 202, 205). The Map therefore holds a strong reference to every AudioBuffer the mixer has ever painted, plus the segment tree built from it (two Float32Arrays of `leafCount * 2` — roughly 4 MB per 4-minute stem, see src/lib/waveform-peak-cache.ts:40-41). The two neighbouring caches on lines 198-199 correctly use `WeakMap`, which shows the pattern was known and this one was missed. Every song load calls `ctx.decodeAudioData` for each stem (useStemMixerAudioController.ts:546, 676) producing fresh AudioBuffer objects, so nothing is ever reused — the cache only grows.

**Failure scenario.** User opens the stem mixer and plays five different 4-minute songs in one session without reloading the tab. Each song decodes 2-4 stems; a 4-minute 44.1 kHz stereo AudioBuffer is ~42 MB, and each also gets a ~4 MB peak tree. After the fifth song the previous four songs' buffers are all still reachable from `peakCache`, so ~600-900 MB is pinned instead of ~150 MB. On a phone or a 4 GB Chromebook the tab is OOM-killed; on desktop the app degrades to swap-thrashing.

**Suggested fix.** Change `peakCache` to `new WeakMap<AudioBuffer, WaveformPeakCache>()` (it is only ever keyed and looked up by the buffer identity, so no iteration is lost), matching `liveWaveformData`/`liveWaveformGain` on the following two lines.

### [high] sendInChunks can wait forever on `bufferedamountlow` after the peer's channel dies, wedging the jam song share

`src/lib/jam/jam-song-transfer.ts:238` — confidence: likely — status: reported

`waitForDrain()` resolves only when the channel fires `bufferedamountlow`. It checks neither `channel.readyState` nor `opts.signal`, and has no timeout. Those checks live at the top of the send loop (lines 248-253), which is only reached after `waitForDrain` resolves. A `RTCDataChannel` that is closed while `bufferedAmount > SEND_HIGH_WATER` (256 KiB) never fires the event, so the promise stays pending forever and the enclosing `await` never returns. `shareStemsWithPeers` (src/lib/jam/jam-song-share.ts:229) awaits `sendInChunks` directly with no timeout of its own, and `shareJamSongWithRoom` (src/stores/jam-store.ts:890) awaits that — so its `finally` block (line 946, which clears `shareAbort` and `jamShareStopping`) never runs and `jamShareState` stays stuck on `phase: 'sending'`. `cancelJamSongShare()` only sets `shareAbort.aborted = true`, which nothing left in the call stack ever reads, so the Stop button and `cleanupJam()`'s `cancelJamSongShare()` are both inert.

**Failure scenario.** Host shares a song to a peer on a slow uplink, so the send buffer sits above 256 KiB and the loop parks in `waitForDrain`. That peer closes their tab / loses WiFi; the DataChannel closes. The pending promise never settles: the share job never returns, the progress banner is frozen at "Sending the backing track to X", Stop does nothing, remaining peers never receive the song, and even leaving the room cannot clear it — only a page reload.

**Suggested fix.** Make `waitForDrain` racy and cancellable: resolve on `bufferedamountlow`, on a `close`/`error` listener, on an abort-signal poll, and on a bounded timeout (e.g. `Promise.race([lowEvent, sleep(500)])` re-checked in a loop), removing the listener on every exit path. Then re-check `channel.readyState !== 'open'` and `opts.signal?.aborted` immediately after it returns.

### [high] Frequency-domain fallback converts bin index to Hz with the wrong denominator — every pitch is exactly one octave sharp

`src/lib/pitch-detector.ts:274` — confidence: certain — status: FIXED

`detectFromFreqDataFallback` maps the peak bin to a frequency with `(maxIdx * sampleRate) / (this.bufferSize / 2)`. `fftToFrequencyData` produces N = timeDomainBuffer.length/2 bins whose spacing is `sampleRate / bufferSize` (it sums only even samples with `angle = 2π·i·j/this.bufferSize`, which is an N-point DFT of the 2×-decimated signal at rate sampleRate/2, so bin i sits at i·(sampleRate/2)/N = i·sampleRate/bufferSize). Dividing by `bufferSize/2` doubles that — a constant factor-of-2, i.e. exactly one octave sharp. This is the code path taken by _every synchronous_ `detect()` call when `algorithm === 'swift'` (line 171-173 routes swift through `fftToFrequencyData` → `detectFromFreqDataFallback`), and by `detectFromFrequencyData()`. The same function also reports `clarity: maxVal / 255` on a spectrum already normalised to roughly 0..1, and applies no confidence gate at all.

**Failure scenario.** I ran the real detector: `new PitchDetector({sampleRate:44100, bufferSize:2048, algorithm:'swift'}).detect(<220 Hz sine, amp 1.0, 2048 samples>)` returns `{"frequency":430.66,"noteName":"A","octave":4,"cents":-37,"midi":69,"clarity":0.0009}`. The correct bin-10 frequency is 10·44100/2048 = 215.3 Hz (A3); the detector reports 430.66 Hz (A4) — one octave up. The same buffer through the 'yin' path returns 440.02 Hz for a 440 Hz input, confirming the rest of the class is calibrated correctly. Clarity of 0.0009 also means any downstream `clarity > 0.5` gate silently discards the whole swift path.

**Suggested fix.** Use `const frequency = (maxIdx * this.sampleRate) / this.bufferSize`, restrict the peak search to `[minFrequency/binWidth, maxFrequency/binWidth]` rather than the whole array, and derive clarity from the peak-to-noise-floor ratio instead of `maxVal / 255` (or gate on `minConfidence` as the YIN/MPM paths do).

### [high] Closing the sync modal mid-connect still opens a WebSocket and a room nothing can ever close

`src/lib/sync/sync-peer.ts:94` — confidence: certain — status: FIXED

`createRoom`/`joinRoom` check `disposed` before awaiting `getIceServers()` and never re-check afterwards, so `signaling.createRoom()` / `signaling.connect()` run even when the peer was disposed during the await. `getIceServers` (src/lib/jam/ice-servers.ts:26) allows a 4000 ms fetch timeout, so the window is seconds wide. `SyncDevicesModal` calls `startSyncReceive()` from `onMount` (src/components/sync/SyncDevicesModal.tsx:111) and `stopSync()` from both `close()` (line 98) and `onCleanup` (line 108); `stopSync` → `resetSync` (src/stores/sync-store.ts:726-755) calls `peer.leaveRoom()`, `peer.dispose()` and then `peer = null`, dropping every reference to the client. The resumed `createRoom` then opens a fresh WebSocket on that orphaned signaling client — nothing in the store can reach it to disconnect it, and `scheduleReconnect` will re-arm it on close. `startSyncReceive` also continues past its own await and writes `setSyncRoomId(roomId)` / `setSyncState('waiting')` / `armPeerArrivalDeadline(...)` after the session was already reset.

**Failure scenario.** User opens Sync devices, the ICE fetch is slow (cold worker, or the 4 s timeout path on a flaky network), and they press Escape. `stopSync()` tears everything down and drops `peer`. A moment later the pending `createRoom` resumes: a WebSocket opens, the jam worker mints a Durable Object room nobody will ever join or leave, and the store's `syncRoomId`/`syncState` signals flip back to 'waiting' on a modal that is gone — leaving the deadline timer to write "No device joined with that code" into `syncError` afterwards.

**Suggested fix.** Re-check the flag after every await: `iceServers = await getIceServers(); if (disposed) return; signaling.createRoom(displayName)` (same in `joinRoom`). Mirror the same guard in `src/lib/jam/service.ts:136-150`, which has the identical shape, and have `startSyncReceive`/`startSyncSend` compare a generation stamp before writing signals after their awaits.

### [high] Drive backup finds zero songs after any page reload because `outputs` is never rehydrated

`src/stores/drive-sync-store.ts:172` — confidence: likely — status: reported

`localSongs()` — the only source of the Drive backup queue — requires an in-memory `outputs.vocal` or `outputs.instrumental`. But `outputs` holds runtime blob-object URLs and is deliberately not persisted: `sessionToDbRecord` (uvr-store.ts) writes `stemMetaJson` and never `outputs`, and `dbRecordToSession` never restores it. `initSessionStore` (uvr-store.ts:844) rebuilds the whole cache through `dbRecordToSession`, so after every reload every session has `outputs === undefined`.

Rehydration happens only inside `UvrPanel.tsx:1947`, in the panel's refresh effect, and only for `processingMode === 'local'` sessions. Settings → Sync → Google Drive does not mount UvrPanel.

The rest of the app already knows this: `KaraokeRailPanels.tsx:108` gates on `(s.outputs !== undefined || s.stemMeta !== undefined)` — the `stemMeta` fallback is exactly the persisted signal `localSongs()` is missing.

Effects: `scanDrive` reports `here: 0` and `toBackUp: []`, and `backUpToDrive` returns at `if (queue.length === 0) return` — no notification, no error, nothing uploaded. Symmetrically `localHashes` is empty, so `toRestore` lists every remote song as missing (importPortableBundle's hash check saves the actual data, but the job reports "N songs restored" for songs it never touched).

**Failure scenario.** User separates 12 songs, reloads the app (or opens it fresh the next day), goes straight to Settings → Sync → Google Drive and presses Scan. `initSessionStore` has loaded all 12 sessions from IndexedDB with `outputs === undefined`, so `localSongs()` returns []. The panel reports "0 songs here" and "12 in Drive"; pressing "Back up" returns immediately and silently. The user believes their library is backed up (or that there is nothing to back up) while nothing has been uploaded — and this is the feature whose stated purpose is surviving a lost or wiped device.

**Suggested fix.** Gate on persisted state rather than runtime URLs, matching KaraokeRailPanels: `(s.outputs?.vocal ?? s.outputs?.instrumental) !== undefined || s.stemMeta?.vocal !== undefined || s.stemMeta?.instrumental !== undefined`, or better, resolve playability against IndexedDB via a strict `listStemTypes` read. Also give `backUpToDrive` an explicit notification when the queue is empty rather than a bare `return`.

### [high] Double-tap unmute in a jam room opens two microphone captures

`src/stores/jam-store.ts:2113` — confidence: certain — status: FIXED

`toggleJamMute` guards the capture with `jamService?.hasLocalAudio() === false`, then awaits `startLocalAudio()`. Nothing marks "a capture is in flight": `jamIsMuted` is only written after the await (line 2123) and the mic track is only added to `localStream` after the await inside the service. The mute button (`src/components/jam/JamPanel.tsx:863`, `onClick={() => void toggleJamMute()}`) is never disabled during the await, and the permission prompt can sit on screen for seconds. A second tap therefore re-reads `jamIsMuted() === true` and `hasLocalAudio() === false`, passes the same guard, and runs a second `getUserMedia`. In `src/lib/jam/service.ts:260-290` the same stale guard (`if (localStream!.getAudioTracks().length > 0) return true`) is checked before the await, so both calls add a raw track to `localStream` and both build a processed clone; the first clone is overwritten by `transmitAudio = await makeTransmitTrack(rawAudio)` and is never stopped. Compare `useStemMixerMicController` (src/features/stem-mixer/useStemMixerMicController.ts:305-313), which explicitly holds a `toggling` flag for exactly this reason — the jam path has no equivalent.

**Failure scenario.** User taps Unmute; the browser shows the mic permission prompt. Before answering (or on a slow device where getUserMedia takes ~1s), they tap the button again. Both calls resolve: `localStream` now holds two live audio tracks, plus one orphaned live clone that `setMuted` never touches (it only toggles `transmitAudio` — the second clone — and `localStream.getAudioTracks()`). Result: the mic stays hot after "Mute", `startJamPitchDetection` builds a MediaStreamSource over a two-track stream, and the OS recording indicator stays on.

**Suggested fix.** Add an in-flight flag around the capture, exactly as `useStemMixerMicController.toggleMic` does: `let unmuting = false; if (unmuting) return; unmuting = true; try { ... } finally { unmuting = false }`. Belt-and-braces, make `startLocalAudio` in service.ts idempotent by caching the in-flight promise (`let audioStartInFlight: Promise<boolean> | null`) the way `AudioEngine.doStartMic` caches `micStartInFlight`.

### [high] Leaving a jam room during the unmute await restarts pitch detection and leaks a 20 Hz interval plus a live mic

`src/stores/jam-store.ts:2114` — confidence: likely — status: FIXED

`toggleJamMute` never re-checks that the room still exists after `await jamService.startLocalAudio()`. `leaveJamRoom()` (line 2093) calls `jamService.leaveRoom()` — which in `src/lib/jam/service.ts:152-165` closes the data channels and peer connections but deliberately does NOT call `stopLocalStream()` — and then `cleanupJam()`, which runs `stopJamPitchDetection()`, `setJamLocalStream(null)`, `setJamIsMuted(true)` and `setJamState('idle')`. When the awaited getUserMedia then resolves, the continuation runs against a torn-down room: it republishes the live stream into the store and calls `startJamPitchDetection()`, whose `if (pitchDetector) return` guard is now false because cleanup nulled it. That starts a fresh `JamPitchDetector` and `pitchNetworkInterval = setInterval(..., 50)` (line 2189) that nothing will ever clear — `stopJamPitchDetection` is only reached from the next `cleanupJam`. `jamService` is not nulled by `leaveJamRoom` (only `disposeJam` does that, and `disposeJam` has no callers outside the store), so the object is still alive to be driven.

**Failure scenario.** User taps Unmute, then — while the permission prompt is up — clicks Leave (or navigates, dismissing the room). getUserMedia resolves afterwards: the mic track is captured and never stopped, `jamIsMuted` is flipped back to false over an idle room, a pitch detector is constructed, and a 50 ms interval runs for the rest of the tab's life calling `jamService?.sendPitch(...)` and appending to `jamPitchHistory`. The recording indicator stays lit with no room open.

**Suggested fix.** Capture a generation/room token before the await and bail after it: `const room = jamRoomId(); const got = await jamService.startLocalAudio(); if (jamRoomId() !== room || jamState() !== 'active') { jamService.setMuted(true); return }`. Better still, have `leaveRoom()` in service.ts call `stopLocalStream()` so a late-resolving capture cannot hand back a live track.

### [high] Unilateral follow rows let any authenticated user read any user's private streak and score aggregates

`workers/db-worker/src/index.ts:904` — confidence: likely — status: FIXED

`handleLeaderboard` deliberately refuses to rank or publish streaks outside the friends view (index.ts:869 returns 400 for `category=streak` with `view!=='friends'`, and the projection at index.ts:996 zeroes `streak`/`longestStreak` for anyone who is neither you nor a friend). It also skips the `requireOptIn` consent gate and the `minSessions`/`minStreakDays` thresholds entirely for the friends view (the opt-in clause is only in the `else if (config.requireOptIn)` branch at index.ts:907, and the threshold filter at index.ts:976 short-circuits on `view === 'friends'`).

"Friend" is defined purely as a row in `follows`, and `follows` is registered in tables.ts:193 as `{ access: 'user' }` — an ordinary client-writable table. `handleCreate` forces `body.userId = auth.userId` but performs **no validation whatsoever on `followedUserId`**. So any authenticated caller can `POST /api/follows {"followedUserId": "<any user id>"}` and instantly become that person's "friend" for leaderboard purposes, with no consent, no friend code, and no reciprocity. The friend-code flow (`handleFriendRedeem`, which requires knowing an 8-char code and is rate limited at 20/5min) is completely bypassed.

Combined with the public `userProfiles` id listing, this makes every user's practice behaviour readable: current streak, longest streak, average score, best score, accuracy, and total session count.

**Failure scenario.** Victim V has `leaderboardOptIn = 0` (the migration 0003 default — explicitly chosen because "nobody on it today was ever asked"). Attacker A signs in, obtains V's userId from `GET /api/userProfiles`, then `POST /api/follows {"followedUserId":"<V>"}` → 201. A then calls `GET /api/leaderboard?category=streak&view=friends`. The friends clause matches V's sessionRecords, the opt-in clause is never applied, the threshold filter is skipped, and the projection branch `view === 'friends'` returns V's real `streak` and `longestStreak` plus `score`, `bestScore`, `accuracy` and `totalSessions` — exactly the behavioural record the handler's own comments say must not be published without consent.

**Suggested fix.** Make the friends view require a mutual/consented edge rather than a unilateral one: change the friends clause to require rows in `follows` in BOTH directions (as `handleFriendRedeem` writes them), or add a server-side `consented` flag that only the friend-code redemption path can set. Additionally, validate `followedUserId` on create (must reference an existing, non-suspended user) and consider removing `follows` from the client-writable TABLES allowlist in favour of the friend-code endpoints.

**Fixed** by migration `0028_follow_requests.sql` and `workers/db-worker/src/friends.ts`. A `follows` row now carries a `status`, and the friends clause requires `'accepted'`. Nothing a caller can do alone reaches that value: `POST /api/friends/request` writes `'pending'`, only the person who was asked can `POST /api/friends/accept`, and generic CRUD writes to `follows` answer 405 (`writeRoute` on the table def) so the create that took `followedUserId` on trust no longer exists. Redeeming a friend code still links both directions at once — being handed the code is the consent. Existing rows were back-filled by shape: a reciprocal pair means both people chose the other — one redeemed the other's friend code, or each pressed Follow independently — so it becomes `'accepted'`; a lone row is one person's decision about somebody who was never asked, and becomes `'pending'`. Proof is in `workers/db-worker/node-tests/follow-requests-integration.test.ts` — `leaksThroughFriendsBoard` is the scenario above, asserted false for a one-sided row.

### [medium] OfflinePitchCanvas sets forceRedraw but never queues a frame — analysis results and label toggles do not repaint

`src/components/OfflinePitchCanvas.tsx:61` — confidence: certain — status: FIXED

This effect tracks `props.waveform`, `props.analysisResults`, `props.segmentedNotes`, `props.showNoteLabels`, `props.showLyricLabels` and `props.alignedWords` and sets the `forceRedraw` flag — but it never calls `redraw.queue()`. The only three places that schedule a frame are line 323 (a pointer handler), line 392 (`isPlaying()` flipping) and line 403 (an effect tracking only `zoom()`, `scrollX()`, `hiddenAlgos()`). None of them is triggered by the props above. So while playback is stopped, changing any of these inputs sets a flag that nobody acts on. Compare src/features/stem-mixer/useStemMixerCanvasController.ts:1221-1239, which tracks exactly this class of state and ends with `queueCanvasRedraw()` — the fix the offline canvas is missing.

**Failure scenario.** In the Pitch Testing tab the user clicks the toolbar's "Show note labels" toggle (PitchTestingTab.tsx:2234 passes `showNoteLabels={showNoteLabels()}`) while audio is stopped. `forceRedraw` is set to true, no frame is queued, and the canvas keeps showing the old pixels. The button renders as active but nothing appears. Same for offline analysis finishing: `props.analysisResults` populates and the pitch curves never appear until the user pans, zooms, resizes the window, or presses play.

**Suggested fix.** Add `redraw.queue()` after `forceRedraw = true` in this effect (the scheduler is declared at line 353, so move this effect below it or hoist the scheduler above).

### [medium] PitchCanvas starts the AudioEngine with a floating promise, turning a failed AudioContext into an unhandled rejection

`src/components/PitchCanvas.tsx:199` — confidence: likely — status: reported

`AudioEngine.init()` is `async` (src/lib/audio-engine.ts:186) and constructs `new AudioContext(...)` inside its body, so any construction failure becomes a rejected promise rather than a synchronous throw. In `onMount` the call is made bare — no `await`, no `void`, no `.catch()` — so a failure escapes as an unhandled rejection to `window.onerror`/`unhandledrejection` instead of being logged and recovered from. Everywhere else in this codebase the same call is defended (`this.audioEngine.init().catch((err) => console.error('Audio init error:', err))` in src/lib/playback-runtime.ts:176-179). The most common trigger is the per-document hardware AudioContext cap: PitchCanvas creates its own private engine on every mount, and Safari/WebKit throws once too many contexts exist.

**Failure scenario.** User navigates back and forth between the Singing tab and other surfaces enough times that the browser's AudioContext limit is reached (or runs a WebKit build that refuses a context outside a user gesture). `init()` rejects; nothing catches it. The global error handler reports a crash to the user, and `audioEngine` is registered in `audioRegistry` in a half-built state (`audioCtx` null) so click-to-play silently does nothing with no diagnostic tying it to the cause.

**Suggested fix.** `void audioEngine.init().catch((err) => console.error('[PitchCanvas] audio init failed:', err))`, and skip `audioRegistry.register` / disable click-to-play when it rejects.

### [medium] PitchCanvas runs a full redraw from a createEffect on top of its own rAF loop — two render paths, double the work per frame

`src/components/PitchCanvas.tsx:2079` — confidence: certain — status: reported

`startLoop()` (line 649) already runs a permanent rAF loop whose whole purpose is the `needsRedraw || playing || paused || hasMicData || ...` gate at lines 664-678 that throttles idle repaints. This bare `createEffect(() => { draw() })` at the bottom of the component subscribes to every signal `draw()` touches — including `props.currentBeat()` (lines 1399, 1734, 1840, 1942, 1981), `props.pitchHistory()` (line 1716) and `props.getWaveform()` (line 1099) — all of which update at frame rate during a run. Each of those writes synchronously re-runs the effect and repaints the whole canvas (clearRect, a fresh `createLinearGradient` at line 1061, all note geometry, several radial gradients). Because the writes are not batched into one update, the canvas is repainted two or more times per animation frame, and the throttle the rAF loop implements is completely defeated.

**Failure scenario.** During playback with the mic live, `currentBeat`, `pitchHistory` and `livePitch` each update ~60 times a second. Each write re-runs this effect and executes the full 1000-line `draw()`; the rAF loop then draws the identical frame again. The result is 3-4x the intended canvas work per frame — the exact symptom the loop's `needsRedraw` throttle ("Reduces idle GPU usage from constant 60fps to near-zero when paused", line 653) was written to prevent — producing dropped frames and jitter on low-tier devices, which then trips `recordAnimationFrame`'s auto-demotion in src/lib/device-tier.ts.

**Suggested fix.** Delete the effect and let the rAF loop own rendering, or replace it with an effect that only sets `needsRedraw = true` for the discrete inputs the loop's gate does not already cover.

### [medium] "Add stem" mints a blob URL for a multi-megabyte WAV that is never revoked

`src/components/StemMixer.tsx:1724` — confidence: certain — status: FIXED

`getStemBlobUrl` (src/db/services/uvr-service.ts:168) builds a `Blob` from the stored stem bytes and returns `URL.createObjectURL(blob)`. `handleAddStem` passes that URL to `audio.addExtraStem`, which fetches + decodes it and then stores the raw URL on the track (`url: input.url`, useStemMixerAudioController.ts:679). Grepping `revokeObjectURL` in useStemMixerAudioController.ts finds exactly one occurrence — line 1304, in the unrelated download path. Nothing revokes the extras' URLs when a stem is removed, when a new song is loaded, or when StemMixer unmounts (the `onCleanup` at StemMixer.tsx:2010-2020 does not touch them). A blob URL pins its data for the life of the document, which the codebase already documents in src/stores/jam-store.ts:565-568 and mitigates with the `openUvrStemLease` helper in src/lib/uvr-stem-lease.ts — a mechanism this path bypasses entirely.

**Failure scenario.** User opens a full-band session and clicks the drums / bass / guitar / piano "Add stem" pills, then removes two and re-adds them, then navigates away from the mixer. Each click pinned a WAV blob (typically 20-60 MB for a 4-minute stem) that is never released; six clicks leave ~200 MB unreachable-but-alive for the rest of the tab's life, in addition to the decoded AudioBuffers.

**Suggested fix.** Revoke the URL as soon as `decodeAudioData` resolves in `addExtraStem` (the AudioBuffer no longer needs it), or route the add path through `openUvrStemLease` and release the lease on stem removal / component cleanup.

**Fixed**, but NOT by revoking after decode — that suggestion was wrong. Decoding does not spend the URL: `addExtraStem` stores it on the track and the mixer re-fetches it on seek (`useStemMixerAudioController.ts:588`) and on download (`:1284`), so an early revoke would break both. The mixer instead owns every blob URL for its whole mount, which is also what UvrPanel's `openMixerWithStems` already claimed in a comment ("The new StemMixer now owns these blob URLs") without anything acting on it — that handover was the larger half of the leak, and this entry had missed it.

`src/lib/blob-url-owner.ts` holds the two rules that are easy to get wrong (revoke once; never revoke a URL you were not given), `StemMixer` wires it to `onCleanup`, and a failed add releases immediately rather than carrying every retry's blob to unmount. `props.stems.vocal/instrumental` are deliberately excluded — those belong to the session store.

Note for the next leak of this shape: `src/tests/setup.ts` stubs `createObjectURL` and leaves `revokeObjectURL` undefined, which is why the table above records "the balance is not observable". `src/components/__tests__/StemMixerStemUrls.test.tsx` stubs and counts it, and renders the mixer whole — the bug lived in the seam, where every piece behaved and nobody called the release.

### [medium] Share button's clipboard write has no rejection handler — a blocked clipboard pops the crash modal instead of a toast

`src/components/StemMixer.tsx:2281` — confidence: certain — status: FIXED

`navigator.clipboard.writeText()` rejects with a `DOMException` when the page is not a secure context, when the permission is denied, or when Safari/Firefox refuse a write that is not synchronously inside a user gesture. This call site attaches only a fulfilment handler; `void` discards the promise but does not mark the rejection handled. Combined with the AppErrorBoundary defect above, the rejection becomes an `unhandledrejection` and pops the "Application Error" modal. Even without that, the user gets zero feedback: no toast, no error.

The codebase handles this correctly elsewhere — `src/components/CommunityShare.tsx:658` passes a rejection callback as the second argument to `.then()`, and `src/components/UvrResultViewer.tsx:218` uses try/catch with an execCommand fallback — so this site is an outlier. `src/components/TabErrorBoundary.tsx:25` even documents "a rejected clipboard write" as a real crash source they have hit before.

**Failure scenario.** With VITE_PREMIUM_FEATURES=true, a user on iOS Safari (or on a LAN dev origin served over plain HTTP, which is not a secure context) taps Share in the Stem Mixer. `writeText` rejects with NotAllowedError. No toast appears, the button still reads "Share", and the unhandled rejection reaches AppErrorBoundary, which covers the mixer with the full-screen crash modal.

**Suggested fix.** Await it in a try/catch (or add a rejection handler) and surface a failure toast plus the textarea/execCommand fallback already implemented in `copyShareUrl` (src/lib/share-codec.ts:374).

### [medium] Shazam fingerprinting leaks the vocal stem's blob URL on every indexed song

`src/components/UvrPanel.tsx:153` — confidence: certain — status: FIXED

`indexStemFingerprint` mints an object URL via `getStemBlobUrl`, fetches it, decodes it, and returns through several early-return branches and a `finally` block — none of which calls `URL.revokeObjectURL(vocalUrl)`. Reading the whole function (lines 145-185) confirms there is no revoke on any path: success, `'reason' in fp`, or the `catch`. The surrounding code knows the pattern — `runBandSplitChain` 700 lines below does `URL.revokeObjectURL(existing)` (line 872) for exactly this kind of probe URL.

**Failure scenario.** With Settings > Karaoke > "Shazam & Sing" enabled, every completed separation calls this (onComplete schedules it at UvrPanel.tsx:1006). Separating ten songs in one session leaks ten full-length vocal WAV blobs — commonly 30-50 MB each, so ~400 MB held for the tab's lifetime with no UI referencing them. Re-running HQ separations multiplies it further.

**Suggested fix.** Wrap the fetch/decode in try/finally and call `URL.revokeObjectURL(vocalUrl)` in the finally, before `setFingerprintingSession('')`.

### [medium] Jam "Copy link" buttons show "Copied!" even when the clipboard write is rejected

`src/components/jam/JamInviteModal.tsx:20` — confidence: certain — status: FIXED

Three jam copy buttons fire `navigator.clipboard.writeText(...).catch(() => {})` and then set the copied flag unconditionally on the next statement — the flag is set synchronously, before the promise settles, and the empty catch discards the denial. The UI therefore reports success for an operation that did nothing.

Same pattern at:

- src/components/jam/JamInviteModal.tsx:20 (room code) and :26 (room link)
- src/components/jam/JamPanel.tsx:749
- src/features/sidebar/panels/JamRoomPanel.tsx:32

This is exactly the permission-denial path the lens targets: a blocked clipboard is silently swallowed AND actively misreported.

**Failure scenario.** Host opens the Invite modal on a browser where clipboard-write is denied (insecure origin, Firefox with asyncClipboard restricted, or a denied permission). They tap Copy, the button flips to "Copied!", they paste into chat and send whatever was on the clipboard before — or nothing. The peer never receives the room link, and nothing in the app indicates a failure.

**Suggested fix.** Await the write and only set the copied flag on success; on rejection fall back to the textarea/execCommand path (as `src/lib/share-codec.ts:382-400` does) or show the code with a 'select and copy manually' hint.

### [medium] WaveformPane maps absolute window time through the window duration — the waveform collapses once the view scrolls off zero

`src/components/panes/WaveformPane.tsx:63` — confidence: likely — status: reported

`t` is an absolute time (`t0 + (px / w) * dur`) but it is divided by `t1 - t0`, i.e. by `dur` rather than by the total duration, so the index becomes `floor((t0 / dur + px / w) * N)`. The `t0 / dur` term is a constant offset that has nothing to do with the sample buffer. As soon as `t0 > 0` the offset pushes the index past `waveform.length` for every column, `sampleIdx` clamps to `waveform.length - 1` at line 64, and both envelope passes draw the same last sample across the full width. `timeRange` starts at `[0, dur]` (MultiPaneView.tsx:97,104) but the follow effect at MultiPaneView.tsx:111-121 sets `[pos - width * 0.85, pos + width * 0.15]` as soon as the playhead passes the window edge, so `t0` becomes nonzero in normal use. The pane's own comment ("Assume waveformData represents the full audio buffer") flags that the mapping was never worked out.

**Failure scenario.** Multi-pane view with a 60 s window; playback runs past 60 s so the follow effect sets timeRange to roughly [51, 111], giving t0 = 51, dur = 60. idx = floor((51/60 + px/w) _ 2048) = floor((0.85 + px/w) _ 2048), which is >= 2047 for px/w >= 0.15. From ~15% of the width onward every column clamps to the same final sample, so the waveform pane renders a flat horizontal band for the rest of the session instead of the live signal.

**Suggested fix.** Map the column directly onto the buffer (`const idx = Math.floor((px / w) * waveform.length)`) if `waveformData` is a window-sized snapshot, or divide the absolute `t` by the full audio duration rather than by `t1 - t0` if it really is the whole file.

### [medium] grant-flush's local badge write is not idempotent, so a retried flush duplicates userBadges rows

`src/db/services/grant-flush.ts:253` — confidence: likely — status: reported

`flushGrants` is explicitly built around retry: on any throw, `restore()` puts the whole batch back on the queue and re-arms, and the docstring on `writeCloud` justifies this by saying "Both endpoints are idempotent upserts keyed on (userId, definitionId), which is what makes the retry in flushGrants safe... Getting that wrong is how the badge loop this replaced ended up writing a once-only badge twice."

`writeLocal` — the branch taken whenever `cloudActive()` is false, i.e. local-only builds (`pnpm dev` with no VITE_API_BASE_URL) and signed-out sessions — does not honour that contract for badges. Achievements are handled correctly (find-by-achievementId, then update-or-create), but badges go straight to `repo.create` with no existence check. The whole batch is re-queued on a partial failure, so any badge already written before the throw is written again.

The badge engine's own dedupe cannot catch this: it filters against `userBadges` read from the DB plus `isBadgePending`, and by the time the duplicate is created the badge is neither pending nor yet absent — it is present twice.

**Failure scenario.** In a local-only build a flush carries three newly-earned badges. `repo.create` succeeds for badge 1 and 2, then throws on badge 3 (quota, or a Dexie transaction abort). `writeLocal` rejects, `restore()` re-queues all three (pendingBadges was cleared at the top of flushGrants), and the next flush window creates badges 1 and 2 a second time. `userBadges` now has duplicate rows, which inflates `userBadges.length` — the value `computeStats(ctx, userBadges.length)` feeds into badge/achievement thresholds — and shows the same badge twice in the collection.

**Suggested fix.** Mirror the achievement path: read existing rows once (`repo.findAll({ where: { userId } })`), build a `Set` of `badgeId`, and skip or update badges that already exist rather than blindly creating. Alternatively write badges through a deterministic id derived from `(userId, badgeId)` and use a put/upsert so the retry rewrites rather than duplicates.

### [medium] Lyrics lookup reports a network outage as "no lyrics found"; the abort branch is dead code

`src/features/stem-mixer/useStemMixerLyricsController.ts:864` — confidence: likely — status: reported

The catch block's two branches are byte-identical, so the comment describing the intended behaviour ("If aborted intentionally, show the uploader instead of 'none'") was never actually implemented. sonarjs flags this as `no-all-duplicated-branches`.

Worse, the catch is effectively unreachable, so ALL failures land on the success path with `setLyricsSource('none')`. Both network helpers swallow their own errors:

- `fetchSearchLrclib` (src/lib/lyrics-service.ts:271) wraps its whole body in `try { ... } catch (error) { console.error(...); return [] }` — a timeout, an abort, or an offline TypeError all become an empty array.
- `searchLyrics` (src/lib/lyrics-service.ts:100) has two `catch { /* ignore */ }` blocks and returns `null`.

So `await searchLyricsMulti(title, signal)` returns `[]` and `await searchLyrics(title, signal)` returns `null` on a total network failure, and control falls to the `else { setLyricsSource('none') }` branch — the exact same state as a successful search that matched nothing. A related consequence: because the abort never propagates, `searchLyricsMulti` keeps looping over its remaining fallback queries after the user hits Cancel (each returning `[]` immediately) instead of stopping.

`lyricsSource === 'none'` is what drives the UI: `src/components/StemMixerGridWorkspace.tsx:677` shows the uploader and lines 533/583/610/627 hide the lyric panel.

**Failure scenario.** User opens a karaoke session while offline, or while lrclib.net is down/rate-limiting. Every fetch fails; `fetchSearchLrclib` logs to console and returns `[]`; `searchLyrics` returns `null`; the controller sets `lyricsSource = 'none'`. The UI tells the singer "no lyrics found — upload a file" for a song that has perfectly good lyrics, giving them no reason to retry once they are back online.

**Suggested fix.** Have the lyrics-service helpers distinguish outcomes (e.g. rethrow AbortError and return a discriminated `{ status: 'ok' | 'offline' | 'empty' }`), add a `'error'` member to `LyricsSource`, and render a "couldn't reach the lyrics service — retry" state distinct from "nothing found". At minimum, collapse the dead if/else and log the caught error.

### [medium] detectChords computes the previous segment's start time from the merged-array index instead of its stored time

`src/lib/chord-detector.ts:200` — confidence: certain — status: FIXED

Inside the merge loop, `time` is the current frame's time (`i * frameTime`, where `i` indexes the smoothed FRAME array), but `lastTime` is computed as `(merged.length - 1) * frameTime` — using the count of merged chord SEGMENTS as if it were a frame index. The previous segment's real start is `last.time`, which is already stored. `segmentDuration = time - lastTime` is therefore meaningless: with `merged.length` typically in the single digits and `frameTime = HOP_SIZE / sampleRate ≈ 0.0116 s` (SpectralWorkbench.tsx:131), `lastTime` is essentially 0, so `segmentDuration ≈ time` and grows monotonically — after ~22 frames every candidate passes the `>= minDuration` test and the min-duration filter stops filtering entirely. The else branch then does `last.time = time`, which moves the previous segment's START forward rather than extending its end, corrupting the chord timeline.

**Failure scenario.** Analysing a 30 s clip at a 512-sample hop (frameTime ≈ 0.0116 s): the intended behaviour is that a chord flickering for 3 frames (35 ms) is absorbed into its neighbour. Instead, once ~22 frames (0.25 s) have elapsed, `time - lastTime` always exceeds `minDuration = 0.25`, so every single-frame flicker becomes its own `ChordFrame`. In the rare early frames where the branch does fire, `last.time = time` rewrites the previous chord's start to the current frame, so a chord that began at 0.05 s is reported as beginning at 0.20 s and its true onset is lost.

**Suggested fix.** Use the stored start: `const lastTime = last.time`. In the too-short branch, either drop the current candidate outright or extend the previous entry's end (which requires the `ChordFrame` to carry an end/duration) — mutating `last.time` is never correct, since `time` is a start field.

### [medium] A malformed percent-escape in the URL hash makes parseHash throw URIError and crash the app

`src/lib/hash-router.ts:220` — confidence: certain — status: FIXED

`parseHash` calls `decodeURIComponent` on raw capture groups taken straight from `window.location.hash` at three places (lines 219, 220 and 301). `decodeURIComponent` throws `URIError: URI malformed` on any lone or truncated percent escape (`%`, `%z`, `%E0%A4`). There is no try/catch anywhere in `parseHash`, and none at any call site:

- src/App.tsx:663 — called in the `AppShell` render body (`parseHash(window.location.hash).type !== 'voice-constellation'`)
- src/features/routing/useHashRouter.ts:204 (onMount) and :208 (hashchange listener)

The regexes deliberately capture greedily (`([^&]+)`, `(.+)`), so any hash of the shape `#/share?type=...&id=...` or `#/reset-password?token=...` reaches the decode. The function's own contract is to return `{ type: 'unknown' }` for anything it cannot parse — a throw is a contract violation.

**Failure scenario.** A user opens `https://app/#/reset-password?token=abc%` — e.g. an emailed reset link truncated or re-wrapped by a mail client, or a link where a literal '%' survived. On cold load `parseHash` throws URIError inside AppShell's render body, the SolidJS ErrorBoundary catches it and renders the CrashModal: the reset-password page is unreachable and the whole app shows "Application Error". Pasting the same hash into an already-open tab throws inside the `hashchange` listener instead, which reaches the window error handler and the same crash modal.

**Suggested fix.** Wrap each decode in a helper that returns the raw string (or null) on URIError, e.g. `function safeDecode(s: string): string { try { return decodeURIComponent(s) } catch { return s } }`, and use it at lines 219, 220 and 301.

### [medium] Jam ICE recovery timers survive leaving the room and disposing the service

`src/lib/jam/service.ts:152` — confidence: certain — status: FIXED

`iceRecoveryTimers` (declared line 63) is populated with a `DISCONNECTED_GRACE_MS` (4 s) `setTimeout` per peer in `oniceconnectionstatechange` (lines 554-565), and each timer's closure captures the `RTCPeerConnection`. `clearIceRecovery` is only called from the 'connected' branch, from `recoverIce`, and when a new timer replaces an old one. Neither `leaveRoom()` (152-165), nor `dispose()` (918-930), nor the `onPeerLeft` handler (103-116) clears them, and `iceRetries` is never cleared either. Every closed peer connection that was in the 'disconnected' state at teardown is therefore pinned in memory for the grace window by a timer that fires against a corpse, and in a SPA that never reloads the per-peer `iceRetries` entries accumulate for every peer ever seen across every room.

**Failure scenario.** A peer's ICE goes 'disconnected' (WiFi blip) and a 4 s recovery timer is armed. The user immediately presses Leave. `leaveRoom` closes and drops the RTCPeerConnection but the timer keeps a strong reference to it and fires afterwards against a closed connection. Repeated across rooms in one long-lived session, `iceRetries` also grows unbounded and a stale retry count from a previous room can make `decideIceRestart` return 'exhausted' for a peer id that was reused.

**Suggested fix.** Add `for (const id of [...iceRecoveryTimers.keys()]) clearIceRecovery(id)` plus `iceRetries.clear()` to `leaveRoom()` and `dispose()`, and call `clearIceRecovery(peerId)` / `iceRetries.delete(peerId)` in the `onPeerLeft` handler alongside the existing `pendingCandidates.delete(peerId)`.

### [medium] Processing pipeline mutates the live session cache array in place, bypassing copy-on-write

`src/lib/uvr-processing-pipeline.ts:162` — confidence: likely — status: reported

`getAllUvrSessions()` returns `_sessionsCache()` — the signal's actual array, not a copy (uvr-store.ts:1033-1035). This code takes that array, mutates one of its member objects in place (`s.numChunks = numChunks`) and hands the same array back to `saveAllUvrSessions`, which calls `updateCacheAndPersist` → `_setSessionsCache(sessions)` with the identical reference plus `persistAllSessionsToDb(sessions)`.

Every other writer in the store goes through `updateSessionCache`, which explicitly copies (`const next = [...prev]; next[idx] = session`) so no consumer's snapshot is retroactively changed. This path defeats that. The same in-place pattern appears in `UvrPanel.tsx:1947-1959`'s hydration loop (`all[idx] = {...}; saveAllUvrSessions(all)`).

The second half is worse than the aliasing: `persistAllSessionsToDb(sessions)` writes the _whole_ library from a snapshot that may already be stale. The store documents exactly this hazard elsewhere — `importUvrSession` explains it serialises through the per-session write chain "so the later groupId from being overwritten by a whole-library save racing in the background" — and this call re-introduces the racing whole-library save from inside a long-running separation.

**Failure scenario.** A separation is running. The pipeline snapshots the cache array, then the user assigns the song to a session group (or renames it), which goes through `upsertSessionInCache` and persists `groupId` on the per-session write chain. The pipeline then calls `saveAllUvrSessions(sessions)` with its pre-assignment snapshot; `persistAllSessionsToDb` rewrites every uvrSessions row from it, dropping the just-written `groupId`. The song silently falls out of its group. Independently, any component holding a `getUvrSession()` result observes `numChunks` appearing on an object it believes is an immutable snapshot.

**Suggested fix.** Use the store's own copy-on-write path instead of mutating the shared array: `const s = getUvrSession(sessionId); if (s) upsertSessionInCache({ ...s, numChunks })`. Apply the same change to the hydration loop in UvrPanel.tsx:1947. Better still, have `getAllUvrSessions()` return a shallow copy so this class of aliasing cannot be written by accident.

### [medium] Deleting a melody leaves dangling melodyId references in every session that used it

`src/stores/melody-store.ts:1041` — confidence: certain — status: FIXED

`deleteMelody` removes the melody from `library.melodies` and carefully filters `melodyKeys` out of every playlist — but it never touches `library.sessions`, whose items carry `melodyId` references to exactly the same melodies (`createMelodyItem`, session-store.ts, and the seeded default session are all built this way).

The dangling reference is then swallowed rather than surfaced. `buildSessionItemMelody` (session-builder.ts:71-86) looks the melody up, and when it is missing falls through to the generic fallback and returns a single middle-C note. `loadAndPlayMelodyForSession` (useSessionSequencer.ts:352-354) does `if (!melody) return`, silently doing nothing.

So the session keeps its item, keeps its label, and plays a one-beat C4 in place of the deleted content — with no indication to the user that the item is broken.

**Failure scenario.** A user builds a 6-item practice session referencing melodies A–F, then deletes melody C from the library. The session still lists six items with C's original label. On "Play All in sequence", item 3 resolves to `undefined` in `melodyStore.getMelody`, `buildSessionItemMelody` returns the middle-C fallback, and the user is scored against a single C4 note under a label that promises the melody they wrote. Nothing in the editor marks the item as broken.

**Suggested fix.** Extend `deleteMelody` to walk `library.sessions` and either drop items whose `melodyId === key` or mark them (e.g. `missing: true`) so the editor and sequencer can render them as broken and skip them during playback. At minimum, replace the silent fallback in `buildSessionItemMelody` for `type === 'melody'` with an explicit empty result so the sequencer advances past the item instead of scoring a placeholder note.

**Fixed** as the missing-state variant, by owner decision — `deleteMelody` is untouched, so `restoreMelody` still undoes cleanly and a restored melody makes its session items whole again with no second write to keep in step. `isSessionItemMelodyMissing` (session-builder.ts) derives the state instead of storing a `missing: true` flag, for exactly that reason.

`buildSessionItemMelody` now returns `[]` for a melody item that resolves to nothing, the sequencer skips such an item and names it in a notification, `loadAndPlayMelodyForSession` says "That melody was deleted" instead of returning in silence, and LibraryTab stops loading a C4 into the editor when a broken pill is clicked. The editor timeline already rendered "Missing melody" — it was the only surface that did.

One unreachable line went with it: the scale branch carried a second single-note fallback for an empty scale, which `buildMultiOctaveScale` cannot produce (`parseCustomScaleDegrees` returns null below two degrees, never `[]`; every `SCALE_DEFINITIONS` entry has degrees; the last resort is `MAJOR_SCALE_INTERVALS`). A fallback that never fires still reads to the next person as a case that happens.

### [medium] Spectral worker reads only STFT frame 0, which is half zero-padding — timbre is measured on a decaying half-window

`src/workers/spectral.worker.ts:40` — confidence: likely — status: reported

The worker calls `stftForward(audio, nFft, nFft, ...)` and then indexes `stft.data[f * 2]` / `stft.data[f * 2 + 1]`, i.e. `frameBase = 0` — frame 0 only. But `stftForward` is center-padded (`const padSize = nFft / 2; padded[i + padSize] = audio[i]`, stft-engine.ts:253-263), so frame 0 spans `padded[0..nFft-1]` = nFft/2 zeros followed by only the FIRST HALF of the supplied buffer. Worse, the Hann window's rising half multiplies the zero padding while the audio gets `window[1024..2047]` — the DECAYING half, which starts at ~1.0 against `audio[0]`. That hard discontinuity at the frame start injects a broadband 1/f leakage skirt across the whole spectrum. The caller passes a full 2048-sample `AnalyserNode` frame (spectral-client.ts:38-56, use-live-capture.ts:168-174) expecting its spectrum, and gets half of it through a truncated, discontinuous window.

**Failure scenario.** A singer holds a clean, resonant note. `computeHNR` sums power in ±2 bins around each of 15 harmonics and calls everything else noise; the leakage skirt from the frame-start discontinuity fills every non-harmonic bin, inflating `noisePower` and pushing `hnrDb = 10*log10(harmonicPower/noisePower)` down. The live Pro Dashboard therefore reports a resonant voice as 'breathy' with a low efficiency score, and `detectResonance`'s band ratios are skewed toward the mask/head bands by the same broadband skirt. The `windowType` the SpectralWorkbench lets the user pick is also largely nullified, since half the window lands on zeros.

**Suggested fix.** Either window the supplied buffer directly and run one `bluesteinDFT` (no centre padding), or keep `stftForward` but read the centre frame — e.g. `const frame = Math.floor(stft.nFrames / 2); const base = frame * stft.nFreq * 2;` — and pass `hopLength = nFft / 2` so a full-signal frame exists. Reading only frame 0 of a center-padded STFT is never the frame you want.

### [medium] Stripe checkout grants credits without checking payment_status

`workers/db-worker/src/billing.ts:925` — confidence: possible — status: reported

`handleWebhook` routes every signature-verified `checkout.session.completed` event straight into `grantForCheckout`, and neither `grantCheckoutCredits` (billing.ts:474) nor `grantSupporterEntitlement` (billing.ts:378) ever inspects `session.payment_status` or `session.status`. Stripe fires `checkout.session.completed` when the customer finishes the Checkout flow, which is not the same as the money having arrived: for delayed-notification payment methods (SEPA direct debit, Bacs, OXXO, Boleto, Konbini, and bank transfers, all of which can be enabled from the Stripe Dashboard without touching this code), the session completes with `payment_status: 'unpaid'` and settles — or fails — days later. Stripe's own documented guidance is to gate fulfilment on `payment_status === 'paid'` and to handle `checkout.session.async_payment_succeeded`/`async_payment_failed`.

The reconciliation sweep (billing.ts:reconcileBilling) has the same gap: it lists `checkout.session.completed` events from the API and calls the identical grant path, so it would re-grant an unpaid session the webhook path had somehow skipped.

**Failure scenario.** An operator enables SEPA Direct Debit (or the Stripe Dashboard adds a delayed method to the automatic payment-method set). A buyer starts checkout for a credit pack; Stripe emits `checkout.session.completed` with `payment_status: 'unpaid'`. The webhook signature verifies, `grantCheckoutCredits` reads `metadata.credits` and writes a positive `creditLedger` row, and the buyer immediately spends the credits on GPU UVR jobs. Three days later the debit is refused; Stripe emits `checkout.session.async_payment_failed`, which this worker acknowledges with a bare `recordBillingEvent` and no action. The credits are never clawed back and the GPU spend is unrecoverable.

**Suggested fix.** In `grantForCheckout`, return a no-grant outcome unless `session.payment_status === 'paid'` (or `session.status === 'complete'` with `payment_status !== 'unpaid'`), and add a `checkout.session.async_payment_succeeded` branch that runs the same idempotent grant. Apply the same guard in `reconcileBilling` when iterating listed events.

### [medium] where[] filters accept any column, turning masked/private columns into a query oracle

`workers/db-worker/src/index.ts:218` — confidence: certain — status: FIXED

`parseListQuery` accepts `where[<col>]` for any identifier matching `/^[A-Za-z_][A-Za-z0-9_]*$/` and `handleList` turns each into a bound `"col" = ?` predicate. There is no allowlist tying filterable columns to the table's readable columns. Confidentiality is enforced only on the OUTPUT, by `maskPublicRow` (tables.ts:113), which strips everything outside `publicCols` (or removes `privateCols`) AFTER the WHERE clause has already selected rows.

The result is a boolean oracle over every hidden column of every publicly-readable table. `userProfiles` is `access: 'owner'` — unauthenticated reads pass `scopeRead`'s default branch — and its hidden columns are exactly the ones the comment at tables.ts:155 says must not leave: `friendCode` (a linking credential), `leaderboardOptIn` (consent state), `currentLeagueId`, `currentStreak`, `longestStreak`, `lastPracticeDate`. Each is directly probeable. `pricingPlans.stripePriceId` (privateCols) is probeable the same way. The generic list/count routes are also the only CRUD paths with no rate limit — index.ts:2143 applies `crud-write` to POST/PATCH/DELETE only — so an attacker can probe without any budget.

`GET /api/<entity>/count` uses the same filter path, giving a cleaner numeric oracle.

**Failure scenario.** Unauthenticated attacker issues `GET /api/userProfiles?where[id]=<victim>&where[leaderboardOptIn]=1` — a non-empty array means the victim opted in, an empty array means they did not, even though `leaderboardOptIn` is absent from `publicCols`. Iterating `where[currentStreak]=0..365` recovers the exact streak the profile mask exists to hide; `where[lastPracticeDate]=2026-08-13` reveals whether they practised yesterday. `GET /api/userProfiles/count?where[friendCode]=<candidate>` is an unrate-limited membership test against the friend-code space, bypassing the `friend-redeem` 20/5min limiter entirely.

**Suggested fix.** Constrain filterable columns to what the requester may read: in `parseListQuery`/`handleList`, reject (400) any `where[col]` that is not in `def.publicCols` (when the requester is neither owner nor admin) and that is in `def.privateCols`. Also add a read rate limit to the generic list/count routes, which are currently the only unmetered D1 surface.

**Fixed** in `hiddenReadColumn` (index.ts), which answers one question for both policies: may this requester read this column? A filter or an `orderBy` naming a column outside `publicCols`, or inside `privateCols`, is rejected with 400 rather than dropped — dropping it would widen the result set and still look like the query succeeded. `orderBy` was not in the original suggestion and is the same oracle with a binary search attached.

`access: 'user'` is exempt, and deliberately says so in code rather than relying on the fact that no such table declares `publicCols` today: `scopeRead` pins those reads to the caller's own rows, so a filter there reveals nothing about anybody else, and the day one of them gains a `publicCols` list must not be the day singers lose search over their own history. The test gives `sessionRecords` one for its duration, since the rule is about the shape of a table definition rather than about today's tables.

**Not done: the read rate limit.** The generic list/count routes remain the only unmetered D1 surface. Adding a bucket there is the one change in this set with a plausible regression — anonymous callers are keyed by IP, and a classroom of devices cold-starting together makes tens of reads each, so any limit tight enough to bother a prober is tight enough to break a music lab. With the column policy in place the probe is answered 400 on the first request, so the limiter would be bounding a query that no longer works. Revisit if reads become a cost problem rather than a disclosure one.

### [low] Target-pitch tolerance band on the practice canvas is 0.1 cents wide, so it renders as zero pixels

`src/components/PitchCanvas.tsx:989` — confidence: likely — status: reported

`drawOneTargetLine` builds the shaded in-tune band from `centsBand = 0.1` used as `Math.pow(2, centsBand / 1200)`. The `/1200` divisor makes the unit cents, so the band is ±0.1 CENT around the target — a frequency ratio of 1.0000577. Mapped through `freqToY` (which spans `bounds.maxMidi - bounds.minMidi` semitones over the canvas height), that is on the order of 1e-4 pixels tall, so `ctx.fillRect(0, yHigh, w, yLow - yHigh)` paints nothing visible. The constant looks like it was meant either as 0.1 SEMITONE (which would need `/12`, giving ±10 cents) or as a realistic cent tolerance (25-50).

**Failure scenario.** A singer on the practice canvas sees only the dashed target line, never the shaded tolerance band the code allocates two fill colours for (`rgba(88,166,255,0.08)` primary / `0.04` secondary). There is no visual cue for how close counts as in tune, which is the entire purpose of the band.

**Suggested fix.** Decide the unit and match the divisor: `const centsBand = 25` (keeping `/1200`) for a ±25-cent band, or `Math.pow(2, centsBand / 12)` if 0.1 semitone was intended. Ideally source the value from the same tolerance the scorer uses so the drawn band and the grading agree.

### [low] Stem-mixer transport seek bar is a click-only div with no role, tabindex or keyboard handler

`src/components/StemMixerTransport.tsx:603` — confidence: certain — status: reported

The progress/seek bar is a bare `<div>` whose only interaction is `onClick`. It has no `role="slider"`, no `tabindex`, no `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, and no `onKeyDown`, so it is invisible to assistive technology and cannot be reached or operated from the keyboard at all. Seeking is the primary transport interaction on this surface and there is no keyboard-reachable alternative in the same control group. This is a WCAG 2.1.1 (Keyboard) failure, not a cosmetic nit — contrast with MicLevelMeter.tsx:113-118, which does give its bar `role="meter"` plus the full aria-value set.

**Failure scenario.** A keyboard-only or screen-reader user in the stem mixer tabs through the transport: play/pause and the other buttons receive focus, the progress bar is skipped entirely. They can start and stop playback but can never move the playhead, and a screen reader announces nothing about the current position.

**Suggested fix.** Give the bar `role="slider"`, `tabindex="0"`, `aria-label="Seek"`, `aria-valuemin={0}`, `aria-valuemax={props.duration()}`, `aria-valuenow={props.elapsed()}` and an `onKeyDown` that seeks on ArrowLeft/ArrowRight/Home/End.

### [low] Editor share handler leaves a clipboard rejection unhandled and gives no failure feedback

`src/features/editor/useEditorController.ts:35` — confidence: certain — status: reported

Same defect shape as the StemMixer share button: a fulfilment-only `.then()` on `navigator.clipboard.writeText`. The success toast is inside `.then()`, so a denial produces neither a toast nor an error — and the rejection escapes to `window` where AppErrorBoundary turns it into the crash modal.

Note the contrast with the two sibling handlers in the same file, which both handle failure explicitly: `handleExportMIDI` checks `result !== null` (line 47) and `handleImportMIDI` wraps in try/catch with `showNotification('Error reading MIDI file', 'error')` (line 82).

Severity is low only because reachability is currently limited — src/App.tsx:1407 notes "Handlers ... are exposed for future toolbar integration. Currently unused at the App level." The bug ships the moment the toolbar is wired up.

**Failure scenario.** Once the editor toolbar is wired to `handleShare`, a user on a non-secure context or with clipboard permission denied clicks Share. The write rejects with a DOMException, no notification of any kind appears, and the unhandled rejection reaches AppErrorBoundary, which replaces the editor with the "Application Error" modal.

**Suggested fix.** Reuse `copyShareUrl` from src/lib/share-codec.ts (which already does the execCommand fallback and returns a boolean), then `showNotification` for success or 'Failed to copy link' for failure — matching the pattern in src/components/CommunityShare.tsx:649-663.

### [low] setCanvasRef's teardown branch is unreachable — canvases are never unobserved and their listeners never removed

`src/features/stem-mixer/useStemMixerCanvasController.ts:151` — confidence: likely — status: reported

The whole `el === null` branch (lines 151-162), the only place that calls `observer?.unobserve(prev)` and removes the wheel/touchstart/touchmove/touchend listeners, is dead code: SolidJS never invokes a ref callback with `null` on teardown. The file states this itself at lines 126-129 ("Solid does not call a ref with null on teardown"), and the consuming components type the callback as non-nullable — `setCanvasRef: (id: string) => (el: HTMLCanvasElement) => void` in StemMixerFixedWorkspace.tsx:33 and StemMixerGridWorkspace.tsx:36. Every time a `Show` block re-renders a canvas, the ref runs the `el !== null` path and adds four more listeners plus a new `observer.observe(el)`, while the previous element stays observed. `reconnectObserver` (line 1812) heals this, but it is only called on `layout.workspaceLayout()` changes (StemMixer.tsx:1867-1870) — karaoke-focus toggles and the mapper overlay's `mapperOverview` strip go through the same ref with no reconnect.

**Failure scenario.** User toggles karaoke focus on and off twenty times during a session. Each toggle unmounts and remounts the pitch/midi/live canvases; the detached elements stay in the ResizeObserver's observation set, keeping their device-pixel backing stores (several MB each at dpr 2) alive and firing spurious resize callbacks that queue redraws for canvases nobody can see.

**Suggested fix.** Unobserve and detach listeners from the previous element at the top of the non-null path (`const prev = canvasRefs[id]; if (prev && prev !== el) { ...removeEventListener...; observer?.unobserve(prev) }`), rather than relying on a null call Solid never makes.

### [low] parseInt(noteName.slice(-1)) || 4 mangles octave 0, negative octaves and octave 10

`src/features/stem-mixer/useStemMixerPitchAnalysisController.ts:242` — confidence: likely — status: reported

`noteName` here is built two lines of code earlier as `` `${info.name}${info.octave}` `` (line 222 of the same file), so the octave is recovered by slicing off exactly one character and parsing it — then a classic falsy-on-zero default is applied.

Three distinct defects in one expression:

1. `parseInt('0')` is `0`, which is falsy, so `|| 4` rewrites octave 0 as octave 4 — four octaves off.
2. A note name with a negative octave (`'C#-1'`, produced by `midiToNote` for MIDI 0-11) slices to `'1'`, yielding octave 1.
3. A two-digit octave (`'G10'`) slices to `'0'` → falsy → 4.

The field is also inconsistent with the live-capture path, which fills the same `PitchNote` shape with a bare note letter and a real octave (`src/features/stem-mixer/useStemMixerAudioController.ts:1123-1126: noteName: pitch.noteName, octave: pitch.octave`). So the same `pitchHistory` array carries two different `noteName` conventions depending on which producer filled it.

**Failure scenario.** Offline pitch analysis of a bass or low-male vocal stem produces a merged note at MIDI 12-23 (octave 0). `midiToNote` yields name 'C', octave 0, so `noteName` is 'C0'; `parseInt('0')` is 0, `|| 4` replaces it with 4, and the PitchNote claims octave 4 — four octaves above the note actually sung. Any consumer reading `.octave` (rather than recomputing from `.frequency`) shows the wrong octave.

**Suggested fix.** Carry the octave through from the source instead of re-parsing a string: derive it from `n.midi` (`Math.floor(n.midi / 12) - 1`), and use `??` rather than `||` if a default is still wanted. Also align the two producers on one `noteName` convention (bare letter vs letter+octave).

### [low] Timeout timer and abort listener leak whenever the lyrics fetch rejects

`src/lib/lyrics-service.ts:280` — confidence: likely — status: reported

`createTimeoutSignal` (line 78) returns a `clear()` that cancels its 25-second `setTimeout`. All three call sites place `clear()` immediately after `await fetch(...)` on the success path only, so a rejected fetch (offline, DNS failure, CORS, or an external abort) skips it:

- `fetchLyricsLrclib` — src/lib/lyrics-service.ts:164 (`clear()` after the await, no try/finally at all; the whole function is unguarded and its callers catch)
- `fetchSearchLrclib` — src/lib/lyrics-service.ts:293 (`clear()` inside `try`, but the `catch` at line 345 does not call it)
- `fetchLyricsById` — src/lib/lyrics-service.ts:248 (same shape)

Additionally, when an `externalSignal` is supplied, `createTimeoutSignal` attaches `onAbort` to it with `addEventListener('abort', onAbort, { once: true })` and never removes it — `clear()` only clears the timer. Each search leaves a listener pinned to the caller's AbortController.

**Failure scenario.** Offline, `searchLyricsMulti` loops over up to four fallback queries; each `fetchSearchLrclib` fetch rejects immediately and skips `clear()`, so four 25-second timers plus four abort listeners stay live per search attempt. Reopening several sessions (or repeatedly pressing Search in the song picker) accumulates dozens of pending timers that keep firing `ctrl.abort()` on already-settled controllers and hold the page's task queue busy for 25 s after the user has moved on.

**Suggested fix.** Wrap each fetch in try/finally so `clear()` always runs, and have `clear()` also call `externalSignal?.removeEventListener('abort', onAbort)`. `AbortSignal.timeout(ms)` combined with `AbortSignal.any([...])` would remove the hand-rolled bookkeeping entirely.

### [low] computeHNR returns -Infinity for hnrDb when no harmonic bin carries energy

`src/lib/vocal-analyzer.ts:320` — confidence: possible — status: reported

`hnrDb` is guarded against `noisePower === 0` (returning 40) and against `totalPower === 0`, but not against `harmonicPower === 0`. When the f0 bin and all 15 harmonic windows are empty while other bins carry energy, `Math.log10(0 / noisePower)` yields -Infinity. `efficiency` survives via the `Math.max(0, Math.min(100, ...))` clamp, and `quality` falls through to 'breathy', but `hnrDb: Math.round(hnrDb * 10) / 10` is -Infinity and is returned verbatim in the `BreathinessResult` that flows into `LiveAnalysisSnapshot.breathiness` and the ProDashboard readouts.

**Failure scenario.** The supplied `fundamentalFreq` is wrong for the frame (e.g. an octave-error f0, or the live detector's last confident reading held over an unvoiced frame) so `f0Bin` and its multiples land on empty bins while broadband breath noise fills the rest of the spectrum. `hnrDb` becomes -Infinity and is rendered/serialised as '-Infinity' or 'null' depending on the sink, rather than a clamped floor value.

**Suggested fix.** Guard the numerator too, mirroring the existing denominator guard: `const hnrDb = noisePower > 0 ? (harmonicPower > 0 ? 10 * Math.log10(harmonicPower / noisePower) : -40) : 40` — or clamp the final value into the same [-40, 40] range the quality bands assume.

### [low] verifyState decodes the OAuth state signature outside any try/catch — malformed state returns 500, not 400

`workers/db-worker/src/auth.ts:1361` — confidence: certain — status: reported

`verifyState` calls `b64urlDecode(sig)` as an argument to `crypto.subtle.verify` with no try/catch around it. `b64urlDecode` wraps `atob`, which THROWS a DOMException on any character outside the base64 alphabet (and on a length%4===1 segment). The exception escapes `verifyState` → `handleGoogleCallback` → `handleAuth` → `handleRequest`, and is only caught by the top-level boundary in index.ts, which answers `{error: 'Internal server error'}` with status 500.

This is precisely the bug the codebase already identified and fixed in `verifyJwt` — the long comment at auth.ts:231-243 explains that a malformed segment escaping as a DOMException "unwound to the top-level handler and answered 500 on EVERY endpoint", and adds `SEGMENT_RE` guards plus a try/catch. `verifyState` (and, on the same pattern, the payload decode after a successful verify) never received that treatment. The state parameter is attacker-controllable and travels through a full-page redirect where truncation by mail clients or link rewriters is routine.

**Failure scenario.** `GET /api/auth/google/callback?state=abc.%21%21%21&code=x` — `sig` is `!!!`, `b64urlDecode` pads it to `!!!=` and `atob` throws InvalidCharacterError. Instead of the intended `{error: 'Invalid or expired state'}` 400, the caller gets a 500. A real user whose OAuth state got mangled in transit sees an opaque server error and the client, treating 5xx as a transient hiccup, retries the same broken URL rather than restarting sign-in.

**Suggested fix.** Mirror the verifyJwt fix: validate both segments against `SEGMENT_RE` before decoding, and wrap the decode+verify in try/catch returning null, e.g. `if (!SEGMENT_RE.test(body) || !SEGMENT_RE.test(sig)) return null; let valid: boolean; try { valid = await crypto.subtle.verify(…) } catch { return null }`.

### [low] Device-link poll token hash compared with !== (non-constant-time)

`workers/db-worker/src/auth.ts:2093` — confidence: possible — status: reported

`handleDeviceLinkPoll` compares the SHA-256 of the presented poll token against the stored hash with a plain `!==`, which short-circuits on the first differing byte. Every other secret comparison in this worker deliberately routes through the exported `timingSafeEqual` helper (index.ts:244 for ADMIN_KEY, testing-accounts.ts:657 for TESTING_PROVISION_KEY, billing.ts:832 for BILLING_SERVICE_KEY, jam-room.ts:468 for ownerToken), and auth.ts:387 documents exactly why. This one site was missed.

I am rating this low and 'possible' rather than confirmed-exploitable: the compared values are SHA-256 digests, so an attacker cannot steer the digest of a guess toward a target prefix without inverting the hash, and `device/poll` is capped at 400/5min per IP. The concern is defence-in-depth and consistency — the same `!==` on a value that is ever compared pre-hash would be a real leak, and the surrounding comment ("Answered the same way an expired code is, so the response cannot be used to discover that a code is real") shows the author is explicitly trying to remove all oracles from this response, which a timing side channel reintroduces.

**Failure scenario.** An attacker who has read a device code off a television screen polls `/api/auth/device/poll` with candidate poll tokens and measures response latency. Because `!==` on strings returns as soon as bytes diverge, responses for candidates whose digest shares a longer prefix with the stored hash take marginally longer, distinguishing them from responses where the row was simply absent or expired — the one distinction the handler's own comment says must not be observable.

**Suggested fix.** Use the module's existing helper: `if (!timingSafeEqual(await sha256b64url(pollToken), row.pollTokenHash)) { … }`.

### [low] decodeURIComponent on the path segment throws on malformed percent-encoding, yielding 500

`workers/db-worker/src/index.ts:2133` — confidence: certain — status: reported

The generic CRUD router decodes the id path segment with a bare `decodeURIComponent`, which throws `URIError: URI malformed` on any invalid percent sequence. The throw propagates to the top-level boundary and produces a 500. The same unguarded pattern appears throughout `guided-exercises.ts` (lines 1503, 1512, 1520, 1550, 1576, 1592, 1602 all call `decodeURIComponent(match[n]!)` directly).

Notably `premium-background-admin.ts:1921` already wraps this in a `decodePathComponent` helper that returns null on failure and produces a clean 404, so the correct pattern exists in the codebase but was not applied to the other two routers. A user-triggerable 500 also pollutes error monitoring and masks real failures.

**Failure scenario.** `GET /api/userProfiles/%zz` matches the router regex `/^\/api\/([A-Za-z]+)(?:\/([^/]+))?$/` with `match[2] === '%zz'`; `decodeURIComponent('%zz')` throws URIError, which unwinds past handleGetById to the index.ts catch-all and returns `{"error":"Internal server error"}` with status 500 instead of a 404. Same for `GET /api/guided-exercises/%e0%a4%a` and `GET /api/guided-media/%zz`.

**Suggested fix.** Export the existing `decodePathComponent` helper from premium-background-admin.ts (or duplicate it in a shared module) and use it in index.ts:2133 and at every `decodeURIComponent(match[n]!)` site in guided-exercises.ts, returning 404 when it yields null.

### [low] Unvalidated offset query parameter is bound to SQL as NaN

`workers/db-worker/src/index.ts:236` — confidence: possible — status: reported

`parseListQuery` guards `limit` carefully — `Number.isFinite(requested) && requested > 0`, clamped to `MAX_LIST_LIMIT` — but `offset` gets no guard at all: `offset: offsetRaw ? Number(offsetRaw) : undefined`. `Number('abc')` is `NaN`, and `Number('-5')` is `-5`; both are pushed into the bind array at index.ts:346 and sent to D1 as `OFFSET ?`.

Every other offset in the file is validated — `handleLeaderboard` at index.ts:884 does `Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0` — so this is an inconsistency, not a deliberate choice. `handleLeaderboard` also shows the intended behaviour for a bad value: fall back to 0.

I have not executed this against D1, so I cannot state with certainty whether the runtime rejects the NaN bind (500) or coerces it to NULL (SQLite treats a NULL offset as 0, silently ignoring the parameter) — hence 'possible'. Either outcome is wrong: a 500 on a typo'd query string, or a silently ignored offset that makes a paginating client loop over page 1 forever.

**Failure scenario.** A client paginating with `GET /api/sessionRecords?limit=50&offset=${cursor}` where `cursor` is accidentally the string 'undefined' or an empty-ish non-numeric produces `offset=undefined`; `Number('undefined')` is NaN, which is bound into `LIMIT ? OFFSET ?`. Either D1 rejects the statement and the top-level handler answers 500 for what should be a 400, or SQLite reads the NULL as offset 0 and the client silently re-reads page 1 on every request, never advancing and never seeing an error.

**Suggested fix.** Mirror the limit and the leaderboard handler: `const parsedOffset = offsetRaw === null ? undefined : Number(offsetRaw); offset: Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : undefined` — or return `null` (400 'Invalid query') for a non-numeric offset, matching how a bad `orderBy` is handled at index.ts:224.
