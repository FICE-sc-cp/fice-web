'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Department } from '@/lib/api';
import { Button } from './ui/Button';
import { hapticNotify } from '@/lib/telegram';

export function MemberDepartments({
  memberId,
  assignments,
}: {
  memberId: string;
  assignments: { id: string; department: Department }[];
}) {
  const qc = useQueryClient();
  const { data: all } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.departments(),
  });
  const [selected, setSelected] = useState('');

  const assignedIds = new Set(assignments.map((a) => a.department.id));
  const available = (all ?? []).filter((d) => !assignedIds.has(d.id));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['members'] });

  const add = useMutation({
    mutationFn: (departmentId: string) => api.assignMember(memberId, departmentId),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
      setSelected('');
    },
  });
  const remove = useMutation({
    mutationFn: (departmentId: string) => api.unassignMember(memberId, departmentId),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
    },
  });

  return (
    <div className="mt-6 rounded-2xl border border-border bg-bg-soft p-4">
      <p className="mb-3 text-sm font-semibold text-muted">Департаменти учасника</p>

      {assignments.length ? (
        <ul className="mb-3 flex flex-col gap-2">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2"
            >
              <span className="truncate text-sm">{a.department.name}</span>
              <button
                type="button"
                onClick={() => remove.mutate(a.department.id)}
                className="shrink-0 text-sm text-brand-red"
              >
                Прибрати
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-subtle">Не призначено у департаменти.</p>
      )}

      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg outline-none"
        >
          <option value="">Обрати департамент…</option>
          {available.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
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
