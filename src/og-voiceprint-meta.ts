// Rewriting a shared voiceprint's social card
//
// `/mirror?v=<payload>` opens on the sender's voiceprint, but a crawler
// never runs the code that reads the payload — it reads the HTML we serve
// and nothing else. So the meta tags have to be true before any JavaScript
// exists, which means rewriting them here, per request.
//
// The payload is decoded with the same `decodeSharePayload` the app uses,
// so the worker and the app cannot disagree about what a link means.

import { formatSpan, sharedRangeNotes, sharedVoiceprintTitle, } from './lib/mirror/shared-voiceprint'
import type { VoiceprintShareData } from './lib/share-codec'
import { decodeSharePayload } from './lib/share-codec'

// `HTMLRewriter` is a Workers runtime global with no value export, and the
// repo takes Cloudflare types as `import type` only. Declaring just the
// surface used here keeps that convention and documents the dependency.
interface RewriterElement {
  setAttribute(name: string, value: string): void
  setInnerContent(content: string): void
}
interface Rewriter {
  on(
    selector: string,
    handlers: { element(element: RewriterElement): void },
  ): Rewriter
  transform(response: Response): Response
}
declare const HTMLRewriter: { new (): Rewriter }

/** The card is square — the app draws 1080x1080 and that is what we store. */
const CARD_SIZE = '1080'

function readVoiceprint(url: URL): VoiceprintShareData | null {
  const encoded = url.searchParams.get('v')
  if (encoded == null || encoded === '') return null
  const payload = decodeSharePayload(encoded)
  if (payload == null || payload.t !== 'voiceprint') return null
  return payload.d as VoiceprintShareData
}

/** "C3 – D5 · 2 octaves + 2 semitones · accuracy ±12¢" — whatever of that
 *  the take actually measured, in the order the card reads. */
export function voiceprintDescription(data: VoiceprintShareData): string {
  const parts: string[] = []
  const range = sharedRangeNotes(data)
  if (range !== null) parts.push(range)
  const span = formatSpan(data.st)
  if (span !== null) parts.push(span)
  if (data.ac != null) parts.push(`accuracy ±${data.ac}¢`)
  if (data.sd != null) parts.push(`steadiness ±${data.sd}¢`)

  const measured = parts.join(' · ')
  return measured === ''
    ? 'A voiceprint, measured in cents and milliseconds.'
    : `${measured}. Meet your own voice in about a minute.`
}

/** The headline an unfurl shows above the card. */
export function voiceprintTitle(data: VoiceprintShareData): string {
  const twin = data.tw
  const name = data.n
  if (twin != null && twin !== '') {
    return name != null && name !== ''
      ? `${twin} is ${name}'s voice twin`
      : `${twin} is my voice twin`
  }
  return sharedVoiceprintTitle(data)
}

/** Everything the social card should say for this request. */
export interface VoiceprintMeta {
  title: string
  description: string
  url: string
  /** Absolute URL of the sender's stored card, or null to keep the stock
   *  image — an absent `og`, a malformed one, or a card that has expired. */
  image: string | null
}

const OG_ID = /^[0-9A-Za-z]{10}$/

/**
 * What the tags should become for this URL, or null to leave the document
 * alone. Pure, and where all the judgement lives — `decorateVoiceprintMeta`
 * below is only the plumbing that writes these onto the response.
 */
export function voiceprintMetaTags(url: URL): VoiceprintMeta | null {
  const data = readVoiceprint(url)
  if (data === null) return null

  const card = url.searchParams.get('og')
  return {
    title: voiceprintTitle(data),
    description: voiceprintDescription(data),
    url: url.toString(),
    image:
      card != null && OG_ID.test(card)
        ? `${url.origin}/api/og/card/${card}.png`
        : null,
  }
}

/**
 * Rewrite the Mirror document's social card for a shared voiceprint.
 *
 * Untouched for an absent, malformed or non-voiceprint payload — every one
 * of which should unfurl exactly as `/mirror` always has.
 */
export function decorateVoiceprintMeta(response: Response, url: URL): Response {
  const meta = voiceprintMetaTags(url)
  if (meta === null) return response

  const set =
    (value: string) =>
    (element: RewriterElement): void => {
      element.setAttribute('content', value)
    }

  let rewriter = new HTMLRewriter()
    .on('meta[property="og:title"]', { element: set(meta.title) })
    .on('meta[name="twitter:title"]', { element: set(meta.title) })
    .on('meta[property="og:description"]', { element: set(meta.description) })
    .on('meta[name="description"]', { element: set(meta.description) })
    .on('meta[name="twitter:description"]', { element: set(meta.description) })
    .on('meta[property="og:url"]', { element: set(meta.url) })
    .on('title', {
      element(element: RewriterElement) {
        element.setInnerContent(`${meta.title} — MercuryPitch`)
      },
    })

  if (meta.image !== null) {
    const image = meta.image
    rewriter = rewriter
      .on('meta[property="og:image"]', { element: set(image) })
      .on('meta[name="twitter:image"]', { element: set(image) })
      .on('meta[property="og:image:width"]', { element: set(CARD_SIZE) })
      .on('meta[property="og:image:height"]', { element: set(CARD_SIZE) })
      .on('meta[property="og:image:alt"]', {
        element: set(`${meta.title} — a voiceprint card`),
      })
  }

  return rewriter.transform(response)
}
