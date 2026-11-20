# Brief: Lesson 5's sound step (the examples, the bed, the effects, the mix and the captions)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film
SKILL_DIR = /home/user/mercurypitch/.claude/worktrees/fix/.claude/skills/motion-designer (read-only)

The picture is accepted (DECISIONS 234 to 240; `P/renders/film-draft-02.mp4`, 9:09.47 at 30 fps,
scratch voices). This step gives the film its sound. The voices stay the scratch Kokoro takes; the
owner's ElevenLabs voices come later and the film re-times to them, so everything you place keys
off `cues.json`, never a typed second.

## Read first
- SKILL_DIR/SKILL.md § 8 (Audio) and § 10's loudness line; SKILL_DIR/kit/business-motion-film/
  references/audio.md; SKILL_DIR/references/house-rules.md § Music and sound;
  SKILL_DIR/references/measurement.md (the audio measure).
- P/BRIEF.md § Assets and § Audio; P/FACTS.md 79, 80, 81, 96, 97 and 98, and the facts they name
  (72 to 77); P/STORYBOARD.md § Sounds and captions; DECISIONS 155, 177, 194 and 215; LAB-CHECKS 16;
  P/BUILD-GUIDE.md (the sound step's note).
- P/tools/mix.py and P/tools/captions.py: Lesson 4's engine with Lesson 5's stubs (each stops on a
  sound it cannot make or caption); P/tools/gen-root.py (its `MIX` switch). Lesson 4's finished
  mixer and its delivery notes are in $S/l4film (tools/mix.py, DELIVERY.md) for reference.

## The work
1. **The examples** (`sound_for` in mix.py), every sound cue in `cues.json`: `easy`, `pushed`,
   `push`, `gauge`, `start-air`, `start-catch`, `start-together`, `starts`, `demo`, `listen`, the two
   `tick`s and `twinkle`. One "ooh" timbre for every sung note, as FACTS 79 gives it (partials,
   lowpass, the vibrato grown in), Tavi's an octave up; pitches, contours, levels and lengths as
   FACTS 80; the takes' vibrato from 0.5 s, the Push note's from its start (DECISIONS 155); the
   starts as FACTS 75 and 96; the ticks as FACTS 97 and 80, at least 12 dB under `listen`'s peak
   (LAB-CHECKS 16).
   - **Sound and picture from the same numbers** (FACTS 98). Take each contour from where the
     scenes draw it (the film kit in `assets/lib/`: find `takeContour`, the Push note's steps, the
     demo's line, the gauge), by reading the kit in node and writing the numbers out, never by
     copying them by hand. Prove each: a pitch track of the synthesised sound (10 ms hop) against
     the drawn contour, the cents error (max and RMS) and the level contour, in one table.
2. **The bed and the silences** (FACTS 81): the open fifth on A (A2, E3, A3), only in the eight act
   transitions and under the dressed pauses FACTS 81 lists; silent under every line and sound, and
   in `heard`, `breathe`, the ticks and `hold`. The pad carries through `break`, and each of Merc's
   two hop landings there gets a soft sound, so the beat never plays as the film's end (DECISIONS
   215). Take the landing times from the rule s13 uses for its hops (they land at about 490.84 and
   491.49 on today's clock), not from those numbers. Room tone under the whole film.
3. **The effects and stings**: one soft whoosh per act change (the eight act marks); the title and
   end stings are Lesson 1's chimes, an A major chord (as mix.py has them), sitting with the A pad.
4. **No voice over a sound** (BRIEF § Audio): check the cue sheet for any line that overlaps an
   example, a sung note or the hold, and name it. Do not move cues.
5. **The mix**: stems balanced by loudness with the voice as reference, as mix.py does. Change a
   target only with a reason you state. The full mix steady and comfortable for the web, true peak
   at -1 dBTP or lower. Name the integrated loudness you chose and why (say what Lesson 4's film
   delivered). Write `assets/audio/full.wav`, `assets/audio/music-only.wav` and
   `assets/audio/stems/*.wav`.
6. **The captions** (captions.py): this film's WORDS, SOUNDS and SUNG from STORYBOARD § Sounds and
   captions; write `captions/lesson-05.en.srt` and `.vtt` with the run's limits clean.
7. **Measure**, to `P/review/sound-01/`:
   - `python3 SKILL_DIR/scripts/measure.py audio` (the effects against the music-only mix);
   - the full mix's integrated loudness, range and true peak;
   - the pitch and level table of item 1, the ticks against `listen`, the starts' onsets against
     FACTS 80;
   - the starts' sound against S9's drawn traces in film-draft-02 (DECISIONS 194: the picture's
     sync with the starts is judged now): each onset's frame in the picture and in the sound.
8. **A review cut and the root**:
   - Mux `full.wav` onto `renders/film-draft-02.mp4`, the video stream copied, not re-rendered, to
     `renders/film-draft-02-sound.mp4`.
   - Run `MIX=full python3 tools/gen-root.py` (read it first; it must leave every scene file as it
     is), then `check` (0 errors), so the final render takes the full mix.

## Rules
- Every heavy job (`check`, measure.py, any render or long synthesis) through `$S/bin/heavy`, one at
  a time.
- Everything is synthesised in code, as Lesson 4's was: no downloaded music or sound, and no
  voice, music, image or video service.
- Never production. No attribution, emojis or model names in any file. Do not commit or push.
- Edit only `tools/mix.py`, `tools/captions.py`, new read-only tools under `tools/` (log each in
  `tools/CHANGES.md`), `assets/audio/`, `captions/`, the review cut, `index.html` through gen-root,
  and `review/sound-01/`.
- Do not edit the scenes, the kit, the cues, `script.json`, STORYBOARD, FACTS, HANDOFFS, LAB-CHECKS
  or DECISIONS. Name any number a document should carry, and anything in the picture that does not
  match the sound, with its time.

## Hand back
- Per item: what you built, with file and line.
- The tables: pitch and level against FACTS 80, the ticks, the starts' onsets and their sync with
  the picture, the stems' levels, and the full mix's loudness and true peak.
- Any overlap of a line and a sound.
- Anything that is not as FACTS or the brief says, and why.
- The paths of the review cut, the mixes and the captions.
