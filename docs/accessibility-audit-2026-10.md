# Accessibility audit, October 2026: Section 508 / WCAG 2.0 AA

An initial audit of the MercuryPitch web app against Section 508. The goal is to make the app usable by blind and low-vision people, and above all to let them choose a song and sing karaoke in it. This report feeds a separate pull request of fixes. It ranks what to fix first and gives the smallest fix for each item.

Line numbers refer to `main` at `be03c22`.

**Fixed in the pull request that added this report:**

- Item 2: the Zen / phone stage is a named dialog. The page it covers is inert, the toasts drawn above it stay live, and focus goes in and comes back to the Zen button.
- Item 3: the score card is drawn above the Zen stage.
- Item 5: the spotlight tour is a dialog that takes the focus, announces each step, and no longer restarts on Enter.

`src/e2e/stage-and-tour-focus.spec.ts` holds all three, and the axe baseline for the Zen stage dropped from 2 to 1.

## Summary

**Where the app stands.** Section 508's Revised Standards (36 CFR 1194, E205.4) incorporate WCAG 2.0 Level A and AA. Against that bar, the app has a good base and a few large gaps.

The base:

- Native sliders for the song position and the stem faders, with spoken values.
- Named icon buttons.
- Menus that follow the ARIA menu pattern.
- A solid shared focus trap.
- A skip link and landmarks.
- A visible global focus ring.
- `prefers-reduced-motion` handled almost everywhere.

axe-core reports little. The gaps it cannot see are what stop a blind singer:

- **the lyrics**, where the line being sung is only a visual highlight;
- **the full-screen stages and dialogs**, which do not take, hold or return focus;
- **the live pitch feedback**, which exists only on a canvas or in colour.

**The changes that would most help someone sing without sight, in order:**

1. **Make the Zen / phone karaoke stage behave like a modal surface.** Make the app behind it `inert`, give the stage a name and a heading, move focus into it, and give focus back when it closes. Also draw the score card above the stage; today it opens invisibly behind it and still takes the focus (re-run and confirmed).
2. **Expose the lyrics.** Mark the sung line with `aria-current`, add an opt-in "Read lyrics aloud" live region that speaks each next line just ahead of time, and add a key that speaks the current and next line on demand.
3. **Manage focus at every view change.** On opening a song, Back, pasting lyrics, entering or leaving Zen or Focus mode, and in the tours and the Learn, Guide and Danger Zone dialogs, focus currently falls to `<body>`.
4. **Give pitch feedback a non-visual channel.** A key that speaks the target and sung note with cents, an opt-in per-line summary, and a non-colour cue on the Zen pitch dot.
5. **Make the remaining controls work with keys and speech.** The guide-vocals pill as a real slider, value text on the Zen scrubber, Space no longer stealing focused buttons, and keyboard access to the lyrics file picker.

## Scope and method

- **Areas, all in headless Chromium against a production build:**
  - Karaoke song library and the desktop stem mixer;
  - the Zen stage, its sheets, the score dialog and the Karaoke Night page;
  - the app shell, navigation, Home, the guides and toasts;
  - Settings, the account dialog and every form;
  - contrast, all nine theme presets, focus visibility, motion, reflow, zoom and target size.
- **Viewports:** 1280x800, 1440x900 and 390x844 with touch; also 320 px wide, 640x400 (200% zoom), text at 200%, forced colors and the low performance tier.
- **Tools:**
  - axe-core 4.14 with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `section508`;
  - keyboard traces (focus recorded after every key);
  - the accessibility tree (Playwright `ariaSnapshot`);
  - pixel contrast sampling where axe could not judge text over photographs;
  - a source read of every component cited.
- **Agents:** one auditor per area. Several auditors found the same problems independently; those items are marked **cross-confirmed**. The planned independent verification pass did not run, because the run hit its time limit. Instead, I re-ran the highest-stakes single-auditor claims myself; those are marked **re-run**. Everything else is **single auditor**: real evidence, but not yet reproduced by a second agent.
- **Not covered:** the Singing practice, exercises, Ear Lab and voice-control area. Its auditor gathered raw data but did not finish, so its axe totals are in the appendix with no analysis. Voice control may be the strongest tool a blind user has here, and it deserves its own pass.
- **Limits:**
  - No real screen reader or device was used. Before shipping the fixes, do manual passes with NVDA and Chrome, VoiceOver and Safari on macOS and iOS, and TalkBack and Chrome on Android.
  - Audio was not judged by ear.
  - Karaoke Night's demo audio and LRCLIB search need the network, so they were blocked and only partly audited.

## Findings by priority

