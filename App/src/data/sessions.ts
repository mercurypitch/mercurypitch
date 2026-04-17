// ============================================================
// Static Practice Session Templates
// These sessions are built-in and always available.
// Each session sequences a set of items (scales, exercises)
// that the session engine loads and plays in order.
// ============================================================

import type { PracticeSession } from '@/types';

export const PRACTICE_SESSIONS: PracticeSession[] = [
  {
    id: 'warmup-2min',
    name: '2-Minute Warm-up',
    description: 'Quick warm-up with ascending and descending major scale, plus a simple melody.',
    difficulty: 'beginner',
    category: 'vocal',
    items: [
      { type: 'scale', scaleType: 'major', label: 'Major Scale (ascending)', beats: 8 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'major', label: 'Major Scale (descending)', beats: 8 },
      { type: 'rest', restMs: 3000, label: 'Rest' },
      { type: 'scale', scaleType: 'pentatonic-major', label: 'Pentatonic Exercise', beats: 8 },
    ],
  },
  {
    id: 'vocal-5min',
    name: '5-Minute Vocal Warm-up',
    description: 'Full vocal warm-up: chromatic passage, major arpeggio, and a simple melody to finish.',
    difficulty: 'beginner',
    category: 'vocal',
    items: [
      { type: 'scale', scaleType: 'chromatic', label: 'Chromatic Scale', beats: 12 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'major', label: 'Major Arpeggio (1 octave)', beats: 8 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'pentatonic-major', label: 'Pentatonic Melody', beats: 8 },
      { type: 'scale', scaleType: 'major', label: 'Major Scale (1 octave)', beats: 8 },
    ],
  },
  {
    id: 'instrumental-5min',
    name: '5-Minute Instrumental',
    description: 'Essential instrumental warm-up: major and minor scales plus a pentatonic exercise.',
    difficulty: 'beginner',
    category: 'instrumental',
    items: [
      { type: 'scale', scaleType: 'major', label: 'Major Scale (2 octaves)', beats: 16 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'natural-minor', label: 'Natural Minor Scale', beats: 16 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'pentatonic-major', label: 'Pentatonic Exercise', beats: 8 },
    ],
  },
  {
    id: 'practice-10min',
    name: '10-Minute Practice Session',
    description: 'Comprehensive practice: scales, chromatic exercises, arpeggios, and short melodies.',
    difficulty: 'intermediate',
    category: 'general',
    items: [
      { type: 'scale', scaleType: 'major', label: 'Major Scale (2 octaves)', beats: 16 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'chromatic', label: 'Chromatic Exercise', beats: 12 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'major', label: 'Major Arpeggio', beats: 8 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'natural-minor', label: 'Natural Minor Scale', beats: 16 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'dorian', label: 'Dorian Mode Exercise', beats: 8 },
    ],
  },
  {
    id: 'ear-training-10min',
    name: '10-Minute Ear Training',
    description: 'Train your ear with interval exercises across major, minor, and modal scales.',
    difficulty: 'intermediate',
    category: 'ear-training',
    items: [
      { type: 'scale', scaleType: 'major', label: 'Major Scale', beats: 8 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'natural-minor', label: 'Natural Minor Scale', beats: 8 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'melodic-minor', label: 'Melodic Minor Scale', beats: 8 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'dorian', label: 'Dorian Mode', beats: 8 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'mixolydian', label: 'Mixolydian Mode', beats: 8 },
    ],
  },
  {
    id: 'deep-20min',
    name: '20-Minute Deep Practice',
    description: 'Extended practice for serious musicians: scales, modes, arpeggios, and full melodies.',
    difficulty: 'advanced',
    category: 'general',
    items: [
      { type: 'scale', scaleType: 'chromatic', label: 'Chromatic Warm-up', beats: 12 },
      { type: 'rest', restMs: 3000, label: 'Rest' },
      { type: 'scale', scaleType: 'major', label: 'Major Scale (2 oct)', beats: 16 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'harmonic-minor', label: 'Harmonic Minor Scale', beats: 16 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'melodic-minor', label: 'Melodic Minor Scale', beats: 16 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'dorian', label: 'Dorian Mode', beats: 8 },
      { type: 'rest', restMs: 3000, label: 'Rest' },
      { type: 'scale', scaleType: 'mixolydian', label: 'Mixolydian Mode', beats: 8 },
      { type: 'rest', restMs: 5000, label: 'Rest' },
      { type: 'scale', scaleType: 'pentatonic-major', label: 'Pentatonic Exercise', beats: 8 },
      { type: 'scale', scaleType: 'blues', label: 'Blues Scale Exercise', beats: 8 },
    ],
  },
];

// Map scale types to friendly descriptions
export const SCALE_DESCRIPTIONS: Record<string, string> = {
  'major': 'Major — bright and happy',
  'natural-minor': 'Natural Minor — sad and introspective',
  'harmonic-minor': 'Harmonic Minor — exotic tension',
  'melodic-minor': 'Melodic Minor — raised 6th and 7th',
  'chromatic': 'Chromatic — all semitones',
  'pentatonic-major': 'Pentatonic — folk and rock',
  'pentatonic-minor': 'Pentatonic Minor — blues and expressive',
  'blues': 'Blues — with the blue note',
  'dorian': 'Dorian — minor with raised 6th',
  'mixolydian': 'Mixolydian — major with flat 7th',
  'phrygian': 'Phrygian — dark, flat 2nd',
  'lydian': 'Lydian — dreamy, raised 4th',
  'locrian': 'Locrian — diminished, unstable',
};
