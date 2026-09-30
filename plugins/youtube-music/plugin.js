// YouTube Music for Helix, signed in with the person's own browser session.
//
// It reads YouTube Music's own web API (the InnerTube "youtubei/v1"
// endpoints on music.youtube.com, as the YouTube Music web page does and as
// the open-source ytmusicapi does with its "browser" sign-in): search,
// albums, the person's saved albums, artists, liked songs, playlists and
// listening history. Metadata only. Play opens the YouTube Music app; this
// plugin never asks for, deciphers or relays audio or video.
//
// Sign-in is the server's. Every request is marked {auth: true}; the server
// adds the cookie the person pasted and a fresh SAPISIDHASH. This code never
// sees either.

var MUSIC = "https://music.youtube.com/";
var API = MUSIC + "youtubei/v1/";
var UA = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";
// Search filters, as the web page sends them (ytmusicapi's
// get_search_params): albums only.
var FILTER_ALBUMS = "EgWKAQIYAWoMEA4QChADEAQQCRAF";
var TYPE_WORDS = { "Song": 1, "Video": 1, "Album": 1, "Single": 1, "EP": 1, "Playlist": 1, "Artist": 1,
  "Episode": 1, "Podcast": 1, "Profile": 1, "Station": 1 };

function pad(n) { return n < 10 ? "0" + n : "" + n; }

function clientVersion() {
  var d = new Date();
  return "1." + d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + ".01.00";
}

// call posts to one InnerTube endpoint as the signed-in person.
function call(endpoint, body, query) {
  var version = clientVersion();
  var client = { clientName: "WEB_REMIX", clientVersion: version, hl: "en" };
  if (helix.settings.region) client.gl = String(helix.settings.region).toUpperCase();
  var payload = { context: { client: client, user: {} } };
  for (var k in body) payload[k] = body[k];
  var q = { prettyPrint: "false" };
  for (var j in query || {}) q[j] = query[j];
  var r = helix.fetch(API + endpoint, {
    method: "POST", query: q, body: payload, auth: true,
    headers: { "User-Agent": UA, "X-YouTube-Client-Name": "67", "X-YouTube-Client-Version": version }
  });
  if (r.status === 401 || r.status === 403) {
    helix.signInExpired("YouTube Music refused the saved sign-in (HTTP " + r.status + ")");
  }
  var res = null;
  try { res = r.json(); } catch (e) {}
  if (!r.ok) {
    var msg = res && res.error && res.error.message ? res.error.message : "HTTP " + r.status;
    throw new Error("YouTube Music: " + msg);
  }
  if (!res) throw new Error("YouTube Music: an answer that is not JSON");
  if (loggedIn(res) === false) {
    helix.signInExpired("YouTube Music answered as signed out");
  }
  return res;
}

// loggedIn reads the flag every InnerTube answer carries in its tracking
// parameters: true, false, or null when it is not there.
function loggedIn(res) {
  var svc = (res.responseContext && res.responseContext.serviceTrackingParams) || [];
  for (var i = 0; i < svc.length; i++) {
    var params = svc[i].params || [];
    for (var j = 0; j < params.length; j++) {
      if (params[j].key === "logged_in") return params[j].value === "1";
    }
  }
  return null;
}

// find is the first value under key, depth first. InnerTube moves its
// renderers around between page versions; the names stay.
function find(obj, key, depth) {
  depth = depth || 0;
  if (!obj || typeof obj !== "object" || depth > 40) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key) && !Array.isArray(obj)) return obj[key];
  for (var k in obj) {
    var v = find(obj[k], key, depth + 1);
    if (v !== undefined) return v;
  }
  return undefined;
}

// findAll is every value under key, not looking inside a match.
function findAll(obj, key, out, depth) {
  out = out || [];
  depth = depth || 0;
  if (!obj || typeof obj !== "object" || depth > 40) return out;
  if (!Array.isArray(obj) && Object.prototype.hasOwnProperty.call(obj, key)) {
    out.push(obj[key]);
    return out;
  }
  for (var k in obj) findAll(obj[k], key, out, depth + 1);
  return out;
}

