'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Network } from 'lucide-react';

export function KgSearchToggle({
  enabled,
  onToggle,
  className,
}: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
} & React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-testid="kg-search-toggle"
      variant="outline"
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(!enabled);
      }}
      className={cn(
        'rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200 transition-colors',
        enabled
          ? '!bg-primary !text-primary-foreground hover:!bg-primary/90 focus:!bg-primary focus:!text-primary-foreground focus-visible:!bg-primary focus-visible:!text-primary-foreground'
          : '!bg-background !text-foreground hover:!bg-accent focus:!bg-background focus:!text-foreground focus-visible:!bg-background focus-visible:!text-foreground',
        className,
      )}
      title={
        enabled
          ? 'Knowledge Graph search enabled'
          : 'Knowledge Graph search disabled'
      }
    >
      <Network size={14} />
    </Button>
  );
}
