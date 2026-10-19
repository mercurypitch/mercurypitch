// ============================================================
// The native onboarding, walked against the built bundle
// ============================================================
//
// A new install (no onboarding flag, no welcome) opens the alley's Sing
// door, and the onboarding comes up over the Sing room: the rail out of the
// way, the room held under it, Merc's hello, the labelled example line and
// the mic. The probe's fake voice (its tone file) sings one note, and the
// note is named. Find my range: two slides over the tone file's three notes,
// a range measured between two of them, the pins and the voiceprint kept;
// See my voice: the card, its twin found; Continue brings Keep (beat 7) over
// the layer, the voiceprint on it, and the anonymous identity is asked for
// as it opens and not before (S7b E11); Keep's Not now brings the sung line
// (beat 8): Merc's call, then the probe's voice on the singer's turn, and a
// score the lane agrees with; its Continue opens the Cloud offer (beat 9)
// over the layer, paywall B with no "stays free" line, and the offer's Not
// now lands in the Sing room, live, with the flag done. Then, each on an
// install of its own: Skip for now (Keep, its "Find your range first" run
// in the layer, Keep again with the voiceprint, and the line, on an install
// held out of the offer: Continue goes straight to the room), Keep's "Find
// your range first" from Settings (the range on its own, Keep again, the
// first note then ending on the range kept, and Not now on the line: no
// offer), Not now, Back, and a refused microphone. Every visible part is
// measured on each frame: inside the screen, apart from one another, and
// every control at least 44 px. With --shots, the screens this part added
// are shot once each, after their motion has played out.
//
// Only on a build with the onboarding (NATIVE_ONBOARDING, the import
// switch: `kit.importing`); probe-bundle.mjs decides, owns the browser and
// passes its helpers in. Every other walk starts past the onboarding (its
// seed sets the flag done); this one takes the flag away again.

const LAYER = '[data-testid="native-onboarding"]'
const NOT_NOW = '[data-testid="onboarding-not-now"]'
const LINE = '[data-testid="onboarding-line"]'
const MIC = '[data-testid="onboarding-mic"]'
const NOTE = '[data-testid="onboarding-note"]'
const FIND_RANGE = '[data-testid="onboarding-find-range"]'
const SKIP = '[data-testid="onboarding-skip"]'
const SEE_VOICE = '[data-testid="onboarding-see-voice"]'
const PIN_LOW = '[data-testid="onboarding-pin-low"]'
const PIN_HIGH = '[data-testid="onboarding-pin-high"]'
const CARD_RANGE = '[data-testid="onboarding-card-range"]'
const FIND_TWIN = '[data-testid="onboarding-find-twin"]'
const TWIN = '[data-testid="onboarding-twin"]'
const CONTINUE = '[data-testid="onboarding-continue"]'
const SEE_SAVED = '[data-testid="onboarding-see-saved"]'
const KEEP = '[data-testid="account-offer"]'
const KEEP_NOT_NOW = '[data-testid="keep-not-now"]'
const KEEP_FIND_RANGE = '[data-testid="keep-find-range"]'
/** Beat 8, the sung line (LineView.tsx), and its score. */
const SUNG = '[data-testid="onboarding-sung-line"]'
const SUNG_SCORE = '[data-testid="onboarding-sung-score"]'
/** Beat 9: the shell's Cloud offer, paywall B (CloudOffer.tsx). */
const OFFER = '[role="dialog"][aria-label="Sing your own songs"]'
/** This install's beat 9 group, and its once-an-install mark. */
const OFFER_GROUP = 'mp:onboarding-offer-group'
const OFFER_SHOWN = 'mp:onboarding-cloud-offer'
/** The anonymous identity's request (auth-service.ts, S7b E11). */
const MINT = '/api/auth/anonymous'
const FLAG = 'mp:native-onboarding'
/** Where this phone keeps its voiceprints (voiceprint-service.ts). */
const VOICEPRINTS = 'mercurypitch.voiceprints.v1'

/**
 * A slide runs up to eight seconds from its onset (range-take.ts), and the
 * tone file never pauses long enough to end one sooner, so two take about
 * twenty seconds; more on a page that draws few frames.
 */
const RANGE_TIMEOUT_MS = 60_000

/**
 * The line from the tap: the mic, Merc's call (7.7 s from 0.35 s in), the
 * gate and two beats, the singer's 7.7 s and a tail, about 19 s; more on a
 * page that draws few frames.
 */
const LINE_TIMEOUT_MS = 60_000

/** A phone, an iPad upright and an iPad on its side. */
export const ONBOARDING_FRAMES = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
]

/** The note names the tone file can be heard as (writeToneWav). */
const TONE_NOTES = ['A4', 'C5', 'E5']

/**
 * Runs after the probe's seed: a new install, once per page load, in the
 * beat 9 group the walk names (never drawn at random here), not offered
 * the Cloud offer yet.
 */
function fresh({ flag, group, groupKey, shownKey }) {
  try {
    localStorage.removeItem(flag)
    localStorage.removeItem('pitchperfect_native_welcome_seen')
    localStorage.removeItem('pitchperfect_sing_mic_granted')
    localStorage.setItem(groupKey, group)
    localStorage.removeItem(shownKey)
  } catch {
    /* storage blocked: the walk fails on the flag and says so */
  }
}

/** A microphone that is refused, as the denied walk in probe-bundle.mjs. */
function refuseMic() {
  if (navigator.mediaDevices === undefined) return
  navigator.mediaDevices.getUserMedia = () => {
    const error = new Error('Permission denied')
    error.name = 'NotAllowedError'
    return Promise.reject(error)
  }
}

async function boot(
  browser,
  args,
  frame,
  kit,
  { refuse = false, group = 'offer' } = {},
) {
  const context = await kit.isolate(
    await browser.newContext({
      viewport: frame,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
      permissions: refuse ? [] : ['microphone'],
    }),
  )
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  // Asked for, though the probe answers no API: the request is the proof.
  const mints = []
  page.on('request', (request) => {
    if (request.url().includes(MINT)) mints.push(request.url())
  })
  await page.addInitScript(kit.seed, args.theme)
  await page.addInitScript(fresh, {
    flag: FLAG,
    group,
    groupKey: OFFER_GROUP,
    shownKey: OFFER_SHOWN,
  })
  if (refuse) await page.addInitScript(refuseMic)
  await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
  await page
    .locator('#root.loaded')
    .waitFor({ state: 'attached', timeout: kit.bootTimeoutMs })
  await page
    .locator('[data-testid="rooms-alley"]')
    .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
  return { context, page, errors, mints }
}

