// ============================================================
// Dev log relay — the phone's console, on the dev server's disk
// ============================================================
//
// Safari on iOS has a web inspector, and reaching it means a cable, a Mac,
// Develop > iPhone, and a page that is still alive when you get there. The
// bug this was built for kills the page: opening a song from the sidebar
// crashes the tab, so whatever the console had is gone before anyone can
// look at it.
//
// So the console comes here instead. A dev-only client shim wraps
// `console.*`, `window.onerror` and `unhandledrejection`, and posts them to
// this server, which appends NDJSON to `.dev-logs/` and echoes a line to its
// own stdout. A tab that dies mid-crash has already sent everything up to
// the last quarter second, and `sendBeacon` on pagehide gets the rest out
// during teardown — which is the difference between "the page vanished" and
// "the page vanished right after these four lines".
//
// `apply: 'serve'`, so none of it exists in a build. The shim is injected
// into the HTML the dev server hands out and nowhere else.
//
// Tests: tools/dev-log-relay.test.ts

import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Where the batches land, relative to the repo root. Gitignored. */
export const DEV_LOG_DIR = '.dev-logs'

/** Refused above this, so a runaway loop cannot fill the disk in a minute. */
const MAX_BODY_BYTES = 512 * 1024

export interface DevLogEntry {
  /** 'log' | 'info' | 'warn' | 'error' | 'debug' | 'onerror' | 'unhandled' */
  level: string
  /** Already-serialized arguments, joined by the client. */
  text: string
  /** Wall clock on the DEVICE, ms since epoch. */
  at: number
  /** Milliseconds since that page load — survives a clock that is wrong. */
  since: number
}

export interface DevLogBatch {
  /** One per page load. A new one mid-session means the tab reloaded. */
  loadId: string
  /** Whatever the device says it is, recorded once per load. */
  agent?: string
  url?: string
  entries: DevLogEntry[]
}

/** A line of the log file, and of the server's stdout. */
export function formatLogLine(
  batch: Pick<DevLogBatch, 'loadId'>,
  entry: DevLogEntry,
): string {
  const seconds = (entry.since / 1000).toFixed(2).padStart(8, ' ')
  return `[${batch.loadId}] ${seconds}s ${entry.level.toUpperCase().padEnd(6)} ${entry.text}`
}

/**
 * Rejects anything that is not a batch, rather than trusting the body: this
 * middleware is reachable from every device on the network the dev server is
 * exposed to, and it writes to disk.
 */
export function parseBatch(body: unknown): DevLogBatch | null {
  if (typeof body !== 'object' || body === null) return null
  const raw = body as Record<string, unknown>
  if (typeof raw.loadId !== 'string' || raw.loadId === '') return null
  if (!Array.isArray(raw.entries)) return null
  const entries: DevLogEntry[] = []
  for (const item of raw.entries) {
    if (typeof item !== 'object' || item === null) continue
    const e = item as Record<string, unknown>
    if (typeof e.level !== 'string' || typeof e.text !== 'string') continue
    entries.push({
      level: e.level,
      text: e.text,
      at: typeof e.at === 'number' ? e.at : 0,
      since: typeof e.since === 'number' ? e.since : 0,
    })
  }
  if (entries.length === 0) return null
  return {
    loadId: raw.loadId,
    agent: typeof raw.agent === 'string' ? raw.agent : undefined,
    url: typeof raw.url === 'string' ? raw.url : undefined,
    entries,
  }
}

/**
 * The client half, as a string because it is injected into the page rather
 * than bundled: it has to be running before any of the app's own modules
 * are evaluated, so that a console call during boot is not the one that gets
 * away.
 *
 * Deliberately small and dependency-free. It keeps the real console — the
 * point is to copy what is said, not to take it over — and it never logs its
 * own failures through the patched console, which would be a loop.
 */
