import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { api, ApiError, coverUrl } from "../lib/api";
import { Button, Field, Input, ErrorText } from "../components/ui";
import type { Anime, AnimeSearchCandidate, AnimeSearchResult, CommunitySummary, CommunitySummaryItem, WatchStatus } from "../../shared/types";

gsap.registerPlugin(useGSAP);

type Phase = "search" | "confirm";

const FORMAT_LABEL: Record<string, string> = {
  TV: "TV", MOVIE: "電影", OVA: "OVA", ONA: "ONA", SPECIAL: "特別篇", MUSIC: "MV",
};
const SEASON_LABEL: Record<string, string> = {
  SPRING: "春", SUMMER: "夏", FALL: "秋", WINTER: "冬",
};

function candidateTitle(c: AnimeSearchCandidate) {
  return c.titleZh ?? c.titleNative ?? c.titleRomaji ?? c.titleEnglish ?? c.title;
}

export function AddAnimePage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("search");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AnimeSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [expandedLocal, setExpandedLocal] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const [selected, setSelected] = useState<AnimeSearchCandidate | null>(null);
  const [titleOverride, setTitleOverride] = useState("");
  const [addToList, setAddToList] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // 搜尋前的預設推薦：社群在追的 + 資料庫最近收錄的，避免頁面空蕩蕩
  const [trending, setTrending] = useState<CommunitySummaryItem[]>([]);
  const [recent, setRecent] = useState<Anime[]>([]);

  useEffect(() => {
    api.get<CommunitySummary>("/api/community/summary")
      .then((s) => setTrending(s.trendingAnime))
      .catch(() => undefined);
    api.get<Anime[]>("/api/anime")
      .then((rows) => setRecent(rows.slice(0, 8)))
      .catch(() => undefined);
  }, []);

  useGSAP(
    () => {
      if (!results) return;
      gsap.from(".search-result-item", {
        opacity: 0,
        y: 8,
        duration: 0.22,
        stagger: 0.04,
        ease: "power2.out",
        clearProps: "opacity,transform",
      });
    },
    { scope: containerRef, dependencies: [results] },
  );

  useGSAP(
    () => {
      if (phase !== "confirm") return;
      gsap.from(".confirm-panel", {
        opacity: 0,
        y: 14,
        duration: 0.22,
        ease: "power2.out",
        clearProps: "opacity,transform",
      });
    },
    { scope: containerRef, dependencies: [phase] },
  );

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setResults(null);
    try {
      const data = await api.get<AnimeSearchResult>(`/api/anime/search?q=${encodeURIComponent(q)}`);
      setResults(data);
    } catch {
      setSearchError("搜尋失敗，請稍後再試。");
    } finally {
      setSearching(false);
    }
  }

  function selectCandidate(c: AnimeSearchCandidate) {
    setSelected(c);
    setTitleOverride(candidateTitle(c));
    setImportError(null);
    setPhase("confirm");
  }

  function goBack() {
    setPhase("search");
    setSelected(null);
    setImportError(null);
  }

  async function quickAddToList(animeId: string, status: WatchStatus = "planned") {
    setAddingId(animeId);
    try {
      await api.post("/api/my/anime", { animeId, status });
      navigate(`/app/anime/${animeId}`);
    } catch {
      setAddingId(null);
    }
  }

  async function confirmImport(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await api.post<{ anime: Anime }>("/api/anime/import", {
        ...selected,
        title: titleOverride.trim() || candidateTitle(selected),
        statusExternal: selected.statusExternal,
        addToList,
      });
      navigate(`/app/anime/${res.anime.id}`);
    } catch (err) {
      setImportError(err instanceof ApiError ? "匯入失敗，請稍後再試。" : "發生未知錯誤。");
      setImporting(false);
    }
  }

  return (
    <div ref={containerRef} className="mx-auto max-w-lg space-y-6">
      <header>
        <p className="section-label">搜尋並匯入動畫</p>
        <h1 className="mt-1 text-2xl font-semibold text-text">新增動畫</h1>
      </header>

      {phase === "search" && (
        <>
          <form onSubmit={search} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="輸入動畫名稱…"
              autoFocus
            />
            <Button type="submit" disabled={searching || !query.trim()}>
              {searching ? "搜尋中…" : "搜尋"}
            </Button>
          </form>

          {searchError && <ErrorText>{searchError}</ErrorText>}

          {!results && !searching && (trending.length > 0 || recent.length > 0) && (
            <div className="space-y-5">
              {trending.length > 0 && (
                <section>
                  <p className="section-label mb-2">社群在追</p>
                  <div className="flex flex-wrap gap-2">
                    {trending.map((t) => (
                      <Link
                        key={t.animeId}
                        to={`/app/anime/${t.animeId}`}
                        className="kbd-label rounded-full border border-border/60 px-2.5 py-1 transition-colors hover:border-accent/40 hover:text-accent"
                      >
                        {t.titleZh || t.title}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {recent.length > 0 && (
                <section>
                  <p className="section-label mb-2">資料庫已收錄</p>
                  <ul className="divide-y divide-border/50 border-y border-border/50">
                    {recent.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 py-3">
                        {a.coverImageUrl && (
                          <img
                            src={coverUrl(a.coverImageUrl)}
                            alt=""
                            className="h-12 w-9 shrink-0 rounded-lg object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/app/anime/${a.id}`}
                            className="block truncate text-sm font-medium text-text hover:text-accent"
                          >
                            {a.titleZh || a.title}
                          </Link>
                          <p className="font-mono text-xs text-muted">
                            {[
                              a.format && FORMAT_LABEL[a.format],
                              a.seasonYear && a.season
                                ? `${a.seasonYear} ${SEASON_LABEL[a.season] ?? a.season}`
                                : a.seasonYear,
                              a.episodesTotal && `${a.episodesTotal} 集`,
                            ].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          className="shrink-0 !py-1 text-xs"
                          disabled={addingId === a.id}
                          onClick={() => quickAddToList(a.id)}
                        >
                          {addingId === a.id ? "加入中…" : "+ 加入追番"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {results && (
            <div className="space-y-5">
              {results.local.length > 0 && (
                <section>
                  <p className="section-label mb-2">系統已收錄</p>
                  <ul className="divide-y divide-border/50 border-y border-border/50">
                    {results.local.map((a) => (
                      <li key={a.id} className="search-result-item">
                        <button
                          className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:text-accent"
                          onClick={() => setExpandedLocal(expandedLocal === a.id ? null : a.id)}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text">{a.titleZh || a.title}</p>
                            {a.titleRomaji && a.titleRomaji !== (a.titleZh || a.title) && (
                              <p className="truncate font-mono text-xs text-muted">{a.titleRomaji}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-muted">{expandedLocal === a.id ? "▲" : "▼"}</span>
                        </button>

                        {expandedLocal === a.id && (
                          <div className="mb-3 flex gap-4 rounded-xl border border-border/50 bg-panel/60 p-3.5">
                            {a.coverImageUrl && (
                              <img
                                src={coverUrl(a.coverImageUrl)}
                                alt=""
                                className="h-20 w-[3.75rem] shrink-0 rounded-lg object-cover"
                              />
                            )}
                            <div className="min-w-0 flex-1 space-y-2">
                              <p className="text-sm font-medium text-text">{a.titleZh || a.title}</p>
                              <p className="font-mono text-xs text-muted">
                                {[
                                  a.format && FORMAT_LABEL[a.format],
                                  a.seasonYear && a.season
                                    ? `${a.seasonYear} ${SEASON_LABEL[a.season] ?? a.season}`
                                    : a.seasonYear,
                                  a.episodesTotal && `${a.episodesTotal} 集`,
                                ].filter(Boolean).join(" · ")}
                              </p>
                              {a.description && (
                                <p className="line-clamp-2 text-xs text-muted/80">{a.description}</p>
                              )}
                              <div className="flex gap-2 pt-1">
                                <Button
                                  className="!py-1 !px-3 text-xs"
                                  disabled={addingId === a.id}
                                  onClick={() => quickAddToList(a.id)}
                                >
                                  {addingId === a.id ? "加入中…" : "+ 加入追番"}
                                </Button>
                                <Link to={`/app/anime/${a.id}`}>
                                  <Button variant="ghost" className="!py-1 !px-3 text-xs">
                                    前往作品頁 →
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {results.external.length > 0 && (
                <section>
                  <p className="section-label mb-2">外部資料庫</p>
                  <ul className="divide-y divide-border/50 border-y border-border/50">
                    {results.external.map((c, i) => (
                      <li
                        key={c.externalAnilistId ?? c.externalBangumiId ?? i}
                        className="search-result-item flex items-center gap-3 py-3"
                      >
                        {c.coverImageUrl && (
                          <img
                            src={coverUrl(c.coverImageUrl)}
                            alt=""
                            className="h-12 w-9 shrink-0 rounded-lg object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text">{candidateTitle(c)}</p>
                          <p className="font-mono text-xs text-muted">
                            {[
                              c.format && FORMAT_LABEL[c.format],
                              c.seasonYear && c.season
                                ? `${c.seasonYear} ${SEASON_LABEL[c.season] ?? c.season}`
                                : c.seasonYear,
                              c.episodes && `${c.episodes} 集`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          className="shrink-0 !py-1 text-xs"
                          onClick={() => selectCandidate(c)}
                        >
                          選這部
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {results.local.length === 0 && results.external.length === 0 && (
                <p className="text-sm text-muted">找不到結果</p>
              )}
            </div>
          )}
        </>
      )}

      {phase === "confirm" && selected && (
        <div className="confirm-panel space-y-5">
          <button onClick={goBack} className="section-label hover:text-text transition-colors">
            ← 重新搜尋
          </button>

          <div className="flex gap-4 rounded-xl border border-border/70 bg-panel/90 p-4">
            {selected.coverImageUrl && (
              <img
                src={coverUrl(selected.coverImageUrl)}
                alt=""
                className="h-24 w-[4.5rem] shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-text">{candidateTitle(selected)}</p>
              {selected.titleRomaji && (
                <p className="font-mono text-xs text-muted">{selected.titleRomaji}</p>
              )}
              <p className="font-mono text-xs text-muted">
                {[
                  selected.format && FORMAT_LABEL[selected.format],
                  selected.seasonYear && selected.season
                    ? `${selected.seasonYear} ${SEASON_LABEL[selected.season] ?? selected.season}`
                    : selected.seasonYear,
                  selected.episodes && `${selected.episodes} 集`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="font-mono text-xs text-muted/60">
                來源：{selected.source === "anilist" ? "AniList" : selected.source === "bangumi" ? "Bangumi" : "MAL"}
              </p>
            </div>
          </div>

          <form onSubmit={confirmImport} className="space-y-4">
            <Field label="顯示名稱（可修改）">
              <Input
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                maxLength={300}
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={addToList}
                onChange={(e) => setAddToList(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              加入我的追番清單（想看）
            </label>

            {importError && <ErrorText>{importError}</ErrorText>}

            <div className="flex gap-2">
              <Button type="submit" disabled={importing}>
                {importing ? "匯入中…" : "確認匯入"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
                取消
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
