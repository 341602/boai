const { getLyric, getSongUrl, searchSongs } = require('./lib/migu-service');

async function run() {
  const searchResult = await searchSongs({ keyword: '周杰伦', pageSize: 1 });
  const song = searchResult.list[0];

  if (!song) {
    throw new Error('No song found');
  }

  const [url, lyric] = await Promise.all([
    getSongUrl({ cid: song.cid }),
    getLyric({ cid: song.cid }),
  ]);

  console.log({
    keyword: '周杰伦',
    song: song.name,
    cid: song.cid,
    url: url.slice(0, 80),
    lyricLength: lyric.length,
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