export function clientShim(endpoint: string): string {
  return `
(function () {
  var LOAD_ID = Math.random().toString(36).slice(2, 8) + '-' + (Date.now() % 100000);
  var START = Date.now();
  var queue = [];
  var timer = null;
  var sending = false;
  var LEVELS = ['log', 'info', 'warn', 'error', 'debug'];
  var MAX_TEXT = 4000;
  var MAX_QUEUE = 500;

  function render(value, depth) {
    if (value instanceof Error) {
      return value.name + ': ' + value.message + (value.stack ? '\\n' + value.stack : '');
    }
    if (typeof value === 'string') return value;
    if (typeof value !== 'object' || value === null) return String(value);
    if (depth > 2) return '[deep]';
    try {
      return JSON.stringify(value, function (key, v) {
        if (v instanceof Error) return v.name + ': ' + v.message;
        if (typeof v === 'bigint') return String(v);
        return v;
      });
    } catch (err) {
      return Object.prototype.toString.call(value);
    }
  }

  function push(level, args) {
    var text = Array.prototype.map.call(args, function (a) { return render(a, 0); }).join(' ');
    if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT) + ' …[cut]';
    // Oldest first: in a crash the last lines are the ones worth keeping, and
    // an unbounded queue on a device that is already out of memory is its own
    // problem.
    if (queue.length >= MAX_QUEUE) queue.shift();
    queue.push({ level: level, text: text, at: Date.now(), since: Date.now() - START });
    schedule();
  }

  function body() {
    return JSON.stringify({
      loadId: LOAD_ID,
      agent: navigator.userAgent,
      url: location.href,
      entries: queue.splice(0, queue.length),
    });
  }

  function schedule() {
    if (timer !== null || sending) return;
    // A quarter second: short enough that a crash loses almost nothing, long
    // enough that a chatty boot is a handful of requests rather than hundreds.
    timer = setTimeout(flush, 250);
  }

  function flush() {
    timer = null;
    if (queue.length === 0) return;
    sending = true;
    var payload = body();
    try {
      fetch('${endpoint}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(function () {}).then(function () {
        sending = false;
        if (queue.length > 0) schedule();
      });
    } catch (err) {
      sending = false;
    }
  }

  function flushNow() {
    if (queue.length === 0) return;
    var payload = body();
    // sendBeacon survives teardown; fetch does not reliably. This is the one
    // that carries the last words of a page that is being killed.
    if (navigator.sendBeacon) {
      try {
        navigator.sendBeacon('${endpoint}', new Blob([payload], { type: 'application/json' }));
        return;
      } catch (err) {}
    }
    try {
      fetch('${endpoint}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
    } catch (err) {}
  }

  LEVELS.forEach(function (level) {
    var original = console[level] ? console[level].bind(console) : function () {};
    console[level] = function () {
      try { push(level, arguments); } catch (err) {}
      original.apply(null, arguments);
    };
  });

  window.addEventListener('error', function (event) {
    push('onerror', [
      (event.message || 'error') +
        ' @ ' + (event.filename || '?') + ':' + (event.lineno || 0) + ':' + (event.colno || 0),
      event.error && event.error.stack ? event.error.stack : '',
    ]);
    flushNow();
  });

  window.addEventListener('unhandledrejection', function (event) {
    push('unhandled', [event.reason]);
    flushNow();
  });

  // pagehide, not unload: iOS Safari does not fire unload when it kills or
  // backgrounds a tab, and pagehide is the last event a doomed page gets.
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushNow();
  });

  // Was it killed, or did it leave? A fresh document at the same URL looks
  // identical either way in a log of console lines, and the two have nothing
  // in common to fix. iOS fires beforeunload when the page navigates and does
  // not fire it when the content process is killed, so its presence or
  // absence in the last lines before a new load id is the answer.
  window.addEventListener('beforeunload', function () {
    push('nav', ['beforeunload — this page is LEAVING, it was not killed']);
    flushNow();
  });

  // And if it left, who sent it. A stack here names the caller.
  try {
    ['assign', 'replace', 'reload'].forEach(function (name) {
      var original = window.location[name].bind(window.location);
      window.location[name] = function () {
        try {
          push('nav', [
            'location.' + name + '(' + (arguments[0] || '') + ')',
            new Error('called from').stack || '',
          ]);
          flushNow();
        } catch (err) {}
        return original.apply(null, arguments);
      };
    });
  } catch (err) {
    // Some engines refuse to let these be replaced. beforeunload still tells
    // us whether the page left; only the culprit's name is lost.
  }

  // A heartbeat, for the seconds where nothing is logged and the tab dies
  // anyway. Its drift is the useful part: a one-second timer that fires three
  // seconds late means the main thread was blocked, which is a different bug
  // from a process running out of memory while idle.
  var beats = 0;
  var lastBeat = Date.now();
  setInterval(function () {
    var now = Date.now();
    var drift = now - lastBeat - 1000;
    lastBeat = now;
    beats++;
    if (drift > 250) {
      push('warn', ['[heartbeat] the main thread was blocked for ' + drift + 'ms']);
    } else if (beats % 5 === 0) {
      push('log', ['[heartbeat] ' + ((now - START) / 1000).toFixed(1) + 's, still here']);
    }
  }, 1000);

  push('info', ['[dev-log] page load ' + LOAD_ID + ' — ' + navigator.userAgent]);
})();
`.trim()
}

