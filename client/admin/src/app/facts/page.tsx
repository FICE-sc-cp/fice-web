'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Facts } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';

const STATS: { key: keyof Facts; label: string }[] = [
  { key: 'eventsHeld', label: 'Проведено заходів' },
  { key: 'charityRaised', label: 'На благодійність, ₴' },
  { key: 'membersCount', label: 'Учасників' },
  { key: 'closedFundraisers', label: 'Закритих зборів' },
  { key: 'activeStudents', label: 'Активних студентів (блок «Партнери»)' },
  { key: 'activePartners', label: 'Діючих партнерів (блок «Партнери»)' },
  { key: 'eventsPerYear', label: 'Заходів щороку (блок «Партнери»)' },
  { key: 'projectsDone', label: 'Реалізованих проєктів (блок «Партнери»)' },
];

export default function FactsPage() {
  const qc = useQueryClient();
  const { data: facts, isLoading } = useQuery({
    queryKey: ['facts'],
    queryFn: () => api.facts(),
  });
  const { data: overrides } = useQuery({
    queryKey: ['factOverrides'],
    queryFn: () => api.factOverrides(),
  });

  const overridden = new Set((overrides ?? []).map((o) => o.key));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['facts'] });
    qc.invalidateQueries({ queryKey: ['factOverrides'] });
  };

  const save = useMutation({
    mutationFn: (p: { key: string; value: number }) =>
      api.setFactOverride(p.key, p.value),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
    },
  });
  const reset = useMutation({
    mutationFn: (key: string) => api.removeFactOverride(key),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
    },
  });

  const saving = save.isPending || reset.isPending;

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Факти та результати" />
      <p className="mb-5 text-sm text-muted">
        Значення рахуються автоматично з бази. За потреби впиши своє — воно
        матиме пріоритет на сайті.
      </p>

      {isLoading || !facts ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {STATS.map((s) => (
            <FactRow
              key={s.key}
              label={s.label}
              value={facts[s.key]}
              overridden={overridden.has(s.key)}
              saving={saving}
              onSave={(v) => save.mutate({ key: s.key, value: v })}
              onReset={() => reset.mutate(s.key)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function FactRow({
  label,
  value,
  overridden,
  saving,
  onSave,
  onReset,
}: {
  label: string;
  value: number;
  overridden: boolean;
  saving: boolean;
  onSave: (value: number) => void;
  onReset: () => void;
}) {
  const [input, setInput] = useState('');

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {overridden && (
          <span className="rounded bg-brand-orange/20 px-2 py-0.5 text-xs font-medium text-brand-orange">
            вручну
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-bold">{value.toLocaleString('uk-UA')}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Своє значення"
          className="min-w-0 flex-1 rounded-xl border border-border bg-bg-soft px-3 py-2 text-sm text-fg outline-none placeholder:text-subtle"
        />
        <Button
          variant="outline"
          disabled={input === '' || saving}
          onClick={() => {
            if (input !== '') {
              onSave(Number(input));
              setInput('');
            }
          }}
        >
          Зберегти
        </Button>
        {overridden && (
          <Button variant="ghost" disabled={saving} onClick={onReset}>
            Скинути
          </Button>
        )}
      </div>
    </div>
  );
}
