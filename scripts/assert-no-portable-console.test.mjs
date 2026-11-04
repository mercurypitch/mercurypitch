// The portable console and the Developer screen are a test build's. The
// assert greps a dist for strings only their modules carry; each case below
// hands it a dist with one of them, the way a minified chunk carries it.
//
// A store binary is held to more: the floating developer console is a test
// build's too there, while the web ships it on purpose. `--store-binary`
// adds its fingerprints, and only that flag does.
//
// And a store binary carries the TV chooser and the TV stage's page, as
// every build does, while the Developer screen's TV section stays out: the
// chooser's and the page's real sources pass, the section's ids fail.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(
  new URL('./assert-no-portable-console.mjs', import.meta.url),
)

/**
 * Runs the assert over a dist holding one chunk with `text` in it, with
 * `flags` after the directory, where the store build's CI step puts them.
 */
function assertOver(text, flags = []) {
  const dist = mkdtempSync(join(tmpdir(), 'no-portable-console-'))
  try {
    mkdirSync(join(dist, 'assets'))
    writeFileSync(join(dist, 'assets', 'index-Ab12Cd34.js'), text)
    return spawnSync(process.execPath, [SCRIPT, dist, ...flags], {
      encoding: 'utf8',
    })
  } finally {
    rmSync(dist, { recursive: true, force: true })
  }
}

/**
 * Runs the assert over a dist holding these files, each path relative to
 * the dist, with `flags` after the directory.
 */
function assertOverFiles(files, flags = []) {
  const dist = mkdtempSync(join(tmpdir(), 'no-portable-console-'))
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dist, path, '..'), { recursive: true })
      writeFileSync(join(dist, path), text)
    }
    return spawnSync(process.execPath, [SCRIPT, dist, ...flags], {
      encoding: 'utf8',
    })
  } finally {
    rmSync(dist, { recursive: true, force: true })
  }
}

