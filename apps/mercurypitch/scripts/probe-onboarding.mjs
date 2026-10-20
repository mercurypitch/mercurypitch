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
// over the layer, paywall B with no "stays free" line and Merc small by its
// art, and the offer's Not now lands on the Warm-up's path (beat 10): it
// draws in, Merc hops beside its first stop, and the Sing room waits under
// it until Back brings it up, live. Before all that, the alley's beat 1:
// Merc on the cobbles, clear of every door, his hello, and the open doors
// lit in turn; and each beat gives way to the next by a View Transition,
// or by a cross-fade where a sheet comes up with it. The funnel's counts go
// out as the beats pass (S7b §7), and no Google tag loads. Then, each on an
// install of its own: Skip for now (Keep, its "Find your range first" run
// in the layer, Keep again with the voiceprint, and the line, on an install
// held out of the offer: Continue lands straight on the path), Keep's
// "Find your range first" from Settings (the range on its own, Keep again,
// the first note then ending on the range kept, and Not now on the line:
// the Cloud offer, counted as Not now's, whose own Not now lands on the
// alley), Not now on the first note (the same offer, then the alley), Back
// on an install held out of the offer (the alley at once), a refused
// microphone, whose Continue without the mic lands on the path with no
// offer, and Not now after a refusal (the alley, no offer, nothing asked;
// S7b E5). Every visible part is measured
// on each frame: inside the screen, apart from one another, and every
// control at least 44 px. With --shots, the screens parts 3 to 5 added or
// changed are shot once each, after their motion has played out.
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
/** The funnel's sink (src/lib/funnel.ts, analytics.ts): names only. */
const FUNNEL = '/api/mirror/event'
/** Any Google tag, which the native build never loads (main.tsx). */
const GOOGLE = /googletagmanager|google-analytics|googleadservices|doubleclick/u
/** Beat 1, Merc's welcome in the alley (AlleyGuide.tsx). */
const GUIDE = '[data-testid="alley-guide"]'
const HELLO = "Hi, I'm Merc."
/** The open doors he points at, lit in turn, then none (AlleyGuide.tsx). */
const LIT_IN_TURN = ['ear', 'karaoke', 'sing', '']
/** Beat 10, the Warm-up's path (WarmUpPath.tsx). */
const PATH = '[data-testid="warm-up-path"]'
const WITHOUT_MIC = '[data-testid="onboarding-without-mic"]'
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

/**
 * What happens too fast to poll: the doors lit for Merc's welcome, in
 * order, and the path drawing in as it is pushed.
 */
