import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, ApiError, coverUrl } from "../lib/api";
import { hasPermission, useAuth } from "../lib/auth";
import { markEpisodeWatched } from "../lib/watch";
import { Panel, Button, Badge, Field, Input, Select, Textarea, ErrorText, SectionTitle, ProgressRail, Loading, SourceLinkButtons } from "../components/ui";
import { useReveal } from "../lib/motion";
import { ANIME_NOTE_TYPES, NOTE_VISIBILITIES, SOURCE_TYPES, SPOILER_LEVELS } from "../../shared/types";
import type { Anime, AnimeNote, AnimeNoteType, NoteVisibility, SourceLink, SourceType, SpoilerLevel, UserAnimeWithAnime } from "../../shared/types";

const sourceTypeLabel: Record<SourceType, string> = {
  official: "官方",
  community_link: "社群連結",
  search_link: "搜尋連結",
  manual: "手動",
};

const FORMAT_LABEL: Record<string, string> = {
  TV: "TV", MOVIE: "電影", OVA: "OVA", ONA: "ONA", SPECIAL: "特別篇", MUSIC: "MV",
};
const SEASON_LABEL: Record<string, string> = {
  SPRING: "春", SUMMER: "夏", FALL: "秋", WINTER: "冬",
};
const noteTypeLabel: Record<AnimeNoteType, string> = {
  note: "短記",
  recommendation: "推薦",
  episode_comment: "單集感想",
  question: "疑問",
};
const spoilerLabel: Record<SpoilerLevel, string> = {
  none: "無防雷",
  minor: "輕微防雷",
  major: "重大防雷",
};
const noteVisibilityLabel: Record<NoteVisibility, string> = {
  private: "只給自己",
  community: "社群可見",
};

