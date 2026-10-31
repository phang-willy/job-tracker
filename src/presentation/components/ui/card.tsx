import type { ComponentProps } from 'react';
import { cn } from '@/src/presentation/shared/cn';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-md border border-neutral-200 bg-white', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-3', className)} {...props} />;
}
