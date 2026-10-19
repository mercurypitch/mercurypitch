// ============================================================
// Merc's hello in the alley, remembered for the session
// ============================================================
//
// A new install meets Merc in the alley (S7b beat 1, AlleyGuide.tsx): he
// drops in there and says hello. The first note then finds him already
// there, asking for a note, instead of dropping in and saying hello a
// second time (useFirstNote.ts). Only this session's: a phone that comes
// back to the alley later meets him there again.

let greeted = false

/** He has said hello in the alley. */
export function markAlleyGreeted(): void {
  greeted = true
}

/** Whether he has said hello in the alley this session. */
export function alleyGreeted(): boolean {
  return greeted
}

/** Tests only: no hello said yet. */
export function resetAlleyGreetingForTests(): void {
  greeted = false
}
