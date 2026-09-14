// Score synth velocity — one authored-note dynamic curve for pitched room guides.

/** Legacy/generated notes without a valid MIDI velocity retain unity gain. */
export function scoreSynthVelocityGain(velocity: number | undefined): number {
  if (
    velocity === undefined ||
    !Number.isInteger(velocity) ||
    velocity < 1 ||
    velocity > 127
  ) {
    return 1
  }
  // Keep quiet written notes audible without turning every part into fortissimo.
  return 0.12 + 0.88 * (velocity / 127) ** 1.4
}
