'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Partner } from '@/lib/api';
import { Button } from './ui/Button';
import { hapticNotify } from '@/lib/telegram';

export function EventPartners({
  eventId,
  attached,
}: {
  eventId: string;
  attached: { partner: Partner }[];
}) {
  const qc = useQueryClient();
  const { data: all } = useQuery({ queryKey: ['partners'], queryFn: () => api.partners() });
  const [selected, setSelected] = useState('');

  const attachedIds = new Set(attached.map((a) => a.partner.id));
  const available = (all?.items ?? []).filter(
    (p) => p.isApproved && !attachedIds.has(p.id),
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ['event', eventId] });

  const add = useMutation({
    mutationFn: (partnerId: string) => api.addEventPartner(eventId, partnerId),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
      setSelected('');
    },
  });
  const remove = useMutation({
    mutationFn: (partnerId: string) => api.removeEventPartner(eventId, partnerId),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
    },
  });

  return (
    <div className="mt-6 rounded-2xl border border-border bg-bg-soft p-4">
      <p className="mb-3 text-sm font-semibold text-muted">Партнери заходу</p>

      {attached.length ? (
        <ul className="mb-3 flex flex-col gap-2">
          {attached.map((a) => (
            <li
              key={a.partner.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2"
            >
              <span className="truncate text-sm">{a.partner.name}</span>
              <button
                type="button"
                onClick={() => remove.mutate(a.partner.id)}
                className="shrink-0 text-sm text-brand-red"
              >
                Прибрати
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-subtle">Партнерів не привʼязано.</p>
      )}

      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg outline-none"
        >
          <option value="">Обрати партнера…</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          disabled={!selected || add.isPending}
          onClick={() => selected && add.mutate(selected)}
        >
          Додати
        </Button>
      </div>
    </div>
  );
}
