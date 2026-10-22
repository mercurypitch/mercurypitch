// The draft-lessons assert reads a finished dist. Each case below hands it
// one built the way the real build lays it out, from the repository's own
// lesson pages and draft list, with one thing wrong, and checks the assert
// names it; the dist with nothing wrong passes in either mode.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { DRAFT_LESSONS } from '../src/features/lessons/kit/drafts.ts'

const SCRIPT = fileURLToPath(
  new URL('./assert-draft-lessons.mjs', import.meta.url),
)
const pad = (n) => String(n).padStart(2, '0')
const PAGES = readdirSync(new URL('../learn/', import.meta.url))
  .map((name) => /^(\d{2})\.html$/.exec(name)?.[1])
  .filter((nn) => nn !== undefined)
  .map(Number)
const DRAFTS = PAGES.filter((n) => DRAFT_LESSONS[n] !== undefined)
const RELEASED = PAGES.filter((n) => !DRAFTS.includes(n))
const [DRAFT] = DRAFTS
const NO_DRAFT = { skip: DRAFT === undefined && 'no lesson is a draft' }

const site = (n) => `https://mercurypitch.com/learn/${pad(n)}`

/** A dist as the build lays one out, every page in it, with `shown` its default. */
function distFiles(shown) {
  const files = {
    '404.html': '<!doctype html><title>Not found</title>',
    'index.html': '<!doctype html><nav><a href="/learn/01">Lesson 1</a></nav>',
    'sitemap.xml': `<urlset>${RELEASED.map((n) => `<url><loc>${site(n)}</loc></url>`).join('')}</urlset>`,
    'llms.txt': RELEASED.map((n) => `- [Lesson ${n}](${site(n)}): a hook`).join(
      '\n',
    ),
    'sw.js': `const S=new Set([${PAGES.map((n) => `"/learn/${pad(n)}","/learn/${pad(n)}.html"`).join(',')}]);`,
    'assets/season-Ab12.js': `const L=[${PAGES.map((n) => `{n:${n},page:"/learn/${pad(n)}"}`).join(',')}];`,
    'assets/page-state-Cd34.js': `const B='{"version":1,"updatedAt":null,"lessons":{},"drafts":${shown}}';`,
  }
  for (const n of PAGES)
    files[`learn/${pad(n)}.html`] =
      `<!doctype html><link rel="canonical" href="${site(n)}" />`
  return files
}

/** Runs the assert over `files`, as a dist, with `flags` after its directory. */
function assertOver(files, flags) {
  const dist = mkdtempSync(join(tmpdir(), 'draft-lessons-'))
  try {
    for (const [path, body] of Object.entries(files)) {
      if (body === null) continue
      mkdirSync(dirname(join(dist, path)), { recursive: true })
      writeFileSync(join(dist, path), body)
    }
    return spawnSync(process.execPath, [SCRIPT, dist, ...flags], {
      encoding: 'utf8',
    })
  } finally {
    rmSync(dist, { recursive: true, force: true })
  }
}

/** Asserts the dist `files` fails in `mode`, naming `reason`. */
function fails(files, mode, reason) {
  const result = assertOver(files, [mode])
  assert.equal(result.status, 1, result.stdout)
  assert.match(result.stderr, reason)
}

