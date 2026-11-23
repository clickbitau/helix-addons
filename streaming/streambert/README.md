# Streambert

A standalone Stremio-protocol add-on for Helix. It looks up movies and episodes
in a catalog of HTTP(S) media URLs that you configure and are authorized to
serve. It returns those URLs directly to Helix. The service reads the catalog
at startup and makes no requests to media hosts.

## Run locally

Use Node.js 22 or newer. Create a JSON file outside the repository mapping
`movie/<IMDb ID>` or `series/<IMDb ID>:<season>:<episode>` to an array of URLs.
Use HLS URLs with Helix PR #137, which currently advertises addon playback as
HLS. For example:

```json
{
  "movie/tt0000001": ["https://media.example.com/movie/index.m3u8"],
  "series/tt0000002:1:2": ["https://media.example.com/show/s01e02/index.m3u8"]
}
```

```sh
STREAMBERT_CATALOG=/path/to/streams.json node addon.js
```

Add `http://127.0.0.1:7000` as a Stremio source when Streambert and Helix run on
the same host. Set `HOST` and `PORT` for other deployments. Anyone who can
reach the add-on can read the configured stream URLs, so bind it only where
intended and keep private catalogs out of Git.

Run the local fixture tests with `node --test addon.test.js` from this directory.

Licensed under [GPL-3.0-only](LICENSE).
