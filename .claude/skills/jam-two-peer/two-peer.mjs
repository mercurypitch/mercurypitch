// Two real peers in one jam room. From the repo root, servers up (SKILL.md):
//   node .claude/skills/jam-two-peer/two-peer.mjs <screenshot dir>
//
// Imports from '@playwright/test', not 'playwright'. Under pnpm the latter
// is a transitive dependency with no top-level node_modules entry, so a
// bare 'playwright' import fails with ERR_MODULE_NOT_FOUND even from the
// repo root. @playwright/test is a direct dependency and re-exports
// chromium.
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'

const OUT = process.argv[2] ?? './jam-shots'
const APP = process.env.JAM_APP_URL ?? 'http://localhost:3001'
mkdirSync(OUT, { recursive: true })

// The release line the build announces, e.g. "0.9" for 0.9.13. A returning
// visitor who has not seen it is sent to #/whats-new instead of #/jam, and
// Create Room never appears. Read from the repo, so it cannot go stale.
const pkg = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
)
const RELEASE_LINE = /^\d+\.\d+/.exec(pkg.version)[0]

/** A peer is its own BROWSER, not a context -- see SKILL.md item 4. */
async function launch(name) {
  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  const ctx = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1280, height: 800 },
  })
  await ctx.addInitScript((line) => {
    localStorage.setItem('pitchperfect_welcome_version', '99.0.0')
    localStorage.setItem('pitchperfect_survey_dismissed', '1')
    // Mark the Jam page tour as already offered. It auto-closes for a real
    // user so it is not a bug, but it sits exactly over the header's icon
    // controls -- clicking it away afterwards is unreliable, and any
    // screenshot of the mic/camera/leave buttons photographs the popup
    // instead. usePageTourOffer reads this key and stays quiet.
    localStorage.setItem('pitchperfect_page_tour_offered_jam', 'true')
    localStorage.setItem('pitchperfect_whats_new_seen_v2', line)
  }, RELEASE_LINE)
  const page = await ctx.newPage()
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error' || /jam:/.test(t))
      console.log(`[${name}] ${t.slice(0, 150)}`)
  })
  return { browser, page }
}

/** The stage's backing track. Scoped to the page, because every peer's
 *  voice is an <audio> of its own, appended to <body>. */
const backing = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('#jam-panel audio')
    return el === null
      ? null
      : { paused: el.paused, t: Math.round(el.currentTime * 100) / 100 }
  })

