// SPDX-License-Identifier: GPL-3.0-only
'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { test } = require('node:test');
const { createAddon } = require('./addon');

async function start(t, server) {
  t.after(() => new Promise((resolve) => server.close(resolve)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

test('serves the Helix manifest and configured movie and episode streams', async (t) => {
  let mediaRequests = 0;
  const media = await start(t, http.createServer((req, res) => {
    mediaRequests++;
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.end('#EXTM3U\n#EXT-X-ENDLIST\n');
  }));
  const movie = `${media}/movie/index.m3u8`;
  const episode = `${media}/episode/index.m3u8`;
  const addon = await start(t, createAddon({
    'movie/tt0000001': [movie],
    'series/tt0000002:0:1': [episode],
  }));
  const request = (path, options) => fetch(addon + path, options);
  const manifestResponse = await request('/manifest.json');
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.id, 'com.clickbit.streambert');
  assert.deepEqual(manifest.resources, ['stream']);

  for (const [path, expected] of [
    ['/stream/movie/tt0000001.json', [{ url: movie }]],
    ['/stream/series/tt0000002%3A0%3A1.json', [{ url: episode }]],
    ['/stream/tv/tt0000002:0:1.json', [{ url: episode }]],
    ['/stream/movie/tt0000003.json', []],
  ]) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { streams: expected });
  }
  assert.equal(mediaRequests, 0, 'stream lookups should not fetch media');
  assert.match(await (await fetch(movie)).text(), /^#EXTM3U/);
  assert.equal((await request('/stream/series/%ZZ.json')).status, 400);
  assert.equal((await request('/proxy')).status, 404);
  assert.equal((await request('/manifest.json', { method: 'POST' })).status, 405);
});

test('rejects invalid catalog entries at startup', () => {
  assert.throws(() => createAddon({ 'series/tt0000002:1': [] }), /Invalid stream catalog entry/);
  assert.throws(() => createAddon({ 'movie/tt0000001': ['file:///fixture'] }), /absolute HTTP/);
  assert.throws(() => createAddon({ 'movie/tt0000001': ['https://user:password@media.example.com/video'] }), /without credentials/);
});
