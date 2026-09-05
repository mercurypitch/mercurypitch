# Beside Cue — premium Pull voice recording pack

**Revision:** premium-pulls-en-v1 · **Date:** 2026-09-05

**Language:** English (`en`) · **Scope:** 8 premium characters × 3 lines = **24 lines**

**Status:** Script/caption handoff. No premium recordings have been generated or integrated. These exact words match the new app captions; audition and approve voices before recording the final masters.

This extends the existing six-character recording setup. It does not replace the six free Pulls, change Corky’s script, or add voice to locked previews. The clock character’s canonical name is **The Ticker** (not “Thicker”). Tape is included.

## 1. Performance and meaning

Each character is a charming, recognisable pattern—not a villain, diagnosis, therapist or productivity coach. Speak to one nearby person. Keep consonants clear on a phone speaker, with no cartoon squeak, whispering, announcer energy or exaggerated accent. Distinct rhythm and intention matter more than pitch effects.

- **Meet:** identify the character and the pattern. Used when a selectable Pull is tapped.
- **Present:** the character’s familiar internal sales pitch for **Side A**, the habitual path. This is recognition, not app endorsement.
- **Recede:** after the person chooses **Side B**, yield the scene without defeat, guilt, praise, instructions or a promise that the Pull is gone forever.

Do not read IDs, direction, timing, headings or punctuation names aloud. Keep the caption words exact; changes need a script revision and matching caption update. Timing ranges below are provisional natural-read targets, **not measured durations** or instructions to time-stretch a take. The four-second animation is not a speech deadline: the settled frame can hold while an approved line finishes.

## 2. Files and delivery

Use the existing naming structure:

```text
source/en/<speaker>/<file-stem>__t01.wav
source/en/<speaker>/<file-stem>__t02.wav
source/en/<speaker>/<file-stem>__t03.wav
selected/en/<speaker>/<file-stem>.wav
public/audio/voice/en/<speaker>/<file-stem>.m4a
```

Speaker folders: `the-thimble`, `the-tab`, `the-bookmark`, `the-match`, `the-pillow`, `the-kettle`, `the-ticker`, `the-tape`.

Record three complete reads: T01 follows the direction; T02 is slightly warmer and less performed; T03 is a bounded alternative with the **same words**. Deliver dry mono WAV, 48 kHz/24-bit, without music, Foley, reverb or a baked character effect. Leave clean attacks and tails. Keep original masters; the app team makes runtime encodes. Do not export only a mixed video soundtrack.

For human recording, use the capture, mastering and performer-consent rules in the existing V2 recording pack (companion dotfiles: `personal/besidecue/BESIDE-CUE-V2-VOICE-RECORDING-PACK-2026-08-27.md`), sections 5–10. For an approved synthetic voice, keep the same exact-word/file contract and log the provider, voice identity, model and take; do not imitate an identifiable performer without permission.

## 3. The Thimble — Putting my guard up

**Voice:** Small, sturdy and dry; compact phrasing, protective without sounding hostile. A little shell around vulnerability, not a scolding voice.

**Meaning:** Defensiveness can feel protective. Recede creates room for the person’s chosen response without telling them to accept harmful feedback or abandon boundaries.

| Line ID                    | File stem                  | Exact spoken caption                                                  | Direction                                                                 | Target    |
| -------------------------- | -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------- |
| `pull.the-thimble.meet`    | `en__the-thimble__meet`    | I’m The Thimble. I put a little armour around words that might sting. | Matter-of-fact introduction; gentle weight on armour, no threat on sting. | 4.2–5.6 s |
| `pull.the-thimble.present` | `en__the-thimble__present` | A little armour feels safer. We could stay inside it.                 | A plausible offer of shelter; not an instruction to shut people out.      | 3.2–4.4 s |
| `pull.the-thimble.recede`  | `en__the-thimble__recede`  | All right. I can leave a little room.                                 | Loosen slightly; no sigh of defeat or approval.                           | 2.5–3.5 s |

## 4. The Tab — Too many tabs

**Voice:** Curious, quick to pivot, lightly overlapping thoughts—but every word lands. No frantic notification sound.

