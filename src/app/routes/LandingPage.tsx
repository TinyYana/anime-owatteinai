import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useAuth, login } from "../lib/auth";
import { Button } from "../components/ui";
import { AnnouncementStrip } from "../components/Announcements";
import { EASE } from "../lib/motion";

gsap.registerPlugin(useGSAP);

const errorMessages: Record<string, string> = {
  banned: "這個帳號已被停權，無法登入。",
  oauth_state: "登入連線逾時或被中斷，請再試一次。",
  oauth_failed: "Discord 授權失敗，請再試一次。",
  not_in_guild: "你目前不在彼岸花社群，請先加入 Discord 伺服器再申請。",
};

function DiscordLogo() {
  return (
    <svg className="h-5 w-5 text-white/90" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.32 4.37a19.8 19.8 0 0 0-4.9-1.52.07.07 0 0 0-.08.04c-.21.38-.45.88-.62 1.27a18.3 18.3 0 0 0-5.44 0 13 13 0 0 0-.63-1.27.08.08 0 0 0-.08-.04c-1.7.3-3.35.82-4.9 1.52a.06.06 0 0 0-.03.03C.54 9.05-.32 13.58.1 18.06c0 .02.02.05.04.06a20 20 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.22-2a.08.08 0 0 0-.04-.1 13 13 0 0 1-1.88-.9.08.08 0 0 1 0-.13l.37-.3a.08.08 0 0 1 .08 0 14.2 14.2 0 0 0 12.06 0 .08.08 0 0 1 .08 0l.38.3a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.89.9a.08.08 0 0 0-.04.1c.36.7.77 1.37 1.22 2a.08.08 0 0 0 .08.03 19.9 19.9 0 0 0 6-3.03.08.08 0 0 0 .04-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42 2.17 1.1 2.16 2.42c0 1.34-.95 2.42-2.16 2.42Z" />
    </svg>
  );
}

export function LandingPage() {
  const { me, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const error = params.get("error");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || !me) return;
    navigate(me.role === "pending" ? "/apply" : "/app", { replace: true });
  }, [me, loading, navigate]);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        gsap.from("[data-hero]", {
          opacity: 0,
          y: 14,
          duration: 0.55,
          ease: EASE,
          stagger: 0.09,
          clearProps: "opacity,transform",
        });
        // Ambient: petals drift up and sway, each on its own loop.
        gsap.utils.toArray<HTMLElement>(".petal").forEach((el, i) => {
          gsap.to(el, {
            y: "-=40",
            x: i % 2 ? "+=18" : "-=18",
            rotation: i % 2 ? 24 : -24,
            duration: 7 + i * 1.3,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            delay: i * 0.6,
          });
        });
        // Signature progress motif fills toward its resting width.
        gsap.fromTo("[data-rail] > span", { width: "0%" }, { width: "62%", duration: 1.1, ease: EASE, delay: 0.5 });
      }
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative z-10 flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Ambient layer — soft drifting petals + signature bloom */}
      <span className="higanbana left-[12%] top-[18%] h-40 w-40 opacity-[0.07]" aria-hidden="true" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="petal pointer-events-none absolute rounded-full"
          aria-hidden="true"
          style={{
            left: `${12 + i * 14}%`,
            top: `${24 + (i % 3) * 22}%`,
            width: 8 + (i % 3) * 4,
            height: 8 + (i % 3) * 4,
            background: "radial-gradient(circle at 35% 30%, var(--color-accent), transparent 70%)",
            opacity: 0.25,
          }}
        />
      ))}

      <p data-hero className="section-label mb-8 tracking-widest">彼岸花社群 · 申請制</p>

      <h1 data-hero className="text-4xl font-bold tracking-tight text-text sm:text-5xl">
        追番<span className="text-accent">進行式</span>
      </h1>
      <p data-hero className="mt-2 font-mono text-xs tracking-[0.25em] text-muted">AnimeOwatteiNai</p>

      <p data-hero className="mt-7 max-w-sm text-base leading-relaxed text-muted">
        追番永遠追不完，<br className="sm:hidden" />
        所以讓系統記得你看到哪。
      </p>

      {/* Signature progress motif — a glimpse of what the app is for */}
      <div data-hero className="mt-8 w-56">
        <div data-rail className="rail">
          <span style={{ width: "62%" }} />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[0.7rem] text-muted/70">
          <span>接著看</span>
          <span>EP 07 / 12</span>
        </div>
      </div>

      <div data-hero className="mt-9">
        <Button onClick={login} disabled={loading} className="gap-2 px-7 py-2.5 text-base">
          <DiscordLogo />
          使用 Discord 登入
        </Button>
      </div>

      {error && (
        <p className="mt-6 text-sm text-accent">
          {errorMessages[error] ?? "發生未知錯誤，請再試一次。"}
        </p>
      )}

      <div data-hero className="mt-8 w-full max-w-2xl text-left">
        <AnnouncementStrip limit={2} />
      </div>

      <div data-hero className="mt-10 flex items-center gap-0 text-xs text-muted/50">
        <span className="rounded-full border border-border/60 px-3 py-1">① Discord 登入</span>
        <span className="px-2">·</span>
        <span className="rounded-full border border-border/60 px-3 py-1">② 管理員審核</span>
        <span className="px-2">·</span>
        <span className="rounded-full border border-border/60 px-3 py-1">③ 開始追番</span>
      </div>

      <p className="mt-12 max-w-xs text-xs leading-relaxed text-muted/60">
        本站只整理觀看進度與觀看入口，不代管、不嵌入、不下載任何影片。
        <br />
        <a href="/terms" className="mt-1 inline-block hover:text-muted/90 underline underline-offset-2">
          服務條款與隱私說明
        </a>
      </p>
    </div>
  );
}
