// ============================================================
// Extended Learn tutorials — one read-along guide per remaining feature.
// Spread into WALKTHROUGHS in ./walkthrough.ts. Same shape as the originals.
// ============================================================

import type { WalkthroughContent, WalkthroughTab } from './walkthrough'

export const EXTENDED_WALKTHROUGHS: Partial<
  Record<WalkthroughTab, WalkthroughContent[]>
> = {
  guitar: [
    {
      id: 'guitar-overview',
      tab: 'guitar',
      title: 'Guitar Practice & Fretboard',
      description:
        'Play along with songs and train on the interactive fretboard',
      content: `
## Two ways to play

- **Practice view**: notes fall toward the fretboard — play (or sing) along in time and get scored, like a rhythm game for guitar.
- **Fretboard view**: a free, interactive neck for learning. Click notes, or play your real guitar through the mic / a MIDI device.

Switch between them with the view toggle at the top of the tab.

## Pick your sound

The instrument selector swaps the synth between **acoustic**, **electric**, and **bass** — the change is instant, so try a song with each.

## Play along with a song

Load a MIDI song from the song picker to practice over a backing track. You can mute or solo individual tracks and scrub the timeline to drill a section.

## Fretboard training modes

In **Fretboard view**, the Mode dropdown turns the neck into a focused drill:

- **Note Quiz** — name or find notes on the neck
- **Ear Training** — match what you hear
- **CAGED** — learn the five chord shapes
- **Chord Progressions** — play through changes
- **Melody Transcription / Call & Response / Adaptive Jam** — and more

> **Tip:** Start in Fretboard view with Note Quiz to learn the neck, then switch to Practice view and play a slow song to put it together.
      `,
      steps: [
        {
          title: 'Choose a view',
          description:
            'Toggle between Practice (play-along) and Fretboard (learning).',
          action: 'Click the view toggle',
        },
        {
          title: 'Pick an instrument',
          description: 'Switch between acoustic, electric, and bass.',
          action: 'Use the instrument selector',
        },
        {
          title: 'Load a song',
          description:
            'Open the song picker and choose a MIDI song to play along with.',
          action: 'Open the song picker',
        },
        {
          title: 'Try a training mode',
          description:
            'In Fretboard view, pick a mode from the dropdown to start a drill.',
          action: 'Open the Mode dropdown',
        },
      ],
      thumbnail: 'music',
    },
  ],
  piano: [
    {
      id: 'piano-overview',
      tab: 'piano',
      title: 'Falling-Notes Piano',
      description: 'Play or sing falling notes in time and get scored',
      content: `
## Load a song

Pick a MIDI song from the song picker. You can mute or solo its tracks and drag the timeline to start anywhere.

## Play the falling notes

Notes fall toward the keyboard — hit each one as it lands. You can play with:

- **Your microphone** — sing the pitch and it's matched against each note.
- **A MIDI keyboard** — connect it and play the notes directly.
- **The on-screen keys** — click to play when click-input is enabled.

## Scoring

Each note is graded on how closely your pitch matches. Your score, combo, and accuracy build as you play, with a summary card at the end.

## Make it easier

- Lower the **speed** to give yourself more time.
- Turn on **note labels** to see note names.
- Use **zoom** to fit more (or less) of the song on screen.

> **Tip:** Start at 0.5x–0.75x speed with note labels on, then speed up as the song gets comfortable.
      `,
      steps: [
        {
          title: 'Load a song',
          description: 'Open the song picker and choose a MIDI song.',
          action: 'Open the song picker',
        },
        {
          title: 'Choose your input',
          description:
            'Sing through the mic, connect MIDI, or use the on-screen keys.',
          action: 'Enable mic or MIDI',
        },
        {
          title: 'Play',
          description:
            'Hit Play and match each falling note as it reaches the keyboard.',
          action: 'Click Play',
        },
      ],
      thumbnail: 'piano',
    },
  ],
  karaoke: [
    {
      id: 'karaoke-overview',
      tab: 'karaoke',
      title: 'Vocal Separation & Stem Mixer',
      description:
        'Split a song into stems, then sing along with synced lyrics',
      content: `
## Separate a song

Upload an audio file and the vocal separator splits it into **vocal** and **instrumental** stems (it runs in your browser). Processed songs are saved so you can reopen them any time.

## The mixer

Once a song is loaded you get the stem mixer:

- **Faders + mute/solo** to balance vocal vs instrumental — mute the vocal to sing karaoke, or solo it to learn the melody.
- **Transport** to play, pause (Space), scrub, and set an A–B loop (the A and B keys) to drill a phrase.

## Lyrics & LRC tools

The lyrics panel scrolls and highlights in time. Its tools let you:

- **Get lyrics in** — search online, upload an .lrc/.txt file, or paste from the clipboard.
- **Sync the timing** — edit word timings by hand, or generate an LRC live by tapping along.
- **Organize & export** — mark repeat blocks (chorus/verse) and download a finished .lrc.

## Sing & score

Enable the mic to overlay your live pitch on the vocal contour and get a sung-accuracy score. Queue several songs into a **playlist** to sing back-to-back, and use **focus mode** for a full-screen karaoke view.

> **Tip:** No lyrics found? Use "Search lyrics online", then "Generate LRC" and tap along once to sync them to the song.
      `,
      steps: [
        {
          title: 'Add a song',
          description:
            'Upload an audio file to separate it into vocal + instrumental stems.',
          action: 'Upload a song',
        },
        {
          title: 'Balance the stems',
          description:
            'Use faders and mute/solo to set up a karaoke or learning mix.',
          action: 'Adjust the stem faders',
        },
        {
          title: 'Load lyrics',
          description:
            'Search, upload, or paste lyrics, then sync their timing.',
          action: 'Open the lyric tools',
        },
        {
          title: 'Sing with the mic',
          description: 'Enable the mic to overlay your pitch and get scored.',
          action: 'Enable the mic',
        },
      ],
      thumbnail: 'music',
    },
  ],
  exercises: [
    {
      id: 'exercises-overview',
      tab: 'exercises',
      title: 'Singing Exercises',
      description: 'Targeted drills that build specific vocal skills',
      content: `
## The exercise library

The Exercises tab is a gallery of focused drills — each one trains a specific skill, shown by its tags (e.g. Stability, Vibrato, Ear Training, Range). Browse the cards and tap one to begin.

## A few favourites

- **Long Note** — hold a steady pitch to build breath support and stability.
- **Vibrato** — develop controlled, even vibrato with live rate/depth feedback.
- **Interval Trainer / Scale Runner** — train your ear and agility.
- **Pitch Pursuit** — a game-like drill: match falling notes before they land.
- **Siren / Range Explorer** — glide across your range for smooth register transitions.

## Start practicing

Tap a card to open the drill, or hit its **Start** pill to jump straight in. Every exercise gives live pitch feedback as you sing, and your best score and play count are tracked per drill.

## Smart suggestions

If you've practiced before, a suggestions panel highlights the skills you're weakest at and recommends drills to work on next.

> **Tip:** Warm up with Long Note and a Siren, then pick one skill-focused drill per session rather than rushing through many.
      `,
      steps: [
        {
          title: 'Browse the library',
          description: 'Scan the cards and their skill tags to find a drill.',
          action: 'Open the Exercises tab',
        },
        {
          title: 'Start a drill',
          description:
            'Tap a card or its Start pill to begin with live pitch feedback.',
          action: 'Tap an exercise card',
        },
        {
          title: 'Follow your suggestions',
          description:
            'Check the recommendations panel for your weakest skills.',
          action: 'Review the suggestions',
        },
      ],
      thumbnail: 'sparkle',
    },
  ],
  analysis: [
    {
      id: 'analysis-overview',
      tab: 'analysis',
      title: 'Vocal Analysis & Pitch Tools',
      description: 'Three tools for analysing pitch and testing detection',
      content: `
## Three tools in one tab

The Analysis tab has a sub-tab switcher across the top:

- **Vocal Analysis** — deep-dive a recording or your session history: pitch accuracy, range, vibrato, and trends over time.
- **Pitch Detection** — test the real-time detector against audio files, your mic, or generated tones to see how it tracks pitch.
- **Pitch Algorithms** — benchmark the detection algorithms head-to-head on the same signal to compare accuracy and latency.

## Vocal Analysis

Switch between **session history** (analyse past practice) and **live mic** mode, then run the analysis to see your stats and pitch contour. Load demo data if you don't have sessions yet.

## When to use which

- Use **Vocal Analysis** to track your own progress.
- Use **Pitch Detection** and **Pitch Algorithms** to understand or tune how the app hears pitch — handy if detection feels off in your room.

> **Tip:** If pitch detection struggles with your voice or room, compare algorithms here, then apply what works in Settings.
      `,
      steps: [
        {
          title: 'Pick a tool',
          description:
            'Use the sub-tabs to switch between the three analysis tools.',
          action: 'Click a sub-tab',
        },
        {
          title: 'Analyse your voice',
          description:
            'In Vocal Analysis, choose history or live mode and run it.',
          action: 'Run vocal analysis',
        },
        {
          title: 'Test detection',
          description:
            'Use Pitch Detection / Algorithms to see how pitch is tracked.',
          action: 'Open a pitch tool',
        },
      ],
      thumbnail: 'trending',
    },
  ],
  jam: [
    {
      id: 'jam-overview',
      tab: 'jam',
      title: 'Real-time Jam Rooms',
      description: 'Sing together with others in a shared, synced room',
      content: `
## Set your name

Enter the display name other singers will see in the room. This is how you'll show up in the peer list.

## Create or join a room

- **Create a room** to start a new session, then share the room code with friends.
- **Join a room** by entering a code someone shared with you.

## In the room

Once you're in, everyone shares synced playback so you can practice or perform together. From the room controls you can:

- Toggle your **microphone** and **camera**.
- See the **peer list** and each singer's live status.
- **Invite** others or **leave** the room.

> **Tip:** Use headphones in a jam room — they stop the shared playback leaking back into your mic and throwing off everyone's pitch.
      `,
      steps: [
        {
          title: 'Set your name',
          description: 'Enter the display name others will see.',
          action: 'Type a display name',
        },
        {
          title: 'Create or join',
          description: 'Start a new room, or join with a shared code.',
          action: 'Create or join a room',
        },
        {
          title: 'Enable mic & camera',
          description: 'Turn on your mic (and camera) to join in.',
          action: 'Toggle mic/camera',
        },
      ],
      thumbnail: 'building',
    },
  ],
  community: [
    {
      id: 'community-overview',
      tab: 'community',
      title: 'Share & Community Feed',
      description: 'Publish your work and explore what others have shared',
      content: `
## Share your work

Use the share buttons to publish a **melody**, a **practice session**, or an **exercise** so other singers can try it.

## Browse the feed

Switch between shared **melodies**, **sessions**, and your own **profile**. Open anything in the feed to load and play it — or send a shared melody straight into practice.

## Your profile

Your profile shows your stats (streak, sessions, best score) and the things you've shared publicly.

> **Tip:** Share a session you're proud of — others can load it as a practice target and try to beat your score.
      `,
      steps: [
        {
          title: 'Share something',
          description:
            'Publish a melody, session, or exercise from the share buttons.',
          action: 'Open the share menu',
        },
        {
          title: 'Browse the feed',
          description: 'Switch between melodies, sessions, and your profile.',
          action: 'Switch community tabs',
        },
        {
          title: 'Open a share',
          description: 'Load and play what someone else has shared.',
          action: 'Open a feed item',
        },
      ],
      thumbnail: 'sheet',
    },
  ],
  leaderboard: [
    {
      id: 'leaderboard-overview',
      tab: 'leaderboard',
      title: 'Leaderboards & Ranking',
      description: 'See how you stack up and what to climb toward',
      content: `
## Choose a board

Switch between **Global**, **Friends**, and **Weekly** views to compare yourself against everyone, just your friends, or this week's climbers.

## Rank by metric

Re-rank the board by **overall score**, **best score**, **accuracy**, **streak**, or **sessions** — whichever you're chasing.

## Podium & table

The **podium** highlights the current top three for the selected metric, and the **full table** lists everyone below. Find your row to see exactly what it takes to move up.

> **Tip:** Switch to the metric you're strongest at first — it's the quickest way to find a board where you already rank well, then build from there.
      `,
      steps: [
        {
          title: 'Pick a board',
          description: 'Choose Global, Friends, or Weekly.',
          action: 'Switch the view',
        },
        {
          title: 'Choose a metric',
          description: 'Re-rank by score, accuracy, streak, or sessions.',
          action: 'Switch the metric',
        },
        {
          title: 'Find your row',
          description: 'Scan the podium and table to see your standing.',
          action: 'Read the table',
        },
      ],
      thumbnail: 'trending',
    },
  ],
  challenges: [
    {
      id: 'challenges-overview',
      tab: 'challenges',
      title: 'Vocal Challenges & Badges',
      description: 'Take on focused challenges and collect badges',
      content: `
## Challenge categories

Challenges are grouped by type — **high notes**, **low notes**, **speed**, **perfect pitch**, **scales**, and more. Switch categories from the tabs at the top.

## Take on a challenge

Pick a challenge card to attempt it. Each tracks its own status — not started, in progress, or completed — so you can see what's left.

## Earn badges

Completing challenges unlocks **badges**, shown in the badges section. They're a record of what you've mastered.

> **Tip:** Start with a category that matches your strengths to bank a few quick wins and badges, then stretch into the harder ones.
      `,
      steps: [
        {
          title: 'Pick a category',
          description: 'Switch challenge types from the category tabs.',
          action: 'Switch categories',
        },
        {
          title: 'Attempt a challenge',
          description: 'Choose a challenge card and give it a go.',
          action: 'Open a challenge',
        },
        {
          title: 'Collect badges',
          description: 'Complete challenges to unlock badges below.',
          action: 'Check the badges section',
        },
      ],
      thumbnail: 'sparkle',
    },
  ],
}