function watch() {
  window.__mpLit = []
  window.__mpDrawIn = 0
  const drawsIn = (node) =>
    node instanceof Element &&
    (node.matches('[data-draw="in"]') ||
      node.querySelector('[data-draw="in"]') !== null)
  const trackIn = (node) =>
    node instanceof Element
      ? node.matches('[data-testid="warm-up-merc-track"]')
        ? node
        : node.querySelector('[data-testid="warm-up-merc-track"]')
      : null
  new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target
      if (record.type === 'childList') {
        for (const node of record.addedNodes) {
          if (drawsIn(node)) window.__mpDrawIn += 1
          // Where Merc stands as the path first draws him: the floor.
          const track = trackIn(node)
          if (track !== null && window.__mpMercFrom === undefined) {
            window.__mpMercFrom = track.style.transform
          }
        }
      } else if (record.attributeName === 'data-lit') {
        window.__mpLit.push(target.getAttribute('data-lit') ?? '')
      } else if (drawsIn(target)) {
        window.__mpDrawIn += 1
      }
    }
  }).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-lit', 'data-draw'],
  })
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
  // The funnel's counts the same way, and any Google tag.
  const mints = []
  const events = []
  const google = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes(MINT)) mints.push(url)
    if (url.includes(FUNNEL) && request.method() === 'POST') {
      try {
        events.push(JSON.parse(request.postData() ?? '{}').event)
      } catch {
        events.push('(unreadable)')
      }
    }
    if (GOOGLE.test(url)) google.push(url)
  })
  await page.addInitScript(kit.seed, args.theme)
  await page.addInitScript(watch)
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
  return { context, page, errors, mints, events, google }
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
    .catch(async () => {
      // Where it stopped: the address, the alley, the layer and the room.
      const seen = await page
        .evaluate(
          ([layer, flag]) => ({
            hash: window.location.hash,
            alley:
              typeof window.mpAlley === 'function' ? window.mpAlley() : null,
            layer: document.querySelector(layer) !== null,
            flag: localStorage.getItem(flag),
            room: document.querySelector('[data-testid="sing-room"]') !== null,
            morph: document.querySelector('.mp-alley-morph') !== null,
          }),
          [LAYER, FLAG],
        )
        .catch((error) => String(error))
      throw new Error(
        `${how}: the onboarding did not come up ${JSON.stringify(seen)}`,
      )
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
    withoutMic: id('without-mic'),
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
    'withoutMic',
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
    ['merc', 'line'],
    ['retry', 'withoutMic'],
    ['notNow', 'withoutMic'],
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

/**
 * Not now's landing (owner, 20 Oct 2026): gone, the flag done, the rail
 * back over the Rooms home, the alley, with no Sing room under it and no
 * room held, nothing pushed, no offer up and no welcome again.
 */
async function expectAlley(page, kit, how) {
  await expectGone(page, kit, how)
  await page
    .locator('[data-testid="rooms-alley"]')
    .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error(`${how}: the alley is not up`)
    })
  await settleAnimations(page, '[data-testid="rooms-alley"]')
  const seen = await page.evaluate(
    ([offer, keep, guide, path]) => ({
      hash: window.location.hash,
      room: document.querySelector('[data-testid="sing-room"]') !== null,
      held: typeof window.mpAlley === 'function' ? window.mpAlley().held : null,
      guide: document.querySelector(guide) !== null,
      offer:
        document.querySelector(offer) !== null ||
        document.querySelector(keep) !== null,
      path: document.querySelector(path) !== null,
    }),
    [OFFER, KEEP, GUIDE, PATH],
  )
  const problems = []
  if (seen.hash !== '#/home') problems.push(`the address is ${seen.hash}`)
  if (seen.room) problems.push('a Sing room is up')
  if (seen.held !== false) problems.push(`the rooms are held (${seen.held})`)
  if (seen.guide) problems.push('Merc welcomes again')
  if (seen.offer) problems.push('an offer is up')
  if (seen.path) problems.push("the Warm-up's path is up")
  if (problems.length > 0) throw new Error(`${how}: ${problems.join('; ')}`)
  return 'gone, flag done, the alley (#/home) under the rail, no Sing room, nothing held or pushed'
}

/** How often each of the exit's counts went out. */
function exitCounts(events) {
  const times = (name) => events.filter((event) => event === name).length
  return {
    notNow: times('native_onboarding_not_now'),
    done: times('native_onboarding_done'),
    exit: times('cloud_view_onboarding_exit'),
    end: times('cloud_view_onboarding'),
  }
}

/** Merc's feet and body in his box (MercView MERC_FEET, tip-target MERC_BODY). */
const MERC_FEET = 0.81
const MERC_BODY = { x: 0.26, y: 0.3, w: 0.48 }
/** His figure, head to feet, as a share of the door behind him (alley-guide-place.ts). */
const FIGURE_OF_DOOR = 0.4

/**
 * Beat 1, on a new install's alley (S7b; owner, 20 Oct 2026): Merc on the
 * road in front of the middle door, the Karaoke door, his feet on the floor
 * line the picture has there, sized to the door, his body over no other
 * door; his line under him, over no door and inside the screen; his hello
 * said once he is drawn; and the open doors lit in turn, then none. Then a
 * tap on him picks the door behind him, and Back puts it back. Shot as he
 * lands (with --angle gl, once his hello shows) and as the first door
 * lights, while he points.
 */
