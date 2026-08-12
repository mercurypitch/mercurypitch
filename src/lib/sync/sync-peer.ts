// ── Sync peer ────────────────────────────────────────────────────────
// A WebRTC connection that carries only data, for moving songs between
// two of one person's devices.
//
// This is the jam room's connection choreography — same signaling worker,
// same glare rule, same ICE buffering — with everything about media cut
// out. No getUserMedia, no tracks, no renegotiation-for-video: the mic is
// never touched, so none of the MicManager rules apply here. The room a
// sync session uses is an ordinary jam-worker room; the worker relays SDP
// either way and never sees what the DataChannel carries.
//
// Deliberately its own small module rather than a mode of jam/service.ts:
// that service owns microphone capture, transmit-clone processing and ICE
// restart for hour-long rooms, none of which a two-minute transfer wants
// to inherit. When the jam room's planned transfer refactor lands, it can
// adopt this shape; until then the shared pieces (signaling client, ICE
// servers, chunking, hashing, relay detection) are imported, not copied.
//
// See docs/plans/device-sync.md (Phase 5).

import { FALLBACK_ICE_SERVERS, getIceServers, resetIceServers, } from '@/lib/jam/ice-servers'
import { createSignalingClient } from '@/lib/jam/signaling'
import type { JamPeer } from '@/lib/jam/types'

export interface SyncPeerCallbacks {
  /** The channel to this peer is open — the protocol can start. */
  onChannelReady: (peerId: string, displayName: string) => void
  onPeerLeft: (peerId: string) => void
  /** A parsed JSON control frame from this peer. */
  onControl: (peerId: string, msg: Record<string, unknown>) => void
  /** A slice of part bytes from this peer. */
  onChunk: (peerId: string, bytes: ArrayBuffer) => void
  onError: (message: string) => void
  onRoomClosed: () => void
}