/** A source file as a built chunk keeps it: its code, without comments. */
function code(relative) {
  return readFileSync(new URL(relative, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/(^|[^:'"`])\/\/.*$/gmu, '$1')
}

test('passes a dist that carries none of them', () => {
  const result = assertOver('const t=x("<div class=mp-more>Settings");')
  assert.equal(result.status, 0, result.stderr)
})

const CARRIED = [
  ['the portable console', 'const k="MercuryPitch portable console";'],
  [
    'runner recovery diagnostics',
    'console.warn("[Glassworks runner recovery]",{});',
  ],
  ['runner touch diagnostics', 'console.warn("[Glassworks runner input]",{});'],
  [
    'the Developer screen',
    'const t=x("<div class=mp-dev data-testid=shell-developer>");',
  ],
  [
    'its native sign-in section',
    'const t=x("<pre class=result data-testid=native-signin-result>");',
  ],
  [
    'its audio section',
    'const t=x("<pre class=mp-dev__report data-testid=dev-audio-report>");',
  ],
  [
    'its Karaoke audio section',
    'const t=x("<div class=mp-dev__audio data-testid=dev-karaoke-audio>");',
  ],
  [
    'its AirPlay sound check',
    'const t=x("<div class=mp-dev__audio data-testid=dev-airplay-check>");',
  ],
  [
    "the AirPlay sound check's line",
    'console.info(`[airplay check] ${n} ${t}: ${w}`);',
  ],
  [
    'its TV section',
    'const t=x("<div class=mp-dev__audio data-testid=dev-tv-lyrics>");',
  ],
  [
    "its TV stage's switch",
    'const t=x("<button role=switch data-testid=dev-tv-stage-switch>");',
  ],
  [
    "the TV stage picture's Earlier",
    'const t=x("<button data-testid=dev-tv-stage-earlier>Earlier");',
  ],
  [
    'the audio report a song on AirPlay writes',
    'console.info(`[audio report ${i}/${n}] ${why}`);',
  ],
]

for (const [what, text] of CARRIED) {
  test(`fails a dist that carries ${what}`, () => {
    const result = assertOver(text)
    assert.equal(result.status, 1, `exited ${result.status} over: ${text}`)
    assert.match(result.stderr, /index-Ab12Cd34\.js/u)
  })
}

/** Each floating-console fingerprint, as a minified chunk carries it. */
const FLOATING = [
  [
    'the floating panel',
    'floating-console',
    'const t=x("<div data-testid=floating-console>");',
  ],
  [
    'its host on <body>',
    'mp-developer-console-host',
    'const Uee="mp-developer-console-host";',
  ],
  [
    'the switch that arms it',
    'pitchperfect_developer_console',
    'const dbe="pitchperfect_developer_console";',
  ],
]

for (const [what, needle, text] of FLOATING) {
  test(`fails a store binary that carries ${what}`, () => {
    const result = assertOver(text, ['--store-binary'])
    assert.equal(result.status, 1, `exited ${result.status} over: ${text}`)
    assert.match(result.stderr, /index-Ab12Cd34\.js/u)
    assert.ok(
      result.stderr.includes(needle),
      `stderr does not name ${needle}:\n${result.stderr}`,
    )
  })

  // The web build runs this assert without the flag, and it ships the
  // floating console on purpose: a fingerprint that leaked into the default
  // set would fail every web build.
  test(`leaves ${what} to a web build, which ships it`, () => {
    const result = assertOver(text)
    assert.equal(result.status, 0, result.stderr)
  })
}

test("passes a store binary that keeps the crash card's own log", () => {
  // The inline Developer Console on the crash card ships in every build; the
  // floating one is what a store binary must not carry.
  const result = assertOver(
    'const u=x("<div><div><h4>Developer Console"),m=x("<div data-testid=console-log-messages>");',
    ['--store-binary'],
  )
  assert.equal(result.status, 0, result.stderr)
})

test('still fails a store binary that carries the portable console', () => {
  const result = assertOver('const k="MercuryPitch portable console";', [
    '--store-binary',
  ])
  assert.equal(result.status, 1, `exited ${result.status}`)
  assert.match(result.stderr, /index-Ab12Cd34\.js/u)
})

test('refuses a flag it does not know, rather than running the weaker check', () => {
  // A misspelt `--store-binary` in a workflow would otherwise check a store
  // binary as a web build, and pass the very console it exists to catch.
  const result = assertOver(
    'const t=x("<div data-testid=floating-console>");',
    ['--store-binray'],
  )
  assert.equal(result.status, 2, `exited ${result.status}`)
  assert.match(result.stderr, /--store-binray/u)
})

test('passes a store binary that carries the TV chooser and the TV stage', () => {
  // Every build asks what a connected TV shows, and carries the page the
  // stage is drawn on: their real sources, as a chunk and a page carry them.
  const chooser = [
    '../apps/mercurypitch/src/shell/tv/tv-choice.ts',
    '../apps/mercurypitch/src/shell/tv/tv-copy.ts',
    '../apps/mercurypitch/src/shell/tv/tv-memory.ts',
    '../apps/mercurypitch/src/shell/tv/tv-name.ts',
    '../apps/mercurypitch/src/shell/tv/TvChoiceSheet.tsx',
    '../apps/mercurypitch/src/shell/tv/TvSettingsGroup.tsx',
  ]
    .map(code)
    .join('\n')
  const result = assertOverFiles(
    {
      'assets/index-Ab12Cd34.js': chooser,
      'assets/stage-Ef56Gh78.js': code(
        '../apps/mercurypitch/src/stage/main.ts',
      ),
      'stage.html': readFileSync(
        new URL('../apps/mercurypitch/stage.html', import.meta.url),
        'utf8',
      ),
    },
    ['--store-binary'],
  )

  assert.ok(chooser.includes('tv-choice'), 'the chooser’s sources were read')
  assert.equal(result.status, 0, result.stderr)
})
