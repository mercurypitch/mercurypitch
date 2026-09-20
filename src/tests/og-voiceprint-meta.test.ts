import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { decorateVoiceprintMeta, voiceprintDescription, voiceprintMetaTags, voiceprintTitle, } from '@/og-voiceprint-meta'

// `ac` and `sd` are the card's two scores, out of a hundred and higher is
// better. They are not cents.
const FULL = { lo: 48, hi: 74, st: 26, ac: 87, sd: 92, tw: 'Freddie Mercury' }

describe('voiceprintTitle', () => {
  it('leads with the twin, because that is the interesting part', () => {
    expect(voiceprintTitle(FULL)).toBe('Freddie Mercury is my voice twin')
  })

  it('names the sender only when they opted into a name', () => {
    expect(voiceprintTitle({ ...FULL, n: 'Marko' })).toBe(
      "Freddie Mercury is Marko's voice twin",
    )
    expect(voiceprintTitle({ lo: 48, hi: 74 })).toBe('A voiceprint')
    expect(voiceprintTitle({ lo: 48, hi: 74, n: 'Marko' })).toBe(
      "Marko's voiceprint",
    )
  })
})

describe('voiceprintDescription', () => {
  it('reads out what the take measured, in the order the card does', () => {
    expect(voiceprintDescription(FULL)).toBe(
      'C3 – D5 · 2 octaves + 2 semitones · accuracy 87/100 · steadiness 92/100. Meet your own voice in about a minute.',
    )
  })

  it('never writes a score as cents', () => {
    // 87 is a good take. "±87¢" says nearly a semitone out, which is the
    // opposite, and it is what every unfurl used to say.
    expect(voiceprintDescription(FULL)).not.toMatch(/[±¢]/)
  })

  it('omits what a partial take never measured', () => {
    const d = voiceprintDescription({ lo: 48, hi: 74, st: 26 })
    expect(d).toContain('C3 – D5')
    expect(d).not.toContain('accuracy')
    expect(d).not.toContain('steadiness')
  })

  it('still says something when nothing numeric survived', () => {
    expect(voiceprintDescription({ tw: 'Adele' })).toBe(
      'A voiceprint, measured in cents and milliseconds.',
    )
  })

  it('carries no name unless one was given', () => {
    expect(voiceprintDescription(FULL)).not.toMatch(/marko/i)
  })
})

const PAYLOAD =
  'eyJ2IjoxLCJ0Ijoidm9pY2VwcmludCIsImQiOnsibG8iOjQ4LCJoaSI6NzQsInN0IjoyNiwiYWMiOjEyLCJzZCI6OSwidHciOiJGcmVkZGllIE1lcmN1cnkifX0'
const at = (query: string): URL =>
  new URL(`https://mercurypitch.com/mirror${query}`)

describe('voiceprintMetaTags', () => {
  it('leaves the document alone when there is no voiceprint in the link', () => {
    expect(voiceprintMetaTags(at(''))).toBeNull()
    expect(voiceprintMetaTags(at('?utm_source=voiceprint'))).toBeNull()
    expect(voiceprintMetaTags(at('?v=not-a-payload'))).toBeNull()
  })

  it('refuses a share payload that is not a voiceprint', () => {
    const melody =
      'eyJ2IjoxLCJ0IjoibWVsb2R5IiwiZCI6eyJuIjoiWCIsImIiOjEyMCwiaSI6W119fQ'
    expect(voiceprintMetaTags(at(`?v=${melody}`))).toBeNull()
  })

  it('describes the voiceprint even with no card stored', () => {
    const meta = voiceprintMetaTags(at(`?v=${PAYLOAD}`))
    expect(meta?.title).toBe('Freddie Mercury is my voice twin')
    expect(meta?.description).toContain('C3 – D5')
    // No `og`, so the stock image stays — the text still personalises.
    expect(meta?.image).toBeNull()
  })

  it('points at the stored card when the link names one', () => {
    const meta = voiceprintMetaTags(at(`?v=${PAYLOAD}&og=aB3xY9zQ01`))
    expect(meta?.image).toBe(
      'https://mercurypitch.com/api/og/card/aB3xY9zQ01.png',
    )
  })

  it('ignores an og id that is not the right shape', () => {
    // Never interpolate an unvalidated parameter into a URL we publish.
    for (const bad of ['../../etc', 'short', 'way-too-long-here', '']) {
      const meta = voiceprintMetaTags(
        at(`?v=${PAYLOAD}&og=${encodeURIComponent(bad)}`),
      )
      expect(meta?.image).toBeNull()
    }
  })

  it('keeps the image on the origin that was asked for', () => {
    const meta = voiceprintMetaTags(
      new URL(`https://mirror.mercurypitch.com/?v=${PAYLOAD}&og=aB3xY9zQ01`),
    )
    expect(meta?.image).toBe(
      'https://mirror.mercurypitch.com/api/og/card/aB3xY9zQ01.png',
    )
  })
})

