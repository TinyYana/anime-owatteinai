import { NavLink, Outlet, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { hasPermission, useAuth } from "../lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { api } from "../lib/api";

const navItems = [
  { to: "/app", label: "接著看", end: true },
  { to: "/app/my-anime", label: "我的追番", end: false },
  { to: "/app/anime/new", label: "新增動畫", end: false },
  { to: "/app/settings", label: "設定", end: false },
];

const navLink = (active: boolean, admin = false) =>
  `rounded-lg px-3 py-1.5 transition-colors ${
    active
      ? "bg-accent/12 text-accent font-medium"
      : admin
        ? "text-accent/60 hover:text-accent hover:bg-accent/8"
        : "text-muted hover:text-text hover:bg-surface/60"
  }`;

export function AppLayout() {
  const { me } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const canReviewApplications = hasPermission(me, "applications.review");
  const canOpenAdmin = hasPermission(me, "admin.access");

  useEffect(() => {
    api
      .get<{ unreadCount: number }>("/api/my/notifications?limit=1")
      .then((data) => setUnreadCount(data.unreadCount))
      .catch(() => setUnreadCount(0));
  }, []);

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4">
      <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-ink/70 px-4 py-4 backdrop-blur-md">
        <Link to="/app" className="group relative flex items-center gap-2">
          <span className="higanbana -left-3 -top-2 h-9 w-9 transition-opacity group-hover:opacity-25" aria-hidden="true" />
          <img
            src="/logo-nobg.png"
            alt="追番進行式"
            className="relative h-7 w-auto"
          />
        </Link>
        <nav className="flex items-center gap-0.5 text-sm">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navLink(isActive)}>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/app/notifications" className={({ isActive }) => navLink(isActive)}>
            通知{unreadCount > 0 ? ` ${unreadCount}` : ""}
          </NavLink>
          {(canReviewApplications || canOpenAdmin) && (
            <>
              {canReviewApplications && (
                <NavLink to="/app/admin/applications" className={({ isActive }) => navLink(isActive, true)}>
                  審核
                </NavLink>
              )}
              {canOpenAdmin && (
                <NavLink to="/app/admin/panel" className={({ isActive }) => navLink(isActive, true)}>
                  管理
                </NavLink>
              )}
            </>
          )}
          <ThemeToggle />
        </nav>
      </header>

      <main className="flex-1 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border/50 py-5 flex items-center justify-between gap-4 flex-wrap">
        <p className="section-label">追番永遠追不完，所以讓系統記得你看到哪</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href="/terms" className="section-label transition-colors hover:text-text">服務條款</a>
          <a
            href="https://github.com/TinyYana/anime-owatteinai"
            target="_blank"
            rel="noopener noreferrer"
            className="section-label transition-colors hover:text-text"
          >
            github: TinyYana/anime-owatteinai
          </a>
          <a
            href="https://discord.gg/nMAz72MUxv"
            target="_blank"
            rel="noopener noreferrer"
            className="section-label transition-colors hover:text-text"
          >
            彼岸花社群永久邀請連結：https://discord.gg/nMAz72MUxv
          </a>
        </div>
      </footer>
    </div>
  );
}
