# Ear rooms — Merc-led ear training in the native app

**Status:** in progress. Two rooms are built and on TestFlight: **Home note** (Room 1) and **First
note** (Room 2). The owner tried both on 28 Oct 2026 ("fun and work well"). The second round, on
`feat/ear-rooms-own-songs`, brings First note the singer's own songs, an optional words hint and a
way on to the Karaoke room, and gets Home note ready for its painting (its prompt is below; the
owner makes it). Neither room has a demo yet. Rooms 3 and 4 are proposals. The owner's design
canvas ("Ear rooms", 27 Oct 2026) has phone mock-ups of all four and of the Ear Lab's way in.

**The owner's decision and requests of 28 Oct 2026.**

- Decided: the free taste is three runs per room, then the paywall. The gate comes with the V1 flip
  and is not built yet.
- Asked for: the singer's own songs, imported and split in the Karaoke room, as First note's songs
  too.
- Asked for: an optional hint with the words of the line the singer comes in on. It ships off by
  default, which is our choice rather than the owner's, so the room stays ear first.
- Asked for: a way to go on and sing the whole song in the Karaoke room from where the singer came
  in. It is offered after a landing and from the result.

## Why

The native app sells one subscription, Mercury Pitch Cloud. It covers the Karaoke imports and five
Merc rooms: Long note, Echo, Lip roll, Ng slides and the Warm-up.

The Ear Lab is the other half of the native rail (Rooms · Sing · Ear Lab · Progress). It is a
measurement bench: honest, precise, and built for people who already care about cents. It has no
Merc, nothing guides a beginner through a first session, and nothing on it is part of what the
subscription buys.

An Ear room fills that gap. It is a premium room in the same grammar as Long note and Echo: a
full-bleed world, Merc, one clear task, a result card with Again and Done, and the level pill. It
trains the ear a singer uses inside a song, and every one ends in the voice. The bench stays free.

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

## Where they open

- The Sing room's exercise picker, under the **Ear** heading.
- The Ear Lab bench on the native app: a "With Merc" row under the bench's headline, one card per
  room in the catalogue's Ear group (`src/features/premium-exercises/EarMercRow.tsx`). Compiled out
  of every build without the premium exercises, as the Sing room's row is
  (`apps/mercurypitch/scripts/assert-bundle.mjs` holds the store build to it).

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

**The result.** Keys found out of six, and the mean time to find them ("Found in 1.4 s on average").
The best is kept per level. A run in which no voice was heard keeps nothing.

**Built from.** The room kit (`src/components/room-kit/`), the sequence engine that judges Echo's
notes (`src/lib/sequence/sequence-engine.ts`, a one-note phrase per round), and Merc's sampled voice,
which the native screen hands in. The band is a small organ synth in the room
(`src/features/home-note/home-note-band.ts`) on the house pop-free envelope.

**Next, from the canvas.** The intro's chords as small lamps under the chip (I, IV, V lit as each
plays), and the result's six keys as lamps that replay their intro when tapped.

### The harbour's painting (for the owner to make)