describe('hardening the tags we publish', () => {
  it('ignores an implausibly long payload instead of decoding it', () => {
    // Base64 plus JSON.parse on unbounded attacker-controlled input, on
    // every request to this document, is not a thing to offer.
    const huge = 'A'.repeat(5000)
    expect(voiceprintMetaTags(at(`?v=${huge}`))).toBeNull()
  })

  it('keeps a twin name to a name-sized string', () => {
    const shout =
      'Your MercuryPitch account has been suspended, please verify it at example.com right now'
    const title = voiceprintTitle({ lo: 48, hi: 74, tw: shout })
    expect(title.length).toBeLessThanOrEqual(64 + ' is my voice twin'.length)
    expect(title).toContain('…')
  })

  it('collapses whitespace so a headline cannot be shaped with newlines', () => {
    expect(voiceprintTitle({ lo: 48, hi: 74, tw: 'Ad\n\n\t  ele' })).toBe(
      'Ad ele is my voice twin',
    )
  })

  it('treats a whitespace-only name as no name at all', () => {
    expect(voiceprintTitle({ lo: 48, hi: 74, n: '   ' })).toBe('A voiceprint')
    expect(voiceprintTitle({ lo: 48, hi: 74, tw: '  ', n: 'Marko' })).toBe(
      "Marko's voiceprint",
    )
  })
})

// ── The plumbing ──────────────────────────────────────────────
//
// `HTMLRewriter` exists only in the Workers runtime, so what is checked here
// is every decision made around it: whether the document is touched at all,
// which tags are reached for, and whether the picture is promised. A stand-in
// records the selectors and the values it would have written.

const CARD = 'aB3xY9zQ01'

function standInRewriter(): Map<string, string> {
  const written = new Map<string, string>()
  class Rewriter {
    on(
      selector: string,
      handlers: {
        element: (el: {
          setAttribute: (name: string, value: string) => void
          setInnerContent: (content: string) => void
        }) => void
      },
    ): this {
      handlers.element({
        setAttribute: (_name, value) => written.set(selector, value),
        setInnerContent: (content) => written.set(selector, content),
      })
      return this
    }
    transform(response: Response): Response {
      return response
    }
  }
  vi.stubGlobal('HTMLRewriter', Rewriter)
  return written
}

function mirrorDocument(init: ResponseInit = {}): Response {
  return new Response('<html></html>', {
    status: 200,
    ...init,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ETag: '"the-file-on-disk"',
      'Last-Modified': 'Sun, 20 Sep 2026 12:00:00 GMT',
      ...(init.headers as Record<string, string> | undefined),
    },
  })
}

