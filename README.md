# Helix add-ons

Community-maintained add-on definitions for [Helix](https://github.com/clickbitau/helix):
tracker indexers and music service plugins. All definitions here are original
Helix/community work — no Jackett or Prowlarr definition files (GPL) are
accepted or bundled.

## Indexers (`indexers/`)

Cardigann-compatible YAML definitions, one file per site. Helix interprets them
with its own engine (login `cookie`/`form`, GET/POST search paths, row and field
selectors, the common filters, category mapping).

Install: drop the `.yml` into the server data directory's `indexers/` folder, or
pick it in the console under Indexers → Add-ons.

Note: some trackers are native Helix clients rather than definitions — the YAML
format only covers what it can express.

## Music plugins (`plugins/`)

Sandboxed JavaScript plugins — `manifest.json` + `plugin.js` (+ icon) per
service. Install or update from the console's plugin section.

## Disclaimer

These definitions describe how to query third-party web sites. The authors and
contributors are not affiliated with, endorsed by, or responsible for any site a
definition targets. Use of any add-on is at your own risk; you are responsible
for complying with each site's terms of use, robots and rate-limit policies,
and the law where you are. No warranty of any kind is offered.

## Contributing

Pull requests welcome. Requirements:

- Indexer definitions must be original work — do not submit files copied or
  derived from Jackett/Prowlarr (GPL).
- One tracker / one service per PR, tested against the live site.
- Keep changes minimal and match the existing file style.