/** What kit.shoot needs: the frame, the theme, and where shots go. */
const shotsFor = (args, frame) => ({
  frame,
  theme: args.theme,
  shots: args.shots,
})

const flagNow = (page) =>
  page.evaluate((key) => localStorage.getItem(key), FLAG)

/** Up, over the Sing room: what is on screen and what is held under it. */
async function expectUp(page, kit, how) {
  await page
    .locator(LAYER)
    .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error(`${how}: the onboarding did not come up`)
    })
  const flag = await flagNow(page)
  if (flag !== 'due') throw new Error(`${how}: the flag is ${flag}, not due`)
  const under = await page.evaluate(() => ({
    room: document.querySelector('[data-testid="sing-room"]') !== null,
    state:
      typeof window.mpSingRoom === 'function'
        ? window.mpSingRoom().state
        : null,
    rail:
      document
        .querySelector('[data-testid="shell-rail-layer"]')
        ?.classList.contains('is-in') ?? null,
    priming: document.querySelector('[data-testid="sing-priming"]') !== null,
  }))
  if (!under.room || under.state !== 'resting' || under.priming) {
    throw new Error(
      `${how}: the Sing room is not held ${JSON.stringify(under)}`,
    )
  }
  if (under.rail !== false) {
    throw new Error(`${how}: the rail did not step aside (${under.rail})`)
  }
  return under
}

/**
 * Every animation under `selector` that ends, played out: the reveal's card
 * rises in scaled down, and a box measured mid-way reads small. Merc's own
 * animations never end and are left be.
 */
async function settleAnimations(page, selector) {
  await page.evaluate(async (root) => {
    const element = document.querySelector(root)
    if (element === null) return
    const ending = element
      .getAnimations({ subtree: true })
      .filter((animation) =>
        Number.isFinite(
          animation.effect?.getComputedTiming().endTime ?? Infinity,
        ),
      )
    await Promise.all(
      ending.map((animation) => animation.finished.catch(() => undefined)),
    )
  }, selector)
}

/** The layer on `beat`, within a step. */
async function expectBeat(page, kit, beat, how) {
  await page
    .waitForFunction(
      ([layer, want]) =>
        document.querySelector(layer)?.getAttribute('data-beat') === want,
      [LAYER, beat],
      { timeout: kit.stepTimeoutMs },
    )
    .catch(() => {
      throw new Error(`${how}: the ${beat} did not come up`)
    })
}

/**
 * In the page: every visible part of the layer, its box, and what is wrong
 * with the layout: outside the screen, a control under 44 px, two parts on
 * top of one another, or a reveal that has to scroll.
 */
const readLayout = () => {
  const box = (selector) => {
    const element = document.querySelector(selector)
    if (element === null) return null
    const r = element.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return null
    return {
      left: Math.round(r.left),
      top: Math.round(r.top),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
      height: Math.round(r.height),
    }
  }
  const id = (name) => box(`[data-testid="onboarding-${name}"]`)
  const parts = {
    notNow: id('not-now'),
    line: id('line'),
    merc: id('merc'),
    lane: id('lane'),
    ladder: id('ladder'),
    pinLow: id('pin-low'),
    pinHigh: id('pin-high'),
    card: id('card'),
    mic: id('mic'),
    findRange: id('find-range'),
    skip: id('skip'),
    seeSaved: id('see-saved'),
    seeVoice: id('see-voice'),
    findTwin: id('find-twin'),
    continue: id('continue'),
    share: id('share'),
    retry: id('retry'),
    sungLane: id('sung-lane'),
    words: id('sung-words'),
    score: id('sung-score'),
    again: id('sung-again'),
  }
  const problems = []
  const w = window.innerWidth
  const h = window.innerHeight
  for (const [name, b] of Object.entries(parts)) {
    if (b === null) continue
    if (b.left < 0 || b.top < 0 || b.right > w || b.bottom > h) {
      problems.push(`${name} is off the screen ${JSON.stringify(b)}`)
    }
  }
  for (const name of [
    'notNow',
    'mic',
    'findRange',
    'skip',
    'seeSaved',
    'seeVoice',
    'findTwin',
    'continue',
    'share',
    'retry',
    'again',
  ]) {
    const b = parts[name]
    if (b !== null && (b.width < 44 || b.height < 44)) {
      problems.push(`${name} is ${b.width}x${b.height}, under 44 px`)
    }
  }
  const apart = (a, b) =>
    a === null ||
    b === null ||
    a.right <= b.left ||
    b.right <= a.left ||
    a.bottom <= b.top ||
    b.bottom <= a.top
  for (const [a, b] of [
    ['notNow', 'line'],
    ['line', 'lane'],
    ['lane', 'mic'],
    ['lane', 'findRange'],
    ['lane', 'skip'],
    ['lane', 'seeSaved'],
    ['findRange', 'skip'],
    ['seeSaved', 'findRange'],
    ['merc', 'mic'],
    ['line', 'ladder'],
    ['ladder', 'mic'],
    ['ladder', 'seeVoice'],
    ['ladder', 'skip'],
    ['notNow', 'card'],
    ['card', 'line'],
    ['card', 'continue'],
    ['line', 'continue'],
    ['continue', 'share'],
    ['notNow', 'sungLane'],
    ['line', 'sungLane'],
    ['merc', 'sungLane'],
    ['sungLane', 'words'],
    ['sungLane', 'mic'],
    ['words', 'score'],
    ['words', 'mic'],
    ['score', 'mic'],
    ['score', 'continue'],
    ['score', 'again'],
    ['continue', 'again'],
  ]) {
    if (!apart(parts[a], parts[b])) problems.push(`${a} overlaps ${b}`)
  }
  if (document.documentElement.scrollWidth > w) {
    problems.push(
      `the page scrolls sideways (${document.documentElement.scrollWidth} > ${w})`,
    )
  }
  const reveal = document.querySelector(
    '[data-testid="onboarding-reveal"]',
  )?.firstElementChild
  if (reveal && reveal.scrollHeight > reveal.clientHeight + 1) {
    problems.push(
      `the reveal scrolls (${reveal.scrollHeight} > ${reveal.clientHeight})`,
    )
  }
  return { parts, problems }
}

async function expectLayout(page, how) {
  const layout = await page.evaluate(readLayout)
  if (layout.problems.length > 0) {
    throw new Error(`${how}: ${layout.problems.join('; ')}`)
  }
  return layout.parts
}

/**
 * Gone, the flag done, and the shell's band back: the rail over a resting
 * room, or the run's transport over a room that arrived live.
 */
