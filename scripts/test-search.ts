async function run() {
  const q = "Como Estais Amigos";
  const params = new URLSearchParams();
  params.set('q', q);
  const resp = await fetch(`https://lrclib.net/api/search?${params.toString()}`);
  console.log(resp.status);
  const data = await resp.json();
  console.log(data.length);
}
run().catch(console.error);
