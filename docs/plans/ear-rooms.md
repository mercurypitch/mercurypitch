# Ear rooms — Merc-led ear training in the native app

**Status:** in progress. Room 1, **Home note**, is built on `feat/ear-room-home-note` with stand-in
art and no demo yet. Rooms 2 and 3 are proposals.

## Why

The native app sells one subscription, Mercury Pitch Cloud. It covers the Karaoke imports and five
Merc rooms: Long note, Echo, Lip roll, Ng slides and the Warm-up.

The Ear Lab is the other half of the native rail (Rooms · Sing · Ear Lab · Progress). It is a
measurement bench: honest, precise, and built for people who already care about cents. It has no
Merc, nothing guides a beginner through a first session, and nothing on it is part of what the
subscription buys.

An Ear room fills that gap. It is a premium room in the same grammar as Long note and Echo: a
full-bleed world, Merc, one clear task, a result card with Again and Done, and the level pill. It
trains the ear a singer uses inside a song.

## What the evidence says to build

Research for this plan (27 Oct 2026, sources in the session report) found two things that decide
which ear skills belong in a paid room.

- **Training the ear alone does not carry over to the voice.** Two weeks of practice at hearing
  small pitch differences improved that skill and left singing accuracy unchanged (Zarate et al.
  2010). Most poor-pitch singers hear pitch normally; the problem is mapping what they hear onto the
  voice (Pfordresher and Brown 2007).
- **Matching with the voice while seeing it does carry over.** Real-time visual feedback while
  matching notes gave retained gains of about 105 cents; practising by ear alone did not (Blanco et
  al. 2021).

People also pay little for ear training on its own: dedicated ear trainers sell for one-off $5 to
$20 or about $50 a year.

So an Ear room produces pitch with the voice and shows it live. Tap-only identification drills and
threshold tests stay on the free bench. "In tune", a tap room where Merc sings slightly off and the
singer says high or low, was drafted first and set aside for this reason. It trains discrimination
only. If it is built at all, it belongs on the free bench beside Hairline.

## Room 1: Home note

**The skill.** Finding the first note of a line from the music itself: the moment a karaoke intro
ends and the singer has to come in on the right note. Musically it is the tonal centre: the note a
key's chords lean on and settle back to. It is the Ear Lab's Home drill, sung instead of tapped.

**The task.** The band plays a short intro in a key and stops. The singer sings the note that feels
like home, in any octave. The voice draws a trail of light over the sea against the lighthouse's
beam, which is home's line. When the voice holds inside the band of light around the beam for the
level's land time, the round lands. The band then plays home's chord under the voice, the lamp
lights and Merc cheers. After a miss, Merc sings home over that chord so the singer hears where it
was. A run is six keys, each in the singer's own range.

**Levels** (the shared accuracy tier, `src/stores/exercise-level.ts`):

| Level        | Intro                      | Merc sings home first | Band around home | Turn |
| ------------ | -------------------------- | --------------------- | ---------------- | ---- |
| Learning     | I IV V I                   | Yes: match him        | ±50 cents        | 9 s  |
| Singer       | I IV V (ends leaning on V) | No                    | ±35 cents        | 8 s  |
| Professional | IV V only                  | No                    | ±25 cents        | 7 s  |

"Hear the band again" is offered at any time at Learning, once a round at Singer, and never at
Professional. Every level folds the voice to home's nearest octave.

**The result.** Keys found out of six, and the mean time to find them ("Found in 1.4 s on
average"). The best is kept per level. A run in which no voice was heard keeps nothing.

**Where it opens.**

- The Sing room's exercise picker, under a new **Ear** heading.
- The Ear Lab bench on the native app: a "With Merc" row under the bench's headline. Compiled out
  of every build without the premium exercises, as the Sing room's row is
  (`apps/mercurypitch/scripts/assert-bundle.mjs` holds the store build to it).

**Built from.** The room kit (`src/components/room-kit/`), the sequence engine that judges Echo's
notes (`src/lib/sequence/sequence-engine.ts`, a one-note phrase per round), and Merc's sampled voice,
which the native screen hands in. The band is a small organ synth in the room
(`src/features/home-note/home-note-band.ts`) on the house pop-free envelope.

**Not in v1, said plainly.**

- No "How it works" demo. Merc's intro line says the task, and Learning has Merc sing home before
  every turn. A scripted demo through `src/components/demo-kit/` is the next step.
- The harbour is stand-in art drawn in SVG (`HarbourScene.tsx`). A painting replaces the backdrop
  group without touching the beam, the band or the trail.
- No Warm-up stop, and no account sync of the best yet (`mp_home_note_bests` is device-only).
- No paywall of its own. Like every premium room it rides `PREMIUM_EXERCISES` until the V1 flip
  brings the shared gate.

## Rooms 2 and 3 (proposals)

Both turn an Ear Lab drill into a voice room for the same subscriber.

1. **Leap** (from Leap). Merc sings one note and names a leap; the singer sings the second note,
   with the trail on screen. Each interval is anchored to the opening of a public-domain song. It is
   the practice partner for lesson 9, "Landing a leap".
2. **Harmony** (new). Merc sings a short line; the singer sings a third above it. Duets are what
   karaoke apps sell, and the trail makes the target visible.

## Open questions for the owner

- The name: **Home note** says the skill; "First note" says the karaoke moment.
- Should the room's best appear on the Ear Lab bench as its own instrument line, or only on the
  "With Merc" row?
- Merc's voice is the development sample set (Echo's, `merc-voice-set.ts`). The real recordings
  replace it without a change to the room.
