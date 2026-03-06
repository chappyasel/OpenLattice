"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { slugify } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onInternalLinkClick?: (slug: string) => void;
}

function preprocessWikilinks(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_match, topicName: string) => {
    const slug = slugify(topicName.trim());
    return `[${topicName.trim()}](/topic/${slug})`;
  });
}

export function MarkdownRenderer({
  content,
  className,
  onInternalLinkClick,
}: MarkdownRendererProps) {
  const processed = preprocessWikilinks(content);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            if (href?.startsWith("/topic/") && onInternalLinkClick) {
              const slug = href.replace("/topic/", "");
              return (
                <button
                  type="button"
                  onClick={() => onInternalLinkClick(slug)}
                  className="text-brand-blue underline underline-offset-4 hover:text-brand-blue/80"
                >
                  {children}
                </button>
              );
            }
            if (href?.startsWith("/")) {
              return (
                <Link
                  href={href}
                  className="text-brand-blue underline underline-offset-4 hover:text-brand-blue/80"
                  {...props}
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-blue underline underline-offset-4 hover:text-brand-blue/80"
                {...props}
              >
                {children}
              </a>
            );
          },
          h1: ({ children, ...props }) => (
            <h1 className="mt-8 mb-4 text-3xl font-bold tracking-tight" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="mt-6 mb-3 text-2xl font-semibold tracking-tight" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="mt-4 mb-2 text-xl font-semibold tracking-tight" {...props}>
              {children}
            </h3>
          ),
          p: ({ children, ...props }) => (
            <p className="mb-4 leading-[1.7]" {...props}>
              {children}
            </p>
          ),
          ul: ({ children, ...props }) => (
            <ul className="mb-4 ml-6 list-disc" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="mb-4 ml-6 list-decimal" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="mb-1" {...props}>
              {children}
            </li>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="mb-4 border-l-4 border-border pl-4 italic text-muted-foreground"
              {...props}
            >
              {children}
            </blockquote>
          ),
          code: ({ children, className: codeClassName, ...props }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`block rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto ${codeClassName}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children, ...props }) => (
            <pre className="mb-4 overflow-x-auto" {...props}>
              {children}
            </pre>
          ),
        }}
      />
    </div>
  );
}

export function extractWikilinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  return [...matches].map((m) => m[1]!.trim());
}
