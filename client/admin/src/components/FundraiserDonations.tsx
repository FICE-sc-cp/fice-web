'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Donation } from '@/lib/api';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { hapticNotify } from '@/lib/telegram';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FundraiserDonations({
  fundraiserId,
  donations,
}: {
  fundraiserId: string;
  donations: Donation[];
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['fundraiser', fundraiserId] });

  const add = useMutation({
    mutationFn: () =>
      api.addDonation(fundraiserId, {
        name: name.trim() || undefined,
        amount: Number(amount),
      }),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
      setName('');
      setAmount('');
    },
  });

  const remove = useMutation({
    mutationFn: (donationId: string) => api.removeDonation(fundraiserId, donationId),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
    },
  });

  const amountNum = Number(amount);
  const canAdd = Number.isFinite(amountNum) && amountNum > 0 && !add.isPending;

  return (
    <div className="mt-8 rounded-2xl border border-border bg-bg-soft p-4">
      <p className="mb-1 text-sm font-semibold text-muted">Останні донати</p>
      <p className="mb-3 text-xs text-subtle">
        Показуються на сторінці збору. Додавання донату автоматично підвищує
        «Зібрано» і лічильник донатів.
      </p>

      {donations.length ? (
        <ul className="mb-4 flex flex-col gap-2">
          {donations.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">
                  {d.name?.trim() || 'Анонім'}
                </span>
                <span className="text-xs text-subtle">{fmtDate(d.createdAt)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-bold text-brand-cyan">
                  {Number(d.amount).toLocaleString('uk-UA')} ₴
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate(d.id)}
                  disabled={remove.isPending}
                  aria-label="Видалити донат"
                  className="text-brand-red"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-xs text-subtle">Донатів ще немає.</p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <Input
          label="Імʼя (порожнє = Анонім)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Сума, ₴"
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!canAdd}
          onClick={() => add.mutate()}
        >
          {add.isPending ? 'Додаємо…' : 'Додати донат'}
        </Button>
      </div>
    </div>
  );
}