- **P0** stops a screen-reader or keyboard user from choosing and singing a song.
- **P1** is a serious barrier.
- **P2** is moderate.
- **P3** is minor or polish.

Each item names its WCAG 2.0 criterion, which makes it a Section 508 requirement through E205.4. WCAG 2.1 and 2.2 items are recommendations and are labelled as such.

### P0: blocks singing

**1. Synced lyrics: the line being sung is only a visual highlight.**
WCAG 1.3.1 Info and Relationships (A), 4.1.2 Name, Role, Value (A). Cross-confirmed (mixer and Zen auditors).

- **Where:**
  - Mixer lyrics panel: `src/components/StemMixerLyricsPanelBody.tsx:964-976, 1075, 1129-1166`.
  - Zen stage: `src/components/KaraokeMobileStage.tsx:986-1093`.
- **What a user gets:** the lyrics are real text but read as one run, for example "0:01 First line 0:04 Second line…". Nothing marks the current line or word. There is no live region, and no role or `aria-current` on any line. Sampled six times during playback, the accessibility tree was identical whether the song was stopped or playing. A blind or deafblind singer cannot follow the song.
- **Smallest fix:**
  1. Render the lines as a list (`ol` with `aria-label="Lyrics"`) and set `aria-current="true"` on the sung line.
  2. Add an opt-in "Read lyrics aloud / to braille" switch to the mixer's settings and Zen's More sheet, off by default so it never talks over the music. When on, write each next line into a visually hidden `aria-live="polite" aria-atomic="true"` region at its lead-in, once per line and never per word.
  3. Add a key, for example R, that speaks the current and next line.
  4. Mark the per-line timestamps `aria-hidden`.
- **Effort:** medium.

**2. The Zen / phone karaoke stage covers the app but the app stays live behind it.**
WCAG 2.4.3 Focus Order (A), 1.3.2 Meaningful Sequence (A), 2.4.7 Focus Visible (AA). Cross-confirmed (Zen and visual auditors) and re-run.

- **Where:** `src/components/mobile/StageShell.tsx:32-46` (body portal, no role, `#app` not inert); the song title is a `<p>` at `KaraokeMobileStage.tsx:750`.
- **What a user gets:** on a phone, Zen is where songs are sung. Before reaching the stage, a screen reader meets 22 or more invisible items: the header, the tab bar and the off-screen sidebar. The stage itself has no heading or landmark. On a desktop, the first Tab reaches "Turn voice control on (V)" behind the stage. After the stage's own 15 controls, focus goes to `<body>` and then to the skip link, logo and tabs, all hidden under the stage. A press of Enter there can leave the song. Re-run result: `#app.inert === false`.
- **Smallest fix:** while `StageShell` is mounted, set `inert` on `#app`; a counted hook like `useScrollLock` fits, and sheets portalled to `<body>` keep working. Give the shell `role="dialog" aria-modal="true"` (or a named region) labelled by the song title, and render the title as a heading. Focus the stage's first control on open, and return focus to the Zen button on close.
- **Effort:** small.

### P1: serious barriers

**3. The score card opens invisibly behind the Zen stage and takes the focus.**
WCAG 2.4.7 (AA), 2.4.3 (A). Re-run. This is a visual bug for every user, not only an accessibility one.

- **Where:** `src/components/StemMixer.tsx:2768-2776` renders `StemMixerScoreModal` in the app tree beside the stage. Its `.sm-mic-score-overlay` (position absolute, z-index 100) sits under the stage portal (`--z-stage: 450`).
- **What a user gets:** after singing with the mic on in Zen, the default on phones, nothing appears. Focus is on an invisible "Close score". Space no longer plays because the dialog isolates the keys, and only Escape gets out. Re-run on desktop: the point at the dialog's centre is the stage's lyrics drop zone, and `activeElement` is "Close score".
- **Smallest fix:** in the Zen branch, portal the score modal to `<body>` with `position: fixed` and `z-index: calc(var(--z-stage) + 20)`, or render it inside the stage.
- **Effort:** small.

**4. Focus falls to `<body>` at every view change on the way to singing.**
WCAG 2.4.3 (A). Cross-confirmed (mixer, Zen and forms auditors).

- **Where:**
  - `UvrSessionResult.tsx:851-877` (View Results);
  - `UvrResultViewer.tsx:1088-1093` (Play full mix);
  - `stem-mixer/header/MixerHeader.tsx:162-174, 310-329` (Back, Zen, Focus);
  - `LyricsUploader.tsx:89-110, 175-231` (Paste lyrics, Use these lyrics);
  - the Focus-mode Escape at `StemMixer.tsx:514-524`;
  - Karaoke Night staging at `features/karaoke-night/KaraokeNightApp.tsx:662-745, 893-911`.
