# Lesson 10: follow-ups and asks

- **Asks from Lesson 12's plan (24 October), section 6 item 18:**
  - L10-K2 takes a voice kind on each note (L12-K1 folds into it; Lesson 12 decision 3), beside the gain on each note.
  - L10-K3 takes a reach for each side (L12-K2 folds into it; Lesson 10 decision 5), with L12-K2's tests: -4 and +3 hold, +4 and -5 are refused; the default stays plus and minus 4; `setMoveEnds` marks only the end reached, with `aria-disabled`.
  - L10-P14 exports its quiz-play binder, so Lesson 12's recall can import it.
  - L10-P8's question ids and slot stay fixed once shipped: Lesson 12's recall filters Lesson 10's own questions (G8).
  - B15 or L10-P21 pads `open()` (also in `../l9/FOLLOWUPS.md`).

- Lesson 7 Sing it: when a play is cut short by a hidden page or the Sound switch (K2 item 5), "played" drops as intended, but the listen ring runs on to its natural end, since ring.stop is not called. Cosmetic; K2 left it alone (24 Oct).
- kit/run.ts chords (K2 review N1, 25 Oct): a stop from inside onNote in the middle of a chord leaves that chord's later notes built after the stop and unowned for their dur (one timer per onset now; before, one per note, cleared by the stop). No caller stops its own run from onNote; if one ever does, guard the onset loop with a flag the stop sets.
- After K3 and K1 merge (review 25 Oct): rewrite as done the plan sentences that still plan them or call Move do's ends "disabled". Lesson 10 spec :18, item 5 (:782-786), item 7 (:797-800); Lesson 12 spec :873-874; Lesson 9 spec :332, :457, :724, :788, :818; Lesson 14 spec :429, :598, :981, :1013. Owners: P22, Lesson 12's docs task, B16, Lesson 14's builder.
- Optional (K1 review): Lesson 6's melody.ts SOLFEGE (do to la) could index the kit's MAJOR_SOLFEGE.