async function expectGone(page, kit, how, band = 'rail') {
  await page
    .waitForFunction(
      (selector) => document.querySelector(selector) === null,
      LAYER,
      { timeout: kit.stepTimeoutMs },
    )
    .catch(() => {
      throw new Error(`${how}: the onboarding is still up`)
    })
  const flag = await flagNow(page)
  if (flag !== 'done') throw new Error(`${how}: the flag is ${flag}, not done`)
  await page
    .locator(`[data-testid="shell-${band}-layer"].is-in`)
    .waitFor({ state: 'attached', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error(`${how}: the ${band} is not back`)
    })
}

/** The Sing room, live under the onboarding's last word. */
async function expectRoomLive(page, kit, how) {
  await page
    .waitForFunction(
      () =>
        typeof window.mpSingRoom === 'function' &&
        window.mpSingRoom().state === 'live',
      null,
      { timeout: kit.stepTimeoutMs },
    )
    .catch(async () => {
      const room = await page.evaluate(() => window.mpSingRoom?.())
      throw new Error(`${how}: the room is ${JSON.stringify(room)}`)
    })
}

/** The Sing door: the onboarding over the held room, hello, the example. */
async function openAtSingDoor(page, frame, kit) {
  await kit.tapDoor(page, 'sing')
  await kit.waitPhase(page, 'alive', 'sing', 'onboarding: the Sing door')
  await page.locator('[data-testid="alley-enter"]').tap()
  await expectUp(page, kit, 'the Sing door')
  const first = await page.locator(LINE).textContent()
  if (first !== "Hi, I'm Merc." && first !== 'Sing me one note, any note.') {
    throw new Error(`hello: Merc says "${first}"`)
  }
  await page
    .locator('[data-testid="onboarding-example"]')
    .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
  await page.waitForFunction(
    (selector) =>
      document.querySelector(selector)?.textContent ===
      'Sing me one note, any note.',
    LINE,
    { timeout: kit.stepTimeoutMs },
  )
  const hello = await expectLayout(page, 'hello')
  const right = frame.width - hello.notNow.right
  if (right > 24 || hello.notNow.top > 80) {
    throw new Error(
      `hello: Not now is not top right ${JSON.stringify(hello.notNow)}`,
    )
  }
  const granted = await page.evaluate(() =>
    localStorage.getItem('pitchperfect_sing_mic_granted'),
  )
  if (granted === 'true') throw new Error('hello: a mic grant before the tap')
}

/**
 * One note, named. The pitch stream reads once a screen frame, and a
 * headless page this size draws few of them, so a take can come up short
 * and Merc asks for a tap, as he would on a phone. Up to three taps, and
 * the step says how many it took. Then the note's two ways on: Find my
 * range and Skip for now, or, on a phone that already keeps a range, See
 * my voice and Find my range again.
 */
async function nameOneNote(page, kit, { saved = false } = {}) {
  let tries = 0
  let named = false
  while (!named && tries < 3) {
    tries += 1
    await page.locator(MIC).tap()
    await page
      .waitForFunction(
        (selector) =>
          document.querySelector(selector)?.getAttribute('data-state') ===
          'sing',
        MIC,
        { timeout: kit.stepTimeoutMs },
      )
      .catch(() => {
        throw new Error(`listen: the mic never opened (tap ${tries})`)
      })
    if (tries === 1) await expectLayout(page, 'listen')
    await page
      .waitForFunction(
        ([note, mic]) =>
          document.querySelector(note) !== null ||
          document.querySelector(mic)?.getAttribute('data-state') === 'ready',
        [NOTE, MIC],
        { timeout: kit.runTimeoutMs },
      )
      .catch(() => undefined)
    named = (await page.locator(NOTE).count()) > 0
  }
  if (!named) {
    const line = await page.locator(LINE).textContent()
    const take = await page.evaluate(() => window.mpOnboarding?.())
    throw new Error(
      `listen: no note was named in ${tries} taps (Merc: "${line}", the take: ${JSON.stringify(take)})`,
    )
  }
  const note = (await page.locator(NOTE).textContent())?.trim() ?? ''
  if (!TONE_NOTES.includes(note)) {
    throw new Error(`heard: "${note}" is not a note the voice sang`)
  }
  const said = await page.locator(LINE).textContent()
  const article = note.startsWith('A') || note.startsWith('E') ? 'an' : 'a'
  if (said !== `That's ${article} ${note}.`) {
    throw new Error(`heard: Merc says "${said}"`)
  }
  const heard = await expectLayout(page, 'heard')
  const ways = saved
    ? heard.seeSaved !== null && heard.skip === null
    : heard.seeSaved === null && heard.skip !== null
  if (!ways || heard.findRange === null || heard.mic !== null) {
    throw new Error(`heard: ${JSON.stringify(heard)}`)
  }
  const again = (await page.locator(FIND_RANGE).textContent())?.trim()
  if (again !== (saved ? 'Find my range again' : 'Find my range')) {
    throw new Error(`heard: the range button reads "${again}"`)
  }
  const grant = await page.evaluate(() =>
    localStorage.getItem('pitchperfect_sing_mic_granted'),
  )
  if (grant !== 'true') throw new Error(`heard: the grant is ${grant}`)
  return { note, said, tries }
}

/**
 * The range, its mic open: two slides, measured. The pins are two of the
 * tone file's notes, Merc says them, and the range is kept as a voiceprint.
 */
async function measureRange(page, kit, how) {
  await page
    .waitForFunction(
      (selector) =>
        document.querySelector(selector)?.getAttribute('data-state') === 'sing',
      MIC,
      { timeout: kit.stepTimeoutMs },
    )
    .catch(() => {
      throw new Error(`${how}: the mic never opened`)
    })
  await expectLayout(page, `${how}, sliding`)
  await page
    .locator(SEE_VOICE)
    .waitFor({ state: 'visible', timeout: RANGE_TIMEOUT_MS })
    .catch(async () => {
      const line = await page.locator(LINE).textContent()
      const slides = await page.evaluate(() => window.mpOnboardingRange?.())
      throw new Error(
        `${how}: no range in ${RANGE_TIMEOUT_MS / 1000} s (Merc: "${line}", the slides: ${JSON.stringify(slides)})`,
      )
    })
  const low = (await page.locator(PIN_LOW).textContent())?.trim() ?? ''
  const high = (await page.locator(PIN_HIGH).textContent())?.trim() ?? ''
  if (
    !TONE_NOTES.includes(low) ||
    !TONE_NOTES.includes(high) ||
    TONE_NOTES.indexOf(low) >= TONE_NOTES.indexOf(high)
  ) {
    throw new Error(`${how}: the pins read ${low} and ${high}`)
  }
  const said = await page.locator(LINE).textContent()
  if (said !== `${low} to ${high}. That's your range today.`) {
    throw new Error(`${how}: Merc says "${said}"`)
  }
  await settleAnimations(page, LAYER)
  await expectLayout(page, `${how}, measured`)
  const kept = await page.evaluate((key) => {
    try {
      const records = JSON.parse(localStorage.getItem(key) ?? '[]')
      return records.filter((record) => record.source === 'onboarding').length
    } catch {
      return -1
    }
  }, VOICEPRINTS)
  if (kept < 1) throw new Error(`${how}: no voiceprint was kept (${kept})`)
  return { low, high }
}

