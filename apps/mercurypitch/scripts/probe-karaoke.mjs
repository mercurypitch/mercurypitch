// ============================================================
// The Karaoke room, walked against the built bundle (plan S8)
// ============================================================
//
// In the app the Karaoke tab is a room (decision D8 A). This walks what a
// singer does there, on each upright frame:
//
//   - the alley's Karaoke door opens onto the room and ends on the room's
//     own picture, with a song cued and paused (D1 A);
//   - Play plays it, with zen's bar as the transport and the rail stepped
//     aside (D2 A), and Pause holds the place;
//   - the song line opens the library, which names songs rather than files
//     (audit K7), and a pick cues that song. Import heads it in a build that
//     imports songs and is nowhere in the store's; probe-karaoke-import.mjs
//     walks an import through;
//   - the gear opens the options, and the one option pinned beside the gear
//     is the singer's to choose, to use and to change (D4 A, owner 27 Sep);
//   - "Manage songs" pushes the studio, the old Karaoke tab. Back returns to
//     the room, and a song chosen to sing in the studio goes back to the
//     room and plays there.
//
// Nothing scrolls sideways, checked the way plan step 12 states it: no
// element's scrollWidth is wider than its clientWidth. Every surface the
// walk opens is read that way: the room, both sheets, the studio's songs,
// its results page, its Sing view, its group list and its options.
//
// On its side the room is two columns (D3 A); probe-landscape.mjs measures
// that with the phones' own insets, and reads the studio sideways there too.
//
// Every picture in the room draws something. A path the bundle does not
// carry is answered with the app's own index.html, so the request succeeds,
// the <img> finishes loading and has no pixels: a broken-image glyph on the
// stage, and no error anywhere (the sing pill's microphone, review V1).
//
// Wired into probe-bundle.mjs, which owns the browser and passes its own
// helpers in, as it does for the landscape walk.

/**
 * In the page: every element in `scope` (the whole document for null) whose
 * content is wider than its box, and the page's own sideways scroll.
 *
 * Two exceptions, and neither is a scroll. A line cut short with an ellipsis
 * (`text-overflow: ellipsis` on a box that clips) is wider than its box by
 * design, and shows that it is. Text kept for a screen reader only (a 1 px
 * box clipped away, `.srOnly`) is wider than its box by design too, and is
 * never seen at all.
 */
