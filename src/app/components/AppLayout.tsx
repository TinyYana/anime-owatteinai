import { NavLink, Outlet, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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
  `inline-flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors ${
    active
      ? "bg-accent/12 text-accent font-medium"
      : admin
        ? "text-accent/60 hover:text-accent hover:bg-accent/8"
        : "text-muted hover:text-text hover:bg-surface/60"
  }`;

type AdminTaskCounts = {
  pendingApplications: number;
  pendingEditRequests: number;
  total: number;
};

function CountPill({ count }: Readonly<{ count: number }>) {
  if (count <= 0) return null;
  return (
    <span className="min-w-5 rounded-full bg-accent/15 px-1.5 text-center font-mono text-[11px] leading-5 text-accent">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M12 .5a12 12 0 0 0-3.8 23.38c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.21.09 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.36 2.8a13.7 13.7 0 0 0-.64 1.32 18.4 18.4 0 0 0-5.5 0 12.5 12.5 0 0 0-.65-1.32 19.7 19.7 0 0 0-4.96 1.58C.48 9.22-.32 13.94.08 18.6a20 20 0 0 0 6.08 3.08 14.8 14.8 0 0 0 1.3-2.1 12.9 12.9 0 0 1-2.04-.98c.17-.12.34-.25.5-.38a14.1 14.1 0 0 0 12.16 0l.5.38c-.65.39-1.33.72-2.05.99.37.73.8 1.43 1.3 2.09a20 20 0 0 0 6.09-3.08c.47-5.4-.8-10.08-3.6-14.23ZM8.02 15.73c-1.18 0-2.15-1.08-2.15-2.41s.95-2.42 2.15-2.42 2.17 1.09 2.15 2.42c0 1.33-.95 2.41-2.15 2.41Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.41s.95-2.42 2.15-2.42 2.17 1.09 2.15 2.42c0 1.33-.95 2.41-2.15 2.41Z" />
    </svg>
  );
}

function FooterIconLink({ href, label, children }: Readonly<{ href: string; label: string; children: ReactNode }>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted transition-colors hover:border-accent/50 hover:bg-accent/8 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </a>
  );
}

export function AppLayout() {
  const { me } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminTasks, setAdminTasks] = useState<AdminTaskCounts | null>(null);
  const canReviewApplications = hasPermission(me, "applications.review");
  const canOpenAdmin = hasPermission(me, "admin.access");

  useEffect(() => {
    api
      .get<{ unreadCount: number }>("/api/my/notifications?limit=1")
      .then((data) => setUnreadCount(data.unreadCount))
      .catch(() => setUnreadCount(0));
  }, []);

  useEffect(() => {
    if (!canReviewApplications && !canOpenAdmin) {
      setAdminTasks(null);
      return;
    }
    api
      .get<AdminTaskCounts>("/api/admin/tasks")
      .then(setAdminTasks)
      .catch(() => setAdminTasks(null));
  }, [canReviewApplications, canOpenAdmin]);

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
            通知<CountPill count={unreadCount} />
          </NavLink>
          {(canReviewApplications || canOpenAdmin) && (
            <>
              {canReviewApplications && (
                <NavLink to="/app/admin/applications" className={({ isActive }) => navLink(isActive, true)}>
                  審核<CountPill count={adminTasks?.pendingApplications ?? 0} />
                </NavLink>
              )}
              {canOpenAdmin && (
                <NavLink to="/app/admin/panel" className={({ isActive }) => navLink(isActive, true)}>
                  管理<CountPill count={adminTasks?.pendingEditRequests ?? 0} />
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
          <FooterIconLink href="https://github.com/TinyYana/anime-owatteinai" label="GitHub">
            <GitHubIcon />
          </FooterIconLink>
          <FooterIconLink href="https://discord.gg/nMAz72MUxv" label="彼岸花社群邀請">
            <DiscordIcon />
          </FooterIconLink>
        </div>
      </footer>
    </div>
  );
}
