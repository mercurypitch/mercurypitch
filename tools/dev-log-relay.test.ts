// ============================================================
// The relay keeps the last words of a page that died
// ============================================================
//
// The bug it was built for kills the tab, so the two things that matter are
// that a batch which arrives is written, and that the shim is arranged to get
// one out while the page is being torn down. Everything else is a middleware
// that is reachable from every device on the network and writes to disk, so
// it validates rather than trusts.

import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { DevLogBatch } from './dev-log-relay'
import { clientShim, devLogRelayPlugin, formatLogLine, parseBatch, VITE_RELOAD_MARKER, } from './dev-log-relay'

describe('parsing a batch off the wire', () => {
  it('takes a well-formed batch', () => {
    const batch = parseBatch({
      loadId: 'ab12cd-4242',
      agent: 'iPhone',
      url: 'https://192.168.1.20:3000/',
      entries: [{ level: 'warn', text: 'decode slow', at: 1, since: 2 }],
    })

    expect(batch?.loadId).toBe('ab12cd-4242')
    expect(batch?.entries).toHaveLength(1)
    expect(batch?.entries[0].text).toBe('decode slow')
  })

  it.each([
    ['not an object', 'nope'],
    ['null', null],
    ['no load id', { entries: [{ level: 'log', text: 'x' }] }],
    [
      'an empty load id',
      { loadId: '', entries: [{ level: 'log', text: 'x' }] },
    ],
    ['no entries', { loadId: 'a' }],
    ['entries that are not a list', { loadId: 'a', entries: 'x' }],
    ['an empty list', { loadId: 'a', entries: [] }],
    ['entries with no text', { loadId: 'a', entries: [{ level: 'log' }] }],
  ])('refuses %s', (_label, body) => {
    expect(parseBatch(body)).toBe(null)
  })

  it('drops the malformed entries and keeps the rest', () => {
    const batch = parseBatch({
      loadId: 'a',
      entries: [
        { level: 'log', text: 'kept' },
        { level: 7, text: 'dropped' },
        null,
        { level: 'error', text: 'kept too' },
      ],
    })

    expect(batch?.entries.map((e) => e.text)).toEqual(['kept', 'kept too'])
  })

  it('defaults the timings rather than writing undefined into the file', () => {
    const batch = parseBatch({
      loadId: 'a',
      entries: [{ level: 'log', text: 'x' }],
    })

    expect(batch?.entries[0].at).toBe(0)
    expect(batch?.entries[0].since).toBe(0)
  })
})

describe('the line that lands in the file', () => {
  it('leads with the load and the offset into it', () => {
    const line = formatLogLine(
      { loadId: 'ab12cd' },
      {
        level: 'error',
        text: 'stem decode failed',
        at: 0,
        since: 12_345,
      },
    )

    // The offset, not the wall clock: a phone's clock can be anything, and
    // what matters is how far into the page load the crash was.
    expect(line).toContain('[ab12cd]')
    expect(line).toContain('12.35s')
    expect(line).toContain('ERROR')
    expect(line).toContain('stem decode failed')
  })
})

describe('the client shim', () => {
  const shim = clientShim('/__devlog')

  it('gets a last batch out while the page is being torn down', () => {
    // The whole point. iOS does not fire `unload` when it kills a tab, and
    // `fetch` does not reliably survive teardown.
    expect(shim).toContain('sendBeacon')
    expect(shim).toContain("addEventListener('pagehide'")
    expect(shim).toContain('visibilitychange')
  })

  it('copies the console rather than taking it over', () => {
    // A dev-only shim that swallowed the real console would make the desktop
    // browser useless for the same debugging.
    expect(shim).toContain('original.apply(null, arguments)')
  })

  it('catches what never reached the console at all', () => {
    expect(shim).toContain("addEventListener('error'")
    expect(shim).toContain("addEventListener('unhandledrejection'")
  })

  it('bounds what it holds and what it sends', () => {
    // On a device that is already out of memory, an unbounded queue is its
    // own bug.
    expect(shim).toContain('MAX_QUEUE')
    expect(shim).toContain('queue.shift()')
    expect(shim).toContain('MAX_TEXT')
  })

  it('posts where it was told to', () => {
    expect(clientShim('/__elsewhere')).toContain("'/__elsewhere'")
  })

  it('separates a page that left from a page that was killed', () => {
    // The whole ambiguity of this hunt: a fresh document at the same URL
    // reads identically whether iOS killed the tab or the app navigated.
    // iOS fires beforeunload for one and not the other.
    expect(shim).toContain("addEventListener('beforeunload'")
    expect(shim).toContain('it was not killed')
  })

  it('names whoever sent it away', () => {
    expect(shim).toContain("['assign', 'replace', 'reload']")
    expect(shim).toContain('new Error')
  })

  it('keeps a pulse, so silence is distinguishable from a stall', () => {
    // A one-second timer firing three seconds late is a blocked main thread,
    // which is a different bug from running out of memory while idle.
    expect(shim).toContain('[heartbeat]')
    expect(shim).toContain('was blocked for')
  })
})

/** A node request/response pair thin enough to drive the middleware. */
function exchange(method: string, body: string) {
  const req = Object.assign(new EventEmitter(), { method })
  const res = { statusCode: 200, end: vi.fn() }
  const send = (): void => {
    req.emit('data', body)
    req.emit('end')
  }
  return { req, res, send }
}

