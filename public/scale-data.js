/**
 * Scale and note data for PitchPerfect.
 * All frequencies in Hz, based on A4 = 440 Hz equal temperament.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Semitone offsets from C for a major scale (W-W-H-W-W-W-H)
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12];

// Scale mode definitions (semitone intervals from root)
const SCALE_MODES = {
    'major': [0, 2, 4, 5, 7, 9, 11, 12],
    'natural-minor': [0, 2, 3, 5, 7, 8, 10, 12],
    'harmonic-minor': [0, 2, 3, 5, 7, 8, 11, 12],
    'melodic-minor': [0, 2, 3, 5, 7, 9, 11, 12],
    'dorian': [0, 2, 3, 5, 7, 9, 10, 12],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10, 12],
    'phrygian': [0, 1, 3, 5, 7, 8, 10, 12],
    'lydian': [0, 2, 4, 6, 7, 9, 11, 12],
    'locrian': [0, 1, 3, 5, 6, 8, 10, 12],
    'pentatonic-major': [0, 2, 4, 7, 9, 12],
    'pentatonic-minor': [0, 3, 5, 7, 10, 12],
    'blues': [0, 3, 5, 6, 7, 10, 12],
    'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
};

// Scale mode display names
const SCALE_MODE_NAMES = {
    'major': 'Major (Ionian)',
    'natural-minor': 'Natural Minor (Aeolian)',
    'harmonic-minor': 'Harmonic Minor',
    'melodic-minor': 'Melodic Minor',
    'dorian': 'Dorian',
    'mixolydian': 'Mixolydian',
    'phrygian': 'Phrygian',
    'lydian': 'Lydian',
    'locrian': 'Locrian',
    'pentatonic-major': 'Pentatonic Major',
    'pentatonic-minor': 'Pentatonic Minor',
    'blues': 'Blues',
    'chromatic': 'Chromatic (Free)'
};

// Map key name to semitone offset from C
const KEY_OFFSETS = {
    'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'Bb': 10
};

/**
 * Calculate frequency from MIDI note number.
 * MIDI 69 = A4 = 440 Hz
 */
function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Calculate MIDI note number from note name and octave.
 * C4 = MIDI 60
 */
function noteToMidi(noteName, octave) {
    const noteIndex = NOTE_NAMES.indexOf(noteName);
    return (octave + 1) * 12 + noteIndex;
}

/**
 * Get the closest note name, octave, and cents offset from a frequency.
 */
function freqToNote(freq) {
    if (freq <= 0) return { name: '--', octave: 0, cents: 0, midi: 0 };

    const midi = 69 + 12 * Math.log2(freq / 440);
    const roundedMidi = Math.round(midi);
    const cents = Math.round((midi - roundedMidi) * 100);
    const noteIndex = ((roundedMidi % 12) + 12) % 12;
    const octave = Math.floor(roundedMidi / 12) - 1;

    return {
        name: NOTE_NAMES[noteIndex],
        octave: octave,
        cents: cents,
        midi: roundedMidi,
        freq: midiToFreq(roundedMidi)
    };
}

/**
 * Build a major scale for a given key and octave.
 * Returns array of { name, freq, midi, degree } objects.
 * Includes the octave note at the top (8 notes total).
 */
function buildMajorScale(keyName, octave) {
    const keyOffset = KEY_OFFSETS[keyName] || 0;
    const baseMidi = noteToMidi('C', octave) + keyOffset;

    return MAJOR_SCALE_INTERVALS.map((interval, i) => {
        const midi = baseMidi + interval;
        const noteIndex = ((midi % 12) + 12) % 12;
        const noteOctave = Math.floor(midi / 12) - 1;
        return {
            name: NOTE_NAMES[noteIndex],
            octave: noteOctave,
            freq: midiToFreq(midi),
            midi: midi,
            degree: i + 1
        };
    });
}

/**
 * Build a scale for a given key, octave, and mode.
 * Returns array of { name, freq, midi, degree } objects.
 * Includes the octave note at the top.
 */
function buildScale(keyName, octave, mode) {
    mode = mode || 'major';
    const keyOffset = KEY_OFFSETS[keyName] || 0;
    const intervals = SCALE_MODES[mode] || SCALE_MODES['major'];
    const baseMidi = noteToMidi('C', octave) + keyOffset;

    return intervals.map((interval, i) => {
        const midi = baseMidi + interval;
        const noteIndex = ((midi % 12) + 12) % 12;
        const noteOctave = Math.floor(midi / 12) - 1;
        return {
            name: NOTE_NAMES[noteIndex],
            octave: noteOctave,
            freq: midiToFreq(midi),
            midi: midi,
            degree: i + 1
        };
    });
}