**Meaning:** Opening another possibility feels useful while fragmenting attention. The other options can wait; the character does not prescribe closing every tab.

| Line ID                | File stem              | Exact spoken caption                                                      | Direction                                                    | Target    |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ | --------- |
| `pull.the-tab.meet`    | `en__the-tab__meet`    | I’m The Tab. I keep opening possibilities before the last one’s finished. | A small eager pivot at possibilities; amused self-awareness. | 4.1–5.5 s |
| `pull.the-tab.present` | `en__the-tab__present` | One more tab. We might need all of these.                                 | Make keeping options open sound reasonable, not compulsory.  | 2.8–3.8 s |
| `pull.the-tab.recede`  | `en__the-tab__recede`  | All right. The other tabs can wait.                                       | Let the pace settle; no abrupt shutdown sound.               | 2.2–3.2 s |

## 5. The Bookmark — Just one more minute

**Voice:** Paper-soft, attentive and a little reluctant to lose the thread; alert, not sleepy.

**Meaning:** Leaving feels like losing a place. Bookmark holds the place while another beginning gets the scene; reading and enjoyment are not framed as wrong.

| Line ID                     | File stem                   | Exact spoken caption                                          | Direction                                                      | Target    |
| --------------------------- | --------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | --------- |
| `pull.the-bookmark.meet`    | `en__the-bookmark__meet`    | I’m The Bookmark. I make leaving feel like losing your place. | A precise observation, with a small hesitation before losing.  | 3.9–5.1 s |
| `pull.the-bookmark.present` | `en__the-bookmark__present` | Just one more minute. What if we lose our place?              | A mild familiar bargain; no anxiety or pleading.               | 3.2–4.3 s |
| `pull.the-bookmark.recede`  | `en__the-bookmark__recede`  | I’ll keep the place. This bit can wait.                       | Practical and settled; leave a little space between sentences. | 2.6–3.6 s |

## 6. The Match — Going all out

**Voice:** Bright, focused and briefly buoyant; crisp spark, never a shout or manic caricature.

**Meaning:** A burst of enthusiasm can turn into doing everything now. Match yields without extinguishing the person’s interest or praising overwork.

| Line ID                  | File stem                | Exact spoken caption                                                | Direction                                                       | Target    |
| ------------------------ | ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------- | --------- |
| `pull.the-match.meet`    | `en__the-match__meet`    | I’m The Match. I turn a little spark into doing everything at once. | Start small; gently gather momentum through everything at once. | 4.2–5.5 s |
| `pull.the-match.present` | `en__the-match__present` | We have a spark. Let’s do it all right now.                         | Enthusiastic internal pitch, not a motivational command.        | 3.0–4.0 s |
| `pull.the-match.recede`  | `en__the-match__recede`  | All right. I’ll leave the rest for later.                           | Release the urgency, not the warmth; no disappointed fizzle.    | 2.6–3.6 s |

## 7. The Pillow — Putting off sleep

**Voice:** Soft-edged, companionable and conversational, not whispered, slurred or hypnotic.

**Meaning:** Staying up can feel like reclaiming personal time. Recede respects that need without prescribing sleep, diagnosing insomnia or shaming rest.

| Line ID                   | File stem                 | Exact spoken caption                                                    | Direction                                                          | Target    |
| ------------------------- | ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ | --------- |
| `pull.the-pillow.meet`    | `en__the-pillow__meet`    | I’m The Pillow. I make staying up feel like getting a little time back. | Empathic recognition; clear emphasis on staying up and time back.  | 4.7–6.0 s |
| `pull.the-pillow.present` | `en__the-pillow__present` | The day was busy. A little longer just for us?                          | A familiar invitation; no guilt, persuasion pressure or baby talk. | 3.3–4.5 s |
| `pull.the-pillow.recede`  | `en__the-pillow__recede`  | All right. I can let tonight be enough.                                 | A quiet release, with no yawn or coaching cadence.                 | 2.7–3.8 s |

## 8. The Kettle — Reacting in a rush

