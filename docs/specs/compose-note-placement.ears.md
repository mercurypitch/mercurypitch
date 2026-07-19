# Compose Note Placement — EARS Requirements

Requirements for where a click places a new note in the Compose piano roll
(`snapPlacementBeat` and `placeNote` in `src/lib/piano-roll.ts`, driven by the
`PianoRollCanvas` component). Written in EARS (Easy Approach to Requirements
Syntax). Each requirement has an ID referenced by the unit tests in:

- `src/tests/piano-roll-placement.test.ts` (placement quantization — `PLACE-*`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Placement quantization — `PLACE-*`

A **slot** is one snap unit wide. The snap unit is one whole beat for notes at
least one beat long and one half-beat for shorter notes. **f** is the click's
fractional position within its slot, in `[0, 1)`.

- **PLACE-1** — WHEN a new note is placed by clicking inside an empty slot at fraction f in `[0, 1)`, the system shall set the note's start to that slot's own start (floor to the snap unit), so the note lands in the slot under the cursor.
- **PLACE-2** — WHERE the note being placed is at least one beat long, the placement snap unit shall be one whole beat; otherwise it shall be one half-beat.
- **PLACE-3** — IF a click falls at or past a slot's half-way point (f ≥ 0.5), THEN the system shall still place the note in that slot and shall not advance it to the next slot.
- **PLACE-4** — WHEN a click lands exactly on a slot boundary (f = 0), the system shall place the note in the slot that starts at that boundary.
- **PLACE-5** — Drag-move and resize snapping shall be unaffected by placement quantization; they shall continue to round to the nearest slot.
