# Lesson 11: asks from other lessons' plans

For Lesson 11's planner and builders.

- **Lesson 12's still rule (spec Decisions 13):** the still that previews Lesson 12 on Lesson 11's next-lesson card shows no tune note on the ring.
- **Built out of order:** Lesson 12's page may land before Lesson 11's. `lessonWithNoPage()` then returns 11, and every B0 conversion holds (Lesson 12 PLAN section 5). Once Lesson 11 also has a page, Lessons 13 and 14 open nothing, and the helper in `kit/explorer.test.ts` (B0's `:291-293`) throws. Whichever of 11 and 12 lands second rewrites that test: drop the `unlocks` clause, and expect `['Topics', 'Builds on']` plus `'Opens'` only when `unlocks(later.n)` is not empty.
