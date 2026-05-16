# Jam Feature UI/UX Improvement Plan

## 1. Fix Auto-Join Behavior (Name Input)
**Problem**: When joining via a URL link (`/#/jam:XYZ`), the app currently auto-joins immediately and assigns the user the name "Anonymous", skipping the name input screen.
**Solution**: 
- Update `JamPanel.tsx` `onMount` effect. Instead of calling `autoJoin(roomId)` instantly, we will check if there's a `jamRoomToJoin` ID.
- If an ID exists, we will pre-fill the "Room code" input and wait in the `idle` state.
- This forces the user to manually type their name before clicking "Join Room", ensuring nobody is forced to be "Anonymous".

## 2. Center the Idle Screen (Layout Fix)
**Problem**: The "Create Room" / "Join Room" view is pushed to the top of the panel, looking disconnected from the center of the viewport.
**Solution**:
- Update `JamPanel.module.css` to add flexbox centering properties specifically to the `.jam-connect` or `idle` wrapper class.
- `display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; max-width: 400px; margin: 0 auto;`

## 3. Beautify Buttons & Inputs (Glassmorphism & Theming)
**Problem**: The inputs and buttons (`.jam-btn`, `.jam-input`) look plain and don't match the rest of the application's premium aesthetic.
**Solution**:
- Update `JamPanel.module.css` to map `.jam-btn` to the app's established glassmorphism patterns (similar to `.crash-btn-primary` or `app.css` buttons).
- Use `var(--accent)`, glows (`var(--accent-glow)`), and subtle semi-transparent backgrounds with borders for inputs.
- Add hover transitions, active states, and focus outlines that match the premium design system.

## 4. Fix Huge Timeline Numbers in SharedPitch
**Problem**: The timeline axis on the bottom of the Shared Pitch Canvas prints out the raw UNIX epoch seconds (e.g. `1716314841s`), causing huge strings of numbers that overlap.
**Solution**:
- In `JamSharedPitchCanvas.tsx`, format the UNIX timestamp to something readable. 
- A simple relative timestamp (e.g., `(sec % 60).toString().padStart(2, '0') + 's'`) or a rolling `MM:SS` format will look much cleaner.

## 5. Improve Jam Exercise Canvas (Match Singing Tab)
**Problem**: The `JamExerciseCanvas.tsx` draws plain rectangles for the melody notes, lacking the polish of the actual `PianoRollEditor` or `SingingCanvas`.
**Solution**:
- Update the `drawMelodyNotes` logic in `JamExerciseCanvas.tsx`.
- Use `var(--note-active)` or the actual color variables used in the Singing Tab for the fill and stroke.
- Add vertical gradients or slightly darker borders to give the notes a pill-like 3D appearance.
- Overlay the note name/lyric inside the note block if it's wide enough.

## 6. General Audit & UX Improvements
- Verify the `disconnect` / `leaveJamRoom` behavior accurately cleans up media tracks.
- Ensure the peer video grid flexes gracefully depending on the number of users connected.
- Add subtle fade-in animations to the canvases when mounting.

Does this plan cover everything you wanted? Once you confirm, I will begin execution immediately!