describe('decorateVoiceprintMeta', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('promises the picture only when the store has it', async () => {
    const written = standInRewriter()
    await decorateVoiceprintMeta(
      mirrorDocument(),
      at(`?v=${PAYLOAD}&og=${CARD}`),
      async () => true,
    )
    expect(written.get('meta[property="og:image"]')).toBe(
      `https://mercurypitch.com/api/og/card/${CARD}.png`,
    )
    expect(written.get('meta[name="twitter:card"]')).toBe('summary')
    expect(written.get('meta[property="og:image:width"]')).toBe('1080')
  })

  it('keeps the stock picture for a card that expired or has not landed', async () => {
    // A card lasts thirty days and a link lasts for ever, and the upload can
    // still be on its way when the first crawler arrives. An `og:image` that
    // answers 404 unfurls with no picture; an untouched tag unfurls with the
    // stock one. The words are still the sender's.
    const written = standInRewriter()
    await decorateVoiceprintMeta(
      mirrorDocument(),
      at(`?v=${PAYLOAD}&og=${CARD}`),
      async () => false,
    )
    expect(written.has('meta[property="og:image"]')).toBe(false)
    expect(written.has('meta[name="twitter:image"]')).toBe(false)
    expect(written.has('meta[name="twitter:card"]')).toBe(false)
    expect(written.has('meta[property="og:image:width"]')).toBe(false)
    expect(written.get('meta[property="og:title"]')).toBe(
      'Freddie Mercury is my voice twin',
    )
  })

  it('serves the page when the store cannot be reached', async () => {
    const written = standInRewriter()
    const out = await decorateVoiceprintMeta(
      mirrorDocument(),
      at(`?v=${PAYLOAD}&og=${CARD}`),
      async () => {
        throw new Error('KV is down')
      },
    )
    expect(out.status).toBe(200)
    expect(written.has('meta[property="og:image"]')).toBe(false)
    expect(written.has('meta[property="og:title"]')).toBe(true)
  })

  it('does not ask the store about a link that names no card', async () => {
    standInRewriter()
    const asked = vi.fn(async () => true)
    await decorateVoiceprintMeta(mirrorDocument(), at(`?v=${PAYLOAD}`), asked)
    await decorateVoiceprintMeta(
      mirrorDocument(),
      at(`?v=${PAYLOAD}&og=nope`),
      asked,
    )
    expect(asked).not.toHaveBeenCalled()
  })

  it('leaves an ordinary visit exactly as it was', async () => {
    standInRewriter()
    const asked = vi.fn(async () => true)
    const plain = mirrorDocument()
    expect(await decorateVoiceprintMeta(plain, at(''), asked)).toBe(plain)
    expect(plain.headers.get('ETag')).toBe('"the-file-on-disk"')
    expect(asked).not.toHaveBeenCalled()
  })

  it('leaves alone anything that is not the whole document', async () => {
    standInRewriter()
    const asked = vi.fn(async () => true)
    const link = at(`?v=${PAYLOAD}&og=${CARD}`)

    const notModified = new Response(null, { status: 304 })
    expect(await decorateVoiceprintMeta(notModified, link, asked)).toBe(
      notModified,
    )
    const notHtml = new Response('{}', {
      headers: { 'Content-Type': 'application/json' },
    })
    expect(await decorateVoiceprintMeta(notHtml, link, asked)).toBe(notHtml)
    expect(asked).not.toHaveBeenCalled()
  })

  it('drops the file’s validators from a page it rewrote', async () => {
    // The rewritten page changes when the card arrives or expires while the
    // file on disk does not. Its ETag would let a crawler coming back be
    // told 304 about whichever version it happened to keep.
    standInRewriter()
    const out = await decorateVoiceprintMeta(
      mirrorDocument(),
      at(`?v=${PAYLOAD}`),
      async () => false,
    )
    expect(out.headers.get('ETag')).toBeNull()
    expect(out.headers.get('Last-Modified')).toBeNull()
    expect(out.headers.get('Content-Type')).toContain('text/html')
  })

  it('reaches only for tags the Mirror document really has', async () => {
    // HTMLRewriter says nothing about a selector that matches no element:
    // rename a tag in mirror.html and that part of every unfurl quietly goes
    // back to stock. This is the only place that would notice.
    const written = standInRewriter()
    await decorateVoiceprintMeta(
      mirrorDocument(),
      at(`?v=${PAYLOAD}&og=${CARD}`),
      async () => true,
    )
    const html = readFileSync(resolve(__dirname, '../../mirror.html'), 'utf8')
    expect(written.size).toBeGreaterThan(10)
    for (const selector of written.keys()) {
      const attribute = selector.match(/^meta\[(property|name)="([^"]+)"\]$/)
      const present =
        attribute === null
          ? new RegExp(`<${selector}[\\s>]`).test(html)
          : new RegExp(`<meta\\s[^>]*${attribute[1]}="${attribute[2]}"`).test(
              html,
            )
      expect(present, `${selector} is not in mirror.html`).toBe(true)
    }
  })
})