/**
 * See my voice: the card says the range, and the twin is found. `see` is
 * the range's own See my voice, or the first note's, for a range kept.
 */
async function reveal(page, kit, range, see = SEE_VOICE) {
  await page.locator(see).tap()
  await expectBeat(page, kit, 'reveal', 'See my voice')
  await settleAnimations(page, LAYER)
  const card = (await page.locator(CARD_RANGE).textContent())?.trim() ?? ''
  if (card !== `${range.low} to ${range.high}`) {
    throw new Error(`reveal: the card says "${card}"`)
  }
  await expectLayout(page, 'reveal')
  if ((await page.locator(FIND_TWIN).count()) === 0) {
    return `"${card}", no twin for it`
  }
  await page.locator(FIND_TWIN).tap()
  await page
    .locator(TWIN)
    .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error('reveal: Find my twin found none')
    })
  await settleAnimations(page, LAYER)
  await expectLayout(page, 'reveal, the twin found')
  const twin = (await page.locator(TWIN).textContent())?.trim() ?? ''
  return `"${card}", twin ${twin}`
}

/**
 * Keep's sheet, risen, its card in: every animation in it that ends,
 * played out, so a box measured is the one that stays.
 */
async function settleKeep(page) {
  await page.evaluate(async (keep) => {
    const sheet = document
      .querySelector(keep)
      ?.closest('[data-testid="sheet-panel"]')?.parentElement
    if (!sheet) return
    const ending = sheet
      .getAnimations({ subtree: true })
      .filter((animation) =>
        Number.isFinite(
          animation.effect?.getComputedTiming().endTime ?? Infinity,
        ),
      )
    await Promise.all(
      ending.map((animation) => animation.finished.catch(() => undefined)),
    )
  }, KEEP)
}

/**
 * Keep, as the onboarding opens it. Its shape is the shell's own, measured
 * the one way (probe-bundle.mjs); here, what this part decides: the
 * variant and its title, the card's range, the card flown in only straight
 * after a reveal, the free song with its one sentence on the confirmed
 * email, "Find your range first" (under a minute) only with no range, and
 * Keep on top. Over the layer (`over`), the layer stays on its keep beat,
 * its own Not now hidden and out of reach, the room still held, the flag
 * still due. Where Merc stands against the sheet is said, for the eye.
 */
async function expectKeep(
  page,
  kit,
  how,
  { variant, arrival, range = null, over = true },
) {
  await page
    .locator(KEEP)
    .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error(`${how}: Keep did not come`)
    })
  if (over) await expectBeat(page, kit, 'keep', how)
  await settleKeep(page)
  const shape = await kit.keepShape(page)
  if (!kit.keepShapeHolds(shape)) {
    throw new Error(`${how}: Keep is out of shape ${JSON.stringify(shape)}`)
  }
  const seen = await page.evaluate(
    ([keep, layer]) => {
      const root = document.querySelector(keep)
      const panel = root?.closest('[data-testid="sheet-panel"]') ?? null
      const card = root?.querySelector('[data-testid="keep-voiceprint"]')
      const box = panel?.getBoundingClientRect()
      const hit = box
        ? document.elementFromPoint(
            box.left + box.width / 2,
            box.top + Math.min(box.height / 2, 120),
          )
        : null
      const notNow = document.querySelector(
        '[data-testid="onboarding-not-now"]',
      )
      const merc = document
        .querySelector('[data-testid="onboarding-merc"]')
        ?.getBoundingClientRect()
      return {
        variant: root?.getAttribute('data-variant') ?? null,
        arrival: root?.getAttribute('data-arrival') ?? null,
        flown: card ? getComputedStyle(card).animationName : null,
        range:
          card?.querySelector('.mp-keep__print-range')?.textContent?.trim() ??
          null,
        song:
          root
            ?.querySelector('[data-testid="keep-free-song"]')
            ?.textContent?.trim() ?? null,
        find:
          root
            ?.querySelector('[data-testid="keep-find-range"]')
            ?.textContent?.trim() ?? null,
        onTop: panel !== null && hit !== null && panel.contains(hit),
        beat: document.querySelector(layer)?.getAttribute('data-beat') ?? null,
        layerNotNow:
          notNow === null
            ? null
            : {
                hidden: getComputedStyle(notNow).visibility === 'hidden',
                inert: notNow.closest('[inert]') !== null,
              },
        room:
          typeof window.mpSingRoom === 'function'
            ? window.mpSingRoom().state
            : null,
        sheetTop: box ? Math.round(box.top) : null,
        merc: merc
          ? { top: Math.round(merc.top), bottom: Math.round(merc.bottom) }
          : null,
      }
    },
    [KEEP, LAYER],
  )
  const wrong = []
  const title =
    variant === 'voiceprint' ? 'Keep your voiceprint' : 'Save your progress'
  if (seen.variant !== variant) wrong.push(`the ${seen.variant} variant`)
  if (shape.title !== title) wrong.push(`titled "${shape.title}"`)
  if (seen.arrival !== arrival) wrong.push(`arrived ${seen.arrival}`)
  if (variant === 'voiceprint') {
    const flown = arrival === 'reveal' ? 'mp-keep-card-in' : 'none'
    if (seen.flown !== flown) wrong.push(`the card's motion is ${seen.flown}`)
    if (range !== null && seen.range !== `${range.low}–${range.high}`) {
      wrong.push(`the card says ${seen.range}`)
    }
    if (seen.find !== null) wrong.push('"Find your range first" with a range')
  } else if (seen.find !== 'Find your range first. Takes under a minute.') {
    wrong.push(`the range row reads "${seen.find}"`)
  }
  if (
    seen.song !==
    '1 free karaoke song every monthYours once your email is confirmed.'
  ) {
    wrong.push(`the free song reads "${seen.song}"`)
  }
  if (!seen.onTop) wrong.push('something covers Keep')
  if (over) {
    if (seen.beat !== 'keep') wrong.push(`the layer is on ${seen.beat}`)
    if (seen.layerNotNow?.hidden !== true || seen.layerNotNow?.inert !== true) {
      wrong.push(`the layer's Not now is ${JSON.stringify(seen.layerNotNow)}`)
    }
    if (seen.room !== 'resting') wrong.push(`the room is ${seen.room}`)
    const flag = await flagNow(page)
    if (flag !== 'due') wrong.push(`the flag is ${flag}`)
    // Merc stands over the sheet: at most his feet go behind it.
    if (
      seen.merc !== null &&
      seen.sheetTop !== null &&
      (seen.merc.top + seen.merc.bottom) / 2 > seen.sheetTop
    ) {
      wrong.push(
        `Merc is under the sheet (${seen.merc.top}-${seen.merc.bottom}, the sheet at ${seen.sheetTop})`,
      )
    }
  }
  if (wrong.length > 0) throw new Error(`${how}: Keep ${wrong.join('; ')}`)
  const merc =
    !over || seen.merc === null || seen.sheetTop === null
      ? ''
      : seen.merc.bottom <= seen.sheetTop
        ? `, Merc whole over the sheet (${seen.merc.top}-${seen.merc.bottom}, the sheet at ${seen.sheetTop})`
        : `, Merc over the sheet, his feet behind it (${seen.merc.top}-${seen.merc.bottom}, the sheet at ${seen.sheetTop})`
  const card =
    seen.range === null
      ? 'no card'
      : `the card ${seen.range}${arrival === 'reveal' ? ' flown in' : ''}`
  return `${kit.keepShapeLine(shape)}; ${card}; the free song with its email line${over ? '; over the layer, its Not now hidden, the room held' : ''}${merc}`
}

