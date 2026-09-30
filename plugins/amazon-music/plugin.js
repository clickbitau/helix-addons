// Amazon Music for Helix, through the official Amazon Music Web API only
// (https://developer.amazon.com/docs/music/API_web_overview.html).
//
// The Web API is a closed beta: it answers only applications Amazon has
// admitted. Search, your playlists and your library; Add to library asks
// Helix Server to find its own copy. No scraping, and no audio.

var API = "https://api.music.amazon.dev/v1/";

function call(method, path, body, query) {
  var r = helix.fetch(API + path, { method: method, body: body, query: query, auth: true,
    headers: { "Accept": "application/json" } });
  var out = null;
  try { out = r.json(); } catch (e) {}
  if (!r.ok) {
    var msg = "HTTP " + r.status;
    if (out && out.errors && out.errors[0] && out.errors[0].message) msg = out.errors[0].message;
    else if (out && out.message) msg = out.message;
    if (r.status === 403) msg += " (this Amazon developer account may not have Amazon Music Web API access yet)";
    throw new Error("Amazon Music: " + msg);
  }
  return out || {};
}

// edges finds the first connection ({edges: [...]}) under data, whatever the
// field is called, and returns its nodes and paging.
function connection(obj, depth) {
  if (!obj || typeof obj !== "object" || (depth || 0) > 4) return null;
  if (Array.isArray(obj.edges)) return obj;
  for (var k in obj) {
    var c = connection(obj[k], (depth || 0) + 1);
    if (c) return c;
  }
  return null;
}

function nodes(conn) {
  return conn ? conn.edges.map(function (e) { return e.node || e; }).filter(Boolean) : [];
}

// paged follows pageInfo.token for up to max pages.
function paged(path, query, max) {
  var out = [];
  var cursor = "";
  for (var i = 0; i < max; i++) {
    var q = {};
    for (var k in query) q[k] = query[k];
    if (cursor) q.cursor = cursor;
    var conn = connection(call("GET", path, null, q).data);
    out = out.concat(nodes(conn));
    cursor = conn && conn.pageInfo && conn.pageInfo.hasNextPage ? conn.pageInfo.token : "";
    if (!cursor) break;
  }
  return out;
}

function image(n) {
  var imgs = (n && n.images) || [];
  return imgs.length ? imgs[0].url : "";
}

function artistName(n) {
  if (!n) return "";
  if (n.artists && n.artists.length) return n.artists.map(function (a) { return a.name; }).join(", ");
  if (n.artist && n.artist.name) return n.artist.name;
  return n.artistName || "";
}

// artistId is the service's id for the first credited artist, "" without one.
function artistId(n) {
  if (!n) return "";
  if (n.artists && n.artists.length && n.artists[0].id) return String(n.artists[0].id);
  if (n.artist && n.artist.id) return String(n.artist.id);
  return "";
}

function year(n) {
  var m = /^(\d{4})/.exec((n && n.releaseDate) || "");
  return m ? +m[1] : 0;
}

function track(n, i) {
  return {
    id: n.id, title: n.title, artist: artistName(n), artistId: artistId(n),
    album: n.album ? n.album.title : "", albumId: n.album ? n.album.id : "",
    number: n.trackNumber || (typeof i === "number" ? i + 1 : 0),
    durationMs: n.duration ? Math.round(n.duration * 1000) : 0,
    isrc: n.isrc || "", coverUrl: image(n) || image(n.album), openUrl: n.url || ""
  };
}

function album(n) {
  return { id: n.id, title: n.title, artist: artistName(n), artistId: artistId(n), year: year(n), trackCount: n.trackCount || 0,
    coverUrl: image(n), upc: n.upc || "", openUrl: n.url || "" };
}

exports.account = function () {
  var d = call("GET", "me").data || {};
  var u = d.user || d;
  return { name: u.name || u.username || "", plan: u.tier || "" };
};

function search(kind, q) {
  var body = { searchFilters: [{ field: "name", query: q }], limit: 20, sortBy: "relevance" };
  return nodes(connection(call("POST", "search/" + kind, body).data));
}

exports.search = function (q) {
  return {
    albums: search("albums", q).map(album),
    tracks: search("tracks", q).map(function (n) { return track(n); }),
    artists: [],
    playlists: []
  };
};

exports.album = function (id) {
  var d = call("GET", "albums/" + encodeURIComponent(id)).data || {};
  var n = d.album;
  if (!n) throw new Error("Amazon Music: that album is not available");
  var a = album(n);
  var list = Array.isArray(n.tracks) ? n.tracks : nodes(connection(n.tracks));
  a.tracks = list.map(function (t, i) {
    var tr = track(t, i);
    if (!tr.artist) tr.artist = a.artist;
    tr.album = a.title;
    tr.albumId = a.id;
    return tr;
  });
  return a;
};

exports.playlists = function () {
  return paged("me/playlists", { limit: 100 }, 5).map(function (n) {
    return { id: n.id, title: n.title, owner: n.curator ? n.curator.name : "", trackCount: n.trackCount || 0,
      coverUrl: image(n), openUrl: n.url || "" };
  });
};

exports.playlist = function (id) {
  var d = call("GET", "playlists/" + encodeURIComponent(id)).data || {};
  var n = d.playlist;
  if (!n) throw new Error("Amazon Music: that playlist is not available");
  var tracks = paged("playlists/" + encodeURIComponent(id) + "/tracks", { limit: 100 }, 5).map(track);
  return { id: n.id, title: n.title, owner: n.curator ? n.curator.name : "", trackCount: n.trackCount || tracks.length,
    coverUrl: image(n), openUrl: n.url || "", tracks: tracks };
};

exports.library = function () {
  return {
    albums: paged("me/library/albums", { limit: 100 }, 10).map(album),
    tracks: paged("me/library/tracks", { limit: 100 }, 5).map(function (n) { return track(n); })
  };
};
