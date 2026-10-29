# Windows performance and restricted networks

**Status (29 Oct 2026):** J1, J2, J4 and J5 shipped in the PR that added this
file. Everything else is **parked**: the owner judged Windows performance
mostly fine, and the Windows runner and restricted-network CI jobs (C1-C3) wait
until the work-PC and home-network tests with `?jamdiag=1` and `?jamrelay=1`
say they are worth it.

Audit of 29 Oct 2026, read from `origin/main` at 4bea15da5. Findings come from
reading the code plus one Node micro-benchmark; nothing ran on a Windows machine
yet. "Plausible" marks Chrome-on-Windows behaviour that still needs a real run.

## Step 0: diagnose the work PC (no code)

Before fixing anything for the work network, capture what it actually blocks:

1. `chrome://policy` (or `edge://policy`): look for `WebRtcIPHandling`,
   `WebRtcUdpPortRange`, `WebRtcLocalIpsAllowedUrls`, proxy settings,
   `EnhanceSecurityMode` (JIT off).
2. DevTools Network tab, filter WS, join a room: is the `/api/jam/.../signal`
   upgrade refused (403/blocked page) or never answered?
3. `chrome://webrtc-internals` during a join: which candidate types appear
   (host / srflx / relay) and over which protocol (udp / tcp / tls).
4. Open the room with `?jamdiag=1` to see the network panel.
5. `chrome://gpu`: is WebGPU on, is the renderer "SwiftShader" or "Basic Render
   Driver" (hardware acceleration off or VDI)?

Steps 2 and 3 tell apart the three corporate failures: WebSockets blocked, UDP
blocked (TURN over 443/tls should still work), and TLS inspection (breaks
`turns:` too, leaving nothing).

## Jam rooms: network and CSP

CSP and CORS are not the problem. `connect-src` allows `wss:`, WebRTC is not
governed by CSP, `microphone=(self)` is set, and the worker's Origin gate is a
same-host check (`workers/jam-worker/src/index.ts:47-67`). TURN comes from
Cloudflare and its minted list includes `turns:` on 443/tcp, which is the best
available path through a strict firewall.

What is wrong is that a blocked network fails silently or with the wrong advice.

| ID  | Change                                                                                                                                                                                                                                                                                      | Where                                         | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---- |
| J1  | Socket-error message blames a LAN certificate for every non-localhost `wss://` host, production included. Show the certificate advice only for LAN/IP hosts; otherwise say the network may block room connections.                                                                          | `src/lib/jam/signaling.ts:150-157`            | S    |
| J2  | Record the local candidate's `protocol` and `relayProtocol` (udp/tcp/tls) in net stats and show it in the diagnostics panel.                                                                                                                                                                | `src/lib/jam/jam-net-stats.ts:300-320`        | S    |
| J3  | "Check my network" self-test, run on a failed join: WebSocket open probe, then three relay-only ICE gathers (udp, tcp, tls) against the minted TURN. Result in words: "Your network blocks room connections" / "Direct audio is blocked, using relay" / "This network blocks voice relays". | new `src/lib/jam/network-check.ts` + JamPanel | M    |
| J4  | A peer stuck at `failed` after `MAX_ICE_RETRIES` gets a reason in the peer list, linking to J3.                                                                                                                                                                                             | `service.ts:1145`, `JamPeerList.tsx`          | S    |
| J5  | `?jamrelay=1` debug flag sets `iceTransportPolicy: 'relay'`, so the TURN path can be tested on any network.                                                                                                                                                                                 | `service.ts:584,615`                          | S    |

## Windows performance

No Windows-specific code exists, so nothing is broken outright. These paths run
worse on a typical locked-down Windows laptop (integrated GPU, 125-150% scaling,
hardware acceleration sometimes off, Bluetooth or USB headsets).

