// External anime metadata fetch: AniList (primary), Bangumi (Chinese supplement), Jikan (fallback).
// All functions return empty arrays on network/parse failure — callers must not throw.

import type { AnimeSearchCandidate } from "../../shared/types";

const ANILIST_API = "https://graphql.anilist.co";
const BANGUMI_API = "https://api.bgm.tv";
const JIKAN_API = "https://api.jikan.moe/v4";
// ponytail: user-agent string required by Bangumi ToS
const BANGUMI_UA = "anime-owatteinai/1.0 (https://github.com/tinyyana/anime-owatteinai)";

const ANILIST_QUERY = `
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id idMal
      title { romaji english native }
      synonyms
      episodes status season seasonYear format
      coverImage { medium }
    }
  }
}`;

// --- Internal response shapes ---

interface AniListMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[];
  episodes: number | null;
  status: string | null;
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  coverImage: { medium: string | null };
}
interface AniListResponse {
  data?: { Page?: { media?: AniListMedia[] } };
}
interface BangumiSubject {
  id: number;
  name: string;
  name_cn: string;
}
interface BangumiSearchResponse {
  data?: BangumiSubject[];
  list?: BangumiSubject[];
}
interface JikanAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  episodes: number | null;
  status: string | null;
  season: string | null;
  year: number | null;
  type: string | null;
  images: { jpg: { image_url: string | null } };
}
interface JikanResponse {
  data?: JikanAnime[];
}

// --- Heuristics ---

function hasCJK(s: string): boolean {
  return /[一-鿿㐀-䶿぀-ヿ]/.test(s);
}

// Minimal Traditional→Simplified mapping covering common anime title characters.
// Only Traditional chars that differ from Simplified are listed.
function cleanQuery(q: string): string {
  return q
    .trim()
    .normalize("NFKC")
    .replace(/\s*[\[(]\s*(?:ep(?:isode)?\s*)?\d+\s*[\])]\s*$/i, "")
    .replace(/\s*(?:\u7b2c\s*)?\d+\s*(?:\u8a71|\u96c6|\u56de)\s*$/u, "")
    .replace(/\s*(?:EP|Episode)\s*\d+\s*$/i, "")
    .replace(/\s+/g, " ");
}

function queryVariants(q: string): string[] {
  const cleaned = cleanQuery(q);
  const variants = [
    cleaned,
    cleaned.replace(/[._-]+/g, " "),
    cleaned.replace(/\s*[[(][^\])]+[\])]\s*$/g, "").trim(),
  ];
  if (hasCJK(cleaned)) variants.push(toSimplified(cleaned));
  return [...new Set(variants.map((v) => v.trim()).filter(Boolean))].slice(0, 4);
}

function normalizedKey(s: string): string {
  return cleanQuery(s).toLowerCase().replace(/[\s:：!！?？・·.\-_()[\]]/g, "");
}

function candidateKey(c: AnimeSearchCandidate): string {
  if (c.externalAnilistId != null) return `anilist:${c.externalAnilistId}`;
  if (c.externalMalId != null) return `mal:${c.externalMalId}`;
  if (c.externalBangumiId != null) return `bangumi:${c.externalBangumiId}`;
  return `title:${normalizedKey(c.title)}`;
}

const T2S: Record<string, string> = {
  "來":"来","時":"时","動":"动","畫":"画","進":"进","愛":"爱","過":"过","長":"长","發":"发","開":"开",
  "電":"电","話":"话","龍":"龙","號":"号","語":"语","說":"说","個":"个","們":"们","這":"这",
  "國":"国","學":"学","後":"后","問":"问","讀":"读","書":"书","門":"门","頭":"头",
  "歡":"欢","題":"题","應":"应","機":"机","種":"种","讓":"让","點":"点","場":"场",
  "裡":"里","實":"实","會":"会","歷":"历","劍":"剑","鋼":"钢","煉":"炼","術":"术",
  "師":"师","體":"体","夢":"梦","戰":"战","強":"强","兒":"儿","與":"与","對":"对",
  "風":"风","識":"识","還":"还","聽":"听","覺":"觉","寫":"写","買":"买",
  "廣":"广","無":"无","邊":"边","際":"际","萬":"万","維":"维","繼":"继",
  "變":"变","轉":"转","戲":"戏","產":"产","鳥":"鸟","島":"岛","樣":"样","橋":"桥",
  "線":"线","練":"练","蓮":"莲","連":"连","鍊":"链","選":"选","層":"层","幫":"帮",
  "聲":"声","響":"响","觀":"观","決":"决","護":"护","設":"设",
  "陽":"阳","隱":"隐","靈":"灵","羅":"罗","蘭":"兰","園":"园","紀":"纪",
  "圖":"图","繪":"绘","廢":"废","廳":"厅","澤":"泽","淺":"浅","漢":"汉",
  "藍":"蓝","藝":"艺","蘿":"萝","夾":"夹","獵":"猎","獸":"兽","瘋":"疯",
  "盧":"卢","盜":"盗","監":"监","碼":"码","礦":"矿","緋":"绯","純":"纯",
  "紅":"红","級":"级","結":"结","綠":"绿","緣":"缘","銀":"银","鎖":"锁",
  "鏡":"镜","鐘":"钟","鐵":"铁","鑰":"钥","輝":"辉","擊":"击","麗":"丽",
  "絲":"丝","複":"复","飛":"飞","飾":"饰","驅":"驱","獻":"献","鍵":"键",
  "豐":"丰","趣":"趣","贈":"赠","觸":"触","許":"许","議":"议","誰":"谁",
  "誓":"誓","誕":"诞","謎":"谜","謝":"谢","貓":"猫","賢":"贤","贖":"赎",
  "資":"资","賽":"赛","費":"费","賀":"贺","輕":"轻","輔":"辅","騎":"骑",
  "驚":"惊","驗":"验","魔":"魔","魅":"魅","鬼":"鬼","鳳":"凤","黑":"黑",
  "齊":"齐","恆":"恒","蔭":"荫","蘊":"蕴","顯":"显","髮":"发","黨":"党",
};