function harness() {
  const written: Array<{ file: string; line: string }> = []
  const plugin = devLogRelayPlugin({
    root: '/repo',
    now: () => new Date('2026-09-01T10:00:00.000Z'),
    write: (file, line) => written.push({ file, line }),
    log: () => {},
  })
  let handler: ((req: unknown, res: unknown) => void) | null = null
  const server = {
    middlewares: {
      use: (_path: string, fn: (req: unknown, res: unknown) => void) => {
        handler = fn
      },
    },
  }
  ;(plugin.configureServer as unknown as (s: typeof server) => void).call(
    plugin,
    server,
  )
  if (handler === null) throw new Error('no middleware was registered')
  return { written, handler, plugin }
}

describe('the middleware', () => {
  const batch: DevLogBatch = {
    loadId: 'ab12cd',
    agent: 'iPhone; Safari',
    url: 'https://192.168.1.20:3000/',
    entries: [
      { level: 'info', text: 'opening the vocal', at: 0, since: 100 },
      { level: 'error', text: 'gone', at: 0, since: 8000 },
    ],
  }

  it('writes a banner for a load, then its lines', () => {
    const h = harness()
    const x = exchange('POST', JSON.stringify(batch))
    h.handler(x.req, x.res)
    x.send()

    const text = h.written.map((w) => w.line).join('')
    expect(text).toContain('=== load ab12cd')
    expect(text).toContain('iPhone; Safari')
    expect(text).toContain('opening the vocal')
    expect(text).toContain('gone')
    expect(x.res.statusCode).toBe(204)
  })

  it('banners each load once, so a reload is visible and nothing else is', () => {
    const h = harness()
    for (const _ of [1, 2]) {
      const x = exchange('POST', JSON.stringify(batch))
      h.handler(x.req, x.res)
      x.send()
    }
    const second = exchange(
      'POST',
      JSON.stringify({ ...batch, loadId: 'ef34gh' }),
    )
    h.handler(second.req, second.res)
    second.send()

    const banners = h.written.filter((w) => w.line.includes('=== load'))
    // A crash and a reload is exactly two loads, and it has to read as two.
    expect(banners).toHaveLength(2)
    expect(banners[1].line).toContain('ef34gh')
  })

  it('names the file for the day', () => {
    const h = harness()
    const x = exchange('POST', JSON.stringify(batch))
    h.handler(x.req, x.res)
    x.send()

    expect(h.written[0].file).toContain('.dev-logs')
    expect(h.written[0].file).toContain('2026-09-01.log')
  })

  it('turns away anything that is not a POSTed batch', () => {
    const h = harness()

    const get = exchange('GET', '')
    h.handler(get.req, get.res)
    expect(get.res.statusCode).toBe(405)

    const junk = exchange('POST', 'not json')
    h.handler(junk.req, junk.res)
    junk.send()
    expect(junk.res.statusCode).toBe(400)

    const shaped = exchange('POST', JSON.stringify({ loadId: 'a' }))
    h.handler(shaped.req, shaped.res)
    shaped.send()
    expect(shaped.res.statusCode).toBe(400)

    expect(h.written).toHaveLength(0)
  })

  it('refuses a body big enough to fill the disk', () => {
    const h = harness()
    const x = exchange('POST', 'x'.repeat(600 * 1024))
    h.handler(x.req, x.res)
    x.send()

    expect(x.res.statusCode).toBe(413)
    expect(h.written).toHaveLength(0)
  })
})

describe('the plugin itself', () => {
  it('exists only while serving', () => {
    // In a build there is no relay, no endpoint and no injected script — the
    // shim reads every console call in the app and must never ship.
    expect(devLogRelayPlugin({ root: '/repo' }).apply).toBe('serve')
  })

  it('injects the shim ahead of the app', () => {
    const plugin = devLogRelayPlugin({ root: '/repo' })
    const transform = plugin.transformIndexHtml
    if (typeof transform !== 'object' || transform === null) {
      throw new Error('expected an object form with an order')
    }
    expect(transform.order).toBe('pre')
    const out = (
      transform.handler as unknown as (html: string) => {
        tags: Array<{ injectTo: string; children: string }>
      }
    ).call(plugin, '<html></html>')
    // head-prepend: a console call during boot is the one worth having.
    expect(out.tags[0].injectTo).toBe('head-prepend')
    expect(out.tags[0].children).toContain('sendBeacon')
  })
})

// ============================================================
// The dev server's own reloads say so
// ============================================================
//
// Vite pre-bundles a dependency the first time something imports it and then
// reloads the page. For this app that happens when the mixer pulls in
// `@huggingface/transformers` — in the middle of a song load, where it is
// indistinguishable from the crash being hunted.

describe('naming the dev server’s own reloads', () => {
  it('listens for the reload Vite is about to do', () => {
    expect(VITE_RELOAD_MARKER).toContain('vite:beforeFullReload')
    expect(VITE_RELOAD_MARKER).toContain('import.meta.hot')
    // It has to read as "not the bug" at a glance, in a file being skimmed
    // for the moment a page died.
    expect(VITE_RELOAD_MARKER).toContain('Not a crash')
  })

  it('goes in as a module, which is the only way hot exists', () => {
    const plugin = devLogRelayPlugin({ root: '/repo' })
    const transform = plugin.transformIndexHtml
    if (typeof transform !== 'object' || transform === null) {
      throw new Error('expected an object form with an order')
    }
    const out = (
      transform.handler as unknown as (html: string) => {
        tags: Array<{
          injectTo: string
          children: string
          attrs?: Record<string, unknown>
        }>
      }
    ).call(plugin, '<html></html>')
    const marker = out.tags.find((t) => t.children.includes('import.meta.hot'))
    expect(marker?.attrs?.type).toBe('module')
    expect(marker?.injectTo).toBe('head-prepend')
  })
})
