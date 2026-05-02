I've reviewed the updated plan and the new extra user story details regarding the core hierarchy: Playlists -> Sessions -> Melodies -> Notes, and how the sidebar (Library Tab) and Editor should interact. I've also written the initial EARS specification for this feature (App/tests/ears/media-library.md) as requested.
Here is a consolidated report of the missing implementation details and architectural issues based on the plans, along with the proposed steps to fix them.
Comprehensive Issue Report & Plan Assessment
1. The Core Hierarchy (Playlists -> Sessions -> Melodies -> Notes)
   •
   Issue: The app currently blurs the lines between these concepts. LibraryModal.tsx calls a list of melody IDs a "Playlist". SessionLibraryModal.tsx calls a sequence of melodies/rests a "Session".
   •
   Fix Strategy: We need to align the codebase to the user story:
   ◦
   Melody: Contains notes. (Current MelodyData)
   ◦
   Session: Contains an ordered list of Melodies and Rests. (Current SavedUserSession / PracticeSession)
   ◦
   Playlist: Contains a list of Sessions. (Currently missing or conflated with Sessions).
2. Sidebar (LibraryTab) Active Session & Melody Selection
   •
   Issue: The user story states: "I click on Melodies in Sidebar, I Create new Melody... That melody should be added to a already selected (Default) session... That Melody should popup in selection list in sidebar... user can select different ones to play or edit."
   ◦
   Currently, clicking "Melodies" opens the LibraryModal which is disconnected from the active session.
   ◦
   The sidebar LibraryTab shows recent items, but doesn't explicitly act as a "Session Explorer" where you clearly see the Active Session and a selectable list of its Melodies.
   •
   Fix Strategy: Refactor LibraryTab.tsx to act as the primary explorer for the Active Session. It should clearly list the melodies inside the active session. Clicking a melody here should set it as currentMelody in the store and load it into the Editor.
3. Creating a New Session
   •
   Issue: The plan states: "Creation of new Session by clicking on Sessions in Sidebar and then button 'New Session' -> Doesn't do anything."
   •
   Fix Strategy: Ensure the handleNewSession function in LibraryTab.tsx and SessionLibraryModal.tsx correctly creates a session, sets it as the active user session in appStore, and saves the ID to localStorage (we partially fixed this in the previous step, but we need to ensure the UI reflects the new empty session immediately).
4. Auto-Assigning New Melodies to the Active Session
   •
   Issue: The plan states: "Create new Melody -> Works. That melody should be added to a already selected (Default) session."
   •
   Fix Strategy: In the "Create Melody" flow (currently hidden in LibraryModal), after melodyStore.createNewMelody() is called, we must automatically append a new SessionItem (of type melody) referencing this new melody ID to the appStore.userSession().
5. Editor Auto-Saving
   •
   Issue: The plan states: "When I put/edit notes into Piano roll editor, they should auto save into a selected melody."
   •
   Fix Strategy: PianoRollCanvas.tsx currently triggers onMelodyChange. In App.tsx, we have a debouncedAutoSave that calls melodyStore.setMelody(melody). This is correctly updating the store, but we need to verify that setMelody is updating the currently selected melody in the library, rather than just the active buffer. (It looks like setMelody in melody-store.ts does handle this, but we'll double check the connection).
6. SessionEditor (Timeline below Piano Roll)
   •
   Issue: As previously identified:
   ◦
   Missing a top-left dropdown to select which Session is being edited.
   ◦
   Missing metadata display (X notes, BPM) on the timeline cards.
   ◦
   Rest duration is hardcoded to 4000ms instead of being configurable.
   ◦
   Missing right-click (onContextMenu) to remove items.
   •
   Fix Strategy:
   ◦
   Add a <select> in SessionEditor.tsx bound to melodyStore.getSessions().
   ◦
   Update SessionEditorTimeline.tsx to display melodyData.items.length and melodyData.bpm.
   ◦
   Add a duration input field or dropdown next to the "Add Rest" zone.
   ◦
   Implement onContextMenu={(e) => { e.preventDefault(); props.onDeleteItem(item.id) }} on the timeline items.
   Action Plan (Step-by-Step Refactoring)
   If you approve, I will execute these changes in the following order to build a cohesive Media Library and Session Editor:
   Phase 1: Sidebar & Active Session Hierarchy (LibraryTab.tsx, melody-store.ts)
1.
Update LibraryTab.tsx to clearly display the Active Session name at the top.
2.
Make the list of melodies under the Active Session act as a selection list (clicking one makes it the active currentMelody loaded into the Editor).
3.
Ensure "New Session" immediately clears the list and sets the new session as active.
4.
Ensure the "Default" session contains a pre-populated melody with notes on first load.
Phase 2: Melody Creation & Auto-Assignment (LibraryModal.tsx, App.tsx)
1.
When a user creates a new melody (via the Modal or a new quick-action in the sidebar), automatically push its ID into the items array of the Active Session.
2.
Auto-select this new melody so it appears in the Editor.
Phase 3: Session Editor Timeline Overhaul (SessionEditor.tsx, SessionEditorTimeline.tsx)
1.
Add the Session Selection Dropdown to the top-left of the SessionEditor header.
2.
Implement the Right-Click (onContextMenu) removal of timeline items.
3.
Render melody metadata (Note count, BPM) on the timeline pill/card.
4.
Add a small input to specify the Rest Duration (in beats or seconds) when adding a Rest.
Let me know if you approve this comprehensive replan, and I will begin the implementation!