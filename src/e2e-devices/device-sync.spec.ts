// ── A song crossing two real devices ─────────────────────────────────
//
// The one thing nothing else in this repo does. `sync-protocol.test.ts`
// runs both halves over an in-memory pipe; `sync-store.test.ts` runs the
// state machine against a faked peer; `jam-song-transfer.test.ts` chunks
// bytes nobody receives. Every one of them fakes either the peer or the
// channel — and both bugs found by hand on the first two-device run lived
// exactly in that seam: a route read before ICE had settled, and a dead
// device's free-space figure surviving the device.
//
// So this spec makes two browsers, gives one a song, and makes it arrive
// on the other over a real RTCPeerConnection. Separate browser INSTANCES,
// because two contexts share a network process and never connect.
//
// Needs the jam worker. See docs/agent/TWO-DEVICE-E2E.md.

import { expect, test } from '@playwright/test'
import type { Device } from './helpers/devices'
import { launchDevice, openApp, toneWavBase64 } from './helpers/devices'

/** Long enough that packing takes a beat, which is the point of §A. */
const SONG_SECONDS = 6
const SONG_TITLE = 'Two Device Anthem'
const FILE_HASH = 'e2e-two-device-anthem-0000000000000000000000000000'

interface SeededSong {
  sessionId: string
  title: string
  status: string
  outputs: Record<string, string>
  /** Read back off the stored blobs, not off the session's metadata. */
  stemBytes: Record<string, number>
}

declare global {
  interface Window {
    __ppSongSeed?: {
      seedSong: (input: {
        name: string
        fileHash: string
        vocalWavBase64: string
      }) => Promise<string>
      readSong: (fileHash: string) => Promise<SeededSong | null>
    }
  }
}

async function openKaraoke(device: Device): Promise<void> {
  await openApp(device, '#/karaoke')
  await device.page.waitForFunction(
    () => window.__ppSongSeed !== undefined,
    undefined,
    { timeout: 30_000 },
  )
  await device.page.evaluate(async () => {
    const store = window.__pp?.appStore as unknown as {
      initSessionStore?: () => Promise<void>
    }
    await store.initSessionStore?.()
  })
}

async function seedSong(device: Device): Promise<string> {
  return device.page.evaluate(
    async ({ name, fileHash, wav }) =>
      window.__ppSongSeed!.seedSong({
        name,
        fileHash,
        vocalWavBase64: wav,
      }),
    {
      name: SONG_TITLE,
      fileHash: FILE_HASH,
      wav: toneWavBase64(220, SONG_SECONDS),
    },
  )
}

async function songOn(device: Device): Promise<SeededSong | null> {
  return device.page.evaluate(
    async (hash) => window.__ppSongSeed!.readSong(hash),
    FILE_HASH,
  )
}

/** Open the sync modal from the Karaoke tab's own button. */
async function openSync(device: Device): Promise<void> {
  await device.page
    .getByRole('button', { name: 'Sync songs with another of your devices' })
    .click()
  await expect(device.page.getByTestId('sync-modal')).toBeVisible()
}

/**
 * Status of the transfer row in one direction, or null while there is
 * none. Read as an attribute rather than from the label, so a copy change
 * does not turn into a red test.
 */
function transferRow(device: Device, direction: 'in' | 'out') {
  return device.page.locator(
    `[data-testid="sync-transfer"][data-direction="${direction}"]`,
  )
}

/**
 * Poll a transfer to a terminal state, remembering every status on the
 * way. The intermediate states are half the point: a receiver that only
 * ever shows "done" was silent for the whole minute before it.
 */
async function watchTransfer(
  device: Device,
  direction: 'in' | 'out',
  want: string,
): Promise<Set<string>> {
  const seen = new Set<string>()
  await expect
    .poll(
      async () => {
        const status = await transferRow(device, direction)
          .first()
          .getAttribute('data-status')
          .catch(() => null)
        if (status !== null) seen.add(status)
        return status
      },
      { intervals: [100], timeout: 150_000 },
    )
    .toBe(want)
  return seen
}

test.describe('sending a song to another device', () => {
  test('it arrives, it plays, and sending it twice is declined', async () => {
    const sender = await launchDevice('sender')
    const receiver = await launchDevice('receiver')

    try {
      await openKaraoke(sender)
      await openKaraoke(receiver)
      await seedSong(sender)
      expect(await songOn(receiver)).toBeNull()

      // ── Pair them ──────────────────────────────────────────────────
      await openSync(receiver)
      await receiver.page.getByTestId('sync-choose-receive').click()
      const code = await receiver.page
        .getByTestId('sync-room-code')
        .innerText({ timeout: 60_000 })
      expect(code).toMatch(/^[A-Z0-9]+$/)

      await openSync(sender)
      await sender.page.getByTestId('sync-choose-send').click()
      await sender.page.getByTestId('sync-join-input').fill(code)
      await sender.page.getByTestId('sync-join-submit').click()

      // Assert on the room, never on a timer. The song list only exists
      // once the data channel is open on both sides.
      await expect(sender.page.getByTestId('sync-song-row')).toHaveCount(1, {
        timeout: 90_000,
      })

      // ── Send it ────────────────────────────────────────────────────
      await sender.page.getByTestId('sync-song-send').click()

      // The receiver must know work is happening BEFORE any byte moves.
      // `sync-offer` carries the manifest and the manifest cannot exist
      // until the whole bundle is packed, so without the preparing frame
      // this screen is blank for the entire encode.
      const receiverSaw = await watchTransfer(receiver, 'in', 'done')
      expect([...receiverSaw]).toContain('preparing')
      await watchTransfer(sender, 'out', 'done')

      // ── It arrived, and it can be played ───────────────────────────
      const arrived = await songOn(receiver)
      expect(arrived).not.toBeNull()
      expect(arrived!.status).toBe('completed')
      expect(arrived!.title).toContain(SONG_TITLE)
      // The regression that shipped: the import wrote the blob table's ROW
      // ID here, `ensureSessionHydrated` read a non-blob value as a remote
      // stem and left it alone, and the mixer was handed a database id as
      // an audio source. It looked like "needs a moment to hydrate"
      // because a reload re-hydrates every completed session.
      expect(arrived!.outputs.vocal).toMatch(/^blob:/)
      expect(arrived!.outputs.instrumental).toMatch(/^blob:/)

      // And it is audio, not an empty row. Every layer above this — the
      // session list, the status, even the object URLs — is satisfied by a
      // song with nothing in it; the stored blobs are not.
      const sent = await songOn(sender)
      expect(arrived!.stemBytes.vocal).toBeGreaterThan(1000)
      expect(arrived!.stemBytes.instrumental).toBeGreaterThan(1000)
      // The sender's stems are WAV and the receiver's are AAC, so these
      // must NOT match — asserting equality here would only prove the
      // encoder had been skipped.
      expect(arrived!.stemBytes.vocal).toBeLessThan(sent!.stemBytes.vocal!)

      // Direct, not relayed. Both devices are on this machine, so a TURN
      // route here would mean the route classification is reading
      // something other than the candidate pair it settled on.
      expect(sender.logs.join('\n')).toContain('[sync] route to peer: direct')

      // ── And it is not sent a second time ───────────────────────────
      await sender.page.getByTestId('sync-song-send').click()
      await expect
        .poll(
          async () =>
            transferRow(sender, 'out').first().getAttribute('data-status'),
          { timeout: 60_000 },
        )
        .toBe('already')
    } finally {
      await sender.close()
      await receiver.close()
    }
  })
})
