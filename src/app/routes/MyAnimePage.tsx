import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, coverUrl } from "../lib/api";
import { Button, Select, Input, Loading, ProgressRail } from "../components/ui";
import { useReveal } from "../lib/motion";
import { WATCH_STATUSES, ANIME_PRIORITIES } from "../../shared/types";
import type { UserAnimeWithAnime, WatchStatus, AnimePriority } from "../../shared/types";

const statusLabel: Record<WatchStatus, string> = {
  watching: "進行中",
  planned: "想看",
  paused: "暫停",
  completed: "已完成",
  dropped: "棄追",
};
const priorityLabel: Record<AnimePriority, string> = { high: "優先追", normal: "一般", low: "之後再看" };
const FORMAT_LABEL: Record<string, string> = {
  TV: "TV", MOVIE: "電影", OVA: "OVA", ONA: "ONA", SPECIAL: "特別篇", MUSIC: "MV",
};
const SEASON_LABEL: Record<string, string> = {
  SPRING: "春", SUMMER: "夏", FALL: "秋", WINTER: "冬",
};

const GROUP_ORDER: WatchStatus[] = ["watching", "planned", "paused", "completed", "dropped"];
const statusRank = Object.fromEntries(GROUP_ORDER.map((s, i) => [s, i])) as Record<WatchStatus, number>;

function animeTitle(a: UserAnimeWithAnime["anime"]): string {
  return a.titleZh || a.title || a.titleJp || "未命名";
}

function animeAltTitle(a: UserAnimeWithAnime["anime"]): string | null {
  const title = animeTitle(a);
  return [a.titleRomaji, a.titleNative, a.titleEnglish, a.titleJp].find((t) => t && t !== title) ?? null;
}

function animeMeta(a: UserAnimeWithAnime["anime"]): string {
  return [
    a.format && (FORMAT_LABEL[a.format] ?? a.format),
    a.seasonYear && a.season ? `${a.seasonYear} ${SEASON_LABEL[a.season] ?? a.season}` : a.seasonYear,
    a.episodesTotal && `${a.episodesTotal} 集`,
  ].filter(Boolean).join(" · ");
}

