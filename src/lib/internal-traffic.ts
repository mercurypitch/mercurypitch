// ============================================================
// Marking our own visits, per browser rather than per IP
// ============================================================
//
// GA4's built-in Internal Traffic filter excludes events whose
// `traffic_type` parameter is `internal`. The usual way to set that
// parameter is an IP rule in the GA4 admin — and that cannot work here.
//
// The machine doing the testing sits behind a VPN whose IPv6 address
// rotates per session, so a pinned address matches for a day and then
// silently stops. The CIDR range that would catch it belongs to a
// popular consumer VPN, and a privacy-minded singing audience is
// exactly who uses one — filtering the range would drop real visitors
// to hide a couple of dozen of our own sessions. That trade is
// backwards.
//
// So the browser marks itself. Visit any page with `?mp_internal=1` to
// mark it, `?mp_internal=0` to clear it. Survives the VPN going on or
// off, works on a phone, and cannot catch a stranger by accident.
//
// The same key and parameter exist on the landing site
// (ConsentAnalytics.astro); they are separate origins, so a browser
// marks each once.

const STORAGE_KEY = 'mp.internal.v1'
const URL_PARAM = 'mp_internal'

/**
 * True when this browser has been marked as ours.
 *
 * Reads the URL first so the marking visit itself is already excluded —
 * otherwise the pageview that turns the flag on is the one that slips
 * into the reports.
 */
export function isInternalTraffic(): boolean {
  try {
    const flag = new URLSearchParams(window.location.search).get(URL_PARAM)
    if (flag === '1') localStorage.setItem(STORAGE_KEY, '1')
    else if (flag === '0') localStorage.removeItem(STORAGE_KEY)
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Private mode / storage disabled: treat as a normal visitor. Failing
    // open here only means one of our own visits is counted, which is a
    // smaller mistake than excluding a real one.
    return false
  }
}

/**
 * The GA4 config parameters for this browser — `traffic_type: 'internal'`
 * when marked, nothing otherwise.
 *
 * Returned as an object to spread rather than a boolean, so the caller
 * never has to decide what the parameter is called.
 */
export function ga4TrafficParams(): Record<string, string> {
  return isInternalTraffic() ? { traffic_type: 'internal' } : {}
}