The room is ready for a painted harbour (`src/features/home-note/HarbourScene.tsx`): it asks for
`/ear-rooms/harbour-portrait.webp`, and `/ear-rooms/harbour-landscape.webp` on a screen held on its
side, shows the painting once it has loaded, and keeps today's drawing until then and wherever the
app does not carry the files. The beam (home's line), the band of light around it, the singer's
trail, the lamp's glow and Merc are drawn over it by the app, so the painting must leave them out.
The app pins the picture at the lantern, so the lantern has to sit at **84% across and 44% down** in
both files; a taller or wider screen crops around that point.

Copy-paste prompt, in the house style of the other room paintings (Echo's rooftops, Lip roll's
bay, the Karaoke room's theatre: painted, cinematic, deep navy with warm gold light, a quiet sky):

> A quiet harbour at dusk, a cinematic digital matte painting with soft film-like light and fine
> painterly texture, like a hand-painted background from an animated feature. Deep indigo and navy
> sky overhead, warming to a last band of amber and rose along the horizon behind low dark hills.
> A white lighthouse with two deep red bands stands on dark wet rocks near the right edge; its
> lantern room glows warm gold, a soft round glow with no beam, centred 84% across and 44% down
> the frame. A calm, glassy sea fills the frame below a horizon 60% down, long gentle swells with
> faint gold and violet reflections. At the lower left a weathered wooden pier runs in from the left
> edge to a third of the way across, its deck 73% down, empty, wide enough for a small character to
> stand on at 20% across. A few tiny harbour lights low on the far shore at the left. The top fifth
> of the sky is calm and nearly empty, a few faint first stars; the bottom sixth is dark water,
> nearly black. No beam of light, no people, no boats, no birds, no text, no logos, no frame.
> Portrait, 9:16.

For the landscape twin, the same prompt ending instead: "Landscape, 16:9: the same harbour, wider,
with more sea and sky to the left; the lantern still 84% across and 44% down, the horizon 60% down,
the pier from the left edge to a third of the way across with its deck 73% down."

Keep clear for the exercise: the band from 25% to 63% down across the left two-thirds (the trail's
reach either side of the beam) has no bright stars, lights or boats; the lower left above the pier
is open for Merc; the top and bottom edges stay dark enough for the chip and the mic.

To ship it: export WebP at q90, 1440 x 2560 and 2048 x 1152 (the theatre's sizes), as
`harbour-portrait.webp` and `harbour-landscape.webp` in `apps/mercurypitch/native-only/ear-rooms/`,
and add one entry to `apps/mercurypitch/native-assets.mjs` in the same change:
`{ glob: 'ear-rooms/harbour-*.webp', root: 'native', reason: "Home note's harbour, upright and on its side (src/features/home-note/HarbourScene.tsx)." }`.
The entry and the files land together: an entry that matches no file fails the native build
(`scripts/sync-native-assets.mjs`).

## Room 2: First note

**The skill.** Coming in on the right note when a song's intro ends, from the band alone: the
karaoke moment itself, on real songs.

**The task.** A run is up to six entries, two from each of the three example songs the app ships
(Josh Woodward, CC BY 4.0, credited under the chip while they play), or shared out over the
singer's own songs or a mix (see "Your songs" below). In each, the song's band plays the
eight seconds before its singer comes in, with the singer's voice muted and the last four beats
counted down, and stops there. The singer sings the singer's first note, in any octave. Their
**entry** is the first note their voice sits on (200 ms, steady within 40 cents,
`firstSteadyNote` in `src/lib/sequence/steady-note.ts`), and the chip says how it came in: "On the
note", "Came in low" or "Came in high". Then the voice finds the note against its line and lands
when it holds in the band around it. The song carries on from the entry with its singer back in,
the reward and the check at once. After a miss, Merc sings the note, then the singer comes in.

**Ear first.** The note's line hides until the singer has come in, so the entry is judged by ear
alone (owner, 27 Oct 2026). Each round places the line at a new height, so a hidden line's place
says nothing about the note.

| Level        | The note's line shows       | Band around the note | Turn | Hear the band again |
| ------------ | --------------------------- | -------------------- | ---- | ------------------- |
| Learning     | From the start              | ±50 cents            | 9 s  | Any time            |
| Singer       | Once the singer has come in | ±35 cents            | 8 s  | Once a round        |
| Professional | Only when the voice lands   | ±25 cents            | 7 s  | Never               |

**The result.** Entries sung on the note at the first try, out of six ("Came in on the note"), and
under it the notes found by the end of the turn and the level. The best is kept per level: more
entries on the note, then more found, then closer entries. A run with no voice keeps nothing.

**The entries.** The rules live in one module that the script and the phone both run
(`src/features/first-note/entry-rules.ts`; it imports nothing, so Node runs it as it is). An entry
is a line of the song that follows a breath on the vocal stem. Its note is the voice's first steady
stretch, read by YIN, and is kept only when the song's stored notes (the mixer's, another tracker)
name the same note, the singer sat within 30 cents of it, and it is near the song's middle note.
The stored notes alone were not enough: the same chorus line reads as F5, C5 and D5 in its three
choruses. The beats come from the band stem's onsets, and an entry whose lead-in shows no clear
grid gets none.

The examples' entries are read once from the stems and committed
(`src/features/first-note/first-note-entries.json`, made by
`apps/mercurypitch/scripts/generate-first-note-entries.mjs`), with each line's words. Nineteen
entries pass, from D3 to D4. Each song records the sha256 of the vocal it was read from, and
`apps/mercurypitch/src/first-note-entries.test.ts` fails when a stem's pin changes and the entries
were not made again. Moving the rules into the shared module changed none of them: the script wrote
the same entries again, the words added.

**Your songs** (the owner's request, 28 Oct 2026). A song the singer imported and split in the
Karaoke room is a song here too. The pill over the mic at rest names where a run's songs come from
and opens the Songs sheet (`FirstNoteSongs.tsx`): the examples, your songs, or a mix, and each of
your songs with what the phone knows of it, as the canvas's C1 draws it. With none split yet, the
sheet says how one comes to be here, and on the phone "Sing your own songs" opens the Karaoke
room's songs, where Import is (A2).

The phone reads each song once, by the same rules (`own-song-read.ts`). Its notes are the Karaoke
room's own read; a song the room has not read is read here the same way, and the notes are kept for
the room too. The vocal is walked chunk by chunk where the phone streams, as the mixer walks it, and
a song too long for the walk to hold sits out ("Left out: too long for this phone to read"). Where
the phone cannot stream, a stem is decoded whole only within the walk's ceiling (about six minutes),
and the vocal is let go before the band is read, so the phone never holds two decoded stems. The
lines are the song's synced lyrics, or where the voice comes in after a breath when it has none.
Only the band's lead-ins are read for the beats, never the whole band. The rules' work runs in
steps, and the read lets the screen draw after every line and lead-in, and inside one every 8 ms.

The entries are kept on the phone (`mp_first_note_own_entries`) under the song and its stems, so a
stem replaced in the studio is read again (`first-note-own-songs.ts`); a read is let go only when
its song is gone from the phone. Songs are read one at a time, only while the room is at rest with
your songs chosen, a song that turns up meanwhile included; a run lets go of the read, so it never
competes with the microphone. A song with fewer than two clean entries sits out and says so ("Left
out: only 1 clear entry, it needs 2"); a read that fails says "Could not read this song", and the
cause goes to the log. A run shares up to six entries over the chosen songs in turn: three songs
give two each, four give two, two, one and one. A song gives no more than it has, so a run on one
song with four entries is four rounds; a run shorter than six is kept in the history, scored
against the entries it had, and never counts as a best.

**Show the words.** The owner asked for an optional hint (28 Oct 2026); it ships off by default, our
choice, so the room stays ear first. It is a switch in the Songs sheet, kept on the phone
(`mp_first_note_words`). On, the words of the line the singer comes in on show in Merc's place over
his head while the band counts in and in the turn, gold-edged so they never read as his, and the
pill over the mic says "Words". The examples' words come from their word-timed lyrics; a song of
the singer's own has them when its lyrics are synced.

**Sing on in Karaoke** (the owner's request, 28 Oct 2026). After a landing, "Sing on in Karaoke"
stands over the mic while the song carries on; at the result each song has a row with how its
entries went and "Sing on" (canvas C4). Either opens the Karaoke room with that song playing from
the first beat counted before the entry (or three seconds ahead where there are no beats), so the
singer comes in again with the rest of the song after it. The seam is the room's own song request,
which now carries a place to start (`requestKaraokeSong(id, { seekSec })`); only the shell changes
the tab, so `FirstNoteScreen` hands the way in.

**Playback.** The stems stream from the phone's files through two `<audio>` elements routed into the
room's audio context (`src/features/first-note/song-player.ts`), on the house envelopes. Decoding a
whole song for eight seconds of it would cost tens of megabytes a stem. The world is the Karaoke
room's painted theatre (`/karaoke/broadway-theater-portrait.webp`), which the native app ships.

**Not yet, said plainly.**

- No "How it works" demo, no Warm-up stop, and no account sync of the best (`mp_first_note_bests`
  is device-only), nor of the reads of the singer's songs, which belong to the phone that has the
  songs.
- A song of the singer's own is read again only when its stems change: lyrics synced after the
  read bring their words at the next read, not before.
- No paywall of its own yet. Like every premium room it rides `PREMIUM_EXERCISES` until the V1
  flip, which brings the free taste with it: three runs per room, then the paywall.

## Rooms 3 and 4 (proposals)

Both turn an Ear Lab drill into a voice room for the same subscriber.

1. **Leap** (from the bench's Leap). Merc sings one note and names a leap with a public-domain song
   that opens on it (Here Comes the Bride for a fourth, Twinkle, Twinkle for a fifth, My Bonnie for
   a sixth); the singer sings Merc's note, then the second. Each note is a ledge on a cliff, the
   target faint at its height. It is the practice partner for lesson 9, "Landing a leap", whose
   Practise card would open it.
2. **Harmony** (new). Merc sings a short line; the singer sings a third above it. Duets are what
   karaoke apps sell, and the trail makes the target visible. Merc sings while the singer does, so
   it needs headphones and a judge that follows two voices: prototype it on phones first.

## How they earn

The "With Merc" row is the first thing on the Ear Lab tab, so a singer who only uses the free bench
meets Merc's rooms on every visit. First note is the room that leads to imports: every song a
singer brings becomes practice, and a singer with none is shown the way to Cloud from the Songs
sheet, which is what Cloud sells. A free taste lets the rooms show their worth: three runs per
room, then the paywall (owner, 28 Oct 2026). The gate comes with the V1 flip (`PREMIUM_EXERCISES`
in `src/lib/native-build.ts`). Measure the chain per room: row taps, room starts, offer views,
trials.

Practice on the device can be paid on the phone. `docs/plans/premium.md`, which said everything
that runs on the device stays free, is marked outdated (owner, 27 Oct 2026).

## Open questions for the owner

- Should a room's best appear on the Ear Lab bench as its own instrument line, or only on the
  "With Merc" row?
- Harmony: headphones only, or a take-turns fallback on the speaker.
- First note on the web too, where splitting is free on the device, or native only.
- Merc's voice is the development sample set (Echo's, `merc-voice-set.ts`). The real recordings
  replace it without a change to the rooms.