function text(t) {
  if (!t) return "";
  if (typeof t.simpleText === "string") return t.simpleText;
  return (t.runs || []).map(function (r) { return r.text || ""; }).join("");
}

function browseOf(nav) {
  var b = nav && nav.browseEndpoint;
  if (!b) return { id: "", type: "" };
  var cfg = b.browseEndpointContextSupportedConfigs && b.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig;
  return { id: b.browseId || "", type: (cfg && cfg.pageType) || "" };
}

function thumb(obj) {
  var list = find(obj, "thumbnails");
  if (!list || !list.length) return "";
  var u = list[list.length - 1].url || "";
  if (u.indexOf("//") === 0) u = "https:" + u;
  // Google's image server scales on request: ask for a cover-sized square.
  return u.replace(/=w\d+-h\d+(-[a-z0-9-]+)?$/, "=w544-h544-l90-rj");
}

function durationMs(s) {
  var m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec((s || "").trim());
  if (!m) return 0;
  return ((+(m[1] || 0) * 60 + +m[2]) * 60 + +m[3]) * 1000;
}

// info reads a subtitle's runs: "Album • Artist • 2019",
// "Song • Artist • Album • 3:21", "Artist & Artist • 12 songs".
function info(runs) {
  var out = { artists: [], artistIds: [], album: "", albumId: "", year: 0, durationMs: 0, words: [], count: 0 };
  (runs || []).forEach(function (r) {
    var t = (r.text || "").trim();
    if (!t || t === "•" || t === "&" || t === "," || t === "and") return;
    var b = browseOf(r.navigationEndpoint);
    if (b.type === "MUSIC_PAGE_TYPE_ARTIST" || b.type === "MUSIC_PAGE_TYPE_USER_CHANNEL") {
      out.artists.push(t);
      out.artistIds.push(b.id);
    } else if (b.type === "MUSIC_PAGE_TYPE_ALBUM") {
      out.album = t;
      out.albumId = b.id;
    } else if (/^\d{4}$/.test(t)) {
      out.year = +t;
    } else if (durationMs(t)) {
      out.durationMs = durationMs(t);
    } else {
      var c = /^([\d,]+)\s+(songs?|tracks?|videos?|episodes?)$/i.exec(t);
      if (c) out.count = +c[1].replace(/,/g, "");
      else out.words.push(t);
    }
  });
  if (!out.artists.length) {
    // Artists without a page of their own come as plain text.
    for (var i = 0; i < out.words.length; i++) {
      var w = out.words[i];
      if (!TYPE_WORDS[w] && !/\b(views|plays|subscribers|monthly audience)\b/i.test(w)) {
        out.artists.push(w);
        break;
      }
    }
  }
  return out;
}

// firstArtistId is the channel id of the first credited artist, "" when the
// credit is plain text (an artist without a page).
function firstArtistId(inf) {
  return String(inf.artistIds[0] || "").replace(/^MPLA/, "");
}

function flexRuns(r, i) {
  var col = (r.flexColumns || [])[i];
  var f = col && col.musicResponsiveListItemFlexColumnRenderer;
  return (f && f.text && f.text.runs) || [];
}

function openAlbum(id) { return MUSIC + "browse/" + encodeURIComponent(id); }
function openPlaylist(id) { return MUSIC + "playlist?list=" + encodeURIComponent(id); }
function openArtist(id) { return MUSIC + "channel/" + encodeURIComponent(id); }
function openSong(id) { return MUSIC + "watch?v=" + encodeURIComponent(id); }
function playlistID(browseId) { return (browseId || "").replace(/^VL/, ""); }

