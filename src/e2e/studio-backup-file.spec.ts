// Studio backup files — a backup streams into the file the person picks, from the song panel and the song list; a cancelled picker leaves nothing behind; without a picker it downloads.
import { expect, test, type Page } from '@playwright/test'
import { unzipSync } from 'fflate'
import { readFile } from 'node:fs/promises'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

type Picker = 'file' | 'cancel' | 'none'

/**
 * Headless Chromium has the save picker but cancels it at once. A picked file
 * here is a real file all the same: one in the origin private file system,
 * written through the same writable stream a file on disk gets.
 */
async function usePicker(page: Page, picker: Picker): Promise<void> {
  await page.addInitScript((mode: Picker) => {
    const host = window as unknown as {
      showSaveFilePicker?: unknown
      __pickerCalls: number
    }
    host.__pickerCalls = 0
    host.showSaveFilePicker =
      mode === 'none'
        ? undefined
        : async (options: { suggestedName: string }) => {
            host.__pickerCalls++
            if (mode === 'cancel')
              throw new DOMException(
                'The user aborted a request.',
                'AbortError',
              )
            const root = await navigator.storage.getDirectory()
            const folder = await root.getDirectoryHandle('picked', {
              create: true,
            })
            return folder.getFileHandle(options.suggestedName, { create: true })
          }
  }, picker)
}

/** Every file in the origin private file system, by path, with its size. */
async function privateFiles(page: Page): Promise<Record<string, number>> {
  return page.evaluate(async () => {
    const files: Record<string, number> = {}
    const walk = async (folder: FileSystemDirectoryHandle, path: string) => {
      const entries = (
        folder as unknown as {
          entries(): AsyncIterable<[string, FileSystemHandle]>
        }
      ).entries()
      for await (const [name, handle] of entries) {
        if (handle.kind === 'directory')
          await walk(handle as FileSystemDirectoryHandle, `${path}${name}/`)
        else
          files[`${path}${name}`] = (
            await (handle as FileSystemFileHandle).getFile()
          ).size
      }
    }
    await walk(await navigator.storage.getDirectory(), '')
    return files
  })
}

async function pickedBytes(page: Page, name: string): Promise<Uint8Array> {
  const bytes = await page.evaluate(async (file) => {
    const root = await navigator.storage.getDirectory()
    const folder = await root.getDirectoryHandle('picked')
    const handle = await folder.getFileHandle(file)
    return Array.from(
      new Uint8Array(await (await handle.getFile()).arrayBuffer()),
    )
  }, name)
  return Uint8Array.from(bytes)
}

/** A backup's file is named after the song and the minute it was made. */
const WINDOW_SEAT_FILE = /^Window seat \d{4}-\d{2}-\d{2} \d{4}\.mpstudio$/
const WINDOW_SEAT_SAVED =
  /^Backup saved as (Window seat \d{4}-\d{2}-\d{2} \d{4}\.mpstudio)\.$/

/** The file a "Backup saved as" status names. */
function savedFile(status: string | null): string {
  const name = WINDOW_SEAT_SAVED.exec(status ?? '')?.[1]
  if (name === undefined) throw new Error(`No backup file in: ${status}`)
  return name
}

/** A backup holds the song and its one take: original and canonical audio. */
function expectBackup(bytes: Uint8Array, title: string): void {
  const entries = unzipSync(bytes)
  expect(Object.keys(entries)).toEqual([
    'manifest.json',
    'assets/0/original.bin',
    'assets/0/canonical.pcm',
  ])
  const manifest = JSON.parse(
    new TextDecoder().decode(entries['manifest.json']),
  )
  expect(manifest.project.title).toBe(title)
  expect(entries['assets/0/canonical.pcm'].byteLength).toBe(
    manifest.assets[0].asset.canonicalPcmByteLength,
  )
}

async function namedSong(page: Page, title: string): Promise<void> {
  await openArrangement(page)
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Song options' }).click()
  const name = studio.getByRole('textbox', { name: 'Project name' })
  await name.fill(title)
  await name.press('Tab')
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible()
}

test.describe('Studio backup files', () => {
  test('saves a backup into the picked file from the song panel and the song list, with no download', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const downloads: string[] = []
    page.on('download', (download) =>
      downloads.push(download.suggestedFilename()),
    )
    await usePicker(page, 'file')
    await namedSong(page, 'Window seat')
    const studio = studioRegion(page)

    const saved = studio
      .getByRole('status')
      .filter({ hasText: 'Backup saved as' })
    await studio
      .getByRole('button', { name: 'Save project backup', exact: true })
      .click()
    await expect(saved).toHaveText(WINDOW_SEAT_SAVED)
    const first = savedFile(await saved.textContent())
    expectBackup(await pickedBytes(page, first), 'Window seat')

    await studio.getByRole('button', { name: 'All songs' }).click()
    await studio
      .getByRole('button', {
        name: 'Save a backup of Window seat',
        exact: true,
      })
      .click()
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __pickerCalls: number }).__pickerCalls,
        ),
      )
      .toBe(2)
    await expect(saved).toHaveText(WINDOW_SEAT_SAVED)
    const second = savedFile(await saved.textContent())
    expectBackup(await pickedBytes(page, second), 'Window seat')
    // Nothing went through downloads, and no private copy was made: only the
    // picked files, one each, or the one again when both fell in a minute.
    expect(downloads).toEqual([])
    expect(Object.keys(await privateFiles(page)).sort()).toEqual(
      [...new Set([first, second])].map((name) => `picked/${name}`).sort(),
    )
  })

  test('leaves nothing behind when the picker is cancelled', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const downloads: string[] = []
    page.on('download', (download) =>
      downloads.push(download.suggestedFilename()),
    )
    await usePicker(page, 'cancel')
    await namedSong(page, 'Window seat')
    const studio = studioRegion(page)
    const save = studio.getByRole('button', {
      name: 'Save project backup',
      exact: true,
    })

    await save.click()
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __pickerCalls: number }).__pickerCalls,
        ),
      )
      .toBe(1)
    await expect(save).toBeEnabled()
    await expect(studio.getByRole('alert')).toHaveCount(0)
    await expect(studio.getByText(/^Backup saved as/)).toHaveCount(0)
    expect(await privateFiles(page)).toEqual({})
    expect(downloads).toEqual([])
  })

  test('downloads the backup from the song list where the browser has no save picker', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000)
    await usePicker(page, 'none')
    await namedSong(page, 'Window seat')
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'All songs' }).click()

    const downloading = page.waitForEvent('download')
    await studio
      .getByRole('button', {
        name: 'Save a backup of Window seat',
        exact: true,
      })
      .click()
    const download = await downloading
    expect(download.suggestedFilename()).toMatch(WINDOW_SEAT_FILE)
    const path = testInfo.outputPath('window-seat.mpstudio')
    await download.saveAs(path)
    expectBackup(new Uint8Array(await readFile(path)), 'Window seat')
    // The copy it downloaded from is a private file, not one in memory.
    const copies = Object.keys(await privateFiles(page))
    expect(copies).toHaveLength(1)
    expect(copies[0]).toMatch(/^studio-backups\/[0-9a-f-]{36}\.mpstudio$/)
  })
})