async function expectWelcome(page, args, frame, kit) {
  await page
    .locator(GUIDE)
    .waitFor({ state: 'attached', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error('beat 1: no Merc in the alley')
    })
  // Landed: his hello shows 1.2 s after he is first drawn, and the first
  // door lights 0.7 s after that. Without WebGL he is never drawn.
  const landed = await page
    .locator('[data-testid="alley-guide-line"][data-shown="on"]')
    .waitFor({ state: 'attached', timeout: 5000 })
    .then(
      () => true,
      () => false,
    )
  if (landed) {
    // The line's 280 ms rise, played out.
    await page.waitForTimeout(320)
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-welcome-landed')
  }
  await page
    .waitForFunction(() => (window.__mpLit ?? []).includes('ear'), null, {
      timeout: kit.stepTimeoutMs,
    })
    .catch(() => {
      throw new Error('beat 1: no door lit')
    })
  await kit.shoot(page, shotsFor(args, frame), 'onboarding-welcome')
  await page
    .waitForFunction(
      (want) => (window.__mpLit ?? []).length >= want,
      LIT_IN_TURN.length,
      { timeout: kit.stepTimeoutMs },
    )
    .catch(async () => {
      const lit = await page.evaluate(() => window.__mpLit)
      throw new Error(`beat 1: the doors lit ${JSON.stringify(lit)}`)
    })
  const seen = await page.evaluate(() => {
    const box = (element) => {
      if (element === null) return null
      const r = element.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    }
    const line = document.querySelector('[data-testid="alley-guide-line"]')
    const merc = document.querySelector('.mp-alley-guide__merc')
    return {
      merc: box(merc),
      floor: (merc?.getAttribute('data-floor') ?? '').split(',').map(Number),
      line: box(line),
      shown: line?.getAttribute('data-shown') ?? null,
      said:
        document.querySelector('[data-testid="alley-guide-said"]')
          ?.textContent ?? null,
      state:
        document
          .querySelector('[data-testid="alley-merc"]')
          ?.getAttribute('data-merc-state') ?? null,
      // Each door's own quad, from its rim's points, clockwise from the top
      // left: its box also holds the light it spills on the cobbles.
      doors: [...document.querySelectorAll('.mp-alley__door')].map((door) => {
        const at = door.getBoundingClientRect()
        const points = (
          door.querySelector('.mp-alley__rim-line')?.getAttribute('points') ??
          ''
        )
          .trim()
          .split(/\s+/u)
          .map((pair) => pair.split(',').map(Number))
          .map(([x, y]) => [at.left + x, at.top + y])
        return { key: door.getAttribute('data-door'), points }
      }),
      lit: window.__mpLit,
      w: window.innerWidth,
      h: window.innerHeight,
    }
  })
  const problems = []
  const r1 = (n) => Math.round(n * 10) / 10
  const boxOf = (points) => ({
    left: Math.min(...points.map(([x]) => x)),
    top: Math.min(...points.map(([, y]) => y)),
    right: Math.max(...points.map(([x]) => x)),
    bottom: Math.max(...points.map(([, y]) => y)),
  })
  const overlaps = (a, b) =>
    a.left < b.right - 1 &&
    b.left < a.right - 1 &&
    a.top < b.bottom - 1 &&
    b.top < a.bottom - 1
  const middle = seen.doors.find((door) => door.key === 'karaoke')
  if (seen.merc === null || middle === undefined || middle.points.length < 4) {
    throw new Error(
      `beat 1: ${seen.merc === null ? 'Merc has no box' : 'no Karaoke door'}`,
    )
  }
  const side = seen.merc.right - seen.merc.left
  const feet = {
    x: (seen.merc.left + seen.merc.right) / 2,
    y: seen.merc.top + MERC_FEET * side,
  }
  const body = {
    left: seen.merc.left + MERC_BODY.x * side,
    right: seen.merc.left + (MERC_BODY.x + MERC_BODY.w) * side,
    top: seen.merc.top + MERC_BODY.y * side,
    bottom: feet.y,
  }
  // His feet on the floor line, to a pixel.
  const [floorX, floorY] = seen.floor
  const off = Math.max(Math.abs(feet.x - floorX), Math.abs(feet.y - floorY))
  if (!(off <= 1.5)) {
    problems.push(
      `his feet stand at ${r1(feet.x)},${r1(feet.y)}, the floor line at ${seen.floor.join(',')}`,
    )
  }
  // In front of the middle door: under the middle of its sill, just below.
  const [a, b, c, d] = middle.points
  const sill = { x: (c[0] + d[0]) / 2, y: (c[1] + d[1]) / 2 }
  const tall = (d[1] - a[1] + (c[1] - b[1])) / 2
  const below = floorY - sill.y
  if (Math.abs(floorX - sill.x) > 2 || below < 0 || below > 0.25 * tall) {
    problems.push(
      `the floor line ${r1(below)} px under the Karaoke sill, ${r1(floorX - sill.x)} px across`,
    )
  }
  const figure = ((MERC_FEET - MERC_BODY.y) * side) / tall
  if (Math.abs(figure - FIGURE_OF_DOOR) > 0.02) {
    problems.push(`his figure is ${r1(figure * 100)}% of the door's height`)
  }
  const inside = (box) =>
    box.left >= 0 && box.top >= 0 && box.right <= seen.w && box.bottom <= seen.h
  if (!inside(body)) problems.push(`his body is off the screen`)
  const covered = seen.doors
    .filter(
      (door) => door.points.length >= 3 && overlaps(body, boxOf(door.points)),
    )
    .map((door) => door.key)
  if (JSON.stringify(covered) !== JSON.stringify(['karaoke'])) {
    problems.push(`his body covers ${JSON.stringify(covered)}`)
  }
  if (seen.line !== null) {
    if (!inside(seen.line)) {
      problems.push(`his line is off the screen ${JSON.stringify(seen.line)}`)
    }
    if (seen.line.top < feet.y) problems.push('his line is not under him')
    const over = seen.doors
      .filter(
        (door) =>
          door.points.length >= 3 && overlaps(seen.line, boxOf(door.points)),
      )
      .map((door) => door.key)
    if (over.length > 0) problems.push(`his line covers ${over.join(', ')}`)
  }
  const drawn = seen.said === HELLO
  if (drawn && seen.shown !== 'on') problems.push('his hello is not shown')
  if (JSON.stringify(seen.lit) !== JSON.stringify(LIT_IN_TURN)) {
    problems.push(`the doors lit ${JSON.stringify(seen.lit)}`)
  }
  if (problems.length > 0) throw new Error(`beat 1: ${problems.join('; ')}`)
  // A tap on him is a tap on the door behind him; Back puts it back.
  await page.touchscreen.tap(
    (body.left + body.right) / 2,
    (body.top + body.bottom) / 2,
  )
  const picked = await page
    .waitForFunction(() => window.mpAlley?.().door === 'karaoke', null, {
      timeout: kit.stepTimeoutMs,
    })
    .then(
      () => true,
      () => false,
    )
  const now = await page.evaluate(() => window.mpAlley?.())
  if (!picked) {
    throw new Error(`beat 1: a tap on Merc picked ${JSON.stringify(now)}`)
  }
  const back = await page.evaluate(() => window.mpShellBack())
  await page
    .waitForFunction(() => window.mpAlley?.().phase === 'rest', null, {
      timeout: kit.stepTimeoutMs,
    })
    .catch(async () => {
      const after = await page.evaluate(() => window.mpAlley?.())
      throw new Error(
        `beat 1: Back after the tap answered '${back}', the alley ${JSON.stringify(after)}`,
      )
    })
  const covers = seen.doors
    .filter((door) => door.points.length >= 3)
    .map((door) => {
      const box = boxOf(door.points)
      return `${door.key} ${overlaps(body, box) ? 'behind him' : 'clear'}`
    })
    .join(', ')
  return `Merc ${Math.round(side)} px, his feet ${r1(off)} px from the floor line ${r1(below)} px under the Karaoke sill, his figure ${r1(figure * 100)}% of the door (${covers})${seen.line === null ? ', no room for his line' : ', his line under him, clear of every door'}; ${drawn ? `"${HELLO}" said once he was drawn` : 'never drawn (no WebGL here), no hello'}; the doors lit ${seen.lit.filter(Boolean).join(', ')}, then none; Merc ${seen.state}; a tap on him picked the Karaoke door behind him, and Back put it back`
}

