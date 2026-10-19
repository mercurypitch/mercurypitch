// ============================================================
// Import a song (plan S8 §6.1, §6.2, §6.7): the button and its sheets
// ============================================================
//
// The button hands the phone's own document picker a file input: WKWebView
// and the Android bridge both present `<input type="file">` as the system
// picker, so nothing native is needed to pick. What is picked is checked on
// the phone (karaoke-import-checks.ts), and the singer is asked once, for
// all of it, before anything is sent: what it uses, what goes where, and how
// long to keep the app open. The queue does the rest.
//
// IMPORT ASKS BEFORE IT OPENS FILES (S7b §0 point 6, §4.3). What the tap
// does is decided inside it, from what /me last said and the token on the
// phone (import-gate.ts), so the picker still opens inside the tap that
// asked for it. With songs to use, Files at once, and a chip that says how
// many; a subscriber with none left is told when the next ones come; anyone
// else meets the Cloud offer (CloudOffer.tsx, which the native shell draws
// once). A fresh install opens the offer, not the picker: it holds no songs.
// The server's own admission is the last word either way; a refusal there
// reaches the same gate through the queue (setImportGateHandler).
//
// Before it offers the subscription the gate asks again (cloud-offer-store
// askBeforeOffering): it makes the singer's identity, then asks the server
// and the store, which knows of a purchase first. A subscriber whose songs
// the server has not heard of yet is told they are coming (S7 §3.9, the more
// generous of the two), and is never offered what they bought.
//
// Copy (owner, 27 and 28 Sep): songs, never credits; the singer is asked to
// open the app within about a day to collect a song, which is what the
// stems' R2 lifecycle keeps (collectLine, STEMS_KEPT_DAYS), and nothing
// longer is promised.

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, Match, on, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import { accountHeld, hasUpgradedAccount, hasValidToken, } from '@/db/services/auth-service'
import { trackEvent } from '@/lib/analytics'
import { thisDeviceLower } from '@/lib/device-noun'
import { balanceVersion } from '@/stores/billing-store'
import { IMPORT_TAP_EVENT } from './cloud-measure'
import { askBeforeOffering, openCloudOffer } from './cloud-offer-store'
import type { ImportWho } from './import-gate'
import { importAction, importState } from './import-gate'
import type { ImportRefusal } from './karaoke-import-checks'
import { checkImport, IMPORT_ACCEPT, songTitleOf, } from './karaoke-import-checks'
import { duplicateOf, enqueueImports, setImportGateHandler, } from './karaoke-import-queue'
import styles from './karaoke-room.module.css'
import type { KaraokeSongs } from './karaoke-songs'
import { collectLine, confirmCostLine, importChip, importLine, karaokeSongs, noSongsLeftLine, refreshKaraokeSongs, songsOnTheWay, } from './karaoke-songs'

/** A song left out of a confirm, and why. */
interface LeftOut {
  readonly title: string
  readonly why: string
}

type ImportSheet =
  | {
      readonly kind: 'confirm'
      readonly files: readonly File[]
      readonly leftOut: readonly LeftOut[]
    }
  | { readonly kind: 'refused'; readonly refusal: ImportRefusal }
  | { readonly kind: 'no-songs' }

/**
 * A phone's upload, for the estimate the confirm sheet gives. A guess on the
 * slow side: the sentence is there so nobody pockets the phone mid-send.
 */
const UPLOAD_BYTES_PER_SECOND = 1024 * 1024

/** "about half a minute", from the bytes to send. */
export function sendEstimate(bytes: number): string {
  const seconds = bytes / UPLOAD_BYTES_PER_SECOND
  if (seconds <= 40) return 'about half a minute'
  if (seconds <= 90) return 'about a minute'
  return `about ${Math.round(seconds / 60)} minutes`
}

const PlusGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
)

const CloseGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
)

/** What the phone knows of the singer, read inside the tap. */
function who(): ImportWho {
  return { token: hasValidToken(), account: hasUpgradedAccount() }
}