// item reads one row of a list (musicResponsiveListItemRenderer) as
// {kind, value}: a song, an album, an artist or a playlist.
function item(r) {
  var titleRuns = flexRuns(r, 0);
  var title = titleRuns.map(function (x) { return x.text || ""; }).join("");
  var first = titleRuns[0] || {};
  var b = browseOf(r.navigationEndpoint);
  if (!b.id) b = browseOf(first.navigationEndpoint);
  var rest = [];
  for (var i = 1; i < (r.flexColumns || []).length; i++) rest = rest.concat(flexRuns(r, i));
  (r.fixedColumns || []).forEach(function (c) {
    var f = c.musicResponsiveListItemFixedColumnRenderer;
    if (f && f.text) rest = rest.concat(f.text.runs || [{ text: f.text.simpleText }]);
  });
  var inf = info(rest);
  var cover = thumb(r.thumbnail);
  var videoId = (r.playlistItemData && r.playlistItemData.videoId) ||
    (first.navigationEndpoint && first.navigationEndpoint.watchEndpoint && first.navigationEndpoint.watchEndpoint.videoId) || "";
  if (!videoId && !b.id) videoId = find(r.overlay, "videoId") || "";
  switch (b.type) {
    case "MUSIC_PAGE_TYPE_ALBUM":
      return { kind: "album", value: { id: b.id, title: title, artist: inf.artists.join(", "), artistId: firstArtistId(inf), year: inf.year,
        coverUrl: cover, openUrl: openAlbum(b.id) } };
    case "MUSIC_PAGE_TYPE_ARTIST":
    case "MUSIC_PAGE_TYPE_LIBRARY_ARTIST":
      return { kind: "artist", value: { id: b.id.replace(/^MPLA/, ""), name: title, imageUrl: cover,
        openUrl: openArtist(b.id.replace(/^MPLA/, "")) } };
    case "MUSIC_PAGE_TYPE_PLAYLIST":
      return { kind: "playlist", value: { id: playlistID(b.id), title: title, owner: inf.artists[0] || "",
        trackCount: inf.count, coverUrl: cover, openUrl: openPlaylist(playlistID(b.id)) } };
  }
  if (!videoId) return null;
  var idx = r.index ? parseInt(text(r.index), 10) : 0;
  return { kind: "track", value: { id: videoId, title: title, artist: inf.artists.join(", "), artistId: firstArtistId(inf), album: inf.album,
    albumId: inf.albumId, number: idx > 0 ? idx : 0, durationMs: inf.durationMs, coverUrl: cover, openUrl: openSong(videoId) } };
}

// card reads one tile of a grid or carousel (musicTwoRowItemRenderer).
function card(r) {
  var first = (r.title && r.title.runs && r.title.runs[0]) || {};
  var b = browseOf(r.navigationEndpoint);
  if (!b.id) b = browseOf(first.navigationEndpoint);
  if (!b.id) return null; // "New playlist" and other buttons
  var title = text(r.title);
  var inf = info(r.subtitle && r.subtitle.runs);
  var cover = thumb(r.thumbnailRenderer);
  switch (b.type) {
    case "MUSIC_PAGE_TYPE_ALBUM":
      return { kind: "album", value: { id: b.id, title: title, artist: inf.artists.join(", "), artistId: firstArtistId(inf), year: inf.year,
        coverUrl: cover, openUrl: openAlbum(b.id) } };
    case "MUSIC_PAGE_TYPE_ARTIST":
    case "MUSIC_PAGE_TYPE_LIBRARY_ARTIST":
      return { kind: "artist", value: { id: b.id.replace(/^MPLA/, ""), name: title, imageUrl: cover,
        openUrl: openArtist(b.id.replace(/^MPLA/, "")) } };
    case "MUSIC_PAGE_TYPE_PLAYLIST":
      return { kind: "playlist", value: { id: playlistID(b.id), title: title, owner: inf.artists[0] || "",
        trackCount: inf.count, coverUrl: cover, openUrl: openPlaylist(playlistID(b.id)) } };
  }
  return null;
}

function entries(list) {
  var out = [];
  (list || []).forEach(function (c) {
    var e = null;
    if (c.musicResponsiveListItemRenderer) e = item(c.musicResponsiveListItemRenderer);
    else if (c.musicTwoRowItemRenderer) e = card(c.musicTwoRowItemRenderer);
    if (e) out.push(e);
  });
  return out;
}

