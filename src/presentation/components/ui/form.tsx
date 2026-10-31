import { Slot } from '@radix-ui/react-slot';
import { createContext, useContext, useId, type ComponentProps } from 'react';
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Label } from '@/src/presentation/components/ui/label';
import { cn } from '@/src/presentation/shared/cn';

const Form = FormProvider;

type FormFieldContextValue = {
  name: FieldPath<FieldValues>;
};

type FormItemContextValue = {
  id: string;
};

const FormFieldContext = createContext<FormFieldContextValue | null>(null);
const FormItemContext = createContext<FormItemContextValue | null>(null);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider
      value={{ name: props.name as FieldPath<FieldValues> }}
    >
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const fieldContext = useContext(FormFieldContext);
  const itemContext = useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (fieldContext === null || itemContext === null) {
    throw new Error(
      'Form field components must be used inside FormField and FormItem.',
    );
  }

  const fieldState = getFieldState(fieldContext.name, formState);

  return {
    id: itemContext.id,
    name: fieldContext.name,
    formItemId: `${itemContext.id}-form-item`,
    formDescriptionId: `${itemContext.id}-form-item-description`,
    formMessageId: `${itemContext.id}-form-item-message`,
    ...fieldState,
  };
}

function FormItem({ className, ...props }: ComponentProps<'div'>) {
  const id = useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        className={cn('flex min-w-0 flex-col gap-1', className)}
        {...props}
      />
    </FormItemContext.Provider>
  );
}

function FormLabel({ className, ...props }: ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField();

  return (
    <Label
      className={cn(error !== undefined && 'text-red-800', className)}
      {...props}
      htmlFor={formItemId}
    />
  );
}

function FormControl(props: ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();
  const describedBy = [
    formDescriptionId,
    error === undefined ? null : formMessageId,
  ]
    .filter((value) => value !== null)
    .join(' ');

  return (
    <Slot
      aria-describedby={describedBy === '' ? undefined : describedBy}
      aria-invalid={error !== undefined}
      {...props}
      id={formItemId}
    />
  );
}

function FormDescription({ className, ...props }: ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      className={cn('text-xs text-neutral-600', className)}
      {...props}
      id={formDescriptionId}
    />
  );
}

function FormMessage({ className, children, ...props }: ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField();
  const message =
    typeof error?.message === 'string' && error.message !== ''
      ? error.message
      : children;

  if (message === undefined || message === '') {
    return null;
  }

  return (
    <p
      role="alert"
      className={cn('text-xs text-red-800', className)}
      {...props}
      id={formMessageId}
    >
      {message}
    </p>
  );
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
};