- **What a user gets:** silence. The next Tab starts at the top; the mixer's Play button is the 46th stop. A screen-reader user is never told that the mixer loaded or that the lyrics arrived.
- **Smallest fix:**
  - When the mixer opens, focus the song-title heading (`tabindex="-1"`) and announce "<song> loaded" in a polite region.
  - On Back, focus the song's card.
  - When the paste area opens, focus its textarea. After "Use these lyrics", focus the lyrics heading and announce the number of lines.
  - Entering a mode focuses its first control; leaving it returns focus to the button that opened it.
- **Effort:** medium.

**5. Spotlight tours are not dialogs, never take focus, and Enter restarts the mixer tour.**
WCAG 4.1.2 (A), 2.4.3 (A); 4.1.3 Status Messages (2.1 AA, recommendation). Single auditor; the Enter restart was re-run.

- **Where:** `src/components/Walkthrough.tsx:660-790` (tooltip with no role); keydown handler at `152-182`, whose early return for BUTTON is at `175`.
- **What a user gets:** pressing Tour is silent. Focus stays on the Tour button behind the overlay, steps change without being announced, and Tab walks the hidden page. Re-run: at step 2 of the mixer tour, Enter, the documented "next" key, re-pressed the focused Tour button behind the overlay and restarted the tour at step 1.
- **Smallest fix:**
  1. Give the tooltip `role="dialog" aria-modal="true"`, with `aria-labelledby` on the title and `aria-describedby` on the text.
  2. Run the existing `useFocusTrap` with `onClose: endWalkthrough`, so focus enters, cycles, closes on Escape and returns.
  3. On each step, move focus to the step title (`tabindex="-1"`), or write "Step 2 of 13: Transport and seek" into a polite region.
  4. In the keydown handler, let only buttons inside the tooltip keep their own Enter.
- **Effort:** medium.

**6. The Learn list, a Learn chapter and the Guide dialog lack dialog semantics and focus management.**
WCAG 4.1.2 (A), 2.4.3 (A). Single auditor; re-run for Learn.

- **Where:** `WalkthroughSelection.tsx:35-156`, `WalkthroughModal.tsx:177-411`, `GuideSelection.tsx:80-233`, mounted from the header at `WalkthroughControl.tsx:40-54`.
- **What a user gets:** opening any of them is silent. Focus stays on the Learn or Guide button behind the blurred overlay, and Tab walks the hidden page. Escape on the Learn list works only once focus has reached the card. Re-run: no element with `role="dialog"`, and focus stays on "Learn".
- **Smallest fix:** add `role="dialog" aria-modal="true" aria-labelledby` (the h2) and `useFocusTrap`, and delete the three ad-hoc Escape listeners. Give finished chapters visually hidden "completed" text, and give `.walkthroughText` `tabindex="0"` and a label so it scrolls by keyboard.
- **Effort:** small.

**7. Live pitch feedback reaches no assistive technology, and the Zen pitch dot is colour-only.**
WCAG 1.1.1 Non-text Content (A), 1.3.1 (A), 1.4.1 Use of Color (A). Cross-confirmed (mixer and Zen auditors).

- **Where:**
  - `StemMixerFixedWorkspace.tsx:584-595, 666` (pitch canvas);
  - `:564-569`, `:130-133` (waveform canvases);
  - `ZenPitchRibbon.tsx:33-38, 232-244` (green for on the note, rose for off; the label itself says "green means you are on the note").
- **What a user gets:** while singing, the target notes, the sung line and the current-note badge exist only in a canvas. A blind singer learns how they did only from the score at the end, which Zen hides (item 3). A colour-blind singer must tell green from rose.
- **Smallest fix:**
  - Set `aria-hidden="true"` on the two waveform canvases; the slider already says where the song is.
  - Give the pitch canvas `role="img"` and a label.
  - Add a key that speaks "Target A3, you A3, 12 cents sharp".
  - As an opt-in, add a polite per-line summary ("Line 2: 82 percent in tune, mostly flat").
  - Draw a sharp or flat chevron and an on-note ring on the Zen dot, and drop the colour from its label.
  - Consider an optional audio cue.
- **Effort:** large overall; the `aria-hidden` and the labels are small.

**8. On phones, the closed sidebar drawer stays in the tab order and the accessibility tree.**
WCAG 2.4.3 (A), 2.4.7 (AA), 4.1.2 (A). Single auditor.