export const readSideways = (scope) => {
  const root = scope === null ? document.body : document.querySelector(scope)
  if (root === null) return { elements: 0, over: [`no ${scope}`] }
  const name = (el) => {
    const id = el.getAttribute('data-testid')
    const raw =
      typeof el.className === 'string'
        ? el.className
        : (el.getAttribute('class') ?? '')
    const cls = raw.split(/\s+/u).filter(Boolean)[0]
    const text = (el.textContent ?? '').trim().replace(/\s+/gu, ' ')
    return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}${cls ? `.${cls}` : ''}${text ? ` "${text.slice(0, 32)}"` : ''}`
  }
  const over = []
  let elements = 0
  for (const el of [root, ...root.querySelectorAll('*')]) {
    elements += 1
    const wider = el.scrollWidth - el.clientWidth
    if (wider <= 1) continue
    const style = getComputedStyle(el)
    const scrolls = /(auto|scroll)/u.test(style.overflowX)
    if (!scrolls && style.textOverflow === 'ellipsis') continue
    const forReaders =
      el.clientWidth <= 1 &&
      (style.clipPath === 'inset(50%)' ||
        style.clip === 'rect(0px, 0px, 0px, 0px)')
    if (!scrolls && forReaders) continue
    over.push(
      `${name(el)} is ${wider} px wider than its box (overflow-x ${style.overflowX})`,
    )
  }
  const page = document.scrollingElement
  if (page !== null && page.scrollWidth > window.innerWidth + 0.5) {
    over.push(
      `the page scrolls sideways by ${page.scrollWidth - window.innerWidth} px`,
    )
  }
  return { elements, over }
}

/** In the page: the zen stage as a singer reads it. */
/**
 * In the page: the pictures in `scope` that finished loading and drew
 * nothing (`naturalWidth` 0), and how many are still loading.
 */
export const readBrokenImages = (scope) => {
  const root = document.querySelector(scope)
  if (root === null) return { images: 0, loading: 0, broken: [`no ${scope}`] }
  const images = [...root.querySelectorAll('img')]
  return {
    images: images.length,
    loading: images.filter((img) => !img.complete).length,
    broken: images
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.getAttribute('src') ?? '(no src)'),
  }
}

export const readStage = () => {
  const stage = document.querySelector('[data-testid="karaoke-mobile-stage"]')
  if (stage === null) return null
  const line = stage.querySelector('[data-testid="karaoke-songline"]')
  const play = stage.querySelector(
    'button[aria-label="Play"], button[aria-label="Pause"]',
  )
  // The bar's readout: the time played, then the time left with a minus.
  const played = [...stage.querySelectorAll('span')]
    .map((span) => (span.textContent ?? '').trim())
    .find((text) => /^\d+:\d\d$/u.test(text))
  const [minutes, seconds] = (played ?? '0:00').split(':').map(Number)
  return {
    title:
      line?.getAttribute('aria-label')?.replace(/\. Open the songs$/u, '') ??
      null,
    button: play?.getAttribute('aria-label') ?? null,
    disabled: play?.disabled ?? null,
    elapsed: played === undefined ? null : minutes * 60 + seconds,
    loading:
      stage.querySelector(
        '[role="progressbar"][aria-label="Loading the song"]',
      ) !== null,
    error: stage.querySelector('[role="alert"]')?.textContent?.trim() ?? null,
    rail: document.documentElement.getAttribute('data-shell-rail'),
    // The shell's transport is always mounted in the dock: its layer is in
    // or out.
    transport:
      document
        .querySelector('[data-testid="shell-transport-layer"]')
        ?.classList.contains('is-in') ?? false,
  }
}

/** A cue is ready when its stems are in and Play can be pressed. */
export const cueReady = (want) => {
  const stage = document.querySelector('[data-testid="karaoke-mobile-stage"]')
  if (stage === null) return false
  if (stage.querySelector('[role="alert"]') !== null) return true
  const line = stage.querySelector('[data-testid="karaoke-songline"]')
  const title = line?.getAttribute('aria-label') ?? ''
  if (want !== null && title !== `${want}. Open the songs`) return false
  const play = stage.querySelector(
    'button[aria-label="Play"], button[aria-label="Pause"]',
  )
  return play !== null && !play.disabled
}

/**
 * One upright frame: the door, the stage, the library, the options, the pin
 * and the studio. Returns the step lines; throws with every problem found.
 */
export async function walkKaraoke(browser, args, frame, kit) {
  const {
    isolate,
    seed,
    shoot,
    tapDoor,
    waitPhase,
    walkOpen,
    bootTimeoutMs,
    stepTimeoutMs,
    runTimeoutMs,
  } = kit
  const ctx = { ...args, frame }
  const context = await isolate(
    await browser.newContext({
      viewport: frame,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
    }),
  )
  const failures = []
  const steps = []
  let at = 'boot'
  try {
    const page = await context.newPage()
    page.on('pageerror', (error) => {
      failures.push(`page error: ${error.message}`)
    })
    await page.addInitScript(seed, args.theme)
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page
      .locator('#root.loaded')
      .waitFor({ state: 'attached', timeout: bootTimeoutMs })
    const visible = (selector, timeout = stepTimeoutMs) =>
      page
        .locator(selector)
        .first()
        .waitFor({ state: 'visible', timeout })
        .catch(() => {
          throw new Error(`${selector} never showed`)
        })
    const hidden = (selector) =>
      page
        .locator(selector)
        .first()
        .waitFor({ state: 'hidden', timeout: stepTimeoutMs })
        .catch(() => {
          throw new Error(`${selector} never went`)
        })
    const settle = (ms = 400) => page.waitForTimeout(ms)
    const stage = () => page.evaluate(readStage)
    const cued = async (want, what) => {
      await page
        .waitForFunction(cueReady, want, { timeout: runTimeoutMs })
        .catch(async () => {
          throw new Error(
            `${what}: no song ready to play (${JSON.stringify(await stage())})`,
          )
        })
      const now = await stage()
      if (now.error !== null) throw new Error(`${what}: "${now.error}"`)
      return now
    }
    const sideways = async (name, scope) => {
      const read = await page.evaluate(readSideways, scope)
      if (read.over.length > 0) {
        failures.push(...read.over.map((line) => `${name}: ${line}`))
        return null
      }
      return `${name} ${read.elements}`
    }
    const pictures = async (name) => {
      await page
        .waitForFunction(
          (scope) =>
            [
              ...(document.querySelector(scope)?.querySelectorAll('img') ?? []),
            ].every((img) => img.complete),
          '[data-testid="karaoke-room"]',
          { timeout: stepTimeoutMs },
        )
        .catch(() => undefined)
      const seen = await page.evaluate(
        readBrokenImages,
        '[data-testid="karaoke-room"]',
      )
      for (const src of seen.broken) {
        failures.push(`${name}: the picture ${src} draws nothing`)
      }
      if (seen.loading > 0) {
        failures.push(`${name}: ${seen.loading} picture(s) never finished`)
      }
      return seen.images
    }
    const read = []
    await visible('[data-testid="rooms-alley"]')
    await settle(600)

    // ── The door ──────────────────────────────────────────────
    at = 'the Karaoke door'
    await tapDoor(page, 'karaoke')
    await waitPhase(page, 'alive', 'karaoke', 'select Karaoke')
    const card = await page.evaluate(() => ({
      name: document.querySelector('[data-testid="alley-name"]')?.textContent,
      line: document.querySelector('[data-testid="alley-line"]')?.textContent,
      eyebrow: document.querySelector('[data-testid="alley-eyebrow"]') !== null,
      enter: document.querySelector('[data-testid="alley-enter"]') !== null,
    }))
    if (
      card.name !== 'Karaoke · Broadway Theater' ||
      card.line !== 'Sing your favorite songs.' ||
      card.eyebrow ||
      !card.enter
    ) {
      throw new Error(`the Karaoke card: ${JSON.stringify(card)}`)
    }
    await shoot(page, ctx, 'karaoke-door')
    const open = await walkOpen(
      page,
      ctx,
      'karaoke-open',
      '[data-testid="karaoke-room"]',
    )
    if (open.motion !== 'grow') {
      throw new Error(`the Karaoke door's clone: ${JSON.stringify(open)}`)
    }
    steps.push(
      `karaoke door: "${card.name}", "${card.line}", Enter and no "Coming soon"; it opens (${open.content}): ${open.handOver}`,
    )

    // ── Cued and paused (D1 A) ────────────────────────────────
    at = 'the cued song'
    const first = await cued(null, 'arrival')
    if (first.button !== 'Play' || first.title === null) {
      throw new Error(`arrival: ${JSON.stringify(first)}`)
    }
    if (/\.(m4a|mp3|wav|flac|aac|ogg)$/iu.test(first.title)) {
      throw new Error(`arrival: the song line names a file, "${first.title}"`)
    }
    await settle(300)
    await shoot(page, ctx, 'karaoke-room')
    read.push(await sideways('the room', '[data-testid="karaoke-room"]'))
    const drawn = await pictures('arrival')
    steps.push(
      `karaoke arrival: "${first.title}" cued and paused at ${first.elapsed}s, Play ready, the rail ${first.rail ?? 'off'}; ${drawn} picture(s) in the room, every one drawn`,
    )

    // ── Play and Pause (D2 A) ─────────────────────────────────
    at = 'play'
    await page
      .locator('[data-testid="karaoke-mobile-stage"] button[aria-label="Play"]')
      .tap()
    await visible(
      '[data-testid="karaoke-mobile-stage"] button[aria-label="Pause"]',
    )
    await page.waitForTimeout(2600)
    const playing = await stage()
    if (!(playing.elapsed >= first.elapsed + 1)) {
      throw new Error(
        `play: the time did not move (${first.elapsed}s, then ${playing.elapsed}s)`,
      )
    }
    if (playing.rail !== null || playing.transport) {
      throw new Error(
        `play: the shell kept its chrome up over zen's bar ${JSON.stringify(playing)}`,
      )
    }
    await shoot(page, ctx, 'karaoke-playing')
    await pictures('playing')
    at = 'pause'
    await page
      .locator(
        '[data-testid="karaoke-mobile-stage"] button[aria-label="Pause"]',
      )
      .tap()
    await visible(
      '[data-testid="karaoke-mobile-stage"] button[aria-label="Play"]',
    )
    const paused = await stage()
    await page.waitForTimeout(1500)
    const held = await stage()
    if (held.elapsed !== paused.elapsed) {
      throw new Error(
        `pause: the time moved on (${paused.elapsed}s, then ${held.elapsed}s)`,
      )
    }
    steps.push(
      `karaoke play: ${first.elapsed}s to ${playing.elapsed}s in 2.6 s, the rail stepped aside and no shell transport; pause held at ${held.elapsed}s`,
    )

    // ── The library (K7) ──────────────────────────────────────
    at = 'the library'
    await page.locator('[data-testid="karaoke-songline"]').tap()
    await visible('[data-testid="karaoke-library"]')
    await settle()
    const library = await page.evaluate(() => {
      const sheet = document.querySelector('[data-testid="karaoke-library"]')
      return {
        imports: sheet.querySelector('[data-testid="karaoke-import"]') !== null,
        groups: [...sheet.querySelectorAll('h3')].map((h) => h.textContent),
        rows: [
          ...sheet.querySelectorAll('[data-testid="karaoke-library-row"]'),
        ].map((row) => ({
          id: row.getAttribute('data-session'),
          title: row.querySelector('span > span')?.textContent ?? '',
          current: row.getAttribute('aria-current') === 'true',
        })),
      }
    })
    const files = library.rows.filter((row) =>
      /\.(m4a|mp3|wav|flac|aac|ogg)$/iu.test(row.title),
    )
    const current = library.rows.filter((row) => row.current)
    if (
      library.rows.length < 3 ||
      !library.groups.includes('Examples') ||
      files.length > 0 ||
      current.length !== 1 ||
      current[0].title !== first.title
    ) {
      throw new Error(`the library: ${JSON.stringify(library)}`)
    }
    // Import is Stage 2: in every build but the store's (api-base.mjs
    // karaokeImportFor), and nowhere in the store's.
    if (library.imports !== kit.importing) {
      throw new Error(
        `the library ${library.imports ? 'offers' : 'does not offer'} Import in a build that ${kit.importing ? 'imports' : 'does not import'} songs`,
      )
    }
    await shoot(page, ctx, 'karaoke-library')
    // The sheet, not only its list: a sheet's panel is its own scroller.
    read.push(
      await sideways('the library', '[role="dialog"][aria-label="Songs"]'),
    )
    const next = library.rows.find((row) => !row.current)
    await page
      .locator(`[data-testid="karaoke-library-row"][data-session="${next.id}"]`)
      .tap()
    await hidden('[data-testid="karaoke-library"]')
    const picked = await cued(next.title, 'a pick from the library')
    steps.push(
      `karaoke library: ${library.rows.length} songs under ${library.groups.join(', ')}, titles not files, "${first.title}" marked, Import ${library.imports ? 'offered' : 'absent'}; a pick cues "${picked.title}" (${picked.button})`,
    )

    // ── The options, and the one pinned beside the gear (D4 A) ─
    at = 'the options'
    const pinned = '[data-testid="shell-room-pinned"]'
    if ((await page.locator(pinned).count()) !== 0) {
      throw new Error('a first launch pins something beside the gear')
    }
    await page.locator('[data-testid="shell-room-gear"]').tap()
    await visible('[data-testid="karaoke-options"]')
    await settle()
    const options = await page.evaluate(() => {
      const sheet = document.querySelector('[data-testid="karaoke-options"]')
      return {
        sections: [...sheet.querySelectorAll('section > h3')].map(
          (h) => h.textContent,
        ),
        pin: sheet.querySelector('select[aria-label="Beside the gear"]')?.value,
        manage:
          sheet.querySelector('button[aria-label="Manage songs"]') !== null,
      }
    })
    if (
      options.sections.join(',') !== 'Lyrics,Playing,More' ||
      options.pin !== 'none' ||
      !options.manage
    ) {
      throw new Error(`the options: ${JSON.stringify(options)}`)
    }
    await shoot(page, ctx, 'karaoke-options')
    read.push(
      await sideways(
        'the options',
        '[role="dialog"][aria-label="Karaoke options"]',
      ),
    )
    await page
      .locator('select[aria-label="Beside the gear"]')
      .selectOption('lyrics-size')
    await page.keyboard.press('Escape')
    await hidden('[data-testid="karaoke-options"]')
    await visible(pinned)
    const before = await page.locator(pinned).getAttribute('aria-label')
    await page.locator(pinned).tap()
    await page
      .waitForFunction(
        ([selector, was]) =>
          document.querySelector(selector)?.getAttribute('aria-label') !== was,
        [pinned, before],
        { timeout: stepTimeoutMs },
      )
      .catch(() => {
        throw new Error(`the pinned toggle did nothing ("${before}")`)
      })
    const after = await page.locator(pinned).getAttribute('aria-label')
    const kept = await page.evaluate(() =>
      localStorage.getItem('karaoke-room-pinned'),
    )
    if (kept !== 'lyrics-size') {
      throw new Error(`the pin is not kept: storage says ${kept}`)
    }
    await shoot(page, ctx, 'karaoke-pinned')
    // …and changeable from the same row: unpinned, it leaves the header.
    await page.locator('[data-testid="shell-room-gear"]').tap()
    await visible('[data-testid="karaoke-options"]')
    await page
      .locator('select[aria-label="Beside the gear"]')
      .selectOption('none')
    await page.keyboard.press('Escape')
    await hidden('[data-testid="karaoke-options"]')
    await hidden(pinned)
    steps.push(
      `karaoke options: ${options.sections.join(', ')}, nothing pinned at first; "Text size" pinned beside the gear and kept, "${before}" to "${after}" in one tap, then unpinned from the same row`,
    )

    // ── The studio (plan step 12, D8 A) ───────────────────────
    at = 'the studio'
    const pushed = '[data-testid="shell-pushed"][aria-label="Karaoke studio"]'
    const openStudio = async () => {
      await page.locator('[data-testid="shell-room-gear"]').tap()
      await visible('[data-testid="karaoke-options"]')
      await page.locator('button[aria-label="Manage songs"]').tap()
      await visible(pushed)
      await visible('[data-testid="karaoke-studio"]')
      await visible('.history-list-inline .uvr-session-result')
      await settle(600)
    }
    await openStudio()
    const songs = await page
      .locator('.history-list-inline .uvr-session-result')
      .count()
    await shoot(page, ctx, 'karaoke-studio')
    read.push(await sideways('the studio', pushed))
    await page.evaluate((selector) => {
      const body = document.querySelector(`${selector} .mp-pushed__body`)
      if (body !== null) body.scrollTop = body.scrollHeight
    }, pushed)
    await settle(300)
    await shoot(page, ctx, 'karaoke-studio-end')
    read.push(await sideways('the studio, scrolled to its end', pushed))
    await page.evaluate((selector) => {
      const body = document.querySelector(`${selector} .mp-pushed__body`)
      if (body !== null) body.scrollTop = 0
    }, pushed)

    at = "the studio's group list"
    await page.locator('[data-testid="karaoke-studio-group"]').tap()
    await visible('[role="dialog"][aria-label="Group"]')
    await settle()
    await shoot(page, ctx, 'karaoke-studio-groups')
    read.push(
      await sideways('the group list', '[role="dialog"][aria-label="Group"]'),
    )
    await page
      .locator(
        '[role="dialog"][aria-label="Group"] [data-testid="group-tab-all"]',
      )
      .tap()
    await hidden('[role="dialog"][aria-label="Group"]')

    at = "the studio's options"
    const studioOptions = '[role="dialog"][aria-label="Studio options"]'
    await page.locator('[data-testid="karaoke-studio-options-button"]').tap()
    await visible(studioOptions)
    await settle()
    await shoot(page, ctx, 'karaoke-studio-options')
    read.push(await sideways('the studio options', studioOptions))
    await page
      .locator(`${studioOptions} [role="radio"]`, { hasText: 'Sing' })
      .tap()
    await hidden(studioOptions)
    await hidden('[data-testid="karaoke-studio-group"]')
    await settle(600)
    await shoot(page, ctx, 'karaoke-studio-sing')
    read.push(await sideways('the studio, Sing', pushed))
    await page.locator('[data-testid="karaoke-studio-options-button"]').tap()
    await visible(studioOptions)
    await page
      .locator(`${studioOptions} [role="radio"]`, { hasText: 'Songs' })
      .tap()
    await hidden(studioOptions)
    await visible('.history-list-inline .uvr-session-result')

    at = 'Back from the studio'
    const room = await stage()
    await page.locator('[data-testid="shell-pushed-back"]').tap()
    await hidden(pushed)
    const back = await stage()
    if (back?.title !== room.title || back.button !== 'Play') {
      throw new Error(
        `Back from the studio: the room is at ${JSON.stringify(back)}, it was at ${JSON.stringify(room)}`,
      )
    }

    // A song's results page, and its Play: the room plays it, not the studio.
    at = "a song's results page"
    await openStudio()
    // The room is paused, so the room playing after this is the hand-back.
    await page
      .locator('.history-list-inline .uvr-session-result')
      .first()
      .getByRole('button', { name: /View Results/u })
      .first()
      .tap()
    await visible('.rv-full-mix-card .rv-stem-btn-play')
    await settle(600)
    await shoot(page, ctx, 'karaoke-studio-results')
    read.push(await sideways('a results page', pushed))
    await page.locator('.rv-full-mix-card .rv-stem-btn-play').first().tap()
    await hidden(pushed)
    await visible(
      '[data-testid="karaoke-mobile-stage"] button[aria-label="Pause"]',
      runTimeoutMs,
    )
    const handed = await stage()
    await page
      .locator(
        '[data-testid="karaoke-mobile-stage"] button[aria-label="Pause"]',
      )
      .tap()
    await shoot(page, ctx, 'karaoke-handed-back')
    steps.push(
      `karaoke studio: pushed from Options with ${songs} songs, its group list, its options and its Sing view; Back keeps "${room.title}" paused; a results page's Play hands "${handed.title}" back to the room, which plays it`,
    )

    const measured = read.filter((line) => line !== null)
    if (measured.length === read.length) {
      steps.push(
        `karaoke sideways: nothing wider than its box (elements read: ${measured.join(', ')})`,
      )
    }
  } catch (error) {
    failures.push(`${at}: ${error.message.split('\n')[0]}`)
  } finally {
    await context.close()
  }
  const where = `${frame.width}x${frame.height}`
  if (failures.length > 0) {
    throw new Error(failures.map((f) => `[${where}] ${f}`).join('; '))
  }
  return steps.map((step) => `[${where}] ${step}`)
}

