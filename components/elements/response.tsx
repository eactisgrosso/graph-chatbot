'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo } from 'react';
import { Streamdown } from 'streamdown';

type ResponseProps = ComponentProps<typeof Streamdown>;

// Citation processing function
function processCitations(text: string) {
  const sourcePattern = /\[Source:\s*([^\]]+)\]/g;
  const kgPattern = /\[Knowledge Graph:\s*([^\]]+)\]/g;
  const sources: string[] = [];
  const citationMap = new Map<string, number>();
  let citationIndex = 1;

  // Find all source citations and create a map
  let match: RegExpExecArray | null;
  while ((match = sourcePattern.exec(text)) !== null) {
    const sourceName = match[1];
    if (!citationMap.has(sourceName)) {
      citationMap.set(sourceName, citationIndex++);
      sources.push(sourceName);
    }
  }

  // Find all knowledge graph citations and create a map
  kgPattern.lastIndex = 0; // Reset regex state
  while ((match = kgPattern.exec(text)) !== null) {
    const kgName = match[1];
    if (!citationMap.has(kgName)) {
      citationMap.set(kgName, citationIndex++);
      sources.push(kgName);
    }
  }

  if (sources.length === 0) {
    return { processedText: text, sources: [] };
  }

  // Replace citations with numbered references
  let processedText = text;
  citationMap.forEach((index, sourceName) => {
    // Replace source citations
    const sourceRegex = new RegExp(
      `\\[Source:\\s*${sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`,
      'g',
    );
    processedText = processedText.replace(sourceRegex, `[${index}]`);

    // Replace knowledge graph citations
    const kgRegex = new RegExp(
      `\\[Knowledge Graph:\\s*${sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`,
      'g',
    );
    processedText = processedText.replace(kgRegex, `[${index}]`);
  });

  return { processedText, sources };
}

export const Response = memo(
  ({ className, children, ...props }: ResponseProps) => {
    // Only process citations if the text contains citation patterns
    if (
      typeof children === 'string' &&
      (children.includes('[Source:') || children.includes('[Knowledge Graph:'))
    ) {
      const { processedText, sources } = processCitations(children);

      return (
        <div className="space-y-2">
          <Streamdown
            className={cn(
              'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-words [&_code]:whitespace-pre-wrap',
              className,
            )}
            {...props}
          >
            {processedText}
          </Streamdown>
          {sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Sources:
              </h4>
              <div className="space-y-1">
                {sources.map((source, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full border border-blue-200 bg-blue-50 text-blue-600 mr-2">
                      {index + 1}
                    </span>
                    {source}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Default rendering for all other content (essays, artifacts, etc.)
    return (
      <Streamdown
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-words [&_code]:whitespace-pre-wrap',
          className,
        )}
        {...props}
      >
        {children}
      </Streamdown>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = 'Response';
