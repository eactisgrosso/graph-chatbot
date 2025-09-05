'use client';

import type { ReactNode } from 'react';
import { Citation, CitationList } from '@/components/citation';

// Citation pattern: [Source: Document Name]
const CITATION_PATTERN = /\[Source:\s*([^\]]+)\]/g;

export interface ProcessedText {
  content: ReactNode;
  sources: string[];
}

export function processTextWithCitations(text: string): ProcessedText {
  const sources: string[] = [];
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex lastIndex
  CITATION_PATTERN.lastIndex = 0;

  match = CITATION_PATTERN.exec(text);
  while (match !== null) {
    const [fullMatch, sourceName] = match;
    const sourceIndex = sources.indexOf(sourceName);
    let citationIndex: number;

    if (sourceIndex === -1) {
      // New source
      sources.push(sourceName);
      citationIndex = sources.length;
    } else {
      // Existing source
      citationIndex = sourceIndex + 1;
    }

    // Add text before citation
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add citation
    parts.push(
      <Citation
        key={`citation-${match.index}`}
        source={sourceName}
        index={citationIndex}
        className="mx-0.5"
      />,
    );

    lastIndex = match.index + fullMatch.length;
    match = CITATION_PATTERN.exec(text);
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return {
    content: parts.length > 0 ? parts : text,
    sources: sources,
  };
}

export function renderTextWithCitations(text: string): ReactNode {
  const { content, sources } = processTextWithCitations(text);

  if (sources.length === 0) {
    // Return the original text if no citations found
    return text;
  }

  return (
    <div>
      <div>{content}</div>
      <CitationList sources={sources} />
    </div>
  );
}