// nextPage is a shelf's continuation, in either of the two forms InnerTube
// uses: continuations[].nextContinuationData, or a continuationItemRenderer
// as the list's last entry.
function nextPage(shelf) {
  if (!shelf) return null;
  var c = shelf.continuations && shelf.continuations[0];
  if (c && c.nextContinuationData && c.nextContinuationData.continuation) return { old: c.nextContinuationData.continuation };
  var list = shelf.contents || shelf.items || [];
  var last = list[list.length - 1];
  if (last && last.continuationItemRenderer) {
    var tok = find(last.continuationItemRenderer, "token");
    if (tok) return { cmd: tok };
  }
  return null;
}

function loadPage(tok) {
  var res = tok.old
    ? call("browse", {}, { ctoken: tok.old, continuation: tok.old, type: "next" })
    : call("browse", { continuation: tok.cmd });
  if (res.continuationContents) {
    for (var k in res.continuationContents) return res.continuationContents[k];
  }
  var items = find(res.onResponseReceivedActions, "continuationItems");
  return items ? { contents: items } : null;
}

// rows is a shelf's entries, following its continuations up to maxPages.
function rows(shelf, maxPages) {
  var out = [];
  for (var p = 0; shelf && p < maxPages; p++) {
    out = out.concat(entries(shelf.contents || shelf.items));
    var tok = nextPage(shelf);
    if (!tok) break;
    shelf = loadPage(tok);
  }
  return out;
}

function listShelf(res) {
  return find(res, "musicPlaylistShelfRenderer") || find(res, "musicShelfRenderer") || find(res, "gridRenderer");
}

function header(res) {
  return find(res, "musicResponsiveHeaderRenderer") || find(res, "musicDetailHeaderRenderer") ||
    find(res, "musicEditablePlaylistDetailHeaderRenderer") || find(res, "musicImmersiveHeaderRenderer") || {};
}

function only(list, kind) {
  return list.filter(function (e) { return e.kind === kind; }).map(function (e) { return e.value; });
}

function uniq(list) {
  var seen = {};
  return list.filter(function (v) {
    if (seen[v.id]) return false;
    seen[v.id] = true;
    return true;
  });
}

function numberTracks(tracks) {
  tracks.forEach(function (t, i) { if (!t.number) t.number = i + 1; });
  return tracks;
}

exports.account = function () {
  var res = call("account/account_menu", {});
  var h = find(res, "activeAccountHeaderRenderer");
  if (!h) helix.signInExpired("YouTube Music answered as signed out");
  return { name: text(h.accountName) || text(h.channelHandle) };
};

// found is every list row and tile anywhere in an answer, plus the
// search page's "top result" card.
function found(res) {
  var out = [];
  findAll(res, "musicCardShelfRenderer").forEach(function (c) {
    var first = (c.title && c.title.runs && c.title.runs[0]) || {};
    var e = card({ title: c.title, subtitle: c.subtitle, navigationEndpoint: first.navigationEndpoint,
      thumbnailRenderer: c.thumbnail });
    if (e) out.push(e);
    out = out.concat(entries(c.contents));
  });
  findAll(res, "musicShelfRenderer").forEach(function (s) { out = out.concat(entries(s.contents)); });
  return out;
}

exports.search = function (q) {
  var all = found(call("search", { query: q }));
  // The unfiltered page holds a few of each kind; the albums filter fills
  // in the kind Helix adds to its library.
  var albums = found(call("search", { query: q, params: FILTER_ALBUMS }));
  return {
    albums: uniq(only(all, "album").concat(only(albums, "album"))),
    tracks: uniq(only(all, "track")),
    artists: uniq(only(all, "artist")),
    playlists: uniq(only(all, "playlist"))
  };
};