/**
 * The dev server's own reloads, named in the page's log.
 *
 * Vite pre-bundles a dependency the first time something imports it and then
 * reloads the page to pick up the new module graph — for this app that
 * happens the moment the mixer pulls in `@huggingface/transformers`, which is
 * to say in the middle of a song load. From the page's side that is
 * indistinguishable from the crash we are hunting: the download and decode
 * stop mid-sentence and a fresh document appears at the same URL. It cost an
 * hour once; it should not cost anyone a second one.
 *
 * An inline module script, because `import.meta.hot` only exists in a module
 * the dev server has transformed — and it does transform inline ones.
 */
export const VITE_RELOAD_MARKER = `
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeFullReload', function () {
    console.warn('[vite] the DEV SERVER asked for a full reload — a dependency was just pre-bundled. Not a crash.');
  });
}
`.trim()

export interface DevLogRelayOptions {
  /** Repo root; the log directory is made under it. */
  root: string
  /** Where the client posts. Must match the middleware's path. */
  endpoint?: string
  /** Overridable for the tests. */
  now?: () => Date
  /** Overridable for the tests. */
  write?: (file: string, line: string) => void
  /** Overridable for the tests. */
  log?: (line: string) => void
}

/**
 * Vite plugin. Serve-only: it injects nothing into a build and registers no
 * middleware there.
 */
export function devLogRelayPlugin(options: DevLogRelayOptions): Plugin {
  const endpoint = options.endpoint ?? '/__devlog'
  const now = options.now ?? (() => new Date())
  const emit = options.log ?? ((line: string) => process.stdout.write(line))
  const dir = resolve(options.root, DEV_LOG_DIR)
  const write =
    options.write ??
    ((file: string, line: string) => {
      mkdirSync(dir, { recursive: true })
      appendFileSync(file, line, 'utf8')
    })

  /** One file a day, so a session is easy to find and easy to delete. */
  const fileFor = (date: Date): string =>
    resolve(dir, `${date.toISOString().slice(0, 10)}.log`)

  const seenLoads = new Set<string>()

  return {
    name: 'mercurypitch:dev-log-relay',
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use(endpoint, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let raw = ''
        let tooBig = false
        req.on('data', (chunk: Buffer | string) => {
          if (tooBig) return
          raw += String(chunk)
          if (raw.length > MAX_BODY_BYTES) {
            tooBig = true
            raw = ''
            res.statusCode = 413
            res.end()
          }
        })
        req.on('end', () => {
          if (tooBig) return
          let parsed: DevLogBatch | null = null
          try {
            parsed = parseBatch(JSON.parse(raw))
          } catch {
            parsed = null
          }
          if (parsed === null) {
            res.statusCode = 400
            res.end()
            return
          }
          const file = fileFor(now())
          // A load banner once, so a reload — or a crash and a reload, which
          // is what this was built to catch — is visible as a new id rather
          // than as a gap someone has to notice.
          if (!seenLoads.has(parsed.loadId)) {
            seenLoads.add(parsed.loadId)
            const banner = `\n=== load ${parsed.loadId} · ${now().toISOString()} · ${parsed.url ?? '?'}\n=== ${parsed.agent ?? 'unknown device'}\n`
            write(file, banner)
            emit(banner)
          }
          for (const entry of parsed.entries) {
            const line = `${formatLogLine(parsed, entry)}\n`
            write(file, line)
            emit(line)
          }
          res.statusCode = 204
          res.end()
        })
      })
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return {
          html,
          tags: [
            {
              tag: 'script',
              // First in <head>, before any module: a console call during
              // boot is exactly the one worth having.
              injectTo: 'head-prepend',
              children: clientShim(endpoint),
            },
            {
              tag: 'script',
              attrs: { type: 'module' },
              injectTo: 'head-prepend',
              children: VITE_RELOAD_MARKER,
            },
          ],
        }
      },
    },
  }
}
