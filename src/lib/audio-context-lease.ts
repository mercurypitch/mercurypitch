// ============================================================
// A claim on the app's one AudioContext, as its holder uses it
// ============================================================
//
// The native app has one AudioContext, kept by the audio broker
// (packages/audio-io). A room claims it and lends the claim to what it
// hosts: the stem mixer builds its graph on the lent context and resumes it
// through the claim, inside the tap that plays (REQ-NRM-033). It never
// closes it (REQ-NRM-038). Only the claimant gives the claim back, so what
// is lent carries no release.
//
// Only a type, and a leaf: every layer that passes the claim along names it
// from here.

export interface AudioContextLease {
  ensure(): AudioContext | null
  unlock(): Promise<boolean>
}
