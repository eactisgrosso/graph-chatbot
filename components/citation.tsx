'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface CitationProps {
  source: string;
  index: number;
  className?: string;
}

export function Citation({ source, index, className }: CitationProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'inline-flex items-center justify-center h-5 w-5 p-0 m-0 min-w-5 min-h-5',
            'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800',
            'text-blue-700 dark:text-blue-300 text-xs font-medium',
            'border border-blue-200 dark:border-blue-700',
            'rounded-full transition-all duration-200',
            'hover:scale-110 hover:shadow-sm',
            className,
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {index}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="text-sm">
          <div className="font-medium text-blue-600 dark:text-blue-400 mb-1">
            Source {index}
          </div>
          <div className="text-muted-foreground">{source}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface CitationListProps {
  sources: string[];
  className?: string;
}

export function CitationList({ sources, className }: CitationListProps) {
  if (sources.length === 0) return null;

  return (
    <div className={cn('mt-3 pt-3 border-t border-border', className)}>
      <div className="text-xs text-muted-foreground mb-2 font-medium">
        Sources:
      </div>
      <div className="space-y-1">
        {sources.map((source, index) => (
          <div
            key={`source-${source}`}
            className="flex items-center gap-2 text-xs"
          >
            <Citation source={source} index={index + 1} />
            <span className="text-muted-foreground truncate">{source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
