// ============================================================
// Song separations — credits named by what they buy
// ============================================================
//
// A credit splits one song of up to 12 minutes into voice and band on the
// Cloud GPU; a longer song or a full band split costs more (billing-core
// `uvrJobCost`). So a count of credits is "up to" that many songs, and one
// credit is one song, said without "up to": "up to 1 free song separations"
// read as a typo (review of PR 977).
//
// Shared by the surfaces outside onboarding that offer credits to someone
// who has not met one yet: Karaoke Night's signed-out line and the
// signed-out promo card, in the words onboarding's launch gift uses
// (src/lib/launch-gift-copy.ts). A surface about the balance itself
// (Settings > Credits, signed in) keeps "credits" and uses this to say what
// they buy.

/** "1 song separation" or "up to 5 song separations". */
export function songSeparations(credits: number): string {
  return credits === 1
    ? '1 song separation'
    : `up to ${credits} song separations`
}

/** "1 free song separation" or "up to 5 free song separations". */
export function freeSongSeparations(credits: number): string {
  return credits === 1
    ? '1 free song separation'
    : `up to ${credits} free song separations`
}

/** The same words opening a sentence or a title. */
export function capitalized(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1)
}
