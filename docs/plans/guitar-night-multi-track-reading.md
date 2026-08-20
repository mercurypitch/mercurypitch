# Guitar Night multi-track reading — feature plan

Owner request (2026-08-19): "the guitar night room, doesn't seem to have a easy
way to change what is being scored against? what track? And also could we plan
to add this and a way to see multiple tracks at the same time even if not
playing them? ... this new feature should use something like the beautiful
piano notes score notes view, and have a sort of selector to show hide multiple
stacked instruments tabs/notes per bar, few bars that fit on one horizontal
page listing, and then they scroll down... we can also try to do similar thing
but in the fretboard/highway views, where you see 1 other in some corner,
smaller, for example if you want to track rhytham guitar and you are lead, or
if you want to track and see bass... And then you can maybe swap between the
two easily, by tapping. And a way to nicely click on loaded tab/midi session
info/details and in that nice panel, users can easily switch between what they
score (all the rest of tracks, apart from those 2 selected for main and
secondary view)."

Code refs verified 2026-08-19 against `main` at `2fd040bf`.

## 1. What exists today

**Track switching exists, but only in the lobby.** `GuitarNightApp.tsx:1637`
renders a `role="group"` labelled `"Visible part"` when
`attached().tracks.length > 1`, one button per track, calling
`referenceController.selectTrack(track.id)` (`:1653`). Once you are in a room
there is no way to change it without going back.

**A reference carries exactly one track's notes.**
`openGuitarNightReference(source, requestedTrackId, tuning)`
(`reference-port.ts:265`) resolves a single track (`:270`), places that track's
notes onto the stage tuning (`:279-292`), and returns a `GuitarNightReference`
whose `notes` are that track's alone. `reference.tracks` is a summary list —
`{ id, name, noteCount }` (`reference-port.ts:43`) — with no notes in it.

**But the source has everything.** `GuitarNightReferenceSource` holds every
track with its notes, and per-track instrument and tuning are already derived:
`sourceTrackInstrument(track)` and `sourceTuningForTrack(track, instrument)`
(`:273-274`). A bass track in a Guitar Pro file therefore already knows it is a
bass with four strings; nothing has to guess.

**Two rooms, two references.** The play-along room guides only with a
`measured` reference read from this recording's own stem; an `authored` tab
rehearses in the tab room on its own clock (`GuitarNightApp.tsx:405-413`). The
measured kind has one track by construction.

**The stage has a view switcher already.** `GuitarNightStageView` is
`'highway' | 'grid' | 'tab' | 'neck'` (`GuitarNightStage.tsx:27`) over three
modes `'flow' | 'tab' | 'neck'` (`:26`), with `availableViews` letting a host
narrow the set. The Tab mode already draws fret numbers on string lanes in the
DOM (`GuitarNightStage.tsx:1377+`), and it already reads a `tuning` accessor
for its lane labels.

**Piano's Score view is the reference for "beautiful".**
`PianoNightScoreView` (`PianoNightStageViews.tsx:168`) draws one phrase as an
SVG grand staff — clefs, five-line staves, bar lines — deliberately avoiding
the VexFlow bundle. It draws a _window_, not a scrolling document.

**Rendering.** `GuitarTab3DView` mounts one canvas-2d renderer
(`GuitarTab3DView.tsx:358`), repaints per invalidation through
`createAdaptiveFrameRateLimiter(presentationFps)` (`:390`), and resizes only
when width, height or DPR actually change (`:375`). Device-tier demotion is
latched one-way (`device-tier.ts:363`), so it costs at most one resize.

## 2. Decisions taken with the owner

| Question       | Decision                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Delivery       | Three phases, three PRs, each mergeable and testable on dev alone                                                                    |
| Row content    | Guitar tab lanes (fret numbers on string lines)                                                                                      |
| Notation staff | A later phase, behind a per-row toggle — not in the first three                                                                      |
| Scored track   | Follows the main view by default; overridable in the panel, and the room says plainly which track is scored while the override is on |
| Stackable      | Every track in the file, each toggleable, plus measured stem lines                                                                   |
| Placement      | A fifth stage view, beside Highway / Grid / Tab / Neck                                                                               |
| Playhead       | The sheet follows playback with a moving cursor; a hand scroll takes over until released                                             |
| Rooms          | Tab room first; play-along room afterwards                                                                                           |

## 3. Phase 1 — the session panel and an in-room track switcher — **shipped**

Shipped in #611. The smallest thing that removes the reported dead end.

- A new panel opened from the room's session info (the title the room already
  shows through `guideLabel`). It lists every track in the source with its
  name, instrument and note count.
- Selecting a track calls the existing `selectTrack`, so scoring, tuning and
  the stage all follow exactly as they do from the lobby today.
- The panel is the future home of the main/secondary assignment and the
  scoring override, so its shape is designed now and filled in later.

**New surface:** the controller must expose the source's track list to the
room. Today the room only receives a `GuitarNightReference`. Either the
reference gains the summaries it already has (`reference.tracks` is enough for
phase 1) or the room takes the controller's `selectTrack` directly.

