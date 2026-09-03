import { afterEach, describe, expect, it } from 'vitest'
import { graphicsLabel, micApiBlocker, parseEngineLabel, } from './device-support'

const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 14; SM-X200 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.101 Mobile Safari/537.36'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
const DESKTOP_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15'

describe('parseEngineLabel', () => {
  it('separates an Android WebView from Chrome for Android', () => {
    // The `; wv)` token is the whole point: a Capacitor app runs in the
    // WebView, and the compat tables disagree about what it supports.
    expect(parseEngineLabel(ANDROID_WEBVIEW)).toBe('Android WebView 121')
    expect(parseEngineLabel(ANDROID_CHROME)).toBe('Chrome 138')
  })

  it('names other engines it can recognise', () => {
    expect(parseEngineLabel(DESKTOP_SAFARI)).toBe('Safari 18')
    expect(parseEngineLabel('Mozilla/5.0 Firefox/131.0')).toBe('Firefox 131')
  })

  it('does not guess when it cannot tell', () => {
    expect(parseEngineLabel('some other agent')).toBe('Unknown engine')
  })

  // The one that shipped saying "Unknown engine" on the platform whose
  // engine mattered most. A WKWebView inside an app carries no
  // `Version/` token, which is what the Safari branch matches on.
  it('names the WebView Beside Cue actually runs in on iOS', () => {
    expect(
      parseEngineLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      ),
    ).toBe('iOS WebView 18.5')
  })

  it('still calls mobile Safari Safari', () => {
    expect(
      parseEngineLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari 18')
  })
})

describe('graphicsLabel', () => {
  it('separates having the API from having a working adapter', () => {
    expect(
      graphicsLabel({ hasWebGpuApi: true, hasAdapter: true, hasWebGl2: true }),
    ).toBe('WebGPU ready')
    expect(
      graphicsLabel({ hasWebGpuApi: true, hasAdapter: false, hasWebGl2: true }),
    ).toBe('WebGPU present, no adapter')
  })

  it('falls back through WebGL2 to nothing', () => {
    expect(
      graphicsLabel({
        hasWebGpuApi: false,
        hasAdapter: false,
        hasWebGl2: true,
      }),
    ).toBe('WebGL2')
    expect(
      graphicsLabel({
        hasWebGpuApi: false,
        hasAdapter: false,
        hasWebGl2: false,
      }),
    ).toBe('none')
  })
})

describe('why the microphone cannot work here', () => {
  const realDevices = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    'mediaDevices',
  )
  const setDevices = (value: unknown): void => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value,
      configurable: true,
    })
  }
  const setSecure = (value: boolean): void => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      value,
      configurable: true,
    })
  }

  afterEach(() => {
    if (realDevices !== undefined) {
      Object.defineProperty(Navigator.prototype, 'mediaDevices', realDevices)
    }
    setSecure(true)
  })

  it('says nothing is in the way when the API is there', () => {
    setDevices({ getUserMedia: () => undefined })
    expect(micApiBlocker()).toBeNull()
  })

  // The whole point: an http page on a LAN address has no microphone API
  // at all, and browsers report that as "undefined is not an object" from
  // several layers down rather than as anything about the URL.
  it('names the secure connection when the page is not one', () => {
    setDevices(undefined)
    setSecure(false)
    const line = micApiBlocker()
    expect(line).toMatch(/https/i)
    expect(line).toMatch(/localhost/i)
  })

  // A secure page with no API is a browser that cannot do it, and telling
  // that player to change the URL would send them nowhere.
  it('does not blame the URL when the page is already secure', () => {
    setDevices(undefined)
    setSecure(true)
    const line = micApiBlocker()
    expect(line).not.toBeNull()
    expect(line).not.toMatch(/https/i)
  })

  it('is not fooled by a mediaDevices without getUserMedia', () => {
    setDevices({})
    setSecure(false)
    expect(micApiBlocker()).not.toBeNull()
  })
})