- **Where:** `AppSidebar.module.css:22-60` moves it off-canvas with `left: -270px` and never hides it; the Menu button at `App.tsx:3303-3315` has no `aria-expanded` or `aria-controls`.
- **What a user gets:** on every phone screen, 33 off-screen controls come before the page content. A keyboard user's focus vanishes off the left edge. Opening the drawer leaves focus on Menu.
- **Smallest fix:** at 768 px or below, set `inert` and `visibility: hidden` (after the slide) on the closed drawer. When it is open, make it `role="dialog" aria-modal="true" aria-label="Menu"` with `useFocusTrap`. Add `aria-expanded` and `aria-controls` to Menu.
- **Effort:** medium.

**9. The lyrics file picker "Drop a .lrc or .txt, or browse" cannot be reached by keyboard. Other file pickers share the bug.**
WCAG 2.1.1 Keyboard (A). Cross-confirmed by three auditors.

- **Where:** `LyricsUploader.tsx:150-173` (`<input type="file" hidden>` inside a label). The same pattern is in `UvrStemUploadControl.tsx:134-151` (Choose vocal or instrumental stem), `UvrPanel.tsx:2640-2654` (ZIP import) and `UvrSessionResult.tsx:763-802` (add or replace a stem).
- **What a user gets:** it reads as plain text and is not a tab stop. On the phone layout it is the only way to load a lyrics file. Paste lyrics and the desktop toolbar's "Load LRC / TXT file" button do still work.
- **Smallest fix:** keep each input focusable but visually hidden (an sr-only class), and draw the ring on the label with `:focus-within`. Alternatively, add a real button that calls `input.click()`. Name each one, for example "Choose a lyrics file".
- **Effort:** small.

**10. Zen lyrics: the next line and the sung lines fall below contrast minimums.**
WCAG 1.4.3 Contrast (Minimum) (AA). Cross-confirmed (Zen and visual auditors, pixel-sampled in all nine presets).

- **Where:** `KaraokeMobileStage.module.css:211-231, 306`.
- **What a user gets:** the current line passes (about 20:1). The next line, which a low-vision singer needs in order to read ahead, is 2.77-2.87:1. Sung lines are 1.32:1, against 3:1 required for this large text. The same holds on phones and on the low tier.
- **Smallest fix:** raise `.line` to alpha 0.5 (about 4.8:1), drop the 0.5 opacity on `.line.past` and use alpha 0.4 or more, raise the current line's unsung words to about 0.7, and keep the fade mask off the next line. Add a scrim behind the lyric column for brighter user-chosen stages.
- **Effort:** small.

**11. The Danger Zone confirm box is not a dialog.**
WCAG 4.1.2 (A), 2.4.3 (A). Single auditor.

- **Where:** `SettingsPanel.tsx:2107-2178`, triggered at `2024-2094`.
- **What a user gets:** pressing Clear announces nothing and focus stays on the trigger. To reach Cancel or confirm, the user tabs past three more destructive buttons, each of which silently changes what will be wiped. Escape does nothing. Cancel drops focus.
- **Smallest fix:** `role="alertdialog" aria-modal="true"` with labelling, `useFocusTrap` with initial focus on Cancel, Escape mapped to Cancel, and the page inert behind it. Announce progress with `role="status"`.
- **Effort:** small.

### P2: moderate

