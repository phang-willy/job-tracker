import { Content, Portal, Root, Trigger } from '@radix-ui/react-popover';
import type { ComponentProps } from 'react';
import { cn } from '@/src/presentation/shared/cn';

export const Popover = Root;

export const PopoverTrigger = Trigger;

export function PopoverContent({
  className,
  align = 'start',
  side = 'top',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof Content>) {
  return (
    <Portal>
      <Content
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-72 rounded-md border border-red-200 bg-white p-2 shadow-md outline-none',
          className,
        )}
        {...props}
      />
    </Portal>
  );
}
