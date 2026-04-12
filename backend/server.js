const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Readable } = require('stream');
const {
  getLyric,
  getSongDetail,
  getSongUrl,
  searchSongs,
} = require('./lib/migu-service');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (_req, res) => {
  res.json({
    result: 100,
    data: {
      name: 'BoAi Local API',
      endpoints: ['/search', '/song', '/song/url', '/lyric', '/health'],
      port,
    },
  });
});

app.get('/health', (_req, res) => {
  res.json({
    result: 100,
    data: {
      status: 'ok',
      port,
    },
  });
});

function createHandler(handler) {
  return async (req, res) => {
    try {
      const data = await handler(req.query || {});
      res.json({
        result: 100,
        data,
      });
    } catch (error) {
      res.status(500).json({
        result: 500,
        errMsg: error?.message || 'Request failed',
      });
    }
  };
}

app.get('/song/stream', async (req, res) => {
  try {
    const playUrl = await getSongUrl(req.query || {});
    const upstream = await fetch(playUrl, {
      headers: req.headers.range
        ? {
            Range: req.headers.range,
          }
        : undefined,
    });

    if (!upstream.ok && upstream.status !== 206) {
      throw new Error(`Audio stream failed: ${upstream.status}`);
    }

    const passthroughHeaders = [
      'accept-ranges',
      'cache-control',
      'content-length',
      'content-range',
      'content-type',
      'etag',
      'expires',
      'last-modified',
    ];

    passthroughHeaders.forEach((headerName) => {
      const value = upstream.headers.get(headerName);
      if (value) {
        res.setHeader(headerName, value);
      }
    });

    res.setHeader('access-control-allow-origin', '*');
    res.status(upstream.status);

    if (!upstream.body) {
      res.end();
      return;
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    res.status(500).json({
      result: 500,
      errMsg: error?.message || 'Audio stream failed',
    });
  }
});

app.get('/search', createHandler(searchSongs));
app.get('/song', createHandler(getSongDetail));
app.get('/song/url', createHandler(getSongUrl));
app.get('/lyric', createHandler(getLyric));

app.use((_req, res) => {
  res.status(404).json({
    result: 404,
    errMsg: 'Not Found',
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`BoAi local service running at http://localhost:${port}`);
  console.log(`Also available at http://0.0.0.0:${port}`);
});
