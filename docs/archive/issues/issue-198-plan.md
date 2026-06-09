# Issue #198: Remaining Application Issues on dev-testing

## Context

**Issue**: GitHub Issue #198 has 16 sub-issues from initial comment (4320661415) and 7 sub-issues from follow-up comment (4320677535).

**Goal**: Fix all 23 sub-issues one by one, with tests and proper implementation.

**Constraints**:
- Work on dev-testing branch
- Don't force push to override commits
- Each issue fixed separately in its own commit
- Run lint, test, typecheck, build after each fix
- Consult EARS spec where needed
- Write E2E tests for important fixes

---

## Sub-Issues by Priority

### Critical (block main functionality)
1. **#2**: Editor playback corrupted - notes playing without Play button pressed
2. **#3**: Editor playback logic broken (Play → Pause moves 1 bar at a time instead of continuous)
3. **#6**: Playback state not resetting on tab switch (all audio, buttons should reset)
4. **#10**: Editor play mode not stopping previous note when next arrives (audio stacking)
5. **#11**: Mobile - sidebar should auto close when session/playlist playback starts
6. **#7**: Moving between tabs must stop all audio and reset playback state

### High (affect core experience)
7. **#1**: Editor tab sessions button is duplicate - should be removed
8. **#4**: Record button behavior - no sound during recording, Stop button indication needed
9. **#5**: Precount should show 4-3-2-1 then disappear, or 3-2-1-0 then disappear
10. **#5**: Precount metronome sound not playing

### Medium (affect usability)
11. **#8**: Mobile touch drag - SessionEditor timeline items can't be moved on tablet/mobile
12. **#14**: MediaLibrary sidebar - Keep only Presets button, remove Quick Start
13. **#12**: Learn modal - Done button should be added, back button removed from topic view
14. **#13**: Rename "Practice mode" to "Session Mode" in Practice tab button

### Low (UI polish)
15. **#9**: Learn modal "already completed" topic CSS needs improvement
16. **#10**: Learn modal topic text not centered, needs padding/margin
17. **#11**: Learn modal "go back" - modal becomes unusable, tabs broken
18. **#16**: Focus mode - vertical playhead missing, glowing dot missing, need Yousician-style animation
19. **#17**: Settings tab - environment dropdown needs more padding
20. **#18**: Preset Modal - when loading preset, no audio nor playhead animation (empty progress)
21. **#15**: Playlist playback coming soon message shown

### New from Follow-up Comment (7 issues)
22. **#19**: Playlist creation - rename button not needed for new playlist
23. **#19**: Playlist - user should be able to drag/drop sessions into playlist, or multi-select sessions

24. **#20**: Playlist Modal - should close when session/playlist playback starts

25. **#21**: Melody list action buttons behavior needs consistency:
    - Little play button: loads and starts playback immediately (modal closes)
    - Checkmark: loads melody (modal closes)
    - Edit icon: loads melody in Editor tab (modal closes)

26. **#22**: Melody creation - BPM input can't be changed, overwrites to '8', needs better range validation (20-280)

27. **#23**: Melody metadata - tags not visible when clicked, notes show '0' instead of actual notes text

28. **#24**: Remove preset input box - replaced by Melodies, add big + button for creating melodies

---

## Fixed Issues Summary

From git history and code review:
- **#10** (Editor playback corrupted): Partially fixed - commit 17d0789 handles tab switching but there may be residual issues
- **#6** (Playback state reset): Previously addressed in commits related to tab switching
- **#1** (Duplicate sessions button): The sessions button was moved to Practice tab only

Still broken:
- **#2**: Notes still play without Play button in Editor tab
- **#3**: Play/Pause moves 1 bar at a time instead of continuous
- **#7**: Tab switch doesn't fully reset playback state
- **#10**: Audio stacking when notes transition
- **#4**: Record button behavior
- **#5**: Precount UI/text not working correctly
- **#8**: Mobile touch drag in SessionEditor
- **#11**: Sidebar auto-close on mobile playback
- **#14**: Quick Start in MediaLibrary
- **#12**: Learn modal Done button
- **#13**: Practice mode button name
- **#16**: Focus mode vertical playhead/glowing dot
- **#22**: BPM input issues
- **#23**: Melody metadata display
- **#24**: Preset input removal

---

## Implementation Plan

### Phase 1: Core Playback Fixes (Issues 2, 3, 6, 7, 10)
**Files to modify**:
- `src/stores/app-store.ts` - Playback state management
- `src/stores/playback-runtime.ts` - Playback engine
- `src/App.tsx` - Tab switch state handling
- `src/components/SharedControlToolbar.tsx` - Play/Pause/Stop buttons

**Actions**:
1. Fix note stopping behavior - ensure previous note stops before new one starts
2. Fix Play→Pause to pause continuous playback, not step-wise movement
3. Fix Play→Continue to resume from paused position
4. Fix Stop to reset playback to start
5. Ensure tab switch stops all audio and resets all button states

