import type { Page } from '@playwright/test'
import { writeToneWav } from './tone-wav'

const TONE_WAV = writeToneWav(220, 2)

/**
 * Karaoke Night's demo song, served from here: its stems as a two-second
 * tone and a line of lyrics. Anything else asked of the demo's bucket is
 * refused, so no case reaches the real one. Route it in the page itself
 * (`test.use({ serviceWorkers: 'block' })`), not behind a worker's back.
 */
export async function localKaraokeDemo(page: Page): Promise<void> {
  await page.route('**/*.r2.dev/**', (route) => route.abort())
  await page.route('**/demo/**/*.m4a', (route) =>
    route.fulfill({ path: TONE_WAV, contentType: 'audio/wav' }),
  )
  await page.route('**/demo/**/lyrics.lrc', (route) =>
    route.fulfill({ body: '[00:00.50]Tour words', contentType: 'text/plain' }),
  )
}
