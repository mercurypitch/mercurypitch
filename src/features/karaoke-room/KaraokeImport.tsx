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
// With no songs left the button shows the gate instead of the picker, from
// what /me last said, so the picker still opens inside the tap that asked
// for it: the paywall without a subscription (D5 A, a sheet over the room),
// the date the songs come back with one. The server's own admission is the
// last word either way; a refusal there reaches the same gate through the
// queue (setImportGateHandler).
//
// Copy (owner, 27 and 28 Sep): songs, never credits; the singer is asked to
// open the app within about a day to collect a song, which is what the
// stems' R2 lifecycle keeps (collectLine, STEMS_KEPT_DAYS), and nothing
// longer is promised. Subscribe fails closed where the build has no store
// or the store has no product yet.
//
// The paywall is the one place the app offers Mercury Pitch Cloud (S7 D2,
// D13: onboarding will offer this same sheet). It names the subscription,
// its length and the store's own price in the singer's storefront, with
// Restore purchases, Terms of Use and the Privacy Policy (App Store 3.1.2).
// After the store says yes, the songs arrive when RevenueCat's webhook
// reaches the server, usually within seconds: until then the room says they
// are on their way rather than showing the paywall again.

import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, For, Match, on, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import { hasUpgradedAccount } from '@/db/services/auth-service'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
import { balanceVersion } from '@/stores/billing-store'
import type { KaraokeOffer } from '@/stores/native-shell-store'
import { nativeShellApi } from '@/stores/native-shell-store'
import type { ImportRefusal } from './karaoke-import-checks'
import { checkImport, IMPORT_ACCEPT, songTitleOf, } from './karaoke-import-checks'
import { duplicateOf, enqueueImports, setImportGateHandler, } from './karaoke-import-queue'
import styles from './karaoke-room.module.css'
import type { KaraokeSongs } from './karaoke-songs'
import { awaitSubscription, CLOUD_NAME, collectLine, confirmCostLine, importLine, karaokeSongs, refreshKaraokeSongs, restoreNote, songsComeBackLine, songsOnTheWay, } from './karaoke-songs'

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
  | { readonly kind: 'paywall' }
  | { readonly kind: 'subscribed' }

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

const CheckGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M5.5 12.5l4 4 9-9" />
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

const PAYWALL_LINES = [
  'Any song from Files on this phone',
  'Voice and music separated on our server',
  'Your songs stay on this phone and play offline',
] as const

