// Stub Durable Object — actual implementation runs in the UVR Docker container.
// Wrangler requires this class to be exported so it can validate the binding,
// but at runtime the platform routes requests to the container's HTTP server.
export class UvrContainer {
  async fetch() {
    return new Response('UVR container not available', { status: 503 })
  }
}
