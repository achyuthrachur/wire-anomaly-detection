import React from 'react';

/**
 * Lightweight markdown-to-JSX renderer for narrative panels.
 * Handles: ## headings, ### subheadings, **bold**, - bullets, blank lines.
 * No external dependencies — just regex + JSX.
 */

/** Replace **text** with <strong>text</strong> */
function parseInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

/** Render a single markdown line to JSX. */
function renderMarkdownLine(line: string, index: number): React.ReactNode {
  const trimmed = line.trim();

  // ## Heading 2
  if (trimmed.startsWith('## ')) {
    return (
      <h2 key={index} className="text-crowe-indigo-dark mt-4 mb-2 text-base font-bold">
        {parseInlineBold(trimmed.slice(3))}
      </h2>
    );
  }

  // ### Heading 3
  if (trimmed.startsWith('### ')) {
    return (
      <h3 key={index} className="text-crowe-indigo mt-3 mb-1 text-sm font-semibold">
        {parseInlineBold(trimmed.slice(4))}
      </h3>
    );
  }

  // - Bullet
  if (trimmed.startsWith('- ')) {
    return (
      <div key={index} className="mb-1 ml-4 flex gap-2">
        <span className="text-crowe-amber-dark shrink-0">&bull;</span>
        <span>{parseInlineBold(trimmed.slice(2))}</span>
      </div>
    );
  }

  // Blank line → spacer
  if (trimmed === '') {
    return <div key={index} className="h-2" />;
  }

  // Default paragraph
  return (
    <p key={index} className="mb-1">
      {parseInlineBold(trimmed)}
    </p>
  );
}

/** Render a full markdown string to JSX. */
export function renderMarkdownBlock(markdown: string): React.ReactNode {
  return markdown.split('\n').map((line, i) => renderMarkdownLine(line, i));
}