export const KaraokeImport: Component = () => {
  let input: HTMLInputElement | undefined
  const [sheet, setSheet] = createSignal<ImportSheet | null>(null)
  const [checking, setChecking] = createSignal(false)
  const [sending, setSending] = createSignal(false)
  const [note, setNote] = createSignal<string | null>(null)
  const [offer, setOffer] = createSignal<KaraokeOffer | null>(null)

  const close = (): void => {
    setSheet(null)
    setNote(null)
  }

  const openGate = (songs: KaraokeSongs): void => {
    setNote(null)
    if (songs.subscribed) setSheet({ kind: 'no-songs' })
    else if (songsOnTheWay()) setSheet({ kind: 'subscribed' })
    else setSheet({ kind: 'paywall' })
  }

  // The paywall states the store's own price; asked for once it opens.
  createEffect(
    on(
      () => sheet()?.kind === 'paywall',
      (paywall) => {
        if (!paywall || offer() !== null) return
        const ask = nativeShellApi()?.karaokeSubscription?.offer
        void ask?.()
          .then((found) => {
            if (found !== null) setOffer(found)
          })
          .catch(() => undefined)
      },
    ),
  )
  const planLine = (): string => {
    const month = `${karaokeSongs().perPeriod} songs a month`
    const price = offer()?.priceText
    return price === undefined ? month : `${month} · ${price}`
  }
  const waitForSongs = (): Promise<KaraokeSongs> =>
    awaitSubscription(async () => refreshKaraokeSongs({ identify: true }))
  /** What the subscribed sheet says of the songs: here, or coming. */
  const songsArrival = (): string => {
    if (karaokeSongs().subscribed) {
      return `${karaokeSongs().perPeriod} songs a month are yours.`
    }
    return songsOnTheWay()
      ? 'Your songs are on their way. They arrive in a moment.'
      : 'Your songs arrive within a few minutes.'
  }

  onMount(() => {
    void refreshKaraokeSongs()
    onCleanup(setImportGateHandler(openGate))
  })
  // A purchase, a refund or a finished song changes what is left.
  createEffect(
    on(
      balanceVersion,
      () => {
        void refreshKaraokeSongs()
      },
      { defer: true },
    ),
  )

  const choose = (): void => {
    const songs = karaokeSongs()
    if (songs.left === 0) {
      openGate(songs)
      return
    }
    if (input === undefined) return
    input.value = ''
    input.click()
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

  const subscribe = async (): Promise<void> => {
    const api = nativeShellApi()?.karaokeSubscription
    const outcome =
      api === undefined
        ? 'unavailable'
        : await api.subscribe().catch(() => 'failed' as const)
    switch (outcome) {
      case 'purchased':
        setNote(null)
        setSheet({ kind: 'subscribed' })
        await waitForSongs()
        return
      case 'pending':
        setNote(
          'The purchase is waiting for approval. The songs arrive once it is approved.',
        )
        return
      case 'cancelled':
        setNote(null)
        return
      case 'unavailable':
        setNote('Subscriptions are not available yet.')
        return
      case 'failed':
        setNote(
          'The store could not complete the purchase. Try again in a moment.',
        )
    }
  }

  const restore = async (): Promise<void> => {
    const api = nativeShellApi()?.karaokeSubscription
    const outcome =
      api === undefined
        ? 'unavailable'
        : await api.restore().catch(() => 'failed' as const)
    if (outcome === 'restored') {
      setNote(restoreNote(outcome))
      const songs = await waitForSongs()
      // The singer may have closed the paywall while the songs were asked
      // for; nothing opens by itself.
      if (sheet()?.kind !== 'paywall') return
      if (songs.subscribed) close()
      else setSheet({ kind: 'subscribed' })
      return
    }
    setNote(restoreNote(outcome))
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

  const Note = (): JSX.Element => (
    <Show when={note()}>
      {(text) => (
        <p class={styles.sheetNote} role="status">
          {text()}
        </p>
      )}
    </Show>
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
      case 'paywall':
        return 'Sing your own songs'
      case 'subscribed':
        return "You're subscribed"
    }
  }

  return (
    <div class={styles.importBlock} data-testid="karaoke-import">
      <button
        type="button"
        class={styles.importButton}
        disabled={checking()}
        aria-busy={checking() ? 'true' : undefined}
        onClick={choose}
      >
        <span class={styles.importGlyph} aria-hidden="true">
          <PlusGlyph />
        </span>
        Import a song
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
              <p class={styles.sheetText}>
                {songsComeBackLine(karaokeSongs())}
              </p>
              <p class={styles.sheetText}>
                The songs you imported stay on this phone and still play.
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
            <Match when={sheet()?.kind === 'paywall'}>
              <SheetHead title="Sing your own songs" closeLabel="Later" />
              <ul class={styles.paywallLines}>
                <For each={PAYWALL_LINES}>
                  {(line) => (
                    <li>
                      <span class={styles.paywallGlyph} aria-hidden="true">
                        <CheckGlyph />
                      </span>
                      <span>{line}</span>
                    </li>
                  )}
                </For>
              </ul>
              <p class={styles.paywallPrice}>{planLine()}</p>
              <p class={styles.sheetText}>
                {`${CLOUD_NAME}, monthly. Renews every month until you cancel. Cancel any time in Settings.`}
              </p>
              <Note />
              <div class={styles.sheetActions}>
                <button
                  type="button"
                  class={styles.primaryButton}
                  onClick={() => void subscribe()}
                >
                  Subscribe
                </button>
                <button
                  type="button"
                  class={styles.secondaryButton}
                  onClick={() => void restore()}
                >
                  Restore purchases
                </button>
              </div>
              <p class={styles.paywallLinks}>
                <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
                  Terms of Use
                </a>
                <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
              </p>
            </Match>
            <Match when={sheet()?.kind === 'subscribed'}>
              <SheetHead title="You're subscribed" />
              <p class={styles.sheetText}>
                {`${songsArrival()}${hasUpgradedAccount() ? '' : ' Keep them with an account, so your subscription and your songs follow you to a new phone.'}`}
              </p>
              <div class={styles.sheetActions}>
                <Show when={!hasUpgradedAccount()}>
                  <button
                    type="button"
                    class={styles.primaryButton}
                    onClick={() => {
                      close()
                      nativeShellApi()?.openSignIn?.()
                    }}
                  >
                    Sign in
                  </button>
                </Show>
                <button
                  type="button"
                  class={styles.secondaryButton}
                  onClick={close}
                >
                  {hasUpgradedAccount() ? 'Done' : 'Later'}
                </button>
              </div>
            </Match>
          </Switch>
        </div>
      </Sheet>
    </div>
  )
}
