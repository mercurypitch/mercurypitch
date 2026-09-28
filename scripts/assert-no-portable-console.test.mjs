// The portable console and the Developer screen are a test build's. The
// assert greps a dist for strings only their modules carry; each case below
// hands it a dist with one of them, the way a minified chunk carries it.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(
  new URL('./assert-no-portable-console.mjs', import.meta.url),
)

/** Runs the assert over a dist holding one chunk with `text` in it. */
function assertOver(text) {
  const dist = mkdtempSync(join(tmpdir(), 'no-portable-console-'))
  try {
    mkdirSync(join(dist, 'assets'))
    writeFileSync(join(dist, 'assets', 'index-Ab12Cd34.js'), text)
    return spawnSync(process.execPath, [SCRIPT, dist], { encoding: 'utf8' })
  } finally {
    rmSync(dist, { recursive: true, force: true })
  }
}

test('passes a dist that carries none of them', () => {
  const result = assertOver('const t=x("<div class=mp-more>Settings");')
  assert.equal(result.status, 0, result.stderr)
})

const CARRIED = [
  ['the portable console', 'const k="MercuryPitch portable console";'],
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
]

for (const [what, text] of CARRIED) {
  test(`fails a dist that carries ${what}`, () => {
    const result = assertOver(text)
    assert.equal(result.status, 1, `exited ${result.status} over: ${text}`)
    assert.match(result.stderr, /index-Ab12Cd34\.js/u)
  })
}
