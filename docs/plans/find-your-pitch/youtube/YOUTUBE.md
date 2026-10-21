# Find Your Pitch on YouTube: the upload guide

Everything to fill in YouTube Studio for **Lesson 1, "What is a note?"** (master `rc-07`, 5:14)
and **Lesson 2, "Twelve notes"** (master `rc-04`, 7:11), plus the channel setup, packaging for the
other Season 1 lessons and the trailer, Shorts ideas and the thumbnails. Prepared 19 October 2026.
Every YouTube rule here was checked against YouTube's help pages that day (see [Sources](#sources)).

The plan is the authority: `docs/plans/find-your-pitch/` (MASTER-PLAN § 4.1 for packaging, § 12
for open decisions, CURRICULUM for hooks, each lesson's FACTS.md for claims). Every claim in a
title, description or thumbnail below is in that lesson's FACTS.md; the FACTS line is given where
it matters.

## Files in this folder

| File                                                   | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `YOUTUBE.md`                                           | This guide                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `lesson-01-thumb-a.jpg`, `-b.jpg`, `-c.jpg`            | Lesson 1 thumbnails, 1280x720 JPG, 147 to 194 KB. **Pick: A**                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `lesson-02-thumb-a.jpg`, `-b.jpg`, `-c.jpg`            | Lesson 2 thumbnails, 1280x720 JPG, 138 to 145 KB. **Pick: B**                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `lesson-0N-thumb-X.html`, `thumb-src/`, `checks/`      | **In the YouTube pack only (`find-your-pitch-youtube-pack1.zip`), not in git:** the Merc frames are source media, which stays out of git (MASTER-PLAN § 12 item 2). The `.html` page is the source of each thumbnail; `thumb-src/` holds the fonts (with their OFL licences), the film frames, the Merc frames, the render scripts and, in `thumb-src/out/`, the lossless PNG each JPG is encoded from; `checks/` has every thumbnail at 320x180 and 168x94, and a review sheet per lesson on a dark and a light feed |
| `end-screen-lesson-01.png`, `end-screen-lesson-02.png` | Real frames from each film's ending with the end-screen elements drawn where they go                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `paste/`                                               | The two descriptions and the tag lists as plain text, ready to paste (identical to the code blocks below)                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## 0. Before you upload: four gates

| Gate                                                 | Status today                                                                                                                                                                                                                                                                                                                                 | What to do                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A person listens and watches each master**         | Both DELIVERY.md files say it must happen before publishing: the new voices (casting, delivery, lip sync, pace), the examples on phone speakers, caption timing by eye; Lesson 1's 220 + 277 Hz near miss (2:28.3 to 2:31.4); Lesson 2's 0.3 s mid-grey field at 0:24.95 to 0:25.25 on a bright phone and its 0.4 s blank recap card changes | Watch both once on a phone and once on a large screen, with sound                                                                                                                                                                                                                                                                                                                                                                             |
| **The lesson pages exist**                           | `learn/01.html` and `learn/02.html` reached `main` on 19 October 2026 and are on the dev site, but the latest release, v0.9.21 (18 October), includes neither, and production deploys from release tags: `mercurypitch.com/learn/01` and `/learn/02` go live with the next release                                                           | Make the films public once that release is out and both pages load on `mercurypitch.com`. Uploading them as Private before then is fine: only you, and anyone you invite, can see a private video                                                                                                                                                                                                                                             |
| **The channel can use the features this plan needs** | Unknown                                                                                                                                                                                                                                                                                                                                      | Studio > Settings > Channel > Feature eligibility. Phone verification gives **custom thumbnails**. **Advanced features** (channel history, or ID or video verification) give **chapters, clickable links in the description, pinned comments, Test & compare** and a **Related Video on Shorts** ([9890437](https://support.google.com/youtube/answer/9890437)). Without them, the chapters and links in the descriptions below will not work |
| **Rights**                                           | Decided: the owner holds the rights to both ElevenLabs voices and to Merc's ElevenLabs-derived sung notes (MASTER-PLAN § 12 item 1)                                                                                                                                                                                                          | Nothing. Orange Merc's name and pronouns are still open (§ 12 item 1), so all copy here avoids pronouns for orange                                                                                                                                                                                                                                                                                                                            |

---

## A. Channel and series setup

### A1. The Season 1 playlist

| Field       | Value                                                                               |
| ----------- | ----------------------------------------------------------------------------------- |
| Title       | `Find Your Pitch, Season 1: music theory and singing for beginners` (65 characters) |
| Visibility  | Public, from the moment the first lesson goes public                                |
| Order       | Manual: Lesson 1 first; add each new lesson at the end                              |
| Description | Below. Update "Lessons 1 and 2 are out now" as lessons land                         |

```text
A free series from MercuryPitch that teaches music theory and singing from the very first note. Blue Merc explains; orange Merc asks the questions most of us would ask. Every lesson starts with a sound, shows you why, and ends with a short practice you can try free in MercuryPitch.

Season 1 begins with what a note is and builds towards matching a note with your own voice, singing a scale and a leap in tune, and hearing the chords under a song.

No theory needed. Sing gently, and never push.

Lessons 1 and 2 are out now, and the rest follow. Lesson pages, with sound toys and a quick check, start at https://mercurypitch.com/learn/01
```

(Season promise: MASTER-PLAN § 1. "Free": FACTS L1 22a and L2 26 and 31, MercuryPitch, Voice Mirror and Ear Lab.)

### A2. Upload defaults (set once: Studio > Settings > Upload defaults)

| Setting                                                              | Value                                                                                             | Why                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visibility                                                           | Private                                                                                           | Nothing goes public by accident; each lesson is scheduled on purpose                                                                                                                   |
| Description                                                          | The template below                                                                                | Every upload starts with the credits and the shape of the series description                                                                                                           |
| Tags                                                                 | `find your pitch, mercurypitch, music theory for beginners, learn to sing, singing for beginners` | The series words; each lesson adds its own (`paste/upload-defaults-tags.txt`)                                                                                                          |
| Licence                                                              | Standard YouTube Licence                                                                          | Creative Commons would let anyone reuse the voices and the Merc character ([2797468](https://support.google.com/youtube/answer/2797468))                                               |
| Category                                                             | Education                                                                                         |                                                                                                                                                                                        |
| Title and description language                                       | English (United Kingdom)                                                                          | British English is decided (§ 12 item 5)                                                                                                                                               |
| Video language                                                       | English (United Kingdom)                                                                          | The films are en-GB (both BRIEFs)                                                                                                                                                      |
| Caption certification                                                | This content has never aired on television in the U.S.                                            | True of both films                                                                                                                                                                     |
| Allow embedding                                                      | On                                                                                                | Others can embed; the lesson pages play their own copy from R2 anyway (§ 12 item 7)                                                                                                    |
| Publish to subscriptions feed and notify subscribers                 | On                                                                                                |                                                                                                                                                                                        |
| Allow automatic chapters (when available and eligible)               | **Off**                                                                                           | The descriptions carry the film's own chapters; YouTube documents this switch under Upload defaults > Advanced settings ([9884579](https://support.google.com/youtube/answer/9884579)) |
| Allow automatic featured places                                      | Off                                                                                               | No places in these films                                                                                                                                                               |
| Comments                                                             | On, comment moderation **Basic** (hold potentially inappropriate comments)                        | YouTube's levels are None, Basic, Strict and Hold all ([9483359](https://support.google.com/youtube/answer/9483359)); move to Strict if spam appears                                   |
| Show how many viewers like this video                                | On                                                                                                |                                                                                                                                                                                        |
| Shorts remixing                                                      | Allow (the default)                                                                               | Remixes credit and link back to the lesson ([10623810](https://support.google.com/youtube/answer/10623810)); the owner chose to allow it (owner decision 9)                            |
| Channel audience (Settings > Channel > Advanced settings > Audience) | "No, set this channel as not made for kids"                                                       | The owner's choice (owner decision 4; B1, Audience; [9527654](https://support.google.com/youtube/answer/9527654))                                                                      |

Description template for the defaults (fill the bracketed parts per lesson):

```text
[THE HOOK QUESTION, IN FULL]
The interactive lesson: https://mercurypitch.com/learn/[NN]

[TWO OR THREE SENTENCES: WHAT YOU WILL HEAR AND LEARN]

Chapters
00:00 [FIRST CHAPTER, FROM captions/chapters.json]

Practise
[THE LESSON'S PRACTISE LINK AND ITS SAFETY LINE]

Season 1 playlist: [PASTE PLAYLIST LINK]

Credits
Hosts: blue Merc and orange Merc, animated in code.
Voices: ElevenLabs (Eleven v3). [MERC'S SUNG NOTES LINE, IF THE FILM HAS THEM] Every other musical example is synthesised in code at its exact pitch; there is no recorded music.
Fonts: Outfit, Inter, Instrument Serif, JetBrains Mono and Noto Music, all under the SIL Open Font Licence 1.1.
Made by MercuryPitch, a free singing and playing studio: https://mercurypitch.com
```

### A3. The channel page: trailer slot and sections (Studio > Customization > Home tab > Layout)

| Slot                                                      | Set to                                      | When                                                        |
| --------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| Channel trailer (shown to people who have not subscribed) | Lesson 1                                    | Now; replace it with the Season 1 trailer when that is made |
| Spotlight (featured video for returning subscribers)      | The newest lesson: Lesson 2                 | Update with each release                                    |
| First featured section                                    | Created playlist: Find Your Pitch, Season 1 | From the first upload                                       |
| Second featured section                                   | Short videos                                | Once the first Shorts are up                                |

Source: [3219384](https://support.google.com/youtube/answer/3219384) (trailer, Spotlight, up to 12
sections). Channel art is still a Phase 1 Channel track item (MASTER-PLAN § 7) and is not part of
this package.

---

## B. Upload sheets

### B1. Lesson 1, "What is a note?" (`rc-07`)

**Upload this file:** `output/motion/lesson-01/renders/rc-07-60fps.mp4` (1920x1080, 60 fps, H.264,
AAC 48 kHz, 314.23 s by ffprobe). Not the `-music-only` copy.

#### Titles (up to 100 characters; front-loaded for phones)

| #                   | Title                                                     | Characters | Angle                                                                                    | Pair with thumbnail |
| ------------------- | --------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- | ------------------- |
| 1 (**recommended**) | `Why do musicians call 220 Hz and 440 Hz the same note?`  | 54         | The hook, shortened (CURRICULUM row 1); the question survives a phone cut after "440 Hz" | A                   |
| 2                   | `Twice as fast, yet the same note: the octave, explained` | 55         | The twist, then the payoff word                                                          | B                   |
| 3                   | `What is a musical note? Pitch and octaves for beginners` | 55         | Search-style, in the audience's words (§ 4.1)                                            | C                   |

Claims: 440 Hz is twice 220 Hz and both are called A (FACTS 7, 9, 15); "the same note" is the
film's own phrase ("The same note, one octave up!", 4:47); pitch and octaves are what the lesson
teaches (FACTS 1, 3, 7). Put title 1 first: it is the fallback if a test is inconclusive.

#### Description (paste as is; replace the two bracketed links)

1,557 of 5,000 characters (1,557 bytes); no `<` or `>`; the first two lines are the hook and the lesson page.

```text
If 440 Hz shakes the air twice as fast as 220 Hz, why do musicians call them the same note?
The interactive lesson, with sound toys and a quick check: https://mercurypitch.com/learn/01

Find Your Pitch, Lesson 1: What is a note? Blue Merc teaches and orange Merc asks the questions. Every note starts with something shaking. You'll hear why faster swings sound higher, and why loud is something else; why doubling the frequency gives the same note an octave up; why pitch is more like a spiral than a straight line; and how note names such as A4 and C4 work.

Chapters
00:00 The puzzle
00:26 A note is something shaking
01:05 Faster, not louder
01:28 Twice as fast
02:04 The simplest fit
02:36 The octave ladder
02:55 Pitch is a spiral
03:25 Names, numbers and the piano
03:52 Sing it
04:32 Quick check
05:01 Next time

Practise
Sing a note back in Voice Mirror. It is free, needs no account, and counts a match in any octave: https://mercurypitch.com/mirror
Keep it gentle. Never push.

Next: Lesson 2, Twelve notes: [PASTE LESSON 2 LINK]
Season 1 playlist: [PASTE PLAYLIST LINK]

Credits
Hosts: blue Merc and orange Merc, animated in code.
Voices: ElevenLabs (Eleven v3). Merc's sung notes: re-pitched from ElevenLabs takes. Every other musical example is synthesised in code at its exact pitch; there is no recorded music.
Fonts: Outfit, Inter, Instrument Serif, JetBrains Mono and Noto Music, all under the SIL Open Font Licence 1.1.
Made by MercuryPitch, a free singing and playing studio: https://mercurypitch.com

#MusicTheory #Singing #FindYourPitch
```

The three hashtags at the end show by the title (YouTube shows up to three;
[6390658](https://support.google.com/youtube/answer/6390658)). If a fact ever needs correcting after
publishing, add a `Correction:` line with its timestamp after the chapters: Studio then shows viewers
a "View corrections" card ([57404](https://support.google.com/youtube/answer/57404)).

#### Every field, in YouTube Studio's order

| Field                                                    | Set to                                                                                                                                                                                                                                                     | Note                                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title                                                    | Title 1 above                                                                                                                                                                                                                                              | Add titles 2 and 3 as an A/B test after it is public (E3)                                                                                                                                                                                               |
| Description                                              | The block above                                                                                                                                                                                                                                            | Its links are clickable only on a verified channel or one with Advanced features (Data API, `snippet.description`)                                                                                                                                      |
| Thumbnail                                                | `lesson-01-thumb-a.jpg`                                                                                                                                                                                                                                    | Then A/B testing: B and C (E3)                                                                                                                                                                                                                          |
| Playlists                                                | Find Your Pitch, Season 1                                                                                                                                                                                                                                  |                                                                                                                                                                                                                                                         |
| Audience                                                 | **No, it's not made for kids** (decided)                                                                                                                                                                                                                   | Owner decision 4, see below                                                                                                                                                                                                                             |
| Age restriction                                          | No, don't restrict my video to viewers over 18                                                                                                                                                                                                             | Nothing in it is age-sensitive                                                                                                                                                                                                                          |
| Paid promotion                                           | Leave unticked, if this is MercuryPitch's own channel                                                                                                                                                                                                      | See below                                                                                                                                                                                                                                               |
| AI use (shown as "Altered content" in some Studio views) | **No** (decided)                                                                                                                                                                                                                                           | Owner decision 5, see below                                                                                                                                                                                                                             |
| Automatic chapters                                       | **Untick** "Allow automatic chapters"                                                                                                                                                                                                                      | The description's chapters override automatic ones anyway                                                                                                                                                                                               |
| Featured places                                          | Untick                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                         |
| Tags                                                     | `find your pitch, mercurypitch, what is a note, what is pitch, music theory for beginners, octave explained, what is an octave, frequency and pitch, hertz, 440 hz, note names, middle c, scientific pitch notation, learn to sing, singing for beginners` | 260 of 500 characters (`paste/lesson-01-tags.txt`). YouTube says tags play a minimal role ([146402](https://support.google.com/youtube/answer/146402))                                                                                                  |
| Language and captions certification                      | Video language: English (United Kingdom). Caption certification: This content has never aired on television in the U.S.                                                                                                                                    |                                                                                                                                                                                                                                                         |
| Title and description language                           | English (United Kingdom)                                                                                                                                                                                                                                   |                                                                                                                                                                                                                                                         |
| Recording date and location                              | Optional: 17 October 2026 (rc-07's render date); location blank                                                                                                                                                                                            |                                                                                                                                                                                                                                                         |
| Licence                                                  | Standard YouTube Licence                                                                                                                                                                                                                                   |                                                                                                                                                                                                                                                         |
| Distribution                                             | Allow embedding: on. Publish to subscriptions feed and notify subscribers: on                                                                                                                                                                              |                                                                                                                                                                                                                                                         |
| Shorts remixing                                          | Allow (default)                                                                                                                                                                                                                                            | Owner decision 9                                                                                                                                                                                                                                        |
| Category                                                 | Education. Type: Concept overview                                                                                                                                                                                                                          | Leave Academic system, Level and Exam blank: it is not a school course                                                                                                                                                                                  |
| Comments and ratings                                     | Comments on, moderation Basic; show like count on                                                                                                                                                                                                          |                                                                                                                                                                                                                                                         |
| Subtitles (Video elements step)                          | Add language: **English (United Kingdom)** > Upload file > **With timing** > `docs/plans/find-your-pitch/lessons/01-what-is-a-note/captions/lesson-01.en.srt`                                                                                              | The SRT is YouTube's recommended basic format; the VTT beside it (`lesson-01.en.vtt`) has the same cues, for the web player. Both are plain ASCII, valid UTF-8 ([2734698](https://support.google.com/youtube/answer/2734698)). Never burn them in (D11) |
| End screen                                               | See the table below                                                                                                                                                                                                                                        |                                                                                                                                                                                                                                                         |
| Cards                                                    | See the table below                                                                                                                                                                                                                                        |                                                                                                                                                                                                                                                         |
| Checks                                                   | Copyright check                                                                                                                                                                                                                                            | Nothing third-party: the voices and Merc's sung notes are the owner's ElevenLabs output, and every other example is synthesised (DELIVERY)                                                                                                              |
| Visibility                                               | Schedule (B3)                                                                                                                                                                                                                                              |                                                                                                                                                                                                                                                         |

**Audience: made for kids?** Decided (19 October 2026): **No**, as recommended. The series is for "adults and teens who sing or
want to" (MASTER-PLAN § 1), and the films speak to them: hertz, frequency, octave numbers. YouTube
treats "content that is intended for a teen or older audience" as general audience, set as not made
for kids, and gives "animated content that appeals to everyone" as an example of general audience;
it also lists animated characters and cartoon figures among the factors to weigh, which is why this
was **the owner's legal call** under COPPA (under-13s in the US) and any local law, and YouTube itself
says it cannot give legal advice ([9528076](https://support.google.com/youtube/answer/9528076)).
"Yes" would switch off end screens, cards, comments, notifications and save to playlist
([9632097](https://support.google.com/youtube/answer/9632097)) and rule out Test & compare
([13861714](https://support.google.com/youtube/answer/13861714)).

**Paid promotion.** YouTube defines branded content as "content on YouTube influenced by a brand
partner in exchange for something of value" ([17596007](https://support.google.com/youtube/answer/17596007),
[154235](https://support.google.com/youtube/answer/154235)). MercuryPitch presenting its own free
app on its own channel has no brand partner, so leave it unticked. If the films go up on a channel
that MercuryPitch pays or rewards, tick it.

**AI use (altered or synthetic content).** Decided (19 October 2026): **No**, as recommended. YouTube's current page says
creators must disclose AI content "that seems realistic": content that makes a real person appear to
say or do something they didn't, alters footage of a real event or place, generates a realistic scene
that didn't occur, or creates music that is the main focus of the video. It lists "Using an
AI-generated or altered animation of a missile in a fully animated video" among the cases that need
no disclosure ([14328491](https://support.google.com/youtube/answer/14328491)). Here the hosts
are animated resin droplets, the speaking voices are ElevenLabs Voice Design voices that imitate
no real person (MERC-BIBLE § 4; research/brand-motion.md: "No cloning"), Merc's sung notes are
single held "ooh" notes, not music as the main focus, and every other musical example is
synthesised in code, not generated by AI. The credits name ElevenLabs, so
viewers are told anyway. YouTube may still label a video automatically if its systems detect AI
audio; you can then change the answer to No in most cases (same page). Choosing Yes is allowed too:
YouTube then labels the video, and for animated content or non-music AI audio the label may sit in
the expanded description. Owner decision 5.

#### Chapters: YouTube's rules, checked

| Rule ([9884579](https://support.google.com/youtube/answer/9884579)) | Lesson 1                                                                  | OK  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- | --- |
| The first timestamp is 00:00                                        | 00:00 The puzzle                                                          | Yes |
| At least three timestamps, ascending                                | 11, ascending                                                             | Yes |
| Each chapter at least 10 s                                          | Shortest: 05:01 to the end (5:14.23), 13.2 s                              | Yes |
| The same chapters as the film's own                                 | Identical to `captions/chapters.json` in the plan and in the film project | Yes |

Chapters need Advanced features on the channel (same page, and [9890437](https://support.google.com/youtube/answer/9890437)).

#### End screen

YouTube allows elements only in the **last 5 to 20 seconds**, up to four on a 16:9 video, each with
its own start time; a video or playlist element may be public or unlisted
([6388789](https://support.google.com/youtube/answer/6388789)). In this film the earliest start is
4:54.2. The film's own end card starts at **5:09.0** and is only 5.2 s long, with the practise address
from 5:10.2, so the end screen starts on "Next time" and every element stays off the film's words.

| #   | Element                      | Shows                    | From                                  | To         | Where (drag in the editor; see `end-screen-lesson-01.png`)                                                                                           |
| --- | ---------------------------- | ------------------------ | ------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Video: Choose specific video | Lesson 2, "Twelve notes" | **5:02.0** (blue: "Next time.")       | 5:14 (end) | Bottom-left, as far left and down as the editor allows: about 1 % to 33 % across, 60 % to 92 % down. Its right edge then just meets blue Merc's glow |
| 2   | Subscribe                    | The channel              | **5:08.0** (orange: "See you there.") | 5:14 (end) | Bottom-right, centred about 83 % across and 71 % down, clear of orange Merc                                                                          |

- **Keep clear:** from 5:02 the "Next: Seven letters, twelve notes." title and the keyboard (top half);
  from 5:09 the MercuryPitch lockup, "Find your pitch." and "Practise it free:
  mercurypitch.com/mirror" (everything above about 51 % of the frame's height). Both elements sit below it.
- End screen length: 5:02.0 to 5:14.2 is 12.2 s, inside 5 to 20 s.
- YouTube publishes no element sizes. The map uses the sizes a third-party guide measured, about
  613x343 px for a video and 298 px across for Subscribe on a 1920x1080 frame
  ([CollabPals](https://www.collabpals.com/tools/youtube-end-screen-previewer)), so check the
  placement on the editor's own preview.
- A playlist element is left out on purpose: at the end of Lesson 1 it would start the playlist at
  Lesson 1 again.
- If Lesson 2 is not yet public or unlisted when you set this, choose "Best for viewer" and switch
  it to Lesson 2 later.

#### Cards (up to five; desktop viewers only; video and playlist cards need a public target)

| Time | Card                                                                 | Teaser text (optional)                 | The moment                                                                                                                             |
| ---- | -------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 0:24 | Playlist: Find Your Pitch, Season 1                                  | The whole season, in order             | The title sting names the series and the lesson                                                                                        |
| 3:22 | Video: Lesson 2, "Twelve notes"                                      | Where do the other five come from?     | Blue: "The other five are next time's story."                                                                                          |
| 4:05 | Link (YouTube Partner Program only): https://mercurypitch.com/mirror | Try it: Voice Mirror counts any octave | Blue: "So when you match a note, an octave up or down still counts", beside the film's own "Voice Mirror counts any octave" (FACTS 19) |

Source: [6140493](https://support.google.com/youtube/answer/6140493). Card teasers are suppressed during
the end screen ([6388789](https://support.google.com/youtube/answer/6388789)).

#### Pinned comment (pinning needs Advanced features)

```text
Quick check from the end of the lesson: why do A3 and A4 share a letter? Answer in your own words below. Then hear it for yourself with the lesson's sound toys: https://mercurypitch.com/learn/01
Want to try your own voice? Voice Mirror is free, needs no account and counts a match in any octave: https://mercurypitch.com/mirror
```

---

### B2. Lesson 2, "Twelve notes" (`rc-04`)

**Upload this file:** `output/motion/lesson-02/renders/rc-04-60fps.mp4` (1920x1080, 60 fps, H.264,
AAC 48 kHz, 431.08 s by ffprobe). Not the `-music-only` copy.

#### Titles

| #                   | Title                                                                 | Characters | Angle                                                     | Pair with thumbnail |
| ------------------- | --------------------------------------------------------------------- | ---------- | --------------------------------------------------------- | ------------------- |
| 1 (**recommended**) | `Why are there 12 notes but only 7 letters?`                          | 42         | The hook as a plain question; fits any phone layout whole | B                   |
| 2                   | `Why is there no black key between B and C?`                          | 42         | Search-style, in the audience's words                     | A                   |
| 3                   | `Seven letters, but twelve notes: where do the other five come from?` | 67         | The film's own words, Lesson 1's closing line             | C                   |

All three are the BRIEF's own Test & compare variants (Lesson 2 BRIEF, Hook). Claims: seven letters
and twelve notes in an octave (FACTS 13, 15); no black key between B and C (FACTS 14). Titles 1 and 2
are paired with each other's thumbnail on purpose, so the title and the picture add up instead of
repeating each other.

#### Description (paste as is; replace the two bracketed links)

1,806 of 5,000 characters (1,807 bytes); no `<` or `>`; the first two lines are the hook and the lesson page.

```text
Musicians only use seven letters, so where do the other five notes come from?
The interactive lesson: https://mercurypitch.com/learn/02

Find Your Pitch, Lesson 2: Twelve notes. Blue Merc and orange Merc find all twelve notes in an octave. You'll hear the very next note up from A, count twelve equal steps back to A, see why there is no black key between B and C (or between E and F), learn why one key can carry two names, such as C sharp and D flat, and measure a semitone in cents, the unit MercuryPitch measures in.

Chapters
00:00 The missing five
00:35 The very next note
00:48 Twelve equal steps
01:35 The keyboard
01:48 B to C
02:52 Where the five come from
03:19 Sharps and flats
04:25 Cents
05:06 Sing a semitone
05:57 Quick check
06:49 Next time

Practise
In Ear Lab's Leap, listen for the semitone (m2) and the tone (M2). Leap mixes all twelve intervals; these are the two from this lesson. Ear Lab is free: https://mercurypitch.com/ear-lab
First visit? MercuryPitch opens with its intro: close it with the × at the top right ("Skip the intro").
Singing the slide: hum it quietly, or sing it on ooh. Never push, and stop if anything feels uncomfortable.

New here? Start with Lesson 1, What is a note?: [PASTE LESSON 1 LINK]
Season 1 playlist: [PASTE PLAYLIST LINK]

Credits
Hosts: blue Merc and orange Merc, animated in code.
Voices: ElevenLabs (Eleven v3). Merc's two sung notes in the opening: re-pitched from ElevenLabs takes. Every other musical example, both semitone slides included, is synthesised in code at its exact pitch; there is no recorded music.
Fonts: Outfit, Inter, Instrument Serif, JetBrains Mono and Noto Music, all under the SIL Open Font Licence 1.1.
Made by MercuryPitch, a free singing and playing studio: https://mercurypitch.com

#MusicTheory #Singing #FindYourPitch
```

Line 2 links `/learn/02`, which goes live with the next release (gate 2). When the `ear-drill` launch with a bank
subset ships, switch the Practise link to the proposed `/exercises/semitone-or-tone`, as Lesson 2's
BRIEF and DECISIONS 72 and 73 say. Never write "Ear Lab needs no account": it is not in FACTS
(Unsupported list).

#### Every field, in YouTube Studio's order

| Field                               | Set to                                                                                                                                                                                                                                                                                               | Note                                                                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title                               | Title 1 above                                                                                                                                                                                                                                                                                        | A/B test the other two after it is public (E3)                                                                                                                                                                          |
| Description                         | The block above                                                                                                                                                                                                                                                                                      |                                                                                                                                                                                                                         |
| Thumbnail                           | `lesson-02-thumb-b.jpg`                                                                                                                                                                                                                                                                              | Then A/B testing: A and C (E3)                                                                                                                                                                                          |
| Playlists                           | Find Your Pitch, Season 1                                                                                                                                                                                                                                                                            |                                                                                                                                                                                                                         |
| Audience                            | **No, it's not made for kids** (decided)                                                                                                                                                                                                                                                             | Owner decision 4, as for Lesson 1                                                                                                                                                                                       |
| Age restriction                     | No, don't restrict my video to viewers over 18                                                                                                                                                                                                                                                       |                                                                                                                                                                                                                         |
| Paid promotion                      | Leave unticked, if this is MercuryPitch's own channel                                                                                                                                                                                                                                                | As for Lesson 1                                                                                                                                                                                                         |
| AI use                              | **No** (decided)                                                                                                                                                                                                                                                                                     | As for Lesson 1: animated hosts, voices that imitate no real person, ElevenLabs credited; the two sung notes in the opening are the only ElevenLabs-derived singing, and both slides are synthesised (FACTS 41, 50, 51) |
| Automatic chapters                  | **Untick**                                                                                                                                                                                                                                                                                           |                                                                                                                                                                                                                         |
| Featured places                     | Untick                                                                                                                                                                                                                                                                                               |                                                                                                                                                                                                                         |
| Tags                                | `find your pitch, mercurypitch, twelve notes, why are there 12 notes, semitone, tone and semitone, half step and whole step, sharps and flats, enharmonic notes, black keys on piano, no black key between b and c, cents in music, piano keyboard layout, music theory for beginners, ear training` | 302 of 500 characters (`paste/lesson-02-tags.txt`)                                                                                                                                                                      |
| Language and captions certification | Video language: English (United Kingdom). Caption certification: This content has never aired on television in the U.S.                                                                                                                                                                              |                                                                                                                                                                                                                         |
| Title and description language      | English (United Kingdom)                                                                                                                                                                                                                                                                             |                                                                                                                                                                                                                         |
| Recording date and location         | Optional: 18 October 2026 (rc-04's render date); location blank                                                                                                                                                                                                                                      |                                                                                                                                                                                                                         |
| Licence                             | Standard YouTube Licence                                                                                                                                                                                                                                                                             |                                                                                                                                                                                                                         |
| Distribution                        | Allow embedding: on. Publish to subscriptions feed and notify subscribers: on                                                                                                                                                                                                                        |                                                                                                                                                                                                                         |
| Shorts remixing                     | Allow (default)                                                                                                                                                                                                                                                                                      | Owner decision 9                                                                                                                                                                                                        |
| Category                            | Education. Type: Concept overview                                                                                                                                                                                                                                                                    |                                                                                                                                                                                                                         |
| Comments and ratings                | Comments on, moderation Basic; show like count on                                                                                                                                                                                                                                                    |                                                                                                                                                                                                                         |
| Subtitles (Video elements step)     | Add language: **English (United Kingdom)** > Upload file > **With timing** > `docs/plans/find-your-pitch/lessons/02-twelve-notes/captions/lesson-02.en.srt`                                                                                                                                          | Same cues as `lesson-02.en.vtt`; both plain ASCII. The plan's copies are identical to the film project's                                                                                                                |
| End screen                          | See the table below                                                                                                                                                                                                                                                                                  |                                                                                                                                                                                                                         |
| Cards                               | See the table below                                                                                                                                                                                                                                                                                  |                                                                                                                                                                                                                         |
| Checks                              | Copyright check                                                                                                                                                                                                                                                                                      | Nothing third-party (DELIVERY)                                                                                                                                                                                          |
| Visibility                          | Schedule (B3)                                                                                                                                                                                                                                                                                        |                                                                                                                                                                                                                         |

#### Chapters: YouTube's rules, checked

| Rule ([9884579](https://support.google.com/youtube/answer/9884579)) | Lesson 2                                                                                    | OK  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --- |
| The first timestamp is 00:00                                        | 00:00 The missing five                                                                      | Yes |
| At least three timestamps, ascending                                | 11, ascending                                                                               | Yes |
| Each chapter at least 10 s                                          | Shortest: 00:35 to 00:48 and 01:35 to 01:48, 13 s each (13.0 s and 13.1 s by the cue sheet) | Yes |
| The same chapters as the film's own                                 | Identical to `captions/chapters.json` and FACTS 54                                          | Yes |

#### End screen

The earliest start is **6:51.1** (20 s before 7:11.08). Until 7:05.6 the frame holds Lesson 3's hook
figures, "59 %" asked and "10–16 %" tested; the film's end card runs from **7:05.9** to the end, 5.2 s,
with the practise address from 7:07.1 and the Leap legend between the hosts. **There is no clear
16:9 slot in this ending**: the Mercs stand at 29 % and 71 % across, leaving about 420 px at each side,
and a video or playlist element is about 613 px wide.

| #   | Element   | Shows                     | From                                            | To         | Where (see `end-screen-lesson-02.png`)                                                                                             |
| --- | --------- | ------------------------- | ----------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Subscribe | The channel               | **7:04.0** (orange: "So what's going on?")      | 7:11 (end) | Bottom-right, centred about 90 % across and 71 % down, clear of orange Merc                                                        |
| 2   | Playlist  | Find Your Pitch, Season 1 | **7:06.0** (the end card; 5.1 s before the end) | 7:11 (end) | Bottom-left, as far left and down as allowed. **It covers most of blue Merc for the last 5 s**; it covers none of the film's words |

- End screen length: 7:04.0 to 7:11.1 is 7.1 s, inside 5 to 20 s.
- **Keep clear:** the "59 %" and "10–16 %" figures (to 7:05.6), then the lockup, "Find your
  pitch.", "Practise it free: mercurypitch.com/ear-lab" and the Leap legend "In Leap: m2 = semitone ·
  M2 = tone".
- The owner chose this over Subscribe alone (owner decision 8). The real fix is a film change for the next
  render, which both films already have polish items for: hold the end card 12 to 15 s with the
  hosts to one side and the lower left third kept empty, as the production research proposed (a
  12 to 15 s end slate with video slots and a subscribe zone).
- When Lesson 3 is out, swap the playlist element for "Video: Lesson 3": the film ends on its hook.

#### Cards

| Time             | Card                                                                  | Teaser text (optional)      | The moment                                                       |
| ---------------- | --------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| 0:25             | Playlist: Find Your Pitch, Season 1                                   | The whole season, in order  | The title sting                                                  |
| 1:15             | Video: Lesson 1, "What is a note?"                                    | Missed Lesson 1? Start here | Orange: "Last time, the gaps in hertz kept growing."             |
| 6:43             | Link (YouTube Partner Program only): https://mercurypitch.com/ear-lab | Practise it free in Ear Lab | Blue: "In Ear Lab's Leap, listen for the semitone and the tone." |
| 6:50 (add later) | Video: Lesson 3, once public                                          | So what's going on?         | Lesson 3's hook starts here                                      |

#### Pinned comment

```text
Ear test from the lesson: B to C, or C to D. Which step is bigger? Reply with your answer before you replay 2:10.
Then practise hearing a semitone and a tone in Ear Lab's Leap, free: https://mercurypitch.com/ear-lab
First visit? MercuryPitch opens with its intro: close it with the × at the top right ("Skip the intro").
```

---

### B3. Release: premiere or schedule?

The plan's launch is "the trailer and Lessons 1 to 3 together or on consecutive days, then a fixed
weekly day" (MASTER-PLAN § 4.1). Only Lessons 1 and 2 exist, and Lesson 3 waits on a vocal coach who
is not chosen yet (§ 12 item 8), so the batch cannot happen soon.

| Option              | What                                                                                                                                                           | For                                                                                                                                                | Against                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **A (recommended)** | Schedule both for the same day, once the gates in section 0 pass: Lesson 1 at 17:00 UK time, Lesson 2 an hour later. Ordinary scheduled uploads, not Premieres | A new viewer can watch the pair straight away; Lesson 1's end screen and card can point to Lesson 2 from day one; both A/B tests can start at once | One launch day instead of two                                                       |
| B                   | Consecutive days, same time                                                                                                                                    | Two "new video" days; closest to the plan's wording                                                                                                | Lesson 1's Lesson 2 card and end screen must wait a day (cards need a public video) |
| C                   | Hold both until the trailer and Lesson 3 exist                                                                                                                 | The plan's batch                                                                                                                                   | Indefinite: Lesson 3 is blocked on the coach                                        |

Then a fixed weekly day for every later lesson, the weekday Lessons 1 and 2 went out. 17:00 UK is
morning on the US west coast; YouTube dates the "Published on" line by Pacific time, so it stays the
same day ([1270709](https://support.google.com/youtube/answer/1270709)). Revisit the time once
Analytics shows when your viewers are on YouTube.

**Why not a Premiere for these two:** a new channel has no audience to gather yet, a Premiere's
watch page goes public before the video plays, and Test & compare only works on a Premiere after it
ends ([9080341](https://support.google.com/youtube/answer/9080341),
[13861714](https://support.google.com/youtube/answer/13861714)). A Premiere suits the Season 1
trailer later, when there are subscribers to remind; Premieres take 1080p, which both masters are.

**Lesson 1's planned re-voice.** The Phase 1 Voices track re-voices Lesson 1 ("Hum it back" becomes
"Sing it back, or hum along", plus a spoken promise after the title sting; MASTER-PLAN § 7). YouTube
cannot swap the file under a published video, and the plan uploads a re-cut "only as a new video,
when retrieval lags badly" (§ 7, Phase 4). Publishing `rc-07` now means the re-voiced cut would
replace it only on the lesson page, not on YouTube (owner decision 1).

---

## C. The other lessons: packaging for Lessons 3 to 14 and the trailer

Each row rests on its CURRICULUM card and season hook. Lessons 3 to 10 also have a FACTS.md, which
the row was checked against; Lessons 11 to 14 and the trailer have no FACTS.md yet, so re-check
every title and thumbnail word against theirs when they are written. Line 1 of each description is
the CURRICULUM hook, word for word; line 2 is the lesson page (§ 12 item 9:
`mercurypitch.com/learn/NN`). Voice lessons (3, 5, 7, 9, 11, 13, 14) publish only after the vocal
coach signs them off (§ 7).

| Lesson                                                                                                                                                                                                                  | Titles (recommended first)                                                                                                                                                                                       | Thumbnail: words, picture, colour                                                                                                                                                                                                                                                              | Description, first two lines                                                                                                                                         | Tags                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trailer: Find your pitch<br><br>Note: Not written yet: no FACTS.md. "Free" means free to watch; the lessons themselves are Proposed free (§ 12 item 3)                                                                  | 1. What if you could see every note you sing? (**recommended**)<br>2. Find Your Pitch: free music theory and singing lessons for beginners<br>3. Learn music theory and singing from scratch: Season 1 trailer   | Words: "See every note"<br>Picture: Both Mercs singing over MercuryPitch's pitch line: the singer's violet line riding the amber target band, as in Lesson 1 at 1:22 and Lesson 2 at 5:06<br>Colour: Obsidian, amber band, violet line, white type                                             | 1: What if you could see every note you sing?<br>2: Start with Lesson 1, What is a note?: [PASTE LESSON 1 LINK]                                                      | find your pitch, mercurypitch, music theory for beginners, learn to sing, singing for beginners, how to sing in tune, how to match pitch, ear training, music theory course, singing lessons, pitch training, voice lessons<br>(12 tags, 230 of 500 characters) |
| 3. Match a note (voice; coach gate)<br><br>Note: Title 1 is the plan's own YouTube title (CURRICULUM card); the thumbnail carries the evidence, never the label. "Asked" and "Tested" are different groups (L3 FACTS 5) | 1. Can you really be tone deaf? (**recommended**)<br>2. Asked, 59% said they couldn't copy a tune. Tested, only 10 to 16% missed by a semitone<br>3. How to match pitch with your voice, for beginners           | Words: "Asked 59%. Tested 10–16%"<br>Picture: The two figures side by side, as Lesson 2 draws them at 6:49 and as Lesson 3's cold open repeats them (L3 FACTS 44a), with orange Merc puzzled below<br>Colour: White figures on Obsidian; the amber band with a violet line a semitone under it | 1: Asked, most students said they couldn't copy a tune. Tested, most could. So what's going on?<br>2: The interactive lesson: https://mercurypitch.com/learn/03      | tone deaf, can you be tone deaf, how to match pitch, how to sing in tune, pitch matching, singing for beginners, learn to sing, poor pitch singing, amusia, singing in tune, find your pitch, mercurypitch, voice mirror<br>(13 tags, 226 of 500 characters)    |
| 4. The major scale and home<br><br>Note: "Home" is the series' word for the tonic, backed by what listeners hear (L4 FACTS 17, 23)                                                                                      | 1. Why does do-re-mi sound finished on do and restless on ti? (**recommended**)<br>2. The major scale explained: the step pattern behind do-re-mi<br>3. How to build a major scale on any note                   | Words: "Do = home?"<br>Picture: The uneven staircase of the major scale (two half-size steps), ti glowing, a short arrow up to do; blue Merc on the top step<br>Colour: Chrome steps; the ti-to-do semitone in gold (the fit)                                                                  | 1: Why does do-re-mi sound finished when it lands on do, and restless when it stops on ti?<br>2: The interactive lesson: https://mercurypitch.com/learn/04           | major scale, do re mi, solfege, movable do, tonic, scale degrees, whole and half steps, how to build a major scale, leading note, music theory for beginners, find your pitch, mercurypitch<br>(12 tags, 194 of 500 characters)                                 |
| 5. Breath and a steady note (voice; coach gate)<br><br>Note: "Support" has no agreed definition (L5 FACTS 25): the titles ask, they never define or rate it                                                             | 1. Breath support isn't pushing. So what keeps a long note steady? (**recommended**)<br>2. If support doesn't mean pushing, what keeps a note steady?<br>3. How to hold a steady note without pushing            | Words: "Support = push?"<br>Picture: A held note's violet line settling from a wobble into a narrow amber band; blue Merc holding the note, glowing<br>Colour: Amber band, violet line, Obsidian                                                                                               | 1: Singers are told to "support" a long note. If that doesn't mean pushing, what keeps it steady?<br>2: The interactive lesson: https://mercurypitch.com/learn/05    | breath support, breath support singing, how to hold a long note, steady note singing, breathing for singers, diaphragm singing, onset singing, long note, singing for beginners, find your pitch, mercurypitch<br>(11 tags, 216 of 500 characters)              |
| 6. Intervals: the distance between notes<br><br>Note: Both tunes are public domain in the UK and US (L6 FACTS 28, 29)                                                                                                   | 1. Why is 'Twinkle, Twinkle' the same tune on any starting note? (**recommended**)<br>2. Intervals explained: a tune is a pattern of distances<br>3. What is an interval in music? Steps, leaps and transposing  | Words: "Same tune?"<br>Picture: The "Twinkle" contour drawn twice, the same shape at two heights; both Mercs<br>Colour: One contour in blue, one in orange: each host's note                                                                                                                   | 1: Why can you start "Twinkle, Twinkle" on any note and it is still the same tune?<br>2: The interactive lesson: https://mercurypitch.com/learn/06                   | intervals in music, what is an interval, transposition, twinkle twinkle little star, relative pitch, steps and leaps, melody, music theory for beginners, ear training, find your pitch, mercurypitch<br>(11 tags, 203 of 500 characters)                       |
| 7. Slides, sirens and your range (voice; coach gate)<br><br>Note: Never reward the widest range (playbook house rules)                                                                                                  | 1. Why is your comfortable middle worth more than your highest note? (**recommended**)<br>2. How to find your vocal range, gently<br>3. Sirens, slides and your range: a gentle warm-up                          | Words: "Find your middle"<br>Picture: A siren's violet line sweeping up and down the chart, the comfortable middle band lit, the extremes dimmed; orange Merc riding the glide<br>Colour: Violet line, a soft amber middle band, dim edges                                                     | 1: Why is your comfortable middle worth more than your highest note?<br>2: The interactive lesson: https://mercurypitch.com/learn/07                                 | vocal range, how to find your vocal range, vocal range test, voice types, siren warm up, lip trill, singing warm up, comfortable singing range, singing for beginners, find your pitch, mercurypitch<br>(11 tags, 206 of 500 characters)                        |
| 8. Beat, tempo and the backbeat<br><br>Note: Show the march-versus-rock feel; never state it as a statistic (CURRICULUM card)                                                                                           | 1. Why does clapping on 2 and 4 feel so different from 1 and 3? (**recommended**)<br>2. Beat, tempo and the backbeat, explained for beginners<br>3. Rhythm isn't just speed: what a backbeat is                  | Words: "2 and 4?"<br>Picture: A step-sequencer grid under a metronome arm, beats 2 and 4 lit; the Mercs hopping on the beat (they have no hands to clap)<br>Colour: Gold on 2 and 4, chrome on 1 and 3                                                                                         | 1: Why does the same song feel different when you clap on 2 and 4 instead of 1 and 3?<br>2: The interactive lesson: https://mercurypitch.com/learn/08                | backbeat, beat and tempo, clap on 2 and 4, rhythm for beginners, time signatures, bars and beats, metronome, groove, music theory for beginners, find your pitch, mercurypitch<br>(11 tags, 178 of 500 characters)                                              |
| 9. Landing a leap (voice; coach gate)<br><br>Note: The hook changed on 20 October 2026: "so much harder" needs a source (CURIOSITY-MOMENTS § 2), and the old wording is an alternative the admin console can switch to  | 1. How do you land a note you have to leap to? (**recommended**)<br>2. How to sing a leap in tune: thirds, fifths and octaves<br>3. Don't jump and hope: how to land a leap                                      | Words: "Jump or step?"<br>Picture: A leap drawn as an arc landing in the amber target band, beside a staircase of small steps; blue Merc mid-hop<br>Colour: Amber band, violet arc                                                                                                             | 1: How do you land a note you have to leap to?<br>2: The interactive lesson: https://mercurypitch.com/learn/09                                                       | singing intervals, how to sing in tune, singing leaps, arpeggio, sing a fifth, sing an octave, interval training, ear training, singing for beginners, find your pitch, mercurypitch<br>(11 tags, 188 of 500 characters)                                        |
| 10. Major and minor<br><br>Note: Minor is do-based (§ 12 item 12, decided 19 October 2026); it changes no title                                                                                                         | 1. Which single note turns a major chord minor? (**recommended**)<br>2. Major vs minor chords, by ear: one note, one semitone<br>3. Is minor always sad? Major and minor, explained                              | Words: "Major to minor?"<br>Picture: A chord of three beads, the middle one (the third) sliding down one semitone; orange Merc watching<br>Colour: Chrome beads, the third in gold; never "sad" blue, since the lesson refutes minor = sad                                                     | 1: Which single note turns a major chord into a minor one?<br>2: The interactive lesson: https://mercurypitch.com/learn/10                                           | major and minor, major vs minor chords, minor third, major third, triads, natural minor scale, chord quality, ear training, music theory for beginners, find your pitch, mercurypitch<br>(11 tags, 189 of 500 characters)                                       |
| 11. Registers and the break (voice; coach gate)<br><br>Note: Never frame registers as a problem; the app does not detect registers (CURRICULUM card)                                                                    | 1. Why does your voice flip at roughly the same note every time? (**recommended**)<br>2. Voice cracks are normal: registers and the break, explained<br>3. Chest voice, head voice and the break, for beginners  | Words: "Why the flip?"<br>Picture: A siren's violet line crossing a soft grey seam that narrows on each pass; orange Merc riding the glide<br>Colour: Violet line, grey seam; never red, because a break is not a problem                                                                      | 1: Why does your voice flip at roughly the same note every time you slide up?<br>2: The interactive lesson: https://mercurypitch.com/learn/11                        | vocal break, voice crack, chest voice and head voice, vocal registers, falsetto, mixed voice, singing slides, singing for beginners, find your pitch, mercurypitch<br>(10 tags, 169 of 500 characters)                                                          |
| 12. Chords and the four-chord song<br><br>Note: The titles avoid "hundreds": put that number in FACTS.md before it goes in any title                                                                                    | 1. Same four chords, different songs: how does that work? (**recommended**)<br>2. I-V-vi-IV explained: the four-chord progression for beginners<br>3. How chords come from a scale: Roman numerals for beginners | Words: "Same 4 chords?"<br>Picture: Four chord rooms on the spiral, a melody path walking through them; blue Merc pointing<br>Colour: Chrome rooms, gold path                                                                                                                                  | 1: How can two songs share the same four chords and still sound different?<br>2: The interactive lesson: https://mercurypitch.com/learn/12                           | four chord song, I V vi IV, chord progressions, roman numerals, chords in a key, diatonic chords, music theory for beginners, play along, find your pitch, mercurypitch<br>(10 tags, 176 of 500 characters)                                                     |
| 13. Resonance and vowels (voice; coach gate)<br><br>Note: The app must not claim to assess vowels (CURRICULUM card)                                                                                                     | 1. Same note, same pitch line: why do 'ee' and 'ah' sound different? (**recommended**)<br>2. Vowels, harmonics and resonance, explained for singers<br>3. Why changing the vowel doesn't change the note         | Words: "Ee or ah?"<br>Picture: One flat pitch line over two different harmonic spectra (the stats site's LED analyser), peaks in different places; blue Merc singing<br>Colour: Wave cyan #52c2cc spectra, amber pitch line                                                                    | 1: If "ee" and "ah" sung on the same note draw the same pitch line, what makes them sound different?<br>2: The interactive lesson: https://mercurypitch.com/learn/13 | vowels in singing, resonance, harmonics, overtones, formants, timbre, vocal tract, singing for beginners, find your pitch, mercurypitch<br>(10 tags, 134 of 500 characters)                                                                                     |
| 14. Phrasing: sing a whole song (voice; coach gate)<br><br>Note: The song is public domain or original (MASTER-PLAN § 7, Phase 3)                                                                                       | 1. Every note right, but something's missing? Phrasing for singers (**recommended**)<br>2. How to phrase a song: breaths, dynamics and shape<br>3. From correct to compelling: sing a whole song                 | Words: "What's missing?"<br>Picture: A whole song's pitch line with breath marks and one swell drawn in light; both Mercs<br>Colour: Violet line, gold swell                                                                                                                                   | 1: If you can hit every note of a song, what is still missing between correct and compelling?<br>2: The interactive lesson: https://mercurypitch.com/learn/14        | phrasing in singing, breathing while singing, dynamics in singing, messa di voce, how to sing a song, singing with expression, record yourself singing, singing for beginners, find your pitch, mercurypitch<br>(10 tags, 213 of 500 characters)                |

---

## D. Shorts: five vertical clips from the two films

The plan wants two Shorts per episode, the cold-open puzzle (30 to 60 s, ending on the question) and
a sing-along, **recomposed as 9:16 sibling projects, never letterboxed**, with captions burned in
(MASTER-PLAN § 4.1, D11). These five are cut from the masters' own timings (the cue sheets). Keep
each under 60 s: a Short over one minute with any copyright claim is blocked worldwide
([15424877](https://support.google.com/youtube/answer/15424877)); these carry no third-party audio,
but staying under a minute removes the risk. Link each Short to its lesson as the Related Video
(Advanced features; [57404](https://support.google.com/youtube/answer/57404)).

| #   | From                        | Cut (film time)                                                                                     | Length | Hook text on screen / Short title                                                       | 9:16 framing                                                                                                                                                                                                                                                                                                                                                                   |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Lesson 1, cold-open puzzle  | 0:00.0 to 0:18.6, then 1:41.0 to 1:55.6 (the predict and the listen; it stops before "Higher, yes") | 33 s   | **"220 Hz and 440 Hz: same note?"** / Title: Twice as fast. Same note?                  | Stack the hosts, orange and "440 Hz" in the upper half, blue and "220 Hz" lower: pitch is height. For the predict, the two waves stacked as in the film, cropped to about two cycles of the slow wave so each fills the width; the "Predict" card centred. Burned-in captions at about 60 to 70 % of the height, clear of the Shorts title and buttons at the bottom and right |
| 2   | Lesson 1, sing-along        | 4:10.5 to 4:32.2 ("Let's try. I'll sing an A" to "Keep it gentle. Never push.")                     | 22 s   | **"Hum this A back. Any octave counts."** / Title: Hum along with Merc                  | Blue Merc large in the upper middle, the sung A as one line across; a plain ring timer for the 3.4 s hum gap; orange enters lower for "I hummed it higher". Keep "Keep it gentle. Never push." as a caption. Note: the Phase 1 re-voice changes "Hum it back"                                                                                                                  |
| 3   | Lesson 2, cold-open puzzle  | 0:00.0 to 0:23.2 (ends on "Then where do the other five come from?")                                | 23 s   | **"7 letters. 12 notes. Where are the other 5?"** / Title: Seven letters, twelve notes? | The spiral with its five dim beads fills the upper 55 %; the Mercs side by side beneath it, smaller; "7 letters" and "12 notes" set beside the spiral                                                                                                                                                                                                                          |
| 4   | Lesson 2, the B to C reveal | 1:48.0 to 2:21.5 ("Look at B and C" to "B to C is the smallest step a piano has.")                  | 33.5 s | **"Why is there no black key between B and C?"** / Title: the same question             | The keyboard close-up, A3 to E4, scaled to the full 1080 px width, the gap between B and C centred; orange Merc above for the question; the three predict pills stacked vertically                                                                                                                                                                                             |
| 5   | Lesson 2, sing-along        | 5:06.0 to 5:20.8, then 5:32.8 to 5:57.2 (both slides, then the safety line and the viewer's turn)   | 39 s   | **"Slide up one semitone, and back."** / Title: Can you sing one semitone?              | The pitch lanes as a horizontal strip in the upper half, about a 5 s window; the Mercs below; for the viewer's turn, the film's plain chrome guide across the frame with its ring timer. Nothing listens: no microphone, no app drawing over the viewer's turn (Lesson 2 BRIEF)                                                                                                |

---

## E. Thumbnails

### E1. The six variants

All are 1280x720 JPG under 200 KB, built in code: an HTML page per thumbnail with the films' own
fonts (Outfit for every headline and number, JetBrains Mono for the series kicker; Instrument Serif
is bundled for later edits; all SIL OFL), the series colours, lossless frames from the masters and
Merc frames from the films' WebM passes with their alpha kept. No image generator, no metadata in
the files.

| File                    | Words                        | Picture (all from the films)                                                                                                         | Pick              |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| `lesson-01-thumb-a.jpg` | Same note? · 440 Hz · 220 Hz | Both hosts singing (passes m18-blue at 6.00 s and m01-orange at 4.25 s); 440 stacked above 220 in the hosts' colours                 | **Lesson 1 pick** |
| `lesson-01-thumb-b.jpg` | Same note?                   | The film's frame at 1:39.5: 440 Hz over 220 Hz with the gold ×2 bracket; orange celebrating ("Ha! Same note.", m01-orange at 7.25 s) | Strong challenger |
| `lesson-01-thumb-c.jpg` | Pitch is a spiral?           | The film's spiral at 3:04 (A 880, A 440, A 220); blue pointing (m03-blue at 1.50 s)                                                  | Weakest at 168 px |
| `lesson-02-thumb-a.jpg` | 7 letters, 12 notes?         | The film's row of equal tiles at 3:25 with a "?" on each dark tile; orange asking (m01-orange at 21.25 s)                            | Strong challenger |
| `lesson-02-thumb-b.jpg` | No black key?                | The film's keyboard at 1:51.5 with the dashed key between B3 and C4; a "?" in it; orange asking (m08-orange at 1.50 s)               | **Lesson 2 pick** |
| `lesson-02-thumb-c.jpg` | The other 5?                 | The film's five dark tiles lifted out of the row at 3:09, rimmed in gold; blue pointing (m01-blue at 18.75 s)                        | Busiest           |

**Why A for Lesson 1:** it is the cold open in one picture, two faces singing and two numbers in their
colours, with the hook in two words. At 168x94 the headline, both faces and both numbers still read.
**Why B for Lesson 2:** the simplest shape of the set (a few huge keys, one dashed gap with a "?"),
the largest face, three words; it reads at 168x94 even before the words do, and with title 1 it adds
the clue instead of repeating the title.

Honesty check: every word is a question the film answers and every number is in FACTS (L1: 7, 9,
12, 15; L2: 13, 14, 15). No urgency, no arrows to nothing, nothing that is not in the film. The gold
rims in 2-C and the "?" in the dashed key in 2-B use the series' own code: gold for the fit, a "?"
for orange's guess (MASTER-PLAN § 5).

### E2. Why they work at phone size

| Principle           | How these thumbnails do it                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrast            | Type in white `#f7fafd` (18.1:1 on Obsidian) or gold `#ffd84d` (13.7:1); numbers in blue `#58a6ff` (7.5:1) and orange `#ff7448` (7.1:1); the hosts glow against a dark room. Checked on a dark and a light feed (`checks/lesson-0N-review.png`) |
| Few words           | Two to four, Outfit ExtraBold set at 118 to 176 px on 1280, so 15 to 23 px at 168x94                                                                                                                                                            |
| A face              | One or two Mercs, 320 to 400 px tall, eyes open, mid-expression: singing, asking, celebrating                                                                                                                                                   |
| One idea            | Each asks exactly one question, the one the film or its title answers                                                                                                                                                                           |
| The film's own look | Real frames, the series colour code, the films' fonts: what the thumbnail shows is in the film                                                                                                                                                  |
| Corners             | Nothing that matters in the bottom-right, where YouTube puts the duration                                                                                                                                                                       |

Each was downscaled to 320x180 and 168x94 (Lanczos) and looked at: every headline reads at both
sizes. Lesson 1 C and Lesson 2 C are the weakest at 168 px, which is why they are the third
variants rather than the picks.

### E3. Using Test & compare

How it works ([13861714](https://support.google.com/youtube/answer/13861714)): YouTube Studio on a
computer only, with Advanced features; up to three options, as **Title only**, **Thumbnail only** or
**Title and thumbnail**; viewers see them at the same time, and the option with the highest **watch
time** share wins, usually within two weeks. Not available for made-for-kids, age-restricted, private or
Shorts videos, or for a Premiere until it ends. Changing the title or thumbnail during a test stops it. If no
option clearly wins, the first one uploaded stays, so upload the recommended pair first. Every
thumbnail must be at least 1280x720, or all of them are shown at 854x480. YouTube may keep a small
control group on the first option.

| Lesson | Option 1 (upload first)           | Option 2                          | Option 3                          |
| ------ | --------------------------------- | --------------------------------- | --------------------------------- |
| 1      | Title 1 + `lesson-01-thumb-a.jpg` | Title 2 + `lesson-01-thumb-b.jpg` | Title 3 + `lesson-01-thumb-c.jpg` |
| 2      | Title 1 + `lesson-02-thumb-b.jpg` | Title 2 + `lesson-02-thumb-a.jpg` | Title 3 + `lesson-02-thumb-c.jpg` |

Steps: as soon as the lesson is public, open it in Studio > Title box or Thumbnail > **A/B Testing** >
**Title and thumbnail**, add the three pairs above in that order, Done. Read it in Analytics > Reach >
"How your A/B test is going". Keep the winner, note the result in the lesson's LEDGER, and carry what
won into the next lesson's packaging (MASTER-PLAN § 9: click-through and watch time are engagement
signals, not learning signals).

### E4. Re-rendering

From the unpacked YouTube pack, with Node and Playwright (any recent version; it uses `CHROMIUM_PATH`, else
`/opt/pw-browsers/chromium`, and never runs `playwright install`) and Python with Pillow:

```bash
node thumb-src/render.mjs            # every lesson-*-thumb-*.html -> thumb-src/out/*.png
python3 thumb-src/finish.py          # -> the JPGs here, checks/*-320.png, *-168.png, review sheets
```

Edit a page's text or positions and run both again. YouTube now recommends 3840x2160 thumbnails
(up to 50 MB from a computer, 2 MB from a phone; [72431](https://support.google.com/youtube/answer/72431)),
and MASTER-PLAN § 4.1 asks for 3840x2160 too. `node thumb-src/render.mjs <page> --scale 3` renders
one at 3840x2160, but the film frames are 1080p and the Merc passes are 315 to 480 px, so a true 4K
thumbnail would need Merc rendered again at high resolution from the film's own bundle (owner
decision 11). At 1280x720 they meet Test & compare's minimum and the 2 MB phone limit.

### E5. Lesson 1's planned share card

`public/learn/lesson-01-og.jpg` (1200x630) is the film's title card: "Find Your Pitch · LESSON 01 ·
What is a note?" in chrome Instrument Serif italic over a glowing staff with a blue, an orange and
chrome notes. It **differs** from these thumbnails: it has no host, no hook question and no hertz
numbers, and its thin chrome serif title is light-on-dark at low weight, which will read less well
at small sizes than the bold type here. It is a calm brand card for link previews; the thumbnails
are built to be clicked in a feed. Not changed.

---

## Sources

YouTube help pages, fetched 19 October 2026 (plain user agent, no account):

| Page                                                                                                                                                | What it confirmed                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Edit video settings](https://support.google.com/youtube/answer/57404)                                                                              | Title at most 100 characters and description at most 5,000, no invalid characters; the field list and order; Education types; licence and distribution; Shorts remixing; Related Video on Shorts; corrections in the description |
| [Upload YouTube videos](https://support.google.com/youtube/answer/57407)                                                                            | The same limits in the upload flow                                                                                                                                                                                               |
| [YouTube Data API: videos](https://developers.google.com/youtube/v3/docs/videos)                                                                    | Tags at most 500 characters, counting commas and the quotation marks around a tag with a space; description at most 5,000 bytes, no `<` or `>`; clickable description links need channel verification or Advanced features       |
| [Add tags](https://support.google.com/youtube/answer/146402)                                                                                        | Tags play a minimal role in discovery                                                                                                                                                                                            |
| [Video chapters](https://support.google.com/youtube/answer/9884579)                                                                                 | First at 00:00, at least three, ascending, each at least 10 s; manual chapters override automatic ones; the automatic-chapters switch, per video and in Upload defaults                                                          |
| [End screens](https://support.google.com/youtube/answer/6388789)                                                                                    | Last 5 to 20 s; up to four elements on 16:9; videos of at least 25 s; per-element timing; public or unlisted targets; links need YPP; none on made-for-kids videos or mobile web; viewers can hide them                          |
| [Cards](https://support.google.com/youtube/answer/6140493)                                                                                          | Up to five; video, playlist, channel and link (YPP) cards; public targets; computers only; none on made-for-kids videos                                                                                                          |
| [Thumbnails](https://support.google.com/youtube/answer/72431)                                                                                       | Recommended 3840x2160, minimum width 640; JPG or PNG; 2 MB from a phone, 50 MB from a computer; 16:9; verified account                                                                                                           |
| [Test & compare](https://support.google.com/youtube/answer/13861714)                                                                                | Up to three titles, thumbnails or pairs; watch-time winner; eligibility; first option as fallback; thumbnails under 1280x720 shown at 854x480                                                                                    |
| [Disclosing AI content](https://support.google.com/youtube/answer/14328491)                                                                         | The "AI use" setting; what needs disclosure and what does not; automatic labels                                                                                                                                                  |
| [Made for kids](https://support.google.com/youtube/answer/9528076)                                                                                  | The FTC and COPPA factors; general audience; "we cannot provide legal advice"                                                                                                                                                    |
| [Set your audience](https://support.google.com/youtube/answer/9527654)                                                                              | The channel-level setting and its three choices                                                                                                                                                                                  |
| [Features off on made-for-kids content](https://support.google.com/youtube/answer/9632097)                                                          | Cards, end screens, comments, notifications, save to playlist and more                                                                                                                                                           |
| [Paid promotion](https://support.google.com/youtube/answer/154235) and [Branded content policy](https://support.google.com/youtube/answer/17596007) | What counts as branded content                                                                                                                                                                                                   |
| [Add subtitles](https://support.google.com/youtube/answer/2734796) and [Supported caption files](https://support.google.com/youtube/answer/2734698) | Upload with timing; SRT and WebVTT in plain UTF-8                                                                                                                                                                                |
| [Premieres](https://support.google.com/youtube/answer/9080341)                                                                                      | Public watch page beforehand; 1080p maximum; scheduling                                                                                                                                                                          |
| [Schedule a video](https://support.google.com/youtube/answer/1270709)                                                                               | Scheduled publishing; "Published on" date by Pacific time                                                                                                                                                                        |
| [Playlists](https://support.google.com/youtube/answer/57792)                                                                                        | Creating and ordering playlists                                                                                                                                                                                                  |
| [Licence types](https://support.google.com/youtube/answer/2797468)                                                                                  | Standard YouTube Licence or CC BY                                                                                                                                                                                                |
| [Channel layout](https://support.google.com/youtube/answer/3219384)                                                                                 | Channel trailer, Spotlight, up to 12 sections                                                                                                                                                                                    |
| [Shorts remixing](https://support.google.com/youtube/answer/10623810)                                                                               | How to limit remixing; what happens to remixes                                                                                                                                                                                   |
| [Three-minute Shorts](https://support.google.com/youtube/answer/15424877)                                                                           | Shorts up to three minutes; claimed Shorts over one minute are blocked                                                                                                                                                           |
| [Feature access](https://support.google.com/youtube/answer/9890437)                                                                                 | What phone verification and Advanced features unlock                                                                                                                                                                             |
| [Comment settings](https://support.google.com/youtube/answer/9483359)                                                                               | Moderation levels None, Basic, Strict, Hold all                                                                                                                                                                                  |
| [Hashtags](https://support.google.com/youtube/answer/6390658)                                                                                       | Up to three shown by the title; more than 60 are ignored                                                                                                                                                                         |

Third party, approximate: [CollabPals end-screen previewer](https://www.collabpals.com/tools/youtube-end-screen-previewer)
gives end-screen element sizes on a 1920x1080 frame (video or playlist about 613x343 px; subscribe
about 298 px). YouTube does not publish them.

Plan and film sources: `docs/plans/find-your-pitch/` (MASTER-PLAN §§ 1, 4.1, 7, 9, 11, 12;
CURRICULUM § 2; MERC-BIBLE §§ 2 to 4; TEACHING-PLAYBOOK; each lesson's BRIEF, FACTS, SCRIPT,
captions); `output/motion/lesson-01/` and `lesson-02/` (DELIVERY.md, `cues.json`, compositions
`s20-next`, `s21-end`, `s16-next`, `s17-end`, renders, Merc passes); `learn/01.html` (credits).

---

## Owner decisions

Decided on 19 October 2026: 4, 5, 8 (the playlist element) and 9. The owner uploads the films.

1. **Publish `rc-07` now, or wait for Lesson 1's Phase 1 re-voice?** A re-voiced Lesson 1 cannot
   replace the YouTube video; it would be a new upload (B3).
2. **The listen-and-watch gate** in both DELIVERY.md files, before either goes public.
3. **Lesson pages:** settled. Both are built and on `main`, and go live with the next release after
   v0.9.21: make the films public after it (section 0).
4. **Made for kids:** No (decided; B1).
5. **AI use disclosure:** No (decided; B1).
6. **Paid promotion:** No on MercuryPitch's own channel; Yes on a channel MercuryPitch pays.
7. **Release:** same day (recommended), consecutive days, or wait for the plan's batch, which Lesson 3's
   coach gate holds up (B3). Then which weekday becomes the fixed weekly day.
8. **Lesson 2's end screen:** a playlist element over blue Merc for the last 5 s (decided). Still
   open: whether the next render of both films holds a 12 to 15 s end card with room
   for end-screen elements.
9. **Shorts remixing:** allow (decided).
10. **"Free":** the descriptions say MercuryPitch, Voice Mirror and Ear Lab are free (FACTS). The
    playlist description ("A free series") and trailer title 2 call the series free, which is true
    of the videos; whether the lesson pages stay free is still Proposed (§ 12 item 3). Drop "free"
    from those two if that might change.
11. **Thumbnails at 3840x2160** (YouTube's and the plan's recommendation) would need Merc rendered
    again at high resolution; the 1280x720 set meets every limit today.
12. **Orange Merc's name and pronouns** (§ 12 item 1): the copy avoids both until you decide.
13. **A source marker on YouTube links** (such as `?lesson=01`) once the app reads `?lesson=`
    (CURRICULUM § 4 item 6), so lesson-to-app conversions from YouTube can be counted (§ 9).
14. **1080p or 4K delivery** (§ 12 item 4): these sheets upload the 1080p60 masters.