| #   | Finding                                                                                                                                                              | WCAG                            | Where                                                                                                                                                          | Smallest fix                                                                                                                                            | Checked                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 12  | Space plays or pauses even when a button has focus, so it never presses Mute, Solo, menus or Zen buttons (Enter does)                                                | 2.1.1 related                   | `src/lib/space-playback.ts:64-78`; `StemMixer.tsx:2435-2447`                                                                                                   | Ignore Space when the target is or is inside a button, link, `summary` or an element with role button, menuitem, radio, tab, checkbox, switch or option | Cross-confirmed                        |
| 13  | The guide-vocals pill announces an inverted pressed state, and its level can only be set by dragging                                                                 | 4.1.2, 2.1.1                    | `mobile/PillControl.tsx:153`; `KaraokeMobileStage.tsx:1096-1108`                                                                                               | Make it a slider like the music-level pill (`keyStep` 0.05, value text "Muted" or "80 percent"), with Enter toggling mute                               | Single                                 |
| 14  | The Zen scrubber exposes raw float seconds with no value text and updates every frame                                                                                | 4.1.2                           | `mobile/Scrubber.tsx:74-84`; `shared/drag-gesture.ts:91-98`                                                                                                    | Value text "0:12 of 3:45"; `aria-valuenow` floored to whole seconds                                                                                     | Single                                 |
| 15  | Tap-a-line-to-jump is mouse and touch only                                                                                                                           | 2.1.1                           | `KaraokeMobileStage.tsx:986-994`                                                                                                                               | One roving-tabindex lyrics list: Up and Down move, Enter seeks; auto-follow never moves focus                                                           | Single                                 |
| 16  | Toggle state is shown only by colour or class: the pitch toolbar's six toggles, Sing / Upload, stem pills, Recent Sessions                                           | 4.1.2                           | `PitchCanvasToolbar.tsx:33-183`; `UvrPanel.tsx:2353-2382, 2576-2593`; `UvrSessionResult.tsx:649-756`                                                           | `aria-pressed` with a constant name; `aria-expanded` on Recent Sessions                                                                                 | Single                                 |
| 17  | Mixer panels have no headings or named regions; the stem aside is an unnamed landmark                                                                                | 1.3.1, 2.4.6                    | `StemMixerFixedWorkspace.tsx:130-737`                                                                                                                          | h3 panel titles, regions labelled by them, `aria-label="Stem controls"`                                                                                 | Single                                 |
| 18  | "Choose what you perform" opens the song on the first arrow key                                                                                                      | 3.2.2 On Input                  | `PlayAlongSelect.tsx:53-58`                                                                                                                                    | Use a menu of menuitemradio rows, or commit only on Enter or blur                                                                                       | Single                                 |
| 19  | The Songs drawer keeps focus on its button, opens 44 Tab stops away and ignores Escape; the Stage popover does not take focus                                        | 2.4.3                           | `MixerHeader.tsx:236-277`; `KaraokePlaylistSidebar.tsx:86-104`                                                                                                 | Focus the drawer on open, Escape closes it and returns focus, `aria-expanded`, a DOM order after the header                                             | Single                                 |
| 20  | Changing tabs changes neither the document title nor anything announced; several tabs have no h1                                                                     | 2.4.2, 1.3.1                    | `App.tsx:1220-1238`; hash router                                                                                                                               | Per-route `document.title`, a polite "Karaoke" announcement or focus on the view's h1, one h1 per tab, `aria-label="Main"` on the nav                   | Single                                 |
| 21  | On desktop the first Tab skips the skip link, because the active nav tab is `scrollIntoView`ed                                                                       | 2.4.1, 2.4.3                    | `AppNavTabs.tsx:416-429`                                                                                                                                       | Scroll the strip (`navRef.scrollTo`) instead of the element                                                                                             | Single (controlled experiment)         |
| 22  | Action toasts (Undo, Open, Start tour) vanish after 10 s with no pause, 65 Tab stops away; status toasts may not be announced                                        | 2.2.1; 4.1.3 (2.1)              | `Notifications.tsx:55-125`; `notifications-store.ts:124-129, 278-286`                                                                                          | Persistent live regions mounted at start; pause on focus or hover; keep action toasts until dismissed                                                   | Cross-confirmed                        |
| 23  | Sidebar Display toggles (Ball, Playhead, Grid, Notes, Stats, Pitch) are unlabelled checkboxes with no visible focus                                                  | 1.3.1, 4.1.2, 2.4.7             | `features/sidebar/panels/DisplayPanel.tsx:16-97`; `app.css:939-944`                                                                                            | Put the label text inside the label (or add `aria-label`); `input:focus-visible + .settings-slider { outline }`                                         | Cross-confirmed (axe critical x6)      |
| 24  | Desktop sidebar collapse button is invisible when focused and has no state                                                                                           | 2.4.7, 4.1.2                    | `AppSidebar.tsx:54-74`; `AppSidebar.module.css:142-160`                                                                                                        | `:focus-visible { opacity: 1 }`, `aria-label`, `aria-expanded`                                                                                          | Single                                 |
| 25  | Crash modal does not take focus, and "Reset App Data" wipes everything without confirming                                                                            | 2.4.3; 3.3.4                    | `CrashModal.tsx:151-158, 326-344`                                                                                                                              | `useFocusTrap` with focus on Reload; put Reset behind `ConfirmDialog`                                                                                   | Single                                 |
| 26  | White-on-#58a6ff buttons at 2.52:1 ("Use these lyrics", "Got it", "Next", "Reload App"); destructive buttons at 3.54:1                                               | 1.4.3                           | `.lu-btn--primary`, `.wsCloseFooter`, `.walkthroughNavBtnNext`, `.crashBtnPrimary`, `.dangerBtnPrimary`                                                        | Dark text (#0d1117, about 7.5:1) on #58a6ff, or #1f6feb with white; #c62828 for danger                                                                  | Cross-confirmed (axe)                  |
| 27  | Light preset (and a few labels in dark presets) colour text with `--accent` instead of the readable `--accent-text`                                                  | 1.4.3                           | `SongStatusBar.module.css:363`, `MicSensitivitySlider.module.css:19,63`, `HomePage.module.css:56`, `DestinationGallery.module.css:6,27`, `.header-melody-char` | Use `var(--accent-text)` for text; give `--dest-aqua` a light-theme value                                                                               | Single (axe and pixels)                |
| 28  | Focus lands on controls that are never drawn (hover-only "Delete group"); the focus ring is clipped in scroll containers (song rows at 1.8:1, Daily Practice header) | 2.4.7                           | `SessionGroupTabs.module.css:82-110`; `uvr.css:4820-4845`; `KaraokeRail.module.css:13-45`; `DailyRoutinePanel.module.css:1-20`                                 | Reveal on `:focus-visible` / `:focus-within`; draw rings inside with `outline-offset: -2px`                                                             | Single (pixel diff)                    |
| 29  | With text at 200%, the mixer's lyrics and pitch toolbars run out of reach and tabbing slides the lyrics sideways                                                     | 1.4.4 at risk; 1.4.10 (2.1)     | `.sm-panel-header`, `.pitch-canvas-toolbar`, `.sm-lyrics-toolbar` in `StemMixer.tsx`; px font sizes in the header and rail modules                             | `flex-wrap` on panel headers (or fold into More), `overflow-x: clip` on panels, rem font sizes                                                          | Cross-confirmed                        |
| 30  | Settings section tabs announce as tabs but have no panels and ignore arrow keys                                                                                      | 4.1.2, 1.3.1                    | `SettingsPanel.tsx:314-393`                                                                                                                                    | Complete the tabs pattern, or use plain buttons in a labelled nav with `aria-current`                                                                   | Single                                 |
| 31  | Settings sliders expose raw numbers with no units; two differ from what is on screen (Speed "125" for 1.25x, Threshold "6" for 0.06)                                 | 4.1.2                           | `SettingsPanel.tsx:828-899, 1179-1245, 1828-1845, 1878-1893`                                                                                                   | `aria-valuetext` matching the visible value                                                                                                             | Single                                 |
| 32  | The Font Family select opens an unnamed "Reload Required" modal on the first arrow key; focus never enters it                                                        | 3.2.2, 2.4.3, 4.1.2             | `SettingsPanel.tsx:1464-1480, 2492-2522`                                                                                                                       | An "Apply font" button; a labelled, focus-trapped dialog                                                                                                | Single                                 |
| 33  | Sign-up password rules show met or unmet by colour only and are not tied to the field; a failed Create account drops focus                                           | 1.4.1, 1.3.1, 3.3.1, 2.4.3      | `account/PasswordRequirements.tsx:24-31`; `AuthModal.tsx:1020-1134`                                                                                            | State in text, `aria-describedby`, focus the first invalid field                                                                                        | Single                                 |
| 34  | Paste-lyrics form: textarea named only by its placeholder; errors and success not announced                                                                          | 3.3.2, 3.3.1, 4.1.3 (2.1)       | `LyricsUploader.tsx:175-248`                                                                                                                                   | A label, `role="alert"` errors with `aria-describedby`, a polite "Lyrics added"                                                                         | Cross-confirmed                        |
| 35  | Jam lobby: Join and Create drop focus and announce nothing; the code rule lives only in the placeholder                                                              | 2.4.3, 3.3.1, 3.3.2             | `jam/JamPanel.tsx:361, 483-527, 1072-1074`                                                                                                                     | A hint tied to the field, inline `role="alert"` errors, focus on the room heading                                                                       | Single                                 |
| 36  | Karaoke Night sign-in modal is not a dialog; the playlist "ready / countdown" and "Playlist Complete" overlays are not dialogs and the countdown is silent           | 4.1.2, 2.4.3                    | `karaoke-night/KaraokeAccount.tsx:187-205`; `KaraokePlaylistOverlay.tsx:64-100`; `KaraokePlaylistSummary.tsx:59-64`                                            | `role="dialog"` with labelling and `useFocusTrap`; announce "Starting in 3"                                                                             | Single (the overlays from source only) |
| 37  | Windows High Contrast (forced colors): the current lyric line, the word sweep, slider tracks and selected states disappear                                           | recommendation (1.4.1 / 1.4.11) | Zen stage, mixer lyrics, sliders; `ThemePicker.module.css` box-shadow focus rings                                                                              | `@media (forced-colors: active)` rules; `outline: 2px solid transparent` beside box-shadow rings                                                        | Single (emulation)                     |

