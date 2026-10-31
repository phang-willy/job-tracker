import { Check, ChevronDown } from 'lucide-react';
import {
  Content,
  Icon,
  Item,
  ItemIndicator,
  ItemText,
  Portal,
  Root,
  Trigger,
  Value,
  Viewport,
} from '@radix-ui/react-select';
import type { ComponentProps } from 'react';
import { cn } from '@/src/presentation/shared/cn';

export const Select = Root;

export function SelectValue(props: ComponentProps<typeof Value>) {
  return <Value {...props} />;
}

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Trigger>) {
  return (
    <Trigger
      className={cn(
        'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 data-placeholder:text-neutral-500 [&>span]:truncate',
        className,
      )}
      {...props}
    >
      {children}
      <Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-neutral-500" />
      </Icon>
    </Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: ComponentProps<typeof Content>) {
  return (
    <Portal>
      <Content
        className={cn(
          'z-50 max-h-60 overflow-y-auto rounded-md border border-neutral-200 bg-white p-1 text-sm text-neutral-900 shadow-md',
          position === 'popper' && 'w-(--radix-select-trigger-width)',
          className,
        )}
        position={position}
        sideOffset={4}
        {...props}
      >
        <Viewport>{children}</Viewport>
      </Content>
    </Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Item>) {
  return (
    <Item
      className={cn(
        'relative flex w-full cursor-pointer items-center rounded-sm py-1.5 pr-8 pl-2 outline-none focus:bg-neutral-100 data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <ItemText>{children}</ItemText>
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <ItemIndicator>
          <Check className="size-4" />
        </ItemIndicator>
      </span>
    </Item>
  );
}
