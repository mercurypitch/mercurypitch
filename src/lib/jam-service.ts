// ── Jam service ─────────────────────────────────────────────────────
// Manages WebRTC peer connections for P2P audio + video streaming.
// Handles RTCPeerConnection lifecycle, Opus codec configuration,
// camera/mic capture, and track management.

import { createSignalingClient } from './jam-signaling'
import type { JamCallbacks, JamPeer } from './jam-types'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

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
  let disposed = false
  let videoEnabled = true
  let localDisplayName = ''

  const signaling = createSignalingClient({
    ...callbacks,
    onPeerJoined: (peer: JamPeer) => {
      initiateNewPeer(peer)
    },
    onPeerLeft: (peerId: string) => {
      const pc = peerConnections.get(peerId)
      if (pc) {
        pc.close()
        peerConnections.delete(peerId)
      }
      callbacks.onPeerLeft(peerId)
    },
    onOffer: (target, sdp) => {
      handleOffer(target, sdp).catch(() => {})
    },
    onAnswer: (target, sdp) => {
      handleAnswer(target, sdp).catch(() => {})
    },
    onIceCandidate: (target, candidate) => {
      handleIceCandidate(target, candidate).catch(() => {})
    },
  })

  // ── Room lifecycle ──────────────────────────────────────────────

  async function createRoom(displayName: string): Promise<void> {
    if (disposed) return
    localDisplayName = displayName
    await startLocalStream()
    signaling.createRoom(displayName)
  }

  async function joinRoom(roomId: string, displayName: string): Promise<void> {
    if (disposed) return
    localDisplayName = displayName
    await startLocalStream()
    signaling.connect(roomId, displayName)
  }

  function leaveRoom(): void {
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
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
        video: videoEnabled ? VIDEO_CONSTRAINTS : false,
      })
      if (videoEnabled) {
        const vt = localStream.getVideoTracks()[0]
        if (vt) localVideo = vt
      }
    } catch (err) {
      callbacks.onError('Microphone access denied or unavailable')
      throw err
    }
  }

  async function startLocalVideo(): Promise<void> {
    if (localVideo) return
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
      })
      const vt = videoStream.getVideoTracks()[0]
      if (vt) {
        localVideo = vt
        localStream?.addTrack(vt)
        for (const [, pc] of peerConnections) {
          pc.addTrack(vt, localStream!)
        }
        videoEnabled = true
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
  }

  function stopLocalStream(): void {
    localStream?.getTracks().forEach((t) => t.stop())
    localStream = null
    localVideo = null
    videoEnabled = false
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

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Add local audio track
    if (localStream) {
      localStream.getTracks().forEach((t) => {
        pc.addTrack(t, localStream!)
      })
    }

    // Handle remote audio track
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0]
      if (remoteStream !== undefined) {
        callbacks.onPeerStream(peer.id, remoteStream)
      }
    }

    pc.onconnectionstatechange = () => {
      const state = mapConnectionState(pc.connectionState)
      callbacks.onConnectionStateChange(peer.id, state)
    }

    pc.oniceconnectionstatechange = () => {
      // Measure RTT via stats when ICE connects
      if (pc.iceConnectionState === 'connected') {
        measureLatency(peer.id, pc)
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.sendIceCandidate(
          peer.id,
          JSON.stringify(event.candidate.toJSON()),
        )
      }
    }

    // Create DataChannel for chat
    const dc = pc.createDataChannel('chat')
    setupDataChannel(dc, peer.id)

    peerConnections.set(peer.id, pc)

    // Create and send offer
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    signaling.sendOffer(peer.id, JSON.stringify(offer))
  }

  async function handleOffer(target: string, sdp: string): Promise<void> {
    if (disposed) return

    let pc = peerConnections.get(target)
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      if (localStream) {
        localStream.getTracks().forEach((t) => {
          pc!.addTrack(t, localStream!)
        })
      }
      setupPeerHandlers(pc, target)
      peerConnections.set(target, pc)
    }

    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    signaling.sendAnswer(target, JSON.stringify(answer))
  }

  async function handleAnswer(target: string, sdp: string): Promise<void> {
    const pc = peerConnections.get(target)
    if (!pc || disposed) return
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
  }

  async function handleIceCandidate(
    target: string,
    candidate: string,
  ): Promise<void> {
    const pc = peerConnections.get(target)
    if (!pc || disposed) return
    try {
      await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
    } catch {
      // Ignore malformed candidates
    }
  }

  function setupPeerHandlers(pc: RTCPeerConnection, peerId: string): void {
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0]
      if (remoteStream !== undefined) {
        callbacks.onPeerStream(peerId, remoteStream)
      }
    }
    pc.ondatachannel = (event) => {
      const dc = event.channel
      if (dc.label === 'chat') {
        setupDataChannel(dc, peerId)
      }
    }
    pc.onconnectionstatechange = () => {
      callbacks.onConnectionStateChange(
        peerId,
        mapConnectionState(pc.connectionState),
      )
    }
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') {
        measureLatency(peerId, pc)
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
  }

  // ── Chat via DataChannel ─────────────────────────────────────────

  function setupDataChannel(dc: RTCDataChannel, peerId: string): void {
    dataChannels.set(peerId, dc)
    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'chat') {
          callbacks.onChatMessage({
            id: data.id,
            peerId,
            displayName: data.displayName,
            text: data.text,
            timestamp: data.timestamp,
          })
        }
      } catch {
        // Ignore malformed chat messages
      }
    }
  }

  function sendChat(text: string): void {
    const msg = {
      type: 'chat',
      id: crypto.randomUUID(),
      text,
      displayName: localDisplayName,
      timestamp: Date.now(),
    }
    const raw = JSON.stringify(msg)
    for (const [, dc] of dataChannels) {
      if (dc.readyState === 'open') {
        dc.send(raw)
      }
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