### P3: minor

- **Score dialog** (`StemMixerScoreModal.tsx:87-185`): doesn't describe its result on open, and three decorative SVGs are unnamed images (1.1.1). Add `aria-describedby` on the verdict and `aria-hidden` on the icons.
- **A and B loop buttons:** no state change is announced when a mark is set. Single-letter shortcuts (A, B, S, L, M) cannot be turned off (2.1.4 is a WCAG 2.1 recommendation). See `MixerCapsule.tsx:282-307` and `StemMixer.tsx:2449-2497`.
- **Unclear names:** "A−" and "A+" lyric size, the results page's lone "Play" (full mix), and stem pills read as "Vocal 4:06" (2.4.6).
- **Label in Name** (2.5.3, WCAG 2.1): the version pill ("v0.9.21" vs "Show the changelog") on every screen, Zen's "KEY 0", the Home cards and the phone room links.
- **Karaoke Night credits toggle** (`KaraokeNightApp.tsx:930-955`): contains a link (axe `nested-interactive`).
- **Desktop overflow menus** (`AppNavOverflowMenu.tsx:103-123`): Tab inside one drops focus to `<body>` while the menu stays open.
- **Phone More sheet:** no close control a touch screen reader can reach, and More has no `aria-expanded`.
- **Phone stage-background drawer:** looks modal but Tab walks out of it.
- **Home streak card:** reads an unlabelled number, and the card titles are not headings.
- **Desktop mixer lyric auto-scroll** (`useLyricsScrollController.ts:164`): still glides with reduced motion (2.3.3 is AAA, recommendation).
- **Small touch targets** on Home and the Karaoke tab: 20 px info buttons, a 22 px notification close (2.5.8 is WCAG 2.2, recommendation).
- **Upload terms link:** told apart only by colour (1.4.1, axe `link-in-text-block`). Cross-confirmed.
- **Zen labelling:** the sheet is named only "More"; there is no current-song marker in the song list; A and B times aren't tied to their buttons; time readouts are unlabelled.
- **Settings:**
  - help text under controls is not tied to them with `aria-describedby`;
  - "Quality" should read "Graphics quality";
  - Danger Zone buttons are named only "Clear", "Clear", "Delete", "Reset";
  - the custom radio groups ignore arrow keys;
  - the 2FA code field is labelled only by its placeholder (code reading, signed-in only).

