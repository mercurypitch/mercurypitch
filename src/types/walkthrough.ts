// ============================================================
// Walkthrough Types and Definitions
// ============================================================

import type { WalkthroughTab } from '@/features/tabs/constants'

export type { WalkthroughTab }

export interface WalkthroughContent {
  id: string
  tab: WalkthroughTab
  title: string
  description: string
  content: string
  steps: WalkthroughStep[]
  thumbnail: string
}

export interface WalkthroughStep {
  title: string
  description: string
  action: string
  target?: string
}

export const WALKTHROUGHS: Partial<
  Record<WalkthroughTab, WalkthroughContent[]>
> = {
  singing: [
    {
      id: 'practice-toolbar',
      tab: 'singing',
      title: 'Practice Toolbar Overview',
      description: 'Master the main practice controls for vocal pitch training',
      content: `
## Essential Controls

- **Microphone Button**: Enables pitch detection. Keep this active during practice to see real-time feedback on the pitch canvas.
- **Play/Pause/Stop**: Control playback of your melody. Pause allows you to practice a specific section; Stop resets to the beginning.
- **Focus Mode**: Enter minimal UI mode for distraction-free practice.

## Playback Controls

- **Play Button**: Starts playback from the beginning of the melody (with optional count-in).
- **Pause**: Pauses playback at the current position.
- **Continue**: Resumes after pausing.
- **Stop**: Ends playback and resets to the start.

## Practice Modes

- **Once**: Practice each note once from beginning to end.
- **Repeat**: Loop the melody repeatedly for focused repetition.
- **Practice Mode**: Runs through the melody randomly, helping you internalize the pattern.

> **Note:** Session Mode lets you select from pre-defined practice sessions or create your own custom sessions with multiple melodies.

## Additional Settings

- **BPM**: Adjust tempo (40-280 BPM). Lower speeds are great for beginners.
- **Volume**: Control playback volume.
- **Speed**: 0.25x to 2.0x playback speed. Slower speeds help with difficult sections.
- **Metronome**: Toggle metronome clicks on each beat for rhythmic accuracy.
- **Cycles**: Set how many times to repeat (for practice/repeat modes).

> **Tip:** Start at a slower speed (0.5x–0.75x) when learning a new melody, then gradually increase as you get comfortable. Use metronome for rhythmic accuracy, especially in faster passages.
      `,
      steps: [
        {
          title: 'Start Practice',
          description: 'Click the Play button to start playback',
          action: 'Click Play button',
          target: 'ctrl-btn.play-btn',
        },
        {
          title: 'Adjust Speed',
          description:
            'Use the speed dropdown to slow down or speed up playback',
          action: 'Change speed dropdown',
          target: 'speed-select',
        },
        {
          title: 'Toggle Metronome',
          description: 'Enable metronome to hear beat markers',
          action: 'Toggle metronome',
          target: 'metronome-toggle',
        },
        {
          title: 'Enter Focus Mode',
          description: 'Minimize UI for distraction-free practice',
          action: 'Click Focus button',
          target: 'ctrl-btn.focus-btn',
        },
      ],
      thumbnail: '🎵',
    },
    {
      id: 'practice-modes',
      tab: 'singing',
      title: 'Understanding Practice Modes',
      description: 'Learn when to use Once, Repeat, or Practice mode',
      content: `
## Once Mode (Default)

Plays through the melody exactly once, note by note.

- Best for: Initial learning, memorization, and getting familiar with the melody
- Use the **Cycles** setting to repeat multiple times if desired

## Repeat Mode

Loops the melody continuously until you stop.

- Best for: Perfecting difficult sections and muscle memory development
- No repetition limit — stop when you feel comfortable

## Practice Mode

Randomizes the order of notes each run.

- Best for: Strengthening pitch recognition and reducing pattern memorization
- Each run goes through all notes but in a different order

> **Note:** **Session Mode** (for advanced users) uses pre-defined or custom practice sessions with multiple melodies. Each session item is played in sequence.

## When to Use Each Mode

| Level | Recommendation |
| --- | --- |
| **Beginner** | Once mode at 0.5x speed |
| **Intermediate** | Practice mode to test pitch memory |
| **Advanced** | Sessions with multiple melodies |

> **Tip:** Don't rush — start at the lowest comfortable speed and gradually increase. Practice mode is the most challenging but yields the fastest improvement.
      `,
      steps: [
        {
          title: 'Select Once Mode',
          description: 'Click "Once" to play melody linearly',
          action: 'Click Once button',
          target: 'btn-once',
        },
        {
          title: 'Select Practice Mode',
          description: 'Click "Practice" for randomized note order',
          action: 'Click Practice button',
          target: 'btn-practice',
        },
        {
          title: 'Set Repeat Count',
          description: 'For Once mode, specify how many cycles to repeat',
          action: 'Enter cycle count',
          target: 'cycles',
        },
      ],
      thumbnail: '🔄',
    },
  ],
  compose: [
    {
      id: 'editor-toolbar',
      tab: 'compose',
      title: 'Editor Toolbar Overview',
      description: 'Learn how to use the piano roll editor to compose melodies',
      content: `
The Editor tab is your creative workspace for composing melodies. The toolbar provides essential tools for building, editing, and exporting your music.

## Essential Tools

- **Save Melody Button**: Save your composition to the melody library
- **Key Selector**: Choose the musical key (C, D, E, F, G, A, B)
- **Scale Selector**: Select scale type (Major, Minor, Pentatonic, etc.)
- **BPM Control**: Set tempo for playback (40-280 BPM)

## Note Operations

- **Place Tool**: Click on the grid to place notes
- **Select Tool**: Click and drag to select notes
- **Delete Tool**: Remove unwanted notes

## Editor Features

- **Piano Roll Grid**: Visual representation of pitch vs time
- **Octave Shift**: Change the default octave for new notes
- **Snap-to-Grid**: Align notes to time grid for clean timing
- **Zoom Controls**: Zoom in/out to see finer details

## Export Options

- **WAV Export**: Download your melody as an audio file
- **MIDI Export**: Export as MIDI for use in DAWs
- **MIDI Import**: Load melodies from MIDI files

## Canvas Navigation

Scroll horizontally for longer melodies, vertically for multiple octaves. The playback head shows your current position.

> **Tip:** Start with Major scale for simplicity, then try Minor or Pentatonic. Use Snap-to-Grid for clean, rhythmic melodies. You can also record directly into the piano roll using the **Record** button.
      `,
      steps: [
        {
          title: 'Select Key and Scale',
          description: 'Choose your musical foundation',
          action: 'Select Key and Scale',
          target: '#key-select, #scale-select',
        },
        {
          title: 'Place Notes',
          description: 'Use Place tool to click on the grid',
          action: 'Click grid with Place tool',
          target: '.roll-grid',
        },
        {
          title: 'Adjust BPM',
          description: 'Set tempo for your melody',
          action: 'Adjust BPM slider',
          target: '#tempo',
        },
        {
          title: 'Save Melody',
          description: 'Save to library for later practice',
          action: 'Click Save button',
          target: '#save-melody-btn',
        },
      ],
      thumbnail: '🎹',
    },
    {
      id: 'editor-midi',
      tab: 'compose',
      title: 'Importing and Exporting MIDI',
      description: 'Workflow for working with MIDI files',
      content: `
MIDI files are a universal format for sharing music between applications. PitchPerfect supports both import and export.

## Exporting MIDI

1. Complete your melody in the piano roll
2. Click the **MIDI Export** button (floppy disk icon)
3. Your melody is downloaded as a .mid file
4. Import this file into DAWs like FL Studio, Ableton, Logic Pro

## Importing MIDI

1. Click the **MIDI Import** button
2. Select your .mid file
3. Your melody is converted and appears on the piano roll
4. Edit or save it as your own composition

> **Info:** MIDI preserves note timing and pitch information. The file does **not** include audio — just note data. It's compatible with virtually all music software.

## Supported Features

- Note pitch and duration
- Velocity (volume) information
- Channel mapping
- Tempo information

> **Note:** If importing MIDI doesn't work perfectly, it's due to MIDI format variations. Manually edit in the piano roll after import for best results.
      `,
      steps: [
        {
          title: 'Export MIDI',
          description: 'Download melody as MIDI file',
          action: 'Click Export MIDI',
          target: '#roll-export-midi',
        },
        {
          title: 'Import MIDI',
          description: 'Load MIDI file to piano roll',
          action: 'Click Import MIDI',
          target: '#roll-import-midi',
        },
        {
          title: 'Edit Imported Melody',
          description: 'Fine-tune notes after import',
          action: 'Edit notes in piano roll',
          target: '.roll-grid',
        },
      ],
      thumbnail: '🎵',
    },
    {
      id: 'editor-advanced',
      tab: 'compose',
      title: 'Advanced Editor Features',
      description: 'Tips and techniques for complex melodies',
      content: `
The Editor offers several advanced features for creating sophisticated melodies.

## Octave Management

- Default octave sets where new notes appear
- You can manually place notes in different octaves
- Changes affect how the melody spans the keyboard

## Scale Reference

The selected scale shows valid notes in that key. Notes outside the scale produce different pitches. Use **chromatic** for full flexibility.

## Snap-to-Grid

Aligns notes to time divisions (1/4, 1/8, 1/16 note). Makes melodies rhythmically consistent. Can be toggled on/off for free-form placement.

## Visual Aids

- Grid lines help align notes visually
- Note labels show pitch names
- Playback head shows current position in real-time

## Editing Techniques

- **Select multiple notes**: Use Select tool and click/drag
- **Copy notes**: Select and copy/paste
- **Delete notes**: Select and click Delete tool
- **Adjust timing**: Drag note edges to change duration

## Creating Variations

1. Start with a base melody
2. Export as MIDI
3. Import into your DAW to add harmonies
4. Bring back interesting sections to the piano roll

> **Tip:** Layer octaves for richer sounds (high + low). Use rests strategically for musical phrasing. Export to MIDI for advanced editing in your favorite DAW.
      `,
      steps: [
        {
          title: 'Adjust Octave',
          description: 'Change default note octave',
          action: 'Select octave level',
          target: '.octave-ctrl',
        },
        {
          title: 'Toggle Snap-to-Grid',
          description: 'Align notes for clean timing',
          action: 'Click Snap toggle',
          target: '#roll-snap-btn',
        },
        {
          title: 'Zoom Controls',
          description: 'Zoom in/out for detailed editing',
          action: 'Use zoom buttons',
          target: '#roll-zoom-in, #roll-zoom-out',
        },
      ],
      thumbnail: '✨',
    },
  ],
  settings: [
    {
      id: 'settings-overview',
      tab: 'settings',
      title: 'Settings Overview',
      description: 'Configure PitchPerfect for your practice environment',
      content: `
Settings are organized into sections for easy navigation. Here's what each section controls:

## Sensitivity Presets

- Quick presets for different environments (Quiet Room, Home, Noisy)
- Adjusts pitch detection thresholds automatically

> **Tip:** Use presets instead of manual adjustments for best results. Start with "Home" and tweak from there.

## Pitch Detection

- **Detection Threshold**: Lower = stricter detection (ignore noise); Higher = more sensitive
- **Sensitivity**: Higher = more responsive to quiet signals
- **Min Confidence**: Minimum confidence % to accept a pitch
- **Min Amplitude**: Minimum signal loudness required

## Practice Aids

- **Tonic Anchor Tone**: Plays a reference note at start to help lock into key

> **Info:** Enable tonic anchor when learning new keys or scales. It gives you a reference pitch before playback begins.

## Accuracy Bands (cent thresholds)

These define your scoring bands in practice:

- **Perfect**: ≤ 10 cents off
- **Excellent**: ≤ 25 cents off
- **Good**: ≤ 50 cents off
- **Okay**: ≤ 75 cents off

(100 cents = 1 semitone)

## Tone Envelope (ADSR)

Controls how each note sounds during playback:

- **Attack**: Time to reach full volume (0-1000ms)
- **Decay**: Time to fall to sustain (0-1000ms)
- **Sustain**: Volume during note held (0-100%)
- **Release**: Time to fade after note ends (0-2000ms)

## Appearance

- **Grid Lines**: Toggle canvas grid
- **Theme**: Dark or Light mode

## Playback Speed

0.25x to 2.0x speed multiplier. Use slower speeds for learning difficult passages.
      `,
      steps: [
        {
          title: 'Select Environment',
          description: 'Choose preset for your room conditions',
          action: 'Select environment preset',
          target: '#preset-select',
        },
        {
          title: 'Adjust Sensitivity',
          description: 'Fine-tune pitch detection',
          action: 'Adjust sliders',
          target: '#set-threshold, #set-sensitivity',
        },
        {
          title: 'Set Accuracy Bands',
          description: 'Define your scoring thresholds',
          action: 'Adjust threshold values',
          target: '#band-perfect, #band-excellent',
        },
      ],
      thumbnail: '⚙️',
    },
    {
      id: 'settings-tone',
      tab: 'settings',
      title: 'Tone Envelope (ADSR) Settings',
      description: 'Customize how notes sound during playback',
      content: `
The **ADSR** (Attack, Decay, Sustain, Release) envelope controls how each note sounds when played.

## Attack (0-1000ms)

Time from note start to full volume.

- **Short attack** = sharp, percussive sound
- **Long attack** = smooth, flowing sound

> **Info:** Typical range: 50-200ms for smooth melody playback.

## Decay (0-1000ms)

Time to fall from peak to sustain level.

- **Short decay** = quick energy drop
- **Long decay** = sustained sound

> **Info:** Typical range: 100-300ms for natural decay.

## Sustain (0-100%)

Volume level during sustained notes.

- **0%** = note immediately fades after peak
- **100%** = note sustains at full volume

> **Info:** Typical range: 70-80% for pleasant sustain.

## Release (0-2000ms)

Time after note ends to fade to silence.

- **Short release** = sudden stop
- **Long release** = smooth fade-out

> **Info:** Typical range: 200-500ms for musical feel.

## Recommended Presets

| Preset | Attack | Decay | Sustain | Release |
| --- | --- | --- | --- | --- |
| **Piano** | 150ms | 300ms | 80% | 400ms |
| **Organ** | 50ms | 100ms | 90% | 200ms |
| **Soft Pad** | 300ms | 500ms | 60% | 800ms |

> **Tip:** Adjust attack/release together for smooth transitions. Excessively long releases can make songs sound "echoey". Shorter envelopes work better for fast-paced music.
      `,
      steps: [
        {
          title: 'Adjust Attack',
          description: 'Control how quickly notes start',
          action: 'Move Attack slider',
          target: '#adsr-attack',
        },
        {
          title: 'Adjust Decay',
          description: 'Control how notes fall to sustain',
          action: 'Move Decay slider',
          target: '#adsr-decay',
        },
        {
          title: 'Adjust Release',
          description: 'Control note fade-out after ending',
          action: 'Move Release slider',
          target: '#adsr-release',
        },
      ],
      thumbnail: '🎼',
    },
    {
      id: 'settings-reverb',
      tab: 'settings',
      title: 'Reverb Effects',
      description: 'Add depth and space to your practice playback',
      content: `
Reverb adds environmental space to audio, making it sound like it's played in different-sized rooms or spaces.

## Reverb Types

**Off** — Pure, dry sound with no reverb. Best for tight, focused practice.

**Room** — Small room ambience. Adds subtle depth; about 0.5-1.0 seconds of echo. Ideal for home practice setups.

**Hall** — Medium-sized hall ambience. Richer, more natural reverb with about 1-2 seconds of echo. Great for a concert hall feel.

**Cathedral** — Large cathedral ambience. Very spacious, dramatic reverb with about 2-4 seconds of echo. Use sparingly — can overwhelm simple melodies.

## Wet Mix (0-100%)

Controls how much reverb vs dry signal:

- **0%** = only dry (no reverb)
- **50%** = balanced mix
- **100%** = only reverb (very spacious)

## Recommended Settings

| Scenario | Type | Wet Mix |
| --- | --- | --- |
| **Home practice** | Room | 30-50% |
| **Focus sessions** | Off or Room | 20-30% |
| **Creative use** | Hall | 50-70% |

> **Note:** Reverb can mask pitch detection errors. Use with caution if you're trying to train precise pitch accuracy.
      `,
      steps: [
        {
          title: 'Select Reverb Type',
          description: 'Choose your reverb space',
          action: 'Select reverb type',
          target: '#reverb-type',
        },
        {
          title: 'Adjust Wet Mix',
          description: 'Control reverb intensity',
          action: 'Move wet mix slider',
          target: '#reverb-wetness',
        },
        {
          title: 'Apply and Test',
          description: 'Play back to hear the effect',
          action: 'Play melody',
          target: '.play-btn',
        },
      ],
      thumbnail: '🏛️',
    },
  ],
  study: [
    {
      id: 'study-pitch-basics',
      tab: 'study',
      title: 'Understanding Pitch',
      description: 'Learn the fundamentals of pitch and how it works',
      content: `
Understanding pitch is essential for effective vocal practice. Here's what you need to know:

## What is Pitch?

Pitch is how high or low a sound is, measured in **hertz (Hz)**.

- **Higher frequency** = higher pitch (shrill sound)
- **Lower frequency** = lower pitch (deep sound)
- Human vocal range typically spans from about **85 Hz** (deep bass) to **2550 Hz** (high soprano)

## How We Measure Pitch

- **Cents**: A musical interval where 100 cents = 1 semitone (half step)
- **Perfect** pitch is within +/- 10 cents
- **Excellent** pitch is within +/- 25 cents
- **Good** pitch is within +/- 50 cents

> **Info:** In pitch-perfect practice, you'll match exact pitches to build accuracy. The smaller the cent deviation, the closer you are to the target note.

## Tonal Centers

- **Tonic (Root)**: The home note — the note you try to return to
- **Scale**: A set of notes used in music (Major, Minor, Pentatonic, etc.)
- **Key**: The tonal center and scale combined (e.g., C Major, A Minor)

Knowing your key helps you stay in tune with the music.

## The 12-Tone System

All Western music is based on 12 notes within an octave:

**C, C#, D, D#, E, F, F#, G, G#, A, A#, B**

## Tips for Pitch Practice

1. Start slowly — rushing causes errors
2. Hum before singing to "warm up" your pitch perception
3. Use the **tonic anchor** in settings when learning new keys
4. Practice every day for the best results

> **Tip:** Consistency beats intensity. Just 10 minutes daily yields far better results than a 2-hour session once a week.
      `,
      steps: [
        {
          title: 'Understand Your Range',
          description: 'Know your vocal range limits',
          action: 'Try different notes',
          target: '.pitch-canvas',
        },
        {
          title: 'Learn Your Key',
          description: 'Select a scale and find the tonic',
          action: 'Select scale',
          target: '#key-select',
        },
        {
          title: 'Use Anchor Tone',
          description: 'Practice with a reference pitch',
          action: 'Enable tonic anchor',
          target: '#tonic-anchor',
        },
      ],
      thumbnail: '🎵',
    },
    {
      id: 'study-scale-types',
      tab: 'study',
      title: 'Common Musical Scales',
      description: 'Learn different scale types used in music',
      content: `
Different scales create different moods and are used in various musical contexts.

## Major Scales

**C Major**: The "do-re-mi-fa-so-la-ti-do" scale. Bright, cheerful, and uplifting.

- Notes: C, D, E, F, G, A, B (all natural, no sharps/flats)
- Best for: Beginners and optimistic melodies

## Natural Minor Scales

Emotional, reflective, and sometimes sad.

- **C Minor**: C, D, Eb, F, G, Ab, Bb
- Uses the same notes as relative major (A Major) but starts on a different note
- Best for: Melancholic or emotional expressions

## Pentatonic Scales

Very versatile and easy to use — notes never clash or sound wrong together.

- **Major Pentatonic**: C, D, E, G, A (omits F and B)
- **Minor Pentatonic**: C, Eb, F, G, Bb (omits D and A)

Common in folk music, blues, rock, and pop. Best for improvisation and casual playing.

## Blues Scale

Minor pentatonic plus flatted 5th (the "blue note"). Adds expressive, soulful character.

- Notes: C, Eb, F, F#, G, Bb
- Best for: Blues and soul music

## Chromatic Scale

All 12 notes, half steps only: C, C#, D, D#, E, F, F#, G, G#, A, A#, B, C.

Best for: Demonstrating full pitch range.

## Which Scale Should I Use?

| Level | Recommendation |
| --- | --- |
| **Beginners** | Major Pentatonic (most forgiving) |
| **Pop music** | Major scale or Mixolydian |
| **Blues/Jazz** | Minor Pentatonic or Blues scale |
| **Solo practice** | Try all of them to develop flexibility |

> **Tip:** Use "once mode" at slow speed to practice each scale note by note. This builds muscle memory for each interval.
      `,
      steps: [
        {
          title: 'Try C Major',
          description: 'The simplest, most cheerful scale',
          action: 'Select C Major scale',
          target: '#scale-select',
        },
        {
          title: 'Try Minor Pentatonic',
          description: 'Versatile and easy to use',
          action: 'Select Minor Pentatonic',
          target: '#scale-select',
        },
        {
          title: 'Experiment Freely',
          description: 'Play notes to see what sounds good',
          action: 'Use Play button',
          target: '.play-btn',
        },
      ],
      thumbnail: '🎼',
    },
    {
      id: 'study-progress-tracking',
      tab: 'study',
      title: 'Tracking Your Progress',
      description: 'How to use practice sessions to improve',
      content: `
Progress tracking helps you see your improvement over time and stay motivated.

## What Gets Tracked

- **Score history**: Average pitch accuracy over multiple runs
- **Sessions**: Total time and number of practice runs
- **Perfect days**: Days when you achieved all perfect scores
- **Streaks**: Consecutive days of practice

## Understanding Your Scores

| Rating | Cents Off | Meaning |
| --- | --- | --- |
| **Perfect** | ≤ 10 cents | You're on pitch! |
| **Excellent** | ≤ 25 cents | Very good, getting closer |
| **Good** | ≤ 50 cents | Acceptable, room for improvement |
| **Okay** | ≤ 75 cents | Listen more closely next time |

## Interpreting Results

**Improving trend** — If your Perfect score goes from 70% to 85%, you're getting better. Keep going!

> **Note:** If you're stuck at 70-80% for weeks, try these:
>- Slow down playback speed
>- Practice harder melodies
>- Reduce background noise
>- Adjust detection threshold

**Too easy** — If consistently getting 90%+, challenge yourself with more difficult melodies.

## Daily Practice Routines

| Level | Duration | Focus |
| --- | --- | --- |
| **Beginner** | 10-15 min | Easy melodies, accuracy |
| **Intermediate** | 20-30 min | Mix of easy/hard, speed |
| **Advanced** | 30+ min | Challenging pieces, expression |

## Consistency Over Intensity

- **10 minutes every day** > 2 hours once a week
- The brain needs regular exposure to build pitch memory
- Use reminders or set a daily time (morning or evening)
- Track streaks — seeing consecutive days motivates continued practice

> **Tip:** Celebrate wins! First time perfecting a melody? Best score ever? Nailing a difficult section? Make note of these achievements!
      `,
      steps: [
        {
          title: 'Check Your History',
          description: 'View your past practice sessions',
          action: 'View history',
          target: '.session-history',
        },
        {
          title: 'Analyze Scores',
          description: 'Look for improvement trends',
          action: 'Review session data',
          target: '.stats-panel',
        },
        {
          title: 'Set a Goal',
          description: 'Challenge yourself to improve',
          action: 'Set practice goal',
          target: '.practice-controls',
        },
      ],
      thumbnail: '📈',
    },
    {
      id: 'study-tips-tricks',
      tab: 'study',
      title: 'Pro Tips for Better Practice',
      description: 'Advanced techniques to accelerate your progress',
      content: `
Use these professional practice techniques to get the most out of your sessions.

## Preparation Before Practicing

1. **Warm up your voice** — Hum gentle scales before singing
2. **Check your environment** — Quiet room, good microphone placement
3. **Adjust settings** — Use appropriate sensitivity for your space
4. **Know the melody** — Listen to it several times first

## During Practice

- **Start slow** (0.5x-0.75x speed) before increasing
- **Use metronome** — builds rhythmic accuracy first, then add pitch
- **Focus on transitions** — hardest parts are often between phrases
- **Don't rush** — rushing masks pitch errors
- **Record yourself** — hear where you're slipping off pitch

## Common Mistakes to Avoid

> **Warning:** Avoid these habits that slow your progress:

- **Practicing too fast** — It's a pitch trainer, not a speed contest
- **Ignoring rhythm** — You can't have perfect pitch without good timing
- **Practicing when distracted** — Full concentration gives better results
- **Always playing favorites** — Variety builds better pitch recognition
- **Expecting overnight progress** — Pitch accuracy develops over weeks

## Advanced Techniques

- **Sight reading practice** — Look at the music and sing it
- **Transposition** — Practice the same melody in different keys
- **Different voices** — Try chest voice, head voice, falsetto
- **Different tempos** — Practice at 50%, 75%, 100%, 125%, 150%
- **Ear training** — Hum and guess the pitch before checking

## Building Long-Term Skills

- **Consistency wins** — Practice daily, even for short sessions
- **Set specific goals** — "Get perfect on melody X this week"
- **Track your progress** — See improvement over time
- **Enjoy the journey** — Music practice is rewarding when you see growth
- **Learn from mistakes** — Each error is data about where you need work

> **Note:** Perfect pitch is a skill that develops with practice, not something you're born with. You have the capacity — commit to daily practice and you'll see results!
      `,
      steps: [
        {
          title: 'Warm Up First',
          description: 'Prepare your voice before practice',
          action: 'Do a quick warm-up',
          target: '.pitch-canvas',
        },
        {
          title: 'Use Metronome',
          description: 'Build rhythmic accuracy',
          action: 'Toggle metronome',
          target: '.metronome-btn',
        },
        {
          title: 'Practice Different Keys',
          description: 'Transpose melodies to test flexibility',
          action: 'Select different key',
          target: '#key-select',
        },
      ],
      thumbnail: '✨',
    },
  ],
}

export type WalkthroughProgress = Record<string, number> // walkthroughId -> completionTimestamp
