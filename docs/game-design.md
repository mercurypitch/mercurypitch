# Break Glass — game design (locked 2026-07-25)

Decisions made with maff; this is the spec the mechanics work builds from.
The core physics (resonance rise/decay, fatigue cracks, epicness-scaled
shatter, per-singer calibration) already exists in `src/lib/glass/` — the
work below is variants + meta, not a new engine.

## Locked decisions

1. **Fail state — per-material mix.** Free materials are always-win
   (fatigue assist guarantees an eventual shatter; skill expressed via
   stars). Pro materials can genuinely FAIL (level ends unbroken after
   maxReps; retry). Difficulty is part of what Pro means.
2. **Per-material mechanics — all five distinct:**
   | Material | Tier | Mechanic |
   |---|---|---|
   | Wine Glass | free | Baseline: hold to build (current physics) |
   | Ice | free | Slow decay, but fatigue HEALS over time ("refreezes") → rewards long continuous holds |
   | Crystal | free | Tight tolCents, faster rise → precision material |
   | Vase | pro | TWO targets in sequence (note A then note B) → first melody step; can fail |
   | Diamond | pro | Tight everything, NO fatigue assist, maxReps hard fail → pure skill |
3. **Pro gate — materials + daily energy.** Free: 3 materials, limited
   attempts/day (energy, e.g. 5). Pro (RevenueCat `pro`): all materials +
   unlimited play. Paywall triggers: energy exhausted, Pro material tap.

## Stars (per level, persisted locally via Dexie)

- 1★ shatter at all · 2★ shatter within 2 reps · 3★ first-rep clean lock
  (epicness above threshold). Stars are the progression/score surface and
  the share-card flex.

## Implementation notes

- Mechanics land as config extensions in `levels.ts` (`GlassLevel.config`
  already threads into GlassApp/computeTarget) + small variants in
  `src/lib/glass/resonance.ts` (refreeze = negative fatigue rate while
  out-of-band; assist=0 for Diamond) + a sequence wrapper for Vase's
  two-target flow + `maxReps`/fail screen for Pro materials.
- Energy: local counter (Dexie), resets daily; Pro entitlement bypasses.
- Order of work: (1) stars + persistence, (2) energy + paywall triggers,
  (3) Ice/Crystal/Diamond config-mechanics, (4) Vase two-note sequence,
  (5) fail screen for Pro, (6) Merc reactions, (7) THEN visuals/cinematic
  shatter (wineglass-stage.blend is ready for Cell Fracture).