| ID  | Sev  | Change                                                                                                                                                                                                                                                                                                                                                                                              | Where                                                                                                             | Size      |
| --- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| W1  | High | Device tier scores only cores and `deviceMemory`, so any 8-thread/8 GB work laptop is 'high' and keeps all backdrop-filter, canvas shadowBlur and an uncapped frame rate, even on a software renderer. Reuse `probeWebGL2`/`SOFTWARE_RENDERER` from `gpu-gate.ts` and drop to 'low' on null or software; treat `prefers-reduced-transparency` as 'low'; sample frames app-wide for the first ~10 s. | `src/lib/device-tier.ts:123-141`, `src/lib/merc/gpu-gate.ts:63-88`                                                | M         |
| W2  | High | Local stem separation defaults to WebGPU on every desktop but Linux Firefox, so Windows runs onnxruntime over D3D12 on the integrated GPU (known hangs, `vocal-separator.ts:25-46`; TDR resets plausible). The failure flag lives only per page. Default to WASM on integrated adapters, remember a GPU failure per device, cap `numThreads` at 4.                                                  | `src/stores/uvr-store.ts:70-81`, `packages/pitch-engine/src/assets.ts:93`                                         | M         |
| W3  | High | Pitch detection runs on the main thread once per frame with the O(N^2) MPM detector: 2.0 ms per call JIT on, 92-136 ms with the optimizing JIT off (Edge enhanced security mode). Move the Singing tab and exercises to `pitch-f0-stream.ts` (worklet + worker, already used by glass-game); compute NSDF by FFT (0.18 ms, identical output in the bench).                                          | `usePracticeController.ts:215`, `use-base-exercise.ts:380`, `packages/pitch-engine/src/pitch-detector.ts:565-574` | L         |
| W4  | Med  | Seven rooms mount `MercView` without `canRunLiveMerc()`; its renderer ignores tier, renders every frame at min(2, dpr) and has no `failIfMajorPerformanceCaveat`. Move the gate into MercView and honour `presentationFps()`/`renderScale()`.                                                                                                                                                       | `src/components/room-kit/MercView.tsx:90-97`, `src/lib/merc/renderer.ts:143-151,512`                              | S         |
| W5  | Med  | Headsets are invisible on the web: no check of `track.getSettings().sampleRate` or the device label, no route latency offset, no default compensation. Tip when sampleRate < 32000 or the label says hands-free/headset; seed the offset from `outputLatency` + track latency like `recording-latency.ts:40`.                                                                                       | `mic-manager.ts`, `audio-route-store.ts`, `mic-latency-store.ts`                                                  | M         |
| W6  | Med  | 4.7 MB first-paint JS, 1 MB blocking CSS, SW precaches everything on the first visit. Existing CSS split (#379).                                                                                                                                                                                                                                                                                    | `vite.config.ts:361-373`                                                                                          | (tracked) |
| W7  | Low  | Bug on any 48 kHz device: Compose pitch track hardcodes 44100, reads about 147 cents flat (visual).                                                                                                                                                                                                                                                                                                 | `src/lib/piano-roll.ts:1569,1580,1591`                                                                            | S         |
| W8  | Low  | Forced sample rates (PitchTestingTab 44.1 kHz with processing on, ShazamListen 16 kHz, jam monitor/detector 48 kHz); latency wizard anchors on `currentTime` not `e.playbackTime`; Energy Saver's 30 fps trips `SLOW_FRAME_MS` 28 and demotes for the session; stem-peaks keeps a live AudioContext to decode; wasm probe has no timeout before the jsDelivr fallback.                              | see audit notes                                                                                                   | S each    |

Dev tooling on a Windows box (secondary): add `* text=auto eol=lf` to
`.gitattributes`; make `scripts/gen-agent-index.mjs:141,148` emit forward-slash
links; give `spawnSync('pnpm')` in `scripts/pr-prepare.mjs:99` `shell: true` on
win32. `db:init*`, `size` and `audit:dup` stay POSIX-only and say so.

## Testing it regularly (parked)

No npm package emulates Windows. A user-agent or `navigator.platform` override
changes strings, not the GPU, audio stack or policies, so it would test nothing
real. The options that do test something:

| ID  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Models                                           | Cost               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------ |
| C1  | `windows-latest` GitHub Actions job: build, `vite preview`, run a Windows-tagged Playwright subset under Chromium and Edge (`channel: 'msedge'`, preinstalled on the image; check Playwright's support first). Hosted runners have no GPU, which is exactly the "hardware acceleration off" work PC: assert the tier lands on 'low', MercView falls back, UVR picks WASM. Include a two-peer jam test with fake media (`--use-fake-device-for-media-stream`) against `wrangler dev`. Run nightly and on a `windows` PR label, not on every PR. | Windows Chrome/Edge, software GPU, Windows paths | Free (public repo) |
| C2  | Restricted-network job on Linux (Docker Compose): app + jam worker + coturn; browser containers on an `internal` network whose only exit is a Squid proxy to 443. Variants: UDP dropped (iptables), WebSocket upgrade denied (Squid ACL), TLS-only. Assert J1's message, J3's verdict and a `relay`/`tls` path from J2. Uses coturn, so no Cloudflare TURN key enters CI.                                                                                                                                                                      | Corporate firewall and proxy                     | Free               |
| C3  | BrowserStack open-source programme for real Windows machines with real GPUs and Edge, run weekly or before a release. Check current terms and parallel limits before applying.                                                                                                                                                                                                                                                                                                                                                                 | Real Windows GPU and drivers                     | Free if accepted   |

CDP network throttling and `@sitespeed.io/throttle` only slow HTTP; they cannot
block UDP or WebSocket upgrades, so they do not replace C2.

## Order (parked after step 2)

1. Step 0 on the work PC and the home network, to decide whether J3 matters.
2. J1, J2, J4, J5: done. W4 and W7 remain small, independent PRs.
3. W1 and W2: the biggest wins for the Windows laptop case.
4. C1, which then guards W1, W2 and W4.
5. J3 with C2 behind it.
6. W3 (largest change), W5, then the W8 items and the tooling fixes.
