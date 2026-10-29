import { describe, expect, it } from 'vitest'
import { isLanHost, socketFailureMessage } from '@/lib/jam/signaling-errors'

describe('isLanHost', () => {
  it.each([
    'localhost',
    'app.localhost',
    '192.168.1.20',
    '10.0.0.5',
    '172.16.4.1',
    '127.0.0.1',
    'devbox',
    'studio.local',
    '[fd00::1]',
    '[::1]',
  ])('treats %s as local', (host) => {
    expect(isLanHost(host)).toBe(true)
  })

  it.each([
    'mercurypitch.com',
    'dev.mercurypitch.com',
    '8.8.8.8',
    '172.32.0.1',
  ])('treats %s as public', (host) => {
    expect(isLanHost(host)).toBe(false)
  })
})

describe('socketFailureMessage', () => {
  it('points at the network, not a certificate, on the public site', () => {
    const msg = socketFailureMessage(
      'wss://mercurypitch.com/api/jam/rooms/abc/signal',
    )
    expect(msg).toMatch(/network/i)
    expect(msg).not.toMatch(/certificate/i)
  })

  it('keeps the certificate advice for a LAN dev server', () => {
    const msg = socketFailureMessage(
      'wss://192.168.1.20:3000/api/jam/rooms/new',
    )
    expect(msg).toMatch(/certificate/)
    expect(msg).toContain('https://192.168.1.20:3000')
  })

  it('asks about the jam worker for plain ws on localhost', () => {
    expect(
      socketFailureMessage('ws://localhost:8787/api/jam/rooms/new'),
    ).toMatch(/dev:jam/)
  })

  it('survives a URL that does not parse', () => {
    expect(socketFailureMessage('not a url')).toMatch(/room server/)
  })
})