function albumPage(id, res) {
  var h = header(res);
  var sub = info((h.subtitle && h.subtitle.runs) || []);
  var strap = info((h.straplineTextOne && h.straplineTextOne.runs) || []);
  var artist = strap.artists.join(", ") || sub.artists.join(", ");
  // The artist's channel id, which is what a tap on the name opens: two
  // bands can share a name, never an id.
  var artistId = strap.artists.length ? firstArtistId(strap) : firstArtistId(sub);
  var title = text(h.title);
  var tracks = only(rows(listShelf(res), 4), "track");
  tracks.forEach(function (t) {
    if (!t.artist) t.artist = artist;
    if (!t.artistId && t.artist === artist) t.artistId = artistId;
    if (!t.album) { t.album = title; t.albumId = id; }
  });
  var count = info((h.secondSubtitle && h.secondSubtitle.runs) || []).count;
  return { id: id, title: title, artist: artist, artistId: artistId, year: sub.year, trackCount: count || tracks.length,
    coverUrl: thumb(h.thumbnail), openUrl: openAlbum(id), tracks: numberTracks(tracks) };
}

exports.album = function (id) {
  if (!/^MPRE/.test(id)) {
    // An album met as its playlist (OLAK5uy…): read it as one.
    var p = exports.playlist(id);
    return { id: id, title: p.title, artist: p.owner, coverUrl: p.coverUrl, openUrl: p.openUrl, tracks: p.tracks };
  }
  var a = albumPage(id, call("browse", { browseId: id }));
  if (!a.title) throw new Error("YouTube Music: that album is not available");
  return a;
};

exports.playlists = function () {
  var res = call("browse", { browseId: "FEmusic_liked_playlists" });
  var lists = only(rows(listShelf(res), 4), "playlist");
  if (!lists.some(function (p) { return p.id === "LM"; })) {
    lists.unshift({ id: "LM", title: "Liked music", owner: "You", openUrl: openPlaylist("LM") });
  }
  return uniq(lists);
};

exports.playlist = function (id) {
  if (id === "liked") id = "LM";
  var res = call("browse", { browseId: "VL" + id });
  var h = header(res);
  var title = text(h.title);
  if (!title && id === "LM") title = "Liked music";
  if (!title) throw new Error("YouTube Music: that playlist is not available");
  var strap = info((h.straplineTextOne && h.straplineTextOne.runs) || []);
  var sub = info((h.subtitle && h.subtitle.runs) || []);
  var tracks = only(rows(listShelf(res), id === "LM" ? 10 : 5), "track");
  var count = info((h.secondSubtitle && h.secondSubtitle.runs) || []).count || sub.count;
  return { id: id, title: title, owner: strap.artists[0] || sub.artists[0] || (id === "LM" ? "You" : ""),
    trackCount: count || tracks.length, coverUrl: thumb(h.thumbnail), openUrl: openPlaylist(id),
    tracks: numberTracks(tracks) };
};

// library is the person's saved albums, their liked songs and the artists
// they subscribe to.
exports.library = function () {
  var albums = only(rows(listShelf(call("browse", { browseId: "FEmusic_liked_albums" })), 10), "album");
  var liked = only(rows(listShelf(call("browse", { browseId: "VLLM" })), 5), "track");
  var artists = only(rows(listShelf(call("browse", { browseId: "FEmusic_library_corpus_artists" })), 3), "artist");
  return { albums: uniq(albums), tracks: numberTracks(uniq(liked)), artists: uniq(artists) };
};

// history is the person's recent plays: the History page (browse
// FEmusic_history), read like the library pages above — names and ids only.
// YouTube Music groups plays under "Today", "Yesterday", "This week" and so
// on, with no time, so no playedAt is given (the server then records each
// song once per day it is seen), and a song played twice appears once.
// since is not used: the page holds only the recent plays anyway.
exports.history = function (since) {
  var res = call("browse", { browseId: "FEmusic_history" });
  var out = [];
  var seen = {};
  findAll(res, "musicShelfRenderer").forEach(function (s) {
    only(entries(s.contents), "track").forEach(function (t) {
      if (seen[t.id]) return;
      seen[t.id] = true;
      out.push({ track: t });
    });
  });
  return out;
};
