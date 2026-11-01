// ============================================================
// Find by singing: the room listens, and the song joins you
// ============================================================
//
// Opened from the Songs sheet. The singer sings a bit of a song, any part,
// in any octave, and the room's library is matched as they sing: the web's
// Mercury Sing engine (mercury-sing-engine.ts) with the room's own host
// (karaoke-room-find.ts). The closest songs come up as rows. When one is
// clearly it, the room cues it where the singer has got to and this sheet
// goes; a tap on a row does that at once. Until something matches, the
// songs listened for are the rows, and a tap opens one from the top.
//
// The engine lives only while the sheet is open, and is loaded when it
// first opens (KaraokeFindListening.tsx): the mic is opened as the sheet
// comes up and let go as it goes. The room stops its own song before
// opening this, or its sound would be matched.

import type { JSX } from 'solid-js'
import { createSignal, lazy, Show, Suspense } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import styles from './karaoke-room.module.css'
import type { MercurySingHost } from './karaoke-room-find'
import { FIND_STATUS } from './karaoke-room-find'
import { CloseGlyph, SingFindGlyph } from './karaoke-room-glyphs'

/** The listening itself, loaded when the sheet first opens. */
const Listening = lazy(() =>
  import('./KaraokeFindListening').then((m) => ({
    default: m.KaraokeFindListening,
  })),
)

export interface KaraokeFindSheetProps {
  isOpen: boolean
  close: () => void
  host: MercurySingHost
}

export function KaraokeFindSheet(props: KaraokeFindSheetProps): JSX.Element {
  // Each listening is its own mount: Listen again counts on, and a new
  // engine opens the mic afresh.
  const [round, setRound] = createSignal(1)
  return (
    <Sheet
      isOpen={props.isOpen}
      close={() => props.close()}
      ariaLabel="Find by singing"
    >
      <div class={styles.library} data-testid="karaoke-find">
        <div class={styles.sheetHead}>
          <h2 class={styles.sheetTitle}>
            <span class={styles.findTitleGlyph} aria-hidden="true">
              <SingFindGlyph />
            </span>
            Find by singing
          </h2>
          <button
            type="button"
            class={styles.sheetClose}
            aria-label="Close"
            onClick={() => props.close()}
            data-testid="karaoke-find-close"
          >
            <CloseGlyph />
          </button>
        </div>
        <Show when={props.isOpen && round()} keyed>
          {(listening) => (
            <Suspense
              fallback={<p class={styles.findStatus}>{FIND_STATUS.starting}</p>}
            >
              <Listening
                host={props.host}
                again={() => setRound(listening + 1)}
              />
            </Suspense>
          )}
        </Show>
      </div>
    </Sheet>
  )
}