## Making karaoke work without sight: build order

1. **The stage is a place you can be in.** Make the app inert behind Zen and the phone stage; give the stage a named dialog or region, a heading, and focus in and out (item 2). Draw the score above the stage (item 3). After this, a keyboard or screen-reader user no longer gets lost behind the screen they are singing on.
2. **Every view change says where you are.** Apply the focus rules of item 4, and announce "<song> loaded", "Lyrics added, 42 lines" and "Loop start set at 0:12" through one persistent polite region mounted at start, which also fixes the toast problem (item 22).
3. **The lyrics are followable.**
   - `aria-current` on the sung line and a roving-tabindex list for jumping (items 1 and 15).
   - An opt-in "Read lyrics aloud" mode. Speak each next line at its lead-in, once per line, never per word. Polite, so it never interrupts the singer's own screen reader, and off by default so it never talks over the music.
   - A key to speak the current and next line on demand.
   - Contrast on the next line (item 10).
4. **The controls answer keys and speech.**
   - The guide-vocals pill becomes a slider (item 13).
   - The scrubber says "0:12 of 3:45", at most once a second (item 14).
   - Space leaves focused buttons alone (item 12), with an option to turn the letter shortcuts off.
   - A shortcuts list in the help.
   - The lyrics file picker becomes keyboard-reachable (item 9).
5. **Pitch feedback without the canvas.** A key that speaks the target, the sung note and the cents; an opt-in per-line summary; a non-colour cue on the Zen dot; an optional in-tune audio cue (item 7).
6. **Voice control.** It already exists: a "Mercury" wake word while music plays, Shift+V for the command list, and a docked pill. It may be the most valuable tool for a blind singer, and it was the one area this audit did not finish. Audit it next, and route its spoken confirmations through the same polite region.

## axe-core in the build

- `axe-core` (4.14) is now a dev dependency.
- `src/e2e/accessibility-axe.spec.ts` runs it in the existing Playwright suite, with the same tags as this audit (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `section508`), on Home, Singing, the Karaoke library, the stem mixer with a song, the Zen stage, Settings and the phone Home.
- It compares each screen's violations, rule by rule, with `src/e2e/accessibility-axe.baseline.json`. A new rule, or more nodes for a known rule, fails the spec; a lower count passes. After a fix, lower the baseline by running the spec with `AXE_UPDATE_BASELINE=1`.
- axe catches roughly a third of these findings. The keyboard and announcement items above need the manual screen-reader passes listed under Limits, and specs of their own as they are fixed: assert focus after each view change, `aria-current` on the sung line, `inert` behind the stage.
- A lint-level check can come later. `eslint-plugin-jsx-a11y` works on Solid's JSX for rules such as `label-has-associated-control`, `alt-text` and `no-static-element-interactions`, but it assumes React names (`className`, `htmlFor`) in places; trial a small rule set before adopting it.

