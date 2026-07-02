import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fmtDate } from "../lib/date";
import { api, coverUrl } from "../lib/api";
import { markEpisodeWatched } from "../lib/watch";
import { Panel, Badge, Button, ProgressRail, Loading, SourceLinkButtons } from "../components/ui";
import { AnnouncementStrip } from "../components/Announcements";
import { useReveal } from "../lib/motion";
import type { UserAnimeWithAnime, WatchSession, AnimePriority, SourceLink, CommunitySummary } from "../../shared/types";

const priorityRank: Record<AnimePriority, number> = { high: 0, normal: 1, low: 2 };

function animeTitle(a: UserAnimeWithAnime["anime"]): string {
  return a.titleZh || a.title || a.titleJp || "未命名";
}

export function DashboardPage() {
  const [list, setList] = useState<UserAnimeWithAnime[] | null>(null);
  const [sessions, setSessions] = useState<WatchSession[]>([]);
  const [heroLinks, setHeroLinks] = useState<SourceLink[]>([]);
  const [community, setCommunity] = useState<CommunitySummary | null>(null);
  const [completing, setCompleting] = useState(false);

  function loadSessions() {
    api.get<WatchSession[]>("/api/my/watch-sessions").then(setSessions).catch(() => undefined);
  }

  useEffect(() => {
    api.get<UserAnimeWithAnime[]>("/api/my/anime").then(setList).catch(() => setList([]));
    api.get<CommunitySummary>("/api/community/summary").then(setCommunity).catch(() => setCommunity({ trendingAnime: [] }));
    loadSessions();
  }, []);

  const buckets = useMemo(() => {
    const items = list ?? [];
    const byPriority = (a: UserAnimeWithAnime, b: UserAnimeWithAnime) =>
      priorityRank[a.priority] - priorityRank[b.priority] ||
      b.updatedAt.localeCompare(a.updatedAt);
    return {
      watching: items.filter((i) => i.status === "watching").sort(byPriority),
      planned: items.filter((i) => i.status === "planned").sort(byPriority),
      paused: items.filter((i) => i.status === "paused").sort(byPriority),
    };
  }, [list]);

  const hero = buckets.watching[0] ?? null;
  const rest = buckets.watching.slice(1);

  // Load watch entries for the top pick only (cheap — one request).
  useEffect(() => {
    if (!hero) {
      setHeroLinks([]);
      return;
    }
    api
      .get<SourceLink[]>(`/api/anime/${hero.animeId}/source-links`)
      .then(setHeroLinks)
      .catch(() => setHeroLinks([]));
  }, [hero?.animeId]);

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of list ?? []) m.set(i.animeId, animeTitle(i.anime));
    return m;
  }, [list]);

  async function completeNext(item: UserAnimeWithAnime) {
    const next = item.currentEpisode + 1;
    setCompleting(true);
    setList((prev) => prev?.map((i) => (i.id === item.id ? { ...i, currentEpisode: next } : i)) ?? prev);
    try {
      await markEpisodeWatched(item.animeId, next);
      loadSessions();
    } catch {
      // revert on failure
      setList((prev) => prev?.map((i) => (i.id === item.id ? { ...i, currentEpisode: item.currentEpisode } : i)) ?? prev);
    } finally {
      setCompleting(false);
    }
  }

  const scope = useReveal<HTMLDivElement>([list === null, hero?.id]);

  if (list === null) return <Loading />;

  if (list.length === 0) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="section-label">還沒有任何追番紀錄</p>
        <p className="text-muted">先新增一部動畫，系統就會幫你記著。</p>
        <Link to="/app/anime/new">
          <Button>新增第一部動畫</Button>
        </Link>
      </div>
    );
  }

  return (
    <div ref={scope} className="space-y-10">
      <header data-reveal className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-label">今日進度 · {buckets.watching.length} 部進行中</p>
          <h1 className="mt-1 text-3xl font-semibold text-text">接著看哪一集？</h1>
        </div>
        <Link to="/app/my-anime" className="text-sm text-muted transition-colors hover:text-accent">
          管理追番清單 →
        </Link>
      </header>

      <div data-reveal>
        <AnnouncementStrip />
      </div>

      <section data-reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-8">
          {hero ? (
            <HeroCard item={hero} links={heroLinks} completing={completing} onComplete={() => completeNext(hero)} />
          ) : (
            <Panel>
              <p className="text-muted">目前沒有進行中的番。從下面「想看」挑一部，標成進行中就會出現在這裡。</p>
            </Panel>
          )}

          <div className="grid gap-8 sm:grid-cols-2">
            <CompactBucket title="想看" emptyHint="還沒有想看清單" items={buckets.planned} />
            <CompactBucket title="暫停中" emptyHint="沒有暫停中的番" items={buckets.paused} />
          </div>
        </div>

        <aside className="space-y-6">
          {rest.length > 0 && (
            <section>
              <p className="section-label mb-2">其他進行中 · {rest.length}</p>
              <div className="space-y-1">
                {rest.map((item) => (
                  <Link
                    key={item.id}
                    to={`/app/anime/${item.animeId}`}
                    className="group flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface/60"
                  >
                    <span className="min-w-0 truncate text-sm text-text group-hover:text-accent">{animeTitle(item.anime)}</span>
                    <span className="shrink-0 font-mono text-xs text-signal">EP{item.currentEpisode + 1}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <RecentSessions sessions={sessions.slice(0, 6)} titleById={titleById} />
          <CommunitySignal summary={community} />
        </aside>
      </section>
    </div>
  );
}

function CommunitySignal({ summary }: { summary: CommunitySummary | null }) {
  const items = summary?.trendingAnime.slice(0, 5) ?? [];
  if (items.length === 0) return null;
  return (
    <section>
      <p className="section-label mb-2">大家在看</p>
      <ul className="divide-y divide-border/40 border-y border-border/40">
        {items.map((item) => (
          <li key={item.animeId} className="py-2.5 text-sm">
            <Link to={`/app/anime/${item.animeId}`} className="text-text transition-colors hover:text-accent">
              {item.titleZh ?? item.title}
            </Link>
            <p className="mt-0.5 font-mono text-xs text-muted">
              {item.watchingCount} 人公開追番 · {item.recentProgressCount} 次更新 · {item.noteCount} 則短評
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HeroCard({
  item,
  links,
  completing,
  onComplete,
}: {
  item: UserAnimeWithAnime;
  links: SourceLink[];
  completing: boolean;
  onComplete: () => void;
}) {
  const total = item.anime.episodesTotal;
  const next = item.currentEpisode + 1;
  return (
    <Panel className="overflow-hidden p-0">
      <div className="grid gap-0 sm:grid-cols-[11rem_1fr]">
      {item.anime.coverImageUrl && (
        <Link to={`/app/anime/${item.animeId}`} className="block bg-surface/60">
          <img
            src={coverUrl(item.anime.coverImageUrl)}
            alt=""
            className="h-full min-h-56 w-full object-cover transition-transform hover:scale-[1.02]"
          />
        </Link>
      )}

      <div className={`min-w-0 space-y-5 p-5 ${item.anime.coverImageUrl ? "" : "sm:col-span-2"}`}>
        <div className="space-y-2">
          <p className="section-label">現在接著</p>
          <p className="font-mono text-4xl font-semibold leading-none text-signal">EP{next}</p>
          <Link to={`/app/anime/${item.animeId}`} className="min-w-0">
            <h2 className="text-xl font-semibold leading-snug text-text transition-colors hover:text-accent">
              {animeTitle(item.anime)}
            </h2>
          </Link>
          {item.priority === "high" && <Badge tone="accent">高優先</Badge>}
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-sm text-signal">看到 EP{item.currentEpisode} · 接著 EP{next}</span>
            <span className="kbd-label">{total ? `${item.currentEpisode} / ${total}` : `EP${item.currentEpisode}`}</span>
          </div>
          <ProgressRail current={item.currentEpisode} total={total} />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <SourceLinkButtons links={links} />
          <Button onClick={onComplete} disabled={completing}>
            {completing ? "更新中…" : `看完 EP${next}`}
          </Button>
          {links.length === 0 && (
            <Link to={`/app/anime/${item.animeId}`} className="text-sm text-muted transition-colors hover:text-accent">
              設定觀看入口 →
            </Link>
          )}
        </div>
      </div>
      </div>
    </Panel>
  );
}

function RecentSessions({
  sessions,
  titleById,
}: {
  sessions: WatchSession[];
  titleById: Map<string, string>;
}) {
  return (
    <section>
      <p className="section-label mb-2">最近觀看</p>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted">還沒有觀看紀錄</p>
      ) : (
        <ul className="divide-y divide-border/40 border-y border-border/40">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <Link to={`/app/anime/${s.animeId}`} className="min-w-0 truncate text-text transition-colors hover:text-accent">
                {titleById.get(s.animeId) ?? "動畫"}
              </Link>
              <span className="shrink-0 font-mono text-xs text-muted">
                EP{s.episodeNumber} · {fmtDate(s.watchedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CompactBucket({
  title,
  items,
  emptyHint,
}: {
  title: string;
  items: UserAnimeWithAnime[];
  emptyHint: string;
}) {
  return (
    <section>
      <p className="section-label mb-2">{title} · {items.length}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted/70">{emptyHint}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/app/anime/${item.animeId}`}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-surface/60 hover:text-text"
              >
                <span className="min-w-0 truncate">{animeTitle(item.anime)}</span>
                <span className="shrink-0 font-mono text-xs">EP{item.currentEpisode}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
