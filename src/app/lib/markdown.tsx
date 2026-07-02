import { Fragment, type ReactNode } from "react";

// 極簡 Markdown 子集，直接輸出 React 元素——不經 innerHTML，所有內容一律被
// React escape，天生沒有 XSS 面。支援：空行分段、換行、- 條列、**粗體**、
// *斜體*、`code`、[文字](http(s) 連結)。連結只接受 http/https。
// ponytail: 公告用不到完整 markdown；需要表格或圖片時再考慮引入套件
const INLINE = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    const index = m.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    if (m[1]) out.push(<strong key={key++} className="font-medium text-text">{m[1].slice(2, -2)}</strong>);
    else if (m[2]) out.push(<em key={key++}>{m[2].slice(1, -1)}</em>);
    else if (m[3]) out.push(<code key={key++} className="kbd-label">{m[3].slice(1, -1)}</code>);
    else {
      out.push(
        <a
          key={key++}
          href={m[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-accent"
        >
          {m[4]}
        </a>,
      );
    }
    last = index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function withLineBreaks(block: string): ReactNode[] {
  return block.split("\n").flatMap((line, i) => {
    const content = <Fragment key={`l${i}`}>{inline(line)}</Fragment>;
    return i === 0 ? [content] : [<br key={`b${i}`} />, content];
  });
}

export function Markdown({ text, className = "" }: Readonly<{ text: string; className?: string }>) {
  const blocks = text.replaceAll("\r\n", "\n").split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, bi) => {
        const rows = block.split("\n");
        if (rows.every((row) => /^\s*- /.test(row))) {
          return (
            <ul key={bi} className="list-disc space-y-0.5 pl-5">
              {rows.map((row, ri) => (
                <li key={ri}>{inline(row.replace(/^\s*- /, ""))}</li>
              ))}
            </ul>
          );
        }
        return <p key={bi}>{withLineBreaks(block)}</p>;
      })}
    </div>
  );
}