/** Merc's words in his bubble are `text`, within a step. */
async function expectSaid(page, kit, text, how) {
  await page
    .waitForFunction(
      ([selector, want]) =>
        document.querySelector(selector)?.textContent === want,
      [LINE, text],
      { timeout: kit.stepTimeoutMs },
    )
    .catch(async () => {
      const said = await page.locator(LINE).textContent()
      throw new Error(`${how}: Merc says "${said}", not "${text}"`)
    })
}

/**
 * Beat 8, the sung line: Merc asks, the lane, the words and the mic, all
 * in the screen and apart.
 */
async function expectLine(page, kit, how) {
  await expectBeat(page, kit, 'line', how)
  await expectSaid(page, kit, 'Sing this line with me.', how)
  await settleAnimations(page, SUNG)
  const parts = await expectLayout(page, how)
  if (parts.sungLane === null || parts.words === null || parts.mic === null) {
    throw new Error(
      `${how}: the line is not all there ${JSON.stringify(parts)}`,
    )
  }
  const words = (
    await page.locator('[data-testid="onboarding-sung-words"]').textContent()
  )?.trim()
  if (words !== 'Open the window, let the morning in') {
    throw new Error(`${how}: the words read "${words}"`)
  }
}

/**
 * The line sung: the mic opened inside the tap, Merc's call, then the
 * probe's voice on the singer's turn, and the score, which the lane
 * agrees with: a bar lit for every note on pitch. Merc says what it means;
 * Continue and Once more come, and the mic is shut.
 */
async function singLine(page, kit, how) {
  await page.locator(MIC).tap()
  await page
    .waitForFunction(
      (selector) => {
        const state = document
          .querySelector(selector)
          ?.getAttribute('data-state')
        return state === 'wait' || state === 'sing'
      },
      MIC,
      { timeout: kit.stepTimeoutMs },
    )
    .catch(() => {
      throw new Error(`${how}: the mic never opened`)
    })
  await page
    .waitForFunction(
      (selector) =>
        document.querySelector(selector)?.getAttribute('data-shown') === 'on',
      SUNG_SCORE,
      { timeout: LINE_TIMEOUT_MS },
    )
    .catch(async () => {
      const line = await page.evaluate(() => window.mpOnboardingLine?.())
      const said = await page.locator(LINE).textContent()
      throw new Error(
        `${how}: no score (Merc: "${said}", the line: ${JSON.stringify(line)})`,
      )
    })
  await page
    .locator(CONTINUE)
    .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error(`${how}: no Continue under the score`)
    })
  const seen = await page.evaluate(
    ([score, line]) => ({
      score: document.querySelector(score)?.textContent?.trim() ?? null,
      said: document.querySelector(line)?.textContent ?? null,
      line: window.mpOnboardingLine?.() ?? null,
      hits: document.querySelectorAll(
        '[data-testid="onboarding-sung-lane"] [data-hit="on"]',
      ).length,
      judged: document.querySelectorAll(
        '[data-testid="onboarding-sung-lane"] [data-hit]',
      ).length,
      micOn: document.querySelector('[data-testid="onboarding-mic"]') !== null,
      // The voice's strokes on screen, against the lane they are drawn on.
      lane: (() => {
        const lane = document.querySelector(
          '[data-testid="onboarding-sung-lane"]',
        )
        if (lane === null) return null
        const box = lane.getBoundingClientRect()
        const strokes = [...lane.querySelectorAll('polyline')].map((stroke) =>
          stroke.getBoundingClientRect(),
        )
        return {
          strokes: strokes.length,
          inside: Math.min(
            ...strokes.map((r) =>
              Math.min(
                r.left - box.left,
                box.right - r.right,
                r.top - box.top,
                box.bottom - r.bottom,
              ),
            ),
          ),
        }
      })(),
    }),
    [SUNG_SCORE, LINE],
  )
  if (seen.lane === null || seen.lane.strokes === 0) {
    throw new Error(`${how}: the lane drew no voice for "${seen.score}"`)
  }
  if (seen.lane.inside < -1) {
    throw new Error(
      `${how}: the voice's trace runs ${Math.round(-seen.lane.inside)} px outside the lane`,
    )
  }
  const match = /^(\d+) of 10 notes on pitch$/u.exec(seen.score ?? '')
  if (match === null) {
    throw new Error(`${how}: the score reads "${seen.score}"`)
  }
  const hit = Number(match[1])
  if (seen.line?.phase !== 'done' || seen.line.hit !== hit) {
    throw new Error(`${how}: the line is ${JSON.stringify(seen.line)}`)
  }
  if (seen.hits !== hit || seen.judged !== 10) {
    throw new Error(
      `${how}: the lane lights ${seen.hits} of ${seen.judged} bars for "${seen.score}"`,
    )
  }
  if (!seen.said || seen.said === 'Sing this line with me.') {
    throw new Error(`${how}: Merc says "${seen.said}" of the score`)
  }
  if (seen.micOn) throw new Error(`${how}: the mic is still there`)
  const parts = await expectLayout(page, `${how}, the score`)
  if (parts.again === null || parts.continue === null) {
    throw new Error(`${how}: no Once more beside Continue`)
  }
  return {
    score: seen.score,
    said: seen.said,
    tonic: seen.line.tonic,
    heard: seen.line.heard,
  }
}

