# Melody ribbon — listening study

This is an original reference-sound and visual audition, not a microphone judge
or a released level. Playback traces the authored melody; no singing is scored.
The implementation plan is [the learning spec](../../plans/MELODY-RIBBON-LEARNING-SPEC.md).

Design: the museum's sky behind one broad glass music window. Sea-glass
`#164e53`, deep ink `#163840`, ivory `#fffaf0`, gilt `#be9141`, cloud blue
`#e0edf4`, and muted line `#9bb8ba`. Georgia carries gallery titles; Trebuchet
and the system sans-serif carry controls. The contour is the main visual, with
quiet controls beneath it. Gold shows the completed prefix, never a generic
loading timer. Use one column on phones; no animated background ornament.

```
Glassworks                         Reference audition
Melodies in glass
Choose a phrase [3 notes] [5 notes] [7 notes] [10 notes]
┌──────────── glass window / pitch ribbon ────────────┐
│        note       curve       note       breath    │
└───────────────────────────────────────────────────┘
[Hear melody / Stop]       Starting note       Pace
Short explanation; expandable prototype notes
```

The cream/gold/teal treatment follows the already approved museum identity.
Avoid a dashboard of cards or a numeric score; this is an exhibit audition.
Only the user-started functional ribbon moves. The compiled contour supplies
both SVG and audio pitch samples. A breath gap is silent and visibly separate.

Open `index.html` through the local playtest server's `/@fs/` route. It uses the
existing `/games/journey-map-v3/cloudscape.webp` background, local CSS/modules,
and browser Web Audio; no network service, microphone permission or recording.
Audio starts only after pressing Hear melody and stops on selection, Stop,
page hide or navigation. A slower pace changes timing without changing pitch.

## Verification

The three-viewport review passes for desktop mouse/keyboard and emulated tablet
and phone touch; see `proofs/review.json` and the viewed screenshots. The
independent review records playback and background-race checks in
`proofs/INDEPENDENT-REVIEW.md`. This does not establish physical-tablet audio or
musical acceptance. The standalone art scripts are outside the application
TypeScript/ESLint project; syntax, formatting and browser execution were checked.

Run the local artifact check with the QA server on 5341:

```sh
rtk proxy timeout 120 /home/maff/.nvm/versions/node/v22.22.2/bin/node /home/maff/.codex/worktrees/00ad/mercurypitch-agent/art/glass-adventure/melody-ribbon/v1/review.mjs
```
