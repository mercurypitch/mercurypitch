// Rewriting a shared voiceprint's social card
//
// `/mirror?v=<payload>` opens on the sender's voiceprint, but a crawler
// never runs the code that reads the payload — it reads the HTML we serve
// and nothing else. So the meta tags have to be true before any JavaScript
// exists, which means rewriting them here, per request.
//
// The payload is decoded with the same `decodeSharePayload` the app uses,
// so the worker and the app cannot disagree about what a link means.

import { formatSpan, OG_CARD_PARAM, OG_CARD_SIZE, sharedRangeNotes, sharedVoiceprintTitle, VOICEPRINT_PARAM, } from './lib/mirror/shared-voiceprint'
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

/** The card is square, and the store takes no other size. */
const CARD_SIZE = String(OG_CARD_SIZE)

/** A real voiceprint payload is ~200 characters. Anything far past that is
 *  not one, and decoding it would be base64 plus JSON.parse on unbounded
 *  attacker-controlled input, on every request to this document. */
const MAX_PAYLOAD_CHARS = 4096

/** Free text out of the payload lands in tags we publish under our own
 *  domain. HTMLRewriter escapes it, so this is not an injection — but an
 *  unfurl headline is still ours, and it should stay a short human name
 *  rather than a paragraph someone chose. */
function safeText(value: string | undefined, limit = 64): string | undefined {
  if (value == null || value === '') return undefined
  const collapsed = value.replace(/\s+/g, ' ').trim()
  if (collapsed === '') return undefined
  return collapsed.length > limit
    ? `${collapsed.slice(0, limit - 1)}…`
    : collapsed
}

function readVoiceprint(url: URL): VoiceprintShareData | null {
  const encoded = url.searchParams.get(VOICEPRINT_PARAM)
  if (encoded == null || encoded === '') return null
  if (encoded.length > MAX_PAYLOAD_CHARS) return null
  const payload = decodeSharePayload(encoded)
  if (payload == null || payload.t !== 'voiceprint') return null
  return payload.d as VoiceprintShareData
}

/** "C3 – D5 · 2 octaves + 2 semitones · accuracy 87/100" — whatever of that
 *  the take actually measured, in the order the card reads.
 *
 *  Accuracy and steadiness are the card's two scores, out of a hundred and
 *  higher is better. They are not cents: written as "±87¢" a good take reads
 *  as nearly a semitone out, which is the opposite of what it says. */
export function voiceprintDescription(data: VoiceprintShareData): string {
  const parts: string[] = []
  const range = sharedRangeNotes(data)
  if (range !== null) parts.push(range)
  const span = formatSpan(data.st)
  if (span !== null) parts.push(span)
  if (data.ac != null) parts.push(`accuracy ${Math.round(data.ac)}/100`)
  if (data.sd != null) parts.push(`steadiness ${Math.round(data.sd)}/100`)

  const measured = parts.join(' · ')
  return measured === ''
    ? 'A voiceprint, measured in cents and milliseconds.'
    : `${measured}. Meet your own voice in about a minute.`
}

/** The headline an unfurl shows above the card. */
export function voiceprintTitle(data: VoiceprintShareData): string {
  const twin = safeText(data.tw)
  const name = safeText(data.n)
  if (twin != null && twin !== '') {
    return name != null && name !== ''
      ? `${twin} is ${name}'s voice twin`
      : `${twin} is my voice twin`
  }
  return sharedVoiceprintTitle({ ...data, n: name })
}

/** Everything the social card should say for this request. */
export interface VoiceprintMeta {
  title: string
  description: string
  url: string
  /** Absolute URL of the card the link names, or null to keep the stock
   *  image — an absent `og`, or one of the wrong shape. Whether that card is
   *  still in the store is not known here: see `decorateVoiceprintMeta`. */
  image: string | null
  /** The id behind `image`, for whoever has a store to ask. */
  cardId: string | null
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

  const card = url.searchParams.get(OG_CARD_PARAM)
  const cardId = card != null && OG_ID.test(card) ? card : null
  return {
    title: voiceprintTitle(data),
    description: voiceprintDescription(data),
    url: url.toString(),
    image: cardId !== null ? `${url.origin}/api/og/card/${cardId}.jpg` : null,
    cardId,
  }
}

/**
 * Rewrite the Mirror document's social card for a shared voiceprint.
 *
 * Untouched for an absent, malformed or non-voiceprint payload — every one
 * of which should unfurl exactly as `/mirror` always has.
 *
 * `cardExists` is asked before the picture is promised. A card lasts thirty
 * days and a link lasts for ever, and an upload can still be on its way when
 * the first crawler arrives; pointing `og:image` at an address that answers
 * 404 gets an unfurl with no picture at all, where leaving the tag alone
 * gets the stock one. A store that cannot be reached counts as "no": a
 * plainer unfurl is never worth failing the page over.
 */
export async function decorateVoiceprintMeta(
  response: Response,
  url: URL,
  cardExists: (id: string) => Promise<boolean>,
): Promise<Response> {
  // Only a document that arrived whole. A 304 has no body to rewrite, and a
  // redirect or an error page is not ours to caption.
  const type = response.headers.get('Content-Type') ?? ''
  if (response.status !== 200 || !type.includes('text/html')) return response

  const found = voiceprintMetaTags(url)
  if (found === null) return response

  let stored = false
  if (found.cardId !== null) {
    try {
      stored = await cardExists(found.cardId)
    } catch {
      stored = false
    }
  }
  const meta: VoiceprintMeta = stored
    ? found
    : { ...found, image: null, cardId: null }

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
      // The document declares `summary_large_image`, which is 1.91:1. The
      // card is square, and X crops rather than letterboxes — it would take
      // a slice out of the middle and drop the portrait's head and the
      // numbers under it. A square card is a `summary` card.
      .on('meta[name="twitter:card"]', { element: set('summary') })
      .on('meta[property="og:image:width"]', { element: set(CARD_SIZE) })
      .on('meta[property="og:image:height"]', { element: set(CARD_SIZE) })
      .on('meta[property="og:image:alt"]', {
        element: set(`${meta.title} — a voiceprint card`),
      })
  }

  // The validators belong to the file on disk. What goes out is that file
  // rewritten for one link, and it changes again when the card arrives or
  // expires, so a crawler coming back must be handed the page, not a 304
  // that vouches for whichever version it kept.
  const rewritten = rewriter.transform(response)
  const headers = new Headers(rewritten.headers)
  headers.delete('ETag')
  headers.delete('Last-Modified')
  return new Response(rewritten.body, {
    status: rewritten.status,
    statusText: rewritten.statusText,
    headers,
  })
}
