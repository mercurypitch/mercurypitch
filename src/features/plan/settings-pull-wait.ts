// ============================================================
// Settings pull wait — how long a decision waits for the account's settings
// ============================================================
//
// Two callers hold a decision until the settings pull has applied the account's
// settings, and the same wait serves both. The opening takeover must not decide
// before the pull (a plan answered on another device arrives with it, so a
// second device would ask twice), and the plan's sync must not read the record
// before it (the record carries the mark of the send, so a second device would
// send the plan again). Neither waits for long: past the cap the visit goes on
// without the settings, and a pull that ended without them is not worth the cap.
//
// It imports nothing: a timing helper, so either caller can use it without the
// other's world around it.

/** How long a real account waits for its settings before the visit goes on without them. */
export const SETTINGS_PULL_WAIT_MS = 3000

/**
 * How the wait ended: the pull landed in time, or it did not (still on its
 * way past the cap, or it ended without the account's settings: offline,
 * signed out, a newer pull took over).
 */
export type SettingsPullWait = 'pulled' | 'late'

/**
 * Waits for the settings pull, no longer than `waitMs`. A pull that ends
 * without the account's settings (it rejects) is 'late' at once: nothing is
 * coming, and the cap is not worth waiting out. It never rejects, and it
 * leaves no timer running.
 */
export async function awaitSettingsPull(
  pulled: () => Promise<void>,
  waitMs: number = SETTINGS_PULL_WAIT_MS,
): Promise<SettingsPullWait> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const cap = new Promise<'late'>((resolve) => {
    timer = setTimeout(() => {
      resolve('late')
    }, waitMs)
  })
  // Asked inside the promise: a pull that throws is a pull that is late.
  const landed = new Promise<void>((resolve) => {
    resolve(pulled())
  }).then(
    (): 'pulled' => 'pulled',
    (): 'late' => 'late',
  )
  try {
    return await Promise.race([landed, cap])
  } finally {
    clearTimeout(timer)
  }
}
