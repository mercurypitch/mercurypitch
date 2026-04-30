# Plan — Reusable `MelodyLibraryList` component

## Concrete scope (revised)

We extract **one** reusable list component, modelled after the most
advanced existing implementation (`.melody-select-list` in
`LibraryModal.tsx`, the playlist "Add Melody to Playlist" picker), and
use it in three places. Everything else stays put.

### Call sites

| Today                                                                   | Becomes                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `LibraryModal.tsx`, playlist picker `<div class="melody-select-list">` (lines ~1033–1075) | `<MelodyLibraryList mode="multi" kinds={['melody','session']} />` (this is the **source of the extraction**) |
| `LibraryModal.tsx`, melody overview `<div class="library-list">` (lines ~822) | `<MelodyLibraryList mode="single" kinds={['melody']} />` |
| `SessionLibraryModal.tsx`, `<div class="library-list">` (lines ~215)    | `<MelodyLibraryList mode="single" kinds={['session']} />` |
| `SessionEditor.tsx` Editor tab `<MelodyPillList class="melody-pill-list">` | `<MelodyLibraryList mode="multi" kinds={['melody']} draggable />` — drag handlers wired so existing DnD into `SessionEditorTimeline` keeps working |

### Explicitly NOT touched

- `SessionEditorTimeline.tsx` — internal logic, drop targets, reorder
  semantics all stay. The new list just needs to emit drag events that
  the timeline can already accept.
- `AppSidebar.tsx` and `.session-items-pills` (sidebar pill rows). Out
  of scope.
- `MelodyPillList.tsx` is replaced only at the SessionEditor call site;
  if it has no other callers afterwards we can delete it as a tidy-up
  (verify with grep), otherwise leave it.

## Component API

```ts
// src/components/MelodyLibraryList.tsx

export type LibraryEntryKind = 'melody' | 'session'

export interface LibraryEntry {
  id: string
  kind: LibraryEntryKind
  title: string
  /** Free-form one-line meta (key • bpm • notes • plays …). */
  meta?: string
  /** Optional tag chips shown under the title. */
  tags?: string[]
  /** Original raw record — passed through to consumer callbacks
   *  (e.g. the playlist picker needs the full Melody / Session). */
  raw?: unknown
}

export interface MelodyLibraryListProps {
  entries: LibraryEntry[]                 // controlled, prepared by caller
  /** Restricts which kinds the list will render (also drives the
   *  fallback empty-state copy). */
  kinds?: LibraryEntryKind[]              // default ['melody', 'session']

  /** 'single' = single-select highlight (replaces `.library-list`)
   *  'multi'  = checkbox/pill toggle (replaces `.melody-select-list`)  */
  mode?: 'single' | 'multi'               // default 'multi'

  selectedIds: ReadonlySet<string>
  onSelectionChange: (ids: Set<string>) => void

  /** Single-select activate (e.g. double-click / Enter / single-click in
   *  'single' mode loads the melody). Optional in 'multi' mode. */
  onItemActivate?: (entry: LibraryEntry) => void

  /** When provided the list items become draggable. The component
   *  attaches a default `dataTransfer.setData('application/x-melody-id',
   *  entry.id)` and calls back so the SessionEditor can decorate the
   *  payload further (e.g. set its own session-builder MIME type). */
  onDragStart?: (entry: LibraryEntry, e: DragEvent) => void
  onDragEnd?: (entry: LibraryEntry, e: DragEvent) => void

  /** Optional inline search box. If absent the caller filters
   *  `entries` upstream (LibraryModal already does this). */
  showSearch?: boolean
  searchPlaceholder?: string

  emptyMessage?: string
  className?: string
}
```

The component renders the same DOM structure that `.melody-select-list`
uses today — pill items with icon + title + meta + check — and accepts
a `mode` prop that swaps the trailing affordance (radio-style highlight
vs ✓/+ check) and swaps the `class` on the wrapper between
`.melody-select-list` (multi) and `.library-list` (single) so existing
CSS keeps applying. Both class names are preserved on the wrapper to
avoid CSS rewrites and to keep selectors that current E2E specs may
rely on.

## Migration steps

1. **Create `src/components/MelodyLibraryList.tsx`.** Lift the JSX from
   `LibraryModal.tsx`'s playlist picker. Generalise:
   - replace the local `availableForPlaylist()` consumer with the
     `entries` prop;
   - replace `isSessionInPlaylist / isMelodyInPlaylist` with
     `selectedIds.has(entry.id)`;
   - replace `handleTogglePlaylistItem` with the controlled
     `onSelectionChange`;
   - keep `playlist-picker-pill / playlist-picker-icon /
     playlist-picker-copy / playlist-picker-check` class names so the
     existing CSS in `app.css` (around line 8618) renders unchanged.

2. **Replace the playlist picker** in `LibraryModal.tsx` with the new
   component. This is the primary smoke-test that the abstraction is
   right.

3. **Replace the melody overview list** in `LibraryModal.tsx`
   (`.library-list`). Convert each `LibraryMelody` row to a
   `LibraryEntry` with `meta = "${key} • ${bpm} BPM • ${noteCount}"`,
   pass `tags`. `mode='single'`. Keep the existing DnD by wiring
   `onDragStart` → caller's `handleDragStart(e, key)`.

4. **Replace the session list** in `SessionLibraryModal.tsx`
   (`.library-list`). Same pattern, `kinds=['session']`,
   `mode='single'`.

5. **Replace `<MelodyPillList>` inside `SessionEditor.tsx`**. The Editor
   tab uses class `melody-pill-list`; we add that class to the
   `MelodyLibraryList` wrapper at this call site (or expose a
   `className` prop, which the API already does) so existing CSS at
   `app.css:545` keeps rendering.

   Wire `onDragStart` to the existing handler that sets the
   session-builder DnD payload, so dragging onto
   `SessionEditorTimeline` keeps working with no changes inside the
   timeline.

6. **Tidy.** `grep -r "MelodyPillList" src/` after the migration; if no
   other call sites remain, delete `MelodyPillList.tsx`. Otherwise
   leave it untouched.

## DnD contract (so the timeline keeps accepting drops)

Today `SessionEditor`/`MelodyPillList` set whatever MIME type
`SessionEditorTimeline` reads on drop (need to confirm — likely
`application/x-melody-key` or similar). The plan:

- `MelodyLibraryList` exposes the DOM-level `dragstart` event via the
  `onDragStart(entry, e)` callback **before** drawing any default
  payload.
- The SessionEditor call site's callback is exactly the existing
  handler; it copies `entry.id` into whatever MIME type the timeline
  expects. No timeline changes.

## Out of scope / explicitly skipped

- `SessionEditorTimeline.tsx` internals.
- `AppSidebar` and `.session-items-pills`.
- Promoting selection state to a store.
- Reorder semantics inside the new list (list is read-only;
  reordering still happens inside the timeline, which we don't touch).