/**
 * Beat 9: the Cloud offer over the layer, as the import's gate opens it:
 * paywall B, its one Subscribe wide and centred, no "stays free" line, the
 * layer's own Not now aside under it, and the install marked as offered.
 */
async function expectOffer(page, kit, how) {
  await page
    .locator(OFFER)
    .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error(`${how}: no Cloud offer came up`)
    })
  await settleAnimations(page, OFFER)
  const seen = await page.evaluate(
    ([offer, layer, notNow, shownKey]) => {
      const sheet = document.querySelector(offer)
      const buttons = [...(sheet?.querySelectorAll('button') ?? [])]
      const subscribe = buttons.find(
        (button) => button.textContent?.trim() === 'Subscribe',
      )
      const box = (element) => {
        const r = element?.getBoundingClientRect()
        return r === undefined
          ? null
          : {
              left: Math.round(r.left),
              right: Math.round(r.right),
              width: Math.round(r.width),
            }
      }
      let aside = false
      for (let at = document.querySelector(notNow); at; at = at.parentElement) {
        if (at.inert) aside = true
      }
      return {
        beat: document.querySelector(layer)?.getAttribute('data-beat'),
        paywall:
          sheet !== null &&
          sheet.querySelector('[data-testid="cloud-offer"]') !== null,
        title: sheet?.querySelector('h2')?.textContent ?? null,
        free: /stays free/iu.test(sheet?.textContent ?? ''),
        notNow: buttons.some((b) => b.textContent?.trim() === 'Not now'),
        subscribe: box(subscribe),
        panel: box(sheet?.querySelector('[data-testid="cloud-offer"]')),
        aside,
        shown: localStorage.getItem(shownKey),
      }
    },
    [OFFER, LAYER, NOT_NOW, OFFER_SHOWN],
  )
  const problems = []
  if (seen.beat !== 'offer') problems.push(`the layer is on ${seen.beat}`)
  if (!seen.paywall) problems.push('not paywall B')
  if (seen.title !== 'Sing your own songs')
    problems.push(`titled "${seen.title}"`)
  if (seen.free) problems.push('it says what stays free')
  if (!seen.notNow) problems.push('no Not now')
  if (!seen.aside) problems.push("the layer's Not now is in reach")
  if (seen.shown !== 'shown')
    problems.push(`the install is marked ${seen.shown}`)
  const sub = seen.subscribe
  const panel = seen.panel
  if (sub === null || panel === null) {
    problems.push('no Subscribe')
  } else {
    const off = Math.abs(sub.left - panel.left - (panel.right - sub.right))
    if (off > 2) problems.push(`Subscribe sits ${off} px off centre`)
    if (sub.width < 0.7 * panel.width) {
      problems.push(`Subscribe is ${sub.width} px of ${panel.width}`)
    }
  }
  if (problems.length > 0) throw new Error(`${how}: ${problems.join('; ')}`)
  return `paywall B over the layer, its Not now aside; Subscribe ${sub.width} of ${panel.width} px, centred; nothing about what stays free; the install marked offered`
}

/**
 * The anonymous identity, asked for once Keep has opened (S7b E11). The
 * probe answers no API, so the request going out is the whole proof.
 */
async function expectMint(page, kit, mints, how) {
  const end = Date.now() + kit.stepTimeoutMs
  while (mints.length === 0 && Date.now() < end) {
    await page.waitForTimeout(100)
  }
  if (mints.length === 0) {
    throw new Error(`${how}: no anonymous identity was asked for`)
  }
}

/** None yet: the identity waits for the first offer (S7b E11). */
function expectNoMint(mints, how) {
  if (mints.length > 0) {
    throw new Error(
      `${how}: the anonymous identity was asked for before Keep (${mints.length})`,
    )
  }
}

/**
 * The Sing door, one note, the range, the reveal, Continue to Keep, and
 * Keep's Not now.
 */
async function walkRange(browser, args, frame, kit) {
  const { context, page, errors, mints } = await boot(browser, args, frame, kit)
  try {
    await openAtSingDoor(page, frame, kit)
    const { note, said, tries } = await nameOneNote(page, kit)

    // ── The range, its mic opened inside Find my range's tap ──
    await page.locator(FIND_RANGE).tap()
    await expectBeat(page, kit, 'range', 'Find my range')
    const range = await measureRange(page, kit, 'range')
    const card = await reveal(page, kit, range)
    expectNoMint(mints, 'the reveal')

    // ── Continue: Keep, beat 7, over the layer ────────────────
    await page.locator(CONTINUE).tap()
    const keep = await expectKeep(page, kit, 'Continue', {
      variant: 'voiceprint',
      arrival: 'reveal',
      range,
    })
    await expectMint(page, kit, mints, 'Keep')
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-keep')

    // ── Keep's Not now: the sung line, beat 8 ─────────────────
    await page.locator(KEEP_NOT_NOW).tap()
    await expectLine(page, kit, "Keep's Not now")
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-line')
    const sung = await singLine(page, kit, 'the line')
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-line-result')

    // ── Continue: the Cloud offer, beat 9, over the layer ─────
    await page.locator(CONTINUE).tap()
    const offer = await expectOffer(page, kit, 'Continue on the line')
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-offer')

    // ── The offer's Not now: the Sing room, live ──────────────
    await page.locator(`${OFFER} button`, { hasText: /^Not now$/u }).tap()
    await expectRoomLive(page, kit, "the offer's Not now")
    await expectGone(page, kit, "the offer's Not now", 'transport')

    // ── Never again on this install ───────────────────────────
    // The run is live, so the corner chip's column is the way to Rooms: it
    // parks the run, and the rail's Sing comes back to it.
    await page.locator('[data-testid="shell-chip"]').click()
    await page.locator('[data-column-item="rooms"]').click()
    await page
      .locator('[data-testid="rooms-alley"]')
      .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    await page.locator('[data-rail-item="stage"]').click()
    await page
      .locator('[data-testid="sing-room"]')
      .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    await page.waitForTimeout(500)
    if ((await page.locator(LAYER).count()) !== 0) {
      throw new Error('again: the onboarding opened a second time')
    }
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return [
      `the Sing door: up over the held room, rail aside; hello and the example; ${note} named ("${said}", tap ${tries}); Find my range: ${range.low} to ${range.high} from two slides, kept as a voiceprint; the reveal: ${card}, no identity asked for yet; Continue: Keep, ${keep}; the anonymous identity asked for as it opened; Keep's Not now: the sung line, from MIDI ${sung.tonic}, "${sung.score}" (Merc: "${sung.said}"), the lane agreeing, the mic shut; Continue: ${offer}; its Not now: the room live under the transport, flag done; parked and back, not again`,
    ]
  } finally {
    await context.close()
  }
}

