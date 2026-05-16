# Jam Session Phase 2 Plan

## 1. Fix Pitch Visibility in Exercise Canvas
**Problem:** The user's pitch and peer pitches are missing or not rendering properly during the Jam Exercise.
**Root Cause Hypothesis:** `jamPitchHistory` might not be getting populated for the local user, or the rendering logic `drawPeerPitchDots` in `JamExerciseCanvas.tsx` is failing due to coordinate mapping or timeline mismatches (e.g. `playheadX` vs timestamp).
**Solution:**
- Ensure `startJamPitchDetection` (in `jam-store.ts`) records local pitch into `jamPitchHistory` alongside broadcasting it.
- In `JamExerciseCanvas.tsx`, verify that the `age` logic for dots correctly maps to the physical canvas, regardless of whether `jamExercisePlaying` is running.

## 2. Shared Precount & Synchronized Start
**Problem:** When the host clicks "Play", the exercise starts instantly, giving peers no time to prepare.
**Solution:**
- Update `playJamExercise` (in `jam-store.ts`). Instead of starting instantly, broadcast an `exercise-prepare` message with a target start time (`Date.now() + 3000`).
- Create a `jamExercisePrecount` signal in `jam-store.ts`.
- In `JamExerciseCanvas.tsx` or `JamPanel.tsx`, display a large 3..2..1 countdown overlay when `jamExercisePrecount` is active.
- After the countdown, `jamExercisePlaying` becomes true and the playhead begins moving simultaneously for all peers.

## 3. Auto-Switch Subtabs
**Problem:** Peers remain on the 'chat' or 'peers' subtab when the host starts an exercise.
**Solution:**
- When receiving the `exercise-prepare` or `exercise-play` message, forcefully update the active subtab in `JamPanel.tsx` to `exercise`.
- I will lift the `activeTab` state out of `JamPanel.tsx` and into `jam-store.ts` (e.g. `jamSubTab` signal) so it can be controlled by incoming WebRTC messages.

## 4. Facebook-Style Chat Widget
**Problem:** Messages go unnoticed if the user is not on the 'chat' subtab.
**Solution:**
- Create a `JamChatWidget.tsx` component that sits fixed at the bottom-right of the `JamPanel`.
- It will only display when `jamSubTab() !== 'chat'`.
- It will show a "bubble" with an unread message badge (number of unread messages).
- When clicked, it expands into a mini-chat window (like Facebook Messenger), allowing users to read and send messages without leaving the Exercise or Peers subtabs.
- I will move the chat list rendering into a reusable `JamChatList` component so it can be shared between the main 'chat' subtab and the mini-widget.

Does this plan accurately reflect what you want? If yes, I will start executing immediately.
