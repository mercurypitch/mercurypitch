# Guitar recorder: implementation and preview checks

Contract: [Guitar recorder EARS](specs/guitar-recording.ears.md).
Work item: [PR 739](https://github.com/mercurypitch/mercurypitch/pull/739).
Drum sound work is intentionally separate and deferred.

## Implemented phases

1. Selected-channel capture borrows Listening's source/context. An AudioWorklet
   copies sequential PCM into eight reusable 8,192-frame buffers. A Worker runs
   pitch/onset analysis and PCM16 encoding. The amp path is unchanged.
2. Play free form opens the existing song room without fake assets. Explicit
   Record works with no backing or fixed-rate backing, up to five minutes.
   Route changes, page hiding and resource failure preserve recoverable drafts.
3. Dexie v12 adds local recording metadata, checkpointed evidence, accepted score
   revisions and song placements. Keep atomically promotes dry audio into Hear
   Yourself; raw staged PCM is removed only after successful promotion.
4. Jam Doctor hosts dry replay, corrections/Undo and Keep/Practice. Accepted
   melodies enter the existing score chooser and tab practice, not a new player.
   Removing only Hear Yourself audio retains practice notes.
5. Accepted revisions can be placed on a song using existing alignment controls,
   and exported as MIDI or actual GP7 `.gp`. Notes and captured evidence remain
   separate; newer revisions do not change previous practice targets.

The authored-tab host, Studio Lead DSP and operating-system/browser audio
settings are unchanged by the recorder implementation. There is no cloud upload,
new asset licence, background recording, polyphonic model or second monitor.

## Automated checks

Focused Vitest coverage lives alongside the recording analysis, capture core,
score conversion, export, persistence, attachment and controller modules. It
includes cancellation/late permission, stream ownership, interruption, bounded
buffers, held/repeated/legato notes, upgrade from v11, transaction rollback,
concurrent Keep, quota retry, stale revision rejection, original-audio deletion,
capo/tuning, reversible edits and MIDI/GP7 parser round trips.

`src/e2e/guitar-night-recording.spec.ts` exercises the real worklet, Worker,
IndexedDB and exported download path with generated audio:

- No-song Record → Stop → corrections/Undo → Keep → Practice → reload.
- Reopen from Hear Yourself and export MIDI/GP without opening a microphone.
- Record with backing, stop at its boundary, attach, nudge and reload placement.
- Record while monitoring remains active: one output context, unchanged level
  within the test tolerance, continuous rendered frames and no input release.
- Desktop, 390px and 320px review/transport screenshots and reachable actions.

Run against a freshly built local bundle (the Playwright config does not rebuild):

```bash
pnpm build:e2e
VITE_E2E_PORT=35219 PLAYWRIGHT_HTML_OPEN=never pnpm exec playwright test \
  src/e2e/guitar-night-recording.spec.ts --workers=1 --reporter=line
```

Use `VITE_E2E_PORT=5217` for an already running development server. Tests use
isolated browser storage and generated input; do not point them at production.

## Owner audition before merge

- [ ] Enter Play free form. Confirm nothing plays or requests input until asked.
- [ ] Select Direct input / the guitar channel. Enable Listening and You, then
      compare monitor-only with Record running at the same amp/rate/route.
      Note output estimate and underruns, but judge feel by playing.
- [ ] Record 10–20 seconds: low sustained notes, silence, repeated picks,
      hammer-ons/pull-offs and a faster phrase. Stop without playing a song.
- [ ] Check dry replay, note pitch/endings and suggested frets. Correct a note,
      collapse/reopen corrections, Undo, then Keep and reload Hear Yourself.
- [ ] Practice these notes; test preferred views, an A/B loop and a new scored
      attempt. The original improvisation itself must remain ungraded.
- [ ] Record along with a song; attach and nudge if needed. Reload and verify
      placement. For unrelated free play, use manual first/last-note placement.
- [ ] Download `.mid` and `.gp`; open `.gp` in Guitar Pro or a compatible reader.
      Automated parser round trips do not replace a notation-reader audition.

## Explicit limitations / remaining decisions

- Dry mono replay is intentional, not the monitored amp/effects sound. An amp
  parameter snapshot is provenance only; reamping/wet capture is not shipped.
- Single-note transcription is approximate. Original pitch evidence is retained,
  but bend/vibrato technique notation and overlapping chords need correction.
- Free time uses a labelled 120 BPM display grid; optional snapping helps produce
  simpler notation. Count-in and automatic tempo detection are not shipped.
- Browser storage can be evicted. Local persistence is not a cloud backup.
- Automated browser coverage is Chromium with synthetic input. Real-interface
  latency, transcription quality, Firefox and Safari require explicit testing.
- The independent UI review found lost Undo on collapse and editing during save;
  both are fixed and covered. The established two-room UI remains intact.