/** How the last beat gave way to this one: 'view', 'fade' or 'cut'. */
async function expectSwap(page, kit, want, how) {
  await page
    .waitForFunction(
      ([layer, w]) => document.querySelector(layer)?.dataset.swap === w,
      [LAYER, want],
      { timeout: kit.stepTimeoutMs },
    )
    .catch(async () => {
      const now = await page.evaluate(
        (layer) => document.querySelector(layer)?.dataset.swap,
        LAYER,
      )
      throw new Error(`${how}: the beats gave way by ${now}, not ${want}`)
    })
}

/**
 * Beat 10: the onboarding gone, its flag done, the Warm-up's path in its
 * place, drawn in, and Merc hopped from the floor beside its first stop;
 * the Sing room still held under the path, its mic shut. Shot once he has
 * landed. Then Back: the path goes, and the Sing room comes up.
 */
async function expectLanding(page, args, frame, kit, how) {
  await page
    .locator(PATH)
    .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error(`${how}: no Warm-up path`)
    })
  const from = await page.evaluate(() => window.__mpMercFrom ?? null)
  await page
    .waitForFunction((layer) => document.querySelector(layer) === null, LAYER, {
      timeout: kit.stepTimeoutMs,
    })
    .catch(() => {
      throw new Error(`${how}: the onboarding is still up over the path`)
    })
  const flag = await flagNow(page)
  if (flag !== 'done') throw new Error(`${how}: the flag is ${flag}, not done`)
  await page
    .waitForFunction(
      (was) => {
        const track = document.querySelector(
          '[data-testid="warm-up-merc-track"]',
        )
        return (
          track !== null &&
          track.style.transform !== was &&
          track.style.transition === 'none'
        )
      },
      from,
      { timeout: kit.stepTimeoutMs },
    )
    .catch(() => {
      throw new Error(`${how}: Merc did not hop from the floor`)
    })
  const seen = await page.evaluate(() => {
    const box = (selector) => {
      const r = document.querySelector(selector)?.getBoundingClientRect()
      return r === undefined
        ? null
        : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    }
    // A stop is a point, its orb drawn about it (PathColumn): its box is
    // where its centre is.
    const stop = box('[data-testid="warm-up-stop-0"]')
    return {
      merc: box('[data-testid="warm-up-merc"]'),
      stop: stop === null ? null : { x: stop.left, y: stop.top },
      drawIn: window.__mpDrawIn ?? 0,
      room:
        typeof window.mpSingRoom === 'function'
          ? window.mpSingRoom().state
          : null,
      w: window.innerWidth,
      h: window.innerHeight,
    }
  })
  const problems = []
  if (seen.drawIn === 0) problems.push('the path did not draw in')
  if (seen.merc === null || seen.stop === null) {
    problems.push('no Merc or no first stop')
  } else {
    // Beside a stop, his canvas's centre is RIM_W + MERC_BESIDE_GAP +
    // MERC_HALF_BODY (0.3155 W) from the stop's, about half his canvas
    // (MERC_CANVAS_W, 0.64 W), at the stop's height (path-layout.ts).
    const width = seen.merc.right - seen.merc.left
    const centre = (seen.merc.left + seen.merc.right) / 2
    const across = Math.abs(centre - seen.stop.x) / width
    const level = seen.stop.y > seen.merc.top && seen.stop.y < seen.merc.bottom
    if (across < 0.35 || across > 0.65 || !level) {
      problems.push(
        `Merc is not beside the first stop ${JSON.stringify(seen.merc)} ${JSON.stringify(seen.stop)}`,
      )
    }
    // His body, not his canvas, which is wider than he is: MERC_HALF_BODY
    // of MERC_CANVAS_W each side of its centre.
    const half = (0.145 / 0.64) * width
    if (
      centre - half < 0 ||
      centre + half > seen.w ||
      seen.merc.bottom > seen.h
    ) {
      problems.push(`Merc is off the screen ${JSON.stringify(seen.merc)}`)
    }
  }
  if (seen.room === 'live') problems.push('the Sing room is live under it')
  if (problems.length > 0) throw new Error(`${how}: ${problems.join('; ')}`)
  await kit.shoot(page, shotsFor(args, frame), 'onboarding-landing')
  const back = await page.evaluate(() => window.mpShellBack())
  if (back !== 'pushed') throw new Error(`${how}: Back answered '${back}'`)
  await page
    .locator(PATH)
    .waitFor({ state: 'detached', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error(`${how}: Back left the path up`)
    })
  return `the Warm-up's path, drawn in, Merc hopped beside its first stop, the Sing room held under it (${seen.room}); Back: the path gone`
}

