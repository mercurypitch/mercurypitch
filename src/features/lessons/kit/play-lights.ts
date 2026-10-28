// ============================================================
// Lesson play lights — a play's button lit while its sound plays
// ============================================================
//
// A lesson's play buttons say they are playing: the button pressed lights
// (`is-on`, the kit's lit button in lesson-base.css) as its sound starts,
// and goes out when that sound ends, heard to its end or cut short. One
// page's plays share one light, as they share one sound (kit/now-playing.
// ts): a newer play puts out the one before, and the older play's ending
// later leaves the newer one lit. Lessons 10 and 12 light their stages'
// plays this way.

/** Lights a play's button while its sound, `done`, plays. */
export type PlayLight = (btn: HTMLButtonElement, done: Promise<boolean>) => void

/**
 * Lights a play's button while its sound plays, and puts it out when the
 * sound ends, by itself or cut short; a newer play puts out the one before.
 */
export function playLights(): PlayLight {
  let lit: { readonly btn: HTMLButtonElement } | null = null
  return (btn, done) => {
    lit?.btn.classList.remove('is-on')
    const mine = { btn }
    lit = mine
    btn.classList.add('is-on')
    void done.then(() => {
      if (lit !== mine) return
      lit = null
      btn.classList.remove('is-on')
    })
  }
}