/**
 * The largest stem a room that asked for the stream decodes whole on a phone
 * with no AudioDecoder: src/features/stem-mixer/stem-memory.ts,
 * HOSTED_WHOLE_DECODE_MAX_BYTES (owner, 28 Sep; it was 2 MiB).
 */
const WHOLE_DECODE_MAX_BYTES = 12 * 1024 * 1024

const NEEDS_STREAMING =
  "This song needs a newer version of this phone's software to play here. Update it, then open the song again."

/**
 * The room opened on a phone with no AudioDecoder, until its song is cued or
 * refused. `stemBytes` answers every stem the room downloads with that many
 * bytes; null leaves the room its own song. Every decode the page asks for is
 * weighed on the way.
 */
async function openWithoutDecoder(browser, args, frame, kit, name, stemBytes) {
  const { isolate, seed, tapDoor, waitPhase, walkOpen, bootTimeoutMs } = kit
  const ctx = { ...args, frame }
  const context = await isolate(
    await browser.newContext({
      viewport: frame,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
    }),
  )
  try {
    if (stemBytes !== null) {
      const body = Buffer.alloc(stemBytes)
      await context.route(/\.m4a(?:\?|$)/u, (route) =>
        route.fulfill({ status: 200, contentType: 'audio/mp4', body }),
      )
    }
    const page = await context.newPage()
    await page.addInitScript(seed, args.theme)
    await page.addInitScript(() => {
      delete window.AudioDecoder
      const sizes = []
      window.__probeDecodes = sizes
      const decode = BaseAudioContext.prototype.decodeAudioData
      BaseAudioContext.prototype.decodeAudioData = function (data, ...rest) {
        sizes.push(data?.byteLength ?? -1)
        return decode.call(this, data, ...rest)
      }
    })
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page
      .locator('#root.loaded')
      .waitFor({ state: 'attached', timeout: bootTimeoutMs })
    await page
      .locator('[data-testid="rooms-alley"]')
      .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    await page.waitForTimeout(600)
    await tapDoor(page, 'karaoke')
    await waitPhase(page, 'alive', 'karaoke', 'select Karaoke')
    await walkOpen(page, ctx, name, '[data-testid="karaoke-room"]')
    await page
      .waitForFunction(cueReady, null, { timeout: kit.runTimeoutMs })
      .catch(async () => {
        const decodes = await page.evaluate(() => window.__probeDecodes ?? [])
        throw new Error(
          `the song was neither cued nor refused; the stage reads ${JSON.stringify(await page.evaluate(readStage))}; decodes asked for: ${JSON.stringify(decodes)} bytes`,
        )
      })
    return await page.evaluate(() => {
      const stage = document.querySelector(
        '[data-testid="karaoke-mobile-stage"]',
      )
      const alert = stage?.querySelector('[role="alert"]') ?? null
      const play = stage?.querySelector('button[aria-label="Play"]') ?? null
      return {
        decoderGone: typeof window.AudioDecoder === 'undefined',
        refused: alert !== null,
        text: alert?.querySelector('p')?.textContent?.trim() ?? null,
        buttons: [...(alert?.querySelectorAll('button') ?? [])].map((b) =>
          (b.textContent ?? '').trim(),
        ),
        playable: play !== null && !play.disabled,
        decodes: window.__probeDecodes ?? [],
      }
    })
  } finally {
    await context.close()
  }
}

