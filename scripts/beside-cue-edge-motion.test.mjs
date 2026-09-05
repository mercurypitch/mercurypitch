import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

function offsets(contacts, restX, exiting = false, margin = 4) {
  const result = spawnSync(
    'python3',
    [
      '-c',
      [
        'import json, sys',
        'from beside_cue_edge_motion import edge_offsets',
        'args = json.load(sys.stdin)',
        'print(json.dumps(edge_offsets(*args)))',
      ].join('\n'),
    ],
    {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      input: JSON.stringify([contacts, restX, exiting, 24, margin]),
      encoding: 'utf8',
    },
  )
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test('a late entrance never exposes its cropped edge and still reaches the hold pose', () => {
  // The Usual's actual source remains cropped through f45, not merely f24.
  const contacts = Array.from({ length: 96 }, (_, n) => n >= 8 && n <= 45)
  const positions = offsets(contacts, 84)
  for (let n = 8; n <= 45; n++) assert.ok(positions[n] <= 0)
  assert.equal(positions[45], -4)
  assert.equal(positions[69], 84)
  assert.equal(positions[95], 84)
  assert.ok(positions.every((x, n) => n === 0 || x >= positions[n - 1]))
})

test('an exit moves its edge offscreen before clipping begins, not afterwards', () => {
  const contacts = Array.from({ length: 96 }, (_, n) => n >= 43 && n <= 93)
  const positions = offsets(contacts, 89, true)
  assert.equal(positions[0], 89)
  assert.equal(positions[19], 89)
  for (let n = 43; n <= 93; n++) assert.ok(positions[n] <= 0)
  assert.ok(positions.every((x, n) => n === 0 || x <= positions[n - 1]))
})

test('a briefly clear gap does not release an entrance before its final edge contact', () => {
  const contacts = Array.from({ length: 96 }, (_, n) => n === 10 || n === 50)
  const positions = offsets(contacts, 116)
  assert.equal(positions[40], -4)
  assert.equal(positions[50], -4)
  assert.equal(positions[95], 116)
})

test('uncropped sources and already offscreen registrations are not translated', () => {
  assert.deepEqual(offsets([false, false, false], 94), [94, 94, 94])
  assert.deepEqual(offsets([true, true, false], -10), [-10, -10, -10])
})

test('an unfinished exit clears its final fragment before the empty-room tail', () => {
  const contacts = Array.from({ length: 96 }, (_, n) => n >= 52)
  const remainingFragmentWidth = 21
  const positions = offsets(contacts, 102, true, remainingFragmentWidth + 4)
  assert.equal(positions[0], 102)
  assert.ok(positions[95] + remainingFragmentWidth < 0)
})
