import type { ComponentProps } from 'react';
import { Root } from '@radix-ui/react-label';
import { cn } from '@/src/presentation/shared/cn';

export function Label({ className, ...props }: ComponentProps<typeof Root>) {
  return (
    <Root
      className={cn('text-sm font-medium text-neutral-900', className)}
      {...props}
    />
  );
}