/**
 * One note, then Skip for now: Merc's word, then Keep's Save your
 * progress, whose "Find your range first" runs the range in the layer, its
 * mic opened in that tap; the reveal, Keep again with the voiceprint, and
 * Keep's Not now to the Sing room, live.
 */
async function walkSkip(browser, args, frame, kit) {
  const { context, page, errors, mints } = await boot(
    browser,
    args,
    frame,
    kit,
    {
      group: 'holdout',
    },
  )
  try {
    await openAtSingDoor(page, frame, kit)
    const { note } = await nameOneNote(page, kit)
    await page.locator(SKIP).tap()
    await page
      .waitForFunction(
        ([selector, text]) =>
          document.querySelector(selector)?.textContent === text,
        [LINE, "It's here when you want it."],
        { timeout: kit.stepTimeoutMs },
      )
      .catch(async () => {
        const line = await page.locator(LINE).textContent()
        throw new Error(`Skip for now: Merc says "${line}"`)
      })
    await expectLayout(page, 'skipped')
    expectNoMint(mints, 'Skip for now')

    // ── Keep, Save your progress, over the layer ──────────────
    const keep = await expectKeep(page, kit, 'Skip for now', {
      variant: 'progress',
      arrival: 'plain',
    })
    await expectMint(page, kit, mints, 'Keep after a skip')
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-keep-skipped')

    // ── Find your range first: this layer's range, mic in that tap ──
    await page.locator(KEEP_FIND_RANGE).tap()
    await expectBeat(page, kit, 'range', 'Find your range first')
    await page
      .locator(KEEP)
      .waitFor({ state: 'hidden', timeout: kit.stepTimeoutMs })
      .catch(() => {
        throw new Error('Find your range first: Keep stayed up')
      })
    const entry = await page.evaluate(
      (layer) => document.querySelector(layer)?.getAttribute('data-entry'),
      LAYER,
    )
    if (entry !== 'onboarding') {
      throw new Error(`Find your range first: the range opened as ${entry}`)
    }
    const range = await measureRange(page, kit, 'the range from Keep')
    const card = await reveal(page, kit, range)

    // ── Continue: Keep again, the voiceprint flown in ─────────
    await page.locator(CONTINUE).tap()
    const again = await expectKeep(page, kit, 'Continue after Keep', {
      variant: 'voiceprint',
      arrival: 'reveal',
      range,
    })
    await page.locator(KEEP_NOT_NOW).tap()

    // ── The line, on an install held out of the offer ─────────
    await expectLine(page, kit, "Keep's Not now")
    const sung = await singLine(page, kit, 'the line, held out')
    await page.locator(CONTINUE).tap()
    await expectRoomLive(page, kit, 'Continue, held out')
    await expectGone(page, kit, 'Continue, held out', 'transport')
    const held = await page.evaluate(
      ([offer, shownKey]) => ({
        offer: document.querySelector(offer) !== null,
        shown: localStorage.getItem(shownKey),
      }),
      [OFFER, OFFER_SHOWN],
    )
    if (held.offer || held.shown !== null) {
      throw new Error(`Continue, held out: ${JSON.stringify(held)}`)
    }
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return [
      `${note} named, then Skip for now: "It's here when you want it.", no identity asked for yet; Keep: ${keep}; the anonymous identity asked for as it opened; Find your range first: the layer's own range (entry onboarding), its mic opened in that tap, ${range.low} to ${range.high}; the reveal: ${card}; Continue: Keep again, ${again}; Keep's Not now: the sung line, "${sung.score}"; Continue on an install held out: no offer, nothing marked, gone, flag done, the room live under the transport`,
    ]
  } finally {
    await context.close()
  }
}

/**
 * Settings' Save your progress opens Keep, the first offer, so the
 * anonymous identity is asked for then. Its "Find your range first" runs
 * the range on its own: the range and the reveal, then Keep again, the
 * voiceprint flown in. The onboarding is left due, and when it comes, its
 * first note ends on the range kept: See my voice reveals it, the twin it
 * was kept with, then Keep, and Keep's Not now leaves the onboarding done.
 */
