'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo, useState, useEffect } from 'react';
import { Streamdown } from 'streamdown';
import { processTextWithCitations } from '@/components/citation-processor';
import { CitationList } from '@/components/citation';

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, children, ...props }: ResponseProps) => {
    const [sources, setSources] = useState<string[]>([]);
    const [processedText, setProcessedText] = useState<string>('');

    useEffect(() => {
      if (typeof children === 'string') {
        const { sources: foundSources } = processTextWithCitations(children);
        setSources(foundSources);

        if (foundSources.length > 0) {
          // Replace citations with numbered references
          let text = children;
          const citationMap = new Map<string, number>();
          let citationIndex = 1;

          // Create citation map
          const citationPattern = /\[Source:\s*([^\]]+)\]/g;
          let match: RegExpExecArray | null;
          match = citationPattern.exec(children);
          while (match !== null) {
            const sourceName = match[1];
            if (!citationMap.has(sourceName)) {
              citationMap.set(sourceName, citationIndex++);
            }
            match = citationPattern.exec(children);
          }

          // Replace citations with numbers
          citationMap.forEach((index, sourceName) => {
            const pattern = new RegExp(
              `\\[Source:\\s*${sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`,
              'g',
            );
            text = text.replace(pattern, `[${index}]`);
          });

          setProcessedText(text);
        } else {
          setProcessedText(children);
        }
      } else {
        setProcessedText('');
        setSources([]);
      }
    }, [children]);

    return (
      <div>
        <Streamdown
          className={cn(
            'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-words [&_code]:whitespace-pre-wrap',
            className,
          )}
          {...props}
        >
          {processedText}
        </Streamdown>
        {sources.length > 0 && <CitationList sources={sources} />}
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = 'Response';