/** The funnel's names as they went out, in order, against `want`. */
function expectCounts(events, google, want, how) {
  const sent = events.filter(
    (event) =>
      event.startsWith('native_onboarding_') || event.startsWith('cloud_'),
  )
  let at = 0
  for (const event of sent) if (event === want[at]) at += 1
  const problems = []
  if (at < want.length) {
    problems.push(`missing ${want[at]} in ${JSON.stringify(sent)}`)
  }
  if (google.length > 0) problems.push(`a Google tag loaded: ${google[0]}`)
  if (problems.length > 0) throw new Error(`${how}: ${problems.join('; ')}`)
  return `${sent.length} counts sent, in order, no Google tag`
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
  // Merc may still be on his way from where the last beat stood him (his
  // move, beat-swap.ts MOVE_MS): the layout is read once he has arrived,
  // and what he crossed on the way is said, not failed.
  const moving = (await page.evaluate(readLayout)).problems
  await settleAnimations(page, LAYER)
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
  return { low, high, crossed: moving.length > 0 ? moving.join('; ') : null }
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
        // Merc, small by the art (S7b beat 9): the layer's own, handed over.
        guest: (() => {
          const guest = sheet?.querySelector(
            '[data-testid="cloud-offer-guest"]',
          )
          const merc = guest?.querySelector('[data-testid="onboarding-merc"]')
          if (!guest || !merc) return null
          let hidden = false
          for (let at = guest; at; at = at.parentElement) {
            if (at.getAttribute('aria-hidden') === 'true') hidden = true
          }
          const r = guest.getBoundingClientRect()
          return {
            hidden,
            width: Math.round(r.width),
            inside:
              r.left >= 0 &&
              r.top >= 0 &&
              r.right <= window.innerWidth &&
              r.bottom <= window.innerHeight,
          }
        })(),
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
  if (seen.guest === null) problems.push('Merc is not by the art')
  else if (!seen.guest.hidden || !seen.guest.inside) {
    problems.push(`Merc by the art ${JSON.stringify(seen.guest)}`)
  }
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
  return `paywall B over the layer, its Not now aside, Merc ${seen.guest.width} px by the art; Subscribe ${sub.width} of ${panel.width} px, centred; nothing about what stays free; the install marked offered`
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
  const { context, page, errors, mints, events, google } = await boot(
    browser,
    args,
    frame,
    kit,
  )
  try {
    // ── Beat 1: Merc's welcome in the alley ───────────────────
    const welcome = await expectWelcome(page, args, frame, kit)
    await openAtSingDoor(page, frame, kit)
    const { note, said, tries } = await nameOneNote(page, kit)

    // ── The range, its mic opened inside Find my range's tap ──
    await page.locator(FIND_RANGE).tap()
    await expectBeat(page, kit, 'range', 'Find my range')
    await expectSwap(page, kit, 'view', 'Find my range')
    const range = await measureRange(page, kit, 'range')
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-range')
    const card = await reveal(page, kit, range)
    await expectSwap(page, kit, 'view', 'See my voice')
    expectNoMint(mints, 'the reveal')

    // ── Continue: Keep, beat 7, over the layer ────────────────
    await page.locator(CONTINUE).tap()
    const keep = await expectKeep(page, kit, 'Continue', {
      variant: 'voiceprint',
      arrival: 'reveal',
      range,
    })
    await expectSwap(page, kit, 'fade', 'Continue to Keep')
    await expectMint(page, kit, mints, 'Keep')
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-keep')

    // ── Keep's Not now: the sung line, beat 8 ─────────────────
    await page.locator(KEEP_NOT_NOW).tap()
    await expectLine(page, kit, "Keep's Not now")
    await expectSwap(page, kit, 'view', "Keep's Not now")
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-line')
    const sung = await singLine(page, kit, 'the line')
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-line-result')

    // ── Continue: the Cloud offer, beat 9, over the layer ─────
    await page.locator(CONTINUE).tap()
    const offer = await expectOffer(page, kit, 'Continue on the line')
    await expectSwap(page, kit, 'fade', 'Continue to the offer')
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-offer')

    // ── The offer's Not now: beat 10, the Warm-up's path ──────
    await page.locator(`${OFFER} button`, { hasText: /^Not now$/u }).tap()
    const landing = await expectLanding(
      page,
      args,
      frame,
      kit,
      "the offer's Not now",
    )
    await expectRoomLive(page, kit, 'Back from the path')
    await expectGone(page, kit, 'Back from the path', 'transport')
    const counts = expectCounts(
      events,
      google,
      [
        'native_onboarding_install',
        'native_onboarding_welcome_view',
        'native_onboarding_welcome_complete',
        'native_onboarding_first_note_view',
        'native_onboarding_mic_granted',
        'native_onboarding_first_note_complete',
        'native_onboarding_range_view',
        'native_onboarding_range_complete',
        'native_onboarding_reveal_view',
        'native_onboarding_reveal_complete',
        'native_onboarding_keep_view_voiceprint',
        'native_onboarding_keep_not_now',
        'native_onboarding_line_view',
        'native_onboarding_line_complete',
        'cloud_view_onboarding',
        'native_onboarding_done',
        'native_onboarding_path_view',
      ],
      'the counts',
    )

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
    const band = events.find((event) =>
      event.startsWith('native_onboarding_line_sung_'),
    )
    if (band === undefined) throw new Error('the counts: no band for the line')
    return [
      `beat 1: ${welcome}; the Sing door: up over the held room, rail aside; hello and the example; ${note} named ("${said}", tap ${tries}); Find my range by a View Transition: ${range.low} to ${range.high} from two slides, kept as a voiceprint; the reveal by a View Transition: ${card}, no identity asked for yet; Continue: Keep by a cross-fade, ${keep}; the anonymous identity asked for as it opened; Keep's Not now: the sung line by a View Transition, from MIDI ${sung.tonic}, "${sung.score}" (Merc: "${sung.said}"), the lane agreeing, the mic shut; Continue: ${offer}, by a cross-fade; its Not now: ${landing}, the room live under the transport, flag done; ${counts}, the line's band ${band.replace('native_onboarding_line_sung_', '')}; parked and back, not again`,
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
    const landing = await expectLanding(
      page,
      { ...args, shots: null },
      frame,
      kit,
      'Continue, held out',
    )
    await expectRoomLive(page, kit, 'Back from the path, held out')
    await expectGone(page, kit, 'Back from the path, held out', 'transport')
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
    const crossed =
      range.crossed === null
        ? ''
        : ` (on his way down from Keep, mid-move: ${range.crossed}; clear once he arrived)`
    return [
      `${note} named, then Skip for now: "It's here when you want it.", no identity asked for yet; Keep: ${keep}; the anonymous identity asked for as it opened; Find your range first: the layer's own range (entry onboarding), its mic opened in that tap, ${range.low} to ${range.high}${crossed}; the reveal: ${card}; Continue: Keep again, ${again}; Keep's Not now: the sung line, "${sung.score}"; Continue on an install held out: no offer, nothing marked, ${landing}, flag done, the room live under the transport`,
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
 * was kept with, then Keep. Keep's Not now brings the line, and Not now on
 * the line the Cloud offer (owner, 20 Oct 2026), whose Not now lands on
 * the alley.
 */
async function walkKeepRange(browser, args, frame, kit) {
  const { context, page, errors, mints, events } = await boot(
    browser,
    args,
    frame,
    kit,
  )
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

    // ── The line, and Not now on it: the offer, then the alley ─
    await expectLine(page, kit, "Keep's Not now")
    await page.locator(NOT_NOW).tap()
    const offer = await expectOffer(page, kit, 'Not now on the line')
    await page.locator(`${OFFER} button`, { hasText: /^Not now$/u }).tap()
    const alley = await expectAlley(page, kit, "the offer's Not now")
    const counts = exitCounts(events)
    if (
      counts.notNow !== 1 ||
      counts.exit !== 1 ||
      counts.end !== 0 ||
      counts.done !== 0
    ) {
      throw new Error(`Not now on the line: counted ${JSON.stringify(counts)}`)
    }
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return [
      `Keep from Settings, the anonymous identity asked for as it opened; "Find your range first": the range on its own (no Skip for now), ${range.low} to ${range.high}; the reveal: ${card}; Continue: Keep again, ${keep}; the onboarding still due. Then the rail's Sing: ${note} named, the first note ending on See my voice and Find my range again, no Skip for now; See my voice: ${kept}, as kept; Continue: Keep, ${again}; Keep's Not now: the sung line; its Not now: ${offer}, counted as Not now's; the offer's Not now: ${alley}`,
    ]
  } finally {
    await context.close()
  }
}

/**
 * The rail's Sing, then Not now on the first note (owner, 20 Oct 2026):
 * the Cloud offer over the layer, counted as Not now's, and its own Not
 * now: the alley.
 */
async function walkNotNow(browser, args, frame, kit) {
  const { context, page, errors, events } = await boot(
    browser,
    args,
    frame,
    kit,
  )
  try {
    await page.locator('[data-rail-item="stage"]').click()
    await expectUp(page, kit, "the rail's Sing")
    await expectLayout(page, 'Not now')
    await page.locator(NOT_NOW).tap()
    const offer = await expectOffer(page, kit, 'Not now')
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-exit-offer')
    await page.locator(`${OFFER} button`, { hasText: /^Not now$/u }).tap()
    const alley = await expectAlley(page, kit, "the offer's Not now")
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-exit-alley')
    const counts = exitCounts(events)
    if (
      counts.notNow !== 1 ||
      counts.exit !== 1 ||
      counts.end !== 0 ||
      counts.done !== 0
    ) {
      throw new Error(`Not now: counted ${JSON.stringify(counts)}`)
    }
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return [
      `the rail's Sing, then Not now: ${offer}, counted as Not now's; its Not now: ${alley}`,
    ]
  } finally {
    await context.close()
  }
}

/**
 * Back is Not now. On an install held out of the offer: the alley at
 * once, nothing asked and nothing marked.
 */
async function walkBack(browser, args, frame, kit) {
  const { context, page, errors, events, mints } = await boot(
    browser,
    args,
    frame,
    kit,
    { group: 'holdout' },
  )
  try {
    await page.locator('[data-rail-item="stage"]').click()
    await expectUp(page, kit, 'Back')
    const outcome = await page.evaluate(() => window.mpShellBack())
    if (outcome !== 'onboarding') {
      throw new Error(`Back answered '${outcome}'`)
    }
    const alley = await expectAlley(page, kit, 'Back')
    const shown = await page.evaluate(
      (key) => localStorage.getItem(key),
      OFFER_SHOWN,
    )
    const counts = exitCounts(events)
    if (shown !== null || counts.exit !== 0 || mints.length > 0) {
      throw new Error(
        `Back, held out: ${JSON.stringify({ shown, counts, mints: mints.length })}`,
      )
    }
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return [
      `Back answers 'onboarding' on an install held out of the offer: no offer, nothing asked or marked; ${alley}`,
    ]
  } finally {
    await context.close()
  }
}

/**
 * A refused microphone, then Not now: no offer after a refusal (S7b E5),
 * nothing asked or marked, and the alley.
 */
async function walkRefusedNotNow(browser, args, frame, kit) {
  const { context, page, errors, events, mints } = await boot(
    browser,
    args,
    frame,
    kit,
    { refuse: true },
  )
  try {
    await page.locator('[data-rail-item="stage"]').click()
    await expectUp(page, kit, 'refused, then Not now')
    await page.locator(MIC).tap()
    await page
      .locator('[data-testid="onboarding-retry"]')
      .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
      .catch(() => {
        throw new Error('refused, then Not now: no Try again')
      })
    await page.locator(NOT_NOW).tap()
    const alley = await expectAlley(page, kit, 'Not now after a refusal')
    const shown = await page.evaluate(
      (key) => localStorage.getItem(key),
      OFFER_SHOWN,
    )
    const counts = exitCounts(events)
    if (shown !== null || counts.exit !== 0 || mints.length > 0) {
      throw new Error(
        `Not now after a refusal: ${JSON.stringify({ shown, counts, mints: mints.length })}`,
      )
    }
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return [
      `a refused mic, then Not now: no offer, nothing asked or marked; ${alley}`,
    ]
  } finally {
    await context.close()
  }
}

/**
 * A refused microphone: why, Try again, and Continue without the mic, the
 * one way on to the landing, with no offer (REQ-NFL-043, S7b E5).
 */
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
    await kit.shoot(page, shotsFor(args, frame), 'onboarding-without-mic')
    // One tap on (REQ-NFL-043): the landing, with no offer of either kind.
    await page.locator(WITHOUT_MIC).tap()
    const landing = await expectLanding(
      page,
      { ...args, shots: null },
      frame,
      kit,
      'Continue without the mic',
    )
    const offered = await page.evaluate(
      ([offer, keep]) =>
        document.querySelector(offer) !== null ||
        document.querySelector(keep) !== null,
      [OFFER, KEEP],
    )
    if (offered) throw new Error('Continue without the mic: an offer came up')
    await expectGone(page, kit, 'Back from the path, refused')
    const room = await page.evaluate(() => window.mpSingRoom?.())
    if (room?.state !== 'resting') {
      throw new Error(
        `Back from the path, refused: the room is ${JSON.stringify(room)}`,
      )
    }
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return [
      `a refused mic: the notice, Try again and Continue without the mic; that: ${landing}, no offer, flag done, the room resting`,
    ]
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
    ['refused, then Not now', walkRefusedNotNow],
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
