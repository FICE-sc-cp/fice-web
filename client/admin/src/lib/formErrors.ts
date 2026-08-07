'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  FieldErrors,
  FieldValues,
  Path,
  UseFormSetError,
} from 'react-hook-form';
import { ApiError, describeDetail, errorList, translateDetail } from './errors';

interface ServerFieldError {
  field: string;
  message: string;
  labeled: string;
}

function splitServerError(
  error: unknown,
  known: string[],
): { fields: ServerFieldError[]; rest: string[] } {
  if (!error) return { fields: [], rest: [] };

  if (error instanceof ApiError && error.details.length > 0) {
    const fields: ServerFieldError[] = [];
    const rest: string[] = [];
    for (const detail of error.details) {
      const { field, message } = describeDetail(detail);
      const root = field.split('.')[0];
      const isField =
        /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*$/.test(field) &&
        (known.length === 0 || known.includes(root));
      if (isField) {
        if (!fields.some((f) => f.field === field)) {
          fields.push({ field, message, labeled: translateDetail(detail) });
        }
      } else {
        rest.push(translateDetail(detail));
      }
    }
    return { fields, rest };
  }

  return { fields: [], rest: errorList(error) };
}

export function focusField(form: HTMLFormElement | null, name: string) {
  if (!form) return;
  const el = form.querySelector<HTMLElement>(`[name="${name}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => el.focus({ preventScroll: true }), 350);
}

export function focusFirstOf(form: HTMLFormElement | null, names: string[]) {
  if (!form || names.length === 0) return;
  const inDomOrder = Array.from(form.querySelectorAll<HTMLElement>('[name]'))
    .map((el) => el.getAttribute('name') ?? '')
    .filter((name) => names.includes(name));
  focusField(form, inDomOrder[0] ?? names[0]);
}

export function useFormErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: string[] = [],
) {
  const formRef = useRef<HTMLFormElement>(null);
  const knownKey = knownFields.join('|');
  const known = useMemo(
    () => knownKey.split('|').filter(Boolean),
    [knownKey],
  );
  const { fields, rest } = useMemo(
    () => splitServerError(error, known),
    [error, known],
  );

  const fieldErrors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of fields) map[item.field] = item.message;
    return map;
  }, [fields]);

  useEffect(() => {
    if (fields.length === 0) return;
    for (const item of fields) {
      if (!item.field.includes('.')) {
        setError(item.field as Path<T>, {
          type: 'server',
          message: item.message,
        });
      }
    }
    focusFirstOf(
      formRef.current,
      fields.map((f) => f.field),
    );
  }, [fields, setError]);

  const onInvalid = useCallback((errors: FieldErrors<T>) => {
    focusFirstOf(formRef.current, Object.keys(errors));
  }, []);

  return { formRef, onInvalid, fieldErrors, serverMessages: rest };
}
