// ============================================================
// Walkthrough Types and Definitions
// ============================================================

export type WalkthroughTab = 'practice' | 'editor' | 'settings'

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

export const WALKTHROUGHS: Record<WalkthroughTab, WalkthroughContent[]> = {
  practice: [
    {
      id: 'practice-toolbar',
      tab: 'practice',
      title: 'Practice Toolbar Overview',
      description: 'Master the main practice controls for vocal pitch training',
      content: `
In Practice mode, the Shared Toolbar provides all essential controls for your practice session:

**Essential Controls**
- **Microphone Button**: Enables pitch detection. Keep this active during practice to see real-time feedback on the pitch canvas.
- **Play/Pause/Stop**: Control playback of your melody. Pause allows you to practice a specific section, Stop resets to the beginning.
- **Focus Mode**: Enter minimal UI mode for distraction-free practice.

**Playback Controls**
- **Play Button**: Starts playback from the beginning of the melody (with optional count-in).
- **Pause**: Pauses playback at the current position.
- **Continue**: Resumes after pausing.
- **Stop**: Ends playback and resets to the start.

**Practice Modes**
- **Once**: Practice each note once from beginning to end.
- **Repeat**: Loop the melody repeatedly for focused repetition.
- **Practice Mode**: Runs through the melody randomly, helping you internalize the pattern.

**Session Mode** (when available):
- Select from pre-defined practice sessions or create your own custom sessions.

**Additional Settings**
- **BPM**: Adjust tempo (40-280 BPM). Lower speeds are great for beginners.
- **Volume**: Control playback volume.
- **Speed**: 0.25x to 2.0x playback speed. Slower speeds help with difficult sections.
- **Metronome**: Toggle metronome clicks on each beat for rhythmic accuracy.
- **Cycles**: Set how many times to repeat (for practice/repeat modes).

**Pro Tips:**
1. Start at a slower speed (0.5x-0.75x) when learning a new melody.
2. Use metronome for rhythmic accuracy, especially in faster passages.
3. Focus Mode minimizes distractions for deep practice sessions.
4. Adjust sensitivity based on your environment (noisy rooms need higher threshold).
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
          description: 'Use the speed dropdown to slow down or speed up playback',
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
      tab: 'practice',
      title: 'Understanding Practice Modes',
      description: 'Learn when to use Once, Repeat, or Practice mode',
      content: `
PitchPerfect offers three practice modes, each designed for different learning goals:

**Once Mode (Default)**
- Plays through the melody exactly once, note by note
- Best for: Initial learning, memorization, and getting familiar with the melody
- Control: Use "Cycles" setting to repeat multiple times if desired

**Repeat Mode**
- Loops the melody continuously until you stop
- Best for: Perfecting difficult sections, muscle memory development
- No repetition limit—stop when you feel comfortable

**Practice Mode**
- Randomizes the order of notes each run
- Best for: Strengthening pitch recognition and reducing pattern memorization
- Each "run" goes through all notes but in different order

**Session Mode** (for advanced users)
- Uses pre-defined or custom practice sessions with multiple melodies
- Each session item is played in sequence
- Track progress across multiple melodies

**When to use each mode:**
- Beginner: Start with Once mode at 0.5x speed
- Intermediate: Try Practice mode to test pitch memory
- Advanced: Create sessions with multiple melodies for comprehensive training
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
  editor: [
    {
      id: 'editor-toolbar',
      tab: 'editor',
      title: 'Editor Toolbar Overview',
      description: 'Learn how to use the piano roll editor to compose melodies',
      content: `
The Editor tab is your creative workspace for composing melodies. The toolbar provides essential tools for building, editing, and exporting your music:

**Essential Tools**
- **Save Melody Button**: Save your composition to the melody library
- **Key Selector**: Choose the musical key (C, D, E, F, G, A, B)
- **Scale Selector**: Select scale type (Major, Minor, Pentatonic, etc.)
- **BPM Control**: Set tempo for playback (40-280 BPM)

**Note Operations**
- **Place Tool**: Click on the grid to place notes
- **Select Tool**: Click and drag to select notes
- **Delete Tool**: Remove unwanted notes

**Editor Features**
- **Piano Roll Grid**: Visual representation of pitch vs time
- **Octave Shift**: Change the default octave for new notes
- **Snap-to-Grid**: Align notes to time grid for clean timing
- **Zoom Controls**: Zoom in/out to see finer details

**Export Options**
- **WAV Export**: Download your melody as an audio file
- **MIDI Export**: Export as MIDI for use in DAWs
- **MIDI Import**: Load melodies from MIDI files

**Canvas Navigation**
- Scrollable horizontally for longer melodies
- Vertically shows multiple octaves
- Playback head shows current position

**Pro Tips:**
1. Start with Major scale for simplicity, then try Minor or Pentatonic
2. Use Snap-to-Grid for clean, rhythmic melodies
3. Record directly into the piano roll using the Record button
4. Export as WAV for listening on any device, MIDI for DAW workflows
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
      tab: 'editor',
      title: 'Importing and Exporting MIDI',
      description: 'Workflow for working with MIDI files',
      content: `
MIDI files are a universal format for sharing music between applications. PitchPerfect supports both import and export:

**Exporting MIDI**
1. Complete your melody in the piano roll
2. Click the MIDI Export button (floppy disk icon)
3. Your melody is downloaded as a .mid file
4. Import this file into DAWs like FL Studio, Ableton, Logic Pro

**Importing MIDI**
1. Click the MIDI Import button
2. Select your .mid file
3. Your melody is converted and appears on the piano roll
4. You can then edit or save it as your own composition

**MIDI Best Practices:**
- MIDI preserves note timing and pitch information
- Great for collaborating with other musicians
- Compatible with virtually all music software
- The file doesn't include audio, just note data

**Supported MIDI Features:**
- Note pitch and duration
- Velocity (volume) information
- Channel mapping
- Tempo information (may require mapping to PitchPerfect tempo)

**Note:** If importing MIDI doesn't work perfectly, it's due to MIDI format variations. Manually edit in the piano roll after import.
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
      tab: 'editor',
      title: 'Advanced Editor Features',
      description: 'Tips and techniques for complex melodies',
      content: `
The Editor offers several advanced features for creating sophisticated melodies:

**Octave Management**
- Default octave sets where new notes appear
- You can manually place notes in different octaves
- Changes affect how the melody spans the keyboard

**Scale Reference**
- The selected scale shows valid notes in that key
- Notes outside the scale produce different pitches
- Use chromatic for full flexibility

**Snap-to-Grid**
- Aligns notes to time divisions (1/4, 1/8, 1/16 note)
- Makes melodies rhythmically consistent
- Can be toggled on/off for free-form placement

**Visual Aids**
- Grid lines help align notes visually
- Note labels show pitch names
- Playback head shows current position in real-time

**Editing Techniques**
- **Select multiple notes**: Use Select tool and click/drag
- **Copy notes**: Select and copy/paste
- **Delete notes**: Select and click Delete tool
- **Adjust timing**: Drag note edges to change duration

**Creating Variations**
1. Start with a base melody
2. Export as MIDI
3. Import into your DAW to add harmonies
4. Bring back interesting sections to the piano roll

**Pro Tips:**
- Layer octaves for richer sounds (high + low octaves)
- Use rests strategically for musical phrasing
- Export to MIDI for advanced editing in your favorite DAW
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

**Sensitivity Presets**
- Quick presets for different environments (Quiet Room, Home, Noisy)
- Adjusts pitch detection thresholds automatically
- Recommended: Use these instead of manual adjustments

**Pitch Detection**
- **Detection Threshold**: Lower = stricter detection (ignore noise), Higher = more sensitive
- **Sensitivity**: Higher = more responsive to quiet signals
- **Min Confidence**: Minimum confidence % to accept a pitch
- **Min Amplitude**: Minimum signal loudness required
- *Tip: Start with "Home" preset and adjust based on feedback*

**Practice Aids**
- **Tonic Anchor Tone**: Plays a reference note at start to help lock into key
- *Use this when learning new keys or scales*

**Accuracy Bands** (cent thresholds)
- **Perfect**: ≤ cents off (100 cents = semitone)
- **Excellent**: ≤ cents off (90 cents)
- **Good**: ≤ cents off (75 cents)
- **Okay**: ≤ cents off (50 cents)
- *These define your scoring bands in practice*

**Tone Envelope (ADSR)**
- **Attack**: Time to reach full volume (0-1000ms)
- **Decay**: Time to fall to sustain (0-1000ms)
- **Sustain**: Volume during note held (0-100%)
- **Release**: Time to fade after note ends (0-2000ms)
- *Longer attack/release = smoother, more musical sound*

**Visibility**
- **Grid Lines**: Toggle canvas grid
- **Theme**: Dark or Light mode

**Playback Speed**
- 0.25x to 2.0x speed multiplier
- Use slower speeds for learning difficult passages
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
The ADSR (Attack, Decay, Sustain, Release) envelope controls how each note sounds when played:

**Attack (0-1000ms)**
- Time from note start to full volume
- Short attack = sharp, percussive sound
- Long attack = smooth, flowing sound
- *Typical: 50-200ms for smooth melody playback*

**Decay (0-1000ms)**
- Time to fall from peak to sustain level
- Short decay = quick energy drop
- Long decay = sustained sound
- *Typical: 100-300ms for natural decay*

**Sustain (0-100%)**
- Volume level during sustained notes
- 0% = note immediately fades after peak
- 100% = note sustains at full volume
- *Typical: 70-80% for pleasant sustain*

**Release (0-2000ms)**
- Time after note ends to fade to silence
- Short release = sudden stop
- Long release = smooth fade-out
- *Typical: 200-500ms for musical feel*

**Recommended Presets:**
- **Piano**: Attack 150ms, Decay 300ms, Sustain 80%, Release 400ms
- **Organ**: Attack 50ms, Decay 100ms, Sustain 90%, Release 200ms
- **Soft Pad**: Attack 300ms, Decay 500ms, Sustain 60%, Release 800ms

**Tips:**
- Adjust attack/release together for smooth transitions
- Excessively long releases can make songs sound "echoey"
- Shorter envelopes work better for fast-paced music
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
Reverb adds environmental space to audio, making it sound like it's played in different-sized rooms or spaces:

**Reverb Types:**

**Off**
- Pure, dry sound with no reverb
- Use this when space is at a premium
- Best for tight, focused practice

**Room**
- Small room ambience
- Adds subtle depth
- Ideal for home practice setups
- Adds about 0.5-1.0 seconds of echo

**Hall**
- Medium-sized hall ambience
- Richer, more natural reverb
- Great for practice feel like being in a concert hall
- Adds about 1-2 seconds of echo

**Cathedral**
- Large cathedral ambience
- Very spacious, dramatic reverb
- Use sparingly—can overwhelm simple melodies
- Adds about 2-4 seconds of echo

**Wet Mix (0-100%)**
- How much reverb vs dry signal
- 0% = only dry (no reverb)
- 50% = balanced mix
- 100% = only reverb (very spacious)

**Recommended Settings:**
- **Home practice**: Room, 30-50% wet
- **Focus sessions**: Off or Room, 20-30% wet
- **Creative use**: Hall, 50-70% wet for special effects

**Tips:**
- Start with low wet mix for subtle effect
- Increase mix gradually to avoid overwhelming the melody
- Reverb can mask pitch detection errors—use with caution
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
}

export type WalkthroughProgress = Record<string, number> // walkthroughId -> completionTimestamp