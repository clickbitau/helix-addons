# Helix add-ons

A public collection of community-maintained add-ons for [Helix](https://github.com/clickbitau/helix),
including tracker indexers and music service plugins. Anyone can propose an
add-on through a pull request.

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

Everything in this repository — whether written by Helix maintainers or by
community contributors — is provided as-is, with no warranty and no liability
accepted by anyone. These definitions describe how to query third-party web
sites; the authors and contributors are not affiliated with, endorsed by, or
responsible for any site an add-on targets, nor for what anyone does with an
add-on. Use of any add-on is entirely at your own risk; you are responsible
for complying with each site's terms of use, robots and rate-limit policies,
and the law where you are.

## Licensing

This collection accepts add-ons under open-source licenses, including
[MIT](LICENSE) and [GPLv3](LICENSES/GPL-3.0.txt). The root MIT license is the
default. If an add-on uses another license, identify it in the add-on’s README
and include its license text alongside the add-on. For single-file indexer
definitions, identify the license in a header comment and link to the included
license text.

## Contributing

- Submit one add-on per pull request and describe how you tested it.
- You can submit original or adapted work. For adapted work, identify the
  upstream source and revision, preserve copyright and license notices, and
  follow the applicable license terms.
- Keep changes minimal and match the existing file style.
