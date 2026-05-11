import { searchLyricsMulti, searchLyrics } from './src/lib/lyrics-service.ts';

async function run() {
  console.log("searchLyricsMulti:");
  const m = await searchLyricsMulti("Iron Maiden - Como Estais Amigos (2015 Remaster).mp3");
  console.log(m.length, m.map(x => x.title).slice(0, 3));

  console.log("\nsearchLyrics:");
  const s = await searchLyrics("Iron Maiden - Como Estais Amigos (2015 Remaster).mp3");
  console.log(s ? "FOUND" : "NULL");
}

run().catch(console.error);
