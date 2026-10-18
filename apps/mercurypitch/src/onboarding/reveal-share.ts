// ============================================================
// Sharing the reveal: a line and a link through the share sheet
// ============================================================
//
// The reveal's Share (S7b beat 5) hands the system share sheet one line,
// the twin's when there is one ("Freddie Mercury is my voice twin.") and
// the range's otherwise, and the link the web's voiceprint cards use: the
// public Mirror, opened on this voiceprint (shared-voiceprint.ts), where a
// friend sees the range and the twin and can find their own.
//
// A line and a link, not the web's picture card: the native app has no
// way to hand the sheet a file it drew (that needs a file plugin), and the
// card's unfurl is stored through the web page's own origin. The link still
// opens on the right voiceprint; it unfurls with the Mirror's own picture.
//
// Where there is no share sheet (a browser, a dev build), the link goes on
// the clipboard instead, and the screen says so.

import type { SharePayload } from '@irchiinnuss/mobile-runtime/platform'
import { sharePayload } from '@irchiinnuss/mobile-runtime/platform'
import type { RangeResult } from '@/lib/mirror/metrics'
import { voiceprintShareUrl } from '@/lib/mirror/shared-voiceprint'
import { ONBOARDING_COPY, rangeWords, shareLine } from './onboarding-copy'

export type ShareResult = 'shared' | 'copied' | 'failed'

export interface ShareWays {
  /** The share sheet: true once it was shown, dismissed or not. */
  readonly sheet: (payload: SharePayload) => Promise<boolean>
  /** The clipboard: true once the text is on it. */
  readonly copy: (text: string) => Promise<boolean>
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const DEVICE_WAYS: ShareWays = { sheet: sharePayload, copy: copyText }

/** What the sheet is handed for this range and twin. */
export function revealPayload(
  range: RangeResult,
  twin: string | null,
): Required<Pick<SharePayload, 'title' | 'text' | 'url'>> {
  return {
    title: ONBOARDING_COPY.shareTitle,
    text: shareLine(twin, rangeWords(range.lowNote, range.highNote)),
    url: voiceprintShareUrl(
      {
        lowMidi: range.lowMidi,
        highMidi: range.highMidi,
        semitones: range.semitones,
      },
      twin,
    ),
  }
}

/** Share the voiceprint: the sheet, else the link on the clipboard. */
export async function shareReveal(
  range: RangeResult,
  twin: string | null,
  ways: ShareWays = DEVICE_WAYS,
): Promise<ShareResult> {
  const payload = revealPayload(range, twin)
  if (await ways.sheet(payload)) return 'shared'
  return (await ways.copy(payload.url)) ? 'copied' : 'failed'
}
