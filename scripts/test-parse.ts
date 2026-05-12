import { searchLyricsMulti } from './src/lib/lyrics-service.ts';

searchLyricsMulti("Iron Maiden - Como Estais Amigos (2015 Remaster).mp3").then(res => {
  console.log("length:", res.length);
}).catch(console.error);