## Appendix A: what each area does well (keep it)

- **Mixer:**
  - Song position is a native range with `aria-valuetext` "0:12 of 0:30": arrows move 5 s, Page Up and Down a tenth of the song, Home and End go to either end, and the seek lands on key-up.
  - Stem faders are named ranges ("Vocal volume", "75 percent"). Mute and Solo have `aria-pressed`, and each stem sits in a named group.
  - The More, Speed and Layout menus follow the menu pattern. The Key dialog is a real dialog with a status region.
  - `ReasonHold` explains disabled controls through `aria-describedby`.
- **Zen:**
  - Every stage control is named, with a visible ring.
  - The More, Songs and Key sheets are proper modals (`Sheet` with `useFocusTrap`).
  - The music-level pill is a model slider.
  - The More sheet's switches, radiogroup and status messages are right.
  - The lyrics are real DOM text, decorative glyphs are hidden, and auto-scroll honours reduced motion.
- **Karaoke Night:** lang, title, landmarks, an h1, and a proper "Add music" dialog.
- **App shell:**
  - The skip link works and is the first stop on phones; landmarks and `lang` are set.
  - Nav buttons are named with `aria-current="page"`, and the overflow menus follow the menu pattern.
  - `StaleBuildRecovery` is a `role="alert"`, there is a global `:focus-visible` ring, and reduced motion is handled.
  - `useFocusTrap` is solid and ready to reuse.
- **Forms:** the sign-in dialog is a model (dialog semantics, focus on Email, trap, Escape, focus return, `role="alert"` errors with `aria-invalid` and `aria-describedby`, correct autocomplete tokens). Every Settings control has a programmatic label, and the switches are native checkboxes with a visible ring.
- **Visual:**
  - The dark presets pass almost everywhere, and karaoke surfaces use the dark-stage palette.
  - The low tier costs no contrast.
  - Reflow at 320 px is clean.
  - The phone karaoke stage has no target under 44 px.
  - A and B loop marks carry letters, not just colour.

## Appendix B: per-screen axe results (rule, impact, nodes)

| Screen                                     | Violations                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Home 1280                                  | label-content-name-mismatch (serious) 4                                                      |
| Home 390                                   | label-content-name-mismatch 1                                                                |
| Singing 1280                               | label (critical) 6, color-contrast (serious) 1, label-content-name-mismatch 1                |
| Singing "Songs" picker (raw, unanalysed)   | button-name (critical) 1, label 6, color-contrast 1, label-content-name-mismatch 1           |
| Karaoke library 1280                       | link-in-text-block (serious) 1, label-content-name-mismatch 1                                |
| Stem mixer 1280 / 1440                     | label-content-name-mismatch 1; color-contrast 1 in the paste-lyrics state at 1440            |
| Zen 1280                                   | label-content-name-mismatch 2; scrollable-region-focusable (serious) 1 while lyrics overflow |
| Zen 390                                    | label-content-name-mismatch 1                                                                |
| Settings, all sections                     | 0 inside the panel; color-contrast 1 in the Danger Zone confirm at 390                       |
| Account dialog, Jam lobby, lyrics uploader | 0                                                                                            |
| Karaoke Night landing                      | nested-interactive (serious) 1                                                               |
| Exercises and Ear Lab (raw, unanalysed)    | label-content-name-mismatch 1-3; color-contrast 1 on the exercise result                     |
| Light preset (color-contrast only)         | Home 6, Singing 1, mixer 3, Zen 3                                                            |

axe returned 50 "needs review" contrast results in the mixer and 18 in Zen, because the backdrop is a photograph. Pixel sampling settled those: the mixer passes at 4.8-5.3:1, and Zen's next and sung lines fail (item 10).

## Appendix C: verification status

- **Cross-confirmed** (found independently by two or more auditors): items 1, 2, 4, 7, 9, 10, 12, 22, 23, 26, 29 and 34, the upload terms link and the version pill's name.
- **Re-run by me:** items 2, 3, 5 (the Enter restart) and 6 (Learn).
- **Single auditor:** every other item. The evidence was a keyboard trace, an accessibility-tree read, an axe run or pixel sampling, and is cited in each item.
- **No finding was rejected**, because the verification pass did not run. Expect some severities to move when the fixes are made and each is re-checked.
