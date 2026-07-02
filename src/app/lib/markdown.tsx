import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

// react-markdown 預設不渲染原始 HTML（會當純文字 escape），dangerous URL
// （javascript: 等）也會被內建 urlTransform 淨化，所以使用者輸入是安全的。
// remark-gfm 讓裸網址自動變連結，remark-breaks 讓單一換行就是換行。
export function Markdown({ text, className = "" }: Readonly<{ text: string; className?: string }>) {
  return (
    <div className={`space-y-2 break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        allowedElements={[
          "p", "br", "strong", "em", "del", "code", "pre", "a",
          "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
        ]}
        unwrapDisallowed
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-accent"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-medium text-text">{children}</strong>,
          code: ({ children }) => <code className="kbd-label">{children}</code>,
          ul: ({ children }) => <ul className="list-disc space-y-0.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-0.5 pl-5">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border/60 pl-3">{children}</blockquote>
          ),
          // 公告不需要巨型標題——所有層級都收斂成同一種小標樣式
          h1: ({ children }) => <p className="font-medium text-text">{children}</p>,
          h2: ({ children }) => <p className="font-medium text-text">{children}</p>,
          h3: ({ children }) => <p className="font-medium text-text">{children}</p>,
          h4: ({ children }) => <p className="font-medium text-text">{children}</p>,
          h5: ({ children }) => <p className="font-medium text-text">{children}</p>,
          h6: ({ children }) => <p className="font-medium text-text">{children}</p>,
          hr: () => <hr className="border-border/40" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
