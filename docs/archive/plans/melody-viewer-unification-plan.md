# Unify Melody & Session Library Lists

This plan outlines the extraction and integration of a unified `MelodyLibraryList` component to replace four distinct but similar list implementations across the codebase.

## Proposed Changes

We will extract the highly polished list UI currently found in `LibraryModal.tsx`'s "Add Melody to Playlist" section and turn it into a versatile `MelodyLibraryList` component.

### `src/components/shared/MelodyLibraryList.tsx`

[NEW] `src/components/shared/MelodyLibraryList.tsx`
Create a generic, reusable list component that supports:
- **Kinds**: `melody` and `session` items.
- **Selection Modes**: `single` (radio-style selection or click-to-activate) and `multi` (checkbox/pill selection).
- **Drag and Drop**: Built-in `onDragStart` and `onDragEnd` hooks to preserve existing DnD behavior (e.g., dropping into playlists or the session timeline).
- **Custom Renderers**: `renderActions` and `renderDetails` optional props to support injecting action buttons (Play/Edit/Delete) or sub-components (like `SessionMiniTimeline`).

### `src/components/LibraryModal.tsx`

[MODIFY] `src/components/LibraryModal.tsx`
- Replace the `.melody-select-list` (used for the playlist picker) with `<MelodyLibraryList mode="multi" />`.
- Replace the `.library-list` (used for the melody overview tab) with `<MelodyLibraryList mode="single" renderActions={...} />`.

### `src/components/SessionLibraryModal.tsx`

[MODIFY] `src/components/SessionLibraryModal.tsx`
- Replace the `.library-list` with `<MelodyLibraryList mode="single" renderDetails={...} renderActions={...} />`.
- Use the `renderDetails` prop to inject `<SessionMiniTimeline session={session} />`.

### `src/components/SessionEditor.tsx` / `MelodyPillList.tsx`

[MODIFY] `src/components/SessionEditor.tsx`
- Replace `<MelodyPillList>` with `<MelodyLibraryList mode="single" showSearch={true} draggable />`.

[DELETE] `src/components/MelodyPillList.tsx`
- Once replaced in `SessionEditor.tsx`, `MelodyPillList` will have no remaining callers and can be safely deleted.

## Open Questions

> [!WARNING]
> **Action Buttons & Mini Timelines**
> The `SessionLibraryModal` injects a `<SessionMiniTimeline>` into each row, and both `LibraryModal` and `SessionLibraryModal` inject custom action buttons (Play, Edit, Delete). The proposed `MelodyLibraryList` API will use render props (e.g., `renderActions?: (item: LibraryEntry) => JSX.Element`) to support this without bloating the core component. Does this approach sound good?
> 
> *User replied:* "the open question approach sounds good also."

## Verification Plan

### Automated Tests
- Run `pnpm test` and `pnpm check` to ensure no typing regressions and that the new component passes linting.

### Manual Verification
- Verify that adding a melody/session to a playlist still works and looks identical.
- Verify that dragging a melody from the `SessionEditor`'s sidebar into the `SessionEditorTimeline` still functions correctly.
- Verify that dragging a melody/session from the `LibraryModal` into a playlist pill still functions correctly.
