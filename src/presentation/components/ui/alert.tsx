import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, Info } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/src/presentation/shared/cn';

const alertVariants = cva(
  'flex w-full gap-2 rounded-md border px-3 py-2 text-sm',
  {
    variants: {
      variant: {
        default: 'border-neutral-200 bg-neutral-50 text-neutral-800',
        warning: 'border-amber-200 bg-amber-50 text-amber-950',
        destructive: 'border-red-200 bg-red-50 text-red-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export function Alert({
  className,
  variant,
  children,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  const Icon =
    variant === 'default' || variant === undefined ? Info : CircleAlert;

  return (
    <div
      role={
        variant === 'destructive' || variant === 'warning' ? 'alert' : 'status'
      }
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
