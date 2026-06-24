// ============================================================
// Transform Registry — Plugin-like analysis transform system
// ============================================================

import type { TransformDescriptor, TransformInput, TransformOutputData, } from '@/types'

// ── Registry ─────────────────────────────────────────────────

const _registry = new Map<string, TransformDescriptor>()

/** Register a transform for discovery and execution. */
export function registerTransform(descriptor: TransformDescriptor): void {
  _registry.set(descriptor.id, descriptor)
}

/** Get all registered transforms, optionally filtered by category. */
export function getTransforms(
  category?: TransformDescriptor['category'],
): TransformDescriptor[] {
  const all = Array.from(_registry.values())
  if (category) return all.filter((t) => t.category === category)
  return all
}

/** Get a single transform by ID. */
export function getTransform(id: string): TransformDescriptor | undefined {
  return _registry.get(id)
}

// ── Built-in Transform Registration ─────────────────────────

export function registerBuiltinTransforms(): void {
  const transforms: TransformDescriptor[] = [
    {
      id: 'onset-detector',
      name: 'Onset & Beat Detector',
      description:
        'Detect note onsets and beat positions from audio using spectral flux analysis.',
      category: 'time',
      version: '1.0.0',
      outputs: [
        { id: 'onsets', name: 'Onsets', annotationType: 'instant' },
        { id: 'beats', name: 'Beats', annotationType: 'instant' },
      ],
      minDuration: 2,
    },
    {
      id: 'key-detector',
      name: 'Key Detector',
      description:
        'Detect musical key using Krumhansl-Schmuckler chroma correlation.',
      category: 'key',
      version: '1.0.0',
      outputs: [
        {
          id: 'key',
          name: 'Detected Key',
          annotationType: 'value',
          valueRange: [0, 11],
        },
      ],
      minDuration: 3,
    },
    {
      id: 'match-aligner',
      name: 'MATCH Alignment',
      description:
        'Align two recordings using chroma DTW with Sakoe-Chiba band constraint.',
      category: 'time',
      version: '1.0.0',
      outputs: [{ id: 'time-map', name: 'Time Map', annotationType: 'value' }],
      parameters: [
        {
          id: 'bandWidth',
          label: 'Band Width',
          type: 'number',
          default: 0.1,
          min: 0.05,
          max: 0.3,
        },
      ],
      minDuration: 3,
    },
    {
      id: 'chord-detector',
      name: 'Chord Detector',
      description:
        'Detect chords from audio using NNLS chroma and 48-template matching.',
      category: 'key',
      version: '1.0.0',
      outputs: [{ id: 'chords', name: 'Chords', annotationType: 'instant' }],
      minDuration: 3,
    },
    {
      id: 'segmenter',
      name: 'Structural Segmenter',
      description:
        'Detect song structure (verse, chorus, bridge) using self-similarity analysis.',
      category: 'structure',
      version: '1.0.0',
      outputs: [{ id: 'segments', name: 'Segments', annotationType: 'region' }],
      parameters: [
        {
          id: 'minSegmentDuration',
          label: 'Min Segment (s)',
          type: 'number',
          default: 4,
          min: 2,
          max: 12,
        },
        {
          id: 'maxSegments',
          label: 'Max Segments',
          type: 'number',
          default: 12,
          min: 2,
          max: 30,
        },
      ],
      minDuration: 5,
    },
    {
      id: 'vibrato-detector',
      name: 'Vibrato Detector',
      description:
        'Detect vibrato regions from pitch history using autocorrelation.',
      category: 'pitch',
      version: '1.0.0',
      outputs: [
        { id: 'vibrato', name: 'Vibrato Regions', annotationType: 'region' },
      ],
      minDuration: 1,
    },
    {
      id: 'hnr-estimator',
      name: 'HNR Estimator',
      description: 'Estimate harmonics-to-noise ratio from spectral data.',
      category: 'spectral',
      version: '1.0.0',
      outputs: [
        {
          id: 'hnr',
          name: 'HNR (dB)',
          annotationType: 'value',
          unit: 'db',
          valueRange: [-20, 40],
        },
      ],
      minDuration: 0.5,
    },
    {
      id: 'fatigue-tracker',
      name: 'Vocal Fatigue Tracker',
      description: 'Track vocal fatigue over multiple practice sessions.',
      category: 'spectral',
      version: '1.0.0',
      outputs: [
        { id: 'fatigue', name: 'Fatigue State', annotationType: 'value' },
      ],
      minDuration: 10,
    },
    {
      id: 'yinn-pitch',
      name: 'YIN Pitch Detector',
      description: 'Estimate fundamental frequency using the YIN algorithm.',
      category: 'pitch',
      version: '1.0.0',
      outputs: [
        {
          id: 'pitch',
          name: 'Pitch (Hz)',
          annotationType: 'value',
          unit: 'hz',
          valueRange: [65, 2000],
        },
      ],
      parameters: [
        {
          id: 'minConfidence',
          label: 'Min Confidence',
          type: 'number',
          default: 0.4,
          min: 0.1,
          max: 0.9,
        },
      ],
    },
  ]

  for (const t of transforms) {
    registerTransform(t)
  }
}

// ── Runner ───────────────────────────────────────────────────

/**
 * Run a registered transform (placeholder for future worker-based execution).
 * Currently, transforms are run inline by their dedicated clients (OnsetClient, etc.).
 * This function exists as the architectural hook for the plugin system.
 */
export function runTransform(
  _transformId: string,
  _input: TransformInput,
  _onFeature: (outputId: string, data: TransformOutputData) => void,
  _onComplete: () => void,
  _onError: (error: string) => void,
): { abort: () => void } {
  // Stub — individual transforms are invoked via dedicated clients for now.
  // In a full implementation, this would spawn a Worker for the registered transform.
  _onError(
    'Transform execution not yet implemented. Use dedicated client classes instead.',
  )
  return { abort: () => {} }
}
