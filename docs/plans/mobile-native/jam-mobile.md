# Jam — mobile friendliness

**Status**: light fix shipped; fuller room layout planned (low priority).

Jam is a **desktop-first** surface — it's used where instruments are connected
and multiple participants share a room. It doesn't need the full mobile-stage
treatment; the goal is "usable and not broken on a phone," not a redesign.

## What's already fine

The **lobby** (`/#/jam` before a room: Jam Session title, Display Name,
Create Room / Join Room, Room Code) is a clean centered single column and
reads well on a phone. No work needed.

## Shipped now (light fix)

- The floating **chat bubble** (`JamChatWidget` — `position: fixed; bottom:20px;
  z-index:1000`) sat on top of the bottom tab bar and covered navigation. On
  `≤768px` it now clears the bar (`bottom: calc(var(--tabbar-total) + 16px)`)
  and the open chat window is constrained to the viewport
  (`width: min(320px, 100vw - 24px); height: min(400px, 58vh)`).

## The room (planned — where the real work is)

The **room** view (`JamPanel` + `JamPitchDisplay`, `JamSharedPitchCanvas`,
`JamCameraWidget`, `JamActivityHeatmap`, `JamExerciseCanvas`/`Controls`,
participant list, chat) is laid out for a wide screen — multi-column, fixed
widths, controls assuming hover — and can't be staged without the multiplayer
backend, so it wasn't exercised here.

Proposed, in priority order (each small, independent):

1. **Single-column stack on narrow.** `JamPanel.module.css` — collapse the
   multi-column room grid to one column at `≤768px`; the shared pitch canvas
   full-width on top, participants + exercise controls stacked below. Add
   `--tabbar-total` bottom clearance so nothing hides under the tab bar.
2. **Chat as a bottom sheet on mobile.** Instead of the 320×400 floating
   window (cramped on a phone), open the chat in a kit `Sheet`
   (`src/components/mobile/Sheet.tsx`) on `isNarrow()` — full-width, safe-area
   aware, swipe-to-dismiss — keeping the raised bubble as the trigger.
3. **Participants: collapsible.** A horizontally-scrolling avatar strip or a
   count chip that opens a sheet, instead of a fixed sidebar column.
4. **Camera widget** (`JamCameraWidget`) — make it a small draggable/collapsible
   PiP on narrow, or hide by default behind a toggle (video in a jam is
   secondary on a phone and costs bandwidth/space).
5. **Exercise controls** (`JamExerciseControls`) — reuse the `OptionsSheet`
   pattern (as Singing/Piano/Guitar now do) for the per-exercise settings so
   the room's top isn't a control stack.
6. **Safe areas + no horizontal overflow** pass across all `Jam*.module.css`
   (several assume desktop widths).

Effort estimate: ~1–2 focused sessions for items 1–3 (the usability core);
4–6 are polish. None are blockers — jam remains a desktop-primary feature.

## Verification note

The room can't be driven in the local sandbox (needs the multiplayer backend
/ a second participant). Room-layout work should be verified against a real
room on device, or with a stubbed room state if one is added for testing.

## Related
- Kit primitives (Sheet/OptionsSheet, tab-bar tokens): [mobile-kit.md](mobile-kit.md)
