// ── Jam service ─────────────────────────────────────────────────────
// Manages WebRTC peer connections for P2P audio + video streaming.
// Handles RTCPeerConnection lifecycle, Opus codec configuration,
// camera/mic capture, and track management.

import type { MelodyData } from '@/types'
import { decideIceRestart, DISCONNECTED_GRACE_MS } from './ice-recovery'
import { FALLBACK_ICE_SERVERS, getIceServers, resetIceServers, } from './ice-servers'
import { micErrorMessage, micPermissionState } from './media-errors'
import { createSignalingClient } from './signaling'
import type { JamCallbacks, JamPeer } from './types'

// Audio constraints optimized for music — disable all processing
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
}

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 15 },
}

export function createJamService(callbacks: JamCallbacks) {
  let localStream: MediaStream | null = null
  let localVideo: MediaStreamTrack | null = null
  const peerConnections = new Map<string, RTCPeerConnection>()
  const dataChannels = new Map<string, RTCDataChannel>()
  const pendingCandidates = new Map<string, string[]>()
  /** ICE restart attempts per peer, reset once the pair connects. */
  const iceRetries = new Map<string, number>()
  const iceRecoveryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  /**
   * Fetched once when the room is entered. Starts as the STUN-only fallback
   * so a peer connection built before the fetch lands still has somewhere to
   * look, rather than being constructed with nothing.
   */
  let iceServers: RTCIceServer[] = FALLBACK_ICE_SERVERS
  let disposed = false
  let videoEnabled = false
  let localDisplayName = ''

  const signaling = createSignalingClient({
    ...callbacks,
    onPeerJoined: (peer: JamPeer) => {
      callbacks.onPeerJoined(peer)
      // Only initiate connection if our ID > peer ID to prevent glare.
      // If our ID is not yet known, always initiate — handleOffer will resolve glare.
      const myId = signaling.getPeerId()
      console.info(
        '[jam:service] onPeerJoined',
        peer.id,
        'myId=',
        myId,
        'will initiate=',
        myId === null || myId === '' || myId > peer.id,
      )
      if (myId === null || myId === '' || myId > peer.id) {
        console.info('[jam:service] initiating connection to', peer.id)
        initiateNewPeer(peer).catch((err) =>
          console.error('[jam:service] initiateNewPeer failed', err),
        )
      } else {
        console.info(
          '[jam:service] waiting for peer',
          peer.id,
          'to initiate (their ID is greater)',
        )
      }
    },
    onPeerLeft: (peerId: string) => {
      const pc = peerConnections.get(peerId)
      if (pc) {
        pc.close()
        peerConnections.delete(peerId)
      }
      const dc = dataChannels.get(peerId)
      if (dc) {
        dc.close()
        dataChannels.delete(peerId)
      }
      pendingCandidates.delete(peerId)
      callbacks.onPeerLeft(peerId)
    },
    onOffer: (from, sdp) => {
      handleOffer(from, sdp).catch((err) =>
        console.warn('[Jam] handleOffer failed:', err),
      )
    },
    onAnswer: (from, sdp) => {
      handleAnswer(from, sdp).catch((err) =>
        console.warn('[Jam] handleAnswer failed:', err),
      )
    },
    onIceCandidate: (from, candidate) => {
      handleIceCandidate(from, candidate).catch((err) =>
        console.info('[Jam] ICE candidate failed:', err),
      )
    },
  })

  // ── Room lifecycle ──────────────────────────────────────────────

  async function createRoom(displayName: string): Promise<void> {
    if (disposed) return
    localDisplayName = displayName
    // Alongside the mic, not after it: both are prerequisites for a usable
    // connection and neither depends on the other, so serialising them would
    // just add the slower one's latency to entering a room.
    const [servers] = await Promise.all([getIceServers(), startLocalStream()])
    iceServers = servers
    signaling.createRoom(displayName)
  }

  async function joinRoom(roomId: string, displayName: string): Promise<void> {
    if (disposed) return
    localDisplayName = displayName
    const [servers] = await Promise.all([getIceServers(), startLocalStream()])
    iceServers = servers
    signaling.connect(roomId, displayName)
  }

  function leaveRoom(): void {
    // Credentials are short-lived; the next room mints its own.
    resetIceServers()
    iceServers = FALLBACK_ICE_SERVERS
    for (const [, dc] of dataChannels) {
      dc.close()
    }
    dataChannels.clear()
    for (const [id, pc] of peerConnections) {
      pc.close()
      peerConnections.delete(id)
    }
    signaling.leaveRoom()
  }

  // ── Local audio ─────────────────────────────────────────────────

  async function startLocalStream(): Promise<void> {
    if (localStream) return
    // Request audio first — always required
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
        video: false,
      })
    } catch (err) {
      // Ask the browser what it already decided, so a site-level Block --
      // which never shows a prompt -- is named as such instead of looking
      // like a permission the user simply has not granted yet.
      const blocked = (await micPermissionState()) === 'denied'
      callbacks.onError(micErrorMessage(err, blocked))
      throw err
    }
    // Request video separately — failure is non-fatal
    if (videoEnabled) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: VIDEO_CONSTRAINTS,
        })
        const vt = videoStream.getVideoTracks()[0]
        if (vt !== undefined) {
          localVideo = vt
          localStream.addTrack(vt)
        }
      } catch {
        videoEnabled = false
      }
    }
  }

  async function startLocalVideo(): Promise<void> {
    if (localVideo) return
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
      })
      const vt = videoStream.getVideoTracks()[0]
      if (vt !== undefined) {
        localVideo = vt
        localStream?.addTrack(vt)
        for (const [, pc] of peerConnections) {
          pc.addTrack(vt, localStream!)
        }
        videoEnabled = true
        broadcastVideoState(true)
      }
    } catch {
      callbacks.onError('Camera access denied or unavailable')
    }
  }

  function stopLocalVideo(): void {
    if (localVideo) {
      localVideo.stop()
      if (localStream) localStream.removeTrack(localVideo)
      localVideo = null
      videoEnabled = false
      broadcastVideoState(false)
    }
  }

  async function setVideoEnabled(enabled: boolean): Promise<void> {
    if (enabled && !localVideo) {
      await startLocalVideo()
      return
    }
    if (!localVideo) return
    videoEnabled = enabled
    localVideo.enabled = enabled
    for (const [, pc] of peerConnections) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) {
        await sender.replaceTrack(enabled ? localVideo : null)
      }
    }
    broadcastVideoState(enabled)
  }

  function stopLocalStream(): void {
    localStream?.getTracks().forEach((t) => t.stop())
    localStream = null
    localVideo = null
    videoEnabled = false
    broadcastVideoState(false)
  }

  function setMuted(muted: boolean): void {
    if (!localStream) return
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = !muted
    })
  }

  // ── Peer connection management ──────────────────────────────────

  async function initiateNewPeer(peer: JamPeer): Promise<void> {
    if (disposed || peerConnections.has(peer.id)) return

    console.info('[jam:service] initiating connection to', peer.id)
    const pc = new RTCPeerConnection({ iceServers: iceServers })

    // Add local audio track
    if (localStream) {
      localStream.getTracks().forEach((t) => {
        pc.addTrack(t, localStream!)
      })
    }

    setupPeerHandlers(pc, peer.id)

    // Create DataChannel for chat
    const dc = pc.createDataChannel('chat')
    setupDataChannel(dc, peer.id)

    peerConnections.set(peer.id, pc)
  }

  async function handleOffer(from: string, sdp: string): Promise<void> {
    if (disposed) return

    let pc = peerConnections.get(from)
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: iceServers })
      if (localStream) {
        localStream.getTracks().forEach((t) => {
          pc!.addTrack(t, localStream!)
        })
      }
      setupPeerHandlers(pc, from)
      peerConnections.set(from, pc)
    } else if (pc.signalingState === 'have-local-offer') {
      // Glare detection — both peers sent offers at the same time.
      // The "polite" peer (lexicographically smaller ID) rolls back and
      // accepts the incoming offer. The "impolite" peer ignores it.
      const myId = signaling.getPeerId()
      if (myId !== null && myId !== '' && myId < from) {
        // We are polite — roll back our local offer and handle the remote
        console.info(
          '[jam] glare: rolling back local offer for polite peer',
          myId,
          '<',
          from,
        )
        await pc.setLocalDescription({ type: 'rollback' })
      } else {
        // We are impolite — ignore the incoming offer (ours wins)
        console.info(
          '[jam] glare: ignoring incoming offer from polite peer',
          from,
        )
        return
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))

    // Process any buffered ICE candidates
    const pending = pendingCandidates.get(from)
    if (pending) {
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
        } catch (_e) {
          // Ignore candidate errors
        }
      }
      pendingCandidates.delete(from)
    }

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    signaling.sendAnswer(from, JSON.stringify(answer))
  }

  async function handleAnswer(from: string, sdp: string): Promise<void> {
    const pc = peerConnections.get(from)
    if (!pc || disposed) return
    console.info('[jam:service] received answer from', from)
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))

    // Process any buffered ICE candidates
    const pending = pendingCandidates.get(from)
    if (pending) {
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
        } catch (err) {
          console.warn(
            '[jam:service] failed to add buffered ICE candidate',
            err,
          )
        }
      }
      pendingCandidates.delete(from)
    }
  }

  async function handleIceCandidate(
    from: string,
    candidate: string,
  ): Promise<void> {
    const pc = peerConnections.get(from)

    // Buffer candidate if pc doesn't exist OR remote description is not set yet
    if (!pc || !pc.remoteDescription || disposed) {
      if (!disposed) {
        const pending = pendingCandidates.get(from) || []
        pending.push(candidate)
        pendingCandidates.set(from, pending)
        console.info(`[jam:service] buffered ICE candidate from ${from}`)
      }
      return
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
    } catch (err) {
      console.warn('[jam:service] failed to add ICE candidate', err)
    }
  }

  /**
   * Wrap an event callback so a bug inside it cannot kill the session.
   *
   * These fire outside Solid's render, so the tab's ErrorBoundary never
   * sees them: an exception here escapes to window.onerror and takes the
   * app down. A jam that loses one handler is recoverable; a jam that
   * takes the app with it is not.
   */
  function guarded<A extends unknown[]>(
    label: string,
    fn: (...args: A) => void,
  ): (...args: A) => void {
    return (...args: A) => {
      try {
        fn(...args)
      } catch (err) {
        console.error(`[jam:service] ${label} threw`, err)
      }
    }
  }

  function setupPeerHandlers(pc: RTCPeerConnection, peerId: string): void {
    pc.ontrack = (event) => {
      console.info(
        '[jam:service] ontrack from',
        peerId,
        'streams:',
        event.streams.length,
      )
      const remoteStream = event.streams[0]
      if (remoteStream !== undefined) {
        callbacks.onPeerStream(peerId, remoteStream)
      }
    }
    pc.ondatachannel = (event) => {
      console.info('[jam:service] received DataChannel from', peerId)
      const dc = event.channel
      if (dc.label === 'chat') {
        setupDataChannel(dc, peerId)
      }
    }
    pc.onconnectionstatechange = guarded('onconnectionstatechange', () => {
      console.info('[jam:service] connection state', peerId, pc.connectionState)
      callbacks.onConnectionStateChange(
        peerId,
        mapConnectionState(pc.connectionState),
      )
    })
    pc.oniceconnectionstatechange = guarded(
      'oniceconnectionstatechange',
      () => {
        console.info('[jam:service] ICE state', peerId, pc.iceConnectionState)
        if (pc.iceConnectionState === 'connected') {
          iceRetries.delete(peerId)
          clearIceRecovery(peerId)
          measureLatency(peerId, pc)
          return
        }
        // A connection that fails stays failed. Switching WiFi to cellular,
        // a NAT rebinding, a laptop waking up -- any of these drop the pair
        // permanently unless ICE is restarted, which is why a jam could go
        // quiet with both sides still believing they were in the room.
        if (pc.iceConnectionState === 'failed') {
          recoverIce(pc, peerId, 'failed')
          return
        }
        // 'disconnected' often heals by itself within a few seconds. Give it
        // that chance before spending a renegotiation on it, but do not wait
        // for 'failed', which some browsers take 30s or more to declare.
        if (pc.iceConnectionState === 'disconnected') {
          clearIceRecovery(peerId)
          iceRecoveryTimers.set(
            peerId,
            setTimeout(() => {
              iceRecoveryTimers.delete(peerId)
              if (pc.iceConnectionState === 'disconnected') {
                recoverIce(pc, peerId, 'disconnected')
              }
            }, DISCONNECTED_GRACE_MS),
          )
        }
      },
    )
    pc.onicecandidate = guarded(
      'onicecandidate',
      (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          signaling.sendIceCandidate(
            peerId,
            JSON.stringify(event.candidate.toJSON()),
          )
        }
      },
    )

    // Handle renegotiation for dynamic tracks (e.g. enabling video)
    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== 'stable') return
        console.info('[jam:service] negotiation needed for', peerId)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        signaling.sendOffer(peerId, JSON.stringify(offer))
      } catch (err) {
        console.error('[jam:service] negotiation error for', peerId, err)
      }
    }
  }

  // ── DataChannel dispatch ─────────────────────────────────────────

  function setupDataChannel(dc: RTCDataChannel, peerId: string): void {
    dataChannels.set(peerId, dc)
    dc.onopen = () => {
      console.info('[jam:service] DataChannel open to', peerId)
      dc.send(JSON.stringify({ type: 'video-state', enabled: videoEnabled }))
    }
    dc.onclose = () => {
      console.info('[jam:service] DataChannel closed to', peerId)
    }
    dc.onerror = (event) => {
      console.info('[jam:service] DataChannel error to', peerId, event)
    }
    dc.onmessage = (event) => {
      try {
        // Peer payloads are untrusted: a binary frame or a non-string body
        // would throw out of JSON.parse into the catch below, but being
        // explicit keeps the failure a parse error rather than a surprise.
        if (typeof event.data !== 'string') return
        const data = JSON.parse(event.data)
        console.info(
          '[jam:service] DataChannel recv',
          data.type,
          'from',
          peerId,
        )
        switch (data.type) {
          case 'chat':
            callbacks.onChatMessage({
              id: data.id,
              peerId,
              displayName: data.displayName,
              text: data.text,
              timestamp: data.timestamp,
            })
            break
          case 'pitch':
            callbacks.onPitchMessage?.(data)
            break
          case 'melody':
            callbacks.onMelodyMessage?.(data)
            break
          case 'playback':
            callbacks.onPlaybackMessage?.(data, peerId)
            break
          case 'video-state':
            callbacks.onVideoState?.(peerId, data.enabled)
            break
        }
      } catch (err) {
        console.warn('[jam:service] DataChannel parse error', err)
      }
    }
  }

  // ── Broadcast helpers ────────────────────────────────────────────

  function broadcastVideoState(enabled: boolean): void {
    broadcastData({ type: 'video-state', enabled })
  }

  function sendChat(text: string): void {
    const msg = {
      type: 'chat' as const,
      id: globalThis.crypto.randomUUID(),
      text,
      displayName: localDisplayName,
      timestamp: Date.now(),
    }
    broadcastData(msg)
  }

  /** `beat` is the sender's room beat, omitted when nothing is playing. */
  function sendPitch(
    pitch: {
      frequency: number
      noteName: string
      cents: number
      clarity: number
      midi: number
    },
    beat?: number,
  ): void {
    const peerId = signaling.getPeerId()
    if (peerId === null || peerId === '') return
    broadcastData({
      type: 'pitch' as const,
      peerId,
      ...pitch,
      timestamp: Date.now(),
      ...(beat === undefined ? {} : { beat }),
    })
  }

  function sendMelody(melody: MelodyData, mode?: string): void {
    broadcastData({ type: 'melody' as const, action: 'set', melody, mode })
  }

  function sendClearMelody(): void {
    broadcastData({ type: 'melody' as const, action: 'clear' })
  }

  function sendPlaybackCommand(
    action: 'play' | 'pause' | 'stop' | 'seek',
    currentBeat?: number,
    bpm?: number,
  ): void {
    broadcastData({
      type: 'playback' as const,
      action,
      currentBeat,
      timestamp: Date.now(),
      ...(bpm === undefined ? {} : { bpm }),
    })
  }

  function broadcastData(msg: object): void {
    const raw = JSON.stringify(msg)
    for (const [, dc] of dataChannels) {
      if (dc.readyState === 'open') {
        dc.send(raw)
      }
    }
  }

  // ── ICE recovery ────────────────────────────────────────────────

  /**
   * Restart ICE on a broken pair.
   *
   * Only the IMPOLITE peer restarts. Perfect negotiation can survive both
   * sides restarting at once, but it costs a rollback and a second round
   * trip every time, and on a mesh that multiplies by the number of pairs.
   * The polite side simply waits for the offer -- the same role split the
   * glare handling already uses, so there is one rule to reason about.
   */
  function recoverIce(
    pc: RTCPeerConnection,
    peerId: string,
    reason: string,
  ): void {
    clearIceRecovery(peerId)
    const tries = iceRetries.get(peerId) ?? 0
    const decision = decideIceRestart(signaling.getPeerId(), peerId, tries)
    if (!decision.restart) {
      console.info(
        '[jam:service] ICE',
        reason,
        peerId,
        '- no restart:',
        decision.why,
      )
      return
    }
    iceRetries.set(peerId, tries + 1)
    console.info(
      '[jam:service] ICE',
      reason,
      peerId,
      '- restarting, attempt',
      tries + 1,
    )
    try {
      // Fires negotiationneeded, which the existing handler turns into a
      // fresh offer -- so restart flows through one code path, not two.
      pc.restartIce()
    } catch (err) {
      console.warn('[jam:service] ICE restart failed for', peerId, err)
    }
  }

  function clearIceRecovery(peerId: string): void {
    const timer = iceRecoveryTimers.get(peerId)
    if (timer !== undefined) {
      clearTimeout(timer)
      iceRecoveryTimers.delete(peerId)
    }
  }

  // ── Latency measurement ─────────────────────────────────────────

  async function measureLatency(
    peerId: string,
    pc: RTCPeerConnection,
  ): Promise<void> {
    try {
      const stats = await pc.getStats()
      let rtt = 0
      stats.forEach((report) => {
        if (
          report.type === 'candidate-pair' &&
          'currentRoundTripTime' in report
        ) {
          rtt = (report.currentRoundTripTime as number) * 1000
        }
      })
      if (rtt > 0) {
        callbacks.onLatencyUpdate(peerId, Math.round(rtt))
      }
    } catch {
      // Stats not available
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  function dispose(): void {
    disposed = true
    for (const [, dc] of dataChannels) {
      dc.close()
    }
    dataChannels.clear()
    for (const [, pc] of peerConnections) {
      pc.close()
    }
    peerConnections.clear()
    stopLocalStream()
    signaling.disconnect()
  }

  function getLocalStream(): MediaStream | null {
    return localStream
  }

  function getRoomId(): string | null {
    return signaling.getRoomId()
  }

  function getPeerId(): string | null {
    return signaling.getPeerId()
  }

  function getVideoEnabled(): boolean {
    return videoEnabled
  }

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    setMuted,
    setVideoEnabled,
    startLocalVideo,
    stopLocalVideo,
    sendChat,
    sendPitch,
    sendMelody,
    sendClearMelody,
    sendPlaybackCommand,
    getLocalStream,
    getRoomId,
    getPeerId,
    getVideoEnabled,
    dispose,
  }
}

function mapConnectionState(
  state: RTCPeerConnectionState,
): JamPeer['connectionState'] {
  switch (state) {
    case 'new':
    case 'connecting':
      return 'connecting'
    case 'connected':
      return 'connected'
    case 'disconnected':
      return 'disconnected'
    case 'failed':
    case 'closed':
      return 'failed'
    default:
      return 'disconnected'
  }
}