**Voice:** Warm but lightly wound up; urgency comes from pace, not volume, whistles or anger.

**Meaning:** A response can feel urgent before it is considered. Kettle yields a moment; this is ordinary reactive urgency, not advice to delay real emergencies.

| Line ID                   | File stem                 | Exact spoken caption                                            | Direction                                                         | Target    |
| ------------------------- | ------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- | --------- |
| `pull.the-kettle.meet`    | `en__the-kettle__meet`    | I’m The Kettle. I make an answer feel urgent before it’s ready. | Build mild pressure into urgent; keep the ending lucid and human. | 4.1–5.4 s |
| `pull.the-kettle.present` | `en__the-kettle__present` | It feels urgent. Shall we answer straight away?                 | A quick, plausible impulse—not a real alert.                      | 2.8–3.8 s |
| `pull.the-kettle.recede`  | `en__the-kettle__recede`  | All right. This answer can wait a moment.                       | Ease the tempo without adding an exhale or steam effect.          | 2.6–3.7 s |

## 9. The Ticker — Always rushing

**Voice:** Neat, measured and forward-leaning, with a slight rhythmic precision. Distinct from Kettle’s response pressure; no ticking effect or alarm tone.

**Meaning:** The next task can make the present feel late. Ticker yields this moment without claiming deadlines no longer matter.

| Line ID                   | File stem                 | Exact spoken caption                                                 | Direction                                                   | Target    |
| ------------------------- | ------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- | --------- |
| `pull.the-ticker.meet`    | `en__the-ticker__meet`    | I’m The Ticker. I make the next thing feel late before we get there. | Keep the words moving; a dry observation rather than panic. | 4.4–5.8 s |
| `pull.the-ticker.present` | `en__the-ticker__present` | We might be late. Better hurry through this bit.                     | Familiar hurry, without judging the listener’s pace.        | 3.0–4.0 s |
| `pull.the-ticker.recede`  | `en__the-ticker__recede`  | All right. I’ll leave this moment to you.                            | An even, unhurried handover; not a lesson in mindfulness.   | 2.6–3.7 s |

## 10. The Tape — Another quick fix

**Voice:** Handy, reassuring and breezily practical; a small dry smile, not a salesperson or comic repairman.

**Meaning:** A quick patch can feel like the whole repair. Tape remains available without insisting on another temporary fix or telling the person how to solve a problem.

| Line ID                 | File stem               | Exact spoken caption                                           | Direction                                                          | Target    |
| ----------------------- | ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ | --------- |
| `pull.the-tape.meet`    | `en__the-tape__meet`    | I’m The Tape. I make a quick patch feel like the whole repair. | Confident and practical; a little self-awareness on whole repair.  | 4.2–5.5 s |
| `pull.the-tape.present` | `en__the-tape__present` | A little patch will do. We can look underneath later.          | An easy temporary bargain; no promise that the repair is complete. | 3.1–4.3 s |
| `pull.the-tape.recede`  | `en__the-tape__recede`  | All right. I can stay on the roll for now.                     | Small dry warmth; stay on the roll is not a punchline.             | 3.0–4.1 s |

## 11. Integration checklist

- [ ] Audition all eight voices for distinction and clear phone-speaker playback.
- [ ] Approve this script revision and the selected voice identities; preserve the raw takes.
- [ ] Deliver 24 selected clean WAVs with exact filenames and no extra words.
- [ ] Match every caption by listening; record actual duration, loudness, peak and hash.
- [ ] Encode and register approved files in the existing voice manifest; do not add fictional URLs or hashes while files are missing.
- [ ] Verify one dialogue owner, explicit replay, music ducking and cancellation on mute/route/background changes.
- [ ] Confirm that expanding a locked premium shelf neither selects a character nor autoplays voice.
- [ ] Test iOS native, iOS browser, Android and caption-only before marking voice delivery complete.

Only English is authored here. Spanish, Croatian and German scripts—and optionally Italian—need separately reviewed translations using these same stable IDs. Do not switch to an English recording under a non-English caption by accident. Nothing in this document authorises paid generation or changes the six free characters.
