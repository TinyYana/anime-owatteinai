import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useAuth, login } from "../lib/auth";
import { Button } from "../components/ui";
import { EASE } from "../lib/motion";

gsap.registerPlugin(useGSAP);

const errorMessages: Record<string, string> = {
  banned: "這個帳號已被停權，無法登入。",
  oauth_state: "登入連線逾時或被中斷，請再試一次。",
  oauth_failed: "Discord 授權失敗，請再試一次。",
  not_in_guild: "你目前不在彼岸花社群，請先加入 Discord 伺服器再申請。",
};

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
        <Button onClick={login} disabled={loading} className="px-7 py-2.5 text-base">
          使用 Discord 登入
        </Button>
      </div>

      {error && (
        <p className="mt-6 text-sm text-accent">
          {errorMessages[error] ?? "發生未知錯誤，請再試一次。"}
        </p>
      )}

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
