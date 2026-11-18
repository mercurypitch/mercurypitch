# Lesson 25 shared entries (committed after the lead review, 2 Nov 08:4x; verify each at the shared commit)

Take from s2pkg/25-HANDBACK.md (fix-pass version, 08:3x 2 Nov), verbatim unless noted:
- "MASTER-PLAN § 11" (line 71) and the "CURIOSITY-MOMENTS § 2" entry (line 84; predict word for
  word: "Each ending has chords, not yet played. In the first, the chord before home is E, G and B.
  The second raises G to G♯. What does that do to the chord?" [ It turns major ] [ It stays minor ]).
- "SEASON-2 § 3, Lesson 25's card, "Closes on"" (line 119): SEASON-2.md:627-628 is false (Lesson 12
  sang over moving chords); replace with the hand-back's line, "Lesson 24's other part was a drone
  that never moved. Now let the other part be a tune: can you make a harmony by singing the tune a
  third higher?"
- kit/season.ts (line 136; `pr.needs` now carries SEASON-2 § 5.2 item 10's parts), kit/lesson-copy.ts
  and kit/team-notes.ts (line 164): 25's tease bound to the lead's line with the `plan` alternative
  (its soft lean noted in TEASE_NOTES); 26's tease the lead's line with the mended `plan` alternative,
  "Lesson 24's other part was a drone. What if it's a tune?" (TEASE_NOTES cites Lesson 12). EDGES
  [10, 25], [21, 25], [23, 25]. drafts.ts and SIGNATURES as in the hand-back.
- SEASON-2 § 5.2 item 10's lesson list already names 25; item 12 (`ear-drill`) and item 13 (Scale
  Runner's harmonic and melodic minor) change the card when they ship (hand-back line 209 on).
- Owner decisions taken as recommended: title "Harmonic and melodic minor, relative keys |
  MercuryPitch"; second drill Sight-Singing in A harmonic minor (the Singing tab's key and scale);
  release after Lessons 10, 21 and 23 are live and the coach's look.
- Lead at review: Wrap line 2 now ends "and the wide step is gone." (was "and closes the wide step
  that leaves."); counts updated (2,160 words; Wrap 413).
- App notes from this lesson (for the owner's list, verified by the reviewer at c60f0fdcb): the
  Singing tab's scale pickers play nothing (they only call refreshScale); the app's Melodic Minor is
  the going-up form only; loading a song from the sidebar's library list after setting the key
  re-keys the grid without changing the key menu, so Sight-Singing can print "Key: A
  harmonic-minor" over another key's notes (LibraryTab.tsx:220, SightSingingExercise.tsx:276-278;
  the library window does set the menu, LibraryModal.tsx:259-267) (writer's evidence: the lead
  verifies before reporting); "Sad and introspective" (scale-data.ts:88) is on no screen.