/**
 * Build a major scale (for backwards compatibility).
 */
function buildMajorScale(keyName, octave) {
    return buildScale(keyName, octave, 'major');
}

/**
 * Build a scale spanning multiple octaves.
 * Returns a flat array of notes from highest to lowest pitch.
 * Each octave shares the same key/mode pattern.
 */
function buildMultiOctaveScale(keyName, startOctave, numOctaves, mode) {
    mode = mode || 'major';
    const notes = [];
    const intervals = SCALE_MODES[mode] || SCALE_MODES['major'];
    for (let o = 0; o < numOctaves; o++) {
        const octave = startOctave + o;
        const keyOffset = KEY_OFFSETS[keyName] || 0;
        const baseMidi = noteToMidi('C', octave) + keyOffset;

        for (let i = 0; i < intervals.length; i++) {
            const midi = baseMidi + intervals[i];
            const noteIndex = ((midi % 12) + 12) % 12;
            const noteOctave = Math.floor(midi / 12) - 1;
            // Skip the octave root (last interval) for all but the last octave
            if (i === intervals.length - 1 && o < numOctaves - 1) continue;
            notes.push({
                name: NOTE_NAMES[noteIndex],
                octave: noteOctave,
                freq: midiToFreq(midi),
                midi: midi,
                degree: i + 1
            });
        }
    }
    return notes; // highest to lowest (MIDI descending)
}

/**
 * Check if a MIDI note is in the given scale/mode.
 * Returns true if the note's pitch class is part of the scale.
 */
function isNoteInScale(midi, keyName, mode) {
    mode = mode || 'major';
    const keyOffset = KEY_OFFSETS[keyName] || 0;
    const intervals = SCALE_MODES[mode] || SCALE_MODES['major'];
    const pitchClass = ((midi - keyOffset) % 12 + 12) % 12;
    return intervals.includes(pitchClass);
}

/**
 * Get all 12 semitones for chromatic/free mode.
 */
function buildChromaticScale(startOctave) {
    const notes = [];
    const baseMidi = noteToMidi('C', startOctave);
    for (let i = 0; i < 12; i++) {
        const midi = baseMidi + i;
        const noteIndex = ((midi % 12) + 12) % 12;
        const noteOctave = Math.floor(midi / 12) - 1;
        notes.push({
            name: NOTE_NAMES[noteIndex],
            octave: noteOctave,
            freq: midiToFreq(midi),
            midi: midi,
            degree: i + 1
        });
    }
    return notes;
}

/**
 * Generate a sample melody in the given key/octave.
 * Returns array of { note, duration } where duration is in beats.
 * This is a simple ascending-descending scale pattern.
 */
function buildSampleMelody(keyName, octave) {
    const scale = buildMajorScale(keyName, octave);
    const melody = [];

    // Ascending scale: each note 1 beat
    for (let i = 0; i < scale.length; i++) {
        melody.push({ note: scale[i], duration: 1 });
    }

    // Descending scale (skip the top note since we just played it)
    for (let i = scale.length - 2; i >= 0; i--) {
        melody.push({ note: scale[i], duration: 1 });
    }

    // End with a held root
    melody.push({ note: scale[0], duration: 2 });

    return melody;
}

/**
 * Get total duration of a melody in beats.
 */
function melodyTotalBeats(melody) {
    return melody.reduce((sum, item) => sum + item.duration, 0);
}

/**
 * Get the note at a given beat position in the melody.
 */
function melodyNoteAtBeat(melody, beat) {
    let accum = 0;
    for (const item of melody) {
        if (beat >= accum && beat < accum + item.duration) {
            return item;
        }
        accum += item.duration;
    }
    return melody[melody.length - 1];
}

/**
 * Get the note index at a given beat position.
 */
function melodyIndexAtBeat(melody, beat) {
    let accum = 0;
    for (let i = 0; i < melody.length; i++) {
        if (beat >= accum && beat < accum + melody[i].duration) {
            return i;
        }
        accum += melody[i].duration;
    }
    return melody.length - 1;
}
