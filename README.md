# Helix add-ons

The add-on catalogue shipped with [Helix](https://github.com/clickbitau/helix): tracker
indexers and music service plugins. Everything here is Helix-written — no
Jackett/Prowlarr files (GPL) are bundled.

## Indexers (`indexers/`)

Cardigann-compatible YAML definitions, one file per tracker. Helix interprets
them with its own engine (login `cookie`/`form`, GET/POST search paths, row and
field selectors, the common filters, category mapping).

Install: drop the `.yml` into the server's data directory `indexers/` folder,
or pick it in the console under Indexers → Add-ons.

Note: TorrentBD is not here — it is a native client, not a definition. Its
login is a pasted browser session (the site's login page is captcha'd), the
session is bound to the browser that minted it, and searches run inside the
server's own logged-in `tbd-browser` container over DevTools. That shape is not
expressible in the YAML format.

## Music plugins (`plugins/`)

Sandboxed JavaScript plugins — `manifest.json` + `plugin.js` (+ icon) per
service. Install or update from the console's plugin section.

| Plugin | Notes |
|---|---|
| `youtube-music` | YouTube Music search, library, playlists, history. Browser-cookie sign-in. |
| `youtube-music-google` | YouTube Music via a Google Cloud project. |
| `amazon-music` | Amazon Music search and library (web API). |

## Updating

These files are mirrored from the Helix server source
(`server/internal/addons/indexers/defs/`, `server/internal/plugins/bundled/`).
Fix them there, then copy the result here.