export function createSyncPeer(cb: SyncPeerCallbacks) {
  const peerConnections = new Map<string, RTCPeerConnection>()
  const dataChannels = new Map<string, RTCDataChannel>()
  const pendingCandidates = new Map<string, string[]>()
  const displayNames = new Map<string, string>()
  let iceServers: RTCIceServer[] = FALLBACK_ICE_SERVERS
  let disposed = false

  const signaling = createSignalingClient(
    {
      onPeerJoined: (peer: JamPeer) => {
        if (disposed) return
        displayNames.set(peer.id, peer.displayName)
        // Same glare rule as the jam room: the peer with the greater id
        // initiates, and if ours is not known yet we initiate anyway and
        // let handleOffer's rollback resolve the collision.
        const myId = signaling.getPeerId()
        if (myId === null || myId === '' || myId > peer.id) {
          initiateNewPeer(peer.id).catch((err) =>
            console.warn('[sync:peer] initiate failed', err),
          )
        }
      },
      onPeerLeft: (peerId: string) => {
        dropPeer(peerId)
        cb.onPeerLeft(peerId)
      },
      onOffer: (from, sdp) => {
        handleOffer(from, sdp).catch((err) =>
          console.warn('[sync:peer] handleOffer failed', err),
        )
      },
      onAnswer: (from, sdp) => {
        handleAnswer(from, sdp).catch((err) =>
          console.warn('[sync:peer] handleAnswer failed', err),
        )
      },
      onIceCandidate: (from, candidate) => {
        handleIceCandidate(from, candidate).catch(() => {})
      },
      onRoomClosed: () => cb.onRoomClosed(),
      onError: (message) => cb.onError(message),
      // Required by the shared callbacks type; the signaling client never
      // calls these — they belong to the media half this module cut out.
      onPeerStream: () => {},
      onConnectionStateChange: () => {},
      onLatencyUpdate: () => {},
      onChatMessage: () => {},
    },
    // A sync room must not appear in the jam lobby as a room to rejoin.
    { rememberRooms: false },
  )

  async function createRoom(displayName: string): Promise<void> {
    if (disposed) return
    iceServers = await getIceServers()
    signaling.createRoom(displayName)
  }

  async function joinRoom(roomId: string, displayName: string): Promise<void> {
    if (disposed) return
    iceServers = await getIceServers()
    signaling.connect(roomId, displayName)
  }

  function leaveRoom(): void {
    resetIceServers()
    iceServers = FALLBACK_ICE_SERVERS
    for (const id of [...peerConnections.keys()]) dropPeer(id)
    signaling.leaveRoom()
  }

  function dropPeer(peerId: string): void {
    dataChannels.get(peerId)?.close()
    dataChannels.delete(peerId)
    peerConnections.get(peerId)?.close()
    peerConnections.delete(peerId)
    pendingCandidates.delete(peerId)
    displayNames.delete(peerId)
  }

  async function initiateNewPeer(peerId: string): Promise<void> {
    if (disposed || peerConnections.has(peerId)) return
    const pc = new RTCPeerConnection({ iceServers })
    setupPeerHandlers(pc, peerId)
    // Created before the offer, so the channel rides the first and only
    // negotiation — a data-only connection never has a second one.
    const dc = pc.createDataChannel('sync')
    setupDataChannel(dc, peerId)
    peerConnections.set(peerId, pc)
  }

  async function handleOffer(from: string, sdp: string): Promise<void> {
    if (disposed) return
    let pc = peerConnections.get(from)
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers })
      setupPeerHandlers(pc, from)
      peerConnections.set(from, pc)
    } else if (pc.signalingState === 'have-local-offer') {
      // Glare: the polite peer (smaller id) rolls back, the impolite one
      // ignores the incoming offer. Same split the jam room uses.
      const myId = signaling.getPeerId()
      if (myId !== null && myId !== '' && myId < from) {
        await pc.setLocalDescription({ type: 'rollback' })
      } else {
        return
      }
    }
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
    await drainCandidates(pc, from)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    signaling.sendAnswer(from, JSON.stringify(answer))
  }

  async function handleAnswer(from: string, sdp: string): Promise<void> {
    const pc = peerConnections.get(from)
    if (!pc || disposed) return
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
    await drainCandidates(pc, from)
  }

  async function drainCandidates(
    pc: RTCPeerConnection,
    from: string,
  ): Promise<void> {
    const pending = pendingCandidates.get(from)
    if (pending === undefined) return
    pendingCandidates.delete(from)
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
      } catch {
        // A malformed candidate is not worth a broken join.
      }
    }
  }

  async function handleIceCandidate(
    from: string,
    candidate: string,
  ): Promise<void> {
    const pc = peerConnections.get(from)
    // Candidates can outrun the offer; buffer until the description lands.
    if (!pc || !pc.remoteDescription || disposed) {
      if (!disposed) {
        const pending = pendingCandidates.get(from) ?? []
        pending.push(candidate)
        pendingCandidates.set(from, pending)
      }
      return
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
    } catch {
      // Ignore — a lost candidate just narrows the paths ICE can try.
    }
  }

  function setupPeerHandlers(pc: RTCPeerConnection, peerId: string): void {
    pc.ondatachannel = (event) => {
      if (event.channel.label === 'sync') {
        setupDataChannel(event.channel, peerId)
      }
    }
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.sendIceCandidate(
          peerId,
          JSON.stringify(event.candidate.toJSON()),
        )
      }
    }
    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== 'stable') return
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        signaling.sendOffer(peerId, JSON.stringify(offer))
      } catch (err) {
        console.warn('[sync:peer] negotiation failed for', peerId, err)
      }
    }
    // No ICE-restart machinery on purpose: a sync session lives minutes,
    // not hours, and the honest answer to a dropped pair mid-transfer is
    // the retry the protocol already has — not a renegotiation dance.
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        cb.onError('The connection between the devices was lost.')
      }
    }
  }

  function setupDataChannel(dc: RTCDataChannel, peerId: string): void {
    dataChannels.set(peerId, dc)
    // Part bytes arrive as raw binary; without this they would surface as
    // a Blob in some browsers and an ArrayBuffer in others.
    dc.binaryType = 'arraybuffer'
    dc.onopen = () => {
      cb.onChannelReady(peerId, displayNames.get(peerId) ?? 'Another device')
    }
    dc.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        cb.onChunk(peerId, event.data)
        return
      }
      if (typeof event.data !== 'string') return
      try {
        const msg: unknown = JSON.parse(event.data)
        if (typeof msg === 'object' && msg !== null) {
          cb.onControl(peerId, msg as Record<string, unknown>)
        }
      } catch {
        // A frame that does not parse is a peer speaking a protocol this
        // build does not know. Ignoring it beats crashing the transfer.
      }
    }
  }

  function sendControl(peerId: string, msg: object): boolean {
    const dc = dataChannels.get(peerId)
    if (dc?.readyState !== 'open') return false
    dc.send(JSON.stringify(msg))
    return true
  }

  /** The raw channel, for a transfer to drive with backpressure. */
  function channelTo(peerId: string): RTCDataChannel | null {
    return dataChannels.get(peerId) ?? null
  }

  /** The connection, so a transfer can ask whether its route is relayed. */
  function connectionTo(peerId: string): RTCPeerConnection | null {
    return peerConnections.get(peerId) ?? null
  }

  function dispose(): void {
    disposed = true
    for (const id of [...peerConnections.keys()]) dropPeer(id)
    resetIceServers()
    signaling.disconnect()
  }

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    dispose,
    sendControl,
    channelTo,
    connectionTo,
    getRoomId: () => signaling.getRoomId(),
    getPeerId: () => signaling.getPeerId(),
  }
}

export type SyncPeer = ReturnType<typeof createSyncPeer>