function toSimplified(s: string): string {
  return s.split("").map((c) => T2S[c] ?? c).join("");
}

function extractChineseFromSynonyms(synonyms: string[]): string | undefined {
  return synonyms.find((s) => {
    const cjk = (s.match(/[一-鿿㐀-䶿]/g) ?? []).length;
    return cjk > 0 && cjk / s.length > 0.4;
  });
}

// --- Normalizers ---

function normalizeAniList(m: AniListMedia): AnimeSearchCandidate {
  const titleZh = extractChineseFromSynonyms(m.synonyms);
  return {
    externalAnilistId: m.id,
    externalMalId: m.idMal ?? undefined,
    title: titleZh ?? m.title.native ?? m.title.romaji ?? m.title.english ?? String(m.id),
    titleRomaji: m.title.romaji ?? undefined,
    titleEnglish: m.title.english ?? undefined,
    titleNative: m.title.native ?? undefined,
    titleZh,
    synonyms: m.synonyms.length > 0 ? m.synonyms : undefined,
    episodes: m.episodes ?? undefined,
    season: m.season ?? undefined,
    seasonYear: m.seasonYear ?? undefined,
    format: m.format ?? undefined,
    statusExternal: m.status ?? undefined,
    coverImageUrl: m.coverImage.medium ?? undefined,
    source: "anilist",
  };
}

function normalizeBangumi(s: BangumiSubject): AnimeSearchCandidate {
  return {
    externalBangumiId: s.id,
    title: s.name_cn || s.name,
    titleNative: s.name || undefined,
    titleZh: s.name_cn || undefined,
    source: "bangumi",
  };
}

function normalizeJikan(a: JikanAnime): AnimeSearchCandidate {
  return {
    externalMalId: a.mal_id,
    title: a.title_japanese ?? a.title,
    titleRomaji: a.title || undefined,
    titleEnglish: a.title_english ?? undefined,
    titleNative: a.title_japanese ?? undefined,
    episodes: a.episodes ?? undefined,
    season: a.season ?? undefined,
    seasonYear: a.year ?? undefined,
    format: a.type ?? undefined,
    statusExternal: a.status ?? undefined,
    coverImageUrl: a.images?.jpg?.image_url ?? undefined,
    source: "jikan",
  };
}

// --- Fetch helpers ---

async function searchAniList(q: string): Promise<AnimeSearchCandidate[]> {
  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: q } }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as AniListResponse;
    return (json.data?.Page?.media ?? []).map(normalizeAniList);
  } catch {
    return [];
  }
}

async function searchBangumi(q: string): Promise<AnimeSearchCandidate[]> {
  try {
    const url = `${BANGUMI_API}/v0/search/subjects?keyword=${encodeURIComponent(q)}&type=2&limit=8`;
    const res = await fetch(url, { headers: { "User-Agent": BANGUMI_UA } });
    if (!res.ok) return [];
    const json = (await res.json()) as BangumiSearchResponse;
    const list = json.data ?? json.list ?? [];
    return list.map(normalizeBangumi);
  } catch {
    return [];
  }
}

async function searchJikan(q: string): Promise<AnimeSearchCandidate[]> {
  try {
    const url = `${JIKAN_API}/anime?q=${encodeURIComponent(q)}&limit=10&sfw=false`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as JikanResponse;
    return (json.data ?? []).map(normalizeJikan);
  } catch {
    return [];
  }
}

// --- Public API ---

const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Search external metadata sources for the given query.
 * Strategy: try a few cleaned title variants across AniList, Bangumi, and
 * Jikan, then dedupe by external IDs.
 *
 * Pass a KV namespace to cache results and avoid hammering external APIs on
 * repeated searches. Cache TTL is 5 minutes.
 */
export async function searchExternal(
  q: string,
  cache?: KVNamespace,
): Promise<AnimeSearchCandidate[]> {
  const queries = queryVariants(q);
  if (queries.length === 0) return [];

  // Check KV cache first (key = first variant, lowercase, truncated)
  const cacheKey = `search:${queries[0]!.toLowerCase().slice(0, 200)}`;
  if (cache) {
    try {
      const cached = await cache.get(cacheKey);
      if (cached) return JSON.parse(cached) as AnimeSearchCandidate[];
    } catch {
      // Cache miss or parse error — fall through to live search
    }
  }

  const batches = await Promise.all(
    queries.map(async (query) => {
      const [anilist, bangumi, jikan] = await Promise.all([
        searchAniList(query),
        searchBangumi(query),
        searchJikan(query),
      ]);
      return [...anilist, ...bangumi, ...jikan];
    }),
  );

  const results = dedup(batches.flat()).slice(0, 30);

  // Write back to cache (fire-and-forget)
  if (cache && results.length > 0) {
    cache.put(cacheKey, JSON.stringify(results), { expirationTtl: CACHE_TTL_SECONDS }).catch(
      () => undefined,
    );
  }

  return results;
}

function dedup(candidates: AnimeSearchCandidate[]): AnimeSearchCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = candidateKey(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