### Phase 2: Editor & Record Fixes (Issues 4, 21, 22, 23, 24)
**Files to modify**:
- `src/components/LibraryModal.tsx` - Melody action buttons, BPM input, notes field
- `src/lib/audio-engine.ts` - Recording audio engine
- `src/stores/melody-store.ts` - BPM validation

**Actions**:
1. Remove duplicate sessions button from Editor tab
2. Fix Record button - no audio during recording, visual Stop indication
3. Fix BPM input - range validation, debounce before validation
4. Fix melody metadata - show tags and actual notes text
5. Remove preset input, add + button for melody creation

### Phase 3: Precount & Audio (Issues 5)
**Files to modify**:
- `src/components/PrecountOverlay.tsx` - Precount UI text
- `src/stores/audio-store.ts` - Precount metronome sound

**Actions**:
1. Precount UI shows 4-3-2-1 then disappears
2. Precount metronome sound playing (tik/tak)

### Phase 4: Mobile & UI Fixes (Issues 8, 11, 9, 10, 11, 13, 17)
**Files to modify**:
- `src/components/SessionEditor.tsx` - Touch drag support
- `src/components/LibraryTab.tsx` - Quick Start removal
- `src/components/LearnModal.tsx` - Done button, CSS polish
- `src/components/MediaLibraryModal.tsx` - Sidebar modal close behavior
- `src/components/PracticeTab.tsx` - Button rename

**Actions**:
1. Add touch drag for SessionEditor timeline items
2. Auto-close sidebar on mobile when playback starts
3. Improve "already completed" topic CSS
4. Fix Learn modal topic text centering and padding
5. Fix modal back navigation
6. Rename "Practice mode" to "Session Mode"
7. Add padding to Settings environment dropdown

### Phase 5: Focus Mode & Playlist (Issues 16, 15, 19, 20, 22)
**Files to modify**:
- `src/components/FocusModeView.tsx` - Vertical playhead, glowing dot animation
- `src/components/PresetsLibraryModal.tsx` - Preloading behavior
- `src/components/PlaylistModal.tsx` - Session drag/drop, close behavior

**Actions**:
1. Add vertical playhead in Focus mode
2. Add glowing dot animation (Yousician-style)
3. Fix preset loading - show playhead and audio
4. Remove playlist rename button for new playlists
5. Implement session drag/drop or multi-select for playlists
6. Close playlist modal when playback starts

### Phase 6: Cleanup (Issues 14, 12)
**Files to modify**:
- `src/components/LibraryModal.tsx` - Quick Start removal
- `src/components/LearnModal.tsx` - Done button addition

**Actions**:
1. Remove Quick Start from MediaLibrary sidebar
2. Add Done button to Learn modal topic view

---

## Verification Strategy

For each fix:
1. Run `npm run lint` - check for code style issues
2. Run `npm run test -- --run` - check unit tests
3. Run `npm run typecheck` - check TypeScript
4. Run `npm run build` - ensure production build works
5. Run dev server: `pkill -f "vite"; npm run dev &`
6. Manually test the specific issue

For E2E tests:
- Add Playwright E2E tests for: Playback state, Record behavior, Precount, Mobile drag, Focus mode
- Test coverage should exceed 80% for modified areas

---

## Files by Category

### Playback Core
- `src/stores/playback-runtime.ts`
- `src/stores/app-store.ts`
- `src/stores/audio-store.ts`
- `src/lib/piano-roll.ts`
- `src/stores/melody-engine.ts`

### UI Components
- `src/components/SharedControlToolbar.tsx`
- `src/components/LibraryModal.tsx`
- `src/components/LibraryTab.tsx`
- `src/components/SessionEditor.tsx`
- `src/components/PrecountOverlay.tsx`
- `src/components/FocusModeView.tsx`
- `src/components/PresetsLibraryModal.tsx`
- `src/components/PlaylistModal.tsx`
- `src/components/LearnModal.tsx`

### Pages/Tabs
- `src/App.tsx` - Tab switch handling
- `src/components/PracticeTab.tsx`
- `src/components/EditorTab.tsx`

### Stores
- `src/stores/melody-store.ts` - BPM validation, melody actions
- `src/stores/session-store.ts` - Session playback
- `src/stores/app-store.ts` - Playback state

---

## Testing Priority

**High Priority (must have E2E tests)**:
1. Playback state reset on tab switch
2. Play/Pause/Continue/Stop behavior
3. Record button no-audio behavior
4. Mobile touch drag in SessionEditor
5. Precount UI and metronome sound
6. Focus mode playhead animation

**Medium Priority**:
7. Melody action buttons
8. BPM input validation
9. Playlist session drag/drop
10. Learn modal Done button

**Low Priority**:
11. UI polish (padding, CSS)
12. Preset loading display