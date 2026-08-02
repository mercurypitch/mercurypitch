# Jam: sing a song together

**Status:** plan only. Branch `feat/jam-karaoke-songs`, off `main`.

Today a jam room runs a *melody* — a drill, the weekly, an Ascent week, a
saved tune. This is about running a **song**: lyrics down the left, every
singer's pitch trail down the right, a backing track playing, and eventually
verses assigned to people so a room can do lead and backing vocals.

## 1. The one constraint that shapes everything

**Every peer needs the audio, and most songs only exist on one device.**

A karaoke session's stems live in that browser's IndexedDB. They were
uploaded, separated by UVR, and never left. There is no URL another peer can
fetch, and pushing tens of megabytes down a DataChannel to eleven people is
not a plan.

So the room can only sing songs that are **fetchable by everyone**:

| Source | Shareable? | Why |
|---|---|---|
| Karaoke Night demo song | **Yes** | Already on R2 (`mercury-pitch-models`, wildcard GET CORS since 2026-07-17) |
| A future shared/library song | Yes, once it exists | Same shape as the demo |
| A user's own separated session | **No** | Stems are device-local; no fetchable URL exists |

That is why the demo song is the right first target, and it is not a
convenience — it is the only thing that currently works. Making a user's own
song jammable is a separate, much larger piece of work (uploading stems to
shared storage, with the licensing questions that opens), and it should not
be smuggled in behind this.

## 2. What already exists

Most of this is assembly, not invention:

| Piece | Where | Reused for |
|---|---|---|
| `jamMyTarget` — "what are MY notes" | `stores/jam-store.ts` | The seam a song part plugs into, unchanged |
| Per-peer beat-stamped pitch, agreed scoring | `lib/jam/jam-scoring.ts` | The right-hand trails, as-is |
| Host transport, tempo resync, latency compensation | `stores/jam-store.ts` | Song playback sync |
| Lyrics model with timings, blocks, note toggle | `features/stem-mixer/` | The left-hand column |
| `LyricsBlock { id, label, lineIndices, repeatCount }` | `stem-mixer/types.ts` | **Singer assignment — see §5** |
| Demo song loader + manifest | `features/karaoke-night/demo-song.ts` | Phase 1's song source |
| Playlist singer names | `stores/karaoke-playlist-store.ts` | Prior art for "who sings what" |

## 3. Phase 1 — the demo song in a room

**Song as a target source.** `jam-catalog.ts` grows a "Songs" shelf. Selecting
one broadcasts a `song` message — a manifest reference (id + stem URLs +
lyrics + timings), not audio. Every peer fetches the same public URLs.

**Layout.** The room's main area splits: lyrics left, per-peer pitch right.
The existing single-canvas layout stays for melody targets — this is a second
layout, chosen by what the room loaded, not a replacement.

**Transport.** The complication: jam syncs in *beats*, a song runs in
*seconds*. Two options, and the second is better:

1. Derive beats from the song's BPM. Breaks on tempo changes and rubato.
2. **Add a seconds-based transport alongside the beat one.** The playback
   message already carries a position; a song carries `positionSec` instead
   of `currentBeat`, and the same latency compensation applies. Scoring keys
   off the song's own timeline, which is what the lyrics timings already use.

Option 2 keeps the beat path untouched for drills, which is the thing not to
break.

**Scoring.** Reuse `scoreJamRun` by feeding it the vocal line as a target with
positions in seconds — it filters a numeric range and does not care about the
unit, which is the same reason it already works in beats.

## 4. Phase 2 — the pitch wall

The right-hand side is the part that makes this feel like a band rather than a
karaoke machine: **one lane per peer**, each showing their trail against the
song's vocal line, scrolling with playback. Peer colours are already assigned
(`peer-colors.ts`), so a lane is instantly readable as a person.

Per-line scoring falls out of the lyrics timings: each line is a time range,
so a line gets a score the same way a note does today. That gives the room a
running "who is nailing which line" without inventing a new scorer.

## 5. Phase 3 — assigning singers to parts

This is the feature the user actually wants, and it is cheaper than it looks
because `LyricsBlock` already exists for repeat marking.

**Model:** one optional field.

```ts
interface LyricsBlock {
  id: string
  label: string
  lineIndices: number[]
  repeatCount: number
  singerId?: string   // <- new: who sings this block
}
```

The block editor already lets you mark a range of lines and label it. Marking
that block "Singer 2" instead of "Chorus" is the same gesture on the same
model. Blocks are already shared with the song, so the assignment travels with
it and every peer sees the same allocation.

**Roles map to blocks, not to sorted-peer-index.** This is the departure from
the existing modes: Harmony and Relay derive roles from the peer list because
nothing about the melody says who sings what. A song *does* — the assignment
is authored. So the room needs a claim step: peers pick (or are given) a
singer slot, and `jamMyTarget` returns the lines for that slot.

**Unassigned blocks are everyone's.** A song with no assignments is a unison
singalong, which is the sane default and the thing most rooms will do.

**Lead and backing** is then just two blocks over the same lines with
different singers — no extra concept needed.

## 6. Order, and what to decide when

1. **Demo song loads, plays in sync, one shared vocal line.** Proves the
   seconds transport and the manifest broadcast. Everything else is layout.
2. **Split layout + per-peer lanes.** The visual payoff.
3. **Per-line scoring.**
4. **Singer assignment on blocks**, unassigned = everyone.
5. **Claiming a slot in the room.**

Open questions worth settling before 4, not during:

- **Who assigns?** Host-only is simplest and matches how mode and tempo work.
- **What happens when a singer leaves mid-song?** Their blocks should fall
  back to everyone rather than going silent — the same lesson as Relay's
  empty parts.
- **Does a song run count as practice?** It has no `ExerciseType`, so under
  the current crediting rules it would not. Probably right for now; revisit
  with the leaderboard question.

## 7. What this is not

Not a route to jamming your own uploaded songs — see §1. Not a replacement for
the melody targets, which stay exactly as they are. And not an excuse to
loosen the latency constraint: singers still hear only themselves and the
backing track, and only the scoreboard combines. A song makes that framing
easier, not harder — everyone has the same reference to sing against.