export function AnimeDetailPage() {
  const { id = "" } = useParams();
  const { me } = useAuth();
  const isAdmin = hasPermission(me, "anime.manage");

  const [anime, setAnime] = useState<Anime | null>(null);
  const [links, setLinks] = useState<SourceLink[]>([]);
  const [tracking, setTracking] = useState<UserAnimeWithAnime | null>(null);
  const [notFound, setNotFound] = useState(false);
  const scope = useReveal<HTMLDivElement>([anime?.id, notFound]);

  async function loadTracking() {
    const list = await api.get<UserAnimeWithAnime[]>("/api/my/anime");
    setTracking(list.find((i) => i.animeId === id) ?? null);
  }

  function reloadLinks() {
    api.get<SourceLink[]>(`/api/anime/${id}/source-links`).then(setLinks).catch(() => undefined);
  }

  useEffect(() => {
    api.get<Anime>(`/api/anime/${id}`).then(setAnime).catch((err) => {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
    });
    reloadLinks();
    void loadTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="section-label">找不到這個頁面</p>
        <Link to="/app" className="text-accent hover:underline">回到接著看</Link>
      </div>
    );
  }
  if (!anime) return <Loading />;

  const displayTitle = anime.titleZh || anime.titleNative || anime.titleRomaji || anime.title;
  const altTitles = [
    anime.titleRomaji !== displayTitle && anime.titleRomaji,
    anime.titleNative !== displayTitle && anime.titleNative,
    anime.titleEnglish,
    anime.title !== displayTitle && anime.title,
  ].filter(Boolean) as string[];

  const infoChips = [
    anime.format && FORMAT_LABEL[anime.format],
    anime.seasonYear && anime.season
      ? `${anime.seasonYear} ${SEASON_LABEL[anime.season] ?? anime.season}`
      : anime.seasonYear,
    anime.episodesTotal && `${anime.episodesTotal} 集`,
  ].filter(Boolean) as string[];

  return (
    <div ref={scope} className="space-y-8">
      <header data-reveal className="space-y-3">
        <Link to="/app" className="section-label hover:text-text transition-colors">← 接著看</Link>
        <div className="flex gap-4 lg:block">
          {anime.coverImageUrl && (
            <img
              src={coverUrl(anime.coverImageUrl)}
              alt=""
              className="elev h-28 w-20 shrink-0 rounded-lg object-cover lg:hidden"
            />
          )}
          <div className="min-w-0 space-y-2">
            <h1 className="max-w-3xl text-3xl font-semibold leading-snug text-text">{displayTitle}</h1>
            {infoChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {infoChips.map((chip) => <Badge key={chip}>{chip}</Badge>)}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <main className="space-y-8">
          <div data-reveal>
            <ContinueWatching
              animeId={id}
              tracking={tracking}
              episodesTotal={anime.episodesTotal}
              links={links}
              onChange={loadTracking}
            />
          </div>

          <div data-reveal>
            <SourceLinksSection animeId={id} links={links} canDelete={isAdmin} onChange={reloadLinks} />
          </div>

          <div data-reveal>
            <WatchLogSection
              animeId={id}
              nextEpisode={(tracking?.currentEpisode ?? 0) + 1}
              links={links}
              onLogged={loadTracking}
            />
          </div>

          <div data-reveal>
            <AnimeNotesSection animeId={id} isAdmin={isAdmin} />
          </div>

          <div data-reveal>
            <AnimeEditRequestSection anime={anime} />
          </div>
        </main>

        <aside data-reveal className="space-y-5 lg:sticky lg:top-24">
          {anime.coverImageUrl && (
            <img
              src={coverUrl(anime.coverImageUrl)}
              alt=""
              className="elev hidden aspect-[2/3] w-full rounded-xl object-cover lg:block"
            />
          )}
          <AnimeInfoSection anime={anime} altTitles={altTitles} />
        </aside>
      </div>
    </div>
  );
}

function AnimeEditRequestSection({ anime }: { anime: Anime }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titleZh: anime.titleZh ?? "",
    titleJp: anime.titleJp ?? "",
    episodesTotal: anime.episodesTotal ? String(anime.episodesTotal) : "",
    coverImageUrl: anime.coverImageUrl ?? "",
    description: anime.description ?? "",
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      titleZh: form.titleZh.trim() || null,
      titleJp: form.titleJp.trim() || null,
      episodesTotal: form.episodesTotal.trim() ? Math.max(0, Math.floor(Number(form.episodesTotal))) : null,
      coverImageUrl: form.coverImageUrl.trim() || null,
      description: form.description.trim() || null,
    };
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/anime/${anime.id}/edit-requests`, {
        payload,
        note: form.note.trim() || null,
      });
      setDone(true);
      setOpen(false);
    } catch {
      setError("送出失敗，請確認網址與集數格式。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle label="資料修正">提交動畫內容編輯</SectionTitle>
        <Button variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "收起" : "提交修正"}
        </Button>
      </div>
      {done && <p className="mb-3 text-sm text-signal">已送出，等待管理員審核。</p>}
      {open && (
        <Panel>
          <form onSubmit={submit} className="space-y-4" onKeyDown={(e) => { if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) e.preventDefault(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="中文名稱">
                <Input value={form.titleZh} onChange={(e) => setForm((f) => ({ ...f, titleZh: e.target.value }))} maxLength={300} />
              </Field>
              <Field label="日文名稱">
                <Input value={form.titleJp} onChange={(e) => setForm((f) => ({ ...f, titleJp: e.target.value }))} maxLength={300} />
              </Field>
              <Field label="總集數">
                <Input type="number" min={0} value={form.episodesTotal} onChange={(e) => setForm((f) => ({ ...f, episodesTotal: e.target.value }))} />
              </Field>
              <Field label="封面 URL">
                <Input type="url" value={form.coverImageUrl} onChange={(e) => setForm((f) => ({ ...f, coverImageUrl: e.target.value }))} maxLength={2000} />
              </Field>
            </div>
            <Field label="介紹">
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} maxLength={5000} />
            </Field>
            <Field label="給審核者的備註（選填）">
              <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} maxLength={1000} />
            </Field>
            {error && <ErrorText>{error}</ErrorText>}
            <Button type="submit" disabled={busy}>{busy ? "送出中…" : "送出審核"}</Button>
          </form>
        </Panel>
      )}
    </section>
  );
}

function ContinueWatching({
  animeId,
  tracking,
  episodesTotal,
  links,
  onChange,
}: {
  animeId: string;
  tracking: UserAnimeWithAnime | null;
  episodesTotal: number | null;
  links: SourceLink[];
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      await api.post("/api/my/anime", { animeId, status: "watching" });
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function completeNext() {
    if (!tracking) return;
    setBusy(true);
    try {
      await markEpisodeWatched(animeId, tracking.currentEpisode + 1);
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  if (!tracking) {
    return (
      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="section-label">繼續看</div>
          <p className="text-sm text-muted">還沒有在追這部。</p>
        </div>
        <Button onClick={add} disabled={busy}>{busy ? "加入中…" : "加入我的追番"}</Button>
      </Panel>
    );
  }

  const next = tracking.currentEpisode + 1;
  return (
    <Panel className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="section-label">繼續看</div>
        <Link to="/app/my-anime" className="text-xs text-muted transition-colors hover:text-accent">編輯狀態 →</Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-sm text-signal">看到 EP{tracking.currentEpisode} · 接著 EP{next}</span>
          <span className="kbd-label">{episodesTotal ? `${tracking.currentEpisode} / ${episodesTotal}` : `EP${tracking.currentEpisode}`}</span>
        </div>
        <ProgressRail current={tracking.currentEpisode} total={episodesTotal} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SourceLinkButtons links={links} />
        <Button onClick={completeNext} disabled={busy}>
          {busy ? "更新中…" : `✓ 看完 EP${next}`}
        </Button>
      </div>
    </Panel>
  );
}

function WatchLogSection({
  animeId,
  nextEpisode,
  links,
  onLogged,
}: {
  animeId: string;
  nextEpisode: number;
  links: SourceLink[];
  onLogged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [episode, setEpisode] = useState(String(nextEpisode));
  const [sourceLinkId, setSourceLinkId] = useState("");
  const [completed, setCompleted] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setEpisode(String(nextEpisode)), [nextEpisode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.floor(Number(episode));
    if (!Number.isInteger(n) || n < 1) {
      setError("集數必須是正整數。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/my/watch-sessions", {
        animeId,
        episodeNumber: n,
        sourceLinkId: sourceLinkId || null,
        completed,
        note: note.trim() || null,
      });
      setNote("");
      setOpen(false);
      await onLogged();
    } catch {
      setError("記錄失敗，請稍後再試。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle label="觀看紀錄">補登一筆</SectionTitle>
        <Button variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? "收起" : "＋ 指定集數 / 備註"}
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted/70">想記特定一集、指定入口或加備註時用這裡；單純看完下一集用上面的「看完」就好。</p>
      {open && (
        <Panel>
          <form onSubmit={submit} className="space-y-4" onKeyDown={(e) => { if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) e.preventDefault(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="集數（正整數）">
                <Input type="number" min={1} value={episode} onChange={(e) => setEpisode(e.target.value)} />
              </Field>
              <Field label="從哪個入口看的（選填）">
                <Select value={sourceLinkId} onChange={(e) => setSourceLinkId(e.target.value)}>
                  <option value="">— 不指定 —</option>
                  {links.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              看完這集（會更新「看到第幾集」）
            </label>
            <Field label="備註（選填）">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            </Field>
            {error && <ErrorText>{error}</ErrorText>}
            <Button type="submit" disabled={busy}>{busy ? "記錄中…" : "記錄"}</Button>
          </form>
        </Panel>
      )}
    </section>
  );
}

function SourceLinksSection({
  animeId,
  links,
  canDelete,
  onChange,
}: {
  animeId: string;
  links: SourceLink[];
  canDelete: boolean;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "community_link" as SourceType, label: "", url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim() || !form.url.trim()) {
      setError("名稱與連結都要填。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/anime/${animeId}/source-links`, {
        type: form.type,
        label: form.label.trim(),
        url: form.url.trim(),
      });
      setForm({ type: "community_link", label: "", url: "" });
      setOpen(false);
      onChange();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? "連結格式不正確（需 http/https）。" : "新增失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function remove(linkId: string) {
    await api.del(`/api/source-links/${linkId}`);
    onChange();
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle label="觀看入口">在哪裡看</SectionTitle>
        <Button variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? "收起" : "＋ 新增入口"}
        </Button>
      </div>

      {open && (
        <Panel className="mb-4">
          <form onSubmit={add} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="類型">
                <Select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SourceType }))}
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>{sourceTypeLabel[t]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="名稱">
                <Input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="例如：巴哈姆特動畫瘋"
                  maxLength={200}
                />
              </Field>
              <Field label="連結 URL">
                <Input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://…"
                  maxLength={2000}
                />
              </Field>
            </div>
            {error && <ErrorText>{error}</ErrorText>}
            <Button type="submit" disabled={busy}>{busy ? "新增中…" : "新增入口"}</Button>
          </form>
        </Panel>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-muted">
          還沒有觀看入口。新增一個方便大家點過去。
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <Badge>{sourceTypeLabel[l.type]}</Badge>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="truncate text-sm text-text hover:text-accent"
                >
                  {l.label}
                </a>
              </div>
              {canDelete && (
                <button onClick={() => remove(l.id)} className="shrink-0 text-xs text-muted hover:text-accent">
                  刪除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted/60">只保存連結本身，不抓取、不嵌入、不下載任何影片內容。</p>
    </section>
  );
}

function AnimeNotesSection({ animeId, isAdmin }: { animeId: string; isAdmin: boolean }) {
  const [mine, setMine] = useState<AnimeNote[]>([]);
  const [community, setCommunity] = useState<AnimeNote[]>([]);
  const [form, setForm] = useState({
    episodeNumber: "",
    type: "note" as AnimeNoteType,
    spoilerLevel: "none" as SpoilerLevel,
    visibility: "private" as NoteVisibility,
    content: "",
  });
  const [busy, setBusy] = useState(false);

  function load() {
    api.get<{ mine: AnimeNote[]; community: AnimeNote[] }>(`/api/anime/${animeId}/notes`)
      .then((data) => {
        setMine(data.mine);
        setCommunity(data.community);
      })
      .catch(() => {
        setMine([]);
        setCommunity([]);
      });
  }

  useEffect(load, [animeId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/anime/${animeId}/notes`, {
        episodeNumber: form.episodeNumber ? Math.max(1, Math.floor(Number(form.episodeNumber))) : null,
        type: form.type,
        spoilerLevel: form.spoilerLevel,
        visibility: form.visibility,
        content: form.content.trim(),
      });
      setForm((f) => ({ ...f, episodeNumber: "", content: "" }));
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/api/anime-notes/${id}`);
    load();
  }

  return (
    <section>
      <div className="mb-3">
        <SectionTitle label="花瓣短評">作品短記</SectionTitle>
        <p className="text-xs text-muted/70">短評必須綁定作品；community 只給成員看，不會變成公開論壇。</p>
      </div>

      <form onSubmit={submit} className="mb-5 space-y-3 border-y border-border/50 py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[7rem_9rem_9rem_9rem]">
          <Input
            type="number"
            min={1}
            value={form.episodeNumber}
            onChange={(e) => setForm((f) => ({ ...f, episodeNumber: e.target.value }))}
            placeholder="集數"
            aria-label="集數"
          />
          <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AnimeNoteType }))}>
            {ANIME_NOTE_TYPES.map((type) => <option key={type} value={type}>{noteTypeLabel[type]}</option>)}
          </Select>
          <Select value={form.spoilerLevel} onChange={(e) => setForm((f) => ({ ...f, spoilerLevel: e.target.value as SpoilerLevel }))}>
            {SPOILER_LEVELS.map((level) => <option key={level} value={level}>{spoilerLabel[level]}</option>)}
          </Select>
          <Select value={form.visibility} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as NoteVisibility }))}>
            {NOTE_VISIBILITIES.map((visibility) => <option key={visibility} value={visibility}>{noteVisibilityLabel[visibility]}</option>)}
          </Select>
        </div>
        <Textarea
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          placeholder="留一片花瓣短評"
          maxLength={2000}
          required
        />
        <Button type="submit" disabled={busy}>{busy ? "送出中…" : "新增短評"}</Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <NoteList title="我的短評" items={mine} onRemove={remove} canModerate={false} />
        <NoteList title="社群短評" items={community} onRemove={remove} canModerate={isAdmin} />
      </div>
    </section>
  );
}

