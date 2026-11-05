'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import type { AdminState } from '@/lib/merch-types';
import { errorText, useSurface } from '../ui';

export const NO_ACCESS = 'Немає доступу до адмінки.';

/** Lives across admin routes: a screen paints at once and refreshes behind it. */
let last: AdminState | null = null;

// A state read that overlaps an optimistic change is older than the screen, so it is dropped.
let changes = 0; // bumped by every optimistic change and when its request ends
let inFlight = 0;

/** Wraps the request behind an optimistic change. */
export function sending<T>(request: Promise<T>): Promise<T> {
  inFlight++;
  return request.finally(() => {
    inFlight--;
    changes++;
  });
}

export function useAdminState() {
  const { api, ready, signedIn } = useSurface();
  const [state, setState] = useState(last);
  const [fresh, setFresh] = useState(false); // this screen has heard from the server
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const started = changes;
    return api.admin.state().then(
      (next) => {
        setFresh(true);
        setError(null);
        if (started !== changes || inFlight) return;
        last = next;
        setState(next);
      },
      (err: unknown) => {
        const denied = err instanceof ApiError && err.status === 403;
        if (denied) {
          last = null;
          setState(null);
        }
        setError(denied ? NO_ACCESS : errorText(err, 'Не вдалося завантажити дані.'));
      },
    );
  }, [api]);

  useEffect(() => {
    if (ready && signedIn) void refresh();
  }, [ready, signedIn, refresh]);

  /** Optimistic change: moves a row or flips a pill before the server answers. */
  const patch = useCallback((change: (s: AdminState) => AdminState) => {
    if (!last) return;
    changes++;
    last = change(last);
    setState(last);
  }, []);

  return { state, fresh, error, refresh, patch };
}
