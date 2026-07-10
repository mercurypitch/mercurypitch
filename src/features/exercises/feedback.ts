// ============================================================
// Exercise feedback — score tiers, grades and one-shot SFX
// ============================================================
//
// The audit's core finding: evaluation was silent and numeric ("Last note:
// 64%") — no qualitative word, no sound, no run grade. This module is the
// shared vocabulary: per-note TIERS (Perfect/Great/Close/Missed), per-run
// GRADES (S–D, same bands as the karaoke scorer so the app speaks one
// grading language), and tiny oscillator blips for hit/miss feedback.
//
// SFX use their own throwaway AudioContext so they can never detune or cut
// the reference tones the exercise engine is playing.

export interface ScoreTier {
  label: 'Perfect' | 'Great' | 'Close' | 'Missed'
  className: 'perfect' | 'great' | 'close' | 'missed'
}

/** Per-note tier: ≥90 Perfect, ≥75 Great, ≥50 Close, else Missed. */
export function tierForScore(score: number): ScoreTier {
  if (score >= 90) return { label: 'Perfect', className: 'perfect' }
  if (score >= 75) return { label: 'Great', className: 'great' }
  if (score >= 50) return { label: 'Close', className: 'close' }
  return { label: 'Missed', className: 'missed' }
}

/** Combo continues while notes score at least this. */
export const COMBO_THRESHOLD = 75

/**
 * Per-run grade — S ≥95, A ≥85, B ≥70, C ≥50, D below: identical bands to
 * the karaoke mic scorer (mic-scoring.ts) so a grade means the same thing
 * everywhere in the app.
 */
export function gradeForScore(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 95) return 'S'
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}

// ── SFX ──────────────────────────────────────────────────────────────

let sfxCtx: AudioContext | null = null

function ctx(): AudioContext | null {
  try {
    const Ctor =
      globalThis.AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (Ctor === undefined) return null
    sfxCtx ??= new Ctor()
    if (sfxCtx.state === 'suspended') void sfxCtx.resume()
    return sfxCtx
  } catch {
    return null
  }
}

function blip(
  freq: number,
  startInMs: number,
  durationMs: number,
  gain: number,
): void {
  const ac = ctx()
  if (ac === null) return
  const t0 = ac.currentTime + startInMs / 1000
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  amp.gain.setValueAtTime(gain, t0)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000)
  osc.connect(amp)
  amp.connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + durationMs / 1000)
}

/**
 * Quiet, distinct blips per tier. Deliberately subtle (gain ≤ 0.07): the
 * singer is mid-exercise — feedback, not fanfare.
 */
export function playTierSfx(tier: ScoreTier): void {
  try {
    switch (tier.className) {
      case 'perfect': // quick ascending double — the "ding"
        blip(1318.5, 0, 90, 0.06) // E6
        blip(1760, 80, 140, 0.06) // A6
        break
      case 'great':
        blip(1174.7, 0, 120, 0.055) // D6
        break
      case 'close':
        blip(659.3, 0, 110, 0.05) // E5
        break
      case 'missed': // low, short, muted — a "whiff", not a punishment
        blip(196, 0, 130, 0.04) // G3
        break
    }
  } catch {
    // Sound is garnish — never let it break a run.
  }
}