function NoteList({
  title,
  items,
  onRemove,
  canModerate,
}: {
  title: string;
  items: AnimeNote[];
  onRemove: (id: string) => void;
  canModerate: boolean;
}) {
  return (
    <section>
      <p className="section-label mb-2">{title} · {items.length}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">目前沒有短評</p>
      ) : (
        <ul className="divide-y divide-border/40 border-y border-border/40">
          {items.map((note) => (
            <li key={note.id} className="py-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{noteTypeLabel[note.type]}</span>
                {note.episodeNumber && <span className="font-mono">EP{note.episodeNumber}</span>}
                <span>{spoilerLabel[note.spoilerLevel]}</span>
                {note.userName && <span>{note.userName}</span>}
                {(canModerate || title === "我的短評") && (
                  <button onClick={() => onRemove(note.id)} className="ml-auto text-accent">刪除</button>
                )}
              </div>
              {note.spoilerLevel === "none" ? (
                <p className="whitespace-pre-wrap leading-relaxed text-text">{note.content}</p>
              ) : (
                <details>
                  <summary className="cursor-pointer text-muted hover:text-text">展開防雷內容</summary>
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed text-text">{note.content}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AnimeInfoSection({ anime, altTitles }: { anime: Anime; altTitles: string[] }) {
  const hasMore = altTitles.length > 0 || anime.description || (anime.metadataSource && anime.metadataSource !== "manual");
  if (!hasMore) return null;

  return (
    <section className="border-y border-border/50 py-5 lg:border-y-0 lg:py-0">
      <p className="section-label mb-3">作品資訊</p>
      <div className="space-y-3">
        {altTitles.length > 0 && (
          <div className="space-y-0.5 font-mono text-xs text-muted">
            {altTitles.map((t) => <div key={t}>{t}</div>)}
          </div>
        )}
        {anime.description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted">{anime.description}</p>
        )}
        {anime.metadataSource && anime.metadataSource !== "manual" && (
          <p className="kbd-label">
            資料來源：{anime.metadataSource.toUpperCase()}
            {anime.externalAnilistId && ` · AniList #${anime.externalAnilistId}`}
          </p>
        )}
      </div>
    </section>
  );
}
