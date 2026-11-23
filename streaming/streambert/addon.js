// SPDX-License-Identifier: GPL-3.0-only
'use strict';

const http = require('node:http');
const { readFileSync } = require('node:fs');

const manifest = {
  id: 'com.clickbit.streambert',
  version: '0.2.0',
  name: 'Streambert',
  description: 'Streams from an operator-configured media catalog.',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
};

const idFormats = {
  movie: /^tt[0-9]+$/,
  series: /^tt[0-9]+:[0-9]+:[1-9][0-9]*$/,
};

function loadStreams(catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    throw new Error('The stream catalog must be a JSON object.');
  }
  const streams = new Map();
  for (const [key, urls] of Object.entries(catalog)) {
    const slash = key.indexOf('/');
    const type = key.slice(0, slash);
    const id = key.slice(slash + 1);
    if (!Object.hasOwn(idFormats, type) || !idFormats[type].test(id) || !Array.isArray(urls)) {
      throw new Error('Invalid stream catalog entry.');
    }
    streams.set(key, urls.map((raw) => {
      const url = typeof raw === 'string' && URL.canParse(raw) ? new URL(raw) : null;
      if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
        throw new Error('Stream URLs must be absolute HTTP(S) URLs without credentials or fragments.');
      }
      return { url: raw };
    }));
  }
  return streams;
}

function createAddon(catalog) {
  const streams = loadStreams(catalog);
  return http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.writeHead(405).end('{}');
      return;
    }
    const pathname = req.url.split('?', 1)[0];
    if (pathname === '/manifest.json') {
      res.end(JSON.stringify(manifest));
      return;
    }
    const route = /^\/stream\/(movie|series|tv)\/([^/]+)\.json$/.exec(pathname);
    if (!route) {
      res.writeHead(404).end('{}');
      return;
    }
    const type = route[1] === 'tv' ? 'series' : route[1];
    let id;
    try {
      id = decodeURIComponent(route[2]);
    } catch {
      res.writeHead(400).end('{}');
      return;
    }
    res.end(JSON.stringify({ streams: streams.get(`${type}/${id}`) ?? [] }));
  });
}

if (require.main === module) {
  const catalogPath = process.env.STREAMBERT_CATALOG;
  if (!catalogPath) throw new Error('Set STREAMBERT_CATALOG to the stream catalog JSON file.');
  const port = Number(process.env.PORT ?? 7000);
  const host = process.env.HOST || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  createAddon(JSON.parse(readFileSync(catalogPath, 'utf8'))).listen(port, host, () => {
    console.log(`Streambert listening on ${host}:${port}`);
  });
}

module.exports = { createAddon };
