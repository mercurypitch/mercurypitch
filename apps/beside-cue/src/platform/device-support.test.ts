import { describe, expect, it } from 'vitest'
import { graphicsLabel, parseEngineLabel } from './device-support'

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