/**
 * A phone that cannot stream: a WKWebView with no WebCodecs AudioDecoder.
 * The room asked for the stream, so it decodes a stem whole only up to the
 * guard, and refuses a song with a bigger one (the ~180 MiB that killed iOS),
 * says why, and offers no Try again, since a second try lands on the same
 * refusal (review item 3, plan S8 §7 rule 2).
 *
 * Both sides of the line. The room's own song has stems under it, so it is
 * decoded whole and cued. The same song with every stem answered one byte
 * past the line is refused before anything is decoded.
 */
export async function walkKaraokeNoDecoder(browser, args, frame, kit) {
  const where = `${frame.width}x${frame.height}`
  const mib = (bytes) => (bytes / (1024 * 1024)).toFixed(1)
  try {
    const under = await openWithoutDecoder(
      browser,
      args,
      frame,
      kit,
      'karaoke-nodecoder-open',
      null,
    )
    const underProblems = []
    if (!under.decoderGone) underProblems.push('AudioDecoder was still there')
    if (under.refused) {
      underProblems.push(`the song was refused: ${JSON.stringify(under.text)}`)
    }
    if (!under.playable) underProblems.push('Play never became pressable')
    if (under.decodes.length === 0) {
      underProblems.push('no stem was decoded whole')
    }
    const pastUnder = under.decodes.filter(
      (bytes) => bytes > WHOLE_DECODE_MAX_BYTES,
    )
    if (pastUnder.length > 0) {
      underProblems.push(
        `it decoded ${pastUnder.length} stem(s) past the guard whole (${pastUnder.join(', ')} bytes)`,
      )
    }
    if (underProblems.length > 0) {
      throw new Error(`under the guard: ${underProblems.join('; ')}`)
    }

    const past = await openWithoutDecoder(
      browser,
      args,
      frame,
      kit,
      'karaoke-nodecoder-past',
      WHOLE_DECODE_MAX_BYTES + 1,
    )
    const pastProblems = []
    if (!past.decoderGone) pastProblems.push('AudioDecoder was still there')
    if (past.text !== NEEDS_STREAMING) {
      pastProblems.push(`the card reads ${JSON.stringify(past.text)}`)
    }
    if (past.buttons.includes('Try again')) {
      pastProblems.push('the card offers Try again')
    }
    const whole = past.decodes.filter((bytes) => bytes > WHOLE_DECODE_MAX_BYTES)
    if (whole.length > 0) {
      pastProblems.push(
        `it decoded ${whole.length} stem(s) whole (${whole.join(', ')} bytes)`,
      )
    }
    if (pastProblems.length > 0) {
      throw new Error(`past the guard: ${pastProblems.join('; ')}`)
    }
    return [
      `[${where}] karaoke without AudioDecoder, stems under the 12 MiB guard: decoded whole and cued (${under.decodes.map(mib).join(' + ')} MiB)`,
      `[${where}] karaoke without AudioDecoder, a stem past it: the song is refused, not decoded whole: "${past.text}"; no Try again; ${past.decodes.length} decode(s) asked for, none past 12 MiB`,
    ]
  } catch (error) {
    throw new Error(
      `[${where}] without AudioDecoder: ${error.message.split('\n')[0]}`,
    )
  }
}