**Cost:** small. No renderer work.

## 4. Phase 2 — the multi-track tab sheet, as a fifth stage view — **shipped**

- `GuitarNightStageView` gained `'sheet'`. It is offered only where `sheetLanes`
  is supplied, so every existing host — the neck-only activities included — is
  untouched.
- Layout: bars laid left to right across the width, a few per row, rows stacking
  downward and scrolling. One _system_ per row, every visible part stacked
  inside it.
- Each part draws its own tuning's string lines. A bass row is four lines
  because the source says it is a bass, not because we assumed.
- Show and hide per part, driven from the phase 1 panel. The scored part cannot
  be hidden; its control is shown and held rather than removed.
- Parts keep their written order. Promoting the scored part to the top was tried
  and reported as the sheet doing something unexplained: every other part jumps
  a row the moment a reader taps a name. Scoring marks a part, it never moves
  one.
- The scored part is drawn in full ink, the rest quietly.
- A measured stem line reads as a sheet of exactly one part. It counts beats on
  the recording's clock (60 BPM, a beat a second) while a written score counts
  musical beats, so stacking the two would draw bar lines meaning two different
  things in two rows. Reading a stem against an authored part needs a documented
  time mapping first, and that is its own change.

**What landed where**

| Piece                                                   | File                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Bars, systems, note indexing, beat lookup               | `src/features/guitar-night/sheet/sheet-model.ts`                            |
| Which parts are drawn, in what order, on whose neck     | `src/features/guitar-night/sheet/sheet-lanes.ts`                            |
| Renderer contract, lane geometry, virtual window, theme | `src/features/guitar-night/sheet/sheet-render.ts`                           |
| The tab painter                                         | `src/features/guitar-night/sheet/sheet-tab-renderer.ts`                     |
| The scrolling page                                      | `src/features/guitar-night/sheet/GuitarNightSheetView.tsx`                  |
| Placement shared with the highway                       | `placeReferenceTrack` in `reference-port.ts`                                |
| Which parts are on the page                             | `sheetLanes` / `toggleSheetTrack` in `useGuitarNightReferenceController.ts` |

**Placement** is shared rather than reimplemented: `openGuitarNightReference`
now goes through `placeReferenceTrack` too, so a note on the sheet lands exactly
where the highway would put it.

**Rendering** went to canvas, one per visible system, painted once and then left
alone. What moves while the song plays is a single element with a transform on
it. Only the systems near the reader are mounted, so a long score costs what a
short one does. The renderer is an interface with two questions in it — how tall
is a part, and paint one system — which is the seam phase 4 arrives through.

**Bars** come from a time signature list the model accepts but nothing supplies
yet. Guitar Pro carries real signatures per master bar (`gp-to-midi-song.ts`
already walks `score.masterBars`); plain MIDI and measured audio carry none.
Common time is the documented fallback until that plumbing lands, and it is the
first thing to fix for scores that are not in four.

## 5. Phase 3 — the secondary part in the corner, and tap to swap

- The highway, grid and neck views gain an optional inset drawing a second
  track, smaller, in a corner — the lead player watching the rhythm part, or
  the bass.
- Tapping the inset swaps it with the main view. The scored track does not
  move with the swap unless scoring is set to follow the main view, which is
  the default, in which case the room says so on the swap.
- The inset shares the playhead; it never owns transport.

**Rendering:** this one _is_ the canvas. A second renderer instance is the
simple answer and the expensive one; drawing the inset within the existing
renderer's frame is cheaper and needs the scene model to carry two note sets.
Decide after phase 2 has told us what a second placed track costs.

## 6. Phase 4 (later) — notation staff toggle

Per-row switch from tab lanes to a staff, reusing Piano Night's lightweight SVG
approach rather than adding VexFlow. Out of scope for the first three PRs;
noted here so phase 2's row abstraction is built with two renderings in mind.

## 7. Testing

Per the standing rule, every phase carries a reproduction before the fix and
coverage of everything it touches.

- Unit: the multi-track placement (a bass track keeps four lanes and its own
  tuning; hiding a row does not disturb the others; the scored row survives a
  main-view swap).
- Component: the panel lists every track, switches the scored one, and states
  the override plainly when scoring is not following the main view.
- E2E: a seeded multi-track file, sheet view showing two instruments stacked,
  the playhead advancing, and the corner inset swapping on tap.

## 8. Risks

- **Tempo honesty.** Every stacked row must share one tempo map, which is the
  source's. This is the same boundary that keeps authored and measured
  references in separate rooms; a measured row drawn beside authored rows must
  be labelled as measured and must not imply alignment it does not have.
- **Performance.** A 12-track file with every row visible is the worst case,
  and the owner has accepted that renderer work may be needed. The mitigation
  that costs nothing is drawing only the visible systems.
- **Scope of the swap.** Swapping views must never silently change what is
  being scored — that is how a player loses a take and does not know why.