function sortList(list: UserAnimeWithAnime[]): UserAnimeWithAnime[] {
  return [...list].sort((a, b) => {
    const ao = a.sortOrder ?? Infinity;
    const bo = b.sortOrder ?? Infinity;
    if (ao !== bo) return ao - bo;
    // Fall back to status group then updatedAt for unsorted items
    const sr = statusRank[a.status] - statusRank[b.status];
    if (sr !== 0) return sr;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function MyAnimePage() {
  const [list, setList] = useState<UserAnimeWithAnime[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const reorderTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get<UserAnimeWithAnime[]>("/api/my/anime").then(setList).catch(() => setList([]));
  }, []);

  function patchLocal(id: string, fields: Partial<UserAnimeWithAnime>) {
    setList((prev) => prev?.map((i) => (i.id === id ? { ...i, ...fields } : i)) ?? prev);
  }
  function removeLocal(id: string) {
    setList((prev) => prev?.filter((i) => i.id !== id) ?? prev);
  }

  function handleDragStart(id: string) {
    setDragId(id);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (dragId && dragId !== id) setDragOverId(id);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId || !list) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const sorted = sortList(list);
    const fromIdx = sorted.findIndex((i) => i.id === dragId);
    const toIdx = sorted.findIndex((i) => i.id === targetId);
    const reordered = [...sorted];
    const [moved] = reordered.splice(fromIdx, 1);
    if (!moved) return;
    reordered.splice(toIdx, 0, moved);
    const withOrders = reordered.map((item, i) => ({ ...item, sortOrder: i }));
    setList(withOrders);
    setDragId(null);
    setDragOverId(null);

    if (reorderTimeout.current) clearTimeout(reorderTimeout.current);
    reorderTimeout.current = setTimeout(() => {
      void api.patch("/api/my/anime/reorder", {
        orders: withOrders.map((item) => ({ id: item.id, sortOrder: item.sortOrder! })),
      });
    }, 500);
  }

  function handleDragEnd() {
    setDragId(null);
    setDragOverId(null);
  }

  const scope = useReveal<HTMLDivElement>([list === null]);

  if (list === null) return <Loading />;

  const sortedList = sortList(list);
  const counts = GROUP_ORDER.map((status) => ({
    status,
    count: list.filter((i) => i.status === status).length,
  })).filter((g) => g.count > 0);

  return (
    <div ref={scope} className="space-y-6">
      <header data-reveal className="flex items-baseline justify-between">
        <div>
          <p className="section-label">我的追番 · {list.length} 部</p>
          <h1 className="mt-1 text-2xl font-semibold text-text">追番清單</h1>
        </div>
        <Link to="/app/anime/new">
          <Button variant="ghost">新增動畫</Button>
        </Link>
      </header>

      {list.length === 0 ? (
        <p data-reveal className="text-muted">清單是空的，先去新增一部動畫</p>
      ) : (
        <div data-reveal className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {counts.map((g) => (
              <span key={g.status} className="kbd-label rounded-full border border-border/60 px-2.5 py-1">
                {statusLabel[g.status]} {g.count}
              </span>
            ))}
          </div>

          <ul className="divide-y divide-border/50 border-y border-border/50">
            {sortedList.map((item) => (
              <MyAnimeRow
                key={item.id}
                item={item}
                isDragging={dragId === item.id}
                isDragOver={dragOverId === item.id}
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDrop={(e) => handleDrop(e, item.id)}
                onDragEnd={handleDragEnd}
                onPatch={(f) => patchLocal(item.id, f)}
                onRemove={() => removeLocal(item.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MyAnimeRow({
  item,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onPatch,
  onRemove,
}: {
  item: UserAnimeWithAnime;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onPatch: (f: Partial<UserAnimeWithAnime>) => void;
  onRemove: () => void;
}) {
  const [episode, setEpisode] = useState(String(item.currentEpisode));
  const [saving, setSaving] = useState(false);
  const total = item.anime.episodesTotal;
  const title = animeTitle(item.anime);
  const altTitle = animeAltTitle(item.anime);
  const meta = animeMeta(item.anime);

  async function save(fields: Partial<Pick<UserAnimeWithAnime, "status" | "currentEpisode" | "priority" | "isPublic">>) {
    setSaving(true);
    onPatch(fields);
    try {
      await api.patch(`/api/my/anime/${item.id}`, fields);
    } finally {
      setSaving(false);
    }
  }

  function commitEpisode() {
    const n = Math.max(0, Math.floor(Number(episode)) || 0);
    setEpisode(String(n));
    if (n !== item.currentEpisode) void save({ currentEpisode: n });
  }

  async function remove() {
    if (!confirm(`從追番清單移除「${animeTitle(item.anime)}」？`)) return;
    await api.del(`/api/my/anime/${item.id}`);
    onRemove();
  }

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={[
        "group grid grid-cols-[1.25rem_4.75rem_minmax(0,1fr)] gap-3 py-4",
        "md:grid-cols-[1.25rem_5.5rem_minmax(0,1fr)] md:gap-5 md:py-5",
        "transition-opacity",
        isDragging ? "opacity-40" : "",
        isDragOver ? "border-t-2 border-accent/60" : "",
      ].filter(Boolean).join(" ")}
    >
      {/* Drag handle */}
      <div className="flex cursor-grab items-center justify-center text-muted/40 active:cursor-grabbing select-none">
        ⠿
      </div>

      <Link to={`/app/anime/${item.animeId}`} className="block">
        {item.anime.coverImageUrl ? (
          <img
            src={coverUrl(item.anime.coverImageUrl)}
            alt=""
            className="elev aspect-[2/3] w-full rounded-lg object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="aspect-[2/3] w-full rounded-lg border border-border/60 bg-panel/70 p-2 text-xs text-muted">
            無封面
          </div>
        )}
      </Link>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="kbd-label rounded-full border border-border/60 px-2 py-0.5">
            {statusLabel[item.status]}
          </span>
          {item.priority === "high" && (
            <span className="kbd-label rounded-full border border-accent/40 px-2 py-0.5 text-accent">
              高優先
            </span>
          )}
        </div>

        <div className="min-w-0">
          <Link to={`/app/anime/${item.animeId}`} className="text-base font-semibold leading-snug text-text hover:text-accent">
            {title}
          </Link>
          {altTitle && <p className="mt-0.5 truncate font-mono text-xs text-muted">{altTitle}</p>}
          {meta && <p className="mt-1 font-mono text-xs text-muted/80">{meta}</p>}
        </div>

        {item.anime.description && (
          <p className="hidden max-w-2xl text-sm leading-relaxed text-muted/75 md:line-clamp-2">
            {item.anime.description}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">看到 EP</span>
            <Input
              aria-label="目前集數"
              type="number"
              min={0}
              value={episode}
              onChange={(e) => setEpisode(e.target.value)}
              onBlur={commitEpisode}
              className="w-14 px-2 py-1 text-center text-xs"
            />
            {total ? <span className="font-mono text-xs text-muted">/ {total}</span> : null}
            <span className="ml-auto font-mono text-xs text-muted">接著 EP{(Number(episode) || 0) + 1}</span>
          </div>
          <ProgressRail current={Number(episode) || 0} total={total} />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Select
            aria-label="狀態"
            value={item.status}
            onChange={(e) => void save({ status: e.target.value as WatchStatus })}
            className="w-auto py-1 pl-2 pr-7 text-xs"
          >
            {WATCH_STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel[s]}</option>
            ))}
          </Select>
          <Select
            aria-label="追番順序"
            value={item.priority}
            onChange={(e) => void save({ priority: e.target.value as AnimePriority })}
            className="w-auto py-1 pl-2 pr-7 text-xs"
          >
            {ANIME_PRIORITIES.map((p) => (
              <option key={p} value={p}>{priorityLabel[p]}</option>
            ))}
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={item.isPublic}
              onChange={(e) => void save({ isPublic: e.target.checked })}
              className="accent-[var(--color-accent)]"
            />
            公開
          </label>
          <button
            onClick={remove}
            className="text-xs text-muted transition-colors hover:text-accent"
            disabled={saving}
          >
            移除
          </button>
        </div>
      </div>
    </li>
  );
}
