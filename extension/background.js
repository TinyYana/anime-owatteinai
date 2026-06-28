// Background service worker. All API calls go through here so we can attach
// the session cookie from the configured app origin.

async function getApiBase() {
  const result = await chrome.storage.sync.get({ apiBase: "http://localhost:8787" });
  return result.apiBase.replace(/\/$/, "");
}

async function getPrefs() {
  return chrome.storage.sync.get({
    defaultPriority: "normal",
  });
}

async function getSessionCookie(apiBase) {
  try {
    const cookie = await chrome.cookies.get({ url: apiBase, name: "aon_session" });
    return cookie ? cookie.value : null;
  } catch {
    return null;
  }
}

async function apiCall(path, method = "GET", body = null) {
  const base = await getApiBase();
  const cookie = await getSessionCookie(base);

  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = `aon_session=${cookie}`;

  const opts = { method, headers, credentials: "include" };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${base}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

function stripEpisodeFromTitle(title) {
  return String(title ?? "")
    .replace(/\s*[\[\u3010(\uff08]\s*(?:ep(?:isode)?\s*)?\d+\s*[\]\u3011)\uff09]\s*$/i, "")
    .replace(/\s*(?:\u7b2c\s*)?\d+\s*(?:\u8a71|\u96c6|\u56de)\s*$/u, "")
    .replace(/\s*(?:EP|Episode)\s*\d+\s*$/i, "")
    .trim();
}

function normalizedTitle(title) {
  return stripEpisodeFromTitle(title)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u300c\u300d\u300e\u300f\u300a\u300b\u3008\u3009\u3010\u3011[\]()\uff08\uff09:：!！?？・·.\-_\s]/g, "");
}

function candidateNames(candidate) {
  return [
    candidate.title,
    candidate.titleZh,
    candidate.titleRomaji,
    candidate.titleEnglish,
    candidate.titleNative,
    ...(candidate.synonyms ?? []),
  ].filter(Boolean);
}

function matchesQuery(query, candidate) {
  const q = normalizedTitle(query);
  if (q.length < 2) return false;
  return candidateNames(candidate).some((name) => {
    const n = normalizedTitle(name);
    return n.length >= 2 && (n === q || n.includes(q) || q.includes(n));
  });
}

async function resolveAnime(title) {
  try {
    const query = stripEpisodeFromTitle(title);
    const data = await apiCall(`/api/anime/search?q=${encodeURIComponent(query)}`);
    if (data.local?.length > 0) {
      return { status: "found", anime: data.local[0] };
    }

    const exactish = data.external?.find((c) => matchesQuery(query, c));
    if (exactish) return { status: "candidate", candidate: exactish };

    const candidate = data.external?.[0];
    return candidate ? { status: "candidate", candidate, uncertain: true } : { status: "not_found" };
  } catch {
    return { status: "not_found" };
  }
}

async function importAndRecord(candidate, episode, observedTitle, sourceUrl, sourceLabel) {
  const prefs = await getPrefs();
  const { anime } = await apiCall("/api/anime/import", "POST", {
    ...candidate,
    title: candidate.titleZh ?? candidate.title,
    episodesTotal: candidate.episodes,
    metadataSource: candidate.source,
    observedTitle,
    addToList: true,
  });
  await apiCall("/api/my/watch-sessions", "POST", {
    animeId: anime.id,
    episodeNumber: episode,
    sourceUrl,
    sourceLabel,
    priority: prefs.defaultPriority,
    completed: true,
  });
  return anime;
}

async function recordWatched(animeId, episodeNumber, sourceUrl, sourceLabel) {
  const prefs = await getPrefs();
  return apiCall("/api/my/watch-sessions", "POST", {
    animeId,
    episodeNumber,
    sourceUrl,
    sourceLabel,
    priority: prefs.defaultPriority,
    completed: true,
  });
}

async function verifyConnection() {
  try {
    const me = await apiCall("/api/me");
    return { ok: true, username: me.discordGlobalName ?? me.discordUsername, role: me.role };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  switch (msg.type) {
    case "RESOLVE_ANIME":
      resolveAnime(msg.title).then(respond).catch(() => respond({ status: "not_found" }));
      return true;

    case "IMPORT_AND_RECORD":
      importAndRecord(msg.candidate, msg.episode, msg.observedTitle, msg.sourceUrl, msg.sourceLabel)
        .then((anime) => respond({ ok: true, anime }))
        .catch((err) => respond({ ok: false, error: err.message }));
      return true;

    case "RECORD_WATCHED":
      recordWatched(msg.animeId, msg.episode, msg.sourceUrl, msg.sourceLabel)
        .then(() => respond({ ok: true }))
        .catch((err) => respond({ ok: false, error: err.message }));
      return true;

    case "VERIFY_CONNECTION":
      verifyConnection().then(respond).catch((err) => respond({ ok: false, error: err.message }));
      return true;

    default:
      return false;
  }
});
