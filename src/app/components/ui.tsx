import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { SourceLink } from "../../shared/types";

export function Panel({ children, className = "", ...rest }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={`elev rounded-xl border border-border/60 bg-panel/85 p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ label, children }: Readonly<{ label?: string; children: ReactNode }>) {
  return (
    <div className="mb-3">
      {label && <div className="section-label">{label}</div>}
      <h2 className="text-xl font-semibold tracking-tight text-text">{children}</h2>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};
export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const styles: Record<string, string> = {
    primary: "bg-accent text-white shadow-sm hover:bg-accent/85 disabled:opacity-50",
    ghost: "border border-border/80 bg-transparent text-text hover:bg-surface hover:border-border",
    danger: "border border-accent-soft text-accent hover:bg-accent-soft/30",
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,border-color,transform,opacity] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}

export function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="block space-y-1.5">
      <span className="section-label">{label}</span>
      {children}
    </label>
  );
}

const inputBase =
  "rounded-lg border border-border/80 bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-muted/50 transition-colors focus:border-accent focus:outline-none";

function fieldClass(className: string) {
  const hasWidth = /\b(?:w-|min-w-|max-w-|flex-1|grow|basis-)/.test(className);
  return `${hasWidth ? "" : "w-full"} ${inputBase} ${className}`;
}

export function Input({ className = "", ...props }: Readonly<InputHTMLAttributes<HTMLInputElement>>) {
  return <input className={fieldClass(className)} {...props} />;
}
export function Textarea({ className = "", ...props }: Readonly<TextareaHTMLAttributes<HTMLTextAreaElement>>) {
  return <textarea className={`${fieldClass(className)} min-h-24 leading-relaxed`} {...props} />;
}
export function Select({ className = "", ...props }: Readonly<SelectHTMLAttributes<HTMLSelectElement>>) {
  return <select className={fieldClass(className)} {...props} />;
}

export function Badge({ children, tone = "muted" }: Readonly<{ children: ReactNode; tone?: "muted" | "accent" | "signal" }>) {
  const tones: Record<string, string> = {
    muted: "border-border/80 text-muted bg-surface/60",
    accent: "border-accent/40 text-accent bg-accent-soft/30",
    signal: "border-signal/40 text-signal bg-signal/10",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Signature progress motif — how far you've watched. `current` of `total`
 * (total optional; falls back to a short "in progress" sliver).
 */
export function ProgressRail({ current, total }: Readonly<{ current: number; total?: number | null }>) {
  const pct = total && total > 0 ? Math.min(100, Math.round((current / total) * 100)) : current > 0 ? 12 : 0;
  return (
    <div className="rail" role="presentation">
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Watch-launch buttons — open a curated source link in a new tab. */
export function SourceLinkButtons({ links }: Readonly<{ links: SourceLink[] }>) {
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.id}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-sm font-medium text-text transition-colors hover:border-accent/50 hover:text-accent"
        >
          <span aria-hidden="true">▶</span>
          {l.label}
        </a>
      ))}
    </div>
  );
}

export function ErrorText({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="text-sm text-accent">{children}</p>;
}

export function Loading({ label = "讀取中…" }: Readonly<{ label?: string }>) {
  return (
    <div className="flex items-center gap-2 py-8 text-muted">
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-accent" />
      <span className="section-label">{label}</span>
    </div>
  );
}