const host = await launch('host')
const guest = await launch('guest')
const tracks = async () => ({
  host: await backing(host.page),
  guest: await backing(guest.page),
})
try {
  await host.page.goto(`${APP}/#/jam`, { waitUntil: 'domcontentloaded' })
  await host.page.getByRole('button', { name: /create room/i }).click()
  // waitForFunction(fn, ARG, options): the options are the THIRD argument.
  await host.page.waitForFunction(
    () => /#\/jam:[A-Z0-9]+/i.test(location.hash),
    undefined,
    { timeout: 30000 },
  )
  const code = (await host.page.evaluate(() => location.hash)).split(':')[1]
  console.log('room:', code)

  await guest.page.goto(`${APP}/#/jam:${code}`, {
    waitUntil: 'domcontentloaded',
  })

  // Assert on the room, not a timer -- and on what IS there. "Not 0 peers"
  // would also pass on a page that never showed the room at all.
  for (const [name, peer] of [
    ['host', host],
    ['guest', guest],
  ]) {
    await peer.page.waitForFunction(
      () => /\b[1-9]\d* peers? connected/i.test(document.body.innerText),
      undefined,
      { timeout: 45000 },
    )
    const said = await peer.page
      .getByText(/\d+ peers? connected/)
      .first()
      .innerText()
    console.log(`connected: ${name} sees "${said}"`)
  }

  // Roles must differ AND be derived independently on each device. A
  // drill's roles: a song deals its parts line by line instead, and has no
  // mode, so this comes before any song. The mode is behind More controls.
  await host.page.getByRole('button', { name: 'More controls' }).click()
  await host.page
    .getByRole('group', { name: 'Room mode' })
    .getByRole('button', { name: 'Harmony Stack' })
    .click()
  const roles = []
  for (const [name, peer] of [
    ['host', host],
    ['guest', guest],
  ]) {
    const badge = peer.page.getByText(/^You sing:/)
    await badge.waitFor({ timeout: 10000 })
    roles.push(await badge.innerText())
    console.log(`${name}:`, roles.at(-1))
  }
  // The badge renders only once the room is split, so the first read is
  // the part itself, never a stale one. Printing both is not a check.
  if (roles[0] === roles[1])
    throw new Error(`both peers were dealt the same part: "${roles[0]}"`)
  // Fold More away again, so the screenshots show the bar as a visitor does.
  await host.page.getByRole('button', { name: 'Hide extra controls' }).click()

  // Optionally load a song, start it, and see the guest follow.
  //   JAM_SONG=1 node .claude/skills/jam-two-peer/two-peer.mjs <screenshot dir>
  if (process.env.JAM_SONG === '1') {
    await host.page
      .getByRole('button', { name: 'Choose a drill or a song' })
      .click()
    // The popup's list. `data-variant` is JamPickerList's own attribute,
    // not a CSS-module class; the sidebar renders the same list as "rail".
    const picker = host.page.locator('#jam-panel [data-variant="popup"]')
    await picker.waitFor({ timeout: 10000 })
    // Songs are the first shelf, but the examples are fetched when the room
    // goes live. Until they land the list says so in a status line, and its
    // first row is a drill.
    await picker
      .getByRole('status')
      .waitFor({ state: 'detached', timeout: 20000 })
      .catch(async () => {
        const said = await picker
          .getByRole('status')
          .innerText({ timeout: 2000 })
          .catch(() => '(no status line)')
        throw new Error(`the example songs did not load: "${said}"`)
      })
    const item = picker.getByRole('button').first()
    // Read before the click: the popup closes once the room accepts it.
    const picked = (await item.innerText())
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    console.log('picked:', picked.join(' | '))
    await item.click()

    // Both peers name the song in the room header once it is loaded.
    for (const [name, peer] of [
      ['host', host],
      ['guest', guest],
    ]) {
      const chip = peer.page.getByTestId('jam-now-singing')
      await chip.waitFor({ timeout: 30000 })
      console.log(`${name} header:`, await chip.getAttribute('aria-label'))
    }

    // Silent until the host says go, or "follows" proves nothing.
    const before = await tracks()
    if (before.guest !== null && !before.guest.paused)
      throw new Error(
        `the guest was playing before Start: ${JSON.stringify(before)}`,
      )
    await host.page
      .getByRole('button', { name: 'Start playback for everyone here' })
      .click()
    // The guest's own backing track must start, and keep moving.
    await guest.page.waitForFunction(
      () => {
        const el = document.querySelector('#jam-panel audio')
        return el !== null && !el.paused && el.currentTime > 0
      },
      undefined,
      { timeout: 30000 },
    )
    const first = await tracks()
    await guest.page.waitForFunction(
      (t) =>
        (document.querySelector('#jam-panel audio')?.currentTime ?? 0) >= t + 1,
      first.guest.t,
      { timeout: 10000 },
    )
    const later = await tracks()
    console.log('guest follows:', JSON.stringify({ before, first, later }))
  }

  // Does the PAGE scroll? It should not -- the room fits the viewport and
  // only the lyric column scrolls inside it.
  const scroll = await host.page.evaluate(() => ({
    pageScrollable:
      document.documentElement.scrollHeight > window.innerHeight + 4,
    pageOverflow: document.documentElement.scrollHeight - window.innerHeight,
  }))
  console.log('page scroll:', JSON.stringify(scroll))
  await host.page.screenshot({ path: `${OUT}/host.png` })
  await guest.page.screenshot({ path: `${OUT}/guest.png` })
  // The header controls alone, which is what most polish questions are about.
  await host.page
    .getByTestId('jam-room-header')
    .screenshot({ path: `${OUT}/host-header.png`, animations: 'disabled' })
} catch (error) {
  // Both sides as they were when it failed: usually the whole story.
  await host.page.screenshot({ path: `${OUT}/host-error.png` }).catch(() => {})
  await guest.page
    .screenshot({ path: `${OUT}/guest-error.png` })
    .catch(() => {})
  throw error
} finally {
  await host.browser.close()
  await guest.browser.close()
}