export const KaraokeImport: Component = () => {
  let input: HTMLInputElement | undefined
  const [sheet, setSheet] = createSignal<ImportSheet | null>(null)
  const [checking, setChecking] = createSignal(false)
  const [sending, setSending] = createSignal(false)
  const [asking, setAsking] = createSignal(false)

  const close = (): void => {
    setSheet(null)
  }

  const openPicker = (): void => {
    if (input === undefined) return
    input.value = ''
    input.click()
  }

  // The latest offer asked for is the one that decides, should two overlap.
  let offers = 0
  /**
   * The offer, once the server and the store have been asked. `refused`:
   * the server has just turned a song away for want of songs (the queue).
   */
  const offer = (refused = false): void => {
    if (songsOnTheWay()) {
      openCloudOffer('import', 'subscribed')
      return
    }
    offers += 1
    const mine = offers
    setAsking(true)
    void askBeforeOffering().then(({ songs, storeHolds }) => {
      if (mine !== offers) return
      setAsking(false)
      if (storeHolds) {
        openCloudOffer('import', 'subscribed')
        return
      }
      // The server's fresh word decides again: songs to use after all, or a
      // subscriber's month that is used.
      switch (importAction(importState(songs, who()))) {
        case 'files':
          // Songs after all. A song the server turned away waits in the
          // queue, which sends it again by itself. A tap's picker: outside
          // the tap a phone may not open it, and then the next tap does,
          // from what is known now.
          if (!refused) openPicker()
          return
        case 'note':
          setSheet({ kind: 'no-songs' })
          return
        case 'offer':
          openCloudOffer('import')
      }
    })
  }

  /** No songs left at the server's word: the note, or the offer. */
  const openGate = (songs: KaraokeSongs): void => {
    if (songs.subscribed) setSheet({ kind: 'no-songs' })
    else offer(true)
  }

  onMount(() => {
    void refreshKaraokeSongs()
    onCleanup(setImportGateHandler(openGate))
  })
  // A purchase, a refund or a finished song changes what is left, and so
  // does an account: signing in brings the month's free song.
  createEffect(
    on(
      [balanceVersion, accountHeld],
      () => {
        void refreshKaraokeSongs()
      },
      { defer: true },
    ),
  )

  const choose = (): void => {
    const state = importState(karaokeSongs(), who())
    trackEvent(IMPORT_TAP_EVENT[state])
    switch (importAction(state)) {
      case 'files':
        openPicker()
        return
      case 'note':
        setSheet({ kind: 'no-songs' })
        return
      case 'offer':
        offer()
    }
  }

  const picked = async (files: readonly File[]): Promise<void> => {
    if (files.length === 0) return
    setChecking(true)
    try {
      const passed: File[] = []
      const leftOut: LeftOut[] = []
      let firstRefusal: ImportRefusal | null = null
      for (const file of files) {
        const refusal = duplicateOf(file) ?? (await checkImport(file))
        if (refusal === null) {
          passed.push(file)
        } else {
          firstRefusal ??= refusal
          leftOut.push({ title: songTitleOf(file), why: refusal.title })
        }
      }
      if (passed.length === 0) {
        if (firstRefusal !== null) {
          setSheet({ kind: 'refused', refusal: firstRefusal })
        }
        return
      }
      // What the server says now, and an identity to send with.
      const songs = await refreshKaraokeSongs({ identify: true })
      if (songs.left === 0) {
        openGate(songs)
        return
      }
      const room = songs.left ?? passed.length
      for (const file of passed.slice(room)) {
        leftOut.push({ title: songTitleOf(file), why: 'No songs left for it' })
      }
      setSheet({ kind: 'confirm', files: passed.slice(0, room), leftOut })
    } finally {
      setChecking(false)
    }
  }

  const separate = async (files: readonly File[]): Promise<void> => {
    setSending(true)
    try {
      const result = await enqueueImports(files)
      if (result.queued.length > 0) trackEvent('import_sent')
      const first = result.refused[0]
      if (first !== undefined) {
        setSheet({ kind: 'refused', refusal: first.refusal })
        return
      }
      close()
    } finally {
      setSending(false)
    }
  }

  const SheetHead: Component<{ title: string; closeLabel?: string }> = (
    head,
  ) => (
    <div class={styles.sheetHead}>
      <h2 class={styles.sheetTitle}>{head.title}</h2>
      <button
        type="button"
        class={styles.sheetClose}
        aria-label={head.closeLabel ?? 'Close'}
        onClick={close}
      >
        <CloseGlyph />
      </button>
    </div>
  )

  const confirming = () => {
    const open = sheet()
    return open?.kind === 'confirm' ? open : null
  }
  const refusing = () => {
    const open = sheet()
    return open?.kind === 'refused' ? open : null
  }

  const confirmTitle = (count: number): string =>
    count === 1 ? 'Separate this song?' : `Separate ${count} songs?`

  const sheetLabel = (): string => {
    const open = sheet()
    if (open === null) return ''
    switch (open.kind) {
      case 'confirm':
        return confirmTitle(open.files.length)
      case 'refused':
        return open.refusal.title
      case 'no-songs':
        return 'No songs left this month'
    }
  }

  return (
    <div class={styles.importBlock} data-testid="karaoke-import">
      <button
        type="button"
        class={styles.importButton}
        disabled={checking() || asking()}
        aria-busy={checking() || asking() ? 'true' : undefined}
        onClick={choose}
      >
        <span class={styles.importGlyph} aria-hidden="true">
          <PlusGlyph />
        </span>
        <span class={styles.importText}>
          <span class={styles.importLabel}>Import a song</span>
          <Show when={importChip(karaokeSongs())}>
            {(chip) => (
              <>
                {' '}
                <span
                  class={styles.importChip}
                  data-testid="karaoke-import-chip"
                >
                  {chip()}
                </span>
              </>
            )}
          </Show>
        </span>
      </button>
      <p class={styles.importLine}>{importLine(karaokeSongs())}</p>
      <input
        ref={(element) => {
          input = element
        }}
        type="file"
        accept={IMPORT_ACCEPT}
        multiple
        hidden
        data-testid="karaoke-import-input"
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])]
          void picked(files)
        }}
      />

      <Sheet
        isOpen={sheet() !== null}
        close={close}
        ariaLabel={sheetLabel()}
        class={styles.importPanel}
      >
        <div class={styles.importSheet} data-testid="karaoke-import-sheet">
          <Switch>
            <Match when={confirming()}>
              {(open) => {
                const count = (): number => open().files.length
                const bytes = (): number =>
                  open().files.reduce((sum, file) => sum + file.size, 0)
                const them = (one: string, many: string): string =>
                  count() === 1 ? one : many
                return (
                  <>
                    <SheetHead title={confirmTitle(count())} />
                    <ul class={styles.sheetList}>
                      <For each={open().files}>
                        {(file) => <li>{songTitleOf(file)}</li>}
                      </For>
                    </ul>
                    <p class={styles.sheetText}>
                      {confirmCostLine(karaokeSongs(), count())}
                    </p>
                    <p class={styles.sheetText}>
                      {`Sends: ${them('this song', 'these songs')} to our server, which splits ${them('it', 'them')} into voice and music.`}
                    </p>
                    <p class={styles.sheetText}>{collectLine(count())}</p>
                    <p class={styles.sheetText}>
                      {`Keep Mercury Pitch open while ${them('it is', 'they are')} sent, ${sendEstimate(bytes())}. The separating carries on if you leave.`}
                    </p>
                    <Show when={open().leftOut.length > 0}>
                      <ul class={styles.leftOut}>
                        <For each={open().leftOut}>
                          {(entry) => (
                            <li>{`Left out: ${entry.title}. ${entry.why}.`}</li>
                          )}
                        </For>
                      </ul>
                    </Show>
                    <div class={styles.sheetActions}>
                      <button
                        type="button"
                        class={styles.primaryButton}
                        disabled={sending()}
                        onClick={() => void separate(open().files)}
                      >
                        Separate
                      </button>
                      <button
                        type="button"
                        class={styles.secondaryButton}
                        onClick={close}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )
              }}
            </Match>
            <Match when={refusing()}>
              {(open) => (
                <>
                  <SheetHead title={open().refusal.title} />
                  <p class={styles.sheetText}>{open().refusal.body}</p>
                  <div class={styles.sheetActions}>
                    <button
                      type="button"
                      class={styles.primaryButton}
                      onClick={close}
                    >
                      OK
                    </button>
                  </div>
                </>
              )}
            </Match>
            <Match when={sheet()?.kind === 'no-songs'}>
              <SheetHead title="No songs left this month" />
              <p class={styles.sheetText}>{noSongsLeftLine(karaokeSongs())}</p>
              <p class={styles.sheetText}>
                The songs you imported stay on {thisDeviceLower()} and still
                play.
              </p>
              <div class={styles.sheetActions}>
                <button
                  type="button"
                  class={styles.primaryButton}
                  onClick={close}
                >
                  OK
                </button>
              </div>
            </Match>
          </Switch>
        </div>
      </Sheet>
    </div>
  )
}
