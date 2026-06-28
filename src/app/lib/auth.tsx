import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, ApiError } from "./api";
import type { MeResponse, RolePermission } from "../../shared/types";

interface AuthState {
  me: MeResponse | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setMe(await api.get<MeResponse>("/api/me"));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setMe(null);
      } else {
        throw err;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");
    setMe(null);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return (
    <AuthContext.Provider value={{ me, loading, refetch, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function login() {
  window.location.href = "/api/auth/discord";
}

export function hasPermission(me: MeResponse | null | undefined, permission: RolePermission): boolean {
  return me?.permissions.includes(permission) ?? false;
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="kbd-label animate-pulse">連線中…</span>
    </div>
  );
}

/** Requires login + app access. Pending → /apply. */
export function RequireApp({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!me) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  if (me.role === "pending") return <Navigate to="/apply" replace />;
  if (!hasPermission(me, "app.access")) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Requires the admin panel permission. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <Loading />;
  if (!me) return <Navigate to="/" replace />;
  if (!hasPermission(me, "admin.access")) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

/** Requires login only (used by /apply, which pending users must reach). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <Loading />;
  if (!me) return <Navigate to="/" replace />;
  return <>{children}</>;
}