async function walkKeepRange(browser, args, frame, kit) {
  const { context, page, errors, mints } = await boot(browser, args, frame, kit)
  const visible = (selector, timeout = kit.stepTimeoutMs) =>
    page.locator(selector).waitFor({ state: 'visible', timeout })
  try {
    await page.locator('[data-rail-item="more"]').click()
    await visible('[data-more-item="settings"]')
    await page.locator('[data-more-item="settings"]').click()
    await visible('[data-settings-row="save-progress"]')
    expectNoMint(mints, 'Settings')
    await page.locator('[data-settings-row="save-progress"]').click()
    await visible(KEEP)
    await expectMint(page, kit, mints, 'Keep from Settings')
    await visible('[data-testid="keep-find-range"]').catch(() => {
      throw new Error('Keep: no "Find your range first" without a voiceprint')
    })
    await page.locator('[data-testid="keep-find-range"]').click()

    await visible(LAYER).catch(() => {
      throw new Error('Find your range first: no range came up')
    })
    const opened = await page.evaluate(
      (layer) => ({
        entry: document.querySelector(layer)?.getAttribute('data-entry'),
        beat: document.querySelector(layer)?.getAttribute('data-beat'),
        skip:
          document.querySelector('[data-testid="onboarding-skip"]') !== null,
        mic: document
          .querySelector('[data-testid="onboarding-mic"]')
          ?.getAttribute('data-state'),
      }),
      LAYER,
    )
    if (
      opened.entry !== 'range' ||
      opened.beat !== 'range' ||
      opened.skip ||
      opened.mic !== 'ready'
    ) {
      throw new Error(`Find your range first: ${JSON.stringify(opened)}`)
    }
    await page
      .locator(KEEP)
      .waitFor({ state: 'hidden', timeout: kit.stepTimeoutMs })
    await expectLayout(page, 'the range from Keep')

    await page.locator(MIC).tap()
    const range = await measureRange(page, kit, 'the range from Keep')
    const card = await reveal(page, kit, range)
    await page.locator(CONTINUE).tap()
    await page
      .waitForFunction(
        (selector) => document.querySelector(selector) === null,
        LAYER,
        { timeout: kit.stepTimeoutMs },
      )
      .catch(() => {
        throw new Error('Continue: the range is still up')
      })

    const keep = await expectKeep(page, kit, 'Continue', {
      variant: 'voiceprint',
      arrival: 'reveal',
      range,
      over: false,
    })
    const flag = await flagNow(page)
    if (flag !== 'due') {
      throw new Error(`the range from Keep: the onboarding is ${flag}, not due`)
    }
    await kit.shoot(page, shotsFor(args, frame), 'keep-after-range')

    // ── Not now, then the rail's Sing: the onboarding, due ────
    await page.locator(KEEP_NOT_NOW).tap()
    await page
      .locator(KEEP)
      .waitFor({ state: 'hidden', timeout: kit.stepTimeoutMs })
    await page.locator('[data-rail-item="stage"]').click()
    await expectUp(page, kit, "the rail's Sing, a range kept")
    const { note } = await nameOneNote(page, kit, { saved: true })
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-saved-note')

    // ── See my voice: the range kept, the twin it was kept with ──
    const kept = await reveal(page, kit, range, SEE_SAVED)
    if (kept !== card) {
      throw new Error(`See my voice: the range kept reads ${kept}, not ${card}`)
    }
    await page.locator(CONTINUE).tap()
    const again = await expectKeep(page, kit, 'Continue on the range kept', {
      variant: 'voiceprint',
      arrival: 'reveal',
      range,
    })
    await page.locator(KEEP_NOT_NOW).tap()

    // ── The line, and Not now on it: no offer ─────────────────
    // The mic was granted on the first note, so the room arrives live.
    await expectLine(page, kit, "Keep's Not now")
    await page.locator(NOT_NOW).tap()
    await expectRoomLive(page, kit, 'Not now on the line')
    await expectGone(page, kit, 'Not now on the line', 'transport')
    const left = await page.evaluate(
      ([offer, shownKey]) => ({
        offer: document.querySelector(offer) !== null,
        shown: localStorage.getItem(shownKey),
        room: window.mpSingRoom?.().state ?? null,
      }),
      [OFFER, OFFER_SHOWN],
    )
    if (left.offer || left.shown !== null || left.room !== 'live') {
      throw new Error(`Not now on the line: ${JSON.stringify(left)}`)
    }
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return [
      `Keep from Settings, the anonymous identity asked for as it opened; "Find your range first": the range on its own (no Skip for now), ${range.low} to ${range.high}; the reveal: ${card}; Continue: Keep again, ${keep}; the onboarding still due. Then the rail's Sing: ${note} named, the first note ending on See my voice and Find my range again, no Skip for now; See my voice: ${kept}, as kept; Continue: Keep, ${again}; Keep's Not now: the sung line; its Not now: no offer, nothing marked, gone, flag done, the room live under the transport`,
    ]
  } finally {
    await context.close()
  }
}

/** The rail's Sing, then Not now: no grant, the room resting. */
async function walkNotNow(browser, args, frame, kit) {
  const { context, page, errors } = await boot(browser, args, frame, kit)
  try {
    await page.locator('[data-rail-item="stage"]').click()
    await expectUp(page, kit, "the rail's Sing")
    await expectLayout(page, 'Not now')
    await page.locator(NOT_NOW).tap()
    await expectGone(page, kit, 'Not now')
    const room = await page.evaluate(() => window.mpSingRoom?.())
    if (room?.state !== 'resting') {
      throw new Error(`Not now: the room is ${JSON.stringify(room)}`)
    }
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return ["the rail's Sing, then Not now: gone, flag done, the room resting"]
  } finally {
    await context.close()
  }
}

/** Back is Not now. */
async function walkBack(browser, args, frame, kit) {
  const { context, page, errors } = await boot(browser, args, frame, kit)
  try {
    await page.locator('[data-rail-item="stage"]').click()
    await expectUp(page, kit, 'Back')
    const outcome = await page.evaluate(() => window.mpShellBack())
    if (outcome !== 'onboarding') {
      throw new Error(`Back answered '${outcome}'`)
    }
    await expectGone(page, kit, 'Back')
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return ["Back answers 'onboarding': gone, flag done"]
  } finally {
    await context.close()
  }
}

/** A refused microphone: why, Try again, and Not now still the way on. */
async function walkRefused(browser, args, frame, kit) {
  const { context, page, errors } = await boot(browser, args, frame, kit, {
    refuse: true,
  })
  try {
    await page.locator('[data-rail-item="stage"]').click()
    await expectUp(page, kit, 'refused')
    await page.locator(MIC).tap()
    await page
      .locator('[data-testid="onboarding-retry"]')
      .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
      .catch(() => {
        throw new Error('refused: no Try again')
      })
    const notice = await page.locator('[role="alert"]').first().textContent()
    if (!notice?.includes('Merc needs the microphone')) {
      throw new Error(`refused: the notice reads "${notice}"`)
    }
    await expectLayout(page, 'refused')
    const grant = await page.evaluate(() =>
      localStorage.getItem('pitchperfect_sing_mic_granted'),
    )
    if (grant === 'true') throw new Error('refused: a grant was remembered')
    await page.locator(NOT_NOW).tap()
    await expectGone(page, kit, 'refused, Not now')
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return ['a refused mic: the notice and Try again; Not now: gone, flag done']
  } finally {
    await context.close()
  }
}

export async function walkOnboarding(browser, args, frame, kit) {
  const where = `${frame.width}x${frame.height}`
  const steps = []
  const problems = []
  for (const [name, walk] of [
    ['the range', walkRange],
    ['Skip for now', walkSkip],
    ['from Keep', walkKeepRange],
    ['Not now', walkNotNow],
    ['Back', walkBack],
    ['refused', walkRefused],
  ]) {
    try {
      steps.push(
        ...(await walk(browser, args, frame, kit)).map(
          (line) => `[${where}] onboarding, ${name}: ${line}`,
        ),
      )
    } catch (error) {
      problems.push(`${name}: ${error.message.split('\n')[0]}`)
    }
  }
  if (problems.length > 0) {
    throw new Error(`[${where}] onboarding: ${problems.join(' | ')}`)
  }
  return steps
}