for (const [mode, shown] of [
  ['--shown', true],
  ['--hidden', false],
]) {
  test(`passes a dist with every lesson page and drafts ${shown ? 'shown' : 'held back'} by default (${mode})`, () => {
    const result = assertOver(distFiles(shown), [mode])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /lesson pages .* built/)
  })

  test(`fails a dist missing a lesson page, draft or released (${mode})`, () => {
    for (const n of PAGES)
      fails(
        { ...distFiles(shown), [`learn/${pad(n)}.html`]: null },
        mode,
        new RegExp(`learn/${pad(n)}\\.html is missing`),
      )
    fails({ ...distFiles(shown), '404.html': null }, mode, /404\.html/)
  })

  test(`fails a bundle whose default for drafts is the other one, or missing (${mode})`, () => {
    fails(distFiles(!shown), mode, /default to drafts/)
    fails(
      {
        ...distFiles(shown),
        'assets/other-Ef56.js': `const B="{\\"version\\":1,\\"updatedAt\\":null,\\"lessons\\":{},\\"drafts\\":${!shown}}";`,
      },
      mode,
      /other-Ef56\.js/,
    )
    fails(
      { ...distFiles(shown), 'assets/page-state-Cd34.js': 'const B=null;' },
      mode,
      /no script in assets\/ carries the default/,
    )
  })

  test(
    `fails a bundle that does not carry a draft's path (${mode})`,
    NO_DRAFT,
    () => {
      const files = distFiles(shown)
      files['assets/season-Ab12.js'] = files['assets/season-Ab12.js'].replace(
        `"/learn/${pad(DRAFT)}"`,
        'void 0',
      )
      fails(
        files,
        mode,
        new RegExp(`no script in assets/ carries /learn/${pad(DRAFT)}`),
      )
    },
  )

  test(`fails a static listing that names a draft (${mode})`, NO_DRAFT, () => {
    const files = distFiles(shown)
    fails(
      {
        ...files,
        'sitemap.xml': files['sitemap.xml'].replace(
          '</urlset>',
          `<url><loc>${site(DRAFT)}</loc></url></urlset>`,
        ),
      },
      mode,
      /sitemap\.xml lists/,
    )
    fails(
      {
        ...files,
        'llms.txt': `${files['llms.txt']}\n- [A draft](${site(DRAFT)})`,
      },
      mode,
      /llms\.txt lists/,
    )
  })

  test(
    `fails a document outside learn/ that carries a draft's address, and not a lesson page (${mode})`,
    NO_DRAFT,
    () => {
      const link = `<a href="/learn/${pad(DRAFT)}">A draft</a>`
      const files = distFiles(shown)
      fails({ ...files, 'index.html': link }, mode, /index\.html/)
      const inLesson = assertOver(
        { ...files, 'learn/01.html': `${files['learn/01.html']}${link}` },
        [mode],
      )
      assert.equal(inLesson.status, 0, inLesson.stderr)
    },
  )

  test(`fails a service worker with no rule for a lesson (${mode})`, () => {
    for (const n of PAGES) {
      const files = distFiles(shown)
      fails(
        {
          ...files,
          'sw.js': files['sw.js'].replace(`"/learn/${pad(n)}",`, ''),
        },
        mode,
        new RegExp(`sw\\.js has no /learn/${pad(n)} rule`),
      )
    }
    fails({ ...distFiles(shown), 'sw.js': null }, mode, /sw\.js is missing/)
  })
}

test(
  "passes each reading marked as its build's default has it, and fails one marked for the other",
  NO_DRAFT,
  () => {
    const pair = (n, live, planned) =>
      `<p><span data-if-live="${n}"${live}>ready</span><span data-if-planned="${n}"${planned}>coming later</span></p>`
    // A draft's readings, marked for a build that shows drafts or one that
    // does not; Lesson 1's, live in both; and Lesson 99's, which has no page
    const marked = (shown) =>
      [
        pair(DRAFT, shown ? '' : ' hidden', shown ? ' hidden' : ''),
        pair(1, '', ' hidden=""'),
        pair(99, ' hidden', ''),
      ].join('')

    for (const [mode, shown] of [
      ['--shown', true],
      ['--hidden', false],
    ]) {
      const right = assertOver(
        { ...distFiles(shown), 'learn/01.html': marked(shown) },
        [mode],
      )
      assert.equal(right.status, 0, right.stderr)
      fails(
        { ...distFiles(shown), 'learn/01.html': marked(!shown) },
        mode,
        /under this build's default/,
      )
    }
  },
)

test('passes a block round a section, marked as the build has it, and fails one marked for the other', () => {
  // Lesson 1 is live in both builds, so its block stays shown
  const block = (hidden) =>
    `<div data-if-live="1"${hidden}>\n<section><span>Recall</span><p>Two questions</p></section>\n</div>`
  const right = assertOver(
    { ...distFiles(false), 'learn/01.html': block('') },
    ['--hidden'],
  )
  assert.equal(right.status, 0, right.stderr)
  fails(
    { ...distFiles(false), 'learn/01.html': block(' hidden') },
    '--hidden',
    /under this build's default/,
  )
})

test('fails a reading the worker and the page cannot both settle', () => {
  for (const reading of [
    '<div data-if-live="1" class="x">ready</div>',
    '<section data-if-live="1">ready</section>',
    '<span data-if-live="x">ready</span>',
    '<span data-if-live="123">ready</span>',
    '<span class="ok" data-if-live="1">ready</span>',
    '<span data-if-live="1" data-if-planned="1">ready</span>',
  ])
    fails(
      { ...distFiles(false), 'learn/01.html': reading },
      '--hidden',
      /cannot both settle/,
    )
  fails(
    {
      ...distFiles(false),
      'learn/01.html': '<span data-if-live="1">ready <span>now</span></span>',
    },
    '--hidden',
    /holds a span/,
  )
})

test('refuses to run without a mode', () => {
  const result = spawnSync(process.execPath, [SCRIPT, 'dist'], {
    encoding: 'utf8',
  })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Usage/)
})
