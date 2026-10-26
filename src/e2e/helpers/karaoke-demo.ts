import type { Page } from '@playwright/test'
import { writeToneWav } from './tone-wav'

/**
 * Karaoke Night's demo song, served from here: its stems as a tone and a line
 * of lyrics. Anything else asked of the demo's bucket is refused, so no case
 * reaches the real one. Route it in the page itself
 * (`test.use({ serviceWorkers: 'block' })`), not behind a worker's back.
 *
 * A minute of tone unless a case asks for less: Merc's tour waits through the
 * song, and a song that plays out with the mic off ends that wait, so a walk
 * that checks the wait needs the song still playing while it does.
 */
export async function localKaraokeDemo(
  page: Page,
  seconds = 60,
): Promise<void> {
  const tone = writeToneWav(220, seconds)
  await page.route('**/*.r2.dev/**', (route) => route.abort())
  await page.route('**/demo/**/*.m4a', (route) =>
    route.fulfill({ path: tone, contentType: 'audio/wav' }),
  )
  await page.route('**/demo/**/lyrics.lrc', (route) =>
    route.fulfill({ body: '[00:00.50]Tour words', contentType: 'text/plain' }),
  )
}
