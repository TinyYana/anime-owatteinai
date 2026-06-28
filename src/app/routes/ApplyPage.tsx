import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Panel, Button, Field, Textarea, Badge, ErrorText } from "../components/ui";
import { useReveal } from "../lib/motion";
import type { AccessApplication } from "../../shared/types";

export function ApplyPage() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [application, setApplication] = useState<AccessApplication | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (me && me.role !== "pending") navigate("/app", { replace: true });
  }, [me, navigate]);

  useEffect(() => {
    api
      .get<AccessApplication | null>("/api/application/me")
      .then((app) => {
        setApplication(app);
        if (app?.message) setMessage(app.message);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const app = await api.post<AccessApplication>("/api/application", {
        message: message.trim() || null,
      });
      setApplication(app);
    } catch (err) {
      setError(err instanceof ApiError ? "送出失敗，請稍後再試。" : "發生未知錯誤。");
    } finally {
      setSubmitting(false);
    }
  }

  const waiting = application?.status === "pending";
  const scope = useReveal<HTMLDivElement>([loaded, waiting]);

  return (
    <div ref={scope} className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <header data-reveal>
        <p className="section-label">申請加入追番中樞</p>
        <h1 className="mt-1 text-2xl font-semibold text-text">尚未確認的帳號</h1>
      </header>

      <Panel data-reveal className="space-y-3">
        <div className="section-label">目前帳號</div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-text">{me?.discordGlobalName ?? me?.discordUsername}</div>
            <div className="font-mono text-xs text-muted">@{me?.discordUsername}</div>
          </div>
          <Badge>{me?.role}</Badge>
        </div>
      </Panel>

      {waiting ? (
        <Panel data-reveal className="space-y-2 border-signal/30">
          <Badge tone="signal">等待審核中</Badge>
          <p className="text-sm leading-relaxed text-muted">
            申請已送出，管理員審核通過後即可進入。可以先去 Discord 戳一下管理員。
          </p>
          {application?.message && (
            <p className="border-l-2 border-border/60 pl-3 text-sm text-muted">
              「{application.message}」
            </p>
          )}
        </Panel>
      ) : (
        loaded && (
          <div data-reveal className="space-y-4">
            <Field label="申請訊息（選填）">
              <Textarea
                value={message}
                maxLength={1000}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="說一下你是誰、怎麼進來的、想追什麼番…"
              />
            </Field>
            {error && <ErrorText>{error}</ErrorText>}
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? "送出中…" : "送出申請"}
            </Button>
          </div>
        )
      )}

      <button
        onClick={() => logout().then(() => navigate("/"))}
        className="section-label hover:text-text transition-colors text-left"
      >
        登出
      </button>
    </div>
  );
}
