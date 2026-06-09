# Jam Session — Testing & Deployment

## Architecture

Jam sessions run over WebRTC peer-to-peer mesh with a Cloudflare Durable Object
signaling relay.

```
Browser A  <── WebRTC (audio/video/data) ──>  Browser B
     │                                            │
     └── WebSocket ──>  JamRoom DO  <── WebSocket ──┘
                         (signaling)
```

The `/api/jam` endpoint is proxied to the jam-worker (port 8787) during development.

## Local Testing

### 1. Start the Vite dev server

```bash
pnpm dev:host
```

This starts Vite on port 3000 with `--host` so it's reachable from other devices.

### 2. Start the jam signaling worker

In a separate terminal:

```bash
pnpm dev:jam
```

This runs the Cloudflare Worker locally on port 8787. It provides the WebSocket
signaling relay that peers use to exchange WebRTC SDP/ICE offers.

### 3. Open two browser tabs

Open `http://localhost:3000` in two tabs (or two different browsers, or two
devices on the same network).

**Tab A:**
1. Enter a display name
2. Click "Create Room"
3. Copy the room code or link

**Tab B:**
1. Enter a display name
2. Paste the room code and click "Join Room"

Both tabs should show each other's audio/video streams, pitch data, and chat.

### 4. Testing with two devices

If testing with two physical devices on the same network:
- Use `pnpm dev:host` (binds to 0.0.0.0)
- Find your machine's local IP: `hostname -I` or `ip addr show`
- On device B, open `http://<YOUR_IP>:3000`
- The jam worker WebSocket proxies to `localhost:8787` — works for both

### 5. Hash-based room links

Room links use hash fragments: `http://localhost:3000/#/jam:ROOMID`

When you paste this URL in a browser:
1. The hash router parses `jam:ROOMID` and switches to the Jam tab
2. JamPanel auto-joins the room on mount
3. No manual entry needed

## Feature Verification Checklist

| Feature | What to check |
|---------|---------------|
| Create room | Click "Create Room" → session state shows "active", room code visible |
| Join room | Enter room code → click "Join Room" → connects to creator |
| Audio/video | Both peers see each other's video tiles |
| Mute/Cam toggle | Buttons toggle mute/camera states |
| Pitch display | Real-time note name + frequency + cents bar below video grid |
| Shared pitch tab | Colored dots per peer on scrolling pitch canvas |
| Exercise tab | Host selects melody → both sides see notes + pitch overlay |
| Chat tab | Text messages appear in real-time, Enter to send |
| Copy buttons | Room code + link copy to clipboard with "Copied!" feedback |
| Leave | "Leave" button returns to idle state, notifies peers |

## Cloudflare Worker Deployment

### Prerequisites

- Cloudflare account with Workers and Durable Objects enabled
- Wrangler CLI installed (`npx wrangler --version`)

### Deploy the signaling worker

```bash
# Deploy to dev environment (dev.mercurypitch.com)
cd workers/jam-worker
npx wrangler deploy --env dev

# Deploy to production (mercurypitch.com)
npx wrangler deploy --env prod
```

The jam worker is a Cloudflare Worker with a Durable Object named `JamRoom`.
Each room is a Durable Object instance — WebSocket connections are routed to
the correct DO instance based on the room ID in the URL path.

### Durable Object migration

If the DO class schema changes, increment the migration tag in
`workers/jam-worker/wrangler.jsonc`:

```jsonc
"migrations": [
  { "tag": "v2", "new_classes": ["JamRoom"] }
]
```

### Deploy the main app

```bash
# Dev environment
pnpm deploy:dev

# Production
pnpm deploy:prod
```

This builds the Vite app and deploys to Cloudflare Pages via wrangler.

## Troubleshooting

### No peer connection (two tabs show only themselves)

1. Check the browser console for WebSocket errors to `ws://localhost:8787`
2. Ensure the jam worker is running (`pnpm dev:jam`)
3. Try hard-refreshing both tabs

### No audio heard between peers

1. Check both tabs have the mic unmuted
2. Check browser permissions for microphone access
3. Verify the WebRTC ICE connection state in `about:webrtc` (Chrome) or `about:webrtc` (Firefox)

### Pitch display shows "Listening..." indefinitely

1. Ensure microphone access is granted
2. Check that `jamLocalStream` is available (video tile shows camera feed)
3. Check console for AudioContext errors

### Stale build in wrangler dev

If the jam worker seems to be running old code:
```bash
cd workers/jam-worker
npx wrangler dev --port 8787  # restart the worker
```

## Production URLs

- Production: https://mercurypitch.com
- Dev: https://dev.mercurypitch.com
- Jam rooms: https://mercurypitch.com/#/jam:ROOMID
